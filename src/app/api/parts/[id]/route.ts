import { NextResponse } from 'next/server'
import { getPart } from '@/lib/parts'
import { getOrgContext } from '@/lib/org'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const part = await getPart(org.orgId, params.id)
  if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(part)
}
