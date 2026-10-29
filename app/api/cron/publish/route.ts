import type { NextRequest } from 'next/server'
import { handleRoute, ok, ApiError } from '@/lib/api'
import { publishDueBooks } from '@/lib/books'
import { db } from '@/lib/db'

/**
 * نقطة النشر المجدول (Cron) — تنشر الكتب التي حان موعد نشرها المجدول.
 *
 * الحماية: تتطلب CRON_SECRET في البيئة، وتقبل الطلب فقط إذا حمل:
 *  - ترويسة Authorization: Bearer <CRON_SECRET>  (ما ترسله Vercel Cron تلقائيًا)
 *  - أو معامل ?secret=<CRON_SECRET>              (للتشغيل اليدوي)
 *
 * ملاحظة: النشر المجدول يعمل أيضًا "كسولًا" عند أي زيارة للموقع عبر
 * publishDueBooks() داخل استعلامات الكتب العامة، لذا هذه النقطة ضمانة
 * إضافية لضبط النشر في موعده حتى لو لم يزر أحد الموقع.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      throw new ApiError(403, 'نقطة النشر المجدول غير مفعلة: CRON_SECRET غير مضبوط')
    }

    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const querySecret = req.nextUrl.searchParams.get('secret') || ''
    if (bearer !== secret && querySecret !== secret) {
      throw new ApiError(403, 'غير مصرح')
    }

    await publishDueBooks()
    const scheduled = await db.book.count({ where: { status: 'SCHEDULED' } })
    return ok({ published: true, remainingScheduled: scheduled, at: new Date().toISOString() })
  })
}
