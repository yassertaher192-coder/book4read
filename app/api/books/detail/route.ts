import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, ok, str, ApiError } from '@/lib/api'
import { getSessionUser, isAdmin } from '@/lib/auth'
import { publishDueBooks, bookCardInclude, toBookCard } from '@/lib/books'
import { getPublicSettings } from '@/lib/settings'
import type { BookDetail } from '@/lib/types'

/**
 * تفاصيل كتاب عام عبر الرابط الودي (slug).
 * preview=1 يتيح للمشرف معاينة المسودات قبل نشرها دون إتاحتها للجمهور.
 */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    const sp = req.nextUrl.searchParams
    const slug = str(sp.get('slug'), 200)
    if (!slug) throw new ApiError(400, 'يجب تحديد الكتاب')
    const preview = sp.get('preview') === '1'

    const user = await getSessionUser()
    await publishDueBooks()

    const book = await db.book.findUnique({
      where: { slug },
      include: {
        category: true,
        coverImage: { select: { id: true } },
        fullCoverImage: { select: { id: true } },
        attachment: true,
        galleryImages: {
          orderBy: { sortOrder: 'asc' },
          include: { media: { select: { id: true } } },
        },
        tags: { include: { tag: true } },
      },
    })
    if (!book) throw new ApiError(404, 'الكتاب غير موجود')
    const isPublic = book.status === 'PUBLISHED'
    if (!isPublic && !(preview && isAdmin(user))) {
      throw new ApiError(404, 'الكتاب غير متاح')
    }

    // كتب ذات صلة: نفس التصنيف إن وُجد، وإلا وسوم مشتركة (المنشورة فقط)
    const relatedRaw = await db.book.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: book.id },
        ...(book.categoryId
          ? { categoryId: book.categoryId }
          : book.tags.length > 0
            ? { tags: { some: { tagId: { in: book.tags.map((t) => t.tagId) } } } }
            : {}),
      },
      include: bookCardInclude,
      orderBy: { createdAt: 'desc' },
      take: 6,
    })

    let isFavorite = false
    if (user) {
      const fav = await db.favorite.findUnique({
        where: { userId_bookId: { userId: user.id, bookId: book.id } },
      })
      isFavorite = !!fav
    }

    // عدّاد مشاهدات للعرض العام فقط (دون المعاينة الإدارية)
    if (isPublic && !preview) {
      await db.book
        .update({ where: { id: book.id }, data: { viewCount: { increment: 1 } } })
        .catch(() => undefined)
    }

    const attachmentVisible = !!(book.attachment && (book.readingEnabled || book.downloadEnabled))
    const detail: BookDetail = {
      ...toBookCard(book),
      status: book.status as BookDetail['status'],
      description: book.description ?? null,
      isbn: book.isbn ?? null,
      publisher: book.publisher ?? null,
      publishAt: book.publishAt ? book.publishAt.toISOString() : null,
      gallery: book.galleryImages.map((g) => ({
        url: `/api/media/${g.media.id}`,
        sortOrder: g.sortOrder,
      })),
      fullCoverUrl: book.fullCoverImage ? `/api/media/${book.fullCoverImage.id}` : null,
      attachmentOriginalName: attachmentVisible ? (book.attachment?.originalName ?? null) : null,
      attachmentUrl: book.attachment && book.readingEnabled ? `/api/media/${book.attachment.id}` : null,
      downloadUrl:
        book.attachment && book.readingEnabled && book.downloadEnabled
          ? `/api/media/${book.attachment.id}?download=1`
          : null,
      tags: book.tags.map((t) => t.tag.name),
      isFavorite,
      related: relatedRaw.map(toBookCard),
    }

    const settings = await getPublicSettings()
    return ok({
      book: detail,
      settings: {
        storeEnabled: settings.storeEnabled,
        currency: settings.currency,
        storeNotice: settings.storeNotice,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
      },
    })
  })
}
