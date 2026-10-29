import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, bool, assert, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/** بيانات صفحة واحدة للتحرير */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireAdmin()
    const { id } = await ctx.params

    const page = await db.page.findUnique({ where: { id } })
    if (!page) throw new ApiError(404, 'الصفحة غير موجودة')

    return ok({
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content,
        published: page.published,
      },
    })
  })
}

/** تحديث صفحة — العنوان مطلوب */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.page.findUnique({ where: { id }, select: { id: true, slug: true } })
    if (!existing) throw new ApiError(404, 'الصفحة غير موجودة')

    const body = await readJson<Record<string, unknown>>(req)
    const title = str(body.title, 200)
    assert(!!title, 'عنوان الصفحة مطلوب')
    const content = str(body.content, 100_000)

    const page = await db.page.update({
      where: { id },
      data: { title, content, published: bool(body.published) },
    })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'PAGE_UPDATE',
      entity: 'Page',
      entityId: id,
      details: page.slug,
    })

    return ok({
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content,
        published: page.published,
      },
    })
  })
}
