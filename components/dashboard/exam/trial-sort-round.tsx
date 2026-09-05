"use client";

import { useMemo } from "react";
import { Check, ShieldAlert, Skull, Lock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SORT_ZONES, SORT_ZONE_LABEL, SORT_VERDICT,
  HONOR_START, honorCost, honorRun, streakPenaltyAt,
  type HonorStep, type SortZone, type StreakTier,
} from "@/lib/exam-trial";

/**
 * Vòng phân loại thẻ — MỘT VÒNG CHƠI, không phải một tờ trắc nghiệm.
 *
 * Bốn thứ làm nên vòng lặp chơi ở đây:
 *   1. Mỗi lúc chỉ một thẻ. Không có danh sách cuộn để đọc trước rồi tính đường.
 *   2. Bấm là KHOÁ. Không sửa lại, nên hậu quả là thật.
 *   3. Hậu quả hiện ra NGAY: đúng / lệch một bậc / lệch hai bậc.
 *   4. Thanh Thanh danh tụt theo. Cạn thanh là vòng kết thúc ngay tại chỗ.
 *
 * Ba thứ đầu là điều kiện của thứ tư: có khoá thẻ thì mới dám báo kết quả ngay
 * mà không hở đề, và có báo ngay thì thanh mới có nghĩa. Bỏ một cái là quay về
 * chỗ cũ — bấm 12 thẻ, màn hình không đổi gì, rồi nộp.
 *
 * Máy chủ mới là nơi giữ luật: đáp án không rời server, thẻ đã trả lời không
 * nhận lần hai, cạn thanh thì vòng đóng. Ở đây chỉ vẽ ra những điều đó.
 */

export type SortCardView = { id: string; text: string };

const ZONE_STYLE: Record<SortZone, { active: string; idle: string }> = {
  ACCEPT: {
    active: "bg-emerald-500 text-white border-emerald-500",
    idle: "border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600",
  },
  CAUTION: {
    active: "bg-amber-500 text-white border-amber-500",
    idle: "border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600",
  },
  REFUSE: {
    active: "bg-red-500 text-white border-red-500",
    idle: "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600",
  },
};

/** Màu thanh đổi theo mức còn lại — nhìn là biết mình đang ở đâu. */
function honorTone(honor: number) {
  if (honor > 60) return { bar: "bg-emerald-500", text: "text-emerald-600" };
  if (honor > 30) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-red-500", text: "text-red-600" };
}

const VERDICT_STYLE: Record<number, { box: string; icon: typeof Check }> = {
  0: { box: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: Check },
  1: { box: "border-amber-200 bg-amber-50 text-amber-700", icon: ShieldAlert },
  2: { box: "border-red-200 bg-red-50 text-red-700", icon: Skull },
};

