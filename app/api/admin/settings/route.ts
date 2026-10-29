import type { NextRequest } from 'next/server'
import { handleRoute, readJson, ok, assert, ApiError } from '@/lib/api'
import { requireAdmin, requireOwner } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getAllSettings, updateSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS, CURRENCIES } from '@/lib/constants'

type SocialLinks = {
  x: string
  instagram: string
  facebook: string
  telegram: string
  whatsapp: string
  youtube: string
}

function parseSocialLinks(raw: string | undefined): SocialLinks {
  const fallback: SocialLinks = { x: '', instagram: '', facebook: '', telegram: '', whatsapp: '', youtube: '' }
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      x: typeof parsed.x === 'string' ? parsed.x : '',
      instagram: typeof parsed.instagram === 'string' ? parsed.instagram : '',
      facebook: typeof parsed.facebook === 'string' ? parsed.facebook : '',
      telegram: typeof parsed.telegram === 'string' ? parsed.telegram : '',
      whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : '',
      youtube: typeof parsed.youtube === 'string' ? parsed.youtube : '',
    }
  } catch {
    return fallback
  }
}

/** الإعدادات كاملة محلَّلة: المنطقية إلى boolean و socialLinks إلى كائن */
function toParsedSettings(s: Record<string, string>) {
  return {
    siteName: s.siteName ?? '',
    authorName: s.authorName ?? '',
    tagline: s.tagline ?? '',
    welcomeText: s.welcomeText ?? '',
    emptyStateText: s.emptyStateText ?? '',
    storeNotice: s.storeNotice ?? '',
    authorBio: s.authorBio ?? '',
    contactEmail: s.contactEmail ?? '',
    contactPhone: s.contactPhone ?? '',
    logoImageId: s.logoImageId ?? '',
    authorPortraitId: s.authorPortraitId ?? '',
    socialLinks: parseSocialLinks(s.socialLinks),
    storeEnabled: s.storeEnabled === 'true',
    currency: s.currency || 'KWD',
    registrationEnabled: s.registrationEnabled === 'true',
    analyticsEnabled: s.analyticsEnabled === 'true',
    primaryColor: s.primaryColor ?? '',
    backgroundColor: s.backgroundColor ?? '',
    ivoryColor: s.ivoryColor ?? '',
    seoTitle: s.seoTitle ?? '',
    seoDescription: s.seoDescription ?? '',
    paymentProvider: s.paymentProvider ?? '',
    paymentEnabled: s.paymentEnabled === 'true',
  }
}

/** عرض الإعدادات — متاح للمشرفين (المحرر يرى دون تعديل) */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin()
    const s = await getAllSettings()
    return ok({ settings: toParsedSettings(s) })
  })
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const COLOR_KEYS = ['primaryColor', 'backgroundColor', 'ivoryColor'] as const

/** تحديث الإعدادات — للمالك فقط، ويقبل المفاتيح المعروفة حصرًا */
export async function PUT(req: NextRequest) {
  return handleRoute(async () => {
    const owner = await requireOwner()

    const body = await readJson<{ settings?: unknown }>(req)
    assert(
      body.settings !== null && typeof body.settings === 'object' && !Array.isArray(body.settings),
      'صيغة الإعدادات غير صالحة',
    )
    const patchRaw = body.settings as Record<string, unknown>

    // قبول المفاتيح المعروفة فقط وتجاهل غير المعروفة
    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patchRaw)) {
      if (key in DEFAULT_SETTINGS) patch[key] = value
    }

    for (const colorKey of COLOR_KEYS) {
      if (colorKey in patch && patch[colorKey] !== undefined) {
        const value = patch[colorKey]
        if (value === null || value === '') continue
        if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
          throw new ApiError(400, 'قيمة اللون غير صالحة، استخدم صيغة #RRGGBB مثل #C6A15B')
        }
      }
    }
    if ('currency' in patch) {
      const currency = patch.currency
      assert(typeof currency === 'string' && (CURRENCIES as readonly string[]).includes(currency), 'العملة غير مدعومة')
    }
    if ('socialLinks' in patch && patch.socialLinks !== undefined) {
      assert(
        typeof patch.socialLinks === 'object' && patch.socialLinks !== null && !Array.isArray(patch.socialLinks),
        'روابط التواصل الاجتماعي غير صالحة',
      )
    }

    // عدّ المفاتيح المتغيّرة فعليًا (للسجل فقط، دون قيم)
    const current = await getAllSettings()
    let changed = 0
    for (const [key, value] of Object.entries(patch)) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      if (current[key] !== serialized) changed++
    }

    await updateSettings(patch)
    await logAudit({
      user: { id: owner.id, name: owner.name },
      action: 'SETTINGS_UPDATE',
      entity: 'SiteSetting',
      details: `تم تحديث ${changed} من الإعدادات`,
    })

    const s = await getAllSettings()
    return ok({ settings: toParsedSettings(s) })
  })
}
