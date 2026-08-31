import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Soi lại MỘT bài thi cũ của chính mình — chỉ để xem, không sửa được gì.
 *
 * Trả về từng câu trong đề kèm đáp án người đó đã chọn và câu ấy đúng hay sai,
 * NHƯNG không bao giờ trả về đáp án đúng. Ngân hàng câu hỏi dùng lại cho các kỳ
 * sau, lộ đáp án ra đây là biến bài thi thăng cấp thành bài chép.
 *
 * Bài không phải của người đang đăng nhập thì trả 404 y như bài không tồn tại —
 * không xác nhận giúp người ta rằng có tồn tại một bài với id đó.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attempt = await prisma.examAttempt.findUnique({ where: { id: params.id } });
  if (!attempt || attempt.userId !== session.user.id) {
    return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
  }

  let answers: Record<string, string> = {};
  try {
    const parsed = JSON.parse(attempt.answers);
    if (parsed && typeof parsed === "object") answers = parsed;
  } catch {
    // Bài cũ lưu hỏng thì vẫn cho xem điểm, chỉ là không dựng lại được đề.
  }

  // Thứ tự key trong JSON chính là thứ tự câu hỏi lúc làm bài — giữ nguyên để
  // người xem thấy đúng cái đề mình đã ngồi làm.
  const ids = Object.keys(answers);
  const questions = ids.length
    ? await prisma.examQuestion.findMany({ where: { id: { in: ids } } })
    : [];
  const byId = new Map(questions.map((q) => [q.id, q]));

  const items = ids.map((id, i) => {
    const q = byId.get(id);
    const chosen = typeof answers[id] === "string" ? answers[id] : "";
    if (!q) {
      // Câu hỏi đã bị xoá khỏi ngân hàng sau kỳ thi.
      return { id, index: i + 1, missing: true, chosen, isCorrect: false };
    }
    return {
      id,
      index: i + 1,
      missing: false,
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      imageUrl: q.imageUrl,
      videoUrl: q.videoUrl,
      chosen,
      isCorrect: chosen === q.correct,
    };
  });

  const config = await prisma.examConfig.findFirst({ select: { passingScore: true } });

  return NextResponse.json({
    id: attempt.id,
    score: attempt.score,
    total: attempt.total,
    scorePct: attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0,
    passed: attempt.passed,
    createdAt: attempt.createdAt.toISOString(),
    violations: attempt.violations,
    passingScore: config?.passingScore ?? 80,
    items,
  });
}
