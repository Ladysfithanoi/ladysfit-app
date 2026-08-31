import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { VIOLATION_DEBOUNCE_MS, sessionDeadline } from "@/lib/exam-session";

/**
 * Thí sinh vừa rời khỏi trang thi.
 *
 * Trang làm bài gọi vào đây mỗi khi tab bị ẩn hoặc cửa sổ trình duyệt mất tiêu
 * điểm (chuyển sang tab khác, thu nhỏ, mở tài liệu bên ngoài). Server cộng
 * thêm focusPenaltyMinutes vào phần bị trừ của lượt thi rồi trả về mốc hết giờ
 * MỚI — trừ ở server nên người thi không gỡ được bằng cách sửa giờ máy, chặn
 * JS hay tải lại trang.
 *
 * Hai sự kiện của cùng một lần rời trang (blur rồi visibilitychange) chỉ tính
 * một lần: lần báo cách lần trước dưới VIOLATION_DEBOUNCE_MS thì bỏ qua.
 *
 * Không phạt được thì cũng không sao: hàm luôn trả 200 kèm trạng thái hiện
 * tại, trang làm bài không có gì để xử lý lỗi ở đây.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.examConfig.findFirst();
  const examKey = config?.examDate ?? null;
  if (!examKey) return NextResponse.json({ counted: false });

  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });

  const examSession = await prisma.examSession.findUnique({
    where: { userId_examKey: { userId: session.user.id, examKey } },
  });
  // Chưa mở đề, hoặc đã nộp bài rồi thì không còn gì để phạt.
  if (!examSession || examSession.submittedAt) {
    return NextResponse.json({ counted: false });
  }

  const penalty = Math.max(0, config?.focusPenaltyMinutes ?? 0);
  const now = new Date();
  const tooSoon =
    !!examSession.lastViolationAt &&
    now.getTime() - examSession.lastViolationAt.getTime() < VIOLATION_DEBOUNCE_MS;

  const updated = tooSoon
    ? examSession
    : await prisma.examSession.update({
        where: { id: examSession.id },
        data: {
          violations: { increment: 1 },
          penaltyMinutes: { increment: penalty },
          lastViolationAt: now,
        },
      });

  return NextResponse.json({
    counted: !tooSoon,
    violations: updated.violations,
    penaltyMinutes: updated.penaltyMinutes,
    // Trừ bao nhiêu phút cho riêng lần này — để trang làm bài nói đúng con số.
    lastPenaltyMinutes: tooSoon ? 0 : penalty,
    endsAt: sessionDeadline(updated, window.endAt)?.toISOString() ?? null,
  });
}
