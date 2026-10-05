/**
 * Sửa hậu quả chuyển PT Trần Duy Nam từ Mỹ Đình sang Trần Duy Hưng (tháng 10/2026).
 *
 * Lúc chuyển, "Ngày bắt đầu làm việc" bị sửa thành 01/10/2026. Đó là ngày vào CÔNG
 * TY nên mọi tháng trước bị coi là chưa đi làm: bảng lương tháng 9 ở Mỹ Đình tụt về
 * 0/26 công (chỉ còn tiền buổi dạy). Nam vào làm từ 13/06/2026 — ngày tạo tài khoản
 * (mặc định của ô này), buổi dạy đầu tiên 18/06, có ngày nghỉ từ tháng 8.
 *
 * Bảng lương tháng 10 được tạo ở Mỹ Đình ngày 03/10, trước khi chuyển; từ tháng 10
 * Nam dạy ở Trần Duy Hưng nên dòng đó chuyển sang Trần Duy Hưng (FM Trần Duy Hưng
 * mới thấy, và doanh số tính theo đúng cơ sở).
 *
 * Việc tái phát đã chặn ở PUT /api/staff/[id] (firstWorkDayOf).
 *
 * Chạy: TS_NODE_BASEURL=. npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/fix-tran-duy-nam-transfer.ts [--apply]
 */
import { prisma } from "@/lib/prisma";
import { recalcSalary, salaryUpdateData } from "@/lib/salary-live";

const APPLY = process.argv.includes("--apply");
const NAM_ID   = "cmqbosgtc000112i5xlflnfmf";
const START    = new Date("2026-06-13T00:00:00.000Z");
const TDH      = "branch-tran-duy-hung";
const OCT_ID   = "cmus28n620005n0p34r0bxadg";
const SEP_ID   = "cmus28s6e000jn0p3ri5rfnrb";

async function main() {
  const nam = await prisma.user.findUniqueOrThrow({ where: { id: NAM_ID }, select: { name: true, employmentStartDate: true, branchId: true } });
  const oct = await prisma.salaryRecord.findUniqueOrThrow({ where: { id: OCT_ID } });
  console.log(`${nam.name}: vào làm ${nam.employmentStartDate?.toISOString().slice(0, 10)} → 2026-06-13; cơ sở hiện tại ${nam.branchId}`);
  console.log(`Lương T10: cơ sở ${oct.branchId} → ${TDH} (${oct.status})`);
  if (nam.branchId !== TDH || oct.userId !== NAM_ID || oct.status !== "PENDING") { console.log("Tình trạng đã khác — dừng."); return; }
  if (!APPLY) { console.log("Chạy thử. Thêm --apply để ghi."); return; }

  await prisma.user.update({ where: { id: NAM_ID }, data: { employmentStartDate: START } });
  await prisma.salaryRecord.update({ where: { id: OCT_ID }, data: { branchId: TDH } });

  for (const id of [SEP_ID, OCT_ID]) {
    const rec = await prisma.salaryRecord.findUniqueOrThrow({ where: { id }, include: { user: { select: { role: true } } } });
    const before = `${rec.actualWorkDays}/${rec.standardWorkDays} công, ${Math.round(rec.totalSalary)}đ`;
    const { patch, changed } = await recalcSalary({ record: rec, role: rec.user.role, month: rec.month, year: rec.year });
    const after = changed ? await prisma.salaryRecord.update({ where: { id }, data: salaryUpdateData(patch) }) : rec;
    console.log(`T${rec.month}: ${before} → ${after.actualWorkDays}/${after.standardWorkDays} công, ${Math.round(after.totalSalary)}đ`);
  }
}

main().finally(() => prisma.$disconnect());
