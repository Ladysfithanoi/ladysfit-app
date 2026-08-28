import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeMediaUrl, isSafeMediaUrl } from "@/lib/exam-media";

type QuestionInput = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  imageUrl?: string;
  videoUrl?: string;
};

/** Link minh hoạ trong file Excel: bỏ trống hoặc sai định dạng → không lấy,
 *  câu hỏi vẫn nhập bình thường chứ không báo lỗi cả dòng. */
function mediaFromRow(raw?: string): string | null {
  const url = normalizeMediaUrl(raw);
  return url && isSafeMediaUrl(url) ? url : null;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { questions } = (await req.json()) as { questions: QuestionInput[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Không có câu hỏi nào" }, { status: 400 });
    }

    const existing = await prisma.examQuestion.findMany({ select: { question: true } });
    const existingLower = new Set(existing.map((e) => e.question.toLowerCase()));

    const toCreate = questions.filter(
      (q) => q.question.trim() && !existingLower.has(q.question.trim().toLowerCase())
    );
    const skipped = questions.length - toCreate.length;

    if (toCreate.length > 0) {
      await prisma.examQuestion.createMany({
        data: toCreate.map((q) => ({
          question: q.question.trim(),
          optionA: q.optionA.trim(),
          optionB: q.optionB.trim(),
          optionC: q.optionC.trim(),
          optionD: q.optionD.trim(),
          correct: q.correctAnswer,
          imageUrl: mediaFromRow(q.imageUrl),
          videoUrl: mediaFromRow(q.videoUrl),
        })),
      });
    }

    return NextResponse.json({ imported: toCreate.length, skipped });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi server";
    console.error("Exam import error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
