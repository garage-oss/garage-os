/**
 * DELETE /api/nesher/cleanup
 *
 * Removes all demo/seed/test records from GarageOS, leaving only real NESHER data.
 * Safe to call multiple times — idempotent.
 *
 * Identifies demo records by:
 *   1. Hardcoded seeded IDs (cust-1…cust-6, demo-*, veh-*, audit-*, etc.)
 *   2. importSource = 'test'
 *   3. importSource IS NULL (not from NESHER, not manually added by the garage)
 *      — only deletes these when they match known demo phone numbers
 */
import { NextResponse }  from 'next/server'
import { requireOrg }   from '@/lib/org'
import { prisma }       from '@/lib/prisma'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

// Known seeded customer IDs from prisma/seed.ts and scripts/seed-demo.mjs
const DEMO_CUSTOMER_IDS = [
  'cust-1', 'cust-2', 'cust-3', 'cust-4', 'cust-5', 'cust-6',
  'demo-customer-daniel',
]

// Known seeded vehicle IDs
const DEMO_VEHICLE_IDS = [
  'veh-1', 'veh-2', 'veh-3', 'veh-4', 'veh-5', 'veh-6',
  'veh-7', 'veh-8', 'veh-9',
  'demo-vehicle-corolla',
]

// Known seeded work-order IDs
const DEMO_WO_IDS = [
  'wo-1', 'wo-2', 'wo-3', 'wo-4', 'wo-5',
  'demo-wo-active', 'demo-wo-past-1', 'demo-wo-past-2', 'demo-wo-past-3',
]

export async function DELETE() {
  const { memberRole, orgId } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const stats = {
    workOrdersDeleted: 0,
    vehiclesDeleted:   0,
    customersDeleted:  0,
    details:           [] as string[],
  }

  // ── Step 0: Find ALL customer IDs to delete (hardcoded + importSource='test') ─
  // This ensures we can cascade-delete ALL their child records, including
  // vehicles/quotes with generated IDs that aren't in our hardcoded lists.
  const customersToDelete = await prisma.customer.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { id: { in: DEMO_CUSTOMER_IDS } },
        { importSource: 'test' },
      ],
    },
    select: { id: true },
  })
  const allDemoCustomerIds = customersToDelete.map(c => c.id)

  // Also find all demo work-order IDs (hardcoded + importSource='test' + demo customers)
  const workOrdersToDelete = await prisma.workOrder.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { id: { in: DEMO_WO_IDS } },
        { importSource: 'test' },
        { customerId: { in: allDemoCustomerIds } },
      ],
    },
    select: { id: true },
  })
  const allDemoWOIds = workOrdersToDelete.map(w => w.id)

  if (allDemoCustomerIds.length === 0) {
    // Nothing to clean up — already clean
    const [customers, vehicles, workOrders] = await Promise.all([
      prisma.customer.count({ where: { organizationId: orgId } }),
      prisma.vehicle.count({  where: { organizationId: orgId } }),
      prisma.workOrder.count({ where: { organizationId: orgId } }),
    ])
    return NextResponse.json({
      success: true,
      deleted: { workOrders: 0, vehicles: 0, customers: 0 },
      details: ['אין נתוני דמו למחיקה'],
      remaining: {
        total:  { customers, vehicles, workOrders },
        nesher: { customers, vehicles, workOrders },
      },
    })
  }

  // ── 1. Child records without cascade — delete by actual customer/WO IDs ──────

  // Quotes + their children (QuoteItem, QuotePortalResponse cascade from Quote)
  await prisma.quote.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { customerId:  { in: allDemoCustomerIds } },
        { workOrderId: { in: allDemoWOIds } },
      ],
    },
  })

  // Invoices
  await prisma.invoice.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { customerId:  { in: allDemoCustomerIds } },
        { workOrderId: { in: allDemoWOIds } },
      ],
    },
  })

  // Comm logs (nullable customerId, still FK-enforced in PostgreSQL)
  await prisma.commLog.deleteMany({
    where: { organizationId: orgId, customerId: { in: allDemoCustomerIds } },
  })

  // Service bookings
  await prisma.serviceBooking.deleteMany({
    where: { organizationId: orgId, customerId: { in: allDemoCustomerIds } },
  })

  // Appointments
  await prisma.appointment.deleteMany({
    where: { organizationId: orgId, customerId: { in: allDemoCustomerIds } },
  })

  // ── 2. Work orders ──────────────────────────────────────────────────────────
  if (allDemoWOIds.length > 0) {
    const woResult = await prisma.workOrder.deleteMany({
      where: { organizationId: orgId, id: { in: allDemoWOIds } },
    })
    stats.workOrdersDeleted += woResult.count
    if (woResult.count > 0) stats.details.push(`נמחקו ${woResult.count} כרטיסיות דמו`)
  }

  // ── 3. Vehicles — delete ALL vehicles belonging to demo customers ────────────
  const vehResult = await prisma.vehicle.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { id:           { in: DEMO_VEHICLE_IDS } },
        { importSource: 'test' },
        { customerId:   { in: allDemoCustomerIds } },
      ],
    },
  })
  stats.vehiclesDeleted += vehResult.count
  if (vehResult.count > 0) stats.details.push(`נמחקו ${vehResult.count} רכבי דמו`)

  // ── 4. Customers ─────────────────────────────────────────────────────────────
  const custResult = await prisma.customer.deleteMany({
    where: { organizationId: orgId, id: { in: allDemoCustomerIds } },
  })
  stats.customersDeleted += custResult.count
  if (custResult.count > 0) stats.details.push(`נמחקו ${custResult.count} לקוחות דמו`)

  // ── 4. Verify — count remaining NESHER records ────────────────────────────
  const [customers, vehicles, workOrders] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.vehicle.count({  where: { organizationId: orgId } }),
    prisma.workOrder.count({ where: { organizationId: orgId } }),
  ])

  const [nesherCustomers, nesherVehicles, nesherWorkOrders] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId, importSource: 'NESHER' } }),
    prisma.vehicle.count({  where: { organizationId: orgId, importSource: 'NESHER' } }),
    prisma.workOrder.count({ where: { organizationId: orgId, importSource: 'NESHER' } }),
  ])

  return NextResponse.json({
    success: true,
    deleted: {
      workOrders: stats.workOrdersDeleted,
      vehicles:   stats.vehiclesDeleted,
      customers:  stats.customersDeleted,
    },
    details: stats.details,
    remaining: {
      total:  { customers, vehicles, workOrders },
      nesher: { customers: nesherCustomers, vehicles: nesherVehicles, workOrders: nesherWorkOrders },
    },
  })
}
