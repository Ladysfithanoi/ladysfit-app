"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Package, Clock, ChevronRight, Route, Share2, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGES, formatPrice, type PackageDef } from "@/lib/packages";
import { phaseOf, type PhaseNum } from "@/lib/roadmap-phases";
import { priceRoadmap, priceLineLabel } from "@/lib/roadmap-pricing";
import { fmtVnDate, type ActivePromo } from "@/lib/package-promos";
import type { ConsultationData } from "../consultation-wizard";
import { PackageDetailModal } from "./package-detail-modal";
import { PackagesCatalogModal } from "./packages-catalog-modal";
import { BodyFatCard } from "./body-fat-card";
import { TransformGallery } from "./transform-gallery";
import { RoadmapBuilderModal, type RoadmapPick } from "./roadmap-builder-modal";
import { RoadmapOptionsModal } from "./roadmap-options-modal";
import { phase1KeyFor } from "@/lib/roadmap-variants";
import {
  buildWeightTimeline,
  projectWeight,
  rateForWeight,
  type LossSpeed,
} from "@/lib/weight-timeline";

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
  /** Bậc trên bậc thang 3 giai đoạn — xem lib/roadmap-phases.ts. */
  roadmapPhase?: number | null;
};

type RoadmapOption = {
  num: 1 | 2 | 3;
  label: string;
  sublabel: string;
  totalDays: number;
  packages: SelectedPkg[];
};

// ─── Roadmap builder ──────────────────────────────────────────────────────────
// Order is always enforced: Stage 1 → Stage 2 → Stage 3 (L5/Loyalfit always last)

function makePkg(
  key: string,
  order: number,
  isBuffer = false,
  roadmapPhase?: PhaseNum | null
): SelectedPkg {
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
    // Ba lộ trình dựng sẵn không hỏi bậc, nên xếp theo giai đoạn thương mại của
    // gói; lộ trình tự vẽ thì truyền thẳng bậc người dùng đã chọn.
    roadmapPhase: roadmapPhase ?? phaseOf(key),
  };
}

/** Số gói Giai đoạn 2 tối đa trong chuỗi nền — quá nữa thì không còn thực tế. */
const MAX_PHASE2 = 4;

/**
 * Chuỗi gói Giai đoạn 2 phủ sát `days` ngày nhất.
 *
 * Luôn trả về ít nhất một gói: khách nhẹ cân không có Giai đoạn 1 thì Giai
 * đoạn 2 chính là chặng mở đầu lộ trình, không được để trống.
 */
function phase2Chain(days: number): string[] {
  const d3 = PACKAGES.L3.durationDays;
  const d4 = PACKAGES.L4.durationDays;

  let best: string[] = ["L3"];
  let bestDiff = Infinity;

  for (let l4 = 0; l4 <= MAX_PHASE2; l4++) {
    for (let l3 = 0; l3 <= MAX_PHASE2; l3++) {
      const count = l3 + l4;
      if (count < 1 || count > MAX_PHASE2) continue;
      const diff = Math.abs(l4 * d4 + l3 * d3 - days);
      // Bằng nhau thì ưu tiên chuỗi ít gói hơn cho khách đỡ phải ký nhiều lần.
      if (diff < bestDiff || (diff === bestDiff && count < best.length)) {
        best = [...Array(l4).fill("L4"), ...Array(l3).fill("L3")];
        bestDiff = diff;
      }
    }
  }

  return best;
}

