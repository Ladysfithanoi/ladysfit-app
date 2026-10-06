import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseOverride, sanitizeOverride } from "@/lib/checkin-sheet";
import {
  checkinSheetEditEnabled,
  loadCheckinSheet,
  selectableTeachers,
} from "@/lib/checkin-sheet-data";

/**
 * PHIẾU CHECK-IN BUỔI TẬP — dữ liệu dựng ở lib/checkin-sheet-data.ts.
 */

/** Ai được mở phiếu. Sửa phiếu thì thêm điều kiện Admin đã bật tính năng. */
const SHEET_ROLES = ["ADMIN", "FM", "COO", "PT"];

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

  const sheet = await loadCheckinSheet(params.id, enrollmentId);
  if (!sheet) return NextResponse.json({ error: "Không tìm thấy lộ trình" }, { status: 404 });
  return NextResponse.json(sheet);
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

  // NGÀY ĐIỀN của từng dòng ghi tay do máy chủ gắn, không tin trình duyệt: dòng
  // đã có giữ nguyên ngày điền cũ, dòng mới lấy lúc này. Bảng lương dựa vào nó
  // để chỉ trả tiền buổi điền kịp trước khi chốt lương (isPayableManualRow).
  const stored = await prisma.checkinSheetOverride.findUnique({
    where:  { enrollmentId },
    select: { header: true, rows: true, extraRows: true, createdAt: true },
  });
  const before = new Map(parseOverride(stored).extraRows.map((r) => [r.id, r]));
  const now = new Date().toISOString();
  for (const row of override.extraRows) {
    const prev = before.get(row.id);
    row.addedAt = prev ? (prev.addedAt ?? stored?.createdAt.toISOString() ?? now) : now;
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
