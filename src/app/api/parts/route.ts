import { NextResponse } from 'next/server'
import { getParts } from '@/lib/parts'

export async function GET() {
  const parts = await getParts()
  return NextResponse.json(parts)
}
