import { NextRequest, NextResponse } from 'next/server'
import { getWorkOrderMedia } from '@/lib/media'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const files = await getWorkOrderMedia(params.id)
  return NextResponse.json(files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })))
}
