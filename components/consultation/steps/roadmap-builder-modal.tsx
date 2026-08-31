"use client";

import { useMemo, useState } from "react";
import { X, Plus, Clock, ArrowLeft, Lock, Trash2, Check, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGES, formatPrice } from "@/lib/packages";
import { PRICE_TYPE_LABEL, priceRoadmap, quoteTotals } from "@/lib/roadmap-pricing";
import {
  ROADMAP_PACKAGES,
  ROADMAP_PHASES,
  checkPick,
  fmtDuration,
  phaseOf,
  sumDays,
  weightMargin,
  type PhaseNum,
  type RoadmapProfile,
} from "@/lib/roadmap-phases";

/**
 * ── Thiết lập lộ trình ───────────────────────────────────────────────────────
 *
 * Ba giai đoạn vẽ thành bậc thang theo lối mô hình OPT của NASM: bậc thấp nhất
 * bên trái là nền tảng, leo dần sang phải tới bậc duy trì. Tư vấn viên ghép gói
 * vào từng bậc bằng dấu cộng mờ, mỗi bậc bao nhiêu gói cũng được.
 *
 * Bậc thang là mô hình huấn luyện chứ không phải giai đoạn thương mại của gói,
 * nên bậc nào cũng chọn được cả 7 gói (L0 → Loyalfit). Chỉ điều kiện thật của
 * gói mới khoá: Loyalfit không được mở đầu lộ trình, L1/L2 cần khách đủ cân,
 * gói chỉ mua 1 lần thì không ghép hai lần. Gói bị khoá vẫn hiện kèm lý do, để
 * tư vấn viên giải thích được với khách thay vì thấy gói tự nhiên biến mất.
 *
 * Thời lượng cộng dồn hiện ngay cạnh tên mỗi bậc; tổng ba bậc nằm trên tiêu đề.
 *
 * Màn dựng lộ trình cố tình KHÔNG hiện giá: lúc đang xếp bậc thì thứ cần nhìn
 * là chuyên môn và thời lượng, chứ chưa phải tiền. Tiền nằm sau nút Báo giá ở
 * cuối modal, mở ra khi lộ trình đã có gói.
 */

/** Một gói đang nằm trên lộ trình, kèm bậc mà nó được xếp vào. */
export type RoadmapPick = { packageName: string; phase: PhaseNum };

type PhasePicks = Record<PhaseNum, string[]>;

const EMPTY_PICKS: PhasePicks = { 1: [], 2: [], 3: [] };

/**
 * Chiều cao cổ bậc: bậc 1 thụt xuống thấp nhất, bậc 3 lên cao nhất. Viết thẳng
 * ra thành class tĩnh để Tailwind sinh được — dựng bằng biến thì JIT bỏ qua.
 */
const RISER_CLASS = ["sm:pt-[88px]", "sm:pt-[44px]", "sm:pt-0"];

/**
 * Xếp lộ trình đang có lên bậc thang.
 *
 * Ưu tiên bậc đã lưu; gói nào chưa có bậc (lộ trình lưu từ trước khi có bậc
 * thang) thì xếp tạm theo giai đoạn thương mại của gói.
 */
function groupByPhase(picked: { packageName: string; phase?: number | null }[]): PhasePicks {
  const picks: PhasePicks = { 1: [], 2: [], 3: [] };
  for (const item of picked) {
    const saved = item.phase;
    const num =
      saved === 1 || saved === 2 || saved === 3 ? (saved as PhaseNum) : phaseOf(item.packageName);
    if (num) picks[num].push(item.packageName);
  }
  return picks;
}

/** Toàn bộ lộ trình duỗi thẳng theo thứ tự bậc 1 → 3, kèm bậc của từng gói. */
function flatten(picks: PhasePicks): RoadmapPick[] {
  return ROADMAP_PHASES.flatMap((phase) =>
    picks[phase.num].map((packageName) => ({ packageName, phase: phase.num }))
  );
}

// ─── Thẻ gói đã ghép ──────────────────────────────────────────────────────────

