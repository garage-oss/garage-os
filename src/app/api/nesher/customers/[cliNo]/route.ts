import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'
import { nesherCustomer }           from '@/lib/nesher-connector'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { cliNo: string } }) {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'MANAGER') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  try {
    const data = await nesherCustomer(params.cliNo)
    if (!data) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: `שגיאה בטעינת לקוח: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    )
  }
}
