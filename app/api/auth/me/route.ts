import { handleRoute, ok } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  return handleRoute(async () => {
    const user = await getSessionUser()
    return ok({ user })
  })
}
