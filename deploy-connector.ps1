# ============================================================================
# GarageOS Connector Deployment Script
# Run this ON WIN-P8FLBRLS3T0 at C:\GarageOS-Connector (as Administrator)
# ============================================================================
# What this script does:
#   1. Backs up existing server.js
#   2. Writes the updated server.js (adds /api/clients, /api/status endpoints)
#   3. Auto-detects how the connector is running (PM2 / NSSM / Service / node.exe)
#   4. Restarts the connector
#   5. Verifies /health and /api/clients respond correctly
# ============================================================================

param(
    [switch]$DryRun,           # Show what would happen without doing it
    [string]$ConnectorDir = "C:\GarageOS-Connector"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "`n=== GarageOS Connector Deployment ===" -ForegroundColor Cyan
Write-Host "Directory: $ConnectorDir"
Write-Host "DryRun:    $DryRun"

# ── Verify working directory ─────────────────────────────────────────────────
if (-not (Test-Path $ConnectorDir)) {
    Write-Error "Connector directory not found: $ConnectorDir"
    exit 1
}
if (-not (Test-Path "$ConnectorDir\server.js")) {
    Write-Error "server.js not found in $ConnectorDir"
    exit 1
}
if (-not (Test-Path "$ConnectorDir\.env")) {
    Write-Error ".env not found in $ConnectorDir — cannot proceed"
    exit 1
}

# ── Step 1: Backup ───────────────────────────────────────────────────────────
$stamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$ConnectorDir\server.js.bak_$stamp"
Write-Host "`n[1/5] Backing up server.js → server.js.bak_$stamp" -ForegroundColor Yellow
if (-not $DryRun) {
    Copy-Item "$ConnectorDir\server.js" $backup
    Write-Host "      Backup created: $backup" -ForegroundColor Green
}

# ── Step 2: Write updated server.js ─────────────────────────────────────────
Write-Host "`n[2/5] Writing updated server.js (v2.0.0 with /api/clients)" -ForegroundColor Yellow

$newServerJs = @'
require('dotenv').config()
const express = require('express')
// msnodesqlv8 driver required for Windows Integrated Authentication
const sql     = require('mssql/msnodesqlv8')

const PORT    = parseInt(process.env.PORT ?? '4000', 10)
const API_KEY = process.env.NESHER_CONNECTOR_API_KEY ?? ''

// ─── Config ──────────────────────────────────────────────────────────────────

function parseServer () {
  const raw = (process.env.HANESHER_DB_SERVER || '').trim()
  if (raw.includes('\\')) {
    const [host, instance] = raw.split('\\', 2)
    return { server: host, instanceName: instance }
  }
  return { server: raw, instanceName: null }
}

function buildConfig () {
  const { server, instanceName } = parseServer()
  const sqlServer = instanceName ? `${server}\\${instanceName}` : server
  const database  = process.env.HANESHER_DB_NAME ?? ''

  const connectionString =
    `Driver={SQL Server};Server=${sqlServer};Database=${database};Trusted_Connection=yes;`

  return {
    connectionString,
    connectionTimeout: 20000,
    requestTimeout:    30000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  }
}

// ─── SQL pool ─────────────────────────────────────────────────────────────────

let pool = null
async function getPool () {
  if (pool && pool.connected) return pool
  pool = await new sql.ConnectionPool(buildConfig()).connect()
  return pool
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireKey (req, res, next) {
  const key = req.headers['x-api-key'] ?? ''
  if (!API_KEY) { next(); return }
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate (v) { return v ? v.toISOString() : null }

function errJson (err) {
  return {
    message:    err?.message ?? String(err),
    code:       err?.code,
    number:     err?.number,
    serverName: err?.serverName,
    stack:      err?.stack,
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

// ── GET /health ───────────────────────────────────────────────────────────────

app.get('/health', requireKey, async (_req, res) => {
  try {
    const p   = await getPool()
    const r   = await p.request().query(
      `SELECT @@SERVERNAME AS serverName, DB_NAME() AS database, @@VERSION AS version, GETDATE() AS serverTime, SYSTEM_USER AS loginUser`
    )
    const row = r.recordset[0]
    res.json({
      success:  true,
      service:  'GarageOS Connector',
      version:  '2.0.0',
      database: {
        serverName:   row.serverName,
        databaseName: row.database,
        loginUser:    row.loginUser,
        serverTime:   isoDate(row.serverTime),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: errJson(err) })
  }
})

// ── GET /api/status ───────────────────────────────────────────────────────────
// Returns total work-order count so callers can estimate pagination depth.

app.get('/api/status', requireKey, async (_req, res) => {
  try {
    const p = await getPool()
    const r = await p.request().query(
      `SELECT COUNT(*) AS total, MIN(card_id) AS min_id, MAX(card_id) AS max_id FROM dbo.ca_cards`
    )
    const row = r.recordset[0]
    res.json({ success: true, total: row.total, minCardId: row.min_id, maxCardId: row.max_id })
  } catch (err) {
    res.status(500).json({ success: false, error: errJson(err) })
  }
})

// ── GET /api/workorders ───────────────────────────────────────────────────────
// Supports cursor-based pagination via ?before={card_id}.
// Returns up to `limit` (max 2000) records ordered by card_id DESC.
// When ?before=N is given, returns only records where card_id < N.

app.get('/api/workorders', requireKey, async (req, res) => {
  const limit    = Math.min(parseInt(req.query.limit ?? '100', 10), 2000)
  const before   = req.query.before ? parseInt(req.query.before, 10) : null

  try {
    const p = await getPool()

    const whereClause = before && !isNaN(before) ? `WHERE card_id < ${before}` : ''

    // Count remaining records for progress reporting
    const countR = await p.request().query(
      `SELECT COUNT(*) AS total FROM dbo.ca_cards ${whereClause}`
    )
    const remaining = countR.recordset[0].total

    const result = await p.request().query(`
      SELECT TOP (${limit})
        card_id, card_no, open_dt, close_dt, car_no, cli_no, cli_name,
        car_code, car_model, car_desc, part_tot, work_tot, tarif,
        card_st, card_km, cli_email, prod_dt, adviser, drv_name, drv_phone,
        ISNULL(cli_comp1, '') AS cli_comp1, cli_type
      FROM dbo.ca_cards
      ${whereClause}
      ORDER BY card_id DESC
    `)

    const rows = result.recordset.map(r => ({
      ...r,
      open_dt:  isoDate(r.open_dt),
      close_dt: isoDate(r.close_dt),
      prod_dt:  isoDate(r.prod_dt),
      total:    (r.part_tot ?? 0) + (r.work_tot ?? 0),
    }))

    const minId = rows.length > 0 ? rows[rows.length - 1].card_id : null

    res.json({
      success:   true,
      count:     rows.length,
      remaining: Math.max(0, remaining - rows.length),
      minCardId: minId,
      data:      rows,
    })
  } catch (err) {
    console.error('[workorders] SQL ERROR:', err?.message, err?.stack)
    res.status(500).json({ success: false, error: errJson(err) })
  }
})

// ── GET /api/customers ────────────────────────────────────────────────────────
// Search customers aggregated from ca_cards work-order history.

app.get('/api/customers', requireKey, async (req, res) => {
  const search = (req.query.search ?? '').toString().trim()
  const limit  = Math.min(parseInt(req.query.limit ?? '50', 10), 2000)

  try {
    const p = await getPool()

    const searchClause = search
      ? `AND (cli_name LIKE @s OR CAST(cli_no AS NVARCHAR) LIKE @s OR car_no LIKE @s OR drv_phone LIKE @s)`
      : ''

    const req_ = p.request().input('limit', sql.Int, limit)
    if (search) req_.input('s', sql.NVarChar(200), `%${search}%`)

    const result = await req_.query(`
      SELECT TOP (@limit)
        cli_no,
        MAX(cli_name)   AS cli_name,
        MAX(cli_type)   AS cli_type,
        MAX(cli_email)  AS cli_email,
        MAX(drv_phone)  AS phone,
        MAX(open_dt)    AS last_visit_dt,
        COUNT(DISTINCT card_id) AS order_count,
        COUNT(DISTINCT car_no)  AS vehicle_count
      FROM dbo.ca_cards
      WHERE cli_no IS NOT NULL ${searchClause}
      GROUP BY cli_no
      ORDER BY MAX(open_dt) DESC
    `)

    const rows = result.recordset.map(r => ({
      ...r,
      last_visit_dt: isoDate(r.last_visit_dt),
    }))
    res.json({ success: true, count: rows.length, data: rows })
  } catch (err) {
    console.error('[customers] error:', err?.message)
    res.status(500).json({ success: false, error: errJson(err) })
  }
})

// ── GET /api/customers/:cliNo ─────────────────────────────────────────────────

app.get('/api/customers/:cliNo', requireKey, async (req, res) => {
  const cliNo = parseInt(req.params.cliNo, 10)
  if (isNaN(cliNo)) return res.status(400).json({ error: 'Invalid customer number' })

  try {
    const p = await getPool()

    const [infoRes, vehiclesRes, historyRes] = await Promise.all([
      p.request().query(`
        SELECT
          cli_no,
          MAX(cli_name)  AS cli_name,
          MAX(cli_type)  AS cli_type,
          MAX(cli_email) AS cli_email,
          MAX(drv_phone) AS phone,
          MAX(open_dt)   AS last_visit_dt,
          COUNT(DISTINCT card_id) AS order_count,
          COUNT(DISTINCT car_no)  AS vehicle_count,
          SUM(ISNULL(part_tot,0) + ISNULL(work_tot,0)) AS total_spent
        FROM dbo.ca_cards
        WHERE cli_no = ${cliNo}
        GROUP BY cli_no
      `),
      p.request().query(`
        SELECT
          car_no,
          MAX(car_desc)  AS car_desc,
          MAX(car_code)  AS car_code,
          MAX(prod_dt)   AS prod_dt,
          MAX(card_km)   AS last_km,
          MAX(open_dt)   AS last_visit_dt,
          COUNT(DISTINCT card_id) AS order_count
        FROM dbo.ca_cards
        WHERE cli_no = ${cliNo}
          AND car_no IS NOT NULL AND LEN(LTRIM(RTRIM(car_no))) > 0
        GROUP BY car_no
        ORDER BY MAX(open_dt) DESC
      `),
      p.request().query(`
        SELECT TOP (50)
          card_id, card_no, open_dt, close_dt, car_no, car_desc,
          cli_comp1, tarif, part_tot, work_tot, card_st, card_km
        FROM dbo.ca_cards
        WHERE cli_no = ${cliNo}
        ORDER BY card_id DESC
      `),
    ])

    const info = infoRes.recordset[0]
    if (!info) return res.status(404).json({ error: 'Customer not found' })

    res.json({
      customer: { ...info, last_visit_dt: isoDate(info.last_visit_dt) },
      vehicles:  vehiclesRes.recordset.map(v => ({
        ...v,
        prod_dt:       isoDate(v.prod_dt),
        last_visit_dt: isoDate(v.last_visit_dt),
      })),
      history: historyRes.recordset.map(r => ({
        ...r,
        open_dt:  isoDate(r.open_dt),
        close_dt: isoDate(r.close_dt),
        total:    (r.part_tot ?? 0) + (r.work_tot ?? 0),
      })),
    })
  } catch (err) {
    console.error('[customer/:cliNo] error:', err?.message)
    res.status(500).json({ success: false, error: errJson(err) })
  }
})

// ── GET /api/clients ──────────────────────────────────────────────────────────
// Paginated customer list from dbo.ca_clients with phone numbers.
// SELECT ONLY — no write operations against NESHER.

app.get('/api/clients', requireKey, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  ?? '500', 10), 2000)
  const offset = Math.max(parseInt(req.query.offset ?? '0',   10), 0)

  try {
    const p = await getPool()

    const countResult = await p.request().query(
      `SELECT COUNT(*) AS total FROM dbo.ca_clients WHERE cli_no IS NOT NULL`
    )
    const total = countResult.recordset[0].total

    const result = await p.request()
      .input('lim', sql.Int, limit)
      .input('off', sql.Int, offset)
      .query(`
        SELECT cli_no, cli_name, cli_phone, cli_pele, cli_email
        FROM dbo.ca_clients
        WHERE cli_no IS NOT NULL
        ORDER BY cli_no
        OFFSET @off ROWS
        FETCH NEXT @lim ROWS ONLY
      `)

    res.json({
      success: true,
      total,
      count:  result.recordset.length,
      data:   result.recordset,
    })
  } catch (err) {
    console.error('[clients] error:', err?.message)
    res.status(500).json({ success: false, error: errJson(err) })
  }
})

// ── GET /api/vehicles/:carNo/history ──────────────────────────────────────────

app.get('/api/vehicles/:carNo/history', requireKey, async (req, res) => {
  const carNo = req.params.carNo.trim()
  const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100)
  if (!carNo) return res.status(400).json({ error: 'Missing car number' })

  try {
    const p = await getPool()
    const result = await p.request()
      .input('carNo', sql.NVarChar(30), carNo)
      .query(`
        SELECT TOP (${limit})
          card_id, card_no, open_dt, close_dt, car_no, car_desc,
          cli_no, cli_name, cli_comp1, tarif, part_tot, work_tot,
          card_st, card_km
        FROM dbo.ca_cards
        WHERE car_no = @carNo
        ORDER BY card_id DESC
      `)

    const rows = result.recordset.map(r => ({
      ...r,
      open_dt:  isoDate(r.open_dt),
      close_dt: isoDate(r.close_dt),
      total:    (r.part_tot ?? 0) + (r.work_tot ?? 0),
    }))
    res.json({ success: true, count: rows.length, data: rows })
  } catch (err) {
    console.error('[vehicles/history] error:', err?.message)
    res.status(500).json({ success: false, error: errJson(err) })
  }
})

// ─── Catch-all ───────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.listen(PORT, () => {
  const { server, instanceName } = parseServer()
  const target = instanceName ? `${server}\\${instanceName}` : server
  console.log(`GarageOS-Connector v2 listening on http://localhost:${PORT}`)
  console.log(`SQL target: ${target} / db: ${process.env.HANESHER_DB_NAME}`)
  console.log(`Auth: Windows Integrated (Trusted Connection)`)
  console.log(`API key: ${API_KEY ? 'set (length ' + API_KEY.length + ')' : 'NOT SET — open mode'}`)
})
'@

