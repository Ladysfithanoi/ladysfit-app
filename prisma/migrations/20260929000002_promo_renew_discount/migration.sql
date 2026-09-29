-- % trợ giá tái ký theo đợt trợ giá của cơ sở (NULL = dùng mặc định 10%).
ALTER TABLE "package_promos" ADD COLUMN IF NOT EXISTS "renewDiscountPct" DOUBLE PRECISION;
