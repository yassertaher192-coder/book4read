import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handleRoute, ok, intOrNull } from '@/lib/api'
import { requireAdmin } from '@/lib/auth'

/** سجل العمليات — الأحدث أولًا، حد أقصى 500 (الافتراضي 100) */
export async function GET(req: NextRequest) {
  return handleRoute(async () => {
    await requireAdmin()

    const requested = intOrNull(req.nextUrl.searchParams.get('limit'))
    const limit = requested && requested > 0 ? Math.min(requested, 500) : 100

    const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
    return ok({
      logs: logs.map((log) => ({
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
