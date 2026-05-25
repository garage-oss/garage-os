import { NextRequest, NextResponse } from 'next/server'
import { getDiagnosticSession } from '@/lib/diagnostics'
import { getOrgContext } from '@/lib/org'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getDiagnosticSession(org.orgId, params.id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...session, createdAt: session.createdAt.toISOString() })
}
