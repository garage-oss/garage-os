/**
 * POST /api/integrations/sql-server/test
 *
 * Tests a SQL Server connection using credentials supplied in the request body.
 * Credentials are NOT saved — this is purely a live connectivity check for
 * the "Test Connection" button on the settings page.
 *
 * Body: { server, database, username, password, port?, encrypt?, trustCert? }
 *
 * OWNER role only.
 */

import { NextRequest, NextResponse }     from 'next/server'
import { getOrgContext }                 from '@/lib/org'
import { testConnectionWithConfig }      from '@/lib/sql-server-integration'

export async function POST(req: NextRequest) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (org.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'הרשאת בעלים נדרשת' }, { status: 403 })
  }

  const body = await req.json() as {
    server?:    string
    database?:  string
    username?:  string
    password?:  string
    port?:      number
    encrypt?:   boolean
    trustCert?: boolean
  }

  if (!body.server?.trim())   return NextResponse.json({ error: 'server נדרש'   }, { status: 400 })
  if (!body.database?.trim()) return NextResponse.json({ error: 'database נדרש' }, { status: 400 })
  if (!body.username?.trim()) return NextResponse.json({ error: 'username נדרש' }, { status: 400 })
  if (!body.password?.trim()) return NextResponse.json({ error: 'password נדרש' }, { status: 400 })

  const result = await testConnectionWithConfig({
    server:    body.server.trim(),
    database:  body.database.trim(),
    username:  body.username.trim(),
    password:  body.password,
    port:      body.port      ?? 1433,
    encrypt:   body.encrypt   ?? false,
    trustCert: body.trustCert ?? true,
  })

  return NextResponse.json(result)
}
