import { NextResponse } from 'next/server'
import { requireOrg } from '@/lib/org'
import { testConnection, hanesherConfigured } from '@/lib/mssql'

export async function GET() {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }

  if (!hanesherConfigured()) {
    return NextResponse.json({
      ok: false,
      error: 'פרטי ההתחברות לא הוגדרו. הוסף HANESHER_DB_HOST, HANESHER_DB_NAME, HANESHER_DB_USER, HANESHER_DB_PASSWORD ל-.env',
    })
  }

  const result = await testConnection()
  return NextResponse.json(result)
}
