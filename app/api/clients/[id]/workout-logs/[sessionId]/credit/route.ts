import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeWorkoutLog } from "@/lib/workout-session";

// ── FM/Admin tính buổi dạy cho buổi PT sơ suất không chụp được ảnh check-out ──
//
// Quá 2 tiếng chưa check-out thì buổi tự huỷ (VOID): khách vẫn bị trừ buổi vì đã
// ký check-in, còn PT thì không được tính buổi dạy. Nhiều khi buổi dạy là thật —
// PT chỉ quên chụp ảnh, hoặc khách về trước khi kịp chụp. Trước đây FM phải ghi
// tay thêm một dòng trên phiếu check-in rồi nhớ chọn đúng HLV thì lương mới có;
// quên chọn là PT mất buổi, mà buổi ghi tay lại nằm tách rời khỏi buổi thật.
//
// Đường này nối thẳng HAI NƠI trên CHÍNH buổi tập đó: khách đã được tính buổi (lúc
// check-in), bấm "Tính buổi dạy" là buổi vào "Số buổi PT" của bảng lương — ghi công
// đúng người dạy (createdById), đúng gói đã trừ (packageEnrollmentId), đúng tháng
// (sessionDate) — và in lên phiếu check-in kèm chữ ký check-in của khách. Không
// trừ thêm buổi nào của khách.
//
// Định nghĩa "buổi dạy được tính" vẫn là một chỗ: TAUGHT_SESSION_WHERE ở
// lib/session-enrollment.ts nhận confirmationMethod = FM_APPROVAL.

type Ctx = { params: { id: string; sessionId: string } };

async function authorize(clientId: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FM") {
    return { error: NextResponse.json({ error: "Chỉ Admin/FM được tính buổi dạy" }, { status: 403 }) };
  }
  if (role === "FM") {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { branchId: true } });
    if (!client || !(session.user.managedBranchIds ?? []).includes(client.branchId)) {
      return { error: NextResponse.json({ error: "Khách không thuộc cơ sở bạn quản lý" }, { status: 403 }) };
    }
  }
  return { userId: session.user.id, role };
}

/** Ngày theo giờ Việt Nam, dạng "2026-08-15" — để so hai buổi có cùng một ngày tập không. */
function vnDay(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Buổi có ít nhất một ô số liệu (tạ / reps) đã nhập — tức PT thật sự đã ghi buổi tập. */
function hasAnySetData(sets: Record<string, unknown>[]): boolean {
  const keys = [1, 2, 3, 4, 5, 6].flatMap((n) => [`set${n}Load`, `set${n}Reps`]);
  return sets.some((s) => keys.some((k) => s[k] != null && String(s[k]).trim() !== ""));
}

const INCLUDE = {
  setLogs: { orderBy: { id: "asc" } },
  createdBy: { select: { id: true, name: true } },
} as const;

// POST — tính buổi dạy.
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const auth = await authorize(params.id);
    if ("error" in auth) return auth.error;

    const log = await prisma.workoutLog.findFirst({
      where: { id: params.sessionId, clientId: params.id },
      select: {
        id: true, status: true, checkInSignatureUrl: true, packageCounted: true,
        createdById: true, sessionDate: true, setLogs: true,
      },
    });
    if (!log) return NextResponse.json({ error: "Không tìm thấy buổi tập" }, { status: 404 });
    if (log.status !== "VOID") {
      return NextResponse.json({ error: "Chỉ tính buổi dạy cho buổi đã bị huỷ" }, { status: 400 });
    }
    // Chữ ký check-in là bằng chứng khách có mặt và là lý do khách đã bị trừ buổi.
    // Không có nó thì không có gì để nối — buổi đó không phải "đã tính cho khách".
    if (!log.checkInSignatureUrl || !log.packageCounted) {
      return NextResponse.json(
        { error: "Buổi này khách chưa ký check-in / chưa bị trừ buổi nên không tính buổi dạy được" },
        { status: 400 }
      );
    }

    // ── Ba rào chống tính khống ──
    //
    // 1. KHÔNG TỰ DUYỆT CHO MÌNH. FM cũng đi dạy; để FM tự bấm tính lương cho buổi
    //    chính mình dạy thì đường này thành đúng cái lỗ mà ảnh check-out sinh ra
    //    để bịt. Buổi FM tự dạy thì Admin duyệt.
    if (log.createdById === auth.userId) {
      return NextResponse.json(
        { error: "Không tự tính buổi dạy cho buổi chính mình dạy — nhờ Admin đối soát buổi này." },
        { status: 403 }
      );
    }

    // 2. BUỔI TRỐNG không tính. Chưa nhập một ô số liệu nào nghĩa là PT check-in
    //    rồi bỏ đó (thường là mở lại buổi khác ngay sau) — không có gì chứng tỏ
    //    buổi dạy đã diễn ra.
    if (!hasAnySetData(log.setLogs as unknown as Record<string, unknown>[])) {
      return NextResponse.json(
        { error: "Buổi này chưa nhập số liệu bài tập nào — không có gì chứng tỏ buổi dạy đã diễn ra, nên không tính được." },
        { status: 400 }
      );
    }

    // 3. MỘT NGÀY MỘT BUỔI. Kiểu hay gặp: buổi đầu quá 2 tiếng tự huỷ, PT cho
    //    khách ký check-in lại cùng buổi đó — hai bản ghi cho MỘT lần khách đến.
    //    Tính cả hai là trả lương hai lần. Khách tập hai buổi thật trong một ngày
    //    rất hiếm, và khi đó Admin là người quyết.
    if (auth.role !== "ADMIN") {
      const day = vnDay(log.sessionDate);
      const others = await prisma.workoutLog.findMany({
        where: {
          clientId: params.id,
          id: { not: log.id },
          status: "COMPLETED",
          sessionDate: {
            gte: new Date(log.sessionDate.getTime() - 36 * 3600_000),
            lte: new Date(log.sessionDate.getTime() + 36 * 3600_000),
          },
        },
        select: { sessionDate: true },
      });
      if (others.some((o) => vnDay(o.sessionDate) === day)) {
        return NextResponse.json(
          { error: "Ngày này khách đã có một buổi được tính rồi. Hai buổi cùng ngày thường là check-in lại cùng một lần tập — nhờ Admin đối soát nếu khách tập hai buổi thật." },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.workoutLog.update({
      where: { id: log.id },
      data: {
        status: "COMPLETED",
        confirmationMethod: "FM_APPROVAL",
        confirmedAt: new Date(),
        creditedById: auth.userId,
      },
      include: INCLUDE,
    });
    return NextResponse.json(serializeWorkoutLog(updated));
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs credit]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}

// DELETE — bỏ tính (bấm nhầm): buổi quay lại trạng thái huỷ, lý do huỷ cũ giữ nguyên.
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const auth = await authorize(params.id);
    if ("error" in auth) return auth.error;

    const log = await prisma.workoutLog.findFirst({
      where: { id: params.sessionId, clientId: params.id, confirmationMethod: "FM_APPROVAL" },
      select: { id: true },
    });
    if (!log) return NextResponse.json({ error: "Buổi này không phải buổi FM đã tính" }, { status: 404 });

    const updated = await prisma.workoutLog.update({
      where: { id: log.id },
      data: { status: "VOID", confirmationMethod: null, confirmedAt: null, creditedById: null },
      include: INCLUDE,
    });
    return NextResponse.json(serializeWorkoutLog(updated));
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[workout-logs credit undo]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
