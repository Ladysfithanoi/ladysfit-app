-- Nhật ký "khách thuộc về ai, từ lúc nào". Mỗi dòng mở một chặng phụ trách;
-- chặng kết thúc khi có dòng kế tiếp. Dùng để quy transform về đúng người đã
-- kèm khách đủ lâu, thay vì mặc định ghi công cho người đang giữ khách.
CREATE TABLE "client_pt_assignments" (
    "id"        TEXT NOT NULL,
    "clientId"  TEXT NOT NULL,
    "ptId"      TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason"    TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_pt_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_pt_assignments_clientId_startedAt_idx"
    ON "client_pt_assignments"("clientId", "startedAt");

ALTER TABLE "client_pt_assignments"
    ADD CONSTRAINT "client_pt_assignments_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_pt_assignments"
    ADD CONSTRAINT "client_pt_assignments_ptId_fkey"
    FOREIGN KEY ("ptId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Dựng lại lịch sử từ dữ liệu đang có ─────────────────────────────────────
-- 1) Chặng đầu tiên = ngày tạo hồ sơ khách, người phụ trách = người đang giữ
--    khách. CHỈ áp cho khách CHƯA từng bị chuyển giao dài hạn — khách đã từng
--    chuyển thì người phụ trách ban đầu không còn dấu vết nào để suy ra, để
--    trống còn hơn ghi công nhầm.
INSERT INTO "client_pt_assignments" ("id", "clientId", "ptId", "startedAt", "reason", "createdAt")
SELECT gen_random_uuid()::text, c."id", c."assignedPTId", c."createdAt", 'BACKFILL', CURRENT_TIMESTAMP
FROM "clients" c
WHERE NOT EXISTS (
    SELECT 1 FROM "substitute_requests" sr
    WHERE sr."clientId" = c."id" AND sr."type" = 'LONG_TERM'
);

-- 2) Mỗi lần chuyển giao dài hạn mở một chặng mới cho người nhận. Tính cả bản
--    ghi CANCELLED: lúc tạo yêu cầu mới, yêu cầu đang ACTIVE bị chuyển thành
--    CANCELLED, nhưng lần chuyển khách đó vẫn đã thực sự xảy ra.
INSERT INTO "client_pt_assignments" ("id", "clientId", "ptId", "startedAt", "reason", "createdAt")
SELECT gen_random_uuid()::text, sr."clientId", sr."substituteId", sr."createdAt", 'BACKFILL', CURRENT_TIMESTAMP
FROM "substitute_requests" sr
JOIN "clients" c ON c."id" = sr."clientId"
JOIN "users" u ON u."id" = sr."substituteId"
WHERE sr."type" = 'LONG_TERM';
