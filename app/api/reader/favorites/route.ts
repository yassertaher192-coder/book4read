import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, ApiError } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { bookCardInclude, toBookCard } from '@/lib/books'

/** قائمة مفضلة القارئ المسجل */
export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser()
    const favorites = await db.favorite.findMany({
      where: { userId: user.id },
      include: { book: { include: bookCardInclude } },
      orderBy: { createdAt: 'desc' },
    })
    return ok({
      books: favorites
        .filter((f) => f.book.status === 'PUBLISHED')
        .map((f) => toBookCard(f.book)),
    })
  })
}

/** تبديل حالة الكتاب في المفضلة */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser()
    const body = await readJson<{ bookId?: string }>(req)
    const bookId = str(body.bookId, 40)
    if (!bookId) throw new ApiError(400, 'يجب تحديد الكتاب')

    const book = await db.book.findUnique({
      where: { id: bookId },
      select: { id: true, status: true },
    })
    if (!book || book.status !== 'PUBLISHED') throw new ApiError(404, 'الكتاب غير متاح')

    const existing = await db.favorite.findUnique({
      where: { userId_bookId: { userId: user.id, bookId } },
    })
    if (existing) {
      await db.favorite.delete({ where: { userId_bookId: { userId: user.id, bookId } } })
      return ok({ favorite: false })
    }
    await db.favorite.create({ data: { userId: user.id, bookId } })
    return ok({ favorite: true })
  })
}
