import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { signExamTicket } from "@/lib/exam-ticket";
import { checkCanSitExam } from "@/lib/exam-required-fm";
import {
  ALREADY_TAKEN_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  hasTakenExam,
  parseQuestionIds,
  sessionDeadline,
} from "@/lib/exam-session";
import { gradePendingSession, parseAnswers } from "@/lib/exam-grading";

// ?mock=1 — Admin thi thử để soi lại đề mình vừa soạn: cùng bộ câu hỏi, cùng
// cách bốc đề, nhưng mở được ngoài lịch thi (đề chưa tới ngày vẫn phải kiểm
// được) và bài nộp không ghi vào lịch sử thi. Xem /api/exam/mock-grade.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mock = new URL(req.url).searchParams.get("mock") === "1";
  const role = session.user.role;
  const userId = session.user.id;

  // HLV thi để thăng cấp; FM chỉ vào được khi Admin chỉ định bắt buộc thi
  // (xem lib/exam-required-fm.ts) và bài của họ không kéo theo hệ quả gì.
  if (mock) {
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const allowed = await checkCanSitExam(userId, role);
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.message }, { status: 403 });
    }
  }

  // Bài của FM chỉ để ghi nhận trình độ — báo cho trang làm bài biết để nói rõ
  // với người thi là trượt cũng không sao.
  const noPenalty = !mock && role === "FM";

  const config = await prisma.examConfig.findFirst();
  const numQuestions = config?.numQuestions ?? 10;
  const passingScore = config?.passingScore ?? 80;
  const shuffleQuestions = config?.shuffleQuestions ?? true;
  const durationMinutes = Math.max(0, config?.durationMinutes ?? 0);
  const focusPenaltyMinutes = Math.max(0, config?.focusPenaltyMinutes ?? 0);

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

  // ── Lượt thi: mỗi người một lần duy nhất một kỳ ──────────────────────────
  // Thi thử không có lượt — Admin kiểm đề bao nhiêu lần cũng được.
  const examKey = mock ? null : config?.examDate ?? null;
  let examSession = examKey
    ? await prisma.examSession.findUnique({ where: { userId_examKey: { userId, examKey } } })
    : null;

  if (!mock) {
    if (examSession?.submittedAt) {
      return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE, alreadyTaken: true }, { status: 403 });
    }
    // Chưa có lượt nhưng đã có bài trong kỳ (bài nộp từ trước khi có bảng lượt
    // thi) thì vẫn khoá — không ai được thi lần thứ hai.
    if (!examSession && (await hasTakenExam(userId, examKey, window))) {
      return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE, alreadyTaken: true }, { status: 403 });
    }
  }

  const allQuestions = await prisma.examQuestion.findMany({ orderBy: { order: "asc" } });

  if (allQuestions.length === 0) {
    return NextResponse.json({ error: "Chưa có câu hỏi trong ngân hàng" }, { status: 400 });
  }

  function drawFresh() {
    const pool = shuffleQuestions
      ? [...allQuestions].sort(() => Math.random() - 0.5)
      : [...allQuestions];
    return pool.slice(0, Math.min(numQuestions, pool.length));
  }

  // Đang làm dở thì trả lại ĐÚNG đề cũ: F5 không phải là cách bốc lại đề dễ hơn.
  let picked = drawFresh();
  let resumed = false;
  if (examSession) {
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    const kept = parseQuestionIds(examSession.questionIds)
      .map((id) => byId.get(id))
      .filter((q): q is (typeof allQuestions)[number] => !!q);
    // Đề cũ chỉ dùng lại khi còn nguyên; câu hỏi bị xoá hết thì đành bốc lại.
    if (kept.length > 0) {
      picked = kept;
      resumed = true;
    }
  }

  if (!mock && examKey && !examSession) {
    try {
      examSession = await prisma.examSession.create({
        data: {
          userId,
          examKey,
          questionIds: JSON.stringify(picked.map((q) => q.id)),
          durationMinutes,
        },
      });
    } catch {
      // Hai tab mở đề cùng lúc — tab chậm chân dùng lại lượt của tab kia.
      examSession = await prisma.examSession.findUnique({
        where: { userId_examKey: { userId, examKey } },
      });
      if (examSession?.submittedAt) {
        return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE, alreadyTaken: true }, { status: 403 });
      }
      if (examSession) {
        const byId = new Map(allQuestions.map((q) => [q.id, q]));
        const kept = parseQuestionIds(examSession.questionIds)
          .map((id) => byId.get(id))
          .filter((q): q is (typeof allQuestions)[number] => !!q);
        if (kept.length > 0) {
          picked = kept;
          resumed = true;
        }
      }
    }
  }

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

  // Hết giờ làm bài = lúc mở đề + thời lượng - phạt rời trang, nhưng không bao
  // giờ quá giờ đóng phòng thi: mở đề trước giờ đóng 5 phút thì chỉ còn 5 phút,
  // không phải cả thời lượng. Thi thử không có phòng thi nên chỉ chặn theo
  // thời lượng, và đếm lại từ lúc bấm vào.
  let endsAt: Date | null = null;
  if (examSession) {
    endsAt = sessionDeadline(examSession, window.endAt);
    if (endsAt && endsAt.getTime() <= Date.now()) {
      // Hết giờ mà bài chưa nộp được (mất mạng, sập trình duyệt, hết pin...).
      // Phần đã tự lưu vẫn còn ở server nên chấm luôn tại đây thay vì để người
      // ta mất trắng — xem lib/exam-grading.ts.
      const saved = parseAnswers(examSession.answers);
      if (Object.keys(saved).length > 0) {
        const graded = await gradePendingSession(examSession.id, passingScore);
        if (graded.ok) {
          return NextResponse.json(
            {
              error:
                `Đã hết thời lượng làm bài. Hệ thống đã chấm bài từ phần bạn đã làm: ` +
                `đúng ${graded.correctCount}/${graded.total} câu (${graded.scorePct}%) — ` +
                `${graded.passed ? "ĐẠT" : "CHƯA ĐẠT"}.`,
              alreadyTaken: true,
            },
            { status: 403 }
          );
        }
      }
      return NextResponse.json({ error: SESSION_EXPIRED_MESSAGE }, { status: 403 });
    }
  } else if (durationMinutes > 0) {
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
    // Rời khỏi trang thi bị trừ bấy nhiêu phút mỗi lần. Thi thử không phạt —
    // Admin còn phải mở tài liệu ra đối chiếu khi soi đề.
    focusPenaltyMinutes: mock ? 0 : focusPenaltyMinutes,
    violations: examSession?.violations ?? 0,
    penaltyMinutes: examSession?.penaltyMinutes ?? 0,
    // Đang làm dở: đề và đồng hồ giữ nguyên như lần mở trước.
    resumed,
    // Đáp án đã tự lưu — tải lại trang thì các câu đã làm hiện lại đúng như cũ.
    savedAnswers: examSession ? parseAnswers(examSession.answers) : {},
    // Vé có chữ ký — máy người thi giữ rồi nộp kèm bài để server kiểm lại hạn.
    // Bài thi thật đã có lượt thi ở server nên vé chỉ còn dùng cho thi thử,
    // và cho những bài mở dở từ trước khi có bảng lượt thi.
    examToken: endsAt
      ? signExamTicket({ u: userId, e: endsAt.getTime(), m: mock })
      : null,
  });
}
