import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCanSitExam } from "@/lib/exam-required-fm";
import { resolveExamLevel } from "@/lib/exam-level";
import { SINS, type Sin } from "@/lib/exam-trial";

/**
 * Thí sinh KHAI một đại tội trước khi được xem đề.
 *
 * Khai xong là chốt — không đổi lại được. Nếu cho đổi thì người ta sẽ mở đề,
 * xem vòng nào dễ, rồi mới khai; lúc đó cơ chế này không còn đo được gì. Cùng lý
 * do, đề chỉ được gửi xuống SAU khi lượt thi đã có declaredSin (xem
 * app/api/exam/take).
 *
 * Chỉ khai được tội mà cấp này thật sự có vòng — 7 tội nhưng đề mới có mấy vòng
 * thì khai vào một tội không có vòng nào là khai vào chỗ trống.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const role = session.user.role;

  const allowed = await checkCanSitExam(userId, role);
  if (!allowed.ok) return NextResponse.json({ error: allowed.message }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sin = (body as { sin?: string }).sin;
  if (typeof sin !== "string" || !(SINS as string[]).includes(sin)) {
    return NextResponse.json({ error: "Đại tội không hợp lệ" }, { status: 400 });
  }

  const config = await prisma.examConfig.findFirst();
  const resolved = await resolveExamLevel({ userId, role, config });
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: 403 });
  const { levelId, format } = resolved.settings;

  if (format !== "TRIAL" || !levelId) {
    return NextResponse.json({ error: "Đề của cấp bạn không phải đề nhiều vòng" }, { status: 400 });
  }

  // Tội phải có vòng thật trong đề của cấp này.
  const round = await prisma.examRound.findFirst({
    where: { levelId, isActive: true, sin: sin as Sin },
    select: { id: true },
  });
  if (!round) {
    return NextResponse.json(
      { error: "Đề của cấp bạn chưa có vòng nào cho đại tội này" },
      { status: 400 }
    );
  }

  const examKey = config?.examDate ?? null;
  if (!examKey) return NextResponse.json({ error: "Chưa đặt ngày thi" }, { status: 400 });

  const examSession = await prisma.examSession.findUnique({
    where: { userId_examKey: { userId, examKey } },
  });
  if (!examSession) {
    return NextResponse.json({ error: "Bạn chưa mở đề thi của kỳ này" }, { status: 403 });
  }
  if (examSession.submittedAt) {
    return NextResponse.json({ error: "Bạn đã nộp bài của kỳ này rồi" }, { status: 403 });
  }

  // Khai một lần duy nhất. Update có điều kiện declaredSin = null nên bấm hai
  // lần, hay hai tab cùng khai, thì chỉ lần đầu ăn.
  const claimed = await prisma.examSession.updateMany({
    where: { id: examSession.id, declaredSin: null, submittedAt: null },
    data: { declaredSin: sin as Sin },
  });
  if (claimed.count === 0) {
    const current = await prisma.examSession.findUnique({
      where: { id: examSession.id },
      select: { declaredSin: true },
    });
    return NextResponse.json(
      { error: "Bạn đã khai rồi, không đổi lại được.", declaredSin: current?.declaredSin ?? null },
      { status: 409 }
    );
  }

  return NextResponse.json({ declaredSin: sin });
}
