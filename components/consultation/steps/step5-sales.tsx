"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Package, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGES, formatPrice, type PackageDef } from "@/lib/packages";
import type { ConsultationData } from "../consultation-wizard";
import { PackageDetailModal } from "./package-detail-modal";
import { BodyFatCard } from "./body-fat-card";
import { TransformGallery } from "./transform-gallery";

// ─── Types ────────────────────────────────────────────────────────────────────

type SelectedPkg = {
  packageName: string;
  packageStage: string;
  sessions: number;
  durationDays: number;
  price: number;
  discountedPrice: number | null;
  order: number;
  isConfirmed: boolean;
  isBuffer?: boolean;
};

type PricingInfo = {
  originalPrice: number;
  effectivePrice: number;
  type: "subsidized" | "full" | "renewal";
};

type RoadmapOption = {
  num: 1 | 2 | 3;
  label: string;
  sublabel: string;
  totalDays: number;
  packages: SelectedPkg[];
};

// ─── Pricing ──────────────────────────────────────────────────────────────────
// Loyalfit: no subsidy or renewal discount — always full price

function computePricing(pkgs: SelectedPkg[]): PricingInfo[] {
  return pkgs.map((pkg, index) => {
    const def = PACKAGES[pkg.packageName];
    if (!def) return { originalPrice: 0, effectivePrice: 0, type: "full" };

    if (pkg.packageName === "Loyalfit") {
      return { originalPrice: def.price, effectivePrice: def.price, type: "full" };
    }

    if (index === 0) {
      if (pkg.packageName === "L1" || pkg.packageName === "L2") {
        return { originalPrice: def.price, effectivePrice: def.discountedPrice ?? def.price, type: "subsidized" };
      }
      return { originalPrice: def.price, effectivePrice: def.price, type: "full" };
    }

    return { originalPrice: def.price, effectivePrice: Math.round(def.price * 0.9), type: "renewal" };
  });
}

// ─── Duration estimator ───────────────────────────────────────────────────────
// Estimates total days to reach targetWeight using the system's calorie-deficit rates:
// Stage 1: 1% body weight / week | Stage 2: 0.5% body weight / week

function estimateDaysToGoal(
  currentWeight: number,
  targetWeight: number,
  phase1Key: string | null
): number {
  const weightToLose = Math.max(currentWeight - targetWeight, 0);
  if (weightToLose <= 0) return 0;

  let remaining = weightToLose;
  let curW = currentWeight;
  let days = 0;

  if (phase1Key) {
    const p1Days = phase1Key === "L2" ? 80 : 30;
    const lostInPhase1 = Math.min(curW * 0.01 * (p1Days / 7), remaining);
    remaining -= lostInPhase1;
    curW -= lostInPhase1;
    days += p1Days;
  }

  if (remaining > 0) {
    const kgPerWeek = curW * 0.005;
    days += Math.ceil(remaining / kgPerWeek) * 7;
  }

  return days;
}

// ─── Roadmap builder ──────────────────────────────────────────────────────────
// Order is always enforced: Stage 1 → Stage 2 → Stage 3 (L5/Loyalfit always last)

function makePkg(key: string, order: number, isBuffer = false): SelectedPkg {
  const def = PACKAGES[key];
  return {
    packageName: key,
    packageStage: def.stageLabel,
    sessions: def.sessions,
    durationDays: def.durationDays,
    price: def.price,
    discountedPrice: def.discountedPrice ?? null,
    order,
    isConfirmed: true,
    isBuffer,
  };
}

