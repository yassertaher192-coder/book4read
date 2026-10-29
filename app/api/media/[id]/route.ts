import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, ApiError } from '@/lib/api'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { readMediaBuffer } from '@/lib/media'

/**
 * خدمة الملفات المرفوعة مع تحقق صلاحيات على الخادم:
 * - الملفات العامة (أغلفة، صور معارض، بورتريه، شعار) متاحة للجميع.
 * - المشرفون (OWNER/EDITOR) يصلون إلى كل الملفات.
 * - الملفات الخاصة (PDF مثلاً): يُسمح للزائر فقط إن كانت مرفقة بكتاب منشور
 *   مفعّلة قراءته الرقمية، والتنزيل يتطلب تفعيل التنزيل صراحةً.
 * - لا يُكشف مسار الملف الأصلي على القرص إطلاقًا.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await ctx.params
    if (!/^[a-zA-Z0-9-]{10,40}$/.test(id)) throw new ApiError(400, 'معرّف ملف غير صالح')

    const media = await db.mediaFile.findUnique({ where: { id } })
    if (!media) throw new ApiError(404, 'الملف غير موجود')

    const download = req.nextUrl.searchParams.get('download') === '1'
    const user = await getSessionUser()

    if (!media.isPublic && !isAdmin(user)) {
      // ملف خاص: مسموح فقط كمرفق قراءة لكتاب منشور مفعّلة قراءته
      const book = await db.book.findFirst({
        where: { attachmentId: id },
        select: { status: true, readingEnabled: true, downloadEnabled: true },
      })
      const allowedInline = !!(book && book.status === 'PUBLISHED' && book.readingEnabled)
      const allowedDownload = allowedInline && !!book?.downloadEnabled
      if (download ? !allowedDownload : !allowedInline) {
        throw new ApiError(403, 'غير مصرح لك بالوصول إلى هذا الملف')
      }
    }

    const buffer = await readMediaBuffer(media.filename)
    const disposition = download
      ? `attachment; filename*=UTF-8''${encodeURIComponent(media.originalName)}`
      : 'inline'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': media.mimeType,
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.length),
        'Cache-Control': media.isPublic ? 'public, max-age=3600' : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
}
