# GarageOS — QA Checklist

Pre-launch quality assurance checklist. Each section maps to a feature area.
Work through it top-to-bottom on a clean staging environment populated with seed data.

**Legend**
- `[ ]` — not tested
- `[x]` — passed
- `[!]` — failed / needs fix (add note inline)
- `[~]` — skipped / not applicable in this environment

**Environment assumptions**
- Seed data loaded: `npx prisma db seed`
- At least one org with all five roles (OWNER, MANAGER, SERVICE\_ADVISOR, TECHNICIAN, ACCOUNTANT)
- Test with a real mobile device (or DevTools mobile emulation at 390×844) for all `/mobile` paths

---

## 1. Authentication & Session

### 1.1 Login
- [ ] Login page loads at `/login`
- [ ] Valid credentials → redirect to `/dashboard`
- [ ] Wrong password → clear error message shown (no stack trace)
- [ ] Empty form submit → validation error, not a crash
- [ ] 6+ failed logins from same IP → rate limit (429) kicks in
- [ ] After login, session cookie is `HttpOnly; Secure; SameSite=Strict`

### 1.2 Session timeout
- [ ] `SessionTimeout` modal appears 5 minutes before expiry (set `SESSION_TIMEOUT_MINUTES=6` to test quickly)
- [ ] "המשך פגישה" button resets the countdown without reloading
- [ ] "התנתק" button in modal redirects to `/login`
- [ ] If modal is ignored, auto-logout fires at the correct time
- [ ] After timeout, navigating to any `/dashboard/*` redirects to `/login`

### 1.3 Logout
- [ ] Logout clears session and redirects to `/login`
- [ ] Pressing browser Back after logout does not return to dashboard

### 1.4 Onboarding
- [ ] New user with no org → redirected to `/onboarding`
- [ ] Org name, slug uniqueness validation
- [ ] After onboarding → redirected to `/dashboard`

---

## 2. Role-Based Access Control (RBAC)

Run these checks while logged in as **each role** in turn.

### 2.1 Sidebar visibility
| Route | OWNER | MANAGER | SERVICE_ADVISOR | TECHNICIAN | ACCOUNTANT |
|---|---|---|---|---|---|
| `/dashboard/intake` | ✓ | ✓ | ✓ | — | — |
| `/dashboard/kpi` | ✓ | ✓ | — | — | ✓ |
| `/mobile/jobs` | ✓ | ✓ | — | ✓ | — |
| `/dashboard/clock` | ✓ | ✓ | ✓ | ✓ | — |
| `/dashboard/staff` | ✓ | ✓ | — | — | — |
| `/dashboard/audit` | ✓ | ✓ | — | — | ✓ |
| `/dashboard/settings` | ✓ | ✓ | — | — | — |

- [ ] Each role's sidebar matches the table above (no extra/missing items)

### 2.2 Direct URL guards
- [ ] TECHNICIAN visiting `/dashboard/kpi` → redirected to `/unauthorized`
- [ ] ACCOUNTANT visiting `/dashboard/intake` → redirected to `/unauthorized`
- [ ] SERVICE\_ADVISOR visiting `/dashboard/audit` → redirected to `/unauthorized`
- [ ] `/unauthorized` page renders with a back-to-dashboard link

### 2.3 API endpoint guards
- [ ] `DELETE /api/customers/:id` as TECHNICIAN → 403
- [ ] `POST /api/inventory` as ACCOUNTANT → 403
- [ ] All guarded endpoints return `{"error":"Forbidden"}` not an HTML error page

---

## 3. Dashboard

- [ ] Dashboard loads without errors for all five roles
- [ ] KPI cards show correct counts (open WOs, pending quotes, low stock parts)
- [ ] Workload widget lists active techs and their open job counts
- [ ] "פקודות עבודה פתוחות" table paginates correctly (if >10 rows)
- [ ] Clicking a work order row navigates to `/dashboard/work-orders/[id]`

---

## 4. Customers

