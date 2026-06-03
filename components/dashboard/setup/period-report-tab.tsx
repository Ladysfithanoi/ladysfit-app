"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

type Props = {
  branchId: string;
  year: number;
  period: "quarter" | "year";
  quarter: number; // only meaningful when period === "quarter"
};

type ReportRow = {
  key: string;
  label: string;
  isFloat: boolean;
  subTargets: number[];
  subActuals: number[];
  totalTarget: number;
  totalActual: number;
  pct: number;
};

type ReportData = {
  period: "quarter" | "year";
  year: number;
  quarter: number | null;
  subPeriods: { short: string; label: string }[];
  totalLabel: string;
  rows: ReportRow[];
};

function pctColor(pct: number) {
  if (pct >= 100) return "text-emerald-600 font-bold";
  if (pct >= 70) return "text-yellow-600 font-bold";
  return "text-red-500 font-bold";
}

function fmt(v: number, isFloat: boolean) {
  return isFloat ? v.toFixed(1) : Math.round(v);
}

export function PeriodReportTab({ branchId, year, period, quarter }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const qs = `branchId=${branchId}&year=${year}&period=${period}` + (period === "quarter" ? `&quarter=${quarter}` : "");
      const res = await fetch(`/api/setup/period-report?${qs}`);
      if (res.ok) setData(await res.json());
      else setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, year, period, quarter]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>;
  if (!data || data.rows.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-300">Chưa có dữ liệu</div>;
  }

  const th = "border border-gray-200 px-3 py-2.5 font-bold text-gray-500 uppercase text-xs whitespace-nowrap";
  const td = "border border-gray-200 px-3 py-2.5 text-xs";
  const title = period === "year" ? `Báo cáo tổng hợp năm ${year}` : `Báo cáo tổng hợp Quý ${data.quarter}/${year}`;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">{title}</p>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left w-8")}>STT</th>
                <th className={cn(th, "text-left")}>Công việc</th>
                {data.subPeriods.map((s) => (
                  <th key={`mt-${s.short}`} className={cn(th, "text-center")}>{s.short} MT</th>
                ))}
                {data.subPeriods.map((s) => (
                  <th key={`dat-${s.short}`} className={cn(th, "text-center")}>{s.short} ĐẠT</th>
                ))}
                <th className={cn(th, "text-center")}>{data.totalLabel} MT</th>
                <th className={cn(th, "text-center")}>{data.totalLabel} ĐẠT</th>
                <th className={cn(th, "text-center")}>%</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => (
                <tr key={row.key} className="even:bg-[#fafafa]">
                  <td className={cn(td, "text-center text-gray-400")}>{idx + 1}</td>
                  <td className={cn(td, "font-semibold text-gray-700")}>{row.label}</td>
                  {row.subTargets.map((v, i) => (
                    <td key={`mt-${i}`} className={cn(td, "text-center text-gray-400")}>{fmt(v, row.isFloat)}</td>
                  ))}
                  {row.subActuals.map((v, i) => (
                    <td key={`dat-${i}`} className={cn(td, "text-center text-gray-700")}>{fmt(v, row.isFloat)}</td>
                  ))}
                  <td className={cn(td, "text-center text-gray-500")}>{fmt(row.totalTarget, row.isFloat)}</td>
                  <td className={cn(td, "text-center font-bold text-gray-800")}>{fmt(row.totalActual, row.isFloat)}</td>
                  <td className={cn(td, "text-center")}>
                    <span className={pctColor(row.pct)}>{row.pct}%</span>
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
