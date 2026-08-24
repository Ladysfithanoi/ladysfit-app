"use client";

import { X, Check, Sparkles, Baby, CirclePause } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKAGES, formatPrice } from "@/lib/packages";

// ─── Catalogue metadata ───────────────────────────────────────────────────────
// Thứ tự hiển thị: L0 → Loyalfit. Giá / số buổi / hạn / cam kết lấy từ lib/packages.

const CATALOG_ORDER = ["L0", "L1", "L2", "L3", "L4", "L5", "Loyalfit"] as const;

type CatalogKey = (typeof CATALOG_ORDER)[number];

type CatalogMeta = {
  tagline: string;
  description: string;
  frequency: string;
  program: string;
  highlights: string[];
};

const CATALOG_META: Record<CatalogKey, CatalogMeta> = {
  L0: {
    tagline: "Gói trải nghiệm",
    description:
      "4 buổi tập 1-1 cùng PT để làm quen phương pháp Ladysfit, đo chỉ số cơ thể và được tư vấn lộ trình phù hợp trước khi cam kết dài hạn.",
    frequency: "Linh hoạt trong 30 ngày",
    program: "Đánh giá thể trạng + làm quen 5 chuyển động nền tảng",
    highlights: [
      "Được hoàn tiền sau khi tập xong buổi 1",
      "Được hoàn tiền khi tập hết 4 buổi",
      "Chỉ mua 1 lần duy nhất",
    ],
  },
  L1: {
    tagline: "Giai đoạn 1 · Giảm cân nhanh",
    description:
      "Lộ trình khởi động giảm mỡ với 5 chuyển động nền tảng (Squat – Hinge – Push – Pull – Cardio), kết hợp thực đơn thâm hụt calo để giảm nhanh trong 1 tháng đầu.",
    frequency: "Tối thiểu 6 buổi/tuần",
    program: "5 chuyển động nền tảng · Tạ đơn, máy tập, dây kháng lực",
    highlights: [
      "Giá trợ giá cho khách mua lần đầu",
      "Điều kiện: cân nặng thực > chiều cao tối thiểu 3 kg",
      "Chỉ mua 1 lần duy nhất",
    ],
  },
  L2: {
    tagline: "Giai đoạn 1 · Giảm cân nhanh",
    description:
      "Phiên bản dài hơi của Giai đoạn 1 dành cho khách có mức mỡ thừa lớn — đủ thời gian để giảm sâu và ổn định cân nặng trước khi bước sang tạo hình.",
    frequency: "Tối thiểu 6 buổi/tuần",
    program: "5 chuyển động nền tảng · Tạ đơn, máy tập, dây kháng lực",
    highlights: [
      "Giá trợ giá cho khách mua lần đầu",
      "Điều kiện: cân nặng thực > chiều cao tối thiểu 6 kg",
      "Chỉ mua 1 lần duy nhất",
    ],
  },
  L3: {
    tagline: "Giai đoạn 2 · Hoàn thiện vóc dáng",
    description:
      "Chuyển từ giảm cân sang tạo đường nét: chuyên biệt hoá theo nhóm cơ (Thân trên – Thân dưới, Chuyên mông, Slimbody) để đưa tỷ lệ mỡ về ngưỡng đẹp 18–20%.",
    frequency: "Tối thiểu 4 buổi/tuần",
    program: "Thân trên – Thân dưới · Chuyên mông · Slimbody",
    highlights: [
      "Mua được nhiều lần",
      "Tái ký giảm 10% từ gói thứ hai trở đi",
    ],
  },
  L4: {
    tagline: "Giai đoạn 2 · Hoàn thiện vóc dáng",
    description:
      "Gấp đôi thời lượng của L3 — đủ dài để vừa hoàn thiện vóc dáng vừa giữ vững kết quả, phù hợp với khách cần giảm nhiều và muốn đi đường dài.",
    frequency: "Tối thiểu 4 buổi/tuần",
    program: "Thân trên – Thân dưới · Chuyên mông · Slimbody",
    highlights: [
      "Mua được nhiều lần",
      "Tái ký giảm 10% từ gói thứ hai trở đi",
    ],
  },
  L5: {
    tagline: "Giai đoạn 3 · Duy trì thói quen",
    description:
      "Lộ trình duy trì dài hạn: 72 buổi PT kết hợp 24 buổi Connect Workout, bổ sung Power Training để nâng hiệu suất vận động và giữ dáng bền vững.",
    frequency: "Tối thiểu 4 buổi/tuần",
    program: "Toàn thân · Chuyên mông · Power Training",
    highlights: [
      "72 buổi PT + 24 buổi Connect Workout",
      "Mua được nhiều lần",
      "Gia hạn: 500k/10 ngày · 1 triệu/30 ngày",
    ],
  },
  Loyalfit: {
    tagline: "Giai đoạn 3 · Khách hàng thân thiết",
    description:
      "Gói tri ân dành riêng cho khách đã từng mua sản phẩm tại Ladysfit — duy trì thói quen tập luyện với chi phí mỗi buổi thấp nhất hệ thống.",
    frequency: "Tối đa 12 buổi/tháng",
    program: "Toàn thân · Chuyên mông · Power Training",
    highlights: [
      "Chỉ dành cho khách hàng đã từng mua gói tại LDF",
      "Không áp dụng trợ giá hay giảm giá tái ký",
      "Mua được nhiều lần",
    ],
  },
};

