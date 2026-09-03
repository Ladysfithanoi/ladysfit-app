"use client";

import { cn } from "@/lib/utils";
import { SORT_ZONES, SORT_ZONE_LABEL, type SortZone } from "@/lib/exam-trial";

/**
 * Vòng "Sa ngã" — xếp từng tình huống khách vào đúng vùng ranh giới nghề.
 *
 * Ba vùng xếp theo mức cứng rắn tăng dần, và thứ tự đó có ý nghĩa: chấm điểm
 * cho lệch một bậc nửa điểm, lệch hai bậc mất hết (lib/exam-trial.ts). Nhầm
 * "cần cẩn trọng" thành "chấp nhận" là non tay; chấp nhận thẳng một tình huống
 * đáng phải từ chối và báo FM là hỏng hẳn về nghề.
 */

export type SortCardView = { id: string; text: string };

const ZONE_STYLE: Record<SortZone, { active: string; idle: string }> = {
  ACCEPT: {
    active: "bg-emerald-500 text-white border-emerald-500",
    idle: "border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600",
  },
  CAUTION: {
    active: "bg-amber-500 text-white border-amber-500",
    idle: "border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600",
  },
  REFUSE: {
    active: "bg-red-500 text-white border-red-500",
    idle: "border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600",
  },
};

export function SortRound({
  cards,
  answers,
  onChange,
  disabled,
}: {
  cards: SortCardView[];
  /** { cardId: vùng đã chọn } */
  answers: Record<string, SortZone>;
  onChange: (cardId: string, zone: SortZone) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      {cards.map((card, idx) => {
        const picked = answers[card.id];
        return (
          <div
            key={card.id}
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              picked ? "border-gray-100 bg-white" : "border-amber-200 bg-amber-50/40"
            )}
          >
            <p className="text-sm font-medium leading-relaxed text-gray-800">
              <span className="mr-1.5 font-bold text-gray-300">{idx + 1}.</span>
              {card.text}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SORT_ZONES.map((zone) => {
                const active = picked === zone;
                return (
                  <button
                    key={zone}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(card.id, zone)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60",
                      active ? ZONE_STYLE[zone].active : ZONE_STYLE[zone].idle
                    )}
                  >
                    {SORT_ZONE_LABEL[zone]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
