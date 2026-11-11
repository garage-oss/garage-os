# GarageOS — Project Manager Instructions

## Mission
Get FIVE real customers of מרכז שירות דוד מלכה successfully using GarageOS and providing feedback.

**Production:** https://garage-os-eta.vercel.app  
**Branch:** `saas-foundation` → push to `main` triggers Vercel production build  
**Stack:** Next.js App Router · PostgreSQL (Supabase) · Prisma · NextAuth · Supabase Storage

---

## Session Start Protocol

At the start of EVERY session, execute in order:

```bash
# 1. Read project state
cat CLAUDE.md GARAGEOS_STATUS.md GARAGEOS_TASKS.md GARAGEOS_BLOCKERS.md GARAGEOS_PILOT.md

# 2. Verify production
curl -s https://garage-os-eta.vercel.app/api/health | python3 -m json.tool

# 3. Check git
git log --oneline origin/main -5
git status --short
```

Then continue from the highest-priority unfinished task in GARAGEOS_TASKS.md.

---

## Safety Rules (NEVER VIOLATE)

- **NESHER SQL: READ-ONLY.** SELECT only. Never INSERT/UPDATE/DELETE/ALTER/DROP/CREATE against NESHER.
- **Never print secrets** in chat, logs, commits, or browser code.
- **Never change existing .env values** in Vercel or locally.
- **Never run `prisma db push`** — only `prisma migrate deploy`.
- **Never expose permanent public URLs** for documents.
- **Never enroll pilot customers or send invitations** without explicit owner approval.
- **Back up before destructive DB operations.**

---

## Deployment

- Push to `saas-foundation` → Preview deployment only
- Push to `main` → Production deployment at garage-os-eta.vercel.app
- To deploy: `git push origin saas-foundation:main`
- Verify: `curl -s https://garage-os-eta.vercel.app/api/health | grep commit`

---

## Key Files

| File | Purpose |
|------|---------|
| `GARAGEOS_STATUS.md` | Verified production status (update after each audit) |
| `GARAGEOS_TASKS.md` | Prioritized task list with owner + status |
| `GARAGEOS_BLOCKERS.md` | Blockers requiring external action |
| `GARAGEOS_PILOT.md` | 5-customer pilot tracking |
| `src/lib/sms.ts` | SMS providers (InForu, 019, Vonage) |
| `src/lib/customer-auth.ts` | Portal session management |
| `src/app/api/portal/auth/` | OTP send/verify routes |
| `src/app/dashboard/customer-pilot/` | Staff pilot management UI |
| `src/lib/nesher/connector-importer.ts` | NESHER→GarageOS sync |

---

## Architecture: Customer Portal Login Flow

```
Customer enters phone
  → POST /api/portal/auth/send-otp
    → pilot check (CustomerPilot table)
    → generate OTP (6 digits)
    → SMS via configured provider (InForu/019/Vonage)
    → OTP stored in CustomerOtp table (5 min TTL)
  → Customer enters code
  → POST /api/portal/auth/verify-otp
    → hash verify (HMAC-SHA256 with OTP_SECRET)
    → createCustomerSession() → cookie
  → Portal home: vehicles, history, quotes
```

**SMS is the critical blocker.** Without `SMS_INFORU_USERNAME` + `SMS_INFORU_API_KEY` (or 019/Vonage equivalent) in Vercel, customers cannot log in.

---

## Pilot Acceptance Criteria

The pilot is complete ONLY when ALL of the following are verified with real evidence:

- [ ] 5 real customers manually approved by owner
- [ ] All 5 received approved invitations
- [ ] All 5 logged in successfully (OTP via SMS)
- [ ] All 5 see only their own vehicles
- [ ] All 5 verified their service history (NESHER data)
- [ ] All 5 tested quotation flow
- [ ] All 5 tested appointment booking
- [ ] Document upload tested (optional feature)
- [ ] Feedback collected from all 5
- [ ] Critical issues fixed
- [ ] Production stable throughout
- [ ] NESHER remained read-only

---

## Decisions Requiring Owner Approval

- Adding pilot customers
- Sending SMS invitations
- Changing Vercel environment variables
- Deploying NESHER connector on WIN-P8FLBRLS3T0
- Any database migrations in production
- Destructive operations
