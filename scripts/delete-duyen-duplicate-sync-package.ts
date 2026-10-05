/**
 * Xoá lộ trình L2 TRÙNG của khách Nguyễn Thị Duyên (PT Vũ Mai Ly).
 *
 * Bối cảnh: hợp đồng L2 HDLDF20260353 bắt đầu 12/09/2026 được tạo tay ở hồ sơ
 * khách. Ngày 26/09 FM nhập lead của chính hợp đồng đó (L2, nguồn Referral — LDF
 * Ninh Bình; đây là lead duy nhất của số điện thoại này) ở Setup doanh số, và lead
 * tự đồng bộ tạo thêm một gói L2 "SYNC-…" bắt đầu 26/09, không có ngày hết hạn.
 * Gói thừa này 0 buổi, không buổi tập nào trỏ vào, nên phiếu check-in của nó trống
 * trơn. Lỗi tạo trùng đã sửa ở lib/sync-lead-to-client.ts.
 *
 * Xoá đi qua Thùng rác như nút xoá gói ở hồ sơ khách (khôi phục được), rồi đếm lại
 * số hợp đồng của khách.
 *
 * Chạy: TS_NODE_BASEURL=. npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/delete-duyen-duplicate-sync-package.ts [--apply]
 */
import { prisma } from "@/lib/prisma";
import { captureTrash } from "@/lib/trash";
import { recountClientContracts } from "@/lib/recount-contracts";

const APPLY = process.argv.includes("--apply");
const CLIENT_ID = "cmtwrcd6a00107x51b05a22fn";
const DUP_ID    = "cmuhwonfe0002tmmpq3abdb03";

async function main() {
  const pkg = await prisma.packageEnrollment.findUnique({ where: { id: DUP_ID } });
  if (!pkg) { console.log("Gói đã được xoá — bỏ qua."); return; }
  const logs = await prisma.workoutLog.count({ where: { packageEnrollmentId: DUP_ID } });
  console.log(`${pkg.packageName} ${pkg.contractCode} bắt đầu ${pkg.startDate?.toISOString().slice(0, 10)} — ${pkg.sessionsUsed} buổi, ${logs} buổi tập trỏ vào`);
  if (pkg.clientId !== CLIENT_ID || !pkg.contractCode?.startsWith("SYNC-") || pkg.sessionsUsed !== 0 || logs !== 0) {
    console.log("Gói không còn đúng tình trạng gói thừa — dừng.");
    return;
  }
  if (!APPLY) { console.log("Chạy thử. Thêm --apply để xoá."); return; }

  await captureTrash("PACKAGE_ENROLLMENT", DUP_ID, { name: "Dọn gói trùng do lead tự tạo", role: "ADMIN" });
  await prisma.packageEnrollment.delete({ where: { id: DUP_ID } });
  await recountClientContracts(CLIENT_ID);
  console.log("Đã xoá.");
}

main().finally(() => prisma.$disconnect());
