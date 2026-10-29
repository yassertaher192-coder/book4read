import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { handleRoute, readJson, ok, str, isEmail, ApiError } from '@/lib/api'
import { getPublicSettings } from '@/lib/settings'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const settings = await getPublicSettings()
    if (!settings.registrationEnabled) {
      throw new ApiError(403, 'تسجيل حسابات القراء غير مفعّل حاليًا في هذا الموقع')
    }

    const body = await readJson<{ name?: string; email?: string; password?: string }>(req)
    const name = str(body.name, 80)
    const email = str(body.email, 200).toLowerCase()
    const password = str(body.password, 200)

    if (name.length < 2) throw new ApiError(400, 'يرجى إدخال الاسم (حرفان على الأقل)')
    if (!isEmail(email)) throw new ApiError(400, 'البريد الإلكتروني غير صالح')
    if (password.length < 8) throw new ApiError(400, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) throw new ApiError(409, 'هذا البريد الإلكتروني مسجّل مسبقًا')

    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password), role: 'READER' },
    })
    await createSession(user.id)
    await logAudit({
      user: { id: user.id, name: user.name },
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
    })

    return ok(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active } },
      201,
    )
  })
}
