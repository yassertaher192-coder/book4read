import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, ApiError } from '@/lib/api'
import { requireOwner } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/** تعديل دور مستخدم أو تفعيله/تعطيله — للمالك فقط، ولا يجوز تعديل النفس */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const owner = await requireOwner()
    const { id } = await ctx.params

    const existing = await db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, active: true } })
    if (!existing) throw new ApiError(404, 'المستخدم غير موجود')

    const body = await readJson<{ role?: unknown; active?: unknown }>(req)

    const data: { role?: string; active?: boolean } = {}
    if (body.role !== undefined) {
      if (typeof body.role !== 'string' || (body.role !== 'EDITOR' && body.role !== 'READER')) {
        throw new ApiError(400, 'الدور يجب أن يكون EDITOR أو READER')
      }
      if (id === owner.id && body.role !== existing.role) {
        throw new ApiError(400, 'لا يمكنك تعديل دور حسابك الخاص')
      }
      data.role = body.role
    }
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') throw new ApiError(400, 'قيمة التفعيل يجب أن تكون منطقية (true/false)')
      if (id === owner.id && body.active === false) {
        throw new ApiError(400, 'لا يمكنك تعطيل حسابك الخاص')
      }
      data.active = body.active
    }

    const user = await db.user.update({ where: { id }, data })

    await logAudit({
      user: { id: owner.id, name: owner.name },
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: id,
      details: `${existing.name}: ${
        data.role !== undefined && data.role !== existing.role ? `الدور ← ${data.role}` : ''
      }${data.role !== undefined && data.active !== undefined ? '، ' : ''}${
        data.active !== undefined && data.active !== existing.active ? (data.active ? 'مفعّل' : 'معطّل') : ''
      }`.trim() || existing.name,
    })

    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt.toISOString(),
      },
    })
  })
}
