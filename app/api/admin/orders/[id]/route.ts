import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { ORDER_STATUSES } from '@/lib/constants'
import { toAdminOrder } from '@/lib/admin-utils'

/** تحديث حالة الطلب أو الدفع */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.order.findUnique({ where: { id }, select: { id: true, status: true, paid: true } })
    if (!existing) throw new ApiError(404, 'الطلب غير موجود')

    const body = await readJson<{ status?: unknown; paid?: unknown }>(req)

    const data: { status?: string; paid?: boolean } = {}
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !(body.status in ORDER_STATUSES)) {
        throw new ApiError(400, 'حالة الطلب غير صالحة')
      }
      data.status = body.status
    }
    if (body.paid !== undefined) {
      if (typeof body.paid !== 'boolean') throw new ApiError(400, 'قيمة الدفع يجب أن تكون منطقية (true/false)')
      data.paid = body.paid
    }

    const order = await db.order.update({
      where: { id },
      data,
      include: { items: { include: { book: { select: { title: true } } } } },
    })

    if (data.status !== undefined && data.status !== existing.status) {
      await logAudit({
        user: { id: admin.id, name: admin.name },
        action: 'ORDER_STATUS_CHANGE',
        entity: 'Order',
        entityId: id,
        details: `${order.orderNumber}: من ${existing.status} إلى ${data.status}`,
      })
    }
    if (data.paid === true && !existing.paid) {
      await logAudit({
        user: { id: admin.id, name: admin.name },
        action: 'ORDER_PAID',
        entity: 'Order',
        entityId: id,
        details: `${order.orderNumber}: تم تعليم الطلب كمدفوع`,
      })
    }

    return ok({ order: toAdminOrder(order) })
  })
}
