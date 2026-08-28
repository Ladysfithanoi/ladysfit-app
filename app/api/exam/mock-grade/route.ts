import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Chấm bài THI THỬ của Admin.
 *
 * Dùng đúng cách tính điểm của bài thi thật (số câu đúng / tổng số câu, so với
 * điểm đạt trong cấu hình) nhưng KHÔNG ghi gì cả: không tạo exam_attempts,
 * không sinh thông báo thăng cấp, không đụng tới cấp độ PT. Mục đích là để
 * người soạn đề tự kiểm "đề có hợp lý không, chấm có đúng không" — nên trả về
 * luôn đáp án đúng của từng câu để soi lại, việc mà bài thi thật không bao giờ
 * được làm.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { answers } = body as { answers?: Record<string, string> };
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Thiếu câu trả lời" }, { status: 400 });
  }

  const config = await prisma.examConfig.findFirst();
  const passingScore = config?.passingScore ?? 80;

  const questions = await prisma.examQuestion.findMany({
    where: { id: { in: Object.keys(answers) } },
    select: { id: true, correct: true },
  });

  const total = questions.length;
  if (total === 0) {
    return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 400 });
  }

  const correctCount = questions.filter((q) => answers[q.id] === q.correct).length;
  const scorePct = Math.round((correctCount / total) * 100);

  const correctById: Record<string, string> = {};
  for (const q of questions) correctById[q.id] = q.correct;

  return NextResponse.json({
    scorePct,
    correctCount,
    total,
    passingScore,
    passed: scorePct >= passingScore,
    correctById,
  });
}
