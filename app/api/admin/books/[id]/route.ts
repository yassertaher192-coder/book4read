import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, ApiError } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { slugify } from '@/lib/slug'
import {
  parseBookInput,
  assertSlugAvailable,
  bookWriteData,
  syncBookTags,
  replaceGallery,
  adminBookFullInclude,
  toAdminBookFull,
} from '@/lib/admin-utils'

/** بيانات الكتاب الكاملة لمحرر لوحة الإدارة */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireAdmin()
    const { id } = await ctx.params

    const book = await db.book.findUnique({ where: { id }, include: adminBookFullInclude })
    if (!book) throw new ApiError(404, 'الكتاب غير موجود')

    return ok({ book: toAdminBookFull(book) })
  })
}

/**
 * تحديث كتاب وفق AdminBookInput — الحقول المفقودة تُصفَّر إلى الافتراضي،
 * عدا slug: غيابه أو إرساله فارغًا يبقي الرابط الحالي.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.book.findUnique({ where: { id }, select: { id: true, slug: true, status: true } })
    if (!existing) throw new ApiError(404, 'الكتاب غير موجود')

    const body = await readJson<Record<string, unknown>>(req)
    const { input, rawSlug } = await parseBookInput(body)

    // معالجة الرابط: غياب المفتاح أو قيمة فارغة ⇒ إبقاء الرابط الحالي
    let slug = existing.slug
    if ('slug' in body && rawSlug) {
      const candidate = slugify(rawSlug) || slugify(input.title)
      if (candidate) {
        await assertSlugAvailable(candidate, existing.id)
        slug = candidate
      }
    }

    const book = await db.book.update({ where: { id }, data: { ...bookWriteData(input), slug } })
    await syncBookTags(id, input.tags)
    await replaceGallery(id, input.gallery)

    // سجل التحوّلات في حالة النشر
    if (input.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      if (existing.status === 'DRAFT' || existing.status === 'SCHEDULED') {
        await logAudit({
          user: { id: admin.id, name: admin.name },
          action: 'BOOK_PUBLISH',
          entity: 'Book',
          entityId: id,
          details: input.title,
        })
      }
    } else if (input.status !== 'PUBLISHED' && existing.status === 'PUBLISHED') {
      await logAudit({
        user: { id: admin.id, name: admin.name },
        action: 'BOOK_UNPUBLISH',
        entity: 'Book',
        entityId: id,
        details: input.title,
      })
    }

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'BOOK_UPDATE',
      entity: 'Book',
      entityId: id,
      details: input.title,
    })

    return ok({ book: { id: book.id, slug: book.slug, status: book.status } })
  })
}

/** حذف كتاب (الوسوم/المعرض/المفضلة تُحذف تتابعيًا، وبنود الطلبات تفصل بلا قيمة) */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const admin = await requireAdmin()
    const { id } = await ctx.params

    const existing = await db.book.findUnique({ where: { id }, select: { id: true, title: true } })
    if (!existing) throw new ApiError(404, 'الكتاب غير موجود')

    await db.book.delete({ where: { id } })

    await logAudit({
      user: { id: admin.id, name: admin.name },
      action: 'BOOK_DELETE',
      entity: 'Book',
      entityId: id,
      details: existing.title,
    })

    return ok({ ok: true })
  })
}