### 4.1 List
- [ ] Customer list loads, shows name / phone / vehicle count
- [ ] Search by name or phone filters results in real time
- [ ] Pagination controls work

### 4.2 Create
- [ ] All required fields validated (name, phone)
- [ ] Duplicate phone in same org → error (or at minimum no silent duplicate)
- [ ] Customer saved → appears in list

### 4.3 Edit & view
- [ ] Customer detail shows linked vehicles and work orders
- [ ] Edit form pre-fills existing values
- [ ] Save updates reflected immediately

### 4.4 Delete
- [ ] OWNER can delete customer
- [ ] TECHNICIAN delete button absent or returns 403

---

## 5. Vehicles

- [ ] Vehicle list loads with plate, make/model, year, customer name
- [ ] New vehicle form validates plate format (not empty)
- [ ] Plate uniqueness per org enforced
- [ ] Vehicle detail shows linked work orders and media
- [ ] Edit vehicle: mileage update saved correctly
- [ ] Vehicle search (`/api/vehicles/search?plate=`) returns correct matches

---

## 6. Work Orders

### 6.1 List
- [ ] Filterable by status (PENDING / IN\_PROGRESS / WAITING\_PARTS / COMPLETED / CANCELLED)
- [ ] Sort by date works
- [ ] Badge colors match status

### 6.2 Create
- [ ] Work order number auto-generated and unique per org
- [ ] Customer + vehicle dropdowns populated
- [ ] Assigning technician (by ID) saved in `assignedTechnicianId`
- [ ] Required fields prevent save

### 6.3 Detail page — tabs
- [ ] **פרטים** tab: all WO fields shown correctly
- [ ] **פריטים** tab: line items add/remove, totals recalculate
- [ ] **מדיה** tab: upload photo → thumbnail shown; delete removes it
- [ ] **הערות** tab: internal note saves; customer-visible note toggles visibility
- [ ] **אבחון** tab: AI diagnostic session linked
- [ ] **וואטסאפ** tab: lazy-loads on first click, 7 templates shown
- [ ] **תשלום** tab: lazy-loads on first click, payment link section renders

### 6.4 Status transitions
- [ ] PENDING → IN\_PROGRESS → WAITING\_PARTS → COMPLETED flow works
- [ ] COMPLETED WO locked from editing (or shows warning)
- [ ] Status change appears in audit log

### 6.5 Payment link generation
- [ ] "צור קישור תשלום" generates a link with 7-day expiry
- [ ] Calling it twice returns the same token (idempotent)
- [ ] Generated URL format: `/pay/[token]`
- [ ] After generation, audit log entry created with amount

---

## 7. Reception Intake Wizard (`/dashboard/intake`)

### 7.1 Step 1 — Plate search
- [ ] Typing a plate triggers debounced search (≥350ms delay)
- [ ] Matching vehicle autofills make/model/year/customer fields
- [ ] No match → fields stay blank (ready for manual entry)
- [ ] Partial plate shows up to 5 suggestions

### 7.2 Step 2 — Customer details
- [ ] Phone lookup finds existing customer
- [ ] New customer upserted via `POST /api/intake/customer`
- [ ] Form validation prevents empty required fields

### 7.3 Step 3 — Vehicle details
- [ ] Mileage field saved to vehicle record
- [ ] New plate creates vehicle via `POST /api/intake/vehicle`

### 7.4 Step 4 — Complaint & technician
- [ ] Complaint textarea required
- [ ] Technician dropdown populated from org members (TECHNICIAN role)
- [ ] Selecting a tech pre-fills `assignedTechnicianId`

### 7.5 Step 5 — Signature
- [ ] Signature canvas draws on mouse and touch
- [ ] "נקה" clears canvas
- [ ] "סיים קבלה" — creates work order, uploads signature, navigates to WO detail
- [ ] Signature visible in WO detail (image URL not broken)

### 7.6 Progress bar
- [ ] Steps 1–5 highlighted correctly as wizard progresses
- [ ] Back navigation works without losing already-entered data

