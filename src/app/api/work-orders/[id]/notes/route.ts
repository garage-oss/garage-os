import { NextRequest, NextResponse } from 'next/server'
import { getWorkOrderNotes } from '@/lib/notes'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const notes = await getWorkOrderNotes(params.id)
  return NextResponse.json(notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })))
}
