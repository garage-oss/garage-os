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
  let connectorVersion: string | null = null
  let counts: { ca_clients: number; ca_cars: number; ca_cards: number } | null = null
  let lastSyncAt: Date | null = null

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
        connectorVersion = (connectorMeta as Record<string, string>)?.version ?? null
      }
    } catch { /* connector unreachable */ }

    if (connected) {
      // Try to get total counts: new connector (v2) has /api/status and /api/clients?limit=1
      try {
        const [statusRes, clientsRes] = await Promise.all([
          fetch(`${connectorUrl}/api/status`, {
            headers: { 'x-api-key': connectorKey },
            signal:  AbortSignal.timeout(10000),
            cache:   'no-store',
          }).catch(() => null),
          fetch(`${connectorUrl}/api/clients?limit=1`, {
            headers: { 'x-api-key': connectorKey },
            signal:  AbortSignal.timeout(10000),
            cache:   'no-store',
          }).catch(() => null),
        ])

        const caCards   = statusRes?.ok  ? (await statusRes.json()).total  as number ?? 0 : 0
        const caClients = clientsRes?.ok ? (await clientsRes.json()).total as number ?? 0 : 0

        if (caCards > 0 || caClients > 0) {
          counts = { ca_clients: caClients, ca_cars: 0, ca_cards: caCards }
        }
      } catch { /* counts unavailable */ }
    }
  }

  const [importedCustomers, importedVehicles, importedWorkOrders, integration] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
    prisma.vehicle.count({  where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
    prisma.workOrder.count({ where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
    prisma.sqlServerIntegration.findUnique({
      where:  { organizationId: orgId },
      select: { lastSyncAt: true },
    }),
  ])

  if (integration?.lastSyncAt) lastSyncAt = integration.lastSyncAt

  return NextResponse.json({
    configured,
    connected,
    connectorVersion,
    counts,
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    imported: {
      customers:  importedCustomers,
      vehicles:   importedVehicles,
      workOrders: importedWorkOrders,
    },
  })
}
