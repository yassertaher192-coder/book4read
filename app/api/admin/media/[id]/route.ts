import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { deleteMediaRecord } from '@/lib/media'
import { toAdminMedia } from '@/lib/admin-utils'

/** تبديل ظهور ملف الوسائط للعموم */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.mediaFile.findUnique({ where: { id } })
    if (!existing) throw new ApiError(404, 'الملف غير موجود')

    const body = await readJson<{ isPublic?: unknown }>(req)
    if (typeof body.isPublic !== 'boolean') {
      throw new ApiError(400, 'قيمة isPublic يجب أن تكون منطقية (true/false)')
    }

    const media = await db.mediaFile.update({ where: { id }, data: { isPublic: body.isPublic } })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'MEDIA_UPDATE',
      entity: 'MediaFile',
      entityId: id,
      details: `${media.originalName}: ${media.isPublic ? 'عام' : 'خاص'}`,
    })

    return ok({ media: toAdminMedia(media) })
  })
}

/** حذف ملف وسائط (يفصل ارتباط الكتب عبر SetNull/ Cascade ويحذف من القرص) */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.mediaFile.findUnique({ where: { id }, select: { id: true, originalName: true } })
    if (!existing) throw new ApiError(404, 'الملف غير موجود')

    await deleteMediaRecord(id)

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'MEDIA_DELETE',
      entity: 'MediaFile',
      entityId: id,
      details: existing.originalName,
    })

    return ok({ ok: true })
  })
}
