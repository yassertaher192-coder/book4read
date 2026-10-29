import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, ApiError } from '@/lib/api'
import { requireUser, verifyPassword, hashPassword, destroySession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/** تعديل بيانات حساب القارئ (الاسم و/أو كلمة المرور) */
export async function PUT(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser()
    const body = await readJson<{ name?: string; currentPassword?: string; newPassword?: string }>(req)
    const name = str(body.name, 80)
    const currentPassword = str(body.currentPassword, 200)
    const newPassword = str(body.newPassword, 200)

    const data: { name?: string; passwordHash?: string } = {}
    if (name) {
      if (name.length < 2) throw new ApiError(400, 'الاسم قصير جدًا')
      data.name = name
    }
    if (newPassword) {
      if (newPassword.length < 8) throw new ApiError(400, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
      const record = await db.user.findUnique({ where: { id: user.id } })
      if (!record || !verifyPassword(currentPassword, record.passwordHash)) {
        throw new ApiError(400, 'كلمة المرور الحالية غير صحيحة')
      }
      data.passwordHash = hashPassword(newPassword)
    }
    if (Object.keys(data).length === 0) throw new ApiError(400, 'لا توجد تغييرات')

    const updated = await db.user.update({ where: { id: user.id }, data })
    await logAudit({
      user: { id: user.id, name: user.name },
      action: 'ACCOUNT_UPDATE',
      entity: 'User',
      entityId: user.id,
    })
    return ok({
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active },
    })
  })
}

/** حذف الحساب نهائيًا (يتطلب تأكيد كلمة المرور) */
export async function DELETE(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser()
    const body = await readJson<{ password?: string }>(req)
    const password = str(body.password, 200)
    const record = await db.user.findUnique({ where: { id: user.id } })
    if (!record || !verifyPassword(password, record.passwordHash)) {
      throw new ApiError(400, 'كلمة المرور غير صحيحة')
    }
    await logAudit({
      user: { id: user.id, name: user.name },
      action: 'ACCOUNT_DELETE',
      entity: 'User',
      entityId: user.id,
      details: 'حذف الحساب بطلب من صاحبه',
    })
    await db.user.delete({ where: { id: user.id } })
    await destroySession()
    return ok({ ok: true })
  })
}
