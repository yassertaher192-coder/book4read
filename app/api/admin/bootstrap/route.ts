import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { handleRoute, readJson, ok, str, isEmail, ApiError } from '@/lib/api'
import { logAudit } from '@/lib/audit'

/**
 * إنشاء أول حساب مالك (OWNER) — يعمل فقط عندما لا يوجد أي مستخدم في قاعدة البيانات.
 * هذه الطريقة تتيح تهيئة آمنة للموقع الجديد دون أي حسابات افتراضية في الكود.
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const userCount = await db.user.count()
    if (userCount > 0) {
      throw new ApiError(403, 'تم تهيئة حساب المالك مسبقًا. يرجى تسجيل الدخول')
    }

    const body = await readJson<{ name?: string; email?: string; password?: string }>(req)
    const name = str(body.name, 80)
    const email = str(body.email, 200).toLowerCase()
    const password = str(body.password, 200)

    if (name.length < 2) throw new ApiError(400, 'يرجى إدخال اسم المالك (حرفان على الأقل)')
    if (!isEmail(email)) throw new ApiError(400, 'البريد الإلكتروني غير صالح')
    if (password.length < 10) throw new ApiError(400, 'كلمة مرور المالك يجب أن تكون 10 أحرف على الأقل')

    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password), role: 'OWNER' },
    })
    await createSession(user.id)
    await logAudit({
      user: { id: user.id, name: user.name },
      action: 'BOOTSTRAP_OWNER',
      entity: 'User',
      entityId: user.id,
      details: 'تهيئة حساب المالك الأول',
    })

    return ok(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active } },
      201,
    )
  })
}