if (-not $DryRun) {
    Set-Content -Path "$ConnectorDir\server.js" -Value $newServerJs -Encoding UTF8
    Write-Host "      server.js written ($(($newServerJs | Measure-Object -Line).Lines) lines)" -ForegroundColor Green
}

# ── Step 3: Detect process manager ───────────────────────────────────────────
Write-Host "`n[3/5] Detecting connector process manager..." -ForegroundColor Yellow

$pm2Found      = $false
$nssmService   = $null
$schedTask     = $null
$nodeProcesses = @()

# Check PM2
try {
    $pm2List = & pm2 list 2>&1
    if ($LASTEXITCODE -eq 0 -and ($pm2List | Select-String -Pattern "GarageOS|connector|server")) {
        $pm2Found = $true
        Write-Host "      PM2 detected" -ForegroundColor Cyan
    }
} catch {}

# Check Windows Services (NSSM)
$services = Get-Service | Where-Object { $_.Name -match "GarageOS|Connector|nesher" -or $_.DisplayName -match "GarageOS|Connector" }
if ($services) {
    $nssmService = $services[0].Name
    Write-Host "      Windows Service detected: $nssmService" -ForegroundColor Cyan
}

# Check Task Scheduler
try {
    $tasks = Get-ScheduledTask 2>$null | Where-Object { $_.TaskName -match "GarageOS|Connector" }
    if ($tasks) {
        $schedTask = $tasks[0].TaskName
        Write-Host "      Scheduled Task detected: $schedTask" -ForegroundColor Cyan
    }
} catch {}

