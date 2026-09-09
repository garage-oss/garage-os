import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_RESET_SECRET
  if (!secret || req.headers.get('x-reset-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results: string[] = []

  try {
    // 1. DocumentType enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "DocumentType" AS ENUM (
          'VEHICLE_LICENSE','MANDATORY_INSURANCE','DRIVER_LICENSE',
          'COMPREHENSIVE_INSURANCE','POWER_OF_ATTORNEY','OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('DocumentType enum: ok')

    // 2. ExtractionStatus enum
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING','COMPLETED','FAILED','MANUAL');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('ExtractionStatus enum: ok')

    // 3. AuditAction DOCUMENT_* values
    for (const v of ['DOCUMENT_UPLOADED','DOCUMENT_VIEWED','DOCUMENT_DOWNLOADED','DOCUMENT_DELETED','DOCUMENT_VERIFIED','DOCUMENT_REPLACED']) {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS '${v}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `)
    }
    results.push('AuditAction DOCUMENT_* values: ok')

    // 4. VehicleDocument table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VehicleDocument" (
        "id"               TEXT          NOT NULL,
        "organizationId"   TEXT          NOT NULL,
        "customerId"       TEXT          NOT NULL,
        "vehicleId"        TEXT          NOT NULL,
        "documentType"     "DocumentType" NOT NULL,
        "storagePath"      TEXT          NOT NULL,
        "originalFileName" TEXT          NOT NULL,
        "mimeType"         TEXT          NOT NULL,
        "fileSize"         INTEGER       NOT NULL,
        "issueDate"        TIMESTAMP(3),
        "expiryDate"       TIMESTAMP(3),
        "extractedData"    JSONB,
        "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
        "verifiedAt"       TIMESTAMP(3),
        "verifiedByUserId" TEXT,
        "verificationNote" TEXT,
        "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
      );
    `)
    results.push('VehicleDocument table: ok')

    // 5. Indexes for VehicleDocument
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VehicleDocument_organizationId_idx" ON "VehicleDocument"("organizationId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VehicleDocument_customerId_idx" ON "VehicleDocument"("customerId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VehicleDocument_vehicleId_idx" ON "VehicleDocument"("vehicleId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VehicleDocument_vehicleId_documentType_idx" ON "VehicleDocument"("vehicleId","documentType")`)
    results.push('VehicleDocument indexes: ok')

    // 6. Foreign keys for VehicleDocument
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_customerId_fkey"
          FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey"
          FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('VehicleDocument foreign keys: ok')

    // 7. DocumentReminderPreference table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentReminderPreference" (
        "id"           TEXT         NOT NULL,
        "customerId"   TEXT         NOT NULL,
        "vehicleId"    TEXT         NOT NULL,
        "reminderType" TEXT         NOT NULL,
        "enabled"      BOOLEAN      NOT NULL DEFAULT true,
        "snoozedUntil" TIMESTAMP(3),
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocumentReminderPreference_pkey" PRIMARY KEY ("id")
      );
    `)
    results.push('DocumentReminderPreference table: ok')

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "DocumentReminderPreference_customerId_vehicleId_reminderType_key" ON "DocumentReminderPreference"("customerId","vehicleId","reminderType")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentReminderPreference_customerId_idx" ON "DocumentReminderPreference"("customerId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DocumentReminderPreference_vehicleId_idx" ON "DocumentReminderPreference"("vehicleId")`)

    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "DocumentReminderPreference" ADD CONSTRAINT "DocumentReminderPreference_customerId_fkey"
          FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "DocumentReminderPreference" ADD CONSTRAINT "DocumentReminderPreference_vehicleId_fkey"
          FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    results.push('DocumentReminderPreference: ok')

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), results }, { status: 500 })
  }
}
