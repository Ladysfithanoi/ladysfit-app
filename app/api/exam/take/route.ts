import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { signExamTicket } from "@/lib/exam-ticket";
import { canSitExam, NOT_REQUIRED_MESSAGE } from "@/lib/exam-required-fm";

// ?mock=1 — Admin thi thử để soi lại đề mình vừa soạn: cùng bộ câu hỏi, cùng
// cách bốc đề, nhưng mở được ngoài lịch thi (đề chưa tới ngày vẫn phải kiểm
// được) và bài nộp không ghi vào lịch sử thi. Xem /api/exam/mock-grade.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mock = new URL(req.url).searchParams.get("mock") === "1";
  const role = session.user.role;

  // HLV thi để thăng cấp; FM chỉ vào được khi Admin chỉ định bắt buộc thi
  // (xem lib/exam-required-fm.ts) và bài của họ không kéo theo hệ quả gì.
  if (mock) {
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!(await canSitExam(session.user.id, role))) {
    return NextResponse.json(
      { error: role === "FM" ? NOT_REQUIRED_MESSAGE : "Forbidden" },
      { status: 403 }
    );
  }

  // Bài của FM chỉ để ghi nhận trình độ — báo cho trang làm bài biết để nói rõ
  // với người thi là trượt cũng không sao.
  const noPenalty = !mock && role === "FM";

  const config = await prisma.examConfig.findFirst();
  const numQuestions = config?.numQuestions ?? 10;
  const passingScore = config?.passingScore ?? 80;
  const shuffleQuestions = config?.shuffleQuestions ?? true;
  const durationMinutes = Math.max(0, config?.durationMinutes ?? 0);

  // Chỉ mở đề trong đúng khung giờ thi đã đặt (thi thử thì bỏ qua)
  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });
  if (!mock && !window.open) {
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

  // Hết giờ làm bài = lúc này + thời lượng, nhưng không bao giờ quá giờ đóng
  // phòng thi: mở đề trước giờ đóng 5 phút thì chỉ còn 5 phút, không phải cả
  // thời lượng. Thi thử không có phòng thi nên chỉ chặn theo thời lượng.
  let endsAt: Date | null = null;
  if (durationMinutes > 0) {
    endsAt = new Date(Date.now() + durationMinutes * 60_000);
    if (!mock && window.endAt && window.endAt < endsAt) endsAt = window.endAt;
  }

  return NextResponse.json({
    questions,
    passingScore,
    closesAt: mock ? null : window.endAt?.toISOString() ?? null,
    scheduleNote: mock ? null : window.message,
    durationMinutes,
    noPenalty,
    endsAt: endsAt?.toISOString() ?? null,
    // Vé có chữ ký — máy người thi giữ rồi nộp kèm bài để server kiểm lại hạn.
    examToken: endsAt
      ? signExamTicket({ u: session.user.id, e: endsAt.getTime(), m: mock })
      : null,
  });
}
