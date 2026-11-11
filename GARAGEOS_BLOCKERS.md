# GarageOS — Blockers

**Updated:** 2026-11-11 (session 2)

---

## 🔴 Critical Blockers (Pilot Cannot Start Without These)

### B1 — SMS Provider Not Configured
**Status:** Blocking — owner deciding between WhatsApp Business, Israeli SIM, or separate SMS provider  
**Impact:** Customers cannot receive OTP codes → cannot log in → pilot impossible  
**Root Cause:** No SMS credentials in Vercel environment variables  
**Required Action (Owner):**
1. Log into Vercel Dashboard → garage-os-eta → Settings → Environment Variables
2. Add `SMS_INFORU_USERNAME` = your InForu username
3. Add `SMS_INFORU_API_KEY` = your InForu API key
4. Redeploy (or wait for auto-redeploy on next push)

**Alternative (if not InForu):**
- 019 SMS: add `SMS_019_USERNAME` + `SMS_019_PASSWORD`
- Vonage: add `SMS_VONAGE_API_KEY` + `SMS_VONAGE_API_SECRET`

**Verification:** After adding credentials, POST to `/api/portal/auth/send-otp` with a real pilot phone number and verify the SMS arrives.

---

### B2 — Staff Login Credentials Unknown
**Status:** Blocking  
**Impact:** Cannot access dashboard → cannot manage pilot customers, check sync status, update org name  
**Root Cause:** Production database has real accounts, not seed credentials (owner@garage.com / admin123)  
**Required Action (Owner):**
1. Try logging in at https://garage-os-eta.vercel.app/login with the email you used when setting up the system
2. If forgotten: use Supabase Dashboard → Authentication → Users to find your email
3. If password forgotten: use "Forgot Password" on the login page (requires SMTP — check if configured)

**Fallback:** If SMTP is not configured and password cannot be reset, AI can create a new staff account via Supabase SQL (requires owner to provide desired email, AI will NOT set the password — owner sets it).

---

### B3 — NESHER Connector Not Deployed
**Status:** Blocking  
**Impact:** No customer/vehicle/history data synced from NESHER → portal has no content to show  
**Root Cause:** Connector v2.0.0 is built but not deployed on WIN-P8FLBRLS3T0  
**Required Action (Owner):**
1. On WIN-P8FLBRLS3T0: open PowerShell as Administrator
2. Navigate to the GarageOS directory
3. Run: `deploy-connector.ps1`
4. Verify connector is running: `curl http://localhost:3001/health`
5. Run initial NESHER sync from GarageOS Dashboard → NESHER Integration

**Prerequisite:** Staff login (B2) must be resolved first to run sync from dashboard.

---

## 🟠 High Priority (Needed for Quality Pilot)

### B4 — NESHER Data Not Synced
**Status:** Waiting on B2 + B3  
**Impact:** Portal shows no vehicles or service history  
**Required Action:** After B2 + B3 resolved → Dashboard → NESHER → Run Full Sync  
**Expected Result:** 1,400+ customers, associated vehicles, work orders imported

---

### B5 — Org Name Shows "מוסך הדגמה"
**Status:** Waiting on B2  
**Impact:** Customers see demo garage name instead of "מרכז שירות דוד מלכה"  
**Required Action:** Dashboard → Settings → Organization → update name after B2 resolved

---

## 🟡 Medium Priority (Can Proceed in Parallel)

### B6 — 5 Pilot Customers Not Selected
**Status:** Waiting on owner decision  
**Impact:** Cannot begin pilot  
**Required Action:** After B3+B4 resolved, owner reviews synced customer list and selects 5 customers who:
- Have valid mobile phone numbers in NESHER
- Have service history in NESHER
- Are likely to respond to feedback requests
- Are comfortable with technology (WhatsApp/SMS)

**AI will NOT auto-select customers. Owner must approve each one explicitly.**

---

### B7 — No Feedback Mechanism Implemented
**Status:** ✅ RESOLVED — deployed in commit c745c5c (2026-11-11)
**Resolution:** 7-question Hebrew RTL feedback form at /portal/feedback, API at /api/portal/feedback, nav tab added, feedback stored in CustomerPilot.checklistNotes without schema migration.

---

## ✅ Resolved Blockers

| Blocker | Resolution | Date |
|---------|-----------|------|
| B7: No feedback mechanism | Portal feedback form built + deployed c745c5c | Nov 2026 |
| Preview URL using localhost:3000 | Fixed 62d7c33 — now uses request host | Nov 2026 |
| Vehicle docs hidden with Supabase storage | Fixed 006f527 | Nov 2026 |
| externalNo not set on pilot NESHER upsert | Fixed d4fefb1 | Nov 2026 |
| Production deployment stuck at September 11 | Fast-forwarded main to saas-foundation | Nov 2026 |
| TEST MODE banner confusing customers | Fixed in a31ce4d (guarded by NODE_ENV) | Nov 2026 |
| importSource 'nesher' (lowercase) breaking data lookup | Fixed all 10 occurrences to 'NESHER' | Nov 2026 |
| STORAGE_PROVIDER BOM causing storage to appear disabled | Fixed with includes() approach | Oct 2026 |
| env.ts crashing on non-printable chars in env vars | Fixed with leading char strip | Oct 2026 |
