import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { pickChargeablePackage } from "@/lib/checkin-eligibility";
import { loadCheckinSheet } from "@/lib/checkin-sheet-data";
import { EMPTY_OVERRIDE } from "@/lib/checkin-sheet";

// Phiếu check-in của gói khách ĐANG TẬP, cho nút "Số buổi tập" ở trang Tổng quan.
//
// "Gói đang tập" là gói buổi tập tới sẽ bị trừ (pickChargeablePackage — cùng luật
// với lúc check-in). Hết gói trừ được (vừa tập buổi cuối, hết hạn, bảo lưu) thì
// lấy gói bắt đầu gần nhất, để khách vẫn xem được phiếu vừa tập xong.
//
// Chỉ xem: không trả phần sửa tay hay danh sách HLV — đó là đồ nghề nội bộ.
export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = session.user.id;
  const packages = await prisma.packageEnrollment.findMany({
    where: { clientId },
    select: {
      id: true, status: true, sessions: true, sessionsUsed: true,
      startDate: true, endDate: true, createdAt: true, packageName: true,
    },
    orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });

  // Hoà (cùng bậc, cùng ngày bắt đầu) thì luôn lấy gói đầu, để mỗi lần mở là cùng một phiếu.
  const current = pickChargeablePackage(packages, new Date(), () => 0)
    ?? packages.find((p) => p.startDate != null)
    ?? packages[0];
  if (!current) {
    return NextResponse.json({ error: "Bạn chưa có gói tập nào" }, { status: 404 });
  }

  const sheet = await loadCheckinSheet(clientId, current.id);
  if (!sheet) return NextResponse.json({ error: "Không tìm thấy gói tập" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { original, ...shown } = sheet;
  return NextResponse.json({
    ...shown,
    override: EMPTY_OVERRIDE,
    canEdit: false,
    teachers: [],
  });
}