function buildRoadmapOptions(info: Record<string, unknown>): RoadmapOption[] {
  const weight       = Number(info.currentWeight) || 0;
  const height       = Number(info.height) || 0;
  const targetWeight = Number(info.targetWeight) || 0;

  // Stage 1: L1 or L2 based on weight-height delta
  const phase1Key: string | null = (() => {
    if (height > 0 && weight > 0) {
      const diff = weight - height + 100;
      if (diff > 6) return "L2";
      if (diff > 3) return "L1";
    }
    return null;
  })();

  // Stage 3: choose based on estimated journey duration (calorie-deficit science).
  // Journey >= 365 days → L5 (comprehensive 6-month maintenance for long haul).
  // Journey < 365 days  → Loyalfit (lighter 3-month maintenance).
  // Loyalfit requires a prior LDF contract — only eligible when phase1 is present in this roadmap.
  const hasPhase1 = phase1Key !== null;
  const estDays   = (weight > 0 && targetWeight > 0)
    ? estimateDaysToGoal(weight, targetWeight, phase1Key)
    : 0;
  const phase3Key = (!hasPhase1 || estDays >= 365) ? "L5" : "Loyalfit";

  // Build chain: [Stage1?] → [Stage2 L4] → [Stage2 extra L4 buffers] → [Stage3 — always last]
  function buildChain(extraL4Count: number): SelectedPkg[] {
    let o = 1;
    const chain: SelectedPkg[] = [];
    if (phase1Key) chain.push(makePkg(phase1Key, o++));
    chain.push(makePkg("L4", o++));
    for (let i = 0; i < extraL4Count; i++) chain.push(makePkg("L4", o++, true));
    chain.push(makePkg(phase3Key, o++));
    return chain;
  }

  const sumDays = (pkgs: SelectedPkg[]) => pkgs.reduce((s, p) => s + p.durationDays, 0);
  const opt1 = buildChain(2);
  const opt2 = buildChain(1);
  const opt3 = buildChain(0);

  return [
    { num: 1, label: "Toàn diện",  sublabel: "Dài nhất",  totalDays: sumDays(opt1), packages: opt1 },
    { num: 2, label: "Tiêu chuẩn", sublabel: "Vừa phải",  totalDays: sumDays(opt2), packages: opt2 },
    { num: 3, label: "Cơ bản",     sublabel: "Ngắn nhất", totalDays: sumDays(opt3), packages: opt3 },
  ];
}

function detectOptionNum(pkgs: SelectedPkg[]): 1 | 2 | 3 | null {
  if (!pkgs.length) return null;
  const buf = pkgs.filter((p) => p.isBuffer).length;
  if (buf === 2) return 1;
  if (buf === 1) return 2;
  if (buf === 0) return 3;
  return null;
}

// ─── Phase progress table ─────────────────────────────────────────────────────

type PhaseRow = {
  pkgName: string;
  startWeight: number;
  targetWeight: number;
  kgPerWeek: number;
  pctPerWeek: number;
  weeksEst: number;
};

