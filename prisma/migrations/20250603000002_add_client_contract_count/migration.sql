-- AlterTable
ALTER TABLE "clients" ADD COLUMN "contractCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from the actual number of registered contracts (lộ trình) per client.
UPDATE "clients" c
SET "contractCount" = (
  SELECT COUNT(*) FROM "package_enrollments" pe WHERE pe."clientId" = c.id
);
