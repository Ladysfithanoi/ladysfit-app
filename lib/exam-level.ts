import { prisma } from "@/lib/prisma";

/**
 * ── Đề thi theo cấp độ ───────────────────────────────────────────────────────
 *
 * Quy ước tên: "đề Cấp N" là bộ câu hỏi mà người ĐANG Ở Cấp N phải làm để được
 * xét lên cấp kế tiếp. Cùng cách hiểu với promoteMinAvgRevenue của PTLevel —
 * tất cả đều là điều kiện để RỜI cấp đó.
 *
 * Ai làm đề nào:
 *   • HLV  → đề của cấp họ đang đứng (User.ptLevelId).
 *   • FM   → đề Admin chỉ định trong tab Lịch thi (ExamConfig.fmLevelId), vì FM
 *            không có cấp độ PT nên không suy ra được. Bài của FM chỉ để Admin
 *            nắm trình độ, không thăng không hạ (xem lib/exam-required-fm.ts).
 *
 * Mỗi cấp có thể đặt riêng số câu và điểm đạt; bỏ trống thì rơi về số chung
 * trong ExamConfig.
 */

export type ExamLevelSettings = {
  levelId: string | null;
  levelName: string | null;
  numQuestions: number;
  passingScore: number;
};

/** Số chung dùng khi cấp không đặt riêng, và khi chưa có ExamConfig nào. */
export const DEFAULT_NUM_QUESTIONS = 10;
export const DEFAULT_PASSING_SCORE = 80;

export const NO_LEVEL_MESSAGE =
  "Bạn chưa được xếp cấp độ nên chưa có đề thi. Liên hệ quản lý để được xếp cấp.";

export const NO_FM_LEVEL_MESSAGE =
  "Quản lý chưa chọn đề thi dành cho FM ở tab Lịch thi.";

/** Chưa ai soạn câu hỏi cho cấp này — nói rõ tên cấp để Admin biết soạn cho ai. */
export function emptyBankMessage(levelName: string | null): string {
  return levelName
    ? `Đề của cấp "${levelName}" chưa có câu hỏi nào. Liên hệ quản lý để soạn đề cho cấp này.`
    : "Chưa có câu hỏi trong ngân hàng đề.";
}

type ConfigLike = {
  numQuestions?: number | null;
  passingScore?: number | null;
  fmLevelId?: string | null;
} | null;

export type ResolvedExamLevel =
  | { ok: true; settings: ExamLevelSettings }
  | { ok: false; message: string };

/**
 * Người này làm đề của cấp nào, kèm số câu và điểm đạt đã chốt.
 *
 * `role` quyết định đường lấy cấp: HLV theo cấp của chính họ, FM theo cấp Admin
 * chỉ định. Admin thi thử thì truyền thẳng `overrideLevelId` (đề đang soạn).
 */
export async function resolveExamLevel(opts: {
  userId: string;
  role: string;
  config: ConfigLike;
  overrideLevelId?: string | null;
}): Promise<ResolvedExamLevel> {
  const fallbackNum = opts.config?.numQuestions ?? DEFAULT_NUM_QUESTIONS;
  const fallbackPass = opts.config?.passingScore ?? DEFAULT_PASSING_SCORE;

  let levelId: string | null = null;

  if (opts.overrideLevelId) {
    levelId = opts.overrideLevelId;
  } else if (opts.role === "FM") {
    levelId = opts.config?.fmLevelId ?? null;
    if (!levelId) return { ok: false, message: NO_FM_LEVEL_MESSAGE };
  } else {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { ptLevelId: true },
    });
    levelId = user?.ptLevelId ?? null;
    if (!levelId) return { ok: false, message: NO_LEVEL_MESSAGE };
  }

  const level = await prisma.pTLevel.findUnique({
    where: { id: levelId },
    select: { id: true, name: true, examNumQuestions: true, examPassingScore: true },
  });
  if (!level) return { ok: false, message: NO_LEVEL_MESSAGE };

  return {
    ok: true,
    settings: {
      levelId: level.id,
      levelName: level.name,
      numQuestions: level.examNumQuestions ?? fallbackNum,
      passingScore: level.examPassingScore ?? fallbackPass,
    },
  };
}

/**
 * Số câu / điểm đạt của một cấp đã biết id — dùng khi chấm lại bài hết giờ:
 * lúc đó phải theo cấp đã chốt lúc mở đề, không phải cấp hiện tại của người thi
 * (họ có thể đã được thăng cấp trong lúc bài chưa chấm).
 */
export async function examSettingsForLevel(
  levelId: string | null,
  fallback: { numQuestions?: number | null; passingScore?: number | null },
): Promise<ExamLevelSettings> {
  const numQuestions = fallback.numQuestions ?? DEFAULT_NUM_QUESTIONS;
  const passingScore = fallback.passingScore ?? DEFAULT_PASSING_SCORE;
  if (!levelId) {
    return { levelId: null, levelName: null, numQuestions, passingScore };
  }
  const level = await prisma.pTLevel.findUnique({
    where: { id: levelId },
    select: { id: true, name: true, examNumQuestions: true, examPassingScore: true },
  });
  return {
    levelId,
    levelName: level?.name ?? null,
    numQuestions: level?.examNumQuestions ?? numQuestions,
    passingScore: level?.examPassingScore ?? passingScore,
  };
}

/** Đề của một cấp, đúng thứ tự soạn. Cấp chưa có câu nào thì trả mảng rỗng. */
export async function questionsForLevel(levelId: string) {
  return prisma.examQuestion.findMany({
    where: { levels: { some: { levelId } } },
    orderBy: { order: "asc" },
  });
}

/**
 * Số câu riêng của một cấp: null/rỗng = dùng số chung. Chặn số vô lý ngay ở
 * server để một lần gõ nhầm không sinh ra đề 0 câu hay 9999 câu.
 */
export function normalizeExamNumQuestions(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 500) return null;
  return n;
}

/** Điểm đạt riêng của một cấp (%): null/rỗng = dùng điểm chung. */
export function normalizeExamPassingScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) return null;
  return n;
}

export const NO_LEVEL_SELECTED =
  "Chọn ít nhất một cấp độ cho câu hỏi này — câu không thuộc cấp nào sẽ không bao giờ được bốc ra thi.";

/**
 * Lọc danh sách cấp do client gửi lên, chỉ giữ id có thật và đang bật.
 * Trả mảng rỗng nếu không còn gì hợp lệ — chỗ gọi tự quyết báo lỗi hay bỏ qua.
 */
export async function validLevelIds(raw: unknown): Promise<string[]> {
  if (!Array.isArray(raw)) return [];
  const wanted = Array.from(new Set(raw.filter((v): v is string => typeof v === "string" && !!v)));
  if (wanted.length === 0) return [];
  const rows = await prisma.pTLevel.findMany({
    where: { id: { in: wanted }, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Số câu hiện có của từng cấp — cho tab Ngân hàng đề và tab Lịch thi. */
export async function questionCountByLevel(): Promise<Record<string, number>> {
  const rows = await prisma.examQuestionLevel.groupBy({
    by: ["levelId"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.levelId] = r._count._all;
  return out;
}
