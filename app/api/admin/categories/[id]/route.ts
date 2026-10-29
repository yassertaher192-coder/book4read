import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, strOrNull, intOrNull, bool, assert, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { uniqueCategorySlug } from '@/lib/admin-utils'

/** تحديث تصنيف (نفس حقول الإنشاء — الحقول المفقودة تعود للافتراضي) */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) throw new ApiError(404, 'التصنيف غير موجود')

    const body = await readJson<Record<string, unknown>>(req)
    const name = str(body.name, 120)
    assert(!!name, 'اسم التصنيف مطلوب')

    const duplicate = await db.category.findFirst({ where: { name, id: { not: id } }, select: { id: true } })
    if (duplicate) throw new ApiError(409, 'اسم التصنيف مستخدم مسبقًا')

    const slug = await uniqueCategorySlug(name, id)
    const category = await db.category.update({
      where: { id },
      data: {
        name,
        slug,
        description: strOrNull(body.description, 600),
        visible: body.visible === undefined ? true : bool(body.visible),
        sortOrder: intOrNull(body.sortOrder) ?? 0,
      },
      include: { _count: { select: { books: true } } },
    })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'CATEGORY_UPDATE',
      entity: 'Category',
      entityId: id,
      details: name,
    })

    return ok({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? null,
        visible: category.visible,
        sortOrder: category.sortOrder,
        booksCount: category._count.books,
      },
    })
  })
}

/** حذف تصنيف — ممنوع (409) إن كان مرتبطًا بكتب */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { books: true } } },
    })
    if (!existing) throw new ApiError(404, 'التصنيف غير موجود')
    if (existing._count.books > 0) {
      throw new ApiError(409, 'لا يمكن حذف التصنيف لأنه مرتبط بكتب، انقل الكتب إلى تصنيف آخر أولًا')
    }

    await db.category.delete({ where: { id } })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'CATEGORY_DELETE',
      entity: 'Category',
      entityId: id,
      details: existing.name,
    })

    return ok({ ok: true })
  })
}
