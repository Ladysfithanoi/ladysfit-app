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

type SourceConvStat = {
  source: string;
  leads: number;
  contracts: number;
  leadPct: number;
  conversionPct: number;
};

type BucketStat = {
  bucket: string;
  leads: number;
  contracts: number;
  leadPct: number;
  conversionPct: number;
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
  bySourceAll: SourceConvStat[];
  byAge: BucketStat[];
  byWeight: BucketStat[];
  byPT: PTStat[];
  totalLeads: number;
  totalContracts: number;
  totalRevenue: number;
};

type Props = {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
  period?: "month" | "quarter" | "year";
  quarter?: number;
};

const SOURCE_COLORS: Record<string, string> = {
  "Facebook Page":        "#3b82f6",
  "Referral":             "#06b6d4",
  "Tiktok":               "#a855f7",
  "Thread":               "#0f172a",
  "Zalo":                 "#14b8a6",
  "Outdoor":              "#f97316",
  "Website":              "#eab308",
  "Renew":                "#f43f5e",
  "Referral.PT":          "#10b981",
  "Walk-in":              "#ec4899",
  "Thương hiệu cá nhân":  "#6366f1",
};

function fmtRevenue(v: number) {
  return v >= 1 ? `${v.toFixed(1)} tr` : `${(v * 1000).toFixed(0)} k`;
}

const th = "border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 uppercase whitespace-nowrap";
const td = "border border-gray-200 px-3 py-2.5 text-xs text-gray-700";

export function MonthlyStatsTab({ branchId, month, year, period = "month", quarter = 1 }: Props) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const periodLabel =
    period === "quarter" ? `Quý ${quarter}/${year}` : period === "year" ? `Năm ${year}` : `Tháng ${month}/${year}`;

  const fetchStats = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const periodQs =
        period === "quarter"
          ? `period=quarter&quarter=${quarter}&year=${year}`
          : period === "year"
            ? `period=year&year=${year}`
            : `month=${month}&year=${year}`;
      const res = await fetch(`/api/setup/monthly-stats?branchId=${branchId}&${periodQs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year, period, quarter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>;
  if (!data || data.totalLeads === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-300">
        Không có lead nào trong {periodLabel}
      </div>
    );
  }

  const { bySource, bySourceAll, byAge, byWeight, byPT, totalLeads, totalContracts, totalRevenue } = data;
  const overallConversionPct = totalLeads > 0 ? Math.round((totalContracts / totalLeads) * 1000) / 10 : 0;

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
          Thống kê nguồn lead — {periodLabel}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Tổng {totalLeads} lead • {totalContracts} đã chốt HĐ • tỉ lệ chốt {overallConversionPct}%
        </p>
      </div>

      {/* Section 0: Lead source + conversion (all leads) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Phân tích nguồn lead</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Toàn bộ lead về theo nguồn và tỉ lệ chốt hợp đồng của từng kênh
          </p>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left")}>Nguồn</th>
                <th className={cn(th, "text-center")}>Số lead</th>
                <th className={cn(th, "text-center")}>% lead</th>
                <th className={cn(th, "text-center")}>Đã chốt</th>
                <th className={cn(th, "text-center")}>Tỉ lệ chốt</th>
              </tr>
            </thead>
            <tbody>
              {bySourceAll.map((row) => (
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
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{row.leads}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-blue-600">{row.leadPct}%</span>
                  </td>
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{row.contracts}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-emerald-600">{row.conversionPct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={cn(td, "font-extrabold text-gray-900")}>Tổng</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{totalLeads}</td>
                <td className={cn(td, "text-center font-bold text-gray-500")}>100%</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{totalContracts}</td>
                <td className={cn(td, "text-center font-bold text-emerald-600")}>{overallConversionPct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Section 1: Source breakdown by revenue (won contracts only) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Phân tích nguồn lead theo doanh thu</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Doanh thu tính theo tất cả lead trong tháng (khớp Tổng doanh thu ở Setup); số HĐ là lead đã chốt (PIF / Đặt cọc / Thanh toán nốt)
          </p>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
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

      {/* Section 1b: Lead profile (chuẩn tệp) — age & weight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProfileTable
          title="Phân tích nguồn lead chuẩn tệp — Độ tuổi"
          colLabel="Độ tuổi"
          rows={byAge}
        />
        <ProfileTable
          title="Phân tích nguồn lead chuẩn tệp — Cân nặng"
          colLabel="Chênh lệch cân nặng"
          rows={byWeight}
        />
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
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
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

function ProfileTable({
  title,
  colLabel,
  rows,
}: {
  title: string;
  colLabel: string;
  rows: BucketStat[];
}) {
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalContracts = rows.reduce((s, r) => s + r.contracts, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-sm font-extrabold text-gray-800">{title}</p>
      </div>
      <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f5f5f5]">
              <th className={cn(th, "text-left")}>{colLabel}</th>
              <th className={cn(th, "text-center")}>Số lead</th>
              <th className={cn(th, "text-center")}>% lead</th>
              <th className={cn(th, "text-center")}>Đã chốt</th>
              <th className={cn(th, "text-center")}>Tỉ lệ chốt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bucket} className="even:bg-[#fafafa]">
                <td className={cn(td, "font-semibold text-gray-800")}>{row.bucket}</td>
                <td className={cn(td, "text-center font-semibold text-gray-800")}>{row.leads}</td>
                <td className={cn(td, "text-center")}>
                  <span className="font-semibold text-blue-600">{row.leadPct}%</span>
                </td>
                <td className={cn(td, "text-center font-semibold text-gray-800")}>{row.contracts}</td>
                <td className={cn(td, "text-center")}>
                  <span className="font-semibold text-emerald-600">{row.conversionPct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td className={cn(td, "font-extrabold text-gray-900")}>Tổng</td>
              <td className={cn(td, "text-center font-extrabold text-gray-900")}>{totalLeads}</td>
              <td className={cn(td, "text-center font-bold text-gray-500")}>100%</td>
              <td className={cn(td, "text-center font-extrabold text-gray-900")}>{totalContracts}</td>
              <td className={cn(td, "text-center font-bold text-emerald-600")}>
                {totalLeads > 0 ? Math.round((totalContracts / totalLeads) * 1000) / 10 : 0}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
