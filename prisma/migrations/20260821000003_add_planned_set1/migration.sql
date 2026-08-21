-- Set 1 chuẩn bị trước cho từng chuyển động trong giáo án. Cùng một Set 1 với
-- nhật ký tập luyện, chỉ khác thời điểm nhập — hai bên được đồng bộ chéo.
ALTER TABLE "workout_movements" ADD COLUMN "plannedLoad" TEXT;
ALTER TABLE "workout_movements" ADD COLUMN "plannedReps" TEXT;
