# GarageOS — מערכת ניהול מוסך

A full-stack garage management system built with Next.js 14, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. Hebrew RTL UI.

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Framework  | Next.js 14 (App Router)           |
| Language   | TypeScript                        |
| Styling    | Tailwind CSS + Rubik font (Hebrew)|
| Auth       | NextAuth.js v4 (Credentials)      |
| ORM        | Prisma 5                          |
| Database   | PostgreSQL                        |

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **PostgreSQL** — running locally or via Docker

## Quick start

### 1. Install Node.js (Windows)

```powershell
winget install OpenJS.NodeJS
```

Restart your terminal, then verify:

```powershell
node -v   # v18+
npm -v
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/garagedb"
NEXTAUTH_SECRET="any-random-string-at-least-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Set up the database

```bash
# Push schema to database (creates tables)
npm run db:push

# Seed initial admin user
npm run db:seed
```

Default admin credentials after seed:
- Email: `admin@garage.com`
- Password: `admin123`

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to login → dashboard.

---

## PostgreSQL via Docker (optional)

If you don't have PostgreSQL installed locally:

```bash
docker run --name garagedb \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=garagedb \
  -p 5432:5432 \
  -d postgres:16
```

Then use:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/garagedb"
```

---

## Database management

```bash
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:migrate   # Run migrations (production workflow)
npm run db:push      # Push schema changes directly (dev only)
```

---

## Project structure

```
garage-app/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Initial data (admin user)
├── src/
│   ├── app/
│   │   ├── layout.tsx     # Root layout — Hebrew RTL, Rubik font
│   │   ├── providers.tsx  # SessionProvider wrapper
│   │   ├── globals.css    # CSS variables + Tailwind base
│   │   ├── login/
│   │   │   └── page.tsx   # Login page
│   │   ├── dashboard/
│   │   │   ├── layout.tsx # Dashboard shell (auth guard + sidebar)
│   │   │   └── page.tsx   # Dashboard home
│   │   └── api/auth/      # NextAuth route handler
│   ├── components/
│   │   ├── Sidebar.tsx    # RTL sidebar with nav items
│   │   └── TopBar.tsx     # Top bar with user avatar
│   ├── lib/
│   │   ├── auth.ts        # NextAuth config (Credentials provider)
│   │   └── prisma.ts      # Prisma client singleton
│   ├── types/
│   │   └── next-auth.d.ts # Session type augmentation
│   └── middleware.ts      # Protects /dashboard routes
├── .env.example
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## Hebrew RTL notes

- `<html lang="he" dir="rtl">` is set in `src/app/layout.tsx`
- Sidebar is positioned on the **right** side using Tailwind logical properties (`start-0`, `border-e`)
- Main content uses `ms-[220px]` (margin-inline-start = margin-right in RTL)
- Font: **Rubik** (Google Fonts) — designed for Hebrew and Latin
- Use `ms-`, `me-`, `ps-`, `pe-` Tailwind classes instead of `ml-`, `mr-` to keep RTL-aware spacing
