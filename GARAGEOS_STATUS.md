# GarageOS — Production Status

**Last verified:** 2026-11-17 (session 4)

---

## Production

| Item | Status | Detail |
|------|--------|--------|
| URL | ✅ Live | https://garage-os-eta.vercel.app |
| Health | ✅ OK | `/api/health` → database ok, storage supabase (verified 2026-11-16) |
| Database | ✅ OK | Supabase PostgreSQL, project `jhhzdevxhwbhilzsnonl` |
| Row Level Security | ✅ Fixed 2026-11-16 | Enabled on all 46 public tables (20 were fully exposed to the anon key). App connects as `postgres` (bypasses RLS) — verified login + customer list still work |
| SMS Provider | ❌ NOT SET | Owner opened an InforU account request 2026-11-16 — waiting for credentials |
| Twilio / Stripe / SMTP | ⬜ Disabled | Not needed for pilot |

---

## Staff Access

| Item | Status | Detail |
|------|--------|--------|
| Owner login | ✅ Working | Seed owner account re-assigned to the owner's email; owner set a new password himself via SQL Editor |
| Owner name | ✅ | שמעון מלכה |
| Organization name | ✅ | דוד מלכה מרכז שירות לרכב |
| Demo accounts | ⚠️ Still active | manager@/tech@/advisor@/accountant@garage.com — passwords are not the seed default, but should be removed before pilot |
| Password reset | ❌ None | No "forgot password" flow exists; reset is SQL-only |

---

## NESHER Data

| Item | Status | Detail |
|------|--------|--------|
| Customers in GarageOS | 1,401 | Only customers that have work orders are imported (by design) |
| Vehicles / work orders | 2,083 / 3,288 | |
| Phones | ✅ 1,289 valid mobiles | 4 other format, 108 none in NESHER either |
| NESHER copy on WIN-P8FLBRLS3T0 | ⚠️ Stale until 2026-11-17 | BI export stopped 2026-07-31 11:36. NESHER support re-ran it 2026-11-17 — **not yet verified** (server reachable only from the office) |
| NESHER totals | | Owner's NESHER UI shows 22,314 customers; server copy has 14,052 in ca_clients (max cli_no 21,962) |

## Connector (WIN-P8FLBRLS3T0, `C:\GarageOS-Connector`)

| Item | Status | Detail |
|------|--------|--------|
| Layout | v1 modular | server.js → src/app.js → src/routes/*, .env keys PORT, API_KEY, SQL_SERVER, SQL_DATABASE |
| `/api/clients` | ✅ Added 2026-11-16 | New file src/routes/clients.js + 2 lines in app.js (backup app.js.bak_20261116_205438). Returns 1,402 clients, 1,375 with mobile |
| Process | ⚠️ Manual | node.exe started by hand. Scheduled task `GarageOS-Connector` (SYSTEM, at boot) has **never run** — connector may not come back after a server reboot |
| Old deploy script | ✅ Replaced | Previous deploy-connector.ps1 targeted a different connector layout and would have broken it |

---

## Code changes pending deploy

| Change | Branch | Status |
|--------|--------|--------|
| Phone sync: batched UPDATE instead of one query per customer (was ~30 min, timed out at 60 s) | `claude/phone-sync-batch` | Pushed, not on main |

---

## Critical Path to Pilot

1. ✅ Staff login
2. ✅ DB security (RLS)
3. ✅ Phone numbers synced
4. ⏳ Verify NESHER BI refresh on server, then import Aug–Nov work orders (needs office, 2026-11-18)
5. ⏳ SMS — InforU credentials → Vercel env vars → test OTP to owner's phone
6. ⏳ E2E quote flow test
7. ⏳ Owner selects 5 pilot customers
8. ⏳ Owner approves invitations, then send
