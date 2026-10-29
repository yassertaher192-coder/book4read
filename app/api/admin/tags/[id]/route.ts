import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, ok, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/** حذف وسم — تفصل ارتباط الكتب تلقائيًا عبر Cascade */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.tag.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!existing) throw new ApiError(404, 'الوسم غير موجود')

    await db.tag.delete({ where: { id } })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'TAG_DELETE',
      entity: 'Tag',
      entityId: id,
      details: existing.name,
    })

    return ok({ ok: true })
  })
}
