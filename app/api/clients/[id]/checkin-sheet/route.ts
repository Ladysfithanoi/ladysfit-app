import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sheetCapacity,
  sheetPageCount,
  applyRowOverride,
  manualSheetRow,
  mergeSheetRows,
  parseOverride,
  sanitizeOverride,
  sheetDay,
  type SheetRow,
} from "@/lib/checkin-sheet";
import { ENROLLMENT_ID, ENROLLMENT_OF_LOG_JOIN } from "@/lib/session-enrollment";

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

/** Ngày theo giờ VN — cùng cách phiếu in ra cột "Ngày" (xem sheetDay), nên số
 *  cân không bao giờ rơi lệch một ngày so với dòng nó đứng cạnh. */
function ymd(d: Date | string): string {
  return sheetDay((typeof d === "string" ? new Date(d) : d).toISOString());
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

/**
 * Ai chọn được vào ô HLV của một dòng ghi tay.
 *
 * Dòng ghi tay nay được TÍNH CÔNG cho người dạy (xem lib/manual-sheet-sessions),
 * nên ô đó phải là một con người có thật chứ không còn là chữ gõ tay — cùng lý do
 * mà "Loại hình tập" phải chọn từ danh sách. Lấy đúng những vai đã từng ký check-in
 * trên hệ thống: PT, FM và Admin.
 */
const TEACHER_ROLES = ["PT", "FM", "ADMIN"];

async function selectableTeachers() {
  const rows = await prisma.user.findMany({
    where:  { role: { in: TEACHER_ROLES as never[] }, deletedAt: null },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return rows.map((u) => ({ id: u.id, name: (u.name ?? "").trim() || u.email || "—" }));
}

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

  const stored = await prisma.checkinSheetOverride.findUnique({
    where:  { enrollmentId },
    select: { header: true, rows: true, extraRows: true },
  });
  const override = parseOverride(stored);

  // Sức chứa của bộ phiếu bám theo TỔNG SỐ BUỔI ĐANG IN TRÊN PHIẾU — tức là số
  // đã áp phần sửa tay, không phải số thô của lộ trình. Phiếu ghi "TỔNG SỐ BUỔI
  // TẬP: 100 buổi" thì phải có đủ 100 ô để ký, đọc lên mới không mâu thuẫn.
  const totalSessions = override.header.totalSessions ?? enrollment.sessions;
  const pageCount = sheetPageCount(totalSessions);
  const capacity  = sheetCapacity(totalSessions);

  // ── Phiếu bắt đầu từ NGÀY BẮT ĐẦU của lộ trình ─────────────────────────────
  //
  // Phiếu check-in là phụ lục của MỘT hợp đồng, nên nó không được chứa buổi tập
  // diễn ra trước ngày hợp đồng đó bắt đầu — buổi ấy thuộc về lộ trình trước.
  //
  // Chuyện này xảy ra thật: cột wl."packageEnrollmentId" ghi lộ trình bị TRỪ BUỔI
  // lúc check-in, mà lộ trình bị trừ là "gói cũ nhất còn trừ được buổi" chứ không
  // phải gói đang chạy tại ngày tập. Khách còn gói cũ dở dang thì buổi tháng 6 vẫn
  // bị gắn vào gói mở tháng 7, và phiếu của gói tháng 7 in ra từ tận tháng 6.
  //
  // So theo NGÀY GIỜ VIỆT NAM ở cả hai vế, đúng cách phiếu in cột "Ngày" (sheetDay
  // ở lib/checkin-sheet). So thẳng mốc UTC thì buổi 6h sáng đúng ngày khai giảng
  // có mốc rơi vào hôm trước và bị loại oan.
  //
  // Chỉ chặn buổi DO APP GHI. Dòng FM tự điền tay không đụng tới: tính năng đó
  // sinh ra để điền bù buổi cũ, ngày nào là do FM chủ động gõ vào, âm thầm giấu đi
  // là xoá mất công người ta vừa nhập mà không nói một lời.
  const VN_DATE = `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok'`;
  const SINCE_START = `($3::timestamptz IS NULL
       OR (wl."sessionDate" ${VN_DATE})::date >= ($3::timestamptz ${VN_DATE})::date)`;

  // Buổi của lộ trình này.
  //
  // Lọc theo lộ trình ĐÃ SUY RA (lib/session-enrollment) chứ không đọc thô
  // wl."packageEnrollmentId". Đọc thô thì hai loại buổi rơi mất khỏi phiếu dù
  // có đủ chữ ký lẫn ảnh: buổi ghi từ trước khi có cột đó, và buổi trỏ vào một
  // lộ trình đã bị xoá (PT xoá gói nhập nhầm rồi tạo gói mới — buổi đã dạy kẹt
  // lại ở id cũ). Dùng chung đúng một luật với bảng lương, nên buổi nào được
  // tính tiền thì buổi đó có mặt trên phiếu.
  //
  // Chỉ buổi ĐÃ HOÀN THÀNH mới lên phiếu. Buổi bị huỷ có thể vẫn còn checkOutAt
  // (PT ký muộn quá mốc 2 tiếng — xem route check-out), mà buổi huỷ thì không
  // phải buổi dạy hợp lệ, không được nằm trên phụ lục hợp đồng.
  const logs = await prisma.$queryRawUnsafe<{
    id: string;
    sessionDate: Date;
    checkOutAt: Date | null;
    // Chữ ký đánh dấu buổi tập là chữ ký CHECK-IN của khách. Khách không ký
    // check-out nữa; buổi cũ có signatureUrl thì vẫn lấy chữ ký đó cho phiếu.
    checkInSignatureUrl: string | null;
    signatureUrl: string | null;
    checkOutPhotoUrl: string | null;
    ptName: string | null;
  }[]>(
    `
    SELECT wl.id, wl."sessionDate", wl."checkOutAt",
           wl."checkInSignatureUrl", wl."signatureUrl", wl."checkOutPhotoUrl",
           -- NGƯỜI THỰC SỰ DẠY (ký check-in/check-out), không phải PT phụ trách
           -- khách: buổi dạy hộ phải ghi tên người dạy hộ, cùng một luật với
           -- cách bảng lương ghi công (xem lib/pt-session-count).
           COALESCE(NULLIF(u.name, ''), u.email, '') AS "ptName"
    FROM workout_logs wl
    LEFT JOIN users u ON u.id = wl."createdById"
    ${ENROLLMENT_OF_LOG_JOIN}
    WHERE wl."clientId" = $1
      AND wl.status = 'COMPLETED'
      AND wl."checkOutAt" IS NOT NULL
      AND ${ENROLLMENT_ID} = $2
      AND ${SINCE_START}
    ORDER BY wl."sessionDate" ASC
    LIMIT ${capacity}
    `,
    params.id, enrollmentId, enrollment.startDate
  );

  // Buổi bị loại vì nằm trước ngày bắt đầu — đếm để nói thẳng trên màn hình, chứ
  // không để phiếu ngắn đi một cách khó hiểu. Con số này thường là 0; khác 0 thì
  // hoặc ngày bắt đầu gõ sai, hoặc những buổi kia thuộc về lộ trình trước.
  const excludedBeforeStart = enrollment.startDate
    ? Number(
        (
          await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `
        SELECT COUNT(*) AS n
        FROM workout_logs wl
        ${ENROLLMENT_OF_LOG_JOIN}
        WHERE wl."clientId" = $1
          AND wl.status = 'COMPLETED'
          AND wl."checkOutAt" IS NOT NULL
          AND ${ENROLLMENT_ID} = $2
          AND NOT ${SINCE_START}
        `,
            params.id, enrollmentId, enrollment.startDate
          )
        )[0]?.n ?? 0
      )
    : 0;

  // Nhật ký cân nặng của khách — nguồn duy nhất cho cột "Cân nặng" của phiếu.
  const weightLogs = await prisma.weightLog.findMany({
    where: { clientId: params.id },
    orderBy: { date: "asc" },
    select: { date: true, weight: true },
  });

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
        ptName: l.ptName ?? "",
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

  const rows = mergeSheetRows([...logRows, ...manualRows], capacity);

  return NextResponse.json({
    contractCode: h.contractCode ?? enrollment.contractCode,
    clientName:   h.clientName   ?? enrollment.client.fullName,
    ptName:       h.ptName       ?? enrollment.client.assignedPT?.name ?? enrollment.client.assignedPT?.email ?? "",
    fmName:       h.fmName       ?? fm?.user.name ?? fm?.user.email ?? "",
    packageName:  enrollment.packageName,
    totalSessions,
    /** Số tờ của bộ phiếu — mỗi tờ 50 ô, xem lib/checkin-sheet.ts. */
    pageCount,
    startDate: h.startDate !== undefined ? h.startDate : enrollment.startDate?.toISOString() ?? null,
    endDate:   h.endDate   !== undefined ? h.endDate   : enrollment.endDate?.toISOString()   ?? null,
    price:     h.price     ?? enrollment.price,
    rows,
    /** Buổi do app ghi bị loại vì diễn ra trước ngày bắt đầu lộ trình. */
    excludedBeforeStart,
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
    /** Danh sách HLV chọn được cho dòng ghi tay — buổi đó được tính công cho họ. */
    teachers: await selectableTeachers(),
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

  // Dòng ghi tay ra tiền, nên ô HLV phải trỏ tới một người CÓ THẬT. Id lạ thì bỏ
  // đi chứ không từ chối cả lần lưu — vứt cả bảng 50 dòng vì một ô sai là cách
  // chắc chắn làm mất công người đang nhập (cùng lẽ với sanitizeOverride).
  const teacherIds = new Set((await selectableTeachers()).map((t) => t.id));
  for (const row of override.extraRows) {
    if (row.ptId && !teacherIds.has(row.ptId)) row.ptId = "";
  }

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
