# GarageOS — Task List

**Updated:** 2026-11-11 (session 2)

Priority: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low  
Status: ⬜ Todo · 🔄 In Progress · ✅ Done · ❌ Blocked

---

## Phase 1 — Unblock Production (Owner Actions)

| # | Priority | Task | Owner | Status | Notes |
|---|----------|------|-------|--------|-------|
| 1.1 | 🔴 | Identify production staff credentials | **Owner** | ⬜ | Try shimon7550@gmail.com or Vercel DB query |
| 1.2 | 🔴 | Add SMS credentials to Vercel dashboard | **Owner** | ⬜ | SMS_INFORU_USERNAME + SMS_INFORU_API_KEY |
| 1.3 | 🔴 | Deploy NESHER Connector v2.0.0 on WIN-P8FLBRLS3T0 | **Owner** | ⬜ | Run deploy-connector.ps1 as Admin |

---

## Phase 2 — Data & Sync (After Phase 1)

| # | Priority | Task | Owner | Status | Notes |
|---|----------|------|-------|--------|-------|
| 2.1 | 🔴 | Run full NESHER sync from dashboard | **Owner** | ⬜ | After 1.3 — imports 1,400+ customers |
| 2.2 | 🟠 | Verify phone numbers synced for pilot customers | **AI** | ⬜ | After 2.1 — check phone fields |
| 2.3 | 🟠 | Update org name to מרכז שירות דוד מלכה | **Owner** | ⬜ | Settings → Organization after 1.1 |

---

## Phase 3 — Code Fixes (AI can do now)

| # | Priority | Task | Owner | Status | Notes |
|---|----------|------|-------|--------|-------|
| 3.1 | 🟠 | Staff credentials helper — Supabase DB lookup | **AI** | 🔄 | Requires Supabase MCP auth — blocked |
| 3.2 | 🟡 | Pilot dashboard: show NESHER customer search | **AI** | ✅ | Already existed in customer-pilot page |
| 3.3 | 🟡 | Portal: feedback collection screen | **AI** | ✅ | Built and deployed — commit c745c5c |
| 3.4 | 🟢 | Pilot dashboard: pilot readiness checklist per customer | **AI** | ✅ | Already existed as Checklist component |

---

## Phase 4 — Testing (After Phase 2)

| # | Priority | Task | Owner | Status | Notes |
|---|----------|------|-------|--------|-------|
| 4.1 | 🔴 | E2E test: OTP send + receive + login | **AI + Owner** | ⬜ | Needs real SMS |
| 4.2 | 🔴 | E2E test: customer sees own vehicles only | **AI** | ⬜ | Cross-customer isolation |
| 4.3 | 🟠 | E2E test: NESHER history visible in portal | **AI** | ⬜ | Requires synced data |
| 4.4 | 🟠 | E2E test: quotation flow | **AI** | ⬜ |  |
| 4.5 | 🟠 | E2E test: appointment booking | **AI** | ⬜ |  |
| 4.6 | 🟡 | E2E test: document upload + download | **AI** | ⬜ | Supabase storage |

---

## Phase 5 — Pilot (After Phase 4)

| # | Priority | Task | Owner | Status | Notes |
|---|----------|------|-------|--------|-------|
| 5.1 | 🔴 | Owner selects 5 pilot customers | **Owner** | ⬜ | From NESHER customer list |
| 5.2 | 🔴 | AI prepares personalized invitation messages | **AI** | ⬜ | After 5.1 |
| 5.3 | 🔴 | Owner approves invitations | **Owner** | ⬜ |  |
| 5.4 | 🔴 | Send invitations (SMS/WhatsApp) | **AI + Owner** | ⬜ | After 5.3 |
| 5.5 | 🔴 | Monitor 5 customers onboarding | **AI** | ⬜ |  |
| 5.6 | 🔴 | Collect feedback from all 5 | **AI + Owner** | ⬜ |  |

---

## Completed ✅

| Task | Commit | Date |
|------|--------|------|
| Portal feedback collection screen | c745c5c | Nov 2026 |
| Fix externalNo missing on pilot NESHER upsert | d4fefb1 | Nov 2026 |
| Commit deploy-connector.ps1 to repo | d4fefb1 | Nov 2026 |
| Fix preview URL localhost:3000 bug | 62d7c33 | Nov 2026 |
| Fix vehicle docs hidden with Supabase storage | 006f527 | Nov 2026 |
| Fix BOM in STORAGE_PROVIDER | f00b556 | Oct 2026 |
| Fix importSource 'nesher' → 'NESHER' | c53fb82, 8f9fd70 | Oct 2026 |
| Add commit SHA to health endpoint | 4485b99 | Oct 2026 |
| Fix production deployment (main←saas-foundation) | a31ce4d | Oct 2026 |
| Hide TEST MODE banner in production | a31ce4d | Oct 2026 |
| Supabase storage connected | verified | Oct 2026 |
| env.ts non-printable char strip | 1f346f6 | Oct 2026 |
