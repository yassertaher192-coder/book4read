import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, ok, str, ApiError } from '@/lib/api'

/** صفحات الموقع الثابتة القابلة للتحرير (privacy/terms/faq/store-policy) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const slug = str(req.nextUrl.searchParams.get('slug'), 60)
    if (!slug) throw new ApiError(400, 'يجب تحديد الصفحة')
    const page = await db.page.findUnique({ where: { slug } })
    if (!page || !page.published) throw new ApiError(404, 'الصفحة غير متاحة حاليًا')
    return ok({
      page: {
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
      },
    })
  })
}
