import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, assert, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { ensureTag } from '@/lib/admin-utils'

/** قائمة الوسوم مع عدد الكتب المرتبطة */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin()

    const rows = await db.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { books: true } } },
    })

    return ok({
      tags: rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        booksCount: t._count.books,
      })),
    })
  })
}

/** إنشاء وسم — الاسم مطلوب وفريد (409 عند التكرار) */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const admin = await requireAdmin()

    const body = await readJson<Record<string, unknown>>(req)
    const name = str(body.name, 60)
    assert(!!name, 'اسم الوسم مطلوب')

    const duplicate = await db.tag.findUnique({ where: { name }, select: { id: true } })
    if (duplicate) throw new ApiError(409, 'اسم الوسم مستخدم مسبقًا')

    const tag = await ensureTag(name)

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'TAG_CREATE',
      entity: 'Tag',
      entityId: tag.id,
      details: name,
    })

    return ok({ tag: { id: tag.id, name: tag.name, slug: tag.slug, booksCount: 0 } }, 201)
  })
}
