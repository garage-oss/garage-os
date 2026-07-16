import { NextRequest, NextResponse } from 'next/server'
import { requireOrg }               from '@/lib/org'
import { nesherVehicleHistory }     from '@/lib/nesher-connector'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { carNo: string } }) {
  const { memberRole } = await requireOrg()
  if (memberRole !== 'OWNER' && memberRole !== 'MANAGER') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
  }

  try {
    const rows = await nesherVehicleHistory(params.carNo)
    if (!rows) return NextResponse.json({ error: 'רכב לא נמצא' }, { status: 404 })
    return NextResponse.json({ rows, total: rows.length })
  } catch (e) {
    return NextResponse.json(
      { error: `שגיאה בטעינת היסטוריה: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    )
  }
}
