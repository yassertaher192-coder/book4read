import { db } from '@/lib/db'
import { handleRoute, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'

/** رسائل التواصل الواردة (الأحدث أولًا) */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin()

    const messages = await db.contactMessage.findMany({ orderBy: { createdAt: 'desc' } })
    return ok({
      messages: messages.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        message: m.message,
        read: m.read,
        createdAt: m.createdAt.toISOString(),
      })),
    })
  })
}
