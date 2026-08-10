"use client";

import { useMemo, useState } from "react";
import { Target, UserCheck, UserX, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

type Quality = {
  branchId: string;
  year: number;
  month: number; // 0-11, from the client's start date
  eligible: number;
  eligibleTransformed: number;
  notEligible: number;
  notEligibleTransformed: number;
  eligibleNotTransformedOngoing: number;
};

type Branch = { id: string; name: string };

type Mode = "all" | "month" | "quarter" | "year";

const MODES: { v: Mode; l: string }[] = [
  { v: "all", l: "Tất cả" },
  { v: "month", l: "Theo tháng" },
  { v: "quarter", l: "Theo quý" },
  { v: "year", l: "Theo năm" },
];

export function TransformQualityStats({
  quality,
  branches,
}: {
  quality: Quality[];
  branches: Branch[];
}) {
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [quarter, setQuarter] = useState(() => Math.floor(new Date().getMonth() / 3));

  // Years that actually have data, newest first; always include the current year.
  const years = useMemo(() => {
    const set = new Set<number>(quality.map((q) => q.year));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [quality]);

  // Aggregate the buckets matching the current branch + period selection.
  const agg = useMemo(() => {
    const rows = quality.filter((q) => {
      if (branchId && q.branchId !== branchId) return false;
      if (mode === "all") return true;
      if (q.year !== year) return false;
      if (mode === "year") return true;
      if (mode === "month") return q.month === month;
      return Math.floor(q.month / 3) === quarter;
    });
    return rows.reduce(
      (s, q) => ({
        eligible: s.eligible + q.eligible,
        eligibleTransformed: s.eligibleTransformed + q.eligibleTransformed,
        notEligible: s.notEligible + q.notEligible,
        notEligibleTransformed: s.notEligibleTransformed + q.notEligibleTransformed,
        eligibleNotTransformedOngoing: s.eligibleNotTransformedOngoing + q.eligibleNotTransformedOngoing,
      }),
      { eligible: 0, eligibleTransformed: 0, notEligible: 0, notEligibleTransformed: 0, eligibleNotTransformedOngoing: 0 }
    );
  }, [quality, branchId, mode, year, month, quarter]);

  const periodLabel =
    mode === "all"
      ? "Tất cả thời gian"
      : mode === "year"
        ? `Năm ${year}`
        : mode === "quarter"
          ? `Quý ${quarter + 1}/${year}`
          : `Tháng ${month + 1}/${year}`;

  const eligibleNotTransformed = agg.eligible - agg.eligibleTransformed;
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

  const rateAchieved = pct(agg.eligibleTransformed, agg.eligible);
  const rateMissed = pct(eligibleNotTransformed, agg.eligible);
  const rateUnexpected = pct(agg.notEligibleTransformed, agg.notEligible);
  const rateOngoing = pct(agg.eligibleNotTransformedOngoing, agg.eligible);

  const cards = [
    {
      title: "Đạt Transform / đủ điều kiện",
      value: `${rateAchieved.toFixed(1)}%`,
      sub: `${agg.eligibleTransformed}/${agg.eligible} KH đủ điều kiện`,
      Icon: UserCheck,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      title: "Đủ điều kiện nhưng chưa Transform",
      value: `${rateMissed.toFixed(1)}%`,
      sub: `${eligibleNotTransformed}/${agg.eligible} KH đủ điều kiện`,
      Icon: UserX,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "Chưa đủ điều kiện nhưng vẫn Transform",
      value: `${rateUnexpected.toFixed(1)}%`,
      sub: `${agg.notEligibleTransformed}/${agg.notEligible} KH chưa đủ điều kiện`,
      Icon: Target,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Chưa Transform vì chưa hết lộ trình",
      value: `${rateOngoing.toFixed(1)}%`,
      sub: `${agg.eligibleNotTransformedOngoing}/${agg.eligible} KH đủ điều kiện`,
      Icon: Hourglass,
      iconBg: "bg-[#f15b5c]/10",
      iconColor: "text-[#f15b5c]",
    },
  ];

  const selectClass =
    "h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Target className="w-4 h-4 text-[#f15b5c]" />
        <h2 className="text-base font-extrabold text-gray-900">Thống kê Transform đạt chuẩn</h2>
        <span className="px-2.5 py-1 rounded-full bg-[#f15b5c]/10 text-[#f15b5c] text-xs font-bold">
          {periodLabel}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Filter + explainer */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={selectClass}
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* All / month / quarter / year toggle */}
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
            {MODES.map((opt) => (
              <button
                key={opt.v}
                onClick={() => setMode(opt.v)}
                className={cn(
                  "h-9 px-4 text-sm font-bold transition-colors",
                  mode === opt.v
                    ? "bg-[#f15b5c] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                )}
              >
                {opt.l}
              </button>
            ))}
          </div>

          {mode === "month" && (
            <select
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={selectClass}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i)}>Tháng {i + 1}</option>
              ))}
            </select>
          )}

          {mode === "quarter" && (
            <select
              value={String(quarter)}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className={selectClass}
            >
              {Array.from({ length: 4 }, (_, i) => (
                <option key={i} value={String(i)}>Quý {i + 1}</option>
              ))}
            </select>
          )}

          {mode !== "all" && (
            <select
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              className={selectClass}
            >
              {years.map((y) => (
                <option key={y} value={String(y)}>Năm {y}</option>
              ))}
            </select>
          )}

          <p className="text-xs text-gray-400 font-medium">
            Đủ điều kiện giảm 7kg = cân nặng (kg) − chiều cao (cm) + 100 ≥ 7
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(({ title, value, sub, Icon, iconBg, iconColor }) => (
            <div key={title} className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", iconBg)}>
                <Icon className={cn("w-4 h-4", iconColor)} />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{value}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{title}</p>
              <p className="text-xs font-bold text-gray-600 mt-0.5 truncate" title={sub}>{sub}</p>
            </div>
          ))}
        </div>

        {agg.eligible === 0 && agg.notEligible === 0 && (
          <p className="text-xs text-gray-400 font-semibold text-center">
            Chưa có khách hàng bắt đầu trong {periodLabel.toLowerCase()}
          </p>
        )}

        {mode !== "all" && (
          <p className="text-xs text-gray-400 font-medium">
            Kỳ thống kê tính theo ngày khách bắt đầu (ngày tạo hồ sơ khách hàng).
          </p>
        )}
      </div>
    </div>
  );
}
