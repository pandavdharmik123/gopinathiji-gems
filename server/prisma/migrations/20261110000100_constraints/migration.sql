-- Database-level invariants that the Prisma schema cannot express.
-- Safe to run repeatedly: every statement is guarded by an existence check.
--
-- This migration mirrors prisma/sql/constraints.sql. Keep the two in sync when
-- adding new invariants.

-- Money must be positive. The API also validates this, but direct writes
-- (imports, psql, future services) must not be able to create bad rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);
  END IF;
END $$;

-- An accounting year must end after it starts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounting_years_date_order'
  ) THEN
    ALTER TABLE "accounting_years"
      ADD CONSTRAINT accounting_years_date_order CHECK ("endDate" > "startDate");
  END IF;
END $$;

-- At most one accounting year may be active at any time.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_accounting_year
  ON "accounting_years" (status)
  WHERE status = 'active';

-- Accounting years must not overlap. This keeps reporting windows unambiguous.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounting_years_no_overlap'
  ) THEN
    ALTER TABLE "accounting_years"
      ADD CONSTRAINT accounting_years_no_overlap
      EXCLUDE USING gist (daterange("startDate"::date, "endDate"::date, '[]') WITH &&);
  END IF;
END $$;
