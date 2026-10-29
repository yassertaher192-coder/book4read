import type { Metadata } from 'next'
import { db } from '@/lib/db'
import AppShell from '@/components/library/app-shell'
import { getPublicSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS } from '@/lib/constants'
import type { PublicSettings } from '@/lib/types'
import type { Route } from '@/components/library/contexts'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

const VIEW_SLUGS = new Set(['books', 'author', 'contact', 'faq', 'login', 'account', 'privacy', 'terms', 'store-policy'])

function routeFromParams(sp: Record<string, string | string[] | undefined>): Route {
  const bookSlug = typeof sp.book === 'string' ? sp.book : undefined
  const view = typeof sp.view === 'string' ? sp.view : undefined
  if (bookSlug) return { view: 'book', slug: bookSlug }
  if (view && VIEW_SLUGS.has(view)) {
    if (view === 'privacy' || view === 'terms' || view === 'store-policy') return { view: 'page', slug: view }
    if (view === 'faq') return { view: 'faq' }
    return { view: view as 'books' | 'author' | 'contact' | 'login' | 'account' }
  }
  return { view: 'home' }
}

async function loadSettings(): Promise<PublicSettings> {
  try {
    return await getPublicSettings()
  } catch {
    // احتياط: قيم افتراضية كاملة إذا لم تكن قاعدة البيانات مهيأة بعد
    return {
      siteName: DEFAULT_SETTINGS.siteName,
      authorName: '',
      tagline: DEFAULT_SETTINGS.tagline,
      welcomeText: DEFAULT_SETTINGS.welcomeText,
      emptyStateText: DEFAULT_SETTINGS.emptyStateText,
      storeNotice: DEFAULT_SETTINGS.storeNotice,
      authorBio: '',
      contactEmail: '',
      contactPhone: '',
      logoImageId: null,
      authorPortraitId: null,
      socialLinks: { x: '', instagram: '', facebook: '', telegram: '', whatsapp: '', youtube: '' },
      storeEnabled: false,
      currency: 'KWD',
      registrationEnabled: false,
      analyticsEnabled: false,
      primaryColor: DEFAULT_SETTINGS.primaryColor,
      backgroundColor: DEFAULT_SETTINGS.backgroundColor,
      ivoryColor: DEFAULT_SETTINGS.ivoryColor,
      seoTitle: DEFAULT_SETTINGS.siteName,
      seoDescription: DEFAULT_SETTINGS.tagline,
    }
  }
}

/** بيانات وصفية ديناميكية لكل كتاب عبر روابط /?book=slug القابلة للفهرسة والمشاركة */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams
  const bookSlug = typeof sp.book === 'string' ? sp.book : undefined
  if (bookSlug) {
    try {
      const book = await db.book.findUnique({
        where: { slug: bookSlug },
        select: {
          title: true,
          seoTitle: true,
          seoDescription: true,
          shortDescription: true,
          description: true,
          status: true,
          coverImage: { select: { id: true } },
        },
      })
      if (book && book.status === 'PUBLISHED') {
        const description =
          book.seoDescription || book.shortDescription || (book.description || '').slice(0, 160) || undefined
        const image = book.coverImage ? `${baseUrl()}/api/media/${book.coverImage.id}` : undefined
        const title = book.seoTitle || book.title
        return {
          title,
          description,
          alternates: { canonical: `${baseUrl()}/?book=${encodeURIComponent(bookSlug)}` },
          openGraph: {
            title,
            description,
            images: image ? [{ url: image, alt: `غلاف كتاب: ${book.title}` }] : undefined,
            type: 'article',
          },
          twitter: {
            card: image ? 'summary_large_image' : 'summary',
            title,
            description,
          },
        }
      }
    } catch {
      // نتائج بلا بيانات وصفية للكتاب عند تعذر الوصول لقاعدة البيانات
    }
  }
  return {}
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  // بالتوازي: لا حاجة لانتظار المعاملات قبل جلب الإعدادات
  const [sp, settings] = await Promise.all([searchParams, loadSettings()])
  const initialRoute = routeFromParams(sp)
  return <AppShell initialSettings={settings} initialRoute={initialRoute} />
}