export function SortRound({
  cards,
  answers,
  outcomes,
  streakTiers,
  onAnswer,
  pendingCardId,
  error,
  disabled,
}: {
  cards: SortCardView[];
  /** { cardId: vùng đã chọn } — thẻ có mặt ở đây là thẻ đã khoá. */
  answers: Record<string, SortZone>;
  /** { cardId: tỉ lệ điểm } do máy chủ trả về sau mỗi lần bấm. */
  outcomes: Record<string, number>;
  /** Mốc phạt sai liên tiếp của cấp — rỗng = cấp này không bật phạt liên tiếp. */
  streakTiers: StreakTier[];
  onAnswer: (cardId: string, zone: SortZone) => void;
  /** Thẻ đang chờ máy chủ trả lời — khoá nút để không bấm hai lần. */
  pendingCardId?: string | null;
  error?: string | null;
  disabled?: boolean;
}) {
  const answeredCount = cards.filter((c) => answers[c.id]).length;

  // Thanh Thanh danh dựng bằng ĐÚNG hàm honorRun() mà máy chủ dùng lúc chấm,
  // nên con số ở đây không thể lệch con số trong bảng điểm — kể cả phần trừ
  // lũy tiến, thứ phụ thuộc vào THỨ TỰ thẻ chứ không cộng dồn rời rạc được.
  const run = useMemo(
    () =>
      honorRun(
        cards.map((c) => {
          const ratio = outcomes[c.id];
          const answered = !!answers[c.id] && ratio !== undefined;
          return { answer: answered ? answers[c.id] : null, ratio: ratio ?? 0 };
        }),
        streakTiers
      ),
    [cards, answers, outcomes, streakTiers]
  );
  const honor = run.left;
  /** Bước của từng thẻ, tra theo id — để nói rõ thẻ nào ăn thêm bao nhiêu. */
  const stepOf = (cardId: string): HonorStep | undefined => {
    const i = cards.findIndex((c) => c.id === cardId);
    return i < 0 ? undefined : run.steps[i];
  };

  const collapsed = honor <= 0;
  const current = collapsed ? null : cards.find((c) => !answers[c.id]) ?? null;
  const lastDone = [...cards].reverse().find((c) => answers[c.id] && outcomes[c.id] !== undefined);
  const tone = honorTone(honor);
  /** Chuỗi sai đang chạy — con số quyết định thẻ kế tiếp đắt tới đâu. */
  const streak = lastDone ? stepOf(lastDone.id)?.streak ?? 0 : 0;
  /** Sai thêm một thẻ nữa thì mất thêm bao nhiêu — cảnh báo TRƯỚC khi bấm. */
  const nextStreakPenalty = streakPenaltyAt(streak + 1, streakTiers);

  return (
    <div className="space-y-4">
      {/* ── Thanh Thanh danh ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Thanh danh</p>
            <p className={cn("text-2xl font-extrabold leading-tight", tone.text)}>{honor}</p>
          </div>
          <p className="text-xs font-bold text-gray-400">
            Thẻ {Math.min(answeredCount + (current ? 1 : 0), cards.length)}/{cards.length}
          </p>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn("h-full rounded-full transition-all duration-500", tone.bar)}
            style={{ width: `${honor}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] font-semibold leading-snug text-gray-400">
          Bấm chọn là khoá, không sửa lại được. Lệch một bậc mất {honorCost(0.5)} Thanh danh, lệch hai
          bậc mất {honorCost(0)}. Cạn thanh là hỏng cả vòng.
        </p>
        {/* Luật phạt liên tiếp phải nói TRƯỚC, không phải để người ta phát hiện
            ra sau khi đã mất. Cấp không bật thì cả khối này biến mất. */}
        {streakTiers.length > 0 && (
          <p className="mt-1.5 text-[11px] font-semibold leading-snug text-amber-600">
            Sai liền nhau còn bị trừ thêm:{" "}
            {streakTiers.map((t, i) => (
              <span key={t.streak}>
                {i > 0 && " · "}
                {t.streak} thẻ liền −{t.penalty}
              </span>
            ))}
            . Một thẻ đúng là chuỗi về 0.
          </p>
        )}
      </div>

      {/* ── Chuỗi sai đang chạy ──────────────────────────────────────────── */}
      {!collapsed && streak > 0 && streakTiers.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <Flame className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs font-bold text-amber-700">
            Đang sai {streak} thẻ liên tiếp.
            {nextStreakPenalty > 0
              ? ` Sai thẻ nữa là mất thêm ${nextStreakPenalty} Thanh danh.`
              : " Xếp đúng một thẻ là chuỗi về 0."}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600">
          {error}
        </p>
      )}

      {/* ── Cạn thanh: vòng đóng lại ─────────────────────────────────────── */}
      {collapsed && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
          <Skull className="mx-auto h-8 w-8 text-red-400" />
          <p className="mt-2 text-base font-extrabold text-red-700">Cạn Thanh danh</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold leading-relaxed text-red-600">
            Đại tội này đã nuốt bạn ở thẻ thứ {answeredCount}. Vòng dừng tại đây và tính là trượt —
            {cards.length - answeredCount} thẻ còn lại không được tính nữa. Bấm sang vòng sau để đi tiếp.
          </p>
        </div>
      )}

      {/* ── Kết quả thẻ vừa bấm ──────────────────────────────────────────── */}
      {!collapsed && lastDone && outcomes[lastDone.id] !== undefined && (
        <Verdict ratio={outcomes[lastDone.id]} step={stepOf(lastDone.id)} />
      )}

      {/* ── Thẻ đang chơi ────────────────────────────────────────────────── */}
      {current && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-300">
            Thẻ {answeredCount + 1}
          </p>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-gray-800">{current.text}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SORT_ZONES.map((zone) => (
              <button
                key={zone}
                type="button"
                disabled={disabled || pendingCardId === current.id}
                onClick={() => onAnswer(current.id, zone)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-xs font-bold transition-all",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  ZONE_STYLE[zone].idle
                )}
              >
                {SORT_ZONE_LABEL[zone]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!collapsed && !current && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <Check className="mx-auto h-7 w-7 text-emerald-500" />
          <p className="mt-2 text-sm font-extrabold text-emerald-700">Xong vòng này</p>
          <p className="mt-1 text-xs font-semibold text-emerald-600">
            Còn {honor}/{HONOR_START} Thanh danh.
          </p>
        </div>
      )}

      {/* ── Những thẻ đã đi qua ──────────────────────────────────────────── */}
      {answeredCount > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-300">Đã đi qua</p>
          {cards
            .filter((c) => answers[c.id])
            .map((c, i) => {
              const ratio = outcomes[c.id];
              const distance = ratio === undefined ? null : ratio >= 1 ? 0 : ratio > 0 ? 1 : 2;
              return (
                <div
                  key={c.id}
                  className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2"
                >
                  <Lock className="mt-0.5 h-3 w-3 shrink-0 text-gray-300" />
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-500">
                    {i + 1}. {c.text}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                      distance === 0
                        ? "bg-emerald-100 text-emerald-700"
                        : distance === 1
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    )}
                  >
                    {SORT_ZONE_LABEL[answers[c.id]]}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/**
 * Câu báo ngay sau khi bấm — nói mức lệch, tuyệt đối không nói đáp án đúng.
 *
 * Hai khoản trừ hiện TÁCH nhau: hao của thẻ, và phần phạt vì chuỗi sai. Gộp lại
 * một số thì người thi chỉ thấy mình mất nhiều mà không hiểu vì sao, mà cả cơ
 * chế này chỉ có tác dụng khi họ hiểu ngay lúc đó là phải dừng chuỗi lại.
 */
function Verdict({ ratio, step }: { ratio: number; step?: HonorStep }) {
  const distance = ratio >= 1 ? 0 : ratio > 0 ? 1 : 2;
  const style = VERDICT_STYLE[distance];
  const Icon = style.icon;
  const cost = honorCost(ratio);
  const streakPenalty = step?.streakPenalty ?? 0;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-2xl border px-4 py-3", style.box)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-extrabold">
          {SORT_VERDICT[distance].label}
          {cost > 0 && <span className="ml-1.5 font-bold opacity-80">−{cost} Thanh danh</span>}
          {streakPenalty > 0 && (
            <span className="ml-1.5 font-bold opacity-80">
              −{streakPenalty} vì sai {step?.streak} thẻ liên tiếp
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs font-semibold opacity-90">{SORT_VERDICT[distance].note}</p>
      </div>
    </div>
  );
}
