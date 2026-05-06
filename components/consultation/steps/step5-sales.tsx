"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGES, formatPrice, type PackageDef } from "@/lib/packages";
import type { ConsultationData } from "../consultation-wizard";
import { PackageDetailModal } from "./package-detail-modal";
import { BodyFatCard } from "./body-fat-card";
import { TransformGallery } from "./transform-gallery";

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

function computePricing(pkgs: SelectedPkg[]): PricingInfo[] {
  return pkgs.map((pkg, index) => {
    const def = PACKAGES[pkg.packageName];
    if (!def) return { originalPrice: 0, effectivePrice: 0, type: "full" };

    if (index === 0) {
      if (pkg.packageName === "L1" || pkg.packageName === "L2") {
        return { originalPrice: def.price, effectivePrice: def.discountedPrice ?? def.price, type: "subsidized" };
      }
      return { originalPrice: def.price, effectivePrice: def.price, type: "full" };
    }

    return { originalPrice: def.price, effectivePrice: Math.round(def.price * 0.9), type: "renewal" };
  });
}

function parseBudget(budget: string | undefined): number {
  if (!budget) return 0;
  if (budget.includes("Trên 50")) return 60_000_000;
  if (budget.includes("30–50") || budget.includes("30-50")) return 40_000_000;
  if (budget.includes("20–30") || budget.includes("20-30")) return 25_000_000;
  if (budget.includes("10–20") || budget.includes("10-20")) return 15_000_000;
  return 8_000_000;
}

function recommendPackages(info: Record<string, unknown>): SelectedPkg[] {
  const weight = Number(info.currentWeight) || 0;
  const height = Number(info.height) || 0;
  const budget = parseBudget(info.budget as string);

  const result: SelectedPkg[] = [];
  let order = 1;

  // Phase 1: weightDiff = currentWeight - (height - 100)
  if (height > 0 && weight > 0) {
    const weightDiff = weight - height + 100;
    if (weightDiff > 6) {
      const p = PACKAGES.L2;
      result.push({ packageName: "L2", packageStage: p.stageLabel, sessions: p.sessions, durationDays: p.durationDays, price: p.price, discountedPrice: p.discountedPrice ?? null, order: order++, isConfirmed: true });
    } else if (weightDiff > 3) {
      const p = PACKAGES.L1;
      result.push({ packageName: "L1", packageStage: p.stageLabel, sessions: p.sessions, durationDays: p.durationDays, price: p.price, discountedPrice: p.discountedPrice ?? null, order: order++, isConfirmed: true });
    }
    // weightDiff <= 3: skip Phase 1
  }

  // Phase 2
  const useL4 = budget >= 45_000_000;
  const phase2Key = useL4 ? "L4" : "L3";
  const p2 = PACKAGES[phase2Key];
  result.push({ packageName: phase2Key, packageStage: p2.stageLabel, sessions: p2.sessions, durationDays: p2.durationDays, price: p2.price, discountedPrice: p2.discountedPrice ?? null, order: order++, isConfirmed: true });

  // Phase 3: Loyalfit requires at least one prior package — if it would be alone, use L5
  const hasPhase1 = result.length > 0;
  const useL5 = budget >= 30_000_000 || !hasPhase1;
  const phase3Key = useL5 ? "L5" : "Loyalfit";
  const p3 = PACKAGES[phase3Key];
  result.push({ packageName: phase3Key, packageStage: p3.stageLabel, sessions: p3.sessions, durationDays: p3.durationDays, price: p3.price, discountedPrice: p3.discountedPrice ?? null, order: order++, isConfirmed: true });

  // Safety guard: Loyalfit must never be the sole package in the list
  if (result.length === 1 && result[0].packageName === "Loyalfit") {
    const p = PACKAGES.L5;
    result[0] = { packageName: "L5", packageStage: p.stageLabel, sessions: p.sessions, durationDays: p.durationDays, price: p.price, discountedPrice: p.discountedPrice ?? null, order: 1, isConfirmed: true };
  }

  // Append buffer L4 at the end of every roadmap
  const pBuf = PACKAGES.L4;
  result.push({ packageName: "L4", packageStage: pBuf.stageLabel, sessions: pBuf.sessions, durationDays: pBuf.durationDays, price: pBuf.price, discountedPrice: pBuf.discountedPrice ?? null, order: order++, isConfirmed: true, isBuffer: true });

  return result;
}

