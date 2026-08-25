-- Thùng rác: ảnh chụp dữ liệu PT/FM/Admin đã xóa, để Admin khôi phục hoặc dọn sạch.
CREATE TABLE "trash_items" (
    "id"            TEXT NOT NULL,
    "entityType"    TEXT NOT NULL,
    "entityId"      TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "summary"       TEXT,
    "payload"       TEXT NOT NULL,
    "branchId"      TEXT,
    "branchName"    TEXT,
    "deletedById"   TEXT,
    "deletedByName" TEXT,
    "deletedByRole" TEXT,
    "deletedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trash_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trash_items_entityType_idx" ON "trash_items"("entityType");
CREATE INDEX "trash_items_deletedAt_idx"  ON "trash_items"("deletedAt");

-- Số ngày giữ dữ liệu trong thùng rác trước khi tự dọn (0 = giữ mãi).
ALTER TABLE "system_config"
    ADD COLUMN "trashRetentionDays" INTEGER NOT NULL DEFAULT 30;
