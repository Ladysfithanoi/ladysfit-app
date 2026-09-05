import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExamWindow } from "@/lib/exam-schedule";
import { parseQuestionIds, sessionDeadline, ALREADY_TAKEN_MESSAGE } from "@/lib/exam-session";
import { resolveExamLevel } from "@/lib/exam-level";
import {
  gradeSortCard, honorAfter, parseStreakTiers, parseTrialState, readSortAnswer,
  SORT_ZONES, type SortZone,
} from "@/lib/exam-trial";

/**
 * Trả lời MỘT thẻ của vòng phân loại — bấm là khoá, hậu quả hiện ra ngay.
 *
 * Đây là vòng lặp chơi của đề thử thách: hành động → hậu quả thấy được ngay →
 * thanh Thanh danh tụt → căng dần về cuối vòng. Trước đây 12 thẻ bày ra một
 * danh sách cuộn, sửa thoải mái, bấm xong không có gì xảy ra — tức là một tờ
 * trắc nghiệm chứ không phải một vòng chơi.
 *
 * BA ĐIỀU KHIẾN NÓ KHÔNG HỞ ĐỀ:
 *   • Đáp án đúng KHÔNG bao giờ rời khỏi server. Trả về đúng mức lệch (0/1/2)
 *     của thẻ vừa bấm — thẻ đã khoá rồi thì biết mình lệch bao nhiêu không giúp
 *     gì cho những thẻ còn lại.
 *   • Thẻ đã trả lời thì không nhận lần thứ hai. Chính máy chủ giữ điều đó, chứ
 *     không phải nút bị vô hiệu hoá ở trình duyệt.
 *   • Cạn Thanh danh là vòng đóng lại, không nhận thêm thẻ nào của vòng đó nữa.
 *
 * KHÔNG chấm điểm ở đây. Điểm vẫn do computeTrial() tính lại từ đầu lúc nộp,
 * bằng đúng bài làm mà route này đã ghi xuống — một đường chấm duy nhất.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { cardId, zone, mock, levelId: mockLevelId } = body as {
    cardId?: string; zone?: string; mock?: boolean; levelId?: string | null;
  };

  if (!cardId || typeof cardId !== "string") {
    return NextResponse.json({ error: "Thiếu thẻ" }, { status: 400 });
  }
  if (!zone || !(SORT_ZONES as string[]).includes(zone)) {
    return NextResponse.json({ error: "Vùng không hợp lệ" }, { status: 400 });
  }
  const picked = zone as SortZone;

  if (mock && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const card = await prisma.examSortCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      correctZone: true,
      round: {
        select: {
          id: true,
          levelId: true,
          isActive: true,
          // Mốc phạt sai liên tiếp là của CẤP, mà cạn Thanh danh thì đóng vòng —
          // nên chỗ chặn thẻ ở dưới phải đọc đúng bảng mốc đang chạy.
          level: { select: { trialStreakTiers: true } },
          sortCards: { select: { id: true, correctZone: true }, orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!card || !card.round.isActive) {
    return NextResponse.json({ error: "Không tìm thấy thẻ" }, { status: 404 });
  }

  const result = gradeSortCard({ id: card.id, correctZone: card.correctZone }, picked);

  // ── Thi thử: chấm thẻ nhưng không ghi gì ──────────────────────────────────
  // Không có lượt thi nào để ghi vào, và thi thử vốn không tính điểm ở đâu cả.
  // Thanh Thanh danh do client tự cộng dồn bằng cùng một hàm honorAfter().
  if (mock) {
    if (mockLevelId && mockLevelId !== card.round.levelId) {
      return NextResponse.json({ error: "Thẻ không thuộc đề của cấp này" }, { status: 400 });
    }
    return NextResponse.json({ ratio: result.ratio, distance: result.distance });
  }

  // ── Bài thi thật ──────────────────────────────────────────────────────────
  const config = await prisma.examConfig.findFirst();
  const resolved = await resolveExamLevel({
    userId: session.user.id,
    role: session.user.role,
    config,
  });
  if (!resolved.ok) return NextResponse.json({ error: resolved.message }, { status: 403 });
  const { levelId, format } = resolved.settings;

  if (format !== "TRIAL" || !levelId || levelId !== card.round.levelId) {
    return NextResponse.json({ error: "Thẻ không thuộc đề của bạn" }, { status: 403 });
  }

  const window = getExamWindow({
    scheduleEnabled: config?.scheduleEnabled ?? false,
    examDate: config?.examDate ?? null,
    examStartTime: config?.examStartTime ?? "00:00",
    examEndTime: config?.examEndTime ?? "23:59",
  });
  if (!window.open) return NextResponse.json({ error: window.message }, { status: 403 });

  const examKey = config?.examDate ?? null;
  const examSession = examKey
    ? await prisma.examSession.findUnique({
        where: { userId_examKey: { userId: session.user.id, examKey } },
      })
    : null;
  if (!examSession) {
    return NextResponse.json({ error: "Chưa mở đề" }, { status: 403 });
  }
  if (examSession.submittedAt) {
    return NextResponse.json({ error: ALREADY_TAKEN_MESSAGE }, { status: 403 });
  }

  const deadline = sessionDeadline(examSession, window.endAt);
  if (deadline && deadline.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Đã hết giờ làm bài" }, { status: 403 });
  }

  // Vòng phải nằm trong bộ đã bốc cho lượt này — không thì đây là thẻ của một
  // vòng người này không được phát.
  const servedRounds = parseQuestionIds(examSession.questionIds);
  if (servedRounds.length > 0 && !servedRounds.includes(card.round.id)) {
    return NextResponse.json({ error: "Vòng này không thuộc lượt thi của bạn" }, { status: 403 });
  }

  // Thẻ phải nằm trong bộ ĐÃ PHÁT cho lượt này. Ngân hàng mỗi vòng khoảng 50
  // thẻ mà chỉ phát 13 — không kiểm thì gửi thẳng id của 37 thẻ còn lại vào đây
  // là dò được đáp án cả ngân hàng mà không tốn một thẻ nào của mình.
  const servedItems = parseQuestionIds(examSession.trialItemIds);
  if (servedItems.length > 0 && !servedItems.includes(card.id)) {
    return NextResponse.json({ error: "Thẻ này không thuộc lượt thi của bạn" }, { status: 403 });
  }

  const state = parseTrialState(examSession.trialState);
  if (readSortAnswer(state, card.round.id, card.id)) {
    return NextResponse.json({ error: "Thẻ này đã trả lời rồi" }, { status: 409 });
  }

  // Chốt lại trạng thái vòng TRƯỚC khi nhận thẻ mới: cạn Thanh danh là vòng
  // đóng, mọi thẻ sau đó không được tính nữa. Chỉ tính những thẻ đã phát.
  const servedCards =
    servedItems.length > 0
      ? card.round.sortCards.filter((c) => servedItems.includes(c.id))
      : card.round.sortCards;
  const before = servedCards.map((c) =>
    gradeSortCard({ id: c.id, correctZone: c.correctZone }, readSortAnswer(state, card.round.id, c.id))
  );
  const streakTiers = parseStreakTiers(card.round.level?.trialStreakTiers);
  if (honorAfter(before, streakTiers) <= 0) {
    return NextResponse.json({ error: "Vòng này đã kết thúc — bạn đã cạn Thanh danh" }, { status: 409 });
  }

  const nextState = {
    ...state,
    [card.round.id]: { ...(state[card.round.id] ?? {}), [card.id]: picked },
  };
  await prisma.examSession.update({
    where: { id: examSession.id },
    data: { trialState: JSON.stringify(nextState) },
  });

  return NextResponse.json({ ratio: result.ratio, distance: result.distance });
}
