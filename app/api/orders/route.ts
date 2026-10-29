import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, readJson, ok, str, isEmail, num, ApiError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'
import { getPublicSettings } from '@/lib/settings'
import { logAudit } from '@/lib/audit'
import type { OrderSummary } from '@/lib/types'

/**
 * إنشاء طلب جديد — يعمل فقط عند تفعيل المتجر من لوحة الإدارة.
 * تُحسب الأسعار من قاعدة البيانات وليس من مدخلات العميل،
 * ويبدأ الطلب بوضع «جديد» غير مدفوع (لا يوجد دفع وهمي).
 */
export async function POST(req: NextRequest) {
  return handleRoute(async () => {
    const settings = await getPublicSettings()
    if (!settings.storeEnabled) {
      throw new ApiError(403, 'المتجر غير مفعّل حاليًا')
    }

    const body = await readJson<{
      items?: { bookId?: string; quantity?: number; type?: string }[]
      customerName?: string
      customerEmail?: string
      customerPhone?: string
      address?: string
      notes?: string
    }>(req)

    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : []
    if (items.length === 0) throw new ApiError(400, 'السلة فارغة')

    const customerName = str(body.customerName, 100)
    const customerEmail = str(body.customerEmail, 200).toLowerCase()
    const customerPhone = str(body.customerPhone, 40)
    const address = str(body.address, 400)
    const notes = str(body.notes, 1000)

    if (customerName.length < 2) throw new ApiError(400, 'يرجى إدخال الاسم')
    if (!isEmail(customerEmail)) throw new ApiError(400, 'البريد الإلكتروني غير صالح')

    type ValidItem = { bookId: string; quantity: number; type: 'PAPER' | 'DIGITAL' }
    const valid: ValidItem[] = []
    for (const raw of items) {
      const bookId = str(raw?.bookId, 40)
      const quantity = Math.min(10, Math.max(1, Math.trunc(num(raw?.quantity) ?? 1)))
      const type = raw?.type === 'DIGITAL' ? 'DIGITAL' : 'PAPER'
      if (!bookId) continue
      valid.push({ bookId, quantity, type })
    }
    if (valid.length === 0) throw new ApiError(400, 'لم يتم تحديد أي كتاب صالح')

    const books = await db.book.findMany({
      where: { id: { in: valid.map((v) => v.bookId) }, status: 'PUBLISHED', forSale: true },
      select: { id: true, title: true, price: true, currency: true, attachmentId: true, downloadEnabled: true },
    })
    const bookMap = new Map(books.map((b) => [b.id, b]))

    let total = 0
    const orderItems: { bookId: string; titleSnapshot: string; quantity: number; unitPrice: number; type: string }[] = []
    for (const item of valid) {
      const book = bookMap.get(item.bookId)
      if (!book) throw new ApiError(400, 'أحد الكتب المطلوبة غير متاح للبيع')
      if (item.type === 'DIGITAL' && (!book.attachmentId || !book.downloadEnabled)) {
        throw new ApiError(400, 'النسخة الرقمية غير متاحة لأحد الكتب المطلوبة')
      }
      const unitPrice = book.price ?? 0
      total += unitPrice * item.quantity
      orderItems.push({
        bookId: book.id,
        titleSnapshot: book.title,
        quantity: item.quantity,
        unitPrice,
        type: item.type,
      })
    }

    const currency = settings.currency || 'KWD'
    const now = new Date()
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()
    const orderNumber = `ORD-${datePart}-${randomPart}`

    const user = await getSessionUser()
    const order = await db.order.create({
      data: {
        orderNumber,
        userId: user?.id ?? null,
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        address: address || null,
        notes: notes || null,
        status: 'NEW',
        paid: false,
        total,
        currency,
        items: { create: orderItems },
      },
    })

    await logAudit({
      user: user ? { id: user.id, name: user.name } : null,
      action: 'ORDER_CREATE',
      entity: 'Order',
      entityId: order.id,
      details: `طلب جديد ${orderNumber} بقيمة ${total} ${currency}`,
    })

    return ok({ orderNumber: order.orderNumber }, 201)
  })
}

/** طلبات القارئ المسجل (سجلّه الخاص فقط) */
export async function GET() {
  return handleRoute(async () => {
    const user = await getSessionUser()
    if (!user) throw new ApiError(401, 'يجب تسجيل الدخول لعرض طلباتك')
    const orders = await db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      take: 50,
    })
    const summaries: OrderSummary[] = orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status as OrderSummary['status'],
      total: o.total,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        titleSnapshot: i.titleSnapshot,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        type: i.type as 'PAPER' | 'DIGITAL',
      })),
    }))
    return ok({ orders: summaries })
  })
}
