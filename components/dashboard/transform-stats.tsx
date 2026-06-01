"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Trophy, TrendingUp, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

type TransformEvent = {
  branchId: string;
  branchName: string;
  date: string; // ISO — when the client first reached ≥ 7 kg loss
};

type Branch = { id: string; name: string };

type Mode = "month" | "quarter";

const MONTH_LABELS = [
  "T1", "T2", "T3", "T4", "T5", "T6",
  "T7", "T8", "T9", "T10", "T11", "T12",
];
const QUARTER_LABELS = ["Quý 1", "Quý 2", "Quý 3", "Quý 4"];

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { label: string; count: number } }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs font-semibold">
      <p className="text-gray-700 font-bold mb-1">{row.label}</p>
      <p className="text-[#f15b5c]">{row.count} Transform</p>
    </div>
  );
}

export function TransformStats({
  events,
  branches,
}: {
  events: TransformEvent[];
  branches: Branch[];
}) {
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState<Mode>("month");

  // Years that actually have transforms, newest first; always include current year.
  const years = useMemo(() => {
    const set = new Set<number>(events.map((e) => new Date(e.date).getFullYear()));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [events]);

  const [year, setYear] = useState(() => new Date().getFullYear());

  // Filter by selected branch (the year filter is applied per-section below).
  const branchEvents = useMemo(
    () => (branchId ? events.filter((e) => e.branchId === branchId) : events),
    [events, branchId]
  );

  const yearEvents = useMemo(
    () => branchEvents.filter((e) => new Date(e.date).getFullYear() === year),
    [branchEvents, year]
  );

  // Chart data — buckets per month or per quarter for the selected year.
  const chartData = useMemo(() => {
    if (mode === "month") {
      const counts = new Array(12).fill(0);
      for (const e of yearEvents) counts[new Date(e.date).getMonth()]++;
      return MONTH_LABELS.map((label, i) => ({ label, count: counts[i] }));
    }
    const counts = new Array(4).fill(0);
    for (const e of yearEvents) counts[Math.floor(new Date(e.date).getMonth() / 3)]++;
    return QUARTER_LABELS.map((label, i) => ({ label, count: counts[i] }));
  }, [yearEvents, mode]);

  const totalAllTime = branchEvents.length;
  const totalThisYear = yearEvents.length;
  const periodCount = mode === "month" ? 12 : 4;
  const avgPerPeriod = Math.round((totalThisYear / periodCount) * 10) / 10;
  const best = chartData.reduce(
    (acc, d) => (d.count > acc.count ? d : acc),
    { label: "—", count: 0 }
  );

  const summaryCards = [
    {
      title: "Tổng Transform",
      value: totalAllTime,
      sub: "Tất cả thời gian",
      Icon: Trophy,
      iconBg: "bg-[#f15b5c]/10",
      iconColor: "text-[#f15b5c]",
    },
    {
      title: `Năm ${year}`,
      value: totalThisYear,
      sub: branchId ? branches.find((b) => b.id === branchId)?.name ?? "" : "Toàn hệ thống",
      Icon: CalendarRange,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: mode === "month" ? "Cao nhất / tháng" : "Cao nhất / quý",
      value: best.count,
      sub: best.count > 0 ? best.label : "—",
      Icon: TrendingUp,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: mode === "month" ? "TB / tháng" : "TB / quý",
      value: avgPerPeriod,
      sub: `Năm ${year}`,
      Icon: TrendingUp,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Trophy className="w-4 h-4 text-[#f15b5c]" />
        <h2 className="text-base font-extrabold text-gray-900">Thống kê Transform theo thời gian</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          {/* Month / Quarter toggle */}
          <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
            {([
              { v: "month", l: "Theo tháng" },
              { v: "quarter", l: "Theo quý" },
            ] as { v: Mode; l: string }[]).map((opt) => (
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
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map(({ title, value, sub, Icon, iconBg, iconColor }) => (
            <div key={title} className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", iconBg)}>
                <Icon className={cn("w-4 h-4", iconColor)} />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{value}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{title}</p>
              {sub && (
                <p className="text-xs font-bold text-gray-600 mt-0.5 truncate" title={sub}>{sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="bg-gray-50/40 rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Số khách Transform {mode === "month" ? "theo tháng" : "theo quý"} — năm {year}
          </p>
          {totalThisYear === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <Trophy className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Chưa có Transform trong năm này</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barSize={mode === "month" ? 22 : 48}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 600 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#fafafa" }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill="#f15b5c" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
