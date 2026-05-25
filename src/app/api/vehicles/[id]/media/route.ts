import { NextRequest, NextResponse } from 'next/server'
import { getVehicleMedia } from '@/lib/media'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const files = await getVehicleMedia(params.id)
  return NextResponse.json(files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })))
}
