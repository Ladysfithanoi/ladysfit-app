import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Dữ liệu của PHIẾU CHECK-IN BUỔI TẬP — bản số của tờ phụ lục hợp đồng ký tay.
 *
 * Chỉ trả DỮ LIỆU; phiếu được vẽ ở trình duyệt rồi tải xuống dạng ảnh (xem
 * components/dashboard/checkin-sheet-modal.tsx). Vẽ ở client vì thứ cần lưu vào
 * hồ sơ lương là một tấm ảnh, và vẽ bằng canvas thì cái nhìn thấy trên màn hình
 * với cái tải về là CÙNG MỘT bản vẽ — không có chuyện xem một đằng tải một nẻo.
 *
 * Mỗi dòng là một buổi ĐÃ CHECK-OUT: chỉ những buổi đó mới là buổi dạy có thật.
 */

/** Đúng tờ giấy: 2 khối × 25 dòng = 50 buổi. */
const TOTAL_ROWS = 50;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FM", "COO", "PT"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollmentId = new URL(req.url).searchParams.get("enrollmentId");
  if (!enrollmentId) {
    return NextResponse.json({ error: "Thiếu lộ trình cần xuất phiếu" }, { status: 400 });
  }

  const enrollment = await prisma.packageEnrollment.findFirst({
    where: { id: enrollmentId, clientId: params.id },
    include: {
      client: { select: { fullName: true, assignedPT: { select: { name: true, email: true } } } },
    },
  });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy lộ trình" }, { status: 404 });

  const logs = await prisma.workoutLog.findMany({
    where: { clientId: params.id, packageEnrollmentId: enrollmentId, checkOutAt: { not: null } },
    orderBy: { sessionDate: "asc" },
    select: { sessionDate: true, checkOutAt: true, signatureUrl: true, checkOutPhotoUrl: true },
    take: TOTAL_ROWS,
  });

  return NextResponse.json({
    contractCode: enrollment.contractCode,
    clientName: enrollment.client.fullName,
    ptName: enrollment.client.assignedPT?.name ?? enrollment.client.assignedPT?.email ?? "",
    packageName: enrollment.packageName,
    totalSessions: enrollment.sessions,
    startDate: enrollment.startDate?.toISOString() ?? null,
    endDate: enrollment.endDate?.toISOString() ?? null,
    price: enrollment.price,
    rows: logs.map((l) => ({
      date: l.sessionDate.toISOString(),
      checkOutAt: l.checkOutAt?.toISOString() ?? null,
      signatureUrl: l.signatureUrl,
      photoUrl: l.checkOutPhotoUrl,
    })),
  });
}
