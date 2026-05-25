import { NextResponse } from 'next/server'
import { getParts } from '@/lib/parts'
import { getOrgContext } from '@/lib/org'

export async function GET() {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parts = await getParts(org.orgId)
  return NextResponse.json(parts)
}
