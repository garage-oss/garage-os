import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { getCommLogs } from '@/lib/comm-log'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await getCommLogs(org.orgId, params.id)
  return NextResponse.json(
    logs.map((l) => ({
      id:           l.id,
      message:      l.message,
      templateType: l.templateType,
      channel:      l.channel,
      sentAt:       l.sentAt.toISOString(),
    }))
  )
}
