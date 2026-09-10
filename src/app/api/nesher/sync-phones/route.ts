import { NextResponse }    from 'next/server'
import { requireOrg }      from '@/lib/org'
import { runPhoneSync }    from '@/lib/nesher/phone-sync'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const { orgId, memberRole } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  const result = await runPhoneSync(orgId)
  return NextResponse.json(result)
}