function buildPhaseTable(info: Record<string, unknown>, pkgs: SelectedPkg[]): PhaseRow[] {
  const rows: PhaseRow[] = [];
  let cur = Number(info.currentWeight) || 0;

  for (const pkg of pkgs) {
    const def: PackageDef | undefined = PACKAGES[pkg.packageName];
    if (!def) continue;
    const rate = def.stage === "1" ? 0.01 : def.stage === "2" ? 0.005 : 0;
    if (rate === 0) continue;

    const kgW  = parseFloat((cur * rate).toFixed(2));
    const weeks = pkg.durationDays / 7;
    const end   = Math.max(cur - kgW * weeks, Number(info.targetWeight) || 0);

    rows.push({
      pkgName: pkg.packageName,
      startWeight: cur,
      targetWeight: end,
      kgPerWeek: kgW,
      pctPerWeek: rate * 100,
      weeksEst: Math.round(weeks),
    });
    cur = end;
  }
  return rows;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_COLOR: Record<string, string> = {
  "1": "bg-red-100 text-red-700",
  "2": "bg-blue-100 text-blue-700",
  "3": "bg-green-100 text-green-700",
};

const OPT_THEME: Record<number, { active: string; badge: string; ring: string }> = {
  1: { active: "border-violet-400 bg-violet-50", badge: "bg-violet-100 text-violet-700", ring: "ring-violet-300" },
  2: { active: "border-[#f15b5c] bg-[#fff5f5]",  badge: "bg-[#f15b5c]/10 text-[#f15b5c]", ring: "ring-[#f15b5c]/30" },
  3: { active: "border-blue-400 bg-blue-50",      badge: "bg-blue-100 text-blue-700",      ring: "ring-blue-300"    },
};

// ─── PackageCard ──────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  def,
  pricing,
  confirmed,
  onToggle,
  onViewDetail,
  isReadOnly,
}: {
  pkg: SelectedPkg;
  def: PackageDef;
  pricing: PricingInfo;
  confirmed: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
  isReadOnly: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border-2 p-4 transition-all",
      confirmed ? "border-[#f15b5c] bg-[#fff5f5]" : "border-gray-200 bg-white"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg font-extrabold text-gray-900">{pkg.packageName}</span>
            {pkg.isBuffer ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">Dự phòng</span>
            ) : (
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STAGE_COLOR[def.stage] ?? "bg-gray-100 text-gray-600")}>
                {def.stageLabel}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
            <span>
              <span className="font-bold text-gray-700">{def.sessions}</span> buổi PT
              {def.connectSessions ? ` + ${def.connectSessions} buổi Connect` : ""}
            </span>
            <span>Hạn <span className="font-bold text-gray-700">{def.durationDays}</span> ngày</span>
          </div>

          <div className="mb-2">
            {pricing.type === "subsidized" && (
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-gray-400 line-through">{formatPrice(pricing.originalPrice)}</span>
                <span className="text-sm font-extrabold text-[#f15b5c]">{formatPrice(pricing.effectivePrice)}</span>
                <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Giá trợ giá</span>
              </div>
            )}
            {pricing.type === "full" && (
              <span className="text-sm font-extrabold text-gray-800">{formatPrice(pricing.effectivePrice)}</span>
            )}
            {pricing.type === "renewal" && (
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-gray-400 line-through">{formatPrice(pricing.originalPrice)}</span>
                <span className="text-sm font-extrabold text-[#f15b5c]">{formatPrice(pricing.effectivePrice)} (-10%)</span>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Giá tái ký</span>
              </div>
            )}
          </div>

          {!pkg.isBuffer && <p className="text-xs text-green-700 font-semibold">{def.commitment}</p>}
          <p className="text-xs text-gray-400 mt-0.5">
            {pkg.isBuffer
              ? "Gói dự phòng — hỗ trợ khách hàng trong giai đoạn chuyển tiếp hoặc khi cần thêm thời gian đạt mục tiêu"
              : def.conditions}
          </p>
          {pkg.packageName === "Loyalfit" && (
            <p className="text-xs text-amber-600 font-semibold mt-1.5 flex items-start gap-1">
              <span>⚠️</span>
              <span>Chỉ dành cho khách hàng đã từng mua gói tập tại LDF</span>
            </p>
          )}
          <button onClick={onViewDetail} className="mt-2 text-xs font-bold text-[#f15b5c] hover:underline">
            Xem chi tiết →
          </button>
        </div>

        {!isReadOnly && (
          <button
            onClick={onToggle}
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all",
              confirmed ? "bg-[#f15b5c] border-[#f15b5c]" : "bg-white border-gray-300"
            )}
          >
            {confirmed && <Check className="w-3.5 h-3.5 text-white" />}
          </button>
        )}
        {isReadOnly && confirmed && (
          <div className="w-6 h-6 rounded-full bg-[#f15b5c] flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Step5Sales({
  consultation,
  isReadOnly,
  onDraft,
  onPrev,
}: {
  consultation: ConsultationData;
  isReadOnly: boolean;
  onDraft: (p: Record<string, unknown>) => Promise<void>;
  onPrev: () => void;
  onComplete: () => void;
}) {
  const router = useRouter();
  const info         = (consultation.info ?? {}) as Record<string, unknown>;
  const existingPkgs = consultation.packages as SelectedPkg[];

  // Build 3 options once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roadmapOptions = useMemo(() => buildRoadmapOptions(info), []);

  const initialOptionNum = useMemo(() => detectOptionNum(existingPkgs), []);  // eslint-disable-line

  const [selectedOptionNum, setSelectedOptionNum] = useState<1 | 2 | 3 | null>(initialOptionNum);

  // If existing packages saved, use them directly (preserves confirmed state).
  // If no existing packages, start empty — user must pick an option.
  const [packages, setPackages] = useState<SelectedPkg[]>(existingPkgs.length > 0 ? existingPkgs : []);

  const [completing, setCompleting]     = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [saving, setSaving]             = useState(false);
  const [detailPkg, setDetailPkg]       = useState<string | null>(null);

  function selectOption(opt: RoadmapOption) {
    setSelectedOptionNum(opt.num);
    setPackages(opt.packages);
  }

  function toggleConfirm(i: number) {
    setPackages((prev) => prev.map((p, idx) => idx === i ? { ...p, isConfirmed: !p.isConfirmed } : p));
  }

  const phaseRows    = useMemo(() => buildPhaseTable(info, packages.filter((p) => p.isConfirmed)), [packages, info]);
  const allPricing   = useMemo(() => computePricing(packages), [packages]);

  const weightToLose   = (Number(info.currentWeight) || 0) - (Number(info.targetWeight) || 0);
  const initialWeight  = Number(info.currentWeight) || 0;
  const transformTarget = initialWeight - 7;
  const infoHeight     = Number(info.height) || 0;
  const weightDiff     = infoHeight > 0 && initialWeight > 0 ? initialWeight - infoHeight + 100 : null;

  const confirmedPkgs    = packages.filter((p) => p.isConfirmed);
  const loyalfitOnly     = confirmedPkgs.length > 0 && confirmedPkgs.every((p) => p.packageName === "Loyalfit");
  const confirmedPricing = allPricing.filter((_, i) => packages[i]?.isConfirmed);
  const totalPrice       = confirmedPricing.reduce((s, p) => s + p.originalPrice, 0);
  const totalDiscounted  = confirmedPricing.reduce((s, p) => s + p.effectivePrice, 0);

  async function handleDraft() {
    setSaving(true);
    await onDraft({ packages });
    setSaving(false);
  }

  async function handleComplete() {
    setCompleting(true);
    setCompleteError("");
    try {
      await onDraft({ packages });
      const res  = await fetch(`/api/consultation/${consultation.id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      router.push(`/dashboard/clients/${data.clientId}`);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setCompleting(false);
    }
  }

  return (
    <>
      <div className="divide-y divide-gray-50">

        {/* Phase 1 analysis */}
        {weightDiff !== null && (
          <div className="p-5">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-blue-500 mb-1">Phân tích chỉ số Giai đoạn 1:</p>
              <p className="text-sm font-semibold text-blue-800">
                {initialWeight} − {infoHeight} + 100 = <span className="font-extrabold">{weightDiff.toFixed(1)} kg</span>
              </p>
              {weightDiff > 6 ? (
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Đủ điều kiện L2 ✓
                </span>
              ) : weightDiff > 3 ? (
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Đủ điều kiện L1 ✓
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">
                  ℹ️ Khách hàng phù hợp bắt đầu từ Giai đoạn 2
                </span>
              )}
            </div>
          </div>
        )}

        {/* 3-option selector — hidden in read-only mode */}
        {!isReadOnly && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-[#f15b5c]" />
              <p className="text-sm font-extrabold text-gray-800">Chọn lộ trình tập luyện</p>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Ấn chọn một trong 3 lộ trình để xem danh sách gói tập tương ứng
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {roadmapOptions.map((opt) => {
                const theme     = OPT_THEME[opt.num];
                const isSelected = selectedOptionNum === opt.num;
                const months    = Math.round(opt.totalDays / 30);
                const pkgNames  = opt.packages.map((p) => p.packageName).join(" → ");

                return (
                  <button
                    key={opt.num}
                    onClick={() => selectOption(opt)}
                    className={cn(
                      "text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md",
                      isSelected
                        ? `${theme.active} ring-2 ${theme.ring}`
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        isSelected ? theme.badge : "bg-gray-100 text-gray-500"
                      )}>
                        OPTION {opt.num}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#f15b5c]" />}
                    </div>
                    <p className="text-base font-extrabold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400 font-semibold mb-3">{opt.sublabel}</p>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm font-bold text-gray-700">~{months} tháng</span>
                      <span className="text-xs text-gray-400">({opt.totalDays} ngày)</span>
                    </div>
                    <p className="text-[10px] font-semibold text-gray-500 leading-relaxed">{pkgNames}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Package list — revealed after option selection */}
        <div className="p-5">
          {isReadOnly && (
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-[#f15b5c]" />
              <p className="text-sm font-extrabold text-gray-800">Lộ trình được đề xuất</p>
            </div>
          )}

          {!isReadOnly && selectedOptionNum === null ? (
            <div className="py-14 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center gap-3">
              <Package className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-semibold text-gray-300">Chọn một lộ trình ở trên để xem các gói tập</p>
            </div>
          ) : packages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Không có lộ trình phù hợp với thông tin hiện tại</p>
          ) : (
            <>
              <div className="space-y-3">
                {packages.map((pkg, i) => {
                  const def     = PACKAGES[pkg.packageName];
                  const pricing = allPricing[i];
                  if (!def || !pricing) return null;
                  return (
                    <PackageCard
                      key={`${pkg.packageName}-${i}`}
                      pkg={pkg}
                      def={def}
                      pricing={pricing}
                      confirmed={pkg.isConfirmed}
                      onToggle={() => toggleConfirm(i)}
                      onViewDetail={() => setDetailPkg(pkg.packageName)}
                      isReadOnly={isReadOnly}
                    />
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                * Thứ tự: Giai đoạn 1 → Giai đoạn 2 → Giai đoạn 3 | L4 dự phòng đảm bảo thời gian đạt mục tiêu | Loyalfit giữ nguyên giá gốc
              </p>
            </>
          )}
        </div>

        {/* Body fat + Transform Gallery */}
        <div className="border-t border-gray-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
            <BodyFatCard info={info} />
            <TransformGallery />
          </div>
        </div>

        {/* Phase progress table */}
        {phaseRows.length > 0 && (
          <div className="p-5">
            <p className="text-sm font-extrabold text-gray-800 mb-3">Tốc độ giảm cân dự kiến</p>
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Giai đoạn", "Bắt đầu", "Mục tiêu GĐ", "kg/tuần", "% /tuần", "Số tuần"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {phaseRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2.5 text-xs font-semibold text-gray-700">{row.pkgName}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{row.startWeight.toFixed(1)} kg</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{row.targetWeight.toFixed(1)} kg</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-gray-800">{row.kgPerWeek} kg</td>
                      <td className="px-3 py-2.5 text-xs font-extrabold" style={{ color: "#f15b5c" }}>{row.pctPerWeek}%</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{row.weeksEst} tuần</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transform milestone */}
        <div className="p-5">
          {weightToLose >= 7 ? (
            <div className="bg-[#fff5f5] border border-[#f15b5c]/20 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-[#f15b5c]">🌟 Khách hàng sẽ đạt Transform khi giảm được 7 kg</p>
              <p className="text-xs text-gray-500 mt-0.5">Từ {initialWeight} kg xuống {transformTarget} kg</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-gray-500">
                Mục tiêu chưa đạt ngưỡng Transform (cần giảm tối thiểu 7 kg)
              </p>
            </div>
          )}
        </div>

        {/* Investment summary */}
        {confirmedPkgs.length > 0 && (
          <div className="p-5">
            <p className="text-sm font-extrabold text-gray-800 mb-3">Tổng đầu tư</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">Giá niêm yết</p>
                <p className="text-lg font-extrabold text-gray-800">{formatPrice(totalPrice)}</p>
              </div>
              <div className="bg-[#fff5f5] rounded-xl p-3">
                <p className="text-xs text-gray-400 font-semibold mb-1">Thực tế</p>
                <p className="text-lg font-extrabold text-[#f15b5c]">{formatPrice(totalDiscounted)}</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
              * L1, L2 áp dụng giá trợ giá | Loyalfit giữ nguyên giá gốc | Từ hợp đồng thứ 2 giảm 10%
            </p>
            <p className="text-xs text-gray-400 mt-1 font-semibold">{confirmedPkgs.length} gói đã xác nhận</p>
          </div>
        )}

        {/* Loyalfit-only guard */}
        {!isReadOnly && loyalfitOnly && (
          <div className="px-5">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-700 font-semibold">
                ⚠️ Loyalfit yêu cầu khách hàng đã có ít nhất 1 lộ trình trước đó
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Thêm ít nhất 1 gói khác (L1–L5) vào lộ trình trước khi hoàn thành tư vấn.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {completeError && (
          <div className="px-5">
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-[#f15b5c] font-semibold">{completeError}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 flex gap-3">
          <button
            onClick={onPrev}
            className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            ← Quay lại
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={handleDraft}
                disabled={saving}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu nháp"}
              </button>
              <button
                onClick={handleComplete}
                disabled={completing || confirmedPkgs.length === 0 || loyalfitOnly}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {completing ? "Đang xử lý..." : "✓ Hoàn thành tư vấn"}
              </button>
            </>
          )}
          {isReadOnly && (
            consultation.convertedClientId ? (
              <Link
                href={`/dashboard/clients/${consultation.convertedClientId}`}
                className="h-10 px-5 rounded-xl text-white text-sm font-bold inline-flex items-center"
                style={{ backgroundColor: "#f15b5c" }}
              >
                Xem hồ sơ khách hàng
              </Link>
            ) : (
              <span className="text-xs text-gray-400 italic">Chưa có hồ sơ khách hàng</span>
            )
          )}
        </div>
      </div>

      {detailPkg && (
        <PackageDetailModal
          packageName={detailPkg}
          info={info}
          onClose={() => setDetailPkg(null)}
        />
      )}
    </>
  );
}
