import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, assert, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/**
 * تبديل ترتيب كتاب مع جاره (أعلى/أسفل) وفق [sortOrder تصاعديًا ثم createdAt تنازليًا].
 * عند تساوي قيم الترتيب تُعاد كتابة ترتيب تسلسلي لكل الكتب أولًا لضمان صحة التبديل.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin()

    const body = await readJson<{ id?: unknown; direction?: unknown }>(req)
    const id = str(body.id, 60)
    const direction = str(body.direction, 10)
    assert(!!id, 'معرّف الكتاب مطلوب')
    assert(direction === 'up' || direction === 'down', 'اتجاه الترتيب يجب أن يكون up أو down')

    const list = await db.book.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, sortOrder: true },
    })
    const idx = list.findIndex((b) => b.id === id)
    if (idx < 0) throw new ApiError(404, 'الكتاب غير موجود')

    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
    if (neighborIdx >= 0 && neighborIdx < list.length) {
      if (list[idx].sortOrder === list[neighborIdx].sortOrder) {
        // تطبيع الترتيب تسلسليًا ثم التبديل
        await db.$transaction(
          list.map((b, i) => db.book.update({ where: { id: b.id }, data: { sortOrder: i } })),
        )
        await db.$transaction([
          db.book.update({ where: { id: list[idx].id }, data: { sortOrder: neighborIdx } }),
          db.book.update({ where: { id: list[neighborIdx].id }, data: { sortOrder: idx } }),
        ])
      } else {
        const current = list[idx].sortOrder
        await db.$transaction([
          db.book.update({ where: { id: list[idx].id }, data: { sortOrder: list[neighborIdx].sortOrder } }),
          db.book.update({ where: { id: list[neighborIdx].id }, data: { sortOrder: current } }),
        ])
      }
      await logAudit({
        user: { id: admin.id, name: admin.name },
        action: 'BOOK_REORDER',
        entity: 'Book',
        entityId: id,
        details: direction === 'up' ? 'نقل الكتاب للأعلى' : 'نقل الكتاب للأسفل',
      })
    }

    return ok({ ok: true })
  })
}
