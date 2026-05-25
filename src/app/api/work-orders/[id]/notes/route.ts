import { NextRequest, NextResponse } from 'next/server'
import { getWorkOrderNotes } from '@/lib/notes'
import { getOrgContext } from '@/lib/org'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notes = await getWorkOrderNotes(org.orgId, params.id)
  return NextResponse.json(notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })))
}
