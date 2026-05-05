"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Phase data ───────────────────────────────────────────────────────────────

type PhaseKey = "1" | "2" | "3";

const PHASE_DATA: Record<PhaseKey, {
  title: string;
  subtitle: string;
  movementLabel: string;
  movements: string[];
  format: string;
  types: string;
  frequency: string;
  note: string;
}> = {
  "1": {
    title: "Giai đoạn 1",
    subtitle: "Giảm cân nhanh",
    movementLabel: "5 Chuyển động nền tảng",
    movements: ["Squat", "Hinge", "Push", "Pull", "Cardio"],
    format: "Tạ đơn, máy tập, dây kháng lực",
    types: "Toàn bộ các nhóm cơ trên cơ thể",
    frequency: "6 buổi/tuần",
    note: "Tập trung vào 5 chuyển động nền tảng giúp đốt mỡ toàn thân hiệu quả nhất.",
  },
  "2": {
    title: "Giai đoạn 2",
    subtitle: "Hoàn thiện vóc dáng",
    movementLabel: "Loại hình chuyên biệt",
    movements: ["Thân trên - Thân dưới", "Chuyên mông", "Slimbody"],
    format: "Thanh đòn, tạ đơn, máy tập, dây kháng lực",
    types: "Thân trên - Thân dưới | Chuyên mông | Slimbody",
    frequency: "4 buổi/tuần",
    note: "Chuyên biệt hóa từ 5 chuyển động nền tảng, tập trung tạo đường nét và hình thể.",
  },
  "3": {
    title: "Giai đoạn 3",
    subtitle: "Duy trì thói quen",
    movementLabel: "Loại hình nâng cao",
    movements: ["Toàn thân", "Chuyên mông", "Power Training"],
    format: "Thanh đòn, tạ đơn, máy tập, dây kháng lực",
    types: "Toàn thân | Chuyên mông | Power Training",
    frequency: "4 buổi/tuần",
    note: "Thêm Power Training để tăng cường hiệu suất vận động và duy trì thói quen lâu dài.",
  },
};

const PKG_PHASE: Record<string, PhaseKey> = {
  L1: "1", L2: "1",
  L3: "2", L4: "2",
  L5: "3", Loyalfit: "3",
};

const PHASE_STYLE: Record<PhaseKey, { bg: string; text: string; border: string }> = {
  "1": { bg: "bg-red-50",   text: "text-red-600",   border: "border-red-100"   },
  "2": { bg: "bg-blue-50",  text: "text-blue-600",  border: "border-blue-100"  },
  "3": { bg: "bg-green-50", text: "text-green-600", border: "border-green-100" },
};

// ─── Modal ────────────────────────────────────────────────────────────────────

export function PackageDetailModal({
  packageName,
  onClose,
}: {
  packageName: string;
  info?: Record<string, unknown>;
  onClose: () => void;
}) {
  const phaseKey: PhaseKey = PKG_PHASE[packageName] ?? "1";
  const phase = PHASE_DATA[phaseKey];
  const ps = PHASE_STYLE[phaseKey];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="font-sans bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto pointer-events-auto">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full",
                  ps.bg, ps.text
                )}>
                  {phase.title}
                </span>
                <span className="text-xs font-semibold text-gray-400">Gói {packageName}</span>
              </div>
              <h2 className="text-base font-extrabold text-gray-900">{phase.subtitle}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors mt-0.5 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
              Chương trình tập
            </p>

            {/* Movement tags */}
            <div className={cn("rounded-xl p-3.5 mb-3 border", ps.bg, ps.border)}>
              <p className={cn("text-[10px] font-extrabold uppercase tracking-wide mb-2.5", ps.text)}>
                {phase.movementLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {phase.movements.map((item) => (
                  <span
                    key={item}
                    className="bg-white px-2.5 py-1 rounded-full text-xs font-semibold text-gray-700 shadow-sm border border-gray-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2.5 mb-2.5">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Tần suất</p>
                <p className="text-sm font-extrabold text-[#f15b5c]">{phase.frequency}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 col-span-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Dụng cụ</p>
                <p className="text-xs font-semibold text-gray-700 leading-relaxed">{phase.format}</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 mb-2.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Nhóm cơ / Loại hình</p>
              <p className="text-xs font-semibold text-gray-700">{phase.types}</p>
            </div>

            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed">
              {phase.note}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
