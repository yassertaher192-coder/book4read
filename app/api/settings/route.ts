import { handleRoute, ok } from '@/lib/api'
import { getPublicSettings } from '@/lib/settings'

export async function GET() {
  return handleRoute(async () => {
    const settings = await getPublicSettings()
    return ok({ settings })
  })
}
