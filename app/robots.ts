import type { MetadataRoute } from 'next'

/** robots.txt: يسمح بفهرسة الصفحات العامة ويمنع زحف مسارات API والملات الخاصة */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
