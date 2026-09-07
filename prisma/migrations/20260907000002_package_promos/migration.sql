-- Đợt trợ giá riêng của từng cơ sở, có ngày hết hạn. Trước đây đợt presale của
-- Trần Duy Hưng nằm cứng trong code; nay Admin tự thêm/sửa được ở màn Cài đặt.

CREATE TABLE "package_promos" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_promos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "package_promo_items" (
    "id" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "package_promo_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "package_promo_items_promoId_packageName_key"
    ON "package_promo_items"("promoId", "packageName");

ALTER TABLE "package_promos"
    ADD CONSTRAINT "package_promos_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_promo_items"
    ADD CONSTRAINT "package_promo_items_promoId_fkey"
    FOREIGN KEY ("promoId") REFERENCES "package_promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chuyển đợt presale đang chạy của Trần Duy Hưng từ code vào bảng, để nó không
-- biến mất khi bảng giá chuyển sang đọc từ DB.
-- L3 25.000.000 → 17.500.000 · L4 45.000.000 → 31.500.000 (đúng −30%),
-- từ 01/09/2026 đến hết 30/09/2026 giờ Việt Nam (UTC+7).
INSERT INTO "package_promos" ("id", "name", "shortLabel", "branchId", "startsAt", "endsAt", "isActive", "createdAt", "updatedAt")
SELECT
    'promo_presale_tdh_092026',
    'Presale trợ giá 30% — Ladysfit Trần Duy Hưng',
    'Presale −30%',
    b."id",
    TIMESTAMP '2026-08-31 17:00:00',
    TIMESTAMP '2026-09-30 16:59:59.999',
    true,
    NOW(),
    NOW()
FROM "branches" b
WHERE b."name" = 'Ladysfit Trần Duy Hưng';

INSERT INTO "package_promo_items" ("id", "promoId", "packageName", "price")
SELECT 'promo_presale_tdh_092026_l3', 'promo_presale_tdh_092026', 'L3', 17500000
WHERE EXISTS (SELECT 1 FROM "package_promos" WHERE "id" = 'promo_presale_tdh_092026');

INSERT INTO "package_promo_items" ("id", "promoId", "packageName", "price")
SELECT 'promo_presale_tdh_092026_l4', 'promo_presale_tdh_092026', 'L4', 31500000
WHERE EXISTS (SELECT 1 FROM "package_promos" WHERE "id" = 'promo_presale_tdh_092026');
