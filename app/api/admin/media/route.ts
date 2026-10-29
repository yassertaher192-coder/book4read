import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { handleRoute, ok, str, assert, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { saveUploadedMedia } from '@/lib/media'
import { logAudit } from '@/lib/audit'
import { MEDIA_KINDS } from '@/lib/constants'
import { toAdminMedia } from '@/lib/admin-utils'

/** رفع ملف وسائط — نموذج multipart: file, kind, isPublic (اختياري) */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin()

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      throw new ApiError(400, 'يرجى إرسال الملف بنموذج multipart/form-data')
    }

    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError(400, 'يرجى اختيار ملف للرفع')

    const kind = str(form.get('kind'), 30)
    assert(kind in MEDIA_KINDS, 'نوع الوسائط غير صالح')

    const isPublicRaw = form.get('isPublic')
    const isPublicOverride = isPublicRaw === null ? undefined : str(isPublicRaw, 10) === 'true'

    const saved = await saveUploadedMedia(file, kind, isPublicOverride, admin.id)

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'MEDIA_CREATE',
      entity: 'MediaFile',
      entityId: saved.id,
      details: `${saved.originalName} (${saved.kind})`,
    })

    return ok({ media: toAdminMedia(saved) }, 201)
  })
}

/** قائمة ملفات الوسائط مع الكتب المرتبطة بكل ملف (غلاف/غلاف كامل/مرفق/معرض) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin()

    const sp = req.nextUrl.searchParams
    const q = str(sp.get('q'), 120)
    const kind = str(sp.get('kind'), 30)

    const where: Prisma.MediaFileWhereInput = {}
    if (q) where.originalName = { contains: q }
    if (kind && kind in MEDIA_KINDS) where.kind = kind

    const mediaRows = await db.mediaFile.findMany({ where, orderBy: { createdAt: 'desc' } })
    const ids = mediaRows.map((m) => m.id)

    // الكتب المرتبطة بأي ملف من القائمة (استعلام واحد ثم تجميع في الذاكرة)
    const linked = new Map<string, { id: string; title: string; slug: string }[]>()
    if (ids.length > 0) {
      const books = await db.book.findMany({
        where: {
          OR: [
            { coverImageId: { in: ids } },
            { fullCoverImageId: { in: ids } },
            { attachmentId: { in: ids } },
            { galleryImages: { some: { mediaId: { in: ids } } } },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          coverImageId: true,
          fullCoverImageId: true,
          attachmentId: true,
          galleryImages: { select: { mediaId: true } },
        },
      })
      for (const b of books) {
        const mediaIds = new Set<string>()
        if (b.coverImageId) mediaIds.add(b.coverImageId)
        if (b.fullCoverImageId) mediaIds.add(b.fullCoverImageId)
        if (b.attachmentId) mediaIds.add(b.attachmentId)
        for (const g of b.galleryImages) mediaIds.add(g.mediaId)
        for (const mediaId of mediaIds) {
          const arr = linked.get(mediaId) ?? []
          arr.push({ id: b.id, title: b.title, slug: b.slug })
          linked.set(mediaId, arr)
        }
      }
    }

    return ok({
      media: mediaRows.map((m) => ({ ...toAdminMedia(m), linkedBooks: linked.get(m.id) ?? [] })),
    })
  })
}
