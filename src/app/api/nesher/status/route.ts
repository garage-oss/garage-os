import { NextResponse }  from 'next/server'
import { requireOrg }   from '@/lib/org'
import { prisma }       from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const IMPORT_SOURCE = 'NESHER'

export async function GET() {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const connectorUrl = process.env.NESHER_CONNECTOR_URL  ?? ''
  const connectorKey = process.env.NESHER_CONNECTOR_API_KEY ?? ''
  const configured   = !!(connectorUrl && connectorKey)

  let connected    = false
  let connectorMeta: Record<string, unknown> | null = null
  let sourceCount: number | null = null

  if (configured) {
    try {
      const healthRes = await fetch(`${connectorUrl}/health`, {
        headers: { 'x-api-key': connectorKey },
        signal:  AbortSignal.timeout(5000),
        cache:   'no-store',
      })
      if (healthRes.ok) {
        connected     = true
        connectorMeta = await healthRes.json()
      }
    } catch { /* connector unreachable */ }

    if (connected) {
      try {
        const woRes = await fetch(`${connectorUrl}/api/workorders?limit=100`, {
          headers: { 'x-api-key': connectorKey },
          signal:  AbortSignal.timeout(15000),
          cache:   'no-store',
        })
        if (woRes.ok) {
          const body   = await woRes.json()
          const rows   = body.rows ?? body.data ?? []
          sourceCount  = rows.length
        }
      } catch { /* count unavailable */ }
    }
  }

  const [importedCustomers, importedVehicles, importedWorkOrders] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
    prisma.vehicle.count({  where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
    prisma.workOrder.count({ where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
  ])

  return NextResponse.json({
    configured,
    connected,
    connectorMeta,
    sourceCount,
    imported: {
      customers:  importedCustomers,
      vehicles:   importedVehicles,
      workOrders: importedWorkOrders,
    },
  })
}
