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

  // ── 1. Child records without cascade (must go before WorkOrder/Customer) ─────

  // Quotes + their children (QuoteItem, QuotePortalResponse cascade from Quote)
  await prisma.quote.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { customerId: { in: DEMO_CUSTOMER_IDS } },
        { workOrderId: { in: DEMO_WO_IDS } },
      ],
    },
  })

  // Invoices belonging to demo customers or demo work orders
  await prisma.invoice.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { customerId: { in: DEMO_CUSTOMER_IDS } },
        { workOrderId: { in: DEMO_WO_IDS } },
      ],
    },
  })

  // Comm logs for demo customers (customerId nullable, no cascade)
  await prisma.commLog.deleteMany({
    where: {
      organizationId: orgId,
      customerId: { in: DEMO_CUSTOMER_IDS },
    },
  })

  // Service bookings for demo customers
  await prisma.serviceBooking.deleteMany({
    where: {
      organizationId: orgId,
      customerId: { in: DEMO_CUSTOMER_IDS },
    },
  })

  // Appointments for demo customers
  await prisma.appointment.deleteMany({
    where: {
      organizationId: orgId,
      customerId: { in: DEMO_CUSTOMER_IDS },
    },
  })

  // ── 3. Work orders: seeded IDs + test importSource ─────────────────────────
  const woResult = await prisma.workOrder.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { id:           { in: DEMO_WO_IDS } },
        { importSource: 'test' },
        // Cascade: work orders belonging to demo customers
        { customerId:   { in: DEMO_CUSTOMER_IDS } },
      ],
    },
  })
  stats.workOrdersDeleted += woResult.count
  if (woResult.count > 0) stats.details.push(`נמחקו ${woResult.count} כרטיסיות דמו`)

  // ── 3. Vehicles: seeded IDs + test importSource + owned by demo customers ──
  const vehResult = await prisma.vehicle.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { id:           { in: DEMO_VEHICLE_IDS } },
        { importSource: 'test' },
        { customerId:   { in: DEMO_CUSTOMER_IDS } },
      ],
    },
  })
  stats.vehiclesDeleted += vehResult.count
  if (vehResult.count > 0) stats.details.push(`נמחקו ${vehResult.count} רכבי דמו`)

  // ── 4. Customers: seeded IDs + test importSource ───────────────────────────
  const custResult = await prisma.customer.deleteMany({
    where: {
      organizationId: orgId,
      OR: [
        { id:           { in: DEMO_CUSTOMER_IDS } },
        { importSource: 'test' },
      ],
    },
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
