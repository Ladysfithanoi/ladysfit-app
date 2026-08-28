import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "PT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.examConfig.findFirst();
  const numQuestions = config?.numQuestions ?? 10;
  const passingScore = config?.passingScore ?? 80;
  const shuffleQuestions = config?.shuffleQuestions ?? true;

  // Chỉ mở đề trong đúng khung giờ thi đã đặt
  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });
  if (!window.open) {
    return NextResponse.json(
      { error: window.message, scheduleState: window.state },
      { status: 403 }
    );
  }

  const allQuestions = await prisma.examQuestion.findMany({ orderBy: { order: "asc" } });

  if (allQuestions.length === 0) {
    return NextResponse.json({ error: "Chưa có câu hỏi trong ngân hàng" }, { status: 400 });
  }

  const pool = shuffleQuestions
    ? [...allQuestions].sort(() => Math.random() - 0.5)
    : [...allQuestions];
  const picked = pool.slice(0, Math.min(numQuestions, pool.length));

  // Strip correct answer before sending to client. Ảnh/video minh hoạ đi kèm
  // câu hỏi — không lộ đáp án nên gửi thoải mái.
  const questions = picked.map(
    ({ id, question, optionA, optionB, optionC, optionD, imageUrl, videoUrl }) => ({
      id,
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      imageUrl,
      videoUrl,
    })
  );

  return NextResponse.json({
    questions,
    passingScore,
    closesAt: window.endAt?.toISOString() ?? null,
    scheduleNote: window.message,
  });
}
