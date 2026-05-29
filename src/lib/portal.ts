/**
 * Customer portal data layer.
 * All queries are scoped to a single WorkOrder accessed by its public ID.
 * No authentication required — the CUID is opaque and unguessable.
 */

import { notFound } from 'next/navigation'
import { prisma }   from '@/lib/prisma'

// ─── Main portal payload ──────────────────────────────────────────────────────

export async function getPortalData(workOrderId: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle:  {
        select: {
          id: true, plate: true, make: true, model: true,
          year: true, color: true, fuelType: true, mileage: true,
        },
      },
      organization: {
        select: { id: true, name: true, phone: true, logoUrl: true, address: true, city: true },
      },
      items:     { orderBy: { id: 'asc' } },
      media:     { orderBy: { createdAt: 'desc' } },
      techNotes: {
        where:   { visibility: 'CUSTOMER' },
        orderBy: { createdAt: 'asc' },
      },
      quote: {
        include: {
          items: { orderBy: { id: 'asc' } },
        },
      },
      paymentLinks: {
        orderBy: { createdAt: 'desc' },
        take:    1,
      },
    },
  })

  if (!wo) notFound()
  return wo
}

export type PortalData = Awaited<ReturnType<typeof getPortalData>>

// ─── Vehicle service history ──────────────────────────────────────────────────

export async function getVehicleHistory(vehicleId: string, excludeWoId: string) {
  return prisma.workOrder.findMany({
    where: {
      vehicleId,
      id:     { not: excludeWoId },
      status: { in: ['COMPLETED', 'CANCELLED'] },
    },
    orderBy: { createdAt: 'desc' },
    take:    20,
    select: {
      id:              true,
      workOrderNumber: true,
      complaint:       true,
      diagnosis:       true,
      totalPrice:      true,
      completedAt:     true,
      createdAt:       true,
      status:          true,
    },
  })
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export type WOStatus = 'PENDING' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'CANCELLED'

export const STATUS_CONFIG: Record<WOStatus, {
  label:       string
  description: string
  color:       string       // Tailwind colour token (without bg-/text-)
  step:        number       // 1-4 (which stepper step is active)
}> = {
  PENDING: {
    label:       'ממתין לטיפול',
    description: 'הרכב שלך התקבל במוסך ומחכה לטיפול',
    color:       'amber',
    step:        1,
  },
  IN_PROGRESS: {
    label:       'בטיפול פעיל',
    description: 'הטכנאי עובד כרגע על הרכב שלך',
    color:       'indigo',
    step:        2,
  },
  WAITING_PARTS: {
    label:       'ממתין לחלקים',
    description: 'הוזמנו חלקים — נחדש את העבודה ברגע שיגיעו',
    color:       'orange',
    step:        3,
  },
  COMPLETED: {
    label:       'מוכן לאיסוף! 🎉',
    description: 'הרכב שלך מוכן ומחכה לך במוסך',
    color:       'emerald',
    step:        4,
  },
  CANCELLED: {
    label:       'בוטל',
    description: 'פקודת עבודה זו בוטלה',
    color:       'red',
    step:        0,
  },
}

export const STEPPER_STEPS = [
  { id: 1, icon: '🚗', label: 'התקבל'    },
  { id: 2, icon: '🔍', label: 'בבדיקה'   },
  { id: 3, icon: '🔧', label: 'בטיפול'   },
  { id: 4, icon: '✅', label: 'מוכן!'    },
]
