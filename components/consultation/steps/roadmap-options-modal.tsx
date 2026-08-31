"use client";

import { X, Clock, Check, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGES } from "@/lib/packages";
import { buildRoadmapVariants, describeVariant } from "@/lib/roadmap-variants";

/**
 * ── Chọn cách ghép gói cho một OPTION ────────────────────────────────────────
 *
 * Ba OPTION ở ngoài khác nhau ở TỔNG THỜI GIAN đi cùng khách. Bấm vào một
 * option thì mở hộp này để chọn CÁCH ĐI trong khoảng thời gian đó: một gói L4
 * dài, hay hai gói L3 ngắn; duy trì bằng L5 sáu tháng, hay Loyalfit ba tháng.
 *
 * Tổng thời lượng của mọi phương án đều xấp xỉ nhau — chênh lệch hiện rõ trên
 * từng thẻ để tư vấn viên nói đúng con số với khách.
 *
 * Không có giá ở đây: lúc đang chọn cách đi thì thứ cần nhìn là thời lượng và
 * số buổi. Tiền nằm ở phần "Tổng đầu tư" bên dưới sau khi đã chốt lộ trình.
 */

export type RoadmapOptionSummary = {
  num: 1 | 2 | 3;
  label: string;
  sublabel: string;
  totalDays: number;
  packageNames: string[];
};

export function RoadmapOptionsModal({
  option,
  phase1Key,
  onPick,
  onClose,
}: {
  option: RoadmapOptionSummary;
  phase1Key: string | null;
  onPick: (packageNames: string[]) => void;
  onClose: () => void;
}) {
  const variants = buildRoadmapVariants({
    phase1Key,
    defaultChain: option.packageNames,
  });

  const months = Math.round(option.totalDays / 30);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white font-sans shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b border-gray-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f15b5c]/10 px-2 py-0.5 text-[10px] font-bold text-[#f15b5c]">
                  OPTION {option.num}
                </span>
                <h2 className="text-base font-extrabold text-gray-900">{option.label}</h2>
                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-extrabold text-gray-700 tabular-nums">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />~{months} tháng
                </span>
              </div>
              <p className="mt-0.5 text-xs font-semibold text-gray-400">
                Chọn cách ghép gói cho khoảng thời gian này — tổng thời lượng giữ nguyên
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="mt-0.5 shrink-0 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
            {variants.map((v) => {
              const vMonths = Math.round(v.totalDays / 30);
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => onPick(v.packageNames)}
                  className={cn(
                    "w-full rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md",
                    v.isDefault
                      ? "border-[#f15b5c] bg-[#fff5f5] hover:bg-[#ffeeee]"
                      : "border-gray-200 bg-white hover:border-[#f15b5c]/60 hover:bg-[#fff5f5]/50"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-base font-extrabold text-gray-900">
                        {v.packageNames.map((name, i) => (
                          <span key={`${name}-${i}`} className="flex items-center gap-1.5">
                            {i > 0 && <ArrowRight className="h-3 w-3 text-gray-300" />}
                            {name}
                          </span>
                        ))}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-400">
                        {describeVariant(v.packageNames)}
                      </p>
                    </div>

                    {v.isDefault && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f15b5c] px-2.5 py-1 text-[10px] font-bold text-white">
                        <Sparkles className="h-3 w-3" />
                        Đề xuất
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 tabular-nums">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />~{vMonths} tháng · {v.totalDays} ngày
                    </span>
                    {v.diffDays !== 0 && (
                      <span
                        className={cn(
                          "rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums",
                          v.diffDays > 0
                            ? "bg-blue-50 text-blue-600"
                            : "bg-amber-50 text-amber-600"
                        )}
                      >
                        {v.diffDays > 0 ? "+" : ""}
                        {v.diffDays} ngày so với đề xuất
                      </span>
                    )}
                  </div>

                  {/* Chi tiết từng gói — số buổi và hạn, không có giá */}
                  <div className="mt-3 space-y-1.5">
                    {v.packageNames.map((name, i) => {
                      const def = PACKAGES[name];
                      if (!def) return null;
                      return (
                        <div
                          key={`${name}-${i}-row`}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2"
                        >
                          <span className="text-xs font-bold text-gray-800">{def.name}</span>
                          <span className="text-[11px] font-semibold text-gray-400">
                            {def.sessions} buổi
                            {def.connectSessions ? ` + ${def.connectSessions} Connect` : ""} ·{" "}
                            {def.durationDays} ngày
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#f15b5c]">
                    <Check className="h-3.5 w-3.5" />
                    Chọn lộ trình này
                  </span>
                </button>
              );
            })}

            <p className="pt-1 text-[11px] leading-relaxed text-gray-400">
              Gói Giai đoạn 1 do thể trạng khách quyết định nên giữ nguyên ở mọi phương án. Các
              phương án chỉ khác nhau ở cách đi Giai đoạn 2 và cách duy trì ở Giai đoạn 3.
            </p>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 sm:px-6">
            <span className="text-xs font-semibold text-gray-400">{option.sublabel}</span>
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50"
            >
              Huỷ
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
