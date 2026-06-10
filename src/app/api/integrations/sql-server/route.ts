/**
 * GET  /api/integrations/sql-server  — return public config (no password)
 * POST /api/integrations/sql-server  — save config (encrypt password)
 * DELETE /api/integrations/sql-server — remove config
 *
 * OWNER role only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext }             from '@/lib/org'
import {
  getConfig,
  saveConfig,
  deleteConfig,
}                                    from '@/lib/sql-server-integration'

function ownerOnly(role: string) {
  if (role !== 'OWNER') {
    return NextResponse.json({ error: 'הרשאת בעלים נדרשת' }, { status: 403 })
  }
  return null
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guard = ownerOnly(org.memberRole)
  if (guard) return guard

  const config = await getConfig(org.orgId)
  return NextResponse.json({ config })
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guard = ownerOnly(org.memberRole)
  if (guard) return guard

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

  // Password may be omitted on update (keep existing) — handle in saveConfig
  if (!body.password?.trim()) {
    return NextResponse.json({ error: 'password נדרש' }, { status: 400 })
  }

  const config = await saveConfig(org.orgId, {
    server:    body.server.trim(),
    database:  body.database.trim(),
    username:  body.username.trim(),
    password:  body.password,
    port:      body.port      ?? 1433,
    encrypt:   body.encrypt   ?? false,
    trustCert: body.trustCert ?? true,
  })

  return NextResponse.json({ config })
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE() {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guard = ownerOnly(org.memberRole)
  if (guard) return guard

  await deleteConfig(org.orgId)
  return NextResponse.json({ ok: true })
}
