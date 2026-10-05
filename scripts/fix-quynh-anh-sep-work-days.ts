/**
 * Trả lại ngày công tháng 9/2026 của Đỗ Quỳnh Anh.
 *
 * Bảng lương ghi 24/26 công, "đã trừ 1 ngày theo lịch nghỉ", trong khi lịch nghỉ
 * tháng 9 của Quỳnh Anh không có ngày nào. Đây là lỗi lưu dòng lương ghép số ngày
 * công đang hiện trên màn hình (đã cũ) với số ngày nghỉ mới của lịch — đã sửa ở
 * PUT /api/salary/records/[id] (applyLeaveChange). Đưa về đủ công rồi tính lại
 * lương bằng chính công thức của bảng lương (recalcSalary).
 *
 * Chạy: TS_NODE_BASEURL=. npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/fix-quynh-anh-sep-work-days.ts [--apply]
 */
import { prisma } from "@/lib/prisma";
import { recalcSalary, salaryUpdateData } from "@/lib/salary-live";
import { sumWorkDayDeductionByUser } from "@/lib/leave-days";

const APPLY = process.argv.includes("--apply");
const RECORD_ID = "cmuqpov17000iaps97iv8rhe0";

async function main() {
  const rec = await prisma.salaryRecord.findUniqueOrThrow({ where: { id: RECORD_ID }, include: { user: { select: { name: true, role: true } } } });
  const leave = (await sumWorkDayDeductionByUser([rec.userId], rec.month, rec.year))[rec.userId] ?? 0;
  console.log(`${rec.user.name} ${rec.month}/${rec.year}: ${rec.actualWorkDays}/${rec.standardWorkDays} công, đã trừ ${rec.leaveDays}, lịch nghỉ ${leave}, lương ${rec.totalSalary}`);
  if (leave !== 0 || rec.status !== "PENDING") { console.log("Tình trạng đã khác — dừng."); return; }
  if (!APPLY) { console.log("Chạy thử. Thêm --apply để ghi."); return; }

  const fixed = await prisma.salaryRecord.update({
    where: { id: RECORD_ID },
    data: { actualWorkDays: rec.standardWorkDays, leaveDays: 0 },
    include: { user: { select: { name: true, role: true } } },
  });
  const { patch, changed } = await recalcSalary({ record: fixed, role: fixed.user.role, month: fixed.month, year: fixed.year });
  const after = changed
    ? await prisma.salaryRecord.update({ where: { id: RECORD_ID }, data: salaryUpdateData(patch) })
    : fixed;
  console.log(`→ ${after.actualWorkDays}/${after.standardWorkDays} công, lương ${after.totalSalary}`);
}

main().finally(() => prisma.$disconnect());