---

## 8. Mobile Technician Mode (`/mobile`)

### 8.1 Auth
- [ ] Unauthenticated visit to `/mobile/jobs` → redirect to `/login`
- [ ] After login, returns to mobile view (not desktop dashboard)

### 8.2 Jobs list (`/mobile/jobs`)
- [ ] TECHNICIAN sees only their assigned WOs
- [ ] MANAGER sees all WOs
- [ ] Quick stats (active / open / completed today) accurate
- [ ] "בטיפול עכשיו" section shows only IN\_PROGRESS WOs
- [ ] WO cards tap-to-call customer phone works on mobile

### 8.3 Timer section
- [ ] "התחל טיפול" starts timer and creates TimeEntry; WO moves to IN\_PROGRESS
- [ ] Live HH:MM:SS clock ticks in the browser
- [ ] "השהה" pauses; accumulated minutes saved to `durationMin`
- [ ] "המשך" resumes from paused state; elapsed accumulates correctly
- [ ] "סיים" finishes entry; total time shown; timer stops
- [ ] Page reload preserves running timer (reconstructed from `startedAt`)
- [ ] Two techs on same WO each have their own entries (no conflicts)

### 8.4 Notes section
- [ ] Text note saves via `addTechNote`; appears in WO detail Notes tab
- [ ] Voice recorder: record → plays back in browser; placeholder text appended to note
- [ ] Collapsible section opens/closes

### 8.5 Photos section
- [ ] Camera capture button opens device camera on mobile
- [ ] Gallery picker selects existing photo
- [ ] Uploaded photos show as 3-column thumbnails
- [ ] Tap thumbnail → full-screen lightbox with close button
- [ ] Photos appear in WO detail Media tab

### 8.6 Status section
- [ ] Four large status buttons visible (PENDING / IN\_PROGRESS / WAITING\_PARTS / COMPLETED)
- [ ] Tapping a status updates WO; UI reflects new status immediately
- [ ] Collapsible section opens/closes

### 8.7 Clock widget in mobile layout
- [ ] "כניסה לעבודה" button clocks in
- [ ] "יציאה מעבודה" clocks out
- [ ] Link to `/dashboard/clock` works

---

## 9. Clock In / Out (`/dashboard/clock`)

- [ ] Page accessible to OWNER, MANAGER, SERVICE\_ADVISOR, TECHNICIAN
- [ ] ACCOUNTANT redirected to `/unauthorized`
- [ ] "כניסה לעבודה" creates a new `ClockEntry` with null `clockedOutAt`
- [ ] Live elapsed timer ticks
- [ ] Clocking in twice returns "already clocked in" error without creating a duplicate entry
- [ ] "יציאה מעבודה" sets `clockedOutAt`, timer stops
- [ ] Weekly stats update after clock actions

### 9.1 Manager view
- [ ] "צוות היום" section shows all staff entries for today
- [ ] Active (not clocked out) show green pulsing dot
- [ ] Payroll export section visible to OWNER/MANAGER only

### 9.2 Payroll export
- [ ] Date range picker defaults to first of current month → today
- [ ] "ייצא CSV" downloads a file named `payroll_YYYY-MM-DD_YYYY-MM-DD.csv`
- [ ] CSV has correct headers (Hebrew column names)
- [ ] Data matches clock entries in the selected range
- [ ] Labor hours column matches `TimeEntry.durationMin` totals
- [ ] Invalid date range returns an error, not a 500

---

## 10. WhatsApp Panel

- [ ] Panel loads in WO detail "וואטסאפ" tab (lazy)
- [ ] All 7 templates visible in selector: status\_update, status\_completed, waiting\_parts, quote\_approval, ready\_pickup, payment\_link, appointment\_reminder
- [ ] Template preview updates when different template selected
- [ ] Customer phone number pre-filled; editable
- [ ] "פתח WhatsApp" opens `https://wa.me/...` link in new tab
- [ ] After opening, `CommLog` entry created (check via `/api/work-orders/[id]/comms`)
- [ ] Communication history expands and shows sent messages with relative timestamps
- [ ] Payment link template inserts correct `/pay/[token]` URL when link exists

