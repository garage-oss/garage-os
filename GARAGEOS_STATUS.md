# GarageOS — Production Status

**Last verified:** 2026-11-11  
**Verified by:** Production audit (automated)

---

## Production

| Item | Status | Detail |
|------|--------|--------|
| URL | ✅ Live | https://garage-os-eta.vercel.app |
| Deployed commit | ✅ `a31ce4d` | fix(portal): hide TEST MODE banner in production |
| Database | ✅ OK | Supabase PostgreSQL connected, latency ~2.8s |
| Supabase Storage | ✅ OK | SUPABASE_URL + SUPABASE_SERVICE_KEY set |
| Twilio | ⬜ Disabled | Not configured (not needed) |
| Stripe | ⬜ Disabled | Not needed for pilot |
| Email (SMTP) | ⬜ Disabled | Not needed for pilot |
| SMS Provider | ❌ NOT SET | DemoSmsProvider active → OTP not delivered |

---

## Staff Access

| Item | Status | Detail |
|------|--------|--------|
| Login page | ✅ Working | https://garage-os-eta.vercel.app/login |
| Credentials | ❌ UNKNOWN | Seed credentials (owner@garage.com / admin123) rejected |
| Owner account | ❓ Unknown | Unknown which email was used to register in production |

---

## Customer Portal

| Item | Status | Detail |
|------|--------|--------|
| Portal page | ✅ Renders | https://garage-os-eta.vercel.app/portal/login |
| TEST MODE banner | ✅ Hidden | Fixed in a31ce4d (shown only in dev) |
| OTP send | ❌ BROKEN | SMS not configured → codes not delivered |
| OTP verify | ✅ Logic OK | HMAC-SHA256, rate limiting, pilot check in place |
| Pilot check | ✅ Logic OK | CustomerPilot table enforced |
| importSource | ✅ Fixed | All 'nesher' normalized to 'NESHER' |

---

## NESHER Integration

| Item | Status | Detail |
|------|--------|--------|
| Connector v2.0.0 | ❌ NOT DEPLOYED | deploy-connector.ps1 ready, needs WIN-P8FLBRLS3T0 |
| Last sync | ❓ Unknown | Requires staff login to check |
| Customers in DB | ❓ Unknown | Requires staff login or DB query |
| Vehicles in DB | ❓ Unknown | Requires staff login |
| Work orders in DB | ❓ Unknown | Requires staff login |
| Phone sync | ❓ Unknown | Requires staff login |

---

## Code Quality

| Item | Status |
|------|--------|
| BOM in STORAGE_PROVIDER | ✅ Fixed (includes() approach) |
| importSource casing | ✅ Fixed (NESHER uppercase everywhere) |
| env.ts validation | ✅ Working (non-printable char strip) |
| Cron sync | ✅ Working (CRON_SECRET optional) |
| Health endpoint | ✅ Returns commit SHA |

---

## Critical Path to Pilot

1. ❌ **Staff login** — owner must identify production credentials
2. ❌ **SMS provider** — owner must add credentials to Vercel  
3. ❌ **NESHER Connector** — owner must deploy on WIN-P8FLBRLS3T0
4. ⬜ **NESHER Sync** — run full sync after connector deployed
5. ⬜ **5 Pilot customers** — owner selects after sync
6. ⬜ **E2E test** — verify complete flow with one customer
7. ⬜ **Send invitations** — owner approves, then send
