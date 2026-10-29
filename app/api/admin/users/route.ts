import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, isEmail, assert, ApiError } from '@/lib/api'
import { requireOwner, hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

function toAdminUser(u: { id: string; name: string; email: string; role: string; active: boolean; createdAt: Date }) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
  }
}

/** قائمة المستخدمين — للمالك فقط (بدون كلمات المرور أبدًا) */
export async function GET() {
  return handleRoute(async () => {
    await requireOwner()

    const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } })
    return ok({ users: users.map(toAdminUser) })
  })
}

/** إنشاء مستخدم (محرر/قارئ) — للمالك فقط، ولا يُسمح بإنشاء OWNER من هنا */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const owner = await requireOwner()

    const body = await readJson<Record<string, unknown>>(req)
    const name = str(body.name, 80)
    const email = str(body.email, 200).toLowerCase()
    const password = str(body.password, 200)
    const role = str(body.role, 20)

    assert(name.length >= 2, 'يرجى إدخال الاسم (حرفان على الأقل)')
    assert(isEmail(email), 'البريد الإلكتروني غير صالح')
    assert(password.length >= 8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    assert(role === 'EDITOR' || role === 'READER', 'الدور يجب أن يكون EDITOR أو READER')

    const duplicate = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (duplicate) throw new ApiError(409, 'البريد الإلكتروني مستخدم مسبقًا')

    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password), role },
    })

    await logAudit({
      user: { id: owner.id, name: owner.name },
      action: 'USER_CREATE',
      entity: 'User',
      entityId: user.id,
      details: `${name} (${role})`,
    })

    return ok({ user: toAdminUser(user) }, 201)
  })
}
