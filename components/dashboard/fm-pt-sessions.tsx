"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart2, Users, Trophy, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type PTSessionRow = {
  ptName: string;
  branchName: string;
  sessionCount: number;
  clientCount: number;
};

type Branch = { id: string; name: string };

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
  "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
  "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];
const YEARS = [2024, 2025, 2026];

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: PTSessionRow }[];
  label?: string;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs font-semibold">
      <p className="text-gray-700 font-bold mb-1">{row.ptName}</p>
      <p className="text-[#f15b5c]">{row.sessionCount} buổi dạy</p>
      <p className="text-gray-400">{row.clientCount} khách hàng</p>
    </div>
  );
}

export function FMPTSessions({ branches }: { branches: Branch[] }) {
  const now = new Date();
  const [branchId, setBranchId] = useState("");
  const [selectedPT, setSelectedPT] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<PTSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSelectedPT("");
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    if (branchId) params.set("branchId", branchId);
    fetch(`/api/dashboard/pt-sessions?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [branchId, month, year]);

  const ptNames = useMemo(() => Array.from(new Set(data.map((d) => d.ptName))), [data]);

  const filtered = useMemo(
    () => (selectedPT ? data.filter((d) => d.ptName === selectedPT) : data),
    [data, selectedPT]
  );

  const totalSessions = filtered.reduce((s, r) => s + r.sessionCount, 0);
  const top = filtered[0] ?? null;
  const bottom = filtered.length > 1 ? filtered[filtered.length - 1] : null;
  const avg = filtered.length > 0 ? Math.round(totalSessions / filtered.length) : 0;

  const chartHeight = Math.max(180, filtered.length * 48);

  const summaryCards = [
    {
      title: "Tổng buổi dạy",
      value: totalSessions,
      unit: "buổi",
      Icon: BarChart2,
      iconBg: "bg-[#f15b5c]/10",
      iconColor: "text-[#f15b5c]",
    },
    {
      title: "PT dạy nhiều nhất",
      value: top ? top.sessionCount : 0,
      unit: "buổi",
      sub: top?.ptName ?? "—",
      Icon: Trophy,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "PT dạy ít nhất",
      value: bottom ? bottom.sessionCount : (top ? top.sessionCount : 0),
      unit: "buổi",
      sub: bottom?.ptName ?? top?.ptName ?? "—",
      Icon: Minus,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Trung bình",
      value: avg,
      unit: "buổi/PT",
      Icon: TrendingUp,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
    },
  ];

  return (
    <div className="mt-5">
      {/* Section header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Users className="w-4 h-4 text-[#f15b5c]" />
          <h2 className="text-base font-extrabold text-gray-900">
            Thống kê buổi dạy theo tháng
          </h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3">
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
              value={selectedPT}
              onChange={(e) => setSelectedPT(e.target.value)}
              disabled={ptNames.length === 0}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer disabled:opacity-50"
            >
              <option value="">Tất cả PT</option>
              {ptNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
            >
              {MONTHS.map((label, i) => (
                <option key={i + 1} value={i + 1}>{label}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <p className="text-sm text-gray-400 font-semibold animate-pulse">Đang tải...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 border-2 border-dashed border-gray-100 rounded-xl">
              <BarChart2 className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Không có dữ liệu trong tháng này</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map(({ title, value, unit, sub, Icon, iconBg, iconColor }) => (
                  <div
                    key={title}
                    className="bg-gray-50/60 rounded-xl p-4 border border-gray-100"
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", iconBg)}>
                      <Icon className={cn("w-4 h-4", iconColor)} />
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                      {value}
                      <span className="text-sm font-semibold text-gray-400 ml-1">{unit}</span>
                    </p>
                    <p className="text-xs text-gray-400 font-semibold mt-0.5">{title}</p>
                    {sub && (
                      <p className="text-xs font-bold text-gray-600 mt-0.5 truncate" title={sub}>
                        {sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              <div className="bg-gray-50/40 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                  Biểu đồ buổi dạy
                </p>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    layout="vertical"
                    data={filtered}
                    barSize={22}
                    margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 600 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="ptName"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }}
                      width={110}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#fafafa" }} />
                    <Bar dataKey="sessionCount" radius={[0, 8, 8, 0]}>
                      {filtered.map((_, i) => (
                        <Cell key={i} fill="#f15b5c" fillOpacity={1 - i * 0.06} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {["STT", "Tên PT", "Cơ sở", "Số buổi dạy", "Số KH", "TB buổi/KH"].map((h, i) => (
                        <th
                          key={h}
                          className={cn(
                            "px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                            i <= 1 ? "text-left" : "text-center"
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => {
                      const avgPerClient =
                        row.clientCount > 0
                          ? (row.sessionCount / row.clientCount).toFixed(1)
                          : "—";
                      return (
                        <tr
                          key={row.ptName}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-bold text-gray-400 text-center w-10">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-extrabold text-[#f15b5c]">
                                  {row.ptName[0]?.toUpperCase() ?? "?"}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-gray-800">{row.ptName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">
                            {row.branchName}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-extrabold bg-[#f15b5c]/10 text-[#f15b5c] min-w-[2.5rem]">
                              {row.sessionCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-blue-50 text-blue-600 min-w-[2.5rem]">
                              {row.clientCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-gray-700">
                            {avgPerClient}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
