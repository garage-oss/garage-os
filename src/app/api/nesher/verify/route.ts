/**
 * GET /api/nesher/verify?ids=3162,21397,4214,...
 *
 * Temporary data integrity verification endpoint.
 * Returns GarageOS records for given NESHER external customer numbers.
 * DELETE this file after verification is complete.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'
import { prisma }                   from '@/lib/prisma'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { orgId } = await requireOrg()

  const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
  const externalNos = idsParam.split(',').map(s => s.trim()).filter(Boolean)

  if (externalNos.length === 0) {
    return NextResponse.json({ error: 'ids param required' }, { status: 400 })
  }

  const customers = await prisma.customer.findMany({
    where: { organizationId: orgId, importSource: 'NESHER', importId: { in: externalNos } },
    select: {
      id:         true,
      name:       true,
      phone:      true,
      email:      true,
      importId:   true,
      externalNo: true,
      vehicles: {
        select: {
          plate:  true,
          make:   true,
          model:  true,
          year:   true,
          workOrders: {
            orderBy: { receivedAt: 'desc' },
            take: 1,
            select: {
              workOrderNumber: true,
              status:          true,
              receivedAt:      true,
              completedAt:     true,
              totalPrice:      true,
              importId:        true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ customers, count: customers.length })
}
