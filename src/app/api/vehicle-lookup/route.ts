import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { lookupVehicle, normalizePlate } from '@/lib/vehicle-lookup'

export async function GET(req: NextRequest) {
  // Must be authenticated
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plate = req.nextUrl.searchParams.get('plate')?.trim() ?? ''
  if (!plate) {
    return NextResponse.json({ error: 'plate query param required' }, { status: 400 })
  }

  const normalized = normalizePlate(plate)
  if (!normalized) {
    return NextResponse.json(
      { error: 'Invalid plate format — expected 7 or 8 digit Israeli plate' },
      { status: 400 },
    )
  }

  const result = await lookupVehicle(plate)

  if (!result) {
    return NextResponse.json({ found: false }, { status: 200 })
  }

  return NextResponse.json({ found: true, vehicle: result }, { status: 200 })
}