function PickedCard({
  packageName,
  onRemove,
}: {
  packageName: string;
  onRemove: (() => void) | null;
}) {
  const def = PACKAGES[packageName];
  if (!def) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{def.name}</p>
          <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
            {def.sessions} buổi · {def.durationDays} ngày
          </p>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Bỏ gói ${def.name} khỏi lộ trình`}
            className="shrink-0 rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Một bậc thang ────────────────────────────────────────────────────────────

function PhaseStep({
  phase,
  picks,
  isReadOnly,
  onAdd,
  onRemove,
}: {
  phase: (typeof ROADMAP_PHASES)[number];
  picks: string[];
  isReadOnly: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const days = sumDays(picks);
  const duration = fmtDuration(days);

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border-2 shadow-sm",
        phase.theme.border,
        phase.theme.surface
      )}
    >
      {/* Mặt bậc — dải màu đậm trên đầu, cho ra dáng bậc thang */}
      <div className={cn("h-2 w-full shrink-0", phase.theme.tread)} />

      <div className="flex min-w-0 flex-1 flex-col px-3 py-3">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white",
              phase.theme.badge
            )}
          >
            {phase.num}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-extrabold leading-snug", phase.theme.text)}>
              {phase.name}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-400 leading-snug">
              {phase.tagline}
            </p>
          </div>
        </div>

        {/* Bộ đếm thời gian — chỉ hiện khi bậc này đã có gói */}
        {duration && (
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[11px] font-extrabold text-gray-700 tabular-nums">
            <Clock className="h-3 w-3 text-gray-400" />
            {duration}
          </span>
        )}

        <div className="mt-3 flex flex-1 flex-col gap-2">
          {picks.map((name, i) => (
            <PickedCard
              key={`${name}-${i}`}
              packageName={name}
              onRemove={isReadOnly ? null : () => onRemove(i)}
            />
          ))}

          {isReadOnly ? (
            picks.length === 0 && (
              <p className="py-4 text-center text-xs font-semibold text-gray-300">
                Chưa ghép gói nào
              </p>
            )
          ) : (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Thêm gói vào ${phase.name}`}
              className="flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#f15b5c]/25 text-[#f15b5c]/45 transition-all hover:border-[#f15b5c]/70 hover:bg-[#f15b5c]/5 hover:text-[#f15b5c]"
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs font-bold">Ghép gói tập</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Danh sách gói để chọn ────────────────────────────────────────────────────

