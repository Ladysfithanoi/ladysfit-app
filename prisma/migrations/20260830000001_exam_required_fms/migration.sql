-- FM bắt buộc thi. Admin chỉ định trong tab Lịch thi của trang Đề thi: FM có
-- tên ở đây vào thi được như HLV và Admin xem được điểm, nhưng chỉ để nắm
-- trình độ — thi trượt không bị hạ cấp, không sinh thông báo thăng cấp.
-- Mỗi FM chỉ có một dòng; bỏ dòng đi là hết bắt buộc.
CREATE TABLE "exam_required_fms" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_required_fms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_required_fms_userId_key" ON "exam_required_fms"("userId");

ALTER TABLE "exam_required_fms"
    ADD CONSTRAINT "exam_required_fms_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
