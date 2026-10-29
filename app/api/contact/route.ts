import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, isEmail, ApiError } from '@/lib/api'

/** نموذج التواصل: يُحفظ في قاعدة البيانات ويظهر ضمن رسائل لوحة الإدارة */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const body = await readJson<{ name?: string; email?: string; message?: string }>(req)
    const name = str(body.name, 100)
    const email = str(body.email, 200).toLowerCase()
    const message = str(body.message, 3000)

    if (name.length < 2) throw new ApiError(400, 'يرجى إدخال الاسم (حرفان على الأقل)')
    if (!isEmail(email)) throw new ApiError(400, 'البريد الإلكتروني غير صالح')
    if (message.length < 5) throw new ApiError(400, 'يرجى كتابة رسالتك (5 أحرف على الأقل)')

    await db.contactMessage.create({ data: { name, email, message } })
    return ok({ ok: true }, 201)
  })
}
