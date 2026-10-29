import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

/** خريطة الموقع: الصفحات العامة + كل كتاب منشور عبر رابطه القابل للفهرسة /?book=slug */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/?view=books`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/?view=author`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/?view=contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/?view=faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/?view=privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/?view=terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/?view=store-policy`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const books = await db.book.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    for (const book of books) {
      entries.push({
        url: `${base}/?book=${encodeURIComponent(book.slug)}`,
        lastModified: book.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.8,
      })
    }
  } catch {
    // قاعدة البيانات غير مهيأة بعد — نعيد الصفحات الثابتة فقط
  }

  return entries
}
