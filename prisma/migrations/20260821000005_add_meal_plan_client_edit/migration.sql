-- Lần gần nhất khách tự sửa thực đơn ở cổng /my (chỉ đổi món, không đổi mốc calo).
ALTER TABLE "meal_plans" ADD COLUMN "clientEditedAt" TIMESTAMP(3);
