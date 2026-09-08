-- ============================================================
-- GarageOS Pilot Portal Migration
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (IF NOT EXISTS throughout).
-- Does NOT touch any NESHER / Hanesher data.
-- ============================================================

-- 1. New enum value (idempotent) --------------------------------
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVITE_SENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. CustomerOtp -----------------------------------------------
CREATE TABLE IF NOT EXISTS "CustomerOtp" (
    "id"        TEXT         NOT NULL,
    "phone"     TEXT         NOT NULL,
    "codeHash"  TEXT         NOT NULL,
    "attempts"  INTEGER      NOT NULL DEFAULT 0,
    "lockedAt"  TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomerOtp_phone_idx" ON "CustomerOtp"("phone");

-- 3. CustomerMagicLink -----------------------------------------
CREATE TABLE IF NOT EXISTS "CustomerMagicLink" (
    "id"         TEXT         NOT NULL,
    "token"      TEXT         NOT NULL,
    "email"      TEXT         NOT NULL,
    "customerId" TEXT         NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "usedAt"     TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerMagicLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerMagicLink_token_key"      ON "CustomerMagicLink"("token");
CREATE        INDEX IF NOT EXISTS "CustomerMagicLink_token_idx"      ON "CustomerMagicLink"("token");
CREATE        INDEX IF NOT EXISTS "CustomerMagicLink_customerId_idx" ON "CustomerMagicLink"("customerId");
DO $$ BEGIN
  ALTER TABLE "CustomerMagicLink"
    ADD CONSTRAINT "CustomerMagicLink_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. CustomerSession -------------------------------------------
CREATE TABLE IF NOT EXISTS "CustomerSession" (
    "id"           TEXT         NOT NULL,
    "token"        TEXT         NOT NULL,
    "customerId"   TEXT         NOT NULL,
    "ip"           TEXT,
    "userAgent"    TEXT,
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSession_token_key"       ON "CustomerSession"("token");
CREATE        INDEX IF NOT EXISTS "CustomerSession_token_idx"       ON "CustomerSession"("token");
CREATE        INDEX IF NOT EXISTS "CustomerSession_customerId_idx"  ON "CustomerSession"("customerId");
DO $$ BEGIN
  ALTER TABLE "CustomerSession"
    ADD CONSTRAINT "CustomerSession_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. CustomerPreviewToken --------------------------------------
CREATE TABLE IF NOT EXISTS "CustomerPreviewToken" (
    "id"             TEXT         NOT NULL,
    "token"          TEXT         NOT NULL,
    "customerId"     TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "createdById"    TEXT         NOT NULL,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "viewedAt"       TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerPreviewToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPreviewToken_token_key"      ON "CustomerPreviewToken"("token");
CREATE        INDEX IF NOT EXISTS "CustomerPreviewToken_token_idx"      ON "CustomerPreviewToken"("token");
CREATE        INDEX IF NOT EXISTS "CustomerPreviewToken_customerId_idx" ON "CustomerPreviewToken"("customerId");
DO $$ BEGIN
  ALTER TABLE "CustomerPreviewToken"
    ADD CONSTRAINT "CustomerPreviewToken_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. CustomerPilot — new checklist columns ---------------------
ALTER TABLE "CustomerPilot"
  ADD COLUMN IF NOT EXISTS "phoneVerified"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vehiclesVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "historyVerified"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "loggedIn"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quoteTested"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "apptTested"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "feedbackReceived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "checklistNotes"   TEXT;

-- 7. ServiceBooking --------------------------------------------
CREATE TABLE IF NOT EXISTS "ServiceBooking" (
    "id"             TEXT         NOT NULL,
    "organizationId" TEXT         NOT NULL,
    "customerId"     TEXT         NOT NULL,
    "vehicleId"      TEXT         NOT NULL,
    "serviceType"    TEXT         NOT NULL,
    "complaint"      TEXT,
    "mileage"        INTEGER,
    "status"         TEXT         NOT NULL DEFAULT 'PENDING',
    "notes"          TEXT,
    "quoteId"        TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ServiceBooking_organizationId_idx"        ON "ServiceBooking"("organizationId");
CREATE INDEX IF NOT EXISTS "ServiceBooking_customerId_idx"            ON "ServiceBooking"("customerId");
CREATE INDEX IF NOT EXISTS "ServiceBooking_organizationId_status_idx" ON "ServiceBooking"("organizationId","status");
DO $$ BEGIN
  ALTER TABLE "ServiceBooking"
    ADD CONSTRAINT "ServiceBooking_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceBooking"
    ADD CONSTRAINT "ServiceBooking_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ServiceBooking"
    ADD CONSTRAINT "ServiceBooking_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Appointment -----------------------------------------------
CREATE TABLE IF NOT EXISTS "Appointment" (
    "id"              TEXT         NOT NULL,
    "organizationId"  TEXT         NOT NULL,
    "customerId"      TEXT         NOT NULL,
    "vehicleId"       TEXT,
    "bookingId"       TEXT,
    "scheduledAt"     TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER      NOT NULL DEFAULT 60,
    "status"          TEXT         NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_idx"             ON "Appointment"("organizationId");
CREATE INDEX IF NOT EXISTS "Appointment_customerId_idx"                 ON "Appointment"("customerId");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_scheduledAt_idx" ON "Appointment"("organizationId","scheduledAt");
DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Verify all tables exist -----------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'CustomerOtp','CustomerMagicLink','CustomerSession',
    'CustomerPreviewToken','CustomerPilot',
    'ServiceBooking','Appointment'
  )
ORDER BY table_name;