---

## 11. Payment Links & Public Pay Page

### 11.1 Link generation
- [ ] Generate link returns token
- [ ] Link expires after 7 days (`expiresAt` set correctly)
- [ ] Copying URL works
- [ ] Regenerate on same WO returns same token while link is unpaid

### 11.2 Public pay page (`/pay/[token]`)
- [ ] Page loads without authentication
- [ ] Shows org name, amount in ₪, description, expiry date
- [ ] Expired link shows "פג תוקף" message, button disabled
- [ ] "אשר תשלום" marks link as paid (`paidAt` set)
- [ ] Success state shows confirmation text
- [ ] Calling pay twice (refresh) does not double-update (idempotent)
- [ ] After payment, WO detail shows "שולם" badge
- [ ] Audit log entry created for payment confirmation

---

## 12. KPI Dashboard (`/dashboard/kpi`)

- [ ] Page accessible to OWNER, MANAGER, ACCOUNTANT
- [ ] TECHNICIAN redirected to `/unauthorized`
- [ ] Revenue chart renders for last 12 months (SVG bars visible)
- [ ] Zero-revenue months show faint bars (not missing)
- [ ] Revenue by technician horizontal bar chart renders
- [ ] Labor efficiency stats load (avg repair hours, utilization)
- [ ] Job aging breakdown shows correct counts per bucket
- [ ] Top customers ranked list shows amounts
- [ ] KPI summary cards (total revenue, WOs this month, etc.) have correct values
- [ ] All data is scoped to current org (no cross-org leakage)

---

## 13. AI Diagnostics (`/dashboard/diagnostics`)

- [ ] New session form accepts complaint + OBD codes + symptoms
- [ ] Linked to vehicle (optional) and work order (optional)
- [ ] AI response streams or displays after submit
- [ ] Urgency badge (LOW/MEDIUM/HIGH/CRITICAL) set correctly
- [ ] Session list shows history
- [ ] Session detail shows full AI response

---

## 14. Inventory

- [ ] Parts list with SKU, name, quantity, min-quantity
- [ ] Low-stock badge visible when `quantity < minQuantity`
- [ ] New part: SKU uniqueness per org validated
- [ ] Edit part: quantity change creates `StockMovement` record
- [ ] Delete part: blocked if part is referenced in WO items (or handled gracefully)
- [ ] Supplier linkage works in part detail

---

## 15. Quotes

- [ ] Quote number auto-generated, unique per org
- [ ] Status flow: DRAFT → SENT → APPROVED / REJECTED
- [ ] Line items add/remove; totals recalculate
- [ ] Shared quote page (`/share/quote/[id]`) renders without auth
- [ ] "אשר הצעה" on shared page updates status to APPROVED
- [ ] Approved quote can be converted to work order

---

## 16. Staff Management (`/dashboard/staff`)

### 16.1 Invitations
- [ ] Invite by email; invitation email sent (or link copied if SMTP not configured)
- [ ] Invitation expires after 7 days
- [ ] Accept invite at `/invite/[token]` → user created and added to org
- [ ] Duplicate invite to same email in same org → error

### 16.2 Member management
- [ ] Role change reflected immediately in RBAC
- [ ] Deactivate member → they cannot log in
- [ ] Reactivate restores access
- [ ] MANAGER cannot delete or demote OWNER

---

## 17. Audit Log (`/dashboard/audit`)

- [ ] Accessible to OWNER, MANAGER, ACCOUNTANT
- [ ] TECHNICIAN redirected to `/unauthorized`
- [ ] Entries listed newest-first
- [ ] Filterable by entity type and action
- [ ] Financial entries present: payment link created, payment confirmed
- [ ] Login/logout entries present
- [ ] Work order status changes present

