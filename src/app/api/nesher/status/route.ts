import { NextResponse }              from 'next/server'
import { requireOrg }               from '@/lib/org'
import { testConnection, hanesherConfigured } from '@/lib/mssql'
import { countTable }                from '@/lib/nesher/queries'
import { prisma }                    from '@/lib/prisma'
import { IMPORT_SOURCE }             from '@/lib/nesher/mapper'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  if (!hanesherConfigured()) {
    return NextResponse.json({
      configured: false,
      connected:  false,
      error: 'פרטי חיבור לא הוגדרו. הגדר HANESHER_DB_* ב-.env',
    })
  }

  const conn = await testConnection()
  if (!conn.ok) {
    return NextResponse.json({ configured: true, connected: false, error: conn.error })
  }

  const [clientCount, carCount, cardCount] = await Promise.all([
    countTable('ca_clients').catch(() => -1),
    countTable('ca_cars').catch(() => -1),
    countTable('ca_cards').catch(() => -1),
  ])

  const [importedCustomers, importedVehicles, importedWorkOrders] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
    prisma.vehicle.count({ where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
    prisma.workOrder.count({ where: { organizationId: orgId, importSource: IMPORT_SOURCE } }),
  ])

  return NextResponse.json({
    configured: true,
    connected:  true,
    counts: {
      ca_clients: clientCount,
      ca_cars:    carCount,
      ca_cards:   cardCount,
    },
    imported: {
      customers:  importedCustomers,
      vehicles:   importedVehicles,
      workOrders: importedWorkOrders,
    },
  })
}
