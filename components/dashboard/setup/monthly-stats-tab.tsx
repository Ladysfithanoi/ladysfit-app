"use client";

import { useState, useEffect, useCallback } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

type SourceStat = {
  source: string;
  contracts: number;
  revenue: number;
  contractPct: number;
  revenuePct: number;
};

type PTStat = {
  ptId: string;
  ptName: string;
  contracts: number;
  revenue: number;
  revenuePct: number;
  mainSource: string;
};

type StatsData = {
  bySource: SourceStat[];
  byPT: PTStat[];
  totalContracts: number;
  totalRevenue: number;
};

type Props = {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
};

const SOURCE_COLORS: Record<string, string> = {
  "Facebook Page": "#3b82f6",
  "Referral":      "#10b981",
  "Tiktok":        "#8b5cf6",
  "Zalo":          "#06b6d4",
  "Outdoor":       "#f59e0b",
  "Website":       "#6366f1",
  "Renew":         "#f43f5e",
  "Referral.PT":   "#9ca3af",
};

function fmtRevenue(v: number) {
  return v >= 1 ? `${v.toFixed(1)} tr` : `${(v * 1000).toFixed(0)} k`;
}

const th = "border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 uppercase whitespace-nowrap";
const td = "border border-gray-200 px-3 py-2.5 text-xs text-gray-700";

export function MonthlyStatsTab({ branchId, month, year }: Props) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/setup/monthly-stats?branchId=${branchId}&month=${month}&year=${year}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>;
  if (!data || data.totalContracts === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-300">
        Không có hợp đồng nào trong tháng {month}/{year}
      </div>
    );
  }

  const { bySource, byPT, totalContracts, totalRevenue } = data;

  const contractChartData = bySource.map((s) => ({
    name: s.source,
    value: s.contracts,
    color: SOURCE_COLORS[s.source] ?? "#9ca3af",
  }));

  const revenueChartData = bySource.map((s) => ({
    name: s.source,
    value: parseFloat(s.revenue.toFixed(2)),
    color: SOURCE_COLORS[s.source] ?? "#9ca3af",
  }));

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Page header */}
      <div>
        <h2 className="text-base font-extrabold text-gray-900">
          Thống kê doanh thu theo nguồn — Tháng {month}/{year}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Chỉ tính lead có trạng thái PIF / Đặt cọc / Thanh toán nốt và đã có ngày ký
        </p>
      </div>

      {/* Section 1: Source breakdown table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Phân tích nguồn lead</p>
        </div>
        <div className="overflow-x-auto p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left")}>Nguồn</th>
                <th className={cn(th, "text-center")}>Số hợp đồng</th>
                <th className={cn(th, "text-center")}>Doanh thu</th>
                <th className={cn(th, "text-center")}>% số HĐ</th>
                <th className={cn(th, "text-center")}>% doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {bySource.map((row) => (
                <tr key={row.source} className="even:bg-[#fafafa]">
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SOURCE_COLORS[row.source] ?? "#9ca3af" }}
                      />
                      <span className="font-semibold">{row.source}</span>
                    </div>
                  </td>
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{row.contracts}</td>
                  <td className={cn(td, "text-center")}>{fmtRevenue(row.revenue)}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-blue-600">{row.contractPct}%</span>
                  </td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-emerald-600">{row.revenuePct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={cn(td, "font-extrabold text-gray-900")}>Tổng</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{totalContracts}</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{fmtRevenue(totalRevenue)}</td>
                <td className={cn(td, "text-center font-bold text-gray-500")}>100%</td>
                <td className={cn(td, "text-center font-bold text-gray-500")}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Section 2: Donut charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chart 1: Contracts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-extrabold text-gray-800 mb-4 text-center">
            Tỉ lệ số hợp đồng theo nguồn
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={contractChartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                label={({ percent }) =>
                  (percent ?? 0) > 0.04 ? `${Math.round((percent ?? 0) * 100)}%` : ""
                }
                labelLine={false}
              >
                {contractChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} HĐ`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-2">
            {contractChartData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-600">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Revenue */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-extrabold text-gray-800 mb-4 text-center">
            Tỉ lệ doanh thu theo nguồn
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={revenueChartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                label={({ percent }) =>
                  (percent ?? 0) > 0.04 ? `${Math.round((percent ?? 0) * 100)}%` : ""
                }
                labelLine={false}
              >
                {revenueChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const n = typeof value === "number" ? value : 0;
                  return [`${fmtRevenue(n)}`];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-2">
            {revenueChartData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-600">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: PT breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Phân tích theo PT</p>
        </div>
        <div className="overflow-x-auto p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left")}>PT</th>
                <th className={cn(th, "text-center")}>Số HĐ</th>
                <th className={cn(th, "text-center")}>Doanh thu</th>
                <th className={cn(th, "text-center")}>% tổng DS</th>
                <th className={cn(th, "text-left")}>Nguồn chính</th>
              </tr>
            </thead>
            <tbody>
              {byPT.map((row) => (
                <tr key={row.ptId} className="even:bg-[#fafafa]">
                  <td className={cn(td, "font-semibold text-gray-800")}>{row.ptName}</td>
                  <td className={cn(td, "text-center font-semibold")}>{row.contracts}</td>
                  <td className={cn(td, "text-center")}>{fmtRevenue(row.revenue)}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-emerald-600">{row.revenuePct}%</span>
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-1.5">
                      {row.mainSource !== "—" && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: SOURCE_COLORS[row.mainSource] ?? "#9ca3af" }}
                        />
                      )}
                      <span>{row.mainSource}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
