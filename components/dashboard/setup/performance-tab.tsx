"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

type Personnel = {
  ptId: string;
  ptName: string;
  ptRole?: string;
  revenue: number[];   // 12 entries, index 0 = tháng 1 (đơn vị: triệu)
  customers: number[];
  leads: number[];
};

function nameWithRole(name: string, role?: string) {
  if (role === "FM") return `${name} (FM)`;
  if (role === "ADMIN") return `${name} (Admin)`;
  return name;
}

type House = {
  revenue: number[];
  customers: number[];
  leads: number[];
};

type PerfData = {
  year: number;
  target: number; // doanh số mục tiêu / PT / tháng (triệu)
  personnel: Personnel[];
  house: House | null; // doanh số lead của nhân sự đã nghỉ → tính vào phòng tập
};

type Props = {
  branchId: string;
  branchName: string;
  year: number;
};

function fmtRevenue(v: number) {
  if (v <= 0) return "0";
  return v >= 1 ? `${v.toFixed(1)} tr` : `${(v * 1000).toFixed(0)} k`;
}

function fmtPct(v: number) {
  return `${Math.round(v * 10) / 10}%`;
}

const th = "border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 uppercase whitespace-nowrap";
const td = "border border-gray-200 px-3 py-2.5 text-xs text-gray-700";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const filterSelectCls =
  "h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer";

