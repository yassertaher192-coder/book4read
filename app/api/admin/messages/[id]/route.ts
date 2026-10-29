import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

function toAdminMessage(m: {
  id: string
  name: string
  email: string
  message: string
  read: boolean
  createdAt: Date
}) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    message: m.message,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  }
}

/** تعليم رسالة كمقروءة/غير مقروءة */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.contactMessage.findUnique({ where: { id } })
    if (!existing) throw new ApiError(404, 'الرسالة غير موجودة')

    const body = await readJson<{ read?: unknown }>(req)
    if (typeof body.read !== 'boolean') throw new ApiError(400, 'قيمة read يجب أن تكون منطقية (true/false)')

    const message = await db.contactMessage.update({ where: { id }, data: { read: body.read } })

    if (body.read && !existing.read) {
      await logAudit({
        user: { id: admin.id, name: admin.name },
        action: 'MESSAGE_READ',
        entity: 'ContactMessage',
        entityId: id,
        details: `رسالة من ${existing.name}`,
      })
    }

    return ok({ message: toAdminMessage(message) })
  })
}

/** حذف رسالة */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.contactMessage.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!existing) throw new ApiError(404, 'الرسالة غير موجودة')

    await db.contactMessage.delete({ where: { id } })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'MESSAGE_DELETE',
      entity: 'ContactMessage',
      entityId: id,
      details: `رسالة من ${existing.name}`,
    })

    return ok({ ok: true })
  })
}
