import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str } from '@/lib/api'
import { getPublicSettings } from '@/lib/settings'

/** تسجيل زيارة مجهولة الهوية (مسار فقط) عند تفعيل التحليلات من لوحة الإدارة */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const settings = await getPublicSettings()
    if (!settings.analyticsEnabled) return ok({ ok: true })
    const body = await readJson<{ path?: string }>(req)
    const path = str(body.path, 100) || '/'
    await db.siteVisit.create({ data: { path } }).catch(() => undefined)
    return ok({ ok: true })
  })
}
