import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tryPromotePt } from "@/lib/pt-promotion";
import { getExamWindow, SUBMIT_GRACE_MS } from "@/lib/exam-schedule";
import { canSitExam, NOT_REQUIRED_MESSAGE } from "@/lib/exam-required-fm";
import {
  ALREADY_TAKEN_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  sessionDeadline,
} from "@/lib/exam-session";
import { TICKET_GRACE_MS, verifyExamTicket } from "@/lib/exam-ticket";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attempts = await prisma.examAttempt.findMany({
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(attempts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  // HLV, và FM được Admin chỉ định bắt buộc thi — xem lib/exam-required-fm.ts.
  if (!(await canSitExam(session.user.id, role))) {
    return NextResponse.json(
      { error: role === "FM" ? NOT_REQUIRED_MESSAGE : "Forbidden" },
      { status: 403 }
    );
  }
  // Bài của FM chỉ ghi nhận điểm cho Admin xem: không thăng, không hạ, không
  // thông báo, và không phụ thuộc hệ thống phân cấp độ của HLV.
  const noPenalty = role === "FM";

  const body = await req.json();
  const { answers, examToken } = body as {
    answers: Record<string, string>;
    examToken?: string;
  };

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Thiếu câu trả lời" }, { status: 400 });
  }

  const [config, sysConfig] = await Promise.all([
    prisma.examConfig.findFirst(),
    prisma.systemConfig.findUnique({ where: { id: "main" } }),
  ]);
  const passingScore = config?.passingScore ?? 80;

  if (!noPenalty && sysConfig?.enableLevelSystem === false) {
    return NextResponse.json({ error: "Hệ thống phân cấp độ đang tắt" }, { status: 403 });
  }

  // Chỉ nhận bài trong khung giờ thi (cộng thêm ít phút cho bài đang làm dở)
  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });
  const withinGrace =
    window.state === "AFTER" &&
    !!window.endAt &&
    Date.now() - window.endAt.getTime() <= SUBMIT_GRACE_MS;
  if (!window.open && !withinGrace) {
    return NextResponse.json({ error: window.message }, { status: 403 });
  }

  // ── Mỗi người chỉ thi một lần một kỳ ────────────────────────────────────
  // Lượt thi được "giành" bằng một lệnh update có điều kiện submittedAt = null:
  // bấm Nộp bài hai lần, hoặc hết giờ tự nộp trùng lúc người thi bấm nộp, thì
  // chỉ một lệnh đi qua được. Xem lib/exam-session.ts.
  const examKey = config?.examDate ?? null;
  const examSession = examKey
    ? await prisma.examSession.findUnique({
        where: { userId_examKey: { userId: session.user.id, examKey } },
      })
    : null;

  if (examSession?.submittedAt) {
    return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE }, { status: 403 });
  }

  // Không có lượt thi (bài mở dở từ trước khi có bảng exam_sessions) thì tra
  // thẳng lịch sử: đã có bài trong kỳ là đã thi rồi.
  if (!examSession && window.startAt && window.endAt) {
    const prior = await prisma.examAttempt.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: window.startAt, lte: window.endAt },
      },
    });
    if (prior > 0) {
      return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE }, { status: 403 });
    }
  }

  // Hết thời lượng làm bài thì không nộp được nữa. Mốc hết giờ tính ở server
  // từ lúc mở đề, đã trừ phạt rời trang — người thi không nới ra được. Bài mở
  // dở từ trước khi có lượt thi thì vẫn kiểm bằng tấm vé đã ký (exam-ticket).
  if (examSession) {
    const deadline = sessionDeadline(examSession, window.endAt);
    if (deadline && Date.now() > deadline.getTime() + TICKET_GRACE_MS) {
      return NextResponse.json({ error: SESSION_EXPIRED_MESSAGE }, { status: 403 });
    }
  } else if ((config?.durationMinutes ?? 0) > 0) {
    const check = verifyExamTicket(examToken, { userId: session.user.id, mock: false });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }
  }

  // Chốt lượt thi TRƯỚC khi chấm: ai giành được mới được ghi bài.
  if (examSession) {
    const claimed = await prisma.examSession.updateMany({
      where: { id: examSession.id, submittedAt: null },
      data: { submittedAt: new Date() },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE }, { status: 403 });
    }
  }

  // Fetch the actual questions to grade
  const questionIds = Object.keys(answers);
  const questions = await prisma.examQuestion.findMany({
    where: { id: { in: questionIds } },
  });

  const total = questions.length;
  if (total === 0) {
    return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 400 });
  }

  const correctCount = questions.filter((q) => answers[q.id] === q.correct).length;
  const scorePct = Math.round((correctCount / total) * 100);
  const passed = scorePct >= passingScore;

  const attempt = await prisma.examAttempt.create({
    data: {
      userId: session.user.id,
      score: correctCount,
      total,
      passed,
      answers: JSON.stringify(answers),
      // Số lần rời khỏi trang thi — giữ lại trong bài để Admin xem về sau.
      violations: examSession?.violations ?? 0,
    },
  });

  if (examSession) {
    await prisma.examSession.update({
      where: { id: examSession.id },
      data: { attemptId: attempt.id },
    });
  }

  const userName = session.user.name ?? session.user.email ?? "PT";

  // FM thì dừng ở đây: điểm đã lưu cho Admin xem, không thăng, không hạ, không
  // thông báo — đúng nghĩa "thi để biết trình độ, trượt cũng không bị gì".
  let promoted = false;
  if (!noPenalty) {
    if (passed) {
      // Đậu lý thuyết CHỈ là một trong các điều kiện — chỉ thăng hạng nếu đủ cả
      // (thực hành đạt + doanh số + transform). Ngược lại vẫn ghi nhận đậu để chờ.
      promoted = await tryPromotePt(session.user.id);
      if (!promoted) {
        await prisma.upgradeNotification.create({
          data: { userId: session.user.id, userName, passed: true },
        });
      }
    } else {
      await prisma.upgradeNotification.create({
        data: { userId: session.user.id, userName, passed: false },
      });
    }
  }

  return NextResponse.json({ attempt, scorePct, passed, promoted, noPenalty, correctCount, total });
}
