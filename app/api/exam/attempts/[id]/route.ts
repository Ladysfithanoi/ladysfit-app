import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Thông báo thăng cấp sinh ra cùng lúc với bài thi bị xoá — coi như cùng một sự kiện. */
const NOTIFICATION_WINDOW_MS = 2 * 60 * 1000;

/**
 * Admin xoá một bài thi.
 *
 * Đây cũng là cái van của luật "mỗi người thi một lần": xoá bài là xoá luôn
 * lượt thi của kỳ đó, nên người bị xoá vào thi lại được. Dùng khi bài hỏng vì
 * lỗi kỹ thuật, hoặc khi cần huỷ một lần thi thừa.
 *
 * Xoá kèm thông báo thăng cấp đã sinh ra từ chính bài này (cùng người, lệch
 * nhau không quá 2 phút) — để lại thì Admin thấy "đã đậu" của một bài không
 * còn tồn tại.
 *
 * Lưu ý: nếu bài thi đó đã kéo theo THĂNG CẤP thì xoá bài KHÔNG hạ cấp lại —
 * việc đó phải làm tay ở trang cấp độ.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attempt = await prisma.examAttempt.findUnique({ where: { id: params.id } });
  if (!attempt) {
    return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
  }

  const from = new Date(attempt.createdAt.getTime() - NOTIFICATION_WINDOW_MS);
  const to = new Date(attempt.createdAt.getTime() + NOTIFICATION_WINDOW_MS);

  await prisma.$transaction([
    prisma.examAttempt.delete({ where: { id: attempt.id } }),
    prisma.upgradeNotification.deleteMany({
      where: {
        userId: attempt.userId,
        passed: attempt.passed,
        createdAt: { gte: from, lte: to },
      },
    }),
    // Mở khoá lượt thi: lượt gắn thẳng với bài, hoặc lượt của kỳ mà bài này
    // thuộc về (bài cũ chưa có attemptId).
    prisma.examSession.deleteMany({
      where: {
        userId: attempt.userId,
        OR: [
          { attemptId: attempt.id },
          { attemptId: null, submittedAt: { gte: from, lte: to } },
        ],
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
