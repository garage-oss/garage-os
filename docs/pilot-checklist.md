# GarageOS Pilot Rollout Checklist

Use this checklist for each new pilot garage. Complete all items before handing
the system over to the customer.

---

## T−7 days: Infrastructure

- [ ] **Database** provisioned (Neon / Supabase / Railway)
- [ ] **Vercel project** created and linked to GitHub repo
- [ ] **Environment variables** configured in Vercel:
  - [ ] `DATABASE_URL` (with `?sslmode=require` for cloud)
  - [ ] `DIRECT_URL` (Supabase transaction pooler users only)
  - [ ] `NEXTAUTH_SECRET` (generated with `openssl rand -base64 32`)
  - [ ] `NEXTAUTH_URL` (exact production URL, no trailing slash)
  - [ ] `STORAGE_PROVIDER` (set to `s3` or `supabase` — **not** `local`)
  - [ ] Storage credentials configured
  - [ ] `ANTHROPIC_API_KEY` if AI Diagnostics is enabled
- [ ] **Health check** returns 200: `GET https://your-domain/api/health`
- [ ] **Uptime monitor** configured (UptimeRobot / BetterUptime)
  - Monitor URL: `https://your-domain/api/health`
  - Alert email: your support address

---

## T−3 days: Organisation setup

- [ ] **Owner account** created (admin logs in via `/login`, completes onboarding)
- [ ] **Organisation profile** filled in:
  - [ ] Garage name
  - [ ] Phone number
  - [ ] Address + city
  - [ ] VAT / tax ID
  - [ ] Logo URL or avatar
- [ ] **Staff invited** (Settings → Team → Invite):
  - [ ] At least one MANAGER
  - [ ] All technicians
  - [ ] Service advisors
- [ ] **Feature flags** reviewed — disable unused modules:
  ```
  FLAG_AI_DIAGNOSTICS=true  (requires ANTHROPIC_API_KEY)
  FLAG_AUDIT_LOG=true
  FLAG_AVATAR_UPLOAD=true
  ```
- [ ] **Demo seed data removed** (if using the seed script, clean demo records):
  ```sql
  DELETE FROM "Customer" WHERE name LIKE 'לקוח%';
  DELETE FROM "WorkOrder" WHERE "workOrderNumber" LIKE 'WO-%';
  -- etc.
  ```

---

## T−1 day: End-to-end testing

Run through the full workflow as the owner:

- [ ] Login with owner account
- [ ] Create a test customer
- [ ] Add a vehicle to the customer
- [ ] Create a work order, assign to a technician
- [ ] Change work order status → verify notification appears in TopBar bell
- [ ] Add a part to inventory
- [ ] Adjust stock below threshold → verify low-stock notification
- [ ] Create a quote, mark as APPROVED → verify notification
- [ ] Invite a staff member, accept the invitation as that user
- [ ] Upload an avatar photo (Settings → Staff)
- [ ] Check `GET /api/health` returns `"status": "ok"`
- [ ] Test on mobile (iOS Safari / Android Chrome) — check PWA install prompt

---

## Launch day

- [ ] Final `git push` to `main` (auto-deploys via Vercel)
- [ ] Verify build succeeded in Vercel dashboard
- [ ] Send login credentials to garage owner (secure channel — not email!)
- [ ] Walk owner through onboarding flow on a screen-share
- [ ] Confirm first work order is created successfully
- [ ] Set up weekly backup reminder (see `docs/backup-restore.md`)

---

## T+3 days: Follow-up

- [ ] Check error logs in Vercel → Functions tab
- [ ] Review audit log for unexpected activity
- [ ] Ask owner: any missing features or confusing flows?
- [ ] Check disk / storage usage (avatars bucket)
- [ ] Confirm all staff have logged in at least once

---

## T+14 days: Pilot review

- [ ] Number of work orders created
- [ ] Number of active staff users
- [ ] Any reported errors (check Sentry / Vercel logs)
- [ ] Customer satisfaction interview
- [ ] Decide: continue pilot → full contract, or adjust plan

---

## Emergency contacts & rollback

**Rollback a deployment:**
```bash
vercel rollback
```

**Emergency DB access:**
```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM \"WorkOrder\";"
```

**Disable a feature flag instantly** (no redeploy needed in Vercel env vars):
```
FLAG_AI_DIAGNOSTICS=false
```
→ Vercel → Settings → Environment Variables → edit → save → redeploy.
