import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";

/**
 * Admin điều khiển quyền vào thi của TỪNG người, ngay trong tab Lịch thi.
 *
 * Bốn việc hay phải làm mà trước đây phải sửa thẳng vào cơ sở dữ liệu:
 *
 *   block   — khoá, người đó không mở được đề (và cũng không nộp được bài dở).
 *   unblock — mở khoá.
 *   extend  — cấp lại trọn thời lượng kể từ bây giờ cho người đang làm dở hoặc
 *             đã hết giờ mà chưa nộp. Giữ nguyên đề, xoá phần bị phạt rời trang.
 *   reset   — cho thi lại từ đầu: xoá bài đã chấm trong kỳ, xoá lượt thi, xoá
 *             thông báo thăng cấp đi kèm. Dùng khi bài hỏng, thi nhầm, mất bài.
 *
 * Khoá gắn với từng kỳ thi (examKey là ngày thi) nên sang kỳ mới là hết hiệu lực.
 */

/** Thông báo thăng cấp sinh ra cùng lúc với bài bị xoá — coi như cùng một sự kiện. */
const NOTIFICATION_WINDOW_MS = 2 * 60 * 1000;

type Action = "block" | "unblock" | "extend" | "reset";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, action } = body as { userId?: string; action?: Action };

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Thiếu người cần thao tác" }, { status: 400 });
  }
  if (!action || !["block", "unblock", "extend", "reset"].includes(action)) {
    return NextResponse.json({ error: "Thao tác không hợp lệ" }, { status: 400 });
  }

  const config = await prisma.examConfig.findFirst();
  const examKey = config?.examDate ?? null;
  if (!examKey) {
    return NextResponse.json(
      { error: "Chưa đặt ngày thi — không có kỳ nào để mở hay khoá" },
      { status: 400 }
    );
  }

  // ── Khoá / mở khoá ────────────────────────────────────────────────────────
  if (action === "block") {
    await prisma.examBlock.upsert({
      where: { userId_examKey: { userId, examKey } },
      create: { userId, examKey },
      update: {},
    });
    return NextResponse.json({ ok: true, message: "Đã khoá quyền vào thi" });
  }

  if (action === "unblock") {
    await prisma.examBlock.deleteMany({ where: { userId, examKey } });
    return NextResponse.json({ ok: true, message: "Đã mở quyền vào thi" });
  }

  // ── Cấp lại thời lượng ────────────────────────────────────────────────────
  if (action === "extend") {
    const examSession = await prisma.examSession.findUnique({
      where: { userId_examKey: { userId, examKey } },
    });
    if (!examSession) {
      return NextResponse.json(
        { error: "Người này chưa mở đề lần nào — không có lượt thi để gia hạn" },
        { status: 400 }
      );
    }
    if (examSession.submittedAt) {
      return NextResponse.json(
        { error: 'Bài đã nộp rồi. Muốn cho thi lại thì dùng "Cho thi lại".' },
        { status: 400 }
      );
    }
    // Đếm lại từ bây giờ và xoá phần bị phạt; đề giữ nguyên nên người thi mở
    // lại là thấy đúng đề cũ.
    const updated = await prisma.examSession.update({
      where: { id: examSession.id },
      data: { startedAt: new Date(), penaltyMinutes: 0, lastViolationAt: null },
    });
    // Hết giờ vẫn không được quá giờ đóng phòng thi.
    const window = getExamWindow({
      scheduleEnabled: config?.scheduleEnabled ?? false,
      examDate: config?.examDate ?? null,
      examStartTime: config?.examStartTime ?? "00:00",
      examEndTime: config?.examEndTime ?? "23:59",
    });
    let endsAt = new Date(updated.startedAt.getTime() + updated.durationMinutes * 60_000);
    if (window.endAt && window.endAt < endsAt) endsAt = window.endAt;

    return NextResponse.json({
      ok: true,
      message: `Đã cấp lại ${updated.durationMinutes} phút, giữ nguyên đề cũ`,
      endsAt: updated.durationMinutes > 0 ? endsAt.toISOString() : null,
    });
  }

  // ── Cho thi lại từ đầu ────────────────────────────────────────────────────
  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });

  // Chỉ xoá bài THUỘC KỲ NÀY — lịch sử thi các kỳ trước phải giữ nguyên.
  const attempts =
    window.startAt && window.endAt
      ? await prisma.examAttempt.findMany({
          where: { userId, createdAt: { gte: window.startAt, lte: window.endAt } },
        })
      : [];

  await prisma.$transaction([
    ...attempts.map((a) =>
      prisma.upgradeNotification.deleteMany({
        where: {
          userId,
          passed: a.passed,
          createdAt: {
            gte: new Date(a.createdAt.getTime() - NOTIFICATION_WINDOW_MS),
            lte: new Date(a.createdAt.getTime() + NOTIFICATION_WINDOW_MS),
          },
        },
      })
    ),
    prisma.examAttempt.deleteMany({ where: { id: { in: attempts.map((a) => a.id) } } }),
    prisma.examSession.deleteMany({ where: { userId, examKey } }),
    prisma.examBlock.deleteMany({ where: { userId, examKey } }),
  ]);

  return NextResponse.json({
    ok: true,
    message:
      attempts.length > 0
        ? `Đã xoá ${attempts.length} bài của kỳ này, người này vào thi lại được`
        : "Đã mở lại lượt thi, người này vào thi lại được",
  });
}
