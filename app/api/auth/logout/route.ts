import { handleRoute, ok } from '@/lib/api'
import { destroySession, getSessionUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST() {
  return handleRoute(async () => {
    const user = await getSessionUser()
    await destroySession()
    if (user) {
      await logAudit({ user: { id: user.id, name: user.name }, action: 'LOGOUT', entity: 'User', entityId: user.id })
    }
    return ok({ ok: true })
  })
}