type PhaseRow = {
  stage: string;
  pkgName: string;
  startWeight: number;
  targetWeight: number;
  kgPerWeek: number;
  pctPerWeek: number;
  weeksEst: number;
};

function buildPhaseTable(info: Record<string, unknown>, pkgs: SelectedPkg[]): PhaseRow[] {
  const rows: PhaseRow[] = [];
  let currentW = Number(info.currentWeight) || 0;

  for (const pkg of pkgs) {
    const def: PackageDef | undefined = PACKAGES[pkg.packageName];
    if (!def) continue;

    const rate = def.stage === "1" ? 0.01 : def.stage === "2" ? 0.005 : 0;
    if (rate === 0) continue;

    const kgPerWeek = parseFloat((currentW * rate).toFixed(2));
    const pctPerWeek = rate * 100;
    const durationWeeks = pkg.durationDays / 7;
    const kgLost = kgPerWeek * durationWeeks;
    const endWeight = Math.max(currentW - kgLost, Number(info.targetWeight) || 0);

    rows.push({
      stage: def.stageLabel,
      pkgName: pkg.packageName,
      startWeight: currentW,
      targetWeight: endWeight,
      kgPerWeek,
      pctPerWeek,
      weeksEst: Math.round(durationWeeks),
    });

    currentW = endWeight;
  }

  return rows;
}

