import { NextRequest, NextResponse } from 'next/server'
import { getVehicleMedia } from '@/lib/media'
import { getOrgContext } from '@/lib/org'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const files = await getVehicleMedia(org.orgId, params.id)
  return NextResponse.json(files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })))
}
