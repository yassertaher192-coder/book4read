import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'
import { handleRoute, readJson, ok, str, isEmail, ApiError } from '@/lib/api'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await readJson<{ email?: string; password?: string }>(req)
    const email = str(body.email, 200).toLowerCase()
    const password = str(body.password, 200)
    if (!isEmail(email) || !password) {
      throw new ApiError(400, 'يرجى إدخال بريد إلكتروني وكلمة مرور صحيحين')
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      await logAudit({ action: 'LOGIN_FAILED', entity: 'User', details: email })
      throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
    }
    if (!user.active) {
      throw new ApiError(403, 'هذا الحساب معطّل، يرجى التواصل مع إدارة الموقع')
    }

    await createSession(user.id)
    await logAudit({
      user: { id: user.id, name: user.name },
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
    })

    return ok({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active },
    })
  })
}
