-- Tables and enums introduced after the original schema was deployed.
--
-- Existing production databases were created with `prisma db push` from the
-- older schema and do not contain these objects. This migration is written
-- idempotently so it is also safe on databases that were already pushed with
-- a newer schema.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BackupStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BackupTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'CLI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "backup_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "BackupStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" "BackupTrigger" NOT NULL DEFAULT 'MANUAL',
    "fileSizeBytes" BIGINT,
    "checksumSha256" TEXT,
    "driveFileId" TEXT,
    "driveFileName" TEXT,
    "driveFolderId" TEXT,
    "accountEmail" TEXT,
    "encryptionUsed" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "voucher_counters" (
    "type" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "voucher_counters_pkey" PRIMARY KEY ("type")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "backup_runs_startedAt_idx" ON "backup_runs"("startedAt");
