# GarageOS — מערכת ניהול מוסך

A production-ready, multi-tenant **garage management SaaS** built with Next.js 14,
TypeScript, Prisma + PostgreSQL, and a Hebrew RTL UI.

---

## Features

| Module | Description |
|---|---|
| **Customers** | Full CRUD, vehicle history, communication log |
| **Vehicles** | Fleet tracking, specs, service history |
| **Work Orders** | Job management, technician assignment, status pipeline |
| **Inventory** | Parts tracking, low-stock alerts, movement log |
| **Suppliers** | Supplier management with part associations |
| **Quotes** | PDF-ready quotes linked to customers/vehicles |
| **AI Diagnostics** | Claude-powered diagnostic session assistant |
| **Staff** | Team management, RBAC, avatar upload, last-login |
| **Audit Log** | Immutable audit trail for all mutations |
| **Settings** | Org profile, team invites, subscription plan |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, Server Actions) |
| Language | TypeScript |
| Database | PostgreSQL via Prisma |
| Auth | NextAuth.js (Credentials) |
| UI | Tailwind CSS — dark mode, Hebrew RTL |
| AI | Anthropic Claude SDK |
| Deployment | Vercel + Neon / Supabase PostgreSQL |

---

## Quick Start (development)

```bash
# 1. Clone
git clone https://github.com/your-org/garage-app.git
cd garage-app

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env — set DATABASE_URL and NEXTAUTH_SECRET at minimum

# 4. Set up database
npx prisma db push

# 5. Seed demo data
npx tsx prisma/seed.ts

# 6. Run
npm run dev
# → http://localhost:3000
```

---

## Demo accounts

All passwords: `admin123`

| Email | Role | Access |
|---|---|---|
| `owner@garage.com` | OWNER | Full access + billing |
| `manager@garage.com` | MANAGER | All modules except billing |
| `advisor@garage.com` | SERVICE_ADVISOR | Customers, vehicles, quotes |
| `tech@garage.com` | TECHNICIAN | Work orders, diagnostics |
| `accountant@garage.com` | ACCOUNTANT | Reports, quotes, read-only |

---

## Architecture

```
src/
├── app/
│   ├── actions/          # Server Actions (form mutations)
│   ├── api/              # API routes (health check, avatar upload)
│   ├── dashboard/        # Authenticated app pages
│   │   ├── customers/
│   │   ├── vehicles/
│   │   ├── work-orders/
│   │   ├── inventory/
│   │   ├── suppliers/
│   │   ├── quotes/
│   │   ├── diagnostics/
│   │   ├── staff/
│   │   ├── audit/
│   │   └── settings/
│   ├── invite/           # Invitation acceptance flow
│   ├── login/
│   └── onboarding/
├── components/
│   ├── audit/
│   ├── rbac/             # PermissionGuard, AdminGuard, OwnerGuard
│   ├── settings/
│   └── staff/
└── lib/
    ├── audit.ts          # Audit logging
    ├── billing.ts        # Plan limits, trial management
    ├── env.ts            # Zod-validated environment
    ├── flags.ts          # Feature flags
    ├── logger.ts         # Structured logger
    ├── org.ts            # Org context, members, invitations
    ├── prisma.ts         # Prisma client singleton
    ├── rbac.ts           # Role-based access control matrix
    ├── ratelimit.ts      # Rate limiting abstraction
    ├── staff.ts          # Staff queries
    └── storage.ts        # File storage abstraction
```

### RBAC

5 roles × 12 modules × 4 actions — defined as a static matrix in `src/lib/rbac.ts`:

| Role | Customers | Work Orders | Inventory | Reports | Settings | Users | Audit |
|---|---|---|---|---|---|---|---|
| OWNER | Full | Full | Full | Read | R+U | Full | Read |
| MANAGER | Full | Full | R+C+U | Read | R+U | R+C+U | Read |
| SERVICE_ADVISOR | R+C+U | R+C+U | Read | — | — | — | — |
| TECHNICIAN | Read | R+U | Read | — | — | — | — |
| ACCOUNTANT | Read | Read | Read | Read | — | — | Read |

### Multi-tenancy

Every database row is scoped to an `organizationId`.
`requireOrg()` in `src/lib/org.ts` validates the session and returns
`{ orgId, userId, memberRole }` — called at the top of every server page and action.

---

## Scripts

```bash
npm run dev          # start development server
npm run build        # production build
npm run start        # start production server
npm run typecheck    # TypeScript check (no emit)
npm run lint         # ESLint
npm run db:push      # sync schema to database
npm run db:migrate   # create + run migration
npm run db:studio    # open Prisma Studio
npm run db:seed      # seed demo data
npm run db:reset     # force-reset database
```

---

## Deployment

See **[docs/deployment.md](docs/deployment.md)** for full instructions.

**Quick deploy to Vercel:**

1. Push to GitHub
2. Import in Vercel dashboard
3. Add environment variables (see `.env.example`)
4. Set build command: `npx prisma generate && next build`
5. Deploy

---

## Environment Variables

See **[docs/environment.md](docs/environment.md)** for the full reference.

Minimum required:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — random secret (≥ 32 chars): `openssl rand -base64 32`
- `NEXTAUTH_URL` — public app URL

---

## License

Private — all rights reserved.
