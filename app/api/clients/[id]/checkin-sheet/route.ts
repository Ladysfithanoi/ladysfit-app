import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SHEET_TOTAL_ROWS,
  applyRowOverride,
  manualSheetRow,
  mergeSheetRows,
  parseOverride,
  sanitizeOverride,
  type SheetRow,
} from "@/lib/checkin-sheet";

/**
 * Dữ liệu của PHIẾU CHECK-IN BUỔI TẬP — bản số của tờ phụ lục hợp đồng ký tay.
 *
 * Chỉ trả DỮ LIỆU; phiếu được vẽ ở trình duyệt rồi tải xuống dạng ảnh (xem
 * components/dashboard/checkin-sheet-modal.tsx). Vẽ ở client vì thứ cần lưu vào
 * hồ sơ lương là một tấm ảnh, và vẽ bằng canvas thì cái nhìn thấy trên màn hình
 * với cái tải về là CÙNG MỘT bản vẽ — không có chuyện xem một đằng tải một nẻo.
 *
 * Mỗi dòng là một buổi ĐÃ CHECK-OUT: chỉ những buổi đó mới là buổi dạy có thật.
 * Ngoài ra phiếu còn nhận thêm phần SỬA TAY của FM/PT khi Admin bật tính năng —
 * một lớp phủ đặt lên trên, không đụng tới dữ liệu gốc (xem lib/checkin-sheet).
 */

/** Ngày theo đúng phần ngày của chuỗi ISO — cùng cách phiếu in ra cột "Ngày",
 *  nên số cân không bao giờ rơi lệch một ngày so với dòng nó đứng cạnh. */
function ymd(d: Date | string): string {
  return (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);
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

/** Ai được mở phiếu. Sửa phiếu thì thêm điều kiện Admin đã bật tính năng. */
const SHEET_ROLES = ["ADMIN", "FM", "COO", "PT"];

async function checkinSheetEditEnabled(): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({
    where:  { id: "main" },
    select: { enableCheckinSheetEdit: true },
  });
  return config?.enableCheckinSheetEdit === true;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!SHEET_ROLES.includes(role)) {
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
      id: true,
      sessionDate: true,
      checkOutAt: true,
      // Chữ ký đánh dấu buổi tập là chữ ký CHECK-IN của khách. Khách không ký
      // check-out nữa; buổi cũ có signatureUrl thì vẫn lấy chữ ký đó cho phiếu.
      checkInSignatureUrl: true,
      signatureUrl: true,
      checkOutPhotoUrl: true,
    },
    take: SHEET_TOTAL_ROWS,
  });

  // Nhật ký cân nặng của khách — nguồn duy nhất cho cột "Cân nặng" của phiếu.
  const weightLogs = await prisma.weightLog.findMany({
    where: { clientId: params.id },
    orderBy: { date: "asc" },
    select: { date: true, weight: true },
  });

  const stored = await prisma.checkinSheetOverride.findUnique({
    where:  { enrollmentId },
    select: { header: true, rows: true, extraRows: true },
  });
  const override = parseOverride(stored);
  const h = override.header;

  // Buổi app ghi, đã áp phần sửa tay. Số cân tính THEO NGÀY CUỐI CÙNG của dòng
  // (sau khi sửa ngày), nếu không thì sửa ngày xong số cân vẫn bám ngày cũ.
  const logRows: SheetRow[] = logs.map((l) => {
    const edited = applyRowOverride(
      {
        id: l.id,
        date: l.sessionDate.toISOString(),
        checkOutAt: l.checkOutAt?.toISOString() ?? null,
        signatureUrl: l.checkInSignatureUrl ?? l.signatureUrl,
        photoUrl: l.checkOutPhotoUrl,
        weight: null,
        weightMeasured: false,
        manual: false,
      },
      override.rows[l.id]
    );
    if (edited.weight != null) return edited;
    const w = weightFor(ymd(edited.date), weightLogs);
    return { ...edited, weight: w.weight, weightMeasured: w.measured };
  });

  // Buổi ghi tay chưa điền cân thì vẫn mang theo số cân gần nhất trước buổi,
  // cùng một luật với buổi app ghi — phiếu không có hai kiểu cột cân nặng.
  const manualRows: SheetRow[] = override.extraRows.map((e) => {
    const row = manualSheetRow(e);
    if (row.weight != null) return row;
    const w = weightFor(ymd(row.date), weightLogs);
    return { ...row, weight: w.weight, weightMeasured: w.measured };
  });

  const rows = mergeSheetRows([...logRows, ...manualRows]);

  return NextResponse.json({
    contractCode: h.contractCode ?? enrollment.contractCode,
    clientName:   h.clientName   ?? enrollment.client.fullName,
    ptName:       h.ptName       ?? enrollment.client.assignedPT?.name ?? enrollment.client.assignedPT?.email ?? "",
    fmName:       h.fmName       ?? fm?.user.name ?? fm?.user.email ?? "",
    packageName:  enrollment.packageName,
    totalSessions: h.totalSessions ?? enrollment.sessions,
    startDate: h.startDate !== undefined ? h.startDate : enrollment.startDate?.toISOString() ?? null,
    endDate:   h.endDate   !== undefined ? h.endDate   : enrollment.endDate?.toISOString()   ?? null,
    price:     h.price     ?? enrollment.price,
    rows,
    /** Giá trị GỐC của lộ trình — trình sửa cần để hiện nút "về số gốc". */
    original: {
      contractCode:  enrollment.contractCode,
      clientName:    enrollment.client.fullName,
      ptName:        enrollment.client.assignedPT?.name ?? enrollment.client.assignedPT?.email ?? "",
      fmName:        fm?.user.name ?? fm?.user.email ?? "",
      totalSessions: enrollment.sessions,
      startDate:     enrollment.startDate?.toISOString() ?? null,
      endDate:       enrollment.endDate?.toISOString() ?? null,
      price:         enrollment.price,
    },
    override,
    canEdit: await checkinSheetEditEnabled(),
  });
}

/**
 * Lưu phần sửa tay. Ghi đè trọn vẹn lớp phủ bằng đúng thứ trình sửa đang hiện —
 * gộp từng phần thì hai tab mở song song sẽ trộn ra một tờ phiếu không ai từng
 * nhìn thấy.
 *
 * Không đụng workout_logs lẫn package_enrollments: xem lib/checkin-sheet.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!SHEET_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await checkinSheetEditEnabled())) {
    return NextResponse.json(
      { error: "Tính năng sửa phiếu check-in đang tắt. Nhờ Admin bật ở Cài đặt → Cấp độ PT." },
      { status: 403 }
    );
  }

  const body = (await req.json()) as { enrollmentId?: string; override?: unknown };
  const enrollmentId = body.enrollmentId;
  if (!enrollmentId) {
    return NextResponse.json({ error: "Thiếu lộ trình cần sửa" }, { status: 400 });
  }

  const enrollment = await prisma.packageEnrollment.findFirst({
    where:  { id: enrollmentId, clientId: params.id },
    select: { id: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Không tìm thấy lộ trình" }, { status: 404 });

  const override = sanitizeOverride(body.override);
  const data = {
    header:    JSON.stringify(override.header),
    rows:      JSON.stringify(override.rows),
    extraRows: JSON.stringify(override.extraRows),
    updatedById: session.user.id,
  };

  await prisma.checkinSheetOverride.upsert({
    where:  { enrollmentId },
    update: data,
    create: { enrollmentId, ...data },
  });

  return NextResponse.json({ ok: true, override });
}
