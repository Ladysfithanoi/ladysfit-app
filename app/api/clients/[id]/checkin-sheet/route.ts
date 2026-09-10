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

/** Ngày theo đúng phần ngày của chuỗi ISO — cùng cách phiếu in ra cột "Ngày",
 *  nên số cân không bao giờ rơi lệch một ngày so với dòng nó đứng cạnh. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Cân nặng đi kèm một buổi tập.
 *
 * Ưu tiên số cân đo ĐÚNG ngày tập. Không có thì lấy lần cân gần nhất TRƯỚC đó —
 * đó vẫn là cân nặng đang biết của khách tại buổi ấy — và đánh dấu `measured:
 * false` để phiếu in nhạt đi, người đọc phân biệt được số đo thật với số mang
 * theo. Chưa từng cân trước ngày đó thì để trống, không bịa.
 */
function weightFor(
  day: string,
  logs: { date: Date; weight: number }[]
): { weight: number | null; measured: boolean } {
  let sameDay: number | null = null;
  let carried: number | null = null;
  for (const l of logs) {
    const k = ymd(l.date);
    if (k > day) break;
    // Cân nhiều lần trong ngày thì lần ghi sau đè lần trước (logs xếp tăng dần).
    if (k === day) sameDay = l.weight;
    else carried = l.weight;
  }
  if (sameDay != null) return { weight: sameDay, measured: true };
  return { weight: carried, measured: false };
}

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
      client: {
        select: {
          fullName: true,
          branchId: true,
          assignedPT: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy lộ trình" }, { status: 404 });

  // "Đại diện trung tâm" là FM của cơ sở khách đang tập. Cơ sở có nhiều FM thì
  // lấy người được gán sớm nhất — người phụ trách chính, và là con số ổn định
  // qua mọi lần xuất phiếu.
  const fm = await prisma.fMBranchAssignment.findFirst({
    where: { branchId: enrollment.client.branchId, user: { role: "FM", deletedAt: null } },
    orderBy: { assignedAt: "asc" },
    select: { user: { select: { name: true, email: true } } },
  });

  const logs = await prisma.workoutLog.findMany({
    // Chỉ buổi ĐÃ HOÀN THÀNH mới lên phiếu. Buổi bị huỷ có thể vẫn còn checkOutAt
    // (PT ký muộn quá mốc 2 tiếng — xem route check-out), mà buổi huỷ thì không
    // phải buổi dạy hợp lệ, không được nằm trên phụ lục hợp đồng.
    where: {
      clientId: params.id,
      packageEnrollmentId: enrollmentId,
      status: "COMPLETED",
      checkOutAt: { not: null },
    },
    orderBy: { sessionDate: "asc" },
    select: {
      sessionDate: true,
      checkOutAt: true,
      // Chữ ký đánh dấu buổi tập là chữ ký CHECK-IN của khách. Khách không ký
      // check-out nữa; buổi cũ có signatureUrl thì vẫn lấy chữ ký đó cho phiếu.
      checkInSignatureUrl: true,
      signatureUrl: true,
      checkOutPhotoUrl: true,
    },
    take: TOTAL_ROWS,
  });

  // Nhật ký cân nặng của khách — nguồn duy nhất cho cột "Cân nặng" của phiếu.
  const weightLogs = await prisma.weightLog.findMany({
    where: { clientId: params.id },
    orderBy: { date: "asc" },
    select: { date: true, weight: true },
  });

  return NextResponse.json({
    contractCode: enrollment.contractCode,
    clientName: enrollment.client.fullName,
    ptName: enrollment.client.assignedPT?.name ?? enrollment.client.assignedPT?.email ?? "",
    fmName: fm?.user.name ?? fm?.user.email ?? "",
    packageName: enrollment.packageName,
    totalSessions: enrollment.sessions,
    startDate: enrollment.startDate?.toISOString() ?? null,
    endDate: enrollment.endDate?.toISOString() ?? null,
    price: enrollment.price,
    rows: logs.map((l) => {
      const w = weightFor(ymd(l.sessionDate), weightLogs);
      return {
        date: l.sessionDate.toISOString(),
        checkOutAt: l.checkOutAt?.toISOString() ?? null,
        signatureUrl: l.checkInSignatureUrl ?? l.signatureUrl,
        photoUrl: l.checkOutPhotoUrl,
        weight: w.weight,
        /** true = cân đúng ngày tập; false = số cân gần nhất trước buổi. */
        weightMeasured: w.measured,
      };
    }),
  });
}
