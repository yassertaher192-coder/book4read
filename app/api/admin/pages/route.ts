import { db } from '@/lib/db'
import { handleRoute, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'

/** قائمة الصفحات القابلة للتحرير */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin()

    const pages = await db.page.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
    return ok({
      pages: pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        published: p.published,
        updatedAt: p.updatedAt.toISOString(),
      })),
    })
  })
}
