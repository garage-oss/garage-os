/**
 * Debug endpoint — runs bare schema-discovery queries and returns raw results.
 * Powers the in-page debug panel on /dashboard/migration/mapping.
 * OWNER-only.
 */
import { NextResponse }       from 'next/server'
import { requireOrg }         from '@/lib/org'
import { query, hanesherConfigured } from '@/lib/mssql'

export async function GET() {
  const ctx = await requireOrg()
  if (ctx.memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'מנהל בלבד' }, { status: 403 })
  }
  if (!hanesherConfigured()) {
    return NextResponse.json({ error: 'לא מוגדר' }, { status: 400 })
  }

  const out: Record<string, unknown> = {}

  // ── 1. Connection context ─────────────────────────────────────────────────
  try {
    const [r] = await query<{
      current_db:     string
      system_user:    string
      user_name:      string
      default_schema: string
      server_name:    string
    }>(`SELECT
         DB_NAME()       AS current_db,
         SYSTEM_USER     AS system_user,
         USER_NAME()     AS user_name,
         SCHEMA_NAME()   AS default_schema,
         @@SERVERNAME    AS server_name`)
    out.context = r ?? null
  } catch (e) {
    out.context_error = e instanceof Error ? e.message : String(e)
  }

  // ── 2. INFORMATION_SCHEMA.TABLES ──────────────────────────────────────────
  try {
    const rows = await query<{ TABLE_SCHEMA: string; TABLE_NAME: string }>(
      `SELECT TABLE_SCHEMA, TABLE_NAME
       FROM   INFORMATION_SCHEMA.TABLES
       WHERE  TABLE_TYPE = 'BASE TABLE'
       ORDER  BY TABLE_SCHEMA, TABLE_NAME`,
    )
    out.info_schema_count  = rows.length
    out.info_schema_tables = rows.slice(0, 20)
  } catch (e) {
    out.info_schema_error = e instanceof Error ? e.message : String(e)
    out.info_schema_count = 0
  }

  // ── 3. sys.tables (always try, even when INFORMATION_SCHEMA succeeded) ────
  try {
    const rows = await query<{ schema_name: string; table_name: string }>(
      `SELECT SCHEMA_NAME(schema_id) AS schema_name,
              name                   AS table_name
       FROM   sys.tables
       ORDER  BY schema_name, table_name`,
    )
    out.sys_tables_count  = rows.length
    out.sys_tables        = rows.slice(0, 20)
  } catch (e) {
    out.sys_tables_error = e instanceof Error ? e.message : String(e)
    out.sys_tables_count = 0
  }

  // ── 4. Explicit DB prefix (catches "pool landed on master") ──────────────
  const dbName = (process.env.HANESHER_DB_NAME ?? 'HanesherDB').replace(/[^\w]/g, '')
  try {
    const rows = await query<{ TABLE_SCHEMA: string; TABLE_NAME: string }>(
      `SELECT TABLE_SCHEMA, TABLE_NAME
       FROM   [${dbName}].INFORMATION_SCHEMA.TABLES
       WHERE  TABLE_TYPE = 'BASE TABLE'
       ORDER  BY TABLE_SCHEMA, TABLE_NAME`,
    )
    out.explicit_db_count  = rows.length
    out.explicit_db_tables = rows.slice(0, 20)
  } catch (e) {
    out.explicit_db_error = e instanceof Error ? e.message : String(e)
    out.explicit_db_count = 0
  }

  // ── 5. User permissions ───────────────────────────────────────────────────
  try {
    const [perm] = await query<{ is_sysadmin: number; db_owner: number }>(
      `SELECT IS_SRVROLEMEMBER('sysadmin')     AS is_sysadmin,
              IS_MEMBER('db_owner')            AS db_owner`,
    )
    out.permissions = perm ?? null
  } catch (e) {
    out.permissions_error = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(out)
}
