import { handleRoute, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { publishDueBooks } from '@/lib/books'

/**
 * التصنيفات العامة: تُعرض فقط المرئية التي تضم كتبًا منشورة
 * (لا يُعرض للزائر أي تصنيف فارغ).
 */
export async function GET() {
  return handleRoute(async () => {
    await publishDueBooks()
    const categories = await db.category.findMany({
      where: { visible: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            books: { where: { status: 'PUBLISHED' } },
          },
        },
      },
    })
    return ok({
      categories: categories
        .filter((c) => c._count.books > 0)
        .map((c) => ({
          name: c.name,
          slug: c.slug,
          description: c.description ?? null,
          booksCount: c._count.books,
        })),
    })
  })
}
