-- Admin làm ở nhiều cơ sở có một bảng lương ở mỗi cơ sở trong cùng tháng.
DROP INDEX IF EXISTS "salary_records_userId_month_year_key";
CREATE UNIQUE INDEX "salary_records_userId_branchId_month_year_key" ON "salary_records"("userId", "branchId", "month", "year");
