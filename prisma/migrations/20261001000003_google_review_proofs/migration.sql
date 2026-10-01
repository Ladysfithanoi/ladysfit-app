-- Ảnh đánh giá Google Business — nguồn của thưởng Google cho FM.
CREATE TABLE IF NOT EXISTS "google_review_proofs" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "customerName" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "google_review_proofs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "google_review_proofs_branchId_year_month_idx" ON "google_review_proofs"("branchId", "year", "month");