# Check running node.exe processes
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcesses = $nodeProcs
    Write-Host "      Running node.exe processes: $($nodeProcs.Count)" -ForegroundColor Cyan
    $nodeProcs | ForEach-Object { Write-Host "        PID $($_.Id): $($_.MainWindowTitle)" }
}

# ── Step 4: Restart ───────────────────────────────────────────────────────────
Write-Host "`n[4/5] Restarting connector..." -ForegroundColor Yellow

if (-not $DryRun) {
    if ($pm2Found) {
        Write-Host "      Using PM2..." -ForegroundColor Cyan
        & pm2 restart GarageOS-Connector 2>&1
        if ($LASTEXITCODE -ne 0) { & pm2 restart all }
    } elseif ($nssmService) {
        Write-Host "      Restarting Windows Service '$nssmService'..." -ForegroundColor Cyan
        Restart-Service -Name $nssmService -Force
    } elseif ($schedTask) {
        Write-Host "      Stopping/starting Scheduled Task '$schedTask'..." -ForegroundColor Cyan
        Stop-ScheduledTask -TaskName $schedTask -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Start-ScheduledTask -TaskName $schedTask
    } elseif ($nodeProcesses.Count -gt 0) {
        Write-Host "      Stopping $($nodeProcesses.Count) node.exe process(es)..." -ForegroundColor Cyan
        $nodeProcesses | Stop-Process -Force
        Start-Sleep -Seconds 2
        Write-Host "      Starting connector manually..." -ForegroundColor Cyan
        Set-Location $ConnectorDir
        Start-Process node -ArgumentList "server.js" -WorkingDirectory $ConnectorDir -WindowStyle Hidden
    } else {
        Write-Host "      No process manager found. Starting connector manually..." -ForegroundColor Yellow
        Set-Location $ConnectorDir
        Start-Process node -ArgumentList "server.js" -WorkingDirectory $ConnectorDir -WindowStyle Hidden
    }

    Write-Host "      Waiting 3 seconds for startup..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
}

