import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { examSettingsForLevel } from "@/lib/exam-level";
import { computeTrial } from "@/lib/exam-trial-server";

/**
 * Chấm bài THI THỬ của đề nhiều vòng.
 *
 * Song song với /api/exam/mock-grade của đề trắc nghiệm, cùng một mục đích:
 * người soạn đề tự làm thử để kiểm "đề có ra được không, chấm có đúng không,
 * chỉ tiêu đặt vậy có quá tay không".
 *
 * Dùng ĐÚNG bộ luật chấm của bài thi thật (computeTrial) nhưng KHÔNG ghi gì:
 * không tạo ExamAttempt, không tạo ExamRoundResult, không đụng cấp độ, không
 * sinh thông báo. Đổi lại, nó trả về cả đáp án đúng và lời giải của từng phần —
 * việc mà bài thi thật không bao giờ được làm.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { levelId, trialState } = body as { levelId?: string; trialState?: unknown };

  if (!levelId) return NextResponse.json({ error: "Thiếu cấp độ của đề" }, { status: 400 });
  if (!trialState || typeof trialState !== "object" || Array.isArray(trialState)) {
    return NextResponse.json({ error: "Thiếu bài làm" }, { status: 400 });
  }

  const config = await prisma.examConfig.findFirst();
  // Chấm bằng đúng điểm đạt của cấp đang soi đề — chấm bằng thước khác thì kiểm
  // xong vẫn không biết ngưỡng mình đặt có vừa không.
  const settings = await examSettingsForLevel(levelId, { passingScore: config?.passingScore });

  const computed = await computeTrial(levelId, trialState, settings.passingScore);
  if (!computed.ok) return NextResponse.json({ error: computed.error }, { status: 400 });

  return NextResponse.json({
    scorePct: computed.result.scorePct,
    score: computed.result.score,
    total: computed.result.total,
    penalty: computed.result.penalty,
    passed: computed.result.passed,
    pillar: computed.result.pillar,
    passingScore: settings.passingScore,
    rounds: computed.result.rounds,
    // Chỉ có ở thi thử: đáp án đúng + lời giải của từng thẻ / từng hồ sơ.
    review: computed.review,
  });
}