function PackagePicker({
  phase,
  profile,
  chosenBefore,
  chosenAll,
  onPick,
  onBack,
}: {
  phase: (typeof ROADMAP_PHASES)[number];
  profile: RoadmapProfile;
  chosenBefore: string[];
  chosenAll: string[];
  onPick: (packageName: string) => void;
  onBack: () => void;
}) {
  const margin = weightMargin(profile);

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-white">
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại bậc thang"
          className="mt-0.5 shrink-0 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-gray-900">
            Giai đoạn {phase.num} · {phase.name}
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-gray-400">
            Gói nào cũng ghép vào bậc này được, ghép bao nhiêu gói cũng được
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4 sm:px-6">
        {margin !== null && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-blue-800">
              Khách dư <span className="font-extrabold">{margin.toFixed(1)} kg</span> so với chiều
              cao ({profile.weight} − {profile.height} + 100) — đây là điều kiện vào gói L1 / L2.
            </p>
          </div>
        )}
        {margin === null && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-amber-700">
              Chưa có cân nặng / chiều cao của khách nên chưa kiểm được điều kiện L1, L2. Kiểm tra
              lại điều kiện từng gói trước khi chốt.
            </p>
          </div>
        )}

        {ROADMAP_PACKAGES.map((key) => {
          const def = PACKAGES[key];
          if (!def) return null;
          const check = checkPick(key, { profile, chosenBefore, chosenAll });
          const blocked = !check.ok;

          return (
            <button
              key={key}
              type="button"
              disabled={blocked}
              onClick={() => onPick(key)}
              className={cn(
                "w-full rounded-2xl border-2 p-3.5 text-left transition-all",
                blocked
                  ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-70"
                  : "border-gray-200 bg-white hover:border-[#f15b5c] hover:bg-[#fff5f5] hover:shadow-md"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-base font-extrabold",
                        blocked ? "text-gray-400" : "text-gray-900"
                      )}
                    >
                      {def.name}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        blocked ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {def.sessions} buổi · {def.durationDays} ngày
                    </span>
                  </div>

                  <p
                    className={cn(
                      "mt-1 text-xs font-semibold leading-snug",
                      blocked ? "text-gray-400" : "text-green-700"
                    )}
                  >
                    {def.commitment}
                  </p>

                  {blocked && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-bold text-red-500">
                      <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
                      {check.reason}
                    </p>
                  )}
                </div>

                {!blocked && (
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f15b5c]/10 text-[#f15b5c]">
                    <Plus className="h-4 w-4" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Báo giá ──────────────────────────────────────────────────────────────────

/**
 * Tổng chi phí của lộ trình đang dựng.
 *
 * Giá phụ thuộc VỊ TRÍ của gói trong lộ trình (gói đầu được trợ giá, từ gói thứ
 * hai trở đi giảm 10% tái ký) nên phải tính trên cả chuỗi chứ không cộng giá
 * từng gói rời. Công thức nằm ở lib/roadmap-pricing, dùng chung với bảng gói ở
 * bước Tư vấn lộ trình.
 */
function QuotePanel({
  packageNames,
  onBack,
}: {
  packageNames: string[];
  onBack: () => void;
}) {
  const lines = priceRoadmap(packageNames);
  const totals = quoteTotals(lines);

  return (
    <div className="absolute inset-0 z-10 flex flex-col rounded-2xl bg-white">
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại bậc thang"
          className="mt-0.5 shrink-0 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-gray-900">
            <Receipt className="h-4 w-4 text-[#f15b5c]" />
            Báo giá lộ trình
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-gray-400">
            {lines.length} gói đã ghép trên bậc thang
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4 sm:px-6">
        {lines.map((line, i) => {
          const def = PACKAGES[line.packageName];
          const discounted = line.effectivePrice < line.originalPrice;
          return (
            <div
              key={`${line.packageName}-${i}`}
              className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">{line.packageName}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                  {def ? `${def.sessions} buổi · ${def.durationDays} ngày` : "—"}
                </p>
                <span
                  className={cn(
                    "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                    line.type === "subsidized"
                      ? "bg-orange-100 text-orange-600"
                      : line.type === "renewal"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-gray-100 text-gray-500"
                  )}
                >
                  {PRICE_TYPE_LABEL[line.type]}
                </span>
              </div>
              <div className="shrink-0 text-right">
                {discounted && (
                  <p className="text-[11px] font-semibold text-gray-400 line-through">
                    {formatPrice(line.originalPrice)}
                  </p>
                )}
                <p
                  className={cn(
                    "text-sm font-extrabold",
                    discounted ? "text-[#f15b5c]" : "text-gray-800"
                  )}
                >
                  {line.effectivePrice > 0 ? formatPrice(line.effectivePrice) : "Miễn phí"}
                </p>
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border-2 border-[#f15b5c]/25 bg-[#fff5f5] p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-500">Tổng chi phí lộ trình</p>
              {totals.saved > 0 && (
                <p className="mt-0.5 text-[11px] font-semibold text-gray-400">
                  Giá gốc {formatPrice(totals.original)} — đã giảm{" "}
                  <span className="font-bold text-[#f15b5c]">{formatPrice(totals.saved)}</span>
                </p>
              )}
            </div>
            <p className="shrink-0 text-2xl font-extrabold text-[#f15b5c]">
              {formatPrice(totals.effective)}
            </p>
          </div>
        </div>

        <p className="pt-1 text-[11px] leading-relaxed text-gray-400">
          Giá trợ giá chỉ áp dụng cho gói Giai đoạn 1 (L1 / L2) khi đứng đầu lộ trình. Từ gói
          thứ hai trở đi khách được giảm 10% giá tái ký, riêng Loyalfit luôn tính nguyên giá.
        </p>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function RoadmapBuilderModal({
  info,
  picked,
  isReadOnly,
  onClose,
  onApply,
}: {
  info: Record<string, unknown>;
  /** Lộ trình đang có — dùng làm điểm bắt đầu để sửa tiếp. */
  picked: { packageName: string; phase?: number | null }[];
  isReadOnly: boolean;
  onClose: () => void;
  /** Trả về danh sách gói kèm bậc, đã xếp theo thứ tự bậc 1 → 3. */
  onApply: (picks: RoadmapPick[]) => void;
}) {
  const profile: RoadmapProfile = useMemo(
    () => ({
      weight: Number(info.currentWeight) || 0,
      height: Number(info.height) || 0,
    }),
    [info]
  );

  const [picks, setPicks] = useState<PhasePicks>(() =>
    picked.length > 0 ? groupByPhase(picked) : EMPTY_PICKS
  );
  const [pickerPhase, setPickerPhase] = useState<PhaseNum | null>(null);
  const [showQuote, setShowQuote] = useState(false);

  const flat = flatten(picks);
  const flatNames = flat.map((x) => x.packageName);
  const totalDays = sumDays(flatNames);
  const totalLabel = fmtDuration(totalDays);

  function addTo(phaseNum: PhaseNum, packageName: string) {
    setPicks((prev) => ({ ...prev, [phaseNum]: [...prev[phaseNum], packageName] }));
    setPickerPhase(null);
  }

  function removeFrom(phaseNum: PhaseNum, index: number) {
    setPicks((prev) => ({
      ...prev,
      [phaseNum]: prev[phaseNum].filter((_, i) => i !== index),
    }));
  }

  const activePhase = pickerPhase ? ROADMAP_PHASES.find((p) => p.num === pickerPhase) : null;
  // Gói nào đứng trước vị trí sắp thêm — Loyalfit dựa vào đây để biết mình có
  // phải gói mở đầu lộ trình không.
  const chosenBefore = activePhase
    ? ROADMAP_PHASES.filter((p) => p.num < activePhase.num).flatMap((p) => picks[p.num])
        .concat(picks[activePhase.num])
    : [];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto relative flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl bg-white font-sans shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b border-gray-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-gray-900">Thiết lập lộ trình</h2>
                {totalLabel && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#f15b5c]/10 px-2 py-1 text-xs font-extrabold text-[#f15b5c] tabular-nums">
                    <Clock className="h-3.5 w-3.5" />
                    Tổng {totalLabel}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-semibold text-gray-400">
                Ghép gói vào từng bậc — nền tảng trước, phát triển sau, rồi tới duy trì
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

          {/* Body — bậc thang */}
          <div className="relative flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {/*
              Màn hình rộng: ba cột kéo bằng chiều cao (align-items mặc định là
              stretch), cổ bậc là phần padding-top khác nhau của từng cột — nên
              chân ba thẻ nằm trên một đường còn đỉnh so le dần lên, đúng dáng
              bậc thang. Đừng đổi sang items-end: lúc đó thẻ tự co theo nội dung
              và padding-top không đẩy được thẻ xuống nữa, bậc thang biến mất.
              Màn hẹp: xếp dọc 1 → 3, bỏ so le vì nhét ba cột vào bề ngang điện
              thoại thì bậc nào cũng bẹp.
            */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
              {ROADMAP_PHASES.map((phase, i) => (
                <div key={phase.num} className={cn("min-w-0 flex-1", RISER_CLASS[i])}>
                  <PhaseStep
                    phase={phase}
                    picks={picks[phase.num]}
                    isReadOnly={isReadOnly}
                    onAdd={() => setPickerPhase(phase.num)}
                    onRemove={(index) => removeFrom(phase.num, index)}
                  />
                </div>
              ))}
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
              Lộ trình luôn chạy theo thứ tự Giai đoạn 1 → 2 → 3. Gói không đủ điều kiện vẫn hiện
              trong danh sách nhưng bị khoá kèm lý do, để giải thích được với khách.
            </p>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3.5 sm:px-6">
            {/*
              Nút Báo giá xám khi bậc thang còn trống — chưa có gói thì chẳng có
              gì để báo. Ghép gói vào là nút sáng lên màu thương hiệu.
            */}
            <button
              type="button"
              onClick={() => setShowQuote(true)}
              disabled={flat.length === 0}
              title={
                flat.length === 0
                  ? "Ghép ít nhất một gói vào bậc thang để xem báo giá"
                  : "Xem tổng chi phí của lộ trình này"
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all",
                flat.length === 0
                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                  : "border-[#f15b5c] bg-[#f15b5c] text-white hover:opacity-90"
              )}
            >
              <Receipt className="h-4 w-4" />
              Báo giá
            </button>

            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-semibold text-gray-400 sm:inline">
                {flat.length > 0 ? `${flat.length} gói` : "Chưa ghép gói nào"}
              </span>
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50"
              >
                {isReadOnly ? "Đóng" : "Huỷ"}
              </button>
              {!isReadOnly && (
                <button
                  onClick={() => onApply(flat)}
                  disabled={flat.length === 0}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  <Check className="h-4 w-4" />
                  Áp dụng lộ trình
                </button>
              )}
            </div>
          </div>

          {/*
            Danh sách chọn gói phủ lên cả tấm modal, không nằm trong vùng cuộn
            của thân — nằm trong đó thì nó trôi theo nội dung khi người dùng đã
            cuộn xuống.
          */}
          {activePhase && !isReadOnly && (
            <PackagePicker
              phase={activePhase}
              profile={profile}
              chosenBefore={chosenBefore}
              chosenAll={flatNames}
              onPick={(key) => addTo(activePhase.num, key)}
              onBack={() => setPickerPhase(null)}
            />
          )}

          {showQuote && flat.length > 0 && (
            <QuotePanel packageNames={flatNames} onBack={() => setShowQuote(false)} />
          )}
        </div>
      </div>
    </>
  );
}
