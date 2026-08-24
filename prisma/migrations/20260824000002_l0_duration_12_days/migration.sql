-- Gói trải nghiệm L0 chốt lại hạn 12 ngày (trước đó 30 ngày, rồi 7 ngày).
--
-- durationDays được chép cứng vào từng bản ghi lúc tạo gói, nên sửa hằng số
-- trong lib/packages.ts chỉ áp cho gói tạo mới. Migration này sửa nốt các gói
-- L0 đã tồn tại và tính lại endDate theo đúng công thức của app:
--     endDate = startDate + durationDays + reservedDays + extensionDays

UPDATE "package_enrollments"
SET "durationDays" = 12,
    "endDate" = CASE
      WHEN "startDate" IS NOT NULL
        THEN "startDate" + ((12 + "reservedDays" + "extensionDays") * INTERVAL '1 day')
      ELSE NULL
    END
WHERE "packageName" = 'L0'
  AND "durationDays" <> 12;

-- Gói L0 được đề xuất trong các phiên tư vấn cũ.
UPDATE "consultation_packages"
SET "durationDays" = 12
WHERE "packageName" = 'L0'
  AND "durationDays" <> 12;
