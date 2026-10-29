import { db } from '@/lib/db'
import { handleRoute, ok } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'
import { publishDueBooks } from '@/lib/books'
import { getAllSettings } from '@/lib/settings'

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** لوحة الإحصاءات: تعدادات شاملة + زيارات آخر 7 أيام + مبيعات + آخر العمليات */
export async function GET() {
  return handleRoute(async () => {
    await requireAdmin()
    await publishDueBooks()

    const [booksByStatus, totalCategories, totalTags, totalMedia, totalVisits, visitsRows, orders, newOrders, salesAgg, unreadMessages, totalUsers, recentAudit, settings] =
      await Promise.all([
        db.book.groupBy({ by: ['status'], _count: { _all: true } }),
        db.category.count(),
        db.tag.count(),
        db.mediaFile.count(),
        db.siteVisit.count(),
        db.siteVisit.findMany({
          where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          select: { createdAt: true },
        }),
        db.order.count(),
        db.order.count({ where: { status: 'NEW' } }),
        db.order.aggregate({ _sum: { total: true }, where: { status: 'COMPLETED' } }),
        db.contactMessage.count({ where: { read: false } }),
        db.user.count(),
        db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
        getAllSettings(),
      ])

    const statusCounts: Record<string, number> = {}
    for (const row of booksByStatus) statusCounts[row.status] = row._count._all

    // زيارات آخر 7 أيام (بما فيها الأيام بلا زيارات) بترتيب تصاعدي
    const byDay = new Map<string, number>()
    for (const v of visitsRows) {
      const key = dayKey(v.createdAt)
      byDay.set(key, (byDay.get(key) ?? 0) + 1)
    }
    const visitsLast7Days: { date: string; count: number }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = dayKey(d)
      visitsLast7Days.push({ date: key, count: byDay.get(key) ?? 0 })
    }

    return ok({
      stats: {
        totalBooks: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        published: statusCounts['PUBLISHED'] ?? 0,
        drafts: statusCounts['DRAFT'] ?? 0,
        scheduled: statusCounts['SCHEDULED'] ?? 0,
        archived: statusCounts['ARCHIVED'] ?? 0,
        totalCategories,
        totalTags,
        totalMedia,
        analyticsEnabled: settings.analyticsEnabled === 'true',
        totalVisits,
        visitsLast7Days,
        storeEnabled: settings.storeEnabled === 'true',
        totalOrders: orders,
        newOrders,
        completedSalesTotal: salesAgg._sum.total ?? 0,
        completedSalesCurrency: settings.currency || 'KWD',
        unreadMessages,
        totalUsers,
      },
      recentAudit: recentAudit.map((log) => ({
        id: log.id,
        userName: log.userName ?? '',
        action: log.action,
        entity: log.entity ?? '',
        entityId: log.entityId ?? '',
        details: log.details ?? '',
        createdAt: log.createdAt.toISOString(),
      })),
    })
  })
}
