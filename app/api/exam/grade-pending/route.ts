import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { sessionDeadline } from "@/lib/exam-session";
import { gradePendingSession, parseAnswers } from "@/lib/exam-grading";

/**
 * Chấm những lượt thi HẾT GIỜ MÀ KHÔNG AI NỘP, dựa trên bài đã tự lưu.
 *
 * Người thi mất mạng, sập trình duyệt, hết pin hay đóng nhầm tab thì bài không
 * bao giờ được nộp — nhưng phần họ đã làm vẫn nằm ở exam_sessions.answers. Nút
 * này ở tab Lịch thi để Admin thu những bài đó về sau khi kỳ thi khép lại.
 *
 * Chỉ đụng tới lượt ĐÃ hết giờ. Ai còn đang ngồi làm thì để yên.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.examConfig.findFirst();
  const examKey = config?.examDate ?? null;
  if (!examKey) {
    return NextResponse.json({ graded: 0, failed: 0, message: "Chưa đặt ngày thi" });
  }

  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });

  const pending = await prisma.examSession.findMany({
    where: { examKey, submittedAt: null, answers: { not: null } },
  });

  const now = Date.now();
  let graded = 0;
  let failed = 0;

  for (const s of pending) {
    if (Object.keys(parseAnswers(s.answers)).length === 0) continue;

    const deadline = sessionDeadline(s, window.endAt);
    // Không đặt thời lượng thì lượt chỉ hết hạn khi phòng thi đóng cửa.
    if (deadline ? deadline.getTime() > now : window.open) continue;

    const result = await gradePendingSession(s.id, config?.passingScore ?? 80);
    if (result.ok) graded++;
    else failed++;
  }

  return NextResponse.json({ graded, failed });
}