// Tháng (1-12) thuộc kỳ đang chọn: quarter 0 = cả năm.
function monthsOfPeriod(quarter: number): number[] {
  if (quarter >= 1 && quarter <= 4) {
    const start = (quarter - 1) * 3 + 1;
    return [start, start + 1, start + 2];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

// Xếp loại hiệu suất theo % so với mục tiêu doanh số.
function perfBadge(pct: number) {
  if (pct >= 100) return { label: "Đạt", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (pct >= 70) return { label: "Khá", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Chưa đạt", cls: "bg-rose-50 text-rose-700 ring-rose-200" };
}

function PerfPct({ pct }: { pct: number }) {
  const b = perfBadge(pct);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1", b.cls)}>
      {fmtPct(pct)}
    </span>
  );
}

export function PerformanceTab({ branchId, year }: Props) {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selYear, setSelYear] = useState(year);
  const [selQuarter, setSelQuarter] = useState(0); // 0 = cả năm
  const [selPT, setSelPT] = useState(""); // "" = tất cả nhân sự

  const fetchPerf = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/setup/performance?branchId=${branchId}&year=${selYear}`);
      if (res.ok) setData(await res.json());
      else setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, selYear]);

  useEffect(() => { fetchPerf(); }, [fetchPerf]);

  const target = data?.target ?? 38;
  const periodMonths = useMemo(() => monthsOfPeriod(selQuarter), [selQuarter]);
  const periodLabel = selQuarter >= 1 ? `Quý ${selQuarter}/${selYear}` : `Cả năm ${selYear}`;

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <select value={selQuarter} onChange={(e) => setSelQuarter(parseInt(e.target.value))} className={filterSelectCls}>
        <option value={0}>Cả năm</option>
        {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Quý {q}</option>)}
      </select>
      <select value={selYear} onChange={(e) => setSelYear(parseInt(e.target.value))} className={filterSelectCls}>
        {YEAR_OPTIONS.map((y) => <option key={y} value={y}>Năm {y}</option>)}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        {filterBar}
        <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>
      </div>
    );
  }

  const personnel = data?.personnel ?? [];
  const house = data?.house ?? null;
  if (personnel.length === 0 && !house) {
    return (
      <div className="space-y-4 max-w-5xl">
        {filterBar}
        <div className="py-12 text-center text-sm text-gray-300">
          Không có dữ liệu nhân sự trong năm {selYear}
        </div>
      </div>
    );
  }

  // ── Tổng quan: tính trên cả năm cho mỗi nhân sự ──────────────────────────
  const overviewRows = personnel.map((p) => {
    const yearRevenue = sum(p.revenue);
    const yearCustomers = sum(p.customers);
    const yearLeads = sum(p.leads);
    const avgMonth = yearRevenue / 12;
    const avgQuarter = yearRevenue / 4;
    const transformPct = yearLeads > 0 ? (yearCustomers / yearLeads) * 100 : 0;
    const perfPct = target > 0 ? (avgMonth / target) * 100 : 0;
    return {
      ptId: p.ptId,
      ptName: p.ptName,
      ptRole: p.ptRole,
      avgMonth,
      avgQuarter,
      yearRevenue,
      yearCustomers,
      transformPct,
      perfPct,
    };
  });

  // Doanh số phòng tập (lead của nhân sự đã nghỉ) — tính vào tổng đội nhưng không có chủ.
  const houseYearRevenue = house ? sum(house.revenue) : 0;
  const houseYearCustomers = house ? sum(house.customers) : 0;
  const houseYearLeads = house ? sum(house.leads) : 0;
  const houseTransformPct = houseYearLeads > 0 ? (houseYearCustomers / houseYearLeads) * 100 : 0;

  const staffYearRevenue = sum(overviewRows.map((r) => r.yearRevenue));
  const staffYearCustomers = sum(overviewRows.map((r) => r.yearCustomers));

  // Tổng doanh số đội = nhân sự hiện tại + phòng tập (nhân sự đã nghỉ).
  const teamYearRevenue = staffYearRevenue + houseYearRevenue;
  const teamYearCustomers = staffYearCustomers + houseYearCustomers;
  const teamAvgMonth = teamYearRevenue / 12;
  // Hiệu suất đội = doanh số đội (gồm phòng tập) / mục tiêu của số nhân sự hiện tại.
  const teamPerfPct = target > 0 && personnel.length > 0
    ? (teamAvgMonth / (target * personnel.length)) * 100
    : 0;

  // ── Chi tiết từng tháng theo nhân sự (hoặc toàn đội) ──────────────────────
  const selected = personnel.find((p) => p.ptId === selPT) ?? null;
  // Số nhân sự dùng để quy đổi mục tiêu khi xem toàn đội.
  const headcount = selected ? 1 : personnel.length;
  const rowTarget = target * headcount;

  const detailRows = periodMonths.map((m) => {
    const idx = m - 1;
    // Toàn đội = nhân sự hiện tại + phòng tập (lead của nhân sự đã nghỉ).
    const revenue = selected
      ? selected.revenue[idx]
      : sum(personnel.map((p) => p.revenue[idx])) + (house?.revenue[idx] ?? 0);
    const customers = selected
      ? selected.customers[idx]
      : sum(personnel.map((p) => p.customers[idx])) + (house?.customers[idx] ?? 0);
    const leads = selected
      ? selected.leads[idx]
      : sum(personnel.map((p) => p.leads[idx])) + (house?.leads[idx] ?? 0);
    const transformPct = leads > 0 ? (customers / leads) * 100 : 0;
    const perfPct = rowTarget > 0 ? (revenue / rowTarget) * 100 : 0;
    return { month: m, revenue, customers, leads, transformPct, perfPct };
  });

  const detRevenue = sum(detailRows.map((r) => r.revenue));
  const detCustomers = sum(detailRows.map((r) => r.customers));
  const detLeads = sum(detailRows.map((r) => r.leads));
  const detTransformPct = detLeads > 0 ? (detCustomers / detLeads) * 100 : 0;
  const detAvgRevenue = detailRows.length > 0 ? detRevenue / detailRows.length : 0;
  const detPerfPct = rowTarget > 0 ? (detAvgRevenue / rowTarget) * 100 : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {filterBar}

      {/* Header */}
      <div>
        <h2 className="text-base font-extrabold text-gray-900">Hiệu suất làm việc nhân sự</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Đánh giá theo doanh số cá nhân, số lượng khách hàng và tỉ lệ transform • Mục tiêu {target} tr/PT/tháng
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Doanh số đội (năm)" value={fmtRevenue(teamYearRevenue)} />
        <SummaryCard label="TB doanh số/tháng" value={fmtRevenue(teamAvgMonth)} />
        <SummaryCard label="Tổng khách hàng (năm)" value={`${teamYearCustomers}`} />
        <SummaryCard label="Hiệu suất đội" value={fmtPct(teamPerfPct)} highlight={teamPerfPct} />
      </div>

      {/* Section 1: Tổng quan từng nhân sự */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Tổng quan hiệu suất — Năm {selYear}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Trung bình doanh số tháng / quý và tổng doanh số năm của từng nhân sự (hiệu suất = TB tháng / mục tiêu {target} tr)
          </p>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left")}>Nhân sự</th>
                <th className={cn(th, "text-center")}>TB DS/tháng</th>
                <th className={cn(th, "text-center")}>TB DS/quý</th>
                <th className={cn(th, "text-center")}>DS cả năm</th>
                <th className={cn(th, "text-center")}>Khách hàng</th>
                <th className={cn(th, "text-center")}>Tỉ lệ transform</th>
                <th className={cn(th, "text-center")}>Hiệu suất</th>
              </tr>
            </thead>
            <tbody>
              {overviewRows.map((row) => (
                <tr key={row.ptId} className="even:bg-[#fafafa]">
                  <td className={cn(td, "font-semibold text-gray-800")}>{nameWithRole(row.ptName, row.ptRole)}</td>
                  <td className={cn(td, "text-center")}>{fmtRevenue(row.avgMonth)}</td>
                  <td className={cn(td, "text-center")}>{fmtRevenue(row.avgQuarter)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{fmtRevenue(row.yearRevenue)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{row.yearCustomers}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-blue-600">{fmtPct(row.transformPct)}</span>
                  </td>
                  <td className={cn(td, "text-center")}><PerfPct pct={row.perfPct} /></td>
                </tr>
              ))}
              {house && (houseYearRevenue > 0 || houseYearCustomers > 0) && (
                <tr className="even:bg-[#fafafa] bg-gray-50/40">
                  <td className={cn(td, "font-semibold text-gray-500")}>
                    🏠 Nhân sự đã nghỉ / Phòng tập
                  </td>
                  <td className={cn(td, "text-center text-gray-500")}>{fmtRevenue(houseYearRevenue / 12)}</td>
                  <td className={cn(td, "text-center text-gray-500")}>{fmtRevenue(houseYearRevenue / 4)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-700")}>{fmtRevenue(houseYearRevenue)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-700")}>{houseYearCustomers}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-blue-600">{fmtPct(houseTransformPct)}</span>
                  </td>
                  <td className={cn(td, "text-center text-gray-300")}>—</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={cn(td, "font-extrabold text-gray-900")}>Toàn đội</td>
                <td className={cn(td, "text-center font-bold text-gray-700")}>{fmtRevenue(teamAvgMonth)}</td>
                <td className={cn(td, "text-center font-bold text-gray-700")}>{fmtRevenue(teamYearRevenue / 4)}</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{fmtRevenue(teamYearRevenue)}</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{teamYearCustomers}</td>
                <td className={cn(td, "text-center")}>—</td>
                <td className={cn(td, "text-center font-bold text-emerald-600")}>{fmtPct(teamPerfPct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Section 2: Chi tiết từng tháng */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-gray-800">Chi tiết theo tháng — {periodLabel}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Doanh số, số khách hàng và tỉ lệ transform của {selected ? nameWithRole(selected.ptName, selected.ptRole) : "toàn đội"} theo từng tháng
            </p>
          </div>
          <select value={selPT} onChange={(e) => setSelPT(e.target.value)} className={filterSelectCls}>
            <option value="">Toàn đội</option>
            {personnel.map((p) => (
              <option key={p.ptId} value={p.ptId}>{nameWithRole(p.ptName, p.ptRole)}</option>
            ))}
          </select>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left")}>Tháng</th>
                <th className={cn(th, "text-center")}>Doanh số</th>
                <th className={cn(th, "text-center")}>Khách hàng</th>
                <th className={cn(th, "text-center")}>Số lead</th>
                <th className={cn(th, "text-center")}>Tỉ lệ transform</th>
                <th className={cn(th, "text-center")}>Hiệu suất</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => (
                <tr key={row.month} className="even:bg-[#fafafa]">
                  <td className={cn(td, "font-semibold text-gray-800")}>Tháng {row.month}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{fmtRevenue(row.revenue)}</td>
                  <td className={cn(td, "text-center")}>{row.customers}</td>
                  <td className={cn(td, "text-center text-gray-500")}>{row.leads}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-blue-600">{fmtPct(row.transformPct)}</span>
                  </td>
                  <td className={cn(td, "text-center")}><PerfPct pct={row.perfPct} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={cn(td, "font-extrabold text-gray-900")}>
                  Tổng ({detailRows.length} tháng)
                </td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{fmtRevenue(detRevenue)}</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{detCustomers}</td>
                <td className={cn(td, "text-center font-bold text-gray-500")}>{detLeads}</td>
                <td className={cn(td, "text-center font-bold text-blue-600")}>{fmtPct(detTransformPct)}</td>
                <td className={cn(td, "text-center font-bold text-emerald-600")}>{fmtPct(detPerfPct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-gray-100 text-[11px] text-gray-400">
          TB doanh số {detailRows.length} tháng: <span className="font-semibold text-gray-600">{fmtRevenue(detAvgRevenue)}</span>
          {" • "}Mục tiêu: <span className="font-semibold text-gray-600">{fmtRevenue(rowTarget)}/tháng</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: number }) {
  const color =
    highlight === undefined
      ? "text-gray-900"
      : highlight >= 100
        ? "text-emerald-600"
        : highlight >= 70
          ? "text-amber-600"
          : "text-rose-600";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      <p className={cn("text-lg font-extrabold mt-0.5", color)}>{value}</p>
    </div>
  );
}
