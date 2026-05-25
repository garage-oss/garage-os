import { NextRequest, NextResponse } from 'next/server'
import { getWorkOrderMedia } from '@/lib/media'
import { getOrgContext } from '@/lib/org'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const files = await getWorkOrderMedia(org.orgId, params.id)
  return NextResponse.json(files.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })))
}