# ── Step 5: Verify ───────────────────────────────────────────────────────────
Write-Host "`n[5/5] Verifying deployment..." -ForegroundColor Yellow

$API_KEY_ENV = (Get-Content "$ConnectorDir\.env" | Where-Object { $_ -match "^NESHER_CONNECTOR_API_KEY=" } | ForEach-Object { ($_ -split '=', 2)[1] }).Trim()
$headers = @{ "x-api-key" = $API_KEY_ENV }
$base    = "http://localhost:4000"

# Health check
try {
    $health = Invoke-RestMethod -Uri "$base/health" -Headers $headers -TimeoutSec 10
    $ver    = $health.version
    if ($ver -eq '2.0.0') {
        Write-Host "      /health: OK  version=$ver  db=$($health.database.databaseName)" -ForegroundColor Green
    } else {
        Write-Host "      /health: WARNING  version=$ver (expected 2.0.0)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "      /health: FAILED — $($_.Exception.Message)" -ForegroundColor Red
}

# /api/clients check
try {
    $clients = Invoke-RestMethod -Uri "$base/api/clients?limit=1" -Headers $headers -TimeoutSec 10
    if ($clients.success -and $clients.total -gt 0) {
        Write-Host "      /api/clients: OK  total=$($clients.total)" -ForegroundColor Green
    } else {
        Write-Host "      /api/clients: UNEXPECTED response — $($clients | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "      /api/clients: FAILED — $($_.Exception.Message)" -ForegroundColor Red
}

# /api/workorders pagination
try {
    $wo = Invoke-RestMethod -Uri "$base/api/workorders?limit=2&before=7000" -Headers $headers -TimeoutSec 10
    if ($wo.success -and $wo.count -eq 2) {
        Write-Host "      /api/workorders (cursor): OK  count=$($wo.count)  remaining=$($wo.remaining)" -ForegroundColor Green
    } else {
        Write-Host "      /api/workorders: UNEXPECTED — $($wo | ConvertTo-Json -Compress)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "      /api/workorders: FAILED — $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Deployment complete ===" -ForegroundColor Cyan
Write-Host "Backup: $backup"
Write-Host "Version: 2.0.0"
Write-Host "New endpoints: /api/clients, /api/status"
Write-Host ""
Write-Host "Next step: trigger full sync from GarageOS dashboard → Settings → Integrations → Sync Now" -ForegroundColor Green
