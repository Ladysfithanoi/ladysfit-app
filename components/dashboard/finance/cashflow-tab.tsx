"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download } from "lucide-react";

type MonthRow   = { month:   number; income: number; expense: number; profit: number };
type QuarterRow = { quarter: number; months: string; income: number; expense: number; profit: number };
type YearRow    = { year:    number; income: number; expense: number; profit: number; growth: number | null };
type DayRow     = { day:     number; income: number; expense: number; balance: number };

type Props = { branchId: string; month: number; year: number };

const MONTH_LABELS = [
  "Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
  "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12",
];

const vnd = (n: number) => {
  if (n === 0) return "—";
  const sign = n < 0 ? "-" : "+";
  return sign + Math.abs(n).toLocaleString("vi-VN") + "đ";
};

const vndAbs = (n: number) => n.toLocaleString("vi-VN") + "đ";

const fmt = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(0) + "M";
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + "K";
  return String(n);
};

export function CashflowTab({ branchId, month, year }: Props) {
  const [viewMode, setViewMode]           = useState<"monthly" | "quarterly" | "yearly" | "daily">("monthly");
  const [selectedYear, setSelectedYear]   = useState(year);
  const [fromYear, setFromYear]           = useState(year - 2);
  const [toYear, setToYear]               = useState(year);
  const [monthlyData, setMonthlyData]     = useState<MonthRow[]>([]);
  const [quarterlyData, setQuarterlyData] = useState<QuarterRow[]>([]);
  const [yearlyData, setYearlyData]       = useState<YearRow[]>([]);
  const [dailyData, setDailyData]         = useState<DayRow[]>([]);
  const [loading, setLoading]             = useState(false);
  const [exporting, setExporting]         = useState(false);

  const fetchMonthly = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/cashflow?branchId=${branchId}&year=${selectedYear}`);
      if (res.ok) setMonthlyData(await res.json());
    } finally { setLoading(false); }
  }, [branchId, selectedYear]);

  const fetchQuarterly = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/cashflow?branchId=${branchId}&year=${selectedYear}&period=quarterly`);
      if (res.ok) setQuarterlyData(await res.json());
    } finally { setLoading(false); }
  }, [branchId, selectedYear]);

  const fetchYearly = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/cashflow?branchId=${branchId}&period=yearly&fromYear=${fromYear}&toYear=${toYear}`);
      if (res.ok) setYearlyData(await res.json());
    } finally { setLoading(false); }
  }, [branchId, fromYear, toYear]);

  const fetchDaily = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/cashflow?branchId=${branchId}&year=${year}&month=${month}`);
      if (res.ok) setDailyData(await res.json());
    } finally { setLoading(false); }
  }, [branchId, year, month]);

  useEffect(() => {
    if (viewMode === "monthly")   fetchMonthly();
    if (viewMode === "quarterly") fetchQuarterly();
    if (viewMode === "yearly")    fetchYearly();
    if (viewMode === "daily")     fetchDaily();
  }, [viewMode, fetchMonthly, fetchQuarterly, fetchYearly, fetchDaily]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const body: Record<string, unknown> = { branchId, period: viewMode };
      if (viewMode === "monthly" || viewMode === "quarterly") body.year = selectedYear;
      if (viewMode === "yearly") { body.fromYear = fromYear; body.toYear = toYear; }

      const res = await fetch("/api/finance/export-cashflow", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) { alert("Xuất thất bại. Vui lòng thử lại."); return; }

      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      const cd    = res.headers.get("Content-Disposition") ?? "";
      const match = /filename\*=UTF-8''([^;]+)/.exec(cd);
      a.href      = url;
      a.download  = match ? decodeURIComponent(match[1]) : "Dong-Tien.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => year - 2 + i);

  const VIEWS = [
    { key: "monthly"   as const, label: "Theo tháng" },
    { key: "quarterly" as const, label: "Theo quý"   },
    { key: "yearly"    as const, label: "Theo năm"   },
    { key: "daily"     as const, label: "Theo ngày"  },
  ];

  return (
    <div className="space-y-4">
      {/* Toggle + selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                viewMode === key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {(viewMode === "monthly" || viewMode === "quarterly") && (
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none"
          >
            {yearOptions.map(y => <option key={y} value={y}>Năm {y}</option>)}
          </select>
        )}

        {viewMode === "yearly" && (
          <div className="flex items-center gap-2">
            <select
              value={fromYear}
              onChange={e => setFromYear(parseInt(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-xs text-gray-400">—</span>
            <select
              value={toYear}
              onChange={e => setToYear(parseInt(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {viewMode === "daily" && (
          <p className="text-xs text-gray-400">Tháng {month}/{year}</p>
        )}

        {viewMode !== "daily" && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        )}
      </div>

      {/* ── Monthly table ───────────────────────────────────────────────────── */}
      {viewMode === "monthly" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] border-b border-gray-200">
                  {["Tháng", "Tổng thu", "Tổng chi", "Lợi nhuận", "Tỉ suất %"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</td></tr>
                ) : (
                  monthlyData.map(row => {
                    const profitRate     = row.income > 0 ? (row.profit / row.income) * 100 : 0;
                    const isCurrentMonth = selectedYear === year && row.month === month;
                    return (
                      <tr key={row.month} className={cn(
                        "border-b border-gray-50 divide-x divide-gray-100",
                        isCurrentMonth && "bg-blue-50/30"
                      )}>
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          {MONTH_LABELS[row.month - 1]}
                          {isCurrentMonth && <span className="ml-1.5 text-[10px] text-blue-500 font-bold">▶</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">
                          {row.income > 0 ? vndAbs(row.income) : "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-500">
                          {row.expense > 0 ? vndAbs(row.expense) : "—"}
                        </td>
                        <td className={cn("px-4 py-3 font-bold", row.profit >= 0 ? "text-blue-600" : "text-red-500")}>
                          {row.income === 0 && row.expense === 0 ? "—" : vnd(row.profit)}
                        </td>
                        <td className={cn("px-4 py-3 font-semibold", profitRate >= 0 ? "text-blue-600" : "text-red-500")}>
                          {row.income === 0 && row.expense === 0 ? "—" : `${profitRate.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!loading && monthlyData.length > 0 && (() => {
                const totalInc  = monthlyData.reduce((s, r) => s + r.income, 0);
                const totalExp  = monthlyData.reduce((s, r) => s + r.expense, 0);
                const totalPro  = totalInc - totalExp;
                const totalRate = totalInc > 0 ? (totalPro / totalInc) * 100 : 0;
                return (
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-extrabold divide-x divide-gray-200">
                      <td className="px-4 py-3 text-gray-700 text-xs uppercase tracking-wide">Cả năm</td>
                      <td className="px-4 py-3 text-emerald-600">{vndAbs(totalInc)}</td>
                      <td className="px-4 py-3 text-red-500">{vndAbs(totalExp)}</td>
                      <td className={cn("px-4 py-3", totalPro >= 0 ? "text-blue-600" : "text-red-500")}>{vnd(totalPro)}</td>
                      <td className={cn("px-4 py-3", totalRate >= 0 ? "text-blue-600" : "text-red-500")}>{totalRate.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      )}

      {/* ── Quarterly table + chart ─────────────────────────────────────────── */}
      {viewMode === "quarterly" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f5] border-b border-gray-200">
                    {["Quý", "Tháng bao gồm", "Tổng thu", "Tổng chi", "Lợi nhuận", "Tỉ suất %"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</td></tr>
                  ) : (
                    quarterlyData.map(row => {
                      const profitRate = row.income > 0 ? (row.profit / row.income) * 100 : 0;
                      return (
                        <tr key={row.quarter} className="border-b border-gray-50 divide-x divide-gray-100">
                          <td className="px-4 py-3 font-bold text-gray-800">Q{row.quarter}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{row.months}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-600">
                            {row.income > 0 ? vndAbs(row.income) : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-red-500">
                            {row.expense > 0 ? vndAbs(row.expense) : "—"}
                          </td>
                          <td className={cn("px-4 py-3 font-bold", row.profit >= 0 ? "text-blue-600" : "text-red-500")}>
                            {row.income === 0 && row.expense === 0 ? "—" : vnd(row.profit)}
                          </td>
                          <td className={cn("px-4 py-3 font-semibold", profitRate >= 0 ? "text-blue-600" : "text-red-500")}>
                            {row.income === 0 && row.expense === 0 ? "—" : `${profitRate.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {!loading && quarterlyData.length > 0 && (() => {
                  const totalInc  = quarterlyData.reduce((s, r) => s + r.income, 0);
                  const totalExp  = quarterlyData.reduce((s, r) => s + r.expense, 0);
                  const totalPro  = totalInc - totalExp;
                  const totalRate = totalInc > 0 ? (totalPro / totalInc) * 100 : 0;
                  return (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-extrabold divide-x divide-gray-200">
                        <td colSpan={2} className="px-4 py-3 text-gray-700 text-xs uppercase tracking-wide">Cả năm</td>
                        <td className="px-4 py-3 text-emerald-600">{vndAbs(totalInc)}</td>
                        <td className="px-4 py-3 text-red-500">{vndAbs(totalExp)}</td>
                        <td className={cn("px-4 py-3", totalPro >= 0 ? "text-blue-600" : "text-red-500")}>{vnd(totalPro)}</td>
                        <td className={cn("px-4 py-3", totalRate >= 0 ? "text-blue-600" : "text-red-500")}>{totalRate.toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>

          {!loading && quarterlyData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Biểu đồ theo quý</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={quarterlyData.map(r => ({ name: `Q${r.quarter}`, "Thu": r.income, "Chi": r.expense, "Lợi nhuận": r.profit }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => typeof v === "number" ? vndAbs(Math.abs(v)) : ""} />
                  <Legend />
                  <Bar dataKey="Thu"       fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="Chi"       fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="Lợi nhuận" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Yearly table + chart ────────────────────────────────────────────── */}
      {viewMode === "yearly" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f5] border-b border-gray-200">
                    {["Năm", "Tổng thu", "Tổng chi", "Lợi nhuận", "Tỉ suất %", "Tăng trưởng LN"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</td></tr>
                  ) : yearlyData.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400 italic">Không có dữ liệu</td></tr>
                  ) : (
                    yearlyData.map(row => {
                      const profitRate = row.income > 0 ? (row.profit / row.income) * 100 : 0;
                      return (
                        <tr key={row.year} className={cn(
                          "border-b border-gray-50 divide-x divide-gray-100",
                          row.year === year && "bg-blue-50/30"
                        )}>
                          <td className="px-4 py-3 font-bold text-gray-800">
                            {row.year}
                            {row.year === year && <span className="ml-1.5 text-[10px] text-blue-500 font-bold">▶</span>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-emerald-600">
                            {row.income > 0 ? vndAbs(row.income) : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-red-500">
                            {row.expense > 0 ? vndAbs(row.expense) : "—"}
                          </td>
                          <td className={cn("px-4 py-3 font-bold", row.profit >= 0 ? "text-blue-600" : "text-red-500")}>
                            {row.income === 0 && row.expense === 0 ? "—" : vnd(row.profit)}
                          </td>
                          <td className={cn("px-4 py-3 font-semibold", profitRate >= 0 ? "text-blue-600" : "text-red-500")}>
                            {row.income === 0 && row.expense === 0 ? "—" : `${profitRate.toFixed(1)}%`}
                          </td>
                          <td className="px-4 py-3">
                            {row.growth === null ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : (
                              <span className={cn("font-bold flex items-center gap-0.5", row.growth >= 0 ? "text-emerald-600" : "text-red-500")}>
                                {row.growth >= 0 ? "↑" : "↓"} {Math.abs(row.growth).toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!loading && yearlyData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Biểu đồ theo năm</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yearlyData.map(r => ({ name: String(r.year), "Thu": r.income, "Chi": r.expense, "Lợi nhuận": r.profit }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => typeof v === "number" ? vndAbs(Math.abs(v)) : ""} />
                  <Legend />
                  <Bar dataKey="Thu"       fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="Chi"       fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="Lợi nhuận" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Daily table ─────────────────────────────────────────────────────── */}
      {viewMode === "daily" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] border-b border-gray-200">
                  {["Ngày", "Thu", "Chi", "Số dư cuối ngày"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</td></tr>
                ) : (
                  dailyData
                    .filter(d => d.income > 0 || d.expense > 0 || d.balance !== 0)
                    .map(row => (
                      <tr key={row.day} className="border-b border-gray-50 hover:bg-gray-50/50 divide-x divide-gray-100">
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          {String(row.day).padStart(2,"0")}/{String(month).padStart(2,"0")}/{year}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">
                          {row.income > 0 ? vndAbs(row.income) : "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-500">
                          {row.expense > 0 ? vndAbs(row.expense) : "—"}
                        </td>
                        <td className={cn("px-4 py-3 font-bold", row.balance >= 0 ? "text-blue-600" : "text-red-500")}>
                          {vnd(row.balance)}
                        </td>
                      </tr>
                    ))
                )}
                {!loading && dailyData.filter(d => d.income > 0 || d.expense > 0).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400 italic">Không có giao dịch trong tháng này</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