function buildRoadmapOptions(info: Record<string, unknown>): RoadmapOption[] {
  const weight       = Number(info.currentWeight) || 0;
  const height       = Number(info.height) || 0;
  const targetWeight = Number(info.targetWeight) || 0;

  // Gói Giai đoạn 1 do cân nặng so với chiều cao quyết định — xem
  // lib/roadmap-variants, dùng chung ngưỡng với bộ lọc của bậc thang.
  // Khách đã ở dưới mốc chuẩn thì không có Giai đoạn 1, nhưng vẫn phải ra đủ
  // ba lộ trình như mọi khách khác.
  const phase1Key: string | null = phase1KeyFor(weight, height);

  // Thời gian tới mục tiêu tính theo quy tắc 1% / 0.75% / 0.5% ở
  // lib/weight-timeline — cùng con số mà khách thấy ở thẻ phân tích bên trên.
  const estDays = buildWeightTimeline(weight, height, targetWeight)?.totalDays ?? 0;

  // Giai đoạn 2 phủ phần đường còn lại sau Giai đoạn 1.
  const phase1Days = phase1Key ? (PACKAGES[phase1Key]?.durationDays ?? 0) : 0;
  const base       = phase2Chain(Math.max(estDays - phase1Days, 0));

  // Giai đoạn 3: hành trình dài thì duy trì bằng L5 (180 ngày), ngắn thì
  // Loyalfit (90 ngày). Loyalfit chỉ đòi có gói đứng trước nó — xem checkPick —
  // mà chuỗi nào cũng có ít nhất một gói Giai đoạn 2, nên khách nhẹ cân cũng
  // dùng được thay vì bị đẩy sang L5 sáu tháng.
  const phase3Key = estDays >= 365 ? "L5" : "Loyalfit";

  // Gói đệm để kéo dài lộ trình lấy đúng gói cuối của chuỗi nền, để bước nhảy
  // giữa ba option vừa với thể trạng khách chứ không phải lúc nào cũng +180 ngày.
  const bufferKey = base[base.length - 1];

  // Chuỗi: [Giai đoạn 1?] → [Giai đoạn 2 nền] → [gói đệm] → [Giai đoạn 3 — luôn cuối]
  function buildChain(extraCount: number): SelectedPkg[] {
    let o = 1;
    const chain: SelectedPkg[] = [];
    if (phase1Key) chain.push(makePkg(phase1Key, o++));
    for (const name of base) chain.push(makePkg(name, o++));
    for (let i = 0; i < extraCount; i++) chain.push(makePkg(bufferKey, o++, true));
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
  const height = Number(info.height) || 0;
  const goal   = Number(info.targetWeight) || 0;
  let cur = Number(info.currentWeight) || 0;

  for (const pkg of pkgs) {
    const def: PackageDef | undefined = PACKAGES[pkg.packageName];
    if (!def) continue;
    // Giai đoạn 3 là chặng duy trì — không đặt chỉ tiêu giảm cho nó.
    if (def.stage === "3") continue;

    // Tốc độ theo mốc cân nặng đầu gói, không theo giai đoạn của gói — quy tắc
    // ở lib/weight-timeline. Cân nặng cuối gói mô phỏng từng tuần vì khách có
    // thể rơi qua mốc chuẩn / mốc đẹp ngay giữa gói.
    const rate  = rateForWeight(cur, height);
    const kgW   = parseFloat((cur * rate).toFixed(2));
    const weeks = pkg.durationDays / 7;
    const end   = projectWeight(cur, height, weeks, goal);

    rows.push({
      pkgName: pkg.packageName,
      startWeight: cur,
      targetWeight: end,
      kgPerWeek: kgW,
      pctPerWeek: parseFloat((rate * 100).toFixed(2)),
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

/** Màu ba cột tốc độ giảm cân — nhanh (nóng) → chậm (nguội). */
const SPEED_THEME: Record<LossSpeed, { box: string; text: string }> = {
  fast:   { box: "bg-rose-50 border-rose-200",   text: "text-rose-700"  },
  medium: { box: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  slow:   { box: "bg-sky-50 border-sky-200",     text: "text-sky-700"   },
};

// ─── PackageCard ──────────────────────────────────────────────────────────────

/**
 * Thẻ một gói trong lộ trình đã chốt.
 *
 * Cố tình KHÔNG hiện giá từng gói: giá phụ thuộc vị trí gói trong lộ trình
 * (gói đầu được trợ giá, từ gói thứ hai giảm 10% tái ký) nên đọc rời từng con
 * số dễ hiểu nhầm. Tiền gom về một chỗ ở phần "Tổng đầu tư" bên dưới.
 */
function PackageCard({
  pkg,
  def,
  confirmed,
  onToggle,
  onViewDetail,
  isReadOnly,
}: {
  pkg: SelectedPkg;
  def: PackageDef;
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
  isReadOnly: isReadOnlyProp,
  onDraft,
  onPrev,
  canSaveAndContinue = true,
  activePromos = [],
  isGuest = false,
}: {
  consultation: ConsultationData;
  isReadOnly: boolean;
  /** Không truyền ở chế độ khách xem — khách không có đường ghi nào. */
  onDraft?: (p: Record<string, unknown>) => Promise<void>;
  onPrev?: () => void;
  onComplete?: () => void;
  canSaveAndContinue?: boolean;
  /** Đợt trợ giá đang chạy ở cơ sở này, đã lọc sẵn ở server. */
  activePromos?: ActivePromo[];
  /** Khách mở bằng link chia sẻ (app/tu-van/[token]). Chỉ xem và duyệt: mở được
   *  chi tiết gói, ảnh chuyển hoá, các cách ghép gói — nhưng không đổi được lộ
   *  trình, và cả hàng nút thao tác của tư vấn viên đều không hiện. */
  isGuest?: boolean;
}) {
  const router = useRouter();
  // Khách xem thì luôn chỉ-đọc. Gộp ngay ở đây để phần thân bên dưới chỉ phải nhớ
  // MỘT lá cờ — thêm chỗ nào quên `|| isGuest` là hở ngay một nút bấm được.
  const isReadOnly   = isReadOnlyProp || isGuest;
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
  // Link cho khách tự mở màn tư vấn lộ trình này.
  const [sharing, setSharing]           = useState(false);
  const [shareUrl, setShareUrl]         = useState("");
  const [shareError, setShareError]     = useState("");
  const [copied, setCopied]             = useState(false);
  const [detailPkg, setDetailPkg]       = useState<string | null>(null);
  const [showCatalog, setShowCatalog]   = useState(false);
  // Bậc thang 3 giai đoạn — tự ghép gói thay vì lấy nguyên một trong 3 option.
  const [showRoadmapBuilder, setShowRoadmapBuilder] = useState(false);
  // Bấm một OPTION thì mở tiếp hộp chọn cách ghép gói trong khoảng thời gian đó.
  const [variantOption, setVariantOption] = useState<RoadmapOption | null>(null);

  /**
   * Chốt lộ trình từ hộp chọn cách ghép gói.
   *
   * Option quyết định TỔNG THỜI GIAN, còn chuỗi gói cụ thể là do khách chọn
   * trong hộp đó — xem roadmap-options-modal.
   */
  function selectVariant(opt: RoadmapOption, packageNames: string[]) {
    setSelectedOptionNum(opt.num);
    setPackages(packageNames.map((key, i) => makePkg(key, i + 1)));
    setVariantOption(null);
  }

  /**
   * Nhận lộ trình tự vẽ từ modal bậc thang. Gói đã xếp sẵn theo thứ tự Giai
   * đoạn 1 → 3, đánh lại số order và coi như đã chốt. Bỏ đánh dấu option vì
   * lộ trình này không còn là một trong 3 mẫu dựng tự động nữa.
   */
  function applyCustomRoadmap(picks: RoadmapPick[]) {
    setPackages(picks.map((pick, i) => makePkg(pick.packageName, i + 1, false, pick.phase)));
    setSelectedOptionNum(null);
    setShowRoadmapBuilder(false);
  }

  function toggleConfirm(i: number) {
    setPackages((prev) => prev.map((p, idx) => idx === i ? { ...p, isConfirmed: !p.isConfirmed } : p));
  }

  const phaseRows    = useMemo(() => buildPhaseTable(info, packages.filter((p) => p.isConfirmed)), [packages, info]);
  // Giá tính ở lib/roadmap-pricing — dùng chung với nút Báo giá của bậc thang
  // để hai chỗ không bao giờ báo hai con số khác nhau cho cùng một lộ trình.
  // Đợt trợ giá nằm trong DB nên được lọc sẵn ở server rồi truyền xuống — xem
  // lib/package-promos-server. Bảng giá chỉ việc áp.
  const allPricing   = useMemo(
    () => priceRoadmap(packages.map((p) => p.packageName), activePromos),
    [packages, activePromos]
  );

  const weightToLose   = (Number(info.currentWeight) || 0) - (Number(info.targetWeight) || 0);
  const initialWeight  = Number(info.currentWeight) || 0;
  const transformTarget = initialWeight - 7;
  const infoHeight     = Number(info.height) || 0;
  const infoTarget     = Number(info.targetWeight) || 0;
  // Quy tắc tốc độ giảm cân (1% / 0.75% / 0.5% theo mốc chiều cao) nằm ở
  // lib/weight-timeline — đừng tính lại ở đây.
  const timeline       = useMemo(
    () => buildWeightTimeline(initialWeight, infoHeight, infoTarget),
    [initialWeight, infoHeight, infoTarget]
  );
  // Gói Giai đoạn 1 của khách này — hộp chọn cách ghép gói giữ nguyên gói đó
  // ở mọi phương án, vì nó do thể trạng quyết định chứ không phải do khách chọn.
  const phase1Key = phase1KeyFor(initialWeight, infoHeight);

  const confirmedPkgs    = packages.filter((p) => p.isConfirmed);
  const loyalfitOnly     = confirmedPkgs.length > 0 && confirmedPkgs.every((p) => p.packageName === "Loyalfit");
  const confirmedPricing = allPricing.filter((_, i) => packages[i]?.isConfirmed);
  const totalPrice       = confirmedPricing.reduce((s, p) => s + p.originalPrice, 0);
  const totalDiscounted  = confirmedPricing.reduce((s, p) => s + p.effectivePrice, 0);

  async function handleDraft() {
    setSaving(true);
    await onDraft?.({ packages });
    setSaving(false);
  }

  /**
   * Cấp link cho khách tự mở màn tư vấn lộ trình này.
   *
   * Trước đây nút này xuất PNG. Ảnh chết: khách không mở được chi tiết từng gói,
   * không xem được thư viện ảnh chuyển hoá, không đọc được các cách ghép gói —
   * mà đó mới là phần thuyết phục. Link mở ĐÚNG trang tư vấn viên đang nhìn, chỉ
   * khoá phần sửa, nên không còn cảnh bản xem và bản gửi khách lệch nhau.
   *
   * Token do server cấp và giữ nguyên qua các lần bấm, nên link gửi hôm trước
   * không chết. Ghép với origin đang mở để luôn đúng tên miền đang dùng.
   */
  async function handleShare() {
    setSharing(true);
    setShareError("");
    setCopied(false);
    try {
      const res = await fetch(`/api/consultation/${consultation.id}/share`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tạo được link chia sẻ");

      const url = `${window.location.origin}${data.path}`;
      setShareUrl(url);
      await sendLink(url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Không tạo được link chia sẻ");
    } finally {
      setSharing(false);
    }
  }

  /**
   * Đưa link ra ngoài theo cách tiện nhất của máy đang dùng: điện thoại thì mở
   * bảng chia sẻ của hệ điều hành (Zalo, Messenger...), máy tính thì copy sẵn.
   *
   * Khách bấm Huỷ ở bảng chia sẻ là AbortError — không phải lỗi, nuốt đi; ô link
   * vẫn hiện ngay bên dưới nút để copy tay.
   */
  async function sendLink(url: string) {
    const title = `Lộ trình tập luyện${info.fullName ? ` — ${String(info.fullName)}` : ""}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Không chia sẻ/copy được thì thôi — ô link bên dưới vẫn chọn tay được.
    }
  }

  async function handleComplete() {
    setCompleting(true);
    setCompleteError("");
    try {
      await onDraft?.({ packages });
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
      <div className="divide-y divide-gray-50 bg-white">

        {/* Thời gian cần thiết để hoàn thiện mục tiêu */}
        {timeline !== null && (
          <div className="p-5">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-blue-500 mb-1">Thời gian cần thiết để hoàn thiện mục tiêu:</p>

              {timeline.totalKg <= 0 ? (
                <p className="text-sm font-semibold text-blue-800">
                  Khách đã ở{" "}
                  <span className="font-extrabold">{timeline.currentWeight.toFixed(1)} kg</span>{" "}
                  — bằng hoặc thấp hơn mục tiêu, chỉ cần giữ dáng.
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-blue-800">
                    {timeline.currentWeight.toFixed(1)} kg → {timeline.goalWeight.toFixed(1)} kg
                    {timeline.goalIsSuggested && (
                      <span className="font-normal text-blue-500"> (mục tiêu gợi ý)</span>
                    )}
                    {" · cần giảm "}
                    <span className="font-extrabold">{timeline.totalKg.toFixed(1)} kg</span>
                  </p>
                  <p className="text-sm font-semibold text-blue-800 mt-0.5">
                    Tổng thời gian:{" "}
                    <span className="font-extrabold">
                      {timeline.totalDays} ngày (~{Math.round(timeline.totalDays / 7)} tuần
                      {timeline.totalDays >= 30 && ` · ~${Math.round(timeline.totalDays / 30)} tháng`})
                    </span>
                  </p>

                  {/* Ba cột theo tốc độ giảm cân — quy tắc ở lib/weight-timeline */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                    {timeline.segments.map((seg) => {
                      const theme  = SPEED_THEME[seg.speed];
                      const isUsed = seg.kg > 0;
                      return (
                        <div
                          key={seg.speed}
                          className={cn(
                            "rounded-lg border px-3 py-2",
                            isUsed ? theme.box : "bg-gray-50 border-gray-100 opacity-60"
                          )}
                        >
                          <p className={cn("text-xs font-extrabold", isUsed ? theme.text : "text-gray-400")}>
                            {seg.label} ({seg.ratePct})
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{seg.range}</p>
                          {isUsed ? (
                            <>
                              <p className={cn("text-sm font-extrabold mt-1.5", theme.text)}>
                                {seg.days} ngày
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {seg.fromWeight.toFixed(1)} → {seg.toWeight.toFixed(1)} kg · giảm{" "}
                                {seg.kg.toFixed(1)} kg
                              </p>
                            </>
                          ) : (
                            <p className="text-[11px] text-gray-400 mt-1.5">Không đi qua chặng này</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-blue-500 mt-2">
                    Mốc chuẩn {timeline.standardWeight.toFixed(1)} kg (Chiều cao − 100) · Mốc đẹp{" "}
                    {timeline.idealWeight.toFixed(1)} kg (0.9 × mốc chuẩn) — càng gần mốc, tốc độ
                    giảm an toàn càng chậm.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Đợt trợ giá đang chạy ở cơ sở này — tư vấn viên phải thấy trước khi
            báo giá, không thì lại đọc nguyên giá cho khách. */}
        {activePromos.length > 0 && (
          <div className="p-5 space-y-2">
            {activePromos.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[#f15b5c]/30 bg-[#fff5f5] px-4 py-3"
              >
                <p className="text-sm font-extrabold text-[#f15b5c]">🎁 {p.name}</p>
                <p className="mt-1 text-xs font-semibold text-gray-600">
                  {p.items
                    .map((it) => `${it.packageName} còn ${formatPrice(it.price)}`)
                    .join(" · ")}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  Áp dụng đến hết {fmtVnDate(p.endsAt)} — sau đó giá tự trở về bình thường.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Ba lộ trình đề xuất — buổi tư vấn đã chốt vẫn hiện, chỉ là không bấm được.
            Hồ sơ chốt mà chưa kịp chọn gói thì đây là chỗ duy nhất còn thấy được
            lộ trình hợp với khách, đừng để trắng trơn. */}
        <div className="p-5">
            <button
              type="button"
              onClick={() => setShowCatalog(true)}
              className="flex items-center gap-2 mb-1 group"
              title="Xem toàn bộ danh sách gói tập Ladysfit"
            >
              <Package className="w-4 h-4 text-[#f15b5c]" />
              <span className="text-sm font-extrabold text-gray-800 group-hover:text-[#f15b5c] group-hover:underline transition-colors">
                {isGuest
                  ? "Lộ trình đề xuất theo chỉ số của bạn"
                  : isReadOnly
                    ? "Lộ trình đề xuất theo chỉ số của khách"
                    : "Chọn lộ trình tập luyện"}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#f15b5c] transition-colors" />
            </button>
            <p className="text-xs text-gray-400 mb-4">
              {isGuest ? (
                <>
                  Ấn vào một lộ trình để xem chi tiết các cách ghép gói bên trong —{" "}
                </>
              ) : isReadOnly ? (
                <>
                  Buổi tư vấn đã chốt nên không đổi được nữa, nhưng ấn vào một lộ trình vẫn
                  xem được chi tiết các cách ghép gói bên trong —{" "}
                </>
              ) : (
                <>Ấn một trong 3 lộ trình để chọn cách ghép gói cho khoảng thời gian đó — </>
              )}
              <button
                type="button"
                onClick={() => setShowCatalog(true)}
                className="font-bold text-[#f15b5c] hover:underline"
              >
                xem toàn bộ gói tập
              </button>
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
                    type="button"
                    onClick={() => setVariantOption(opt)}
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

        {/* Package list — revealed after option selection */}
        <div className="p-5">
          {isReadOnly && (
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-[#f15b5c]" />
              <p className="text-sm font-extrabold text-gray-800">
                {isGuest ? "Lộ trình dành cho bạn" : "Lộ trình đã chốt"}
              </p>
            </div>
          )}

          {!isReadOnly && selectedOptionNum === null ? (
            <div className="py-14 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center gap-3">
              <Package className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-semibold text-gray-300">Chọn một lộ trình ở trên để xem các gói tập</p>
            </div>
          ) : packages.length === 0 ? (
            // Không phải "không có lộ trình phù hợp" — ba lộ trình đề xuất vẫn nằm
            // ngay trên. Chỉ là buổi tư vấn này chốt lại mà chưa chọn gói nào.
            <p className="text-sm text-gray-400 text-center py-8">
              {isGuest
                ? "Chưa có gói nào được chọn — xem ba lộ trình đề xuất ở trên."
                : "Buổi tư vấn này chưa chốt gói nào — xem ba lộ trình đề xuất ở trên."}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {packages.map((pkg, i) => {
                  const def = PACKAGES[pkg.packageName];
                  if (!def) return null;
                  return (
                    <PackageCard
                      key={`${pkg.packageName}-${i}`}
                      pkg={pkg}
                      def={def}
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
            <div className="min-w-0">
              {/* Lối vào bậc thang 3 giai đoạn — nằm ngay trên Body Shape Goal */}
              <div className="px-5 pt-5">
                <button
                  type="button"
                  onClick={() => setShowRoadmapBuilder(true)}
                  className="flex items-center gap-2 group"
                  title="Vẽ lộ trình tập theo 3 giai đoạn"
                >
                  <Route className="w-4 h-4 text-[#f15b5c]" />
                  <span className="text-sm font-extrabold text-gray-800 group-hover:text-[#f15b5c] group-hover:underline transition-colors">
                    Vẽ lộ trình tập
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#f15b5c] transition-colors" />
                </button>
                <p className="text-xs text-gray-400 mt-0.5">
                  Bậc thang 3 giai đoạn — ghép gói vào từng bậc và xem tổng thời lượng
                </p>
              </div>
              <BodyFatCard info={info} />
            </div>
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
            {/* Từng gói được áp mức nào — để tư vấn viên đọc đúng số với khách. */}
            <div className="mt-3 space-y-1.5">
              {confirmedPricing.map((line, i) => (
                <div key={`${line.packageName}-${i}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-gray-700">{line.packageName}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
                      line.type === "promo"
                        ? "bg-[#f15b5c] text-white"
                        : line.type === "subsidized"
                          ? "bg-orange-100 text-orange-600"
                          : line.type === "renewal"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-gray-100 text-gray-500"
                    )}>
                      {priceLineLabel(line)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {line.effectivePrice < line.originalPrice && (
                      <span className="mr-1.5 text-[11px] text-gray-400 line-through">
                        {formatPrice(line.originalPrice)}
                      </span>
                    )}
                    <span className="font-extrabold text-gray-800">{formatPrice(line.effectivePrice)}</span>
                  </span>
                </div>
              ))}
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

        {/* Actions — cả hàng này biến mất ở chế độ khách xem: khách chỉ có đúng
            màn lộ trình, không có đường quay lại hay lối sang phần khác.
            Trên mobile các nút xếp dọc và chiếm trọn bề ngang (w-full), chữ không
            xuống dòng lộn xộn nhờ whitespace-nowrap + text-center. */}
        {!isGuest && (
        <div className="p-5 flex flex-col sm:flex-row sm:flex-wrap justify-end items-stretch sm:items-center gap-3">
          <button
            onClick={onPrev}
            className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 w-full sm:w-auto text-center whitespace-nowrap"
          >
            ← Quay lại
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={handleDraft}
                disabled={saving}
                className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 w-full sm:w-auto text-center whitespace-nowrap"
              >
                {saving ? "Đang lưu..." : "Lưu nháp"}
              </button>
              <button
                onClick={handleShare}
                disabled={sharing}
                title="Tạo link cho khách tự mở đúng màn tư vấn lộ trình này"
                className="py-3 px-5 rounded-xl border border-[#f15b5c]/40 bg-[#fff5f5] text-sm font-bold text-[#f15b5c] hover:bg-[#ffeeee] disabled:opacity-50 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {sharing
                  ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  : <Share2 className="w-4 h-4 shrink-0" />}
                {sharing ? "Đang tạo link..." : "Chia sẻ"}
              </button>
              <button
                onClick={handleComplete}
                disabled={completing || confirmedPkgs.length === 0 || loyalfitOnly || !canSaveAndContinue}
                className="py-3 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-50 w-full sm:w-auto text-center whitespace-nowrap"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {completing ? "Đang xử lý..." : "✓ Hoàn thành tư vấn"}
              </button>
            </>
          )}
          {isReadOnly && (
            <>
              {/* Buổi đã chốt vẫn gửi lại link cho khách được. */}
              <button
                onClick={handleShare}
                disabled={sharing}
                title="Tạo link cho khách tự mở đúng màn tư vấn lộ trình này"
                className="py-3 px-5 rounded-xl border border-[#f15b5c]/40 bg-[#fff5f5] text-sm font-bold text-[#f15b5c] hover:bg-[#ffeeee] disabled:opacity-50 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {sharing
                  ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  : <Share2 className="w-4 h-4 shrink-0" />}
                {sharing ? "Đang tạo link..." : "Chia sẻ"}
              </button>
              {consultation.convertedClientId ? (
                <Link
                  href={`/dashboard/clients/${consultation.convertedClientId}`}
                  className="py-3 px-5 rounded-xl text-white text-sm font-bold inline-flex items-center justify-center w-full sm:w-auto whitespace-nowrap"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  Xem hồ sơ khách hàng
                </Link>
              ) : (
                <span className="text-xs text-gray-400 italic self-center">Chưa có hồ sơ khách hàng</span>
              )}
            </>
          )}
        </div>
        )}

        {/* Link vừa cấp — hiện hẳn ra để copy tay, vì bảng chia sẻ của hệ điều
            hành không có trên máy tính và khách có thể bấm Huỷ ở điện thoại. */}
        {!isGuest && shareUrl && (
          <div className="px-5 pb-5 -mt-2">
            <div className="rounded-xl border border-[#f15b5c]/25 bg-[#fff5f5] px-4 py-3">
              <p className="text-xs font-bold text-[#f15b5c]">
                Link cho khách xem lộ trình{copied && " — đã copy"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-[#f15b5c]/20 bg-white px-3 py-2 text-xs text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl).then(
                      () => setCopied(true),
                      () => setCopied(false)
                    );
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#f15b5c]/30 bg-white px-3 py-2 text-xs font-bold text-[#f15b5c] hover:bg-[#ffeeee]"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Đã copy" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                Ai có link đều xem được, không cần đăng nhập. Khách chỉ thấy đúng màn
                tư vấn lộ trình này và không sửa được gì.
              </p>
            </div>
          </div>
        )}

        {shareError && (
          <div className="px-5 pb-5 -mt-2">
            <p className="text-xs text-[#f15b5c] font-semibold">{shareError}</p>
          </div>
        )}
      </div>

      {detailPkg && (
        <PackageDetailModal
          packageName={detailPkg}
          info={info}
          onClose={() => setDetailPkg(null)}
        />
      )}

      {showCatalog && <PackagesCatalogModal onClose={() => setShowCatalog(false)} />}

      {variantOption && (
        <RoadmapOptionsModal
          option={{
            num: variantOption.num,
            label: variantOption.label,
            sublabel: variantOption.sublabel,
            totalDays: variantOption.totalDays,
            packageNames: variantOption.packages.map((p) => p.packageName),
          }}
          phase1Key={phase1Key}
          isReadOnly={isReadOnly}
          onPick={(names) => selectVariant(variantOption, names)}
          onClose={() => setVariantOption(null)}
        />
      )}

      {showRoadmapBuilder && (
        <RoadmapBuilderModal
          info={info}
          picked={packages.map((p) => ({
            packageName: p.packageName,
            phase: p.roadmapPhase,
          }))}
          isReadOnly={isReadOnly}
          activePromos={activePromos}
          onClose={() => setShowRoadmapBuilder(false)}
          onApply={applyCustomRoadmap}
        />
      )}
    </>
  );
}
