import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { publishDueBooks } from '@/lib/books'
import { BOOK_STATUSES } from '@/lib/constants'
import { parseBookInput, resolveBookSlugForCreate, bookWriteData, syncBookTags, replaceGallery, mediaUrl } from '@/lib/admin-utils'

/**
 * قائمة كتب الإدارة — كل الكتب بما فيها المسودات والمجدولة والمؤرفة.
 * البحث q يطابق العنوان أو اسم المؤلف أو ISBN، مع تصفية بالحالة/التصنيف.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin()
    await publishDueBooks()

    const sp = req.nextUrl.searchParams
    const q = str(sp.get('q'), 120)
    const status = str(sp.get('status'), 30)
    const categoryId = str(sp.get('categoryId'), 60)

    const where: Prisma.BookWhereInput = {}
    if (status && status in BOOK_STATUSES) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { authorName: { contains: q } },
        { isbn: { contains: q } },
      ]
    }

    const rows = await db.book.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { name: true } },
        coverImage: { select: { id: true } },
        _count: { select: { tags: true } },
      },
    })

    return ok({
      books: rows.map((b) => ({
        id: b.id,
        slug: b.slug,
        title: b.title,
        authorName: b.authorName ?? null,
        status: b.status,
        availability: b.availability,
        featured: b.featured,
        sortOrder: b.sortOrder,
        categoryName: b.category?.name ?? null,
        coverUrl: b.coverImage ? mediaUrl(b.coverImage.id) : null,
        publishAt: b.publishAt ? b.publishAt.toISOString() : null,
        forSale: b.forSale,
        price: b.price ?? null,
        currency: b.currency,
        viewCount: b.viewCount,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        tagsCount: b._count.tags,
      })),
    })
  })
}

/** إنشاء كتاب جديد من AdminBookInput */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin()

    const body = await readJson<Record<string, unknown>>(req)
    const { input, rawSlug } = await parseBookInput(body)
    const slug = await resolveBookSlugForCreate(rawSlug, input.title)

    const book = await db.book.create({ data: { ...bookWriteData(input), slug } })
    await syncBookTags(book.id, input.tags)
    await replaceGallery(book.id, input.gallery)

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'BOOK_CREATE',
      entity: 'Book',
      entityId: book.id,
      details: input.title,
    })

    return ok({ book: { id: book.id, slug: book.slug, status: book.status } }, 201)
  })
}