---

## 18. Settings

### 18.1 Organization
- [ ] Update org name, phone, address, VAT ID
- [ ] Logo upload (if STORAGE\_PROVIDER=local, written to `public/uploads/`)
- [ ] Changes reflected in sidebar org name immediately

### 18.2 Billing
- [ ] Billing page accessible to OWNER only
- [ ] Shows current plan (FREE/PRO/ENTERPRISE)

### 18.3 Team (invitations)
- [ ] Pending invitations listed
- [ ] Revoke invitation removes it from list

---

## 19. Health & Monitoring

### 19.1 Health endpoint
```
GET /api/health
```
- [ ] Returns `200` with `status: "ok"` when DB is reachable
- [ ] Response includes `services.database.latency` (number)
- [ ] `services.storage`, `services.twilio`, `services.stripe`, `services.email` present
- [ ] Disabled integrations show `status: "disabled"` (not `"error"`)
- [ ] Returns `503` when DB is unreachable
- [ ] Response headers include `Cache-Control: no-store`

### 19.2 Cron endpoint
```
GET /api/cron/jobs
Authorization: Bearer <CRON_SECRET>
```
- [ ] Without `Authorization` header → `401`
- [ ] With wrong token → `401`
- [ ] With correct token → `200 { ok: true, processed: N, failed: N, pruned: N }`
- [ ] PENDING jobs older than `runAt` are processed
- [ ] DONE/FAILED jobs older than 30 days are pruned

---

## 20. Rate Limiting

Test each limit by sending rapid requests. Confirm `429 Too Many Requests` with `Retry-After` header.

