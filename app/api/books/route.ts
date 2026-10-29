import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { handleRoute, ok, str } from '@/lib/api'
import { publishDueBooks, bookCardInclude, toBookCard } from '@/lib/books'
import { AVAILABILITIES } from '@/lib/constants'

/**
 * قائمة الكتب العامة (المنشورة فقط) مع البحث والتصفية والترتيب والصفننة.
 * البحث يشمل: العنوان، العنوان الفرعي، اسم المؤلف، الوصف، التصنيف، والوسوم.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await publishDueBooks()

    const sp = req.nextUrl.searchParams
    const q = str(sp.get('q'), 120)
    const category = str(sp.get('category'), 160)
    const tag = str(sp.get('tag'), 160)
    const availability = str(sp.get('availability'), 30)
    const sortParam = sp.get('sort')
    const sort = sortParam === 'newest' || sortParam === 'year' ? sortParam : 'manual'
    const page = Math.max(1, Number.parseInt(sp.get('page') || '1', 10) || 1)
    const perPage = Math.min(48, Math.max(6, Number.parseInt(sp.get('perPage') || '24', 10) || 24))

    const where: Prisma.BookWhereInput = { status: 'PUBLISHED' }
    if (availability && availability in AVAILABILITIES) where.availability = availability
    if (category) where.category = { slug: category }
    if (tag) where.tags = { some: { tag: { slug: tag } } }
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { subtitle: { contains: q } },
        { authorName: { contains: q } },
        { shortDescription: { contains: q } },
        { description: { contains: q } },
        { category: { name: { contains: q } } },
        { tags: { some: { tag: { name: { contains: q } } } } },
      ]
    }

    const orderBy: Prisma.BookOrderByWithRelationInput[] =
      sort === 'newest'
        ? [{ featured: 'desc' }, { createdAt: 'desc' }]
        : sort === 'year'
          ? [{ publishYear: 'desc' as Prisma.SortOrder }, { createdAt: 'desc' as Prisma.SortOrder }]
          : [{ sortOrder: 'asc' as Prisma.SortOrder }, { createdAt: 'desc' as Prisma.SortOrder }]

    const [rows, total] = await Promise.all([
      db.book.findMany({
        where,
        include: bookCardInclude,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.book.count({ where }),
    ])

    return ok({ books: rows.map(toBookCard), total, page, perPage })
  })
}
