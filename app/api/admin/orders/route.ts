import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, ok, str } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { ORDER_STATUSES } from '@/lib/constants'
import { toAdminOrder } from '@/lib/admin-utils'

/** كل الطلبات تنازليًا بالأحدث، مع تصفية اختيارية بالحالة وبنود تشمل عنوان الكتاب */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin()

    const status = str(req.nextUrl.searchParams.get('status'), 30)
    const where = status && status in ORDER_STATUSES ? { status } : {}

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { book: { select: { title: true } } } } },
    })

    return ok({ orders: orders.map(toAdminOrder) })
  })
}
