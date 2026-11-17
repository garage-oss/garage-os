# ============================================================================
# GarageOS Connector - add the /api/clients endpoint (phone numbers)
# Run ON WIN-P8FLBRLS3T0 in an Administrator PowerShell.
# ============================================================================
# The connector installed at C:\GarageOS-Connector is the modular v1 layout:
#   server.js -> src/app.js -> src/routes/*.js, settings in .env
#   (PORT, API_KEY, SQL_SERVER, SQL_DATABASE).
#
# The previous version of this script replaced server.js with a different,
# single-file connector that reads other .env names (NESHER_CONNECTOR_API_KEY,
# HANESHER_DB_*). Running it against this install would have left the
# connector unable to reach SQL and with no API key. Do NOT restore it.
#
# This script only ADDS one read-only route and registers it. It is
# idempotent: running it again changes nothing. NESHER stays SELECT-only.
#
# Applied manually on 2026-11-16; kept here so the change can be repeated
# if the connector is ever reinstalled.
# ============================================================================

param(
    [switch]$DryRun,
    [string]$ConnectorDir = "C:\GarageOS-Connector"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$app    = Join-Path $ConnectorDir "src\app.js"
$route  = Join-Path $ConnectorDir "src\routes\clients.js"

foreach ($f in @("$ConnectorDir\server.js", $app, "$ConnectorDir\.env", "$ConnectorDir\src\database.js")) {
    if (-not (Test-Path $f)) { Write-Error "Expected file not found: $f (unexpected connector layout - stopping)"; exit 1 }
}

# -- 1. Route file ------------------------------------------------------------
$routeJs = @'
const express = require("express");
const { sql, getPool } = require("../database");

const router = express.Router();

// GET /api/clients - read-only (SELECT only) list of clients with phone fields,
// most recently active clients first.
router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
    const pool = await getPool();
    const result = await pool
      .request()
      .input("lim", sql.Int, limit)
      .query(`
        SELECT TOP (@lim) c.cli_no, c.cli_name, c.cli_phone, c.cli_pele, c.cli_email
        FROM dbo.ca_clients c
        JOIN (
          SELECT cli_no, MAX(card_id) AS last_card
          FROM dbo.ca_cards
          WHERE cli_no IS NOT NULL
          GROUP BY cli_no
        ) k ON k.cli_no = c.cli_no
        ORDER BY k.last_card DESC
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
'@

if (Test-Path $route) {
    Write-Host "[1/3] src\routes\clients.js already exists - leaving it" -ForegroundColor Green
} elseif ($DryRun) {
    Write-Host "[1/3] Would create src\routes\clients.js" -ForegroundColor Yellow
} else {
    [IO.File]::WriteAllText($route, $routeJs)
    Write-Host "[1/3] Created src\routes\clients.js" -ForegroundColor Green
}

# -- 2. Register in app.js ----------------------------------------------------
if (Select-String -Path $app -Pattern '"/api/clients"' -Quiet) {
    Write-Host "[2/3] app.js already registers /api/clients - leaving it" -ForegroundColor Green
} elseif ($DryRun) {
    Write-Host "[2/3] Would back up app.js and add two lines" -ForegroundColor Yellow
} else {
    Copy-Item $app "$app.bak_$(Get-Date -Format yyyyMMdd_HHmmss)"
    $out = Get-Content $app | ForEach-Object {
        $_
        if ($_ -match '^const workOrderRoutes = require') { 'const clientRoutes = require("./routes/clients");' }
        if ($_ -match '^app\.use\("/api/workorders"')      { 'app.use("/api/clients", clientRoutes);' }
    }
    [IO.File]::WriteAllLines($app, $out)
    & node --check $app
    if ($LASTEXITCODE -ne 0) { Write-Error "app.js failed syntax check - restore the .bak file"; exit 1 }
    Write-Host "[2/3] app.js updated (backup saved next to it)" -ForegroundColor Green
}

# -- 3. Restart + verify ------------------------------------------------------
if ($DryRun) { Write-Host "[3/3] Dry run - not restarting"; exit 0 }

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'server\.js' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep 2
Start-Process node -ArgumentList 'server.js' -WorkingDirectory $ConnectorDir -WindowStyle Hidden
Start-Sleep 6

$key = ((Get-Content "$ConnectorDir\.env" | Where-Object { $_ -match '^API_KEY=' }) -split '=', 2)[1].Trim()
$h   = @{ 'x-api-key' = $key }
$port = ((Get-Content "$ConnectorDir\.env" | Where-Object { $_ -match '^PORT=' }) -split '=', 2)[1]
if (-not $port) { $port = '4000' }
try {
    $c = Invoke-RestMethod "http://localhost:$($port.Trim())/api/clients?limit=5" -Headers $h -TimeoutSec 30
    Write-Host "[3/3] /api/clients OK - returned $($c.count) rows" -ForegroundColor Green
} catch {
    Write-Host "[3/3] /api/clients FAILED - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
