import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, strOrNull, intOrNull, bool, assert, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { uniqueCategorySlug } from '@/lib/admin-utils'

/** قائمة تصنيفات الإدارة مع عدد كل الكتب (بما فيها غير المنشورة) */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin()

    const rows = await db.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { books: true } } },
    })

    return ok({
      categories: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        visible: c.visible,
        sortOrder: c.sortOrder,
        booksCount: c._count.books,
      })),
    })
  })
}

/** إنشاء تصنيف — الاسم مطلوب وفريد (409 عند التكرار)، والرابط يولد منه */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin()

    const body = await readJson<Record<string, unknown>>(req)
    const name = str(body.name, 120)
    assert(!!name, 'اسم التصنيف مطلوب')

    const duplicate = await db.category.findUnique({ where: { name }, select: { id: true } })
    if (duplicate) throw new ApiError(409, 'اسم التصنيف مستخدم مسبقًا')

    const slug = await uniqueCategorySlug(name)
    const category = await db.category.create({
      data: {
        name,
        slug,
        description: strOrNull(body.description, 600),
        visible: body.visible === undefined ? true : bool(body.visible),
        sortOrder: intOrNull(body.sortOrder) ?? 0,
      },
    })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'CATEGORY_CREATE',
      entity: 'Category',
      entityId: category.id,
      details: name,
    })

    return ok(
      {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? null,
          visible: category.visible,
          sortOrder: category.sortOrder,
          booksCount: 0,
        },
      },
      201,
    )
  })
}