- [ ] Login: 11th attempt from same IP within 60s → 429
- [ ] File upload: 21st upload in an hour per user → 429
- [ ] Payment link generation: 21st in an hour per org → 429
- [ ] Payroll export: 6th in a minute per user → 429
- [ ] `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers present on all guarded routes

---

## 21. Integrations (staging/production)

These require real credentials. Mark `[~]` if testing in dev with flags disabled.

### 21.1 Twilio WhatsApp (`FLAG_TWILIO_WHATSAPP=true`)
- [ ] Sending a template message delivers to a real WhatsApp number
- [ ] Inbound reply from WhatsApp → `POST /api/webhooks/twilio` → `CommLog` entry created
- [ ] Invalid Twilio credentials → error logged, not a crash; caller sees user-friendly error

### 21.2 Stripe Payments (`FLAG_STRIPE_PAYMENTS=true`)
- [ ] Generating a payment link creates a Stripe Checkout session
- [ ] Redirect to Stripe hosted page works
- [ ] Test card `4242 4242 4242 4242` → success → `checkout.session.completed` webhook fires
- [ ] Webhook marks `PaymentLink.paidAt`, updates invoice to PAID
- [ ] Invalid webhook signature → `400` (no silent acceptance)

### 21.3 SMTP Email
- [ ] Work-order-ready email sends with correct subject and HTML body
- [ ] Payment confirmed email sends
- [ ] SMTP not configured → `{ success: false }` returned (no crash); warning logged

### 21.4 S3 Storage (`STORAGE_PROVIDER=s3`)
- [ ] Photo upload in mobile mode → stored in S3 bucket
- [ ] URL returned is publicly accessible (or CDN URL when `AWS_S3_PUBLIC_URL` set)
- [ ] Delete media → S3 object removed
- [ ] Missing AWS credentials → startup error thrown (not silent)

---

## 22. Security

### 22.1 Headers (check with browser DevTools or `curl -I`)
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] Production only: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- [ ] `X-Powered-By` header absent

### 22.2 Data isolation (multi-tenancy)
- [ ] API endpoint with valid session but WO belonging to a **different org** → 404 (not the data)
- [ ] Customer list only returns customers for authenticated user's org
- [ ] `/pay/[token]` for a token belonging to another org → 404 (or shows correct org data — not another org's data)

### 22.3 Input sanitization
- [ ] `<script>alert(1)</script>` in customer name → stored as text, not executed
- [ ] SQL injection attempt in search field → no error, no data leak
- [ ] Path traversal in file upload key (`../../etc/passwd`) → sanitized by `sanitizeKey()`

### 22.4 Auth boundaries
- [ ] `/api/*` routes without a session cookie → 401
- [ ] Server actions (`.ts` in `app/actions/`) called from a different org's session → authorization error

---

## 23. Performance

- [ ] Dashboard initial load < 2 s on a 100 Mbps connection (check Network tab)
- [ ] Work orders list with 100+ records renders without janking
- [ ] KPI page with 12 months of data renders in < 3 s
- [ ] Mobile job list with 50 WOs loads in < 2 s on 4G emulation
- [ ] DB query plan for `WorkOrder` list uses the `(organizationId, status)` index (run `EXPLAIN ANALYZE` on staging)

---

## 24. Deployment (Docker / Railway)

### 24.1 Docker build
```bash
docker build -t garageos .
```
- [ ] Build completes without errors
- [ ] Final image size < 500 MB
- [ ] `docker run --env-file .env.production -p 3000:3000 garageos` starts successfully
- [ ] `prisma migrate deploy` runs at container startup (check logs)
- [ ] `/api/health` returns 200 inside the container

### 24.2 docker-compose
```bash
docker compose up -d
```
- [ ] `postgres` container passes health check before `app` starts
- [ ] App connects to `postgres` service by hostname
- [ ] `backup` sidecar dumps database to `/backups/` on first run
- [ ] `docker compose down -v` cleans up all volumes

### 24.3 Environment validation
- [ ] Missing `DATABASE_URL` → startup crashes with a clear error message
- [ ] Missing `NEXTAUTH_SECRET` (< 32 chars) → startup crashes with a clear error
- [ ] `FLAG_TWILIO_WHATSAPP=true` without `TWILIO_*` vars → startup crashes with a clear error
- [ ] `ENCRYPTION_KEY` with wrong length → startup crashes with a clear error

---

## 25. RTL & Localisation

- [ ] All pages render RTL (`dir="rtl"`)
- [ ] Text alignment, margins, and padding correct in RTL layout
- [ ] Sidebar at right (or left — whichever design intends) consistently
- [ ] Date/time displays in `he-IL` locale (e.g., `יום ב׳, 26.5.2026`)
- [ ] Currency amounts display as `₪1,234.56`
- [ ] Lucide icons that are directional (arrows) flip correctly in RTL if applicable

---

## 26. Error Handling

- [ ] `/dashboard/error.tsx` renders when a dashboard page throws
- [ ] `/error.tsx` (root) renders for non-dashboard routes
- [ ] 404 page for unknown routes (Next.js default or custom `not-found.tsx`)
- [ ] API routes return JSON errors (not HTML) for all error states
- [ ] No raw stack traces exposed to the browser in production (`NODE_ENV=production`)

---

## Regression matrix

Run after any significant change. Quick smoke-test the happy path for each module.

| Area | Create | Read | Update | Delete |
|---|---|---|---|---|
| Customer | [ ] | [ ] | [ ] | [ ] |
| Vehicle | [ ] | [ ] | [ ] | [ ] |
| Work Order | [ ] | [ ] | [ ] | [ ] |
| Inventory | [ ] | [ ] | [ ] | [ ] |
| Quote | [ ] | [ ] | [ ] | [ ] |
| Invoice | — | [ ] | [ ] | — |
| Payment Link | [ ] | [ ] | — | — |
| Staff member | [ ] | [ ] | [ ] | [ ] |
| Clock entry | [ ] | [ ] | — | — |

---

## Sign-off

| Tester | Date | Environment | Result |
|---|---|---|---|
| | | staging | [ ] Pass / [ ] Fail |
| | | production | [ ] Pass / [ ] Fail |

**Known open issues:** *(fill in before sign-off)*
-
