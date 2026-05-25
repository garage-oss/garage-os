import { NextResponse } from 'next/server'
import { getPart } from '@/lib/parts'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const part = await getPart(params.id)
  if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(part)
}