const STAGE_COLOR: Record<string, string> = {
  "1": "bg-red-100 text-red-700",
  "2": "bg-blue-100 text-blue-700",
  "3": "bg-green-100 text-green-700",
};

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
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                Dự phòng
              </span>
            ) : (
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STAGE_COLOR[def.stage] ?? "bg-gray-100 text-gray-600")}>
                {def.stageLabel}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
            <span><span className="font-bold text-gray-700">{def.sessions}</span> buổi PT{def.connectSessions ? ` + ${def.connectSessions} buổi Connect` : ""}</span>
            <span>Hạn <span className="font-bold text-gray-700">{def.durationDays}</span> ngày</span>
          </div>

          {/* Price display */}
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
              ? "Gói dự phòng - hỗ trợ khách hàng trong giai đoạn chuyển tiếp hoặc khi cần thêm thời gian đạt mục tiêu"
              : def.conditions}
          </p>
          {pkg.packageName === "Loyalfit" && (
            <p className="text-xs text-amber-600 font-semibold mt-1.5 flex items-start gap-1">
              <span>⚠️</span>
              <span>Chỉ dành cho khách hàng đã từng mua gói tập tại LDF</span>
            </p>
          )}
          <button
            onClick={onViewDetail}
            className="mt-2 text-xs font-bold text-[#f15b5c] hover:underline"
          >
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
  const info = (consultation.info ?? {}) as Record<string, unknown>;
  const existingPkgs = consultation.packages as SelectedPkg[];

  const recommended = useMemo(() => {
    const fresh = recommendPackages(info);
    if (existingPkgs.length === 0) return fresh;
    // Always use fresh algorithm; preserve PT's confirmed/unconfirmed selections
    return fresh.map((pkg) => {
      const saved = existingPkgs.find((e) => e.packageName === pkg.packageName);
      return saved ? { ...pkg, isConfirmed: saved.isConfirmed } : pkg;
    });
  }, []);

  const [packages, setPackages] = useState<SelectedPkg[]>(recommended);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailPkg, setDetailPkg] = useState<string | null>(null);

  function toggleConfirm(i: number) {
    setPackages((prev) => prev.map((p, idx) => idx === i ? { ...p, isConfirmed: !p.isConfirmed } : p));
  }

  const phaseRows = useMemo(() => buildPhaseTable(info, packages.filter((p) => p.isConfirmed)), [packages, info]);

  const weightToLose = (Number(info.currentWeight) || 0) - (Number(info.targetWeight) || 0);
  const initialWeight = Number(info.currentWeight) || 0;
  const transformTarget = initialWeight - 7;
  const infoHeight = Number(info.height) || 0;
  const weightDiff = infoHeight > 0 && initialWeight > 0 ? initialWeight - infoHeight + 100 : null;

  const confirmedPkgs = packages.filter((p) => p.isConfirmed);
  const loyalfitOnly =
    confirmedPkgs.length > 0 &&
    confirmedPkgs.every((p) => p.packageName === "Loyalfit");
  const allPricing = useMemo(() => computePricing(packages), [packages]);
  const confirmedPricing = allPricing.filter((_, i) => packages[i]?.isConfirmed);
  const totalPrice = confirmedPricing.reduce((s, p) => s + p.originalPrice, 0);
  const totalDiscounted = confirmedPricing.reduce((s, p) => s + p.effectivePrice, 0);

  async function handleDraft() {
    setSaving(true);
    await onDraft({ packages });
    setSaving(false);
  }

  async function handleComplete() {
    setCompleting(true);
    setCompleteError("");
    try {
      // Save packages first
      await onDraft({ packages });

      const res = await fetch(`/api/consultation/${consultation.id}/complete`, { method: "POST" });
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
      {/* Section 1: Recommended packages */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-[#f15b5c]" />
          <p className="text-sm font-extrabold text-gray-800">Lộ trình được đề xuất</p>
        </div>

        {weightDiff !== null && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
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
        )}

        {packages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Không có lộ trình phù hợp với thông tin hiện tại</p>
        ) : (
          <>
            <div className="space-y-3">
              {packages.map((pkg, i) => {
                const def = PACKAGES[pkg.packageName];
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
              * Gói L4 dự phòng được thêm tự động để đảm bảo khách hàng có đủ thời gian đạt mục tiêu
            </p>
          </>
        )}
      </div>

      {/* Section 2: Body fat + Transform Gallery */}
      <div className="border-t border-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
          <BodyFatCard info={info} />
          <TransformGallery />
        </div>
      </div>

      {/* Section 3: Phase progress table */}
      {phaseRows.length > 0 && (
        <div className="p-5">
          <p className="text-sm font-extrabold text-gray-800 mb-3">Tốc độ giảm cân dự kiến</p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
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
                    <td className="px-3 py-2.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{row.pkgName}</td>
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

      {/* Section 3: Transform note */}
      <div className="p-5">
        {weightToLose >= 7 ? (
          <div className="bg-[#fff5f5] border border-[#f15b5c]/20 rounded-xl px-4 py-3">
            <p className="text-sm font-bold text-[#f15b5c]">
              🌟 Khách hàng sẽ đạt Transform khi giảm được 7 kg
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Từ {initialWeight} kg xuống {transformTarget} kg
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-gray-500">
              Mục tiêu chưa đạt ngưỡng Transform (cần giảm tối thiểu 7 kg)
            </p>
          </div>
        )}
      </div>

      {/* Section 4: Summary */}
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
            * L1, L2 áp dụng giá trợ giá | Từ hợp đồng thứ 2 giảm 10%
          </p>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            {confirmedPkgs.length} gói đã xác nhận
          </p>
        </div>
      )}

      {/* Loyalfit-only warning */}
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
        <button onClick={onPrev} className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          ← Quay lại
        </button>
        {!isReadOnly && (
          <>
            <button onClick={handleDraft} disabled={saving} className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
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
            <button
              onClick={() => router.push(`/dashboard/clients/${consultation.convertedClientId}`)}
              className="h-10 px-5 rounded-xl text-white text-sm font-bold"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Xem hồ sơ khách hàng
            </button>
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