/** Ba lộ trình được hưởng bảo lưu miễn phí 2 tháng + nghỉ thai sản tới 18 tháng. */
const PERK_PACKAGES: CatalogKey[] = ["L3", "L4", "L5"];

const STAGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  "1": { bg: "bg-red-50",   text: "text-red-600",   border: "border-red-100"   },
  "2": { bg: "bg-blue-50",  text: "text-blue-600",  border: "border-blue-100"  },
  "3": { bg: "bg-green-50", text: "text-green-600", border: "border-green-100" },
};

// ─── Card ─────────────────────────────────────────────────────────────────────

function CatalogCard({ pkgKey, index }: { pkgKey: CatalogKey; index: number }) {
  const def  = PACKAGES[pkgKey];
  const meta = CATALOG_META[pkgKey];
  if (!def) return null;

  const st       = STAGE_STYLE[def.stage] ?? STAGE_STYLE["1"];
  const hasPerks = PERK_PACKAGES.includes(pkgKey);

  return (
    <div className={cn("rounded-2xl border bg-white overflow-hidden", st.border)}>
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-start justify-between gap-3", st.bg)}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-extrabold text-gray-400 tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-lg font-extrabold text-gray-900">{def.name}</span>
            <span className={cn("text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white", st.text)}>
              {meta.tagline}
            </span>
          </div>
          <p className="text-xs font-semibold text-gray-500">
            {def.sessions} buổi PT
            {def.connectSessions ? ` + ${def.connectSessions} buổi Connect` : ""} · Hạn {def.durationDays} ngày
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          {def.discountedPrice ? (
            <>
              <p className="text-xs text-gray-400 line-through leading-tight">{formatPrice(def.price)}</p>
              <p className="text-base font-extrabold text-[#f15b5c] leading-tight">
                {formatPrice(def.discountedPrice)}
              </p>
              <p className="text-[10px] font-bold text-orange-500">Giá trợ giá</p>
            </>
          ) : (
            <p className="text-base font-extrabold text-gray-900 leading-tight">{formatPrice(def.price)}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3.5">
        <p className="text-xs text-gray-600 leading-relaxed mb-3">{meta.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Tần suất</p>
            <p className="text-xs font-bold text-gray-700">{meta.frequency}</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Chương trình tập</p>
            <p className="text-xs font-bold text-gray-700">{meta.program}</p>
          </div>
        </div>

        <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2 mb-3">
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-0.5">Cam kết</p>
          <p className="text-xs font-bold text-green-800">{def.commitment}</p>
        </div>

        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">
          Điều kiện đi kèm
        </p>
        <ul className="space-y-1 mb-3">
          {meta.highlights.map((h) => (
            <li key={h} className="flex items-start gap-1.5 text-xs text-gray-600">
              <Check className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
              <span>{h}</span>
            </li>
          ))}
        </ul>

        {hasPerks && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Ưu đãi riêng
            </p>
            <div className="space-y-1.5">
              <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800">
                <CirclePause className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Bảo lưu miễn phí 2 tháng (2 lần, tối đa 30 ngày/lần)</span>
              </p>
              <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800">
                <Baby className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Chế độ nghỉ thai sản lên tới 18 tháng</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function PackagesCatalogModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="font-sans bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col pointer-events-auto">

          {/* Header */}
          <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-gray-100 rounded-t-2xl flex-shrink-0">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Danh sách lộ trình Ladysfit</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">
                Toàn bộ gói tập xếp theo thứ tự L0 → Loyalfit, kèm điều kiện và ưu đãi
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors mt-0.5 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 sm:px-6 py-5 overflow-y-auto space-y-3">
            {/* Perk summary */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Ưu đãi cho lộ trình L3 · L4 · L5
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800">
                  <CirclePause className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Bảo lưu miễn phí 2 tháng</span>
                </p>
                <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-800">
                  <Baby className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Nghỉ thai sản lên tới 18 tháng</span>
                </p>
              </div>
            </div>

            {CATALOG_ORDER.map((key, i) => (
              <CatalogCard key={key} pkgKey={key} index={i} />
            ))}

            <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
              Giá trợ giá chỉ áp dụng cho gói Giai đoạn 1 (L1 / L2) khi khách mua lần đầu. Từ gói thứ hai
              trở đi khách được giảm 10% giá tái ký, riêng Loyalfit luôn tính nguyên giá.
            </p>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 flex justify-end flex-shrink-0">
            <button
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl text-white text-sm font-bold"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
