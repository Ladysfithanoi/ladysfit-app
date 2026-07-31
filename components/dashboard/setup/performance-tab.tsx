"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

type Personnel = {
  ptId: string;
  ptName: string;
  ptRole?: string;
  ptLevelName?: string | null; // cấp độ PT (vd: "Thử việc", "L1"…) — quyết định KPI
  salesTarget: number;        // KPI doanh số/tháng (triệu) theo cấp độ, do server tính
  revenue: number[];   // 12 entries, index 0 = tháng 1 (đơn vị: triệu)
  customers: number[];
  leads: number[];
  clientCount: number;        // số khách hàng thực tế PT phụ trách (đếm Client)
  transformedCount: number;   // số khách đã gán mác đạt transform
};

function nameWithRole(name: string, role?: string, levelName?: string | null) {
  if (role === "FM") return `${name} (FM)`;
  if (role === "ADMIN") return `${name} (Admin)`;
  if (levelName) return `${name} (${levelName})`;
  return name;
}

type House = {
  revenue: number[];
  customers: number[];
  leads: number[];
};

type PerfData = {
  year: number;
  target: number; // KPI doanh số mặc định / tháng (triệu) khi PT chưa gán cấp độ
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

  // ── Số tháng đã kết thúc để tính trung bình ───────────────────────────────
  // Năm quá khứ: đủ 12 tháng. Năm hiện tại: chỉ các tháng ĐÃ kết thúc (tháng đang
  // diễn ra chưa xong nên loại ra — vd đang tháng 7 thì tính TB của tháng 1→6).
  // Năm tương lai: chưa có tháng nào.
  const now = new Date();
  const monthsElapsed =
    selYear < now.getFullYear() ? 12 :
    selYear > now.getFullYear() ? 0 :
    now.getMonth(); // getMonth() 0-11 = đúng số tháng đã kết thúc (đang tháng 7 → 6)
  const avgDivisor = Math.max(monthsElapsed, 1); // tránh chia 0 (đầu tháng 1 / năm tương lai)
  const isElapsedMonth = (m: number) => m <= monthsElapsed; // m: 1-12
  // Trung bình doanh số/tháng = tổng doanh số các tháng đã kết thúc / số tháng đã kết thúc.
  const avgElapsed = (arr: number[]) => sum(arr.slice(0, avgDivisor)) / avgDivisor;

  // ── Tổng quan: tính trên cả năm cho mỗi nhân sự ──────────────────────────
  const overviewRows = personnel.map((p) => {
    const yearRevenue = sum(p.revenue);
    const avgMonth = avgElapsed(p.revenue);
    // Khách hàng = số Client thực tế PT phụ trách (không cộng dồn lead won theo tháng).
    // Tỉ lệ transform = khách đã đạt transform / tổng khách của chính PT đó.
    const clientCount = p.clientCount;
    const transformedCount = p.transformedCount;
    const transformPct = clientCount > 0 ? (transformedCount / clientCount) * 100 : 0;
    // Hiệu suất doanh số = TB doanh số tháng / KPI theo cấp độ PT (Thử việc 15tr, PT 38tr).
    const kpi = p.salesTarget;
    const perfPct = kpi > 0 ? (avgMonth / kpi) * 100 : 0;
    return {
      ptId: p.ptId,
      ptName: p.ptName,
      ptRole: p.ptRole,
      ptLevelName: p.ptLevelName,
      kpi,
      avgMonth,
      yearRevenue,
      clientCount,
      transformedCount,
      transformPct,
      perfPct,
    };
  });

  // Doanh số phòng tập (lead của nhân sự đã nghỉ) — tính vào tổng đội nhưng không có chủ.
  const houseYearRevenue = house ? sum(house.revenue) : 0;
  const houseYearCustomers = house ? sum(house.customers) : 0;

  const staffYearRevenue = sum(overviewRows.map((r) => r.yearRevenue));
  // Tổng khách hàng đội = tổng khách thực tế các PT phụ trách (không đếm lead won).
  const teamClientCount = sum(overviewRows.map((r) => r.clientCount));
  const teamTransformedCount = sum(overviewRows.map((r) => r.transformedCount));
  const teamTransformPct = teamClientCount > 0 ? (teamTransformedCount / teamClientCount) * 100 : 0;

  // Tổng doanh số đội = nhân sự hiện tại + phòng tập (nhân sự đã nghỉ).
  const teamYearRevenue = staffYearRevenue + houseYearRevenue;
  // TB doanh số/tháng của đội = tổng doanh số các tháng đã kết thúc / số tháng đã kết thúc.
  const teamElapsedRevenue =
    sum(personnel.map((p) => sum(p.revenue.slice(0, avgDivisor)))) +
    (house ? sum(house.revenue.slice(0, avgDivisor)) : 0);
  const teamAvgMonth = teamElapsedRevenue / avgDivisor;
  // KPI đội = tổng KPI theo vị trí của các nhân sự hiện tại (PT 38tr, Thử việc 15tr).
  const teamMonthlyTarget = sum(personnel.map((p) => p.salesTarget));
  // Hiệu suất đội = doanh số đội (gồm phòng tập) / tổng KPI của nhân sự hiện tại.
  const teamPerfPct = teamMonthlyTarget > 0
    ? (teamAvgMonth / teamMonthlyTarget) * 100
    : 0;

  // ── Chi tiết từng tháng theo nhân sự (hoặc toàn đội) ──────────────────────
  const selected = personnel.find((p) => p.ptId === selPT) ?? null;
  // KPI dòng: 1 nhân sự → KPI vị trí của họ; toàn đội → tổng KPI cả đội.
  const rowTarget = selected ? selected.salesTarget : teamMonthlyTarget;

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
  // TB doanh số chỉ tính trên các tháng đã kết thúc trong kỳ đang xem (bỏ tháng đang diễn ra & tháng tương lai).
  const elapsedDetailRows = detailRows.filter((r) => isElapsedMonth(r.month));
  const detElapsedRevenue = sum(elapsedDetailRows.map((r) => r.revenue));
  const detAvgMonths = elapsedDetailRows.length;
  const detAvgRevenue = detAvgMonths > 0 ? detElapsedRevenue / detAvgMonths : 0;
  const detPerfPct = rowTarget > 0 ? (detAvgRevenue / rowTarget) * 100 : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {filterBar}

      {/* Header */}
      <div>
        <h2 className="text-base font-extrabold text-gray-900">Hiệu suất làm việc nhân sự</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Đánh giá theo doanh số cá nhân, số lượng khách hàng và tỉ lệ transform • Hiệu suất doanh số = doanh số thực / KPI theo cấp độ PT
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Doanh số đội (năm)" value={fmtRevenue(teamYearRevenue)} />
        <SummaryCard label="TB doanh số/tháng" value={fmtRevenue(teamAvgMonth)} />
        <SummaryCard label="Tổng khách hàng phụ trách" value={`${teamClientCount}`} />
        <SummaryCard label="Hiệu suất đội" value={fmtPct(teamPerfPct)} highlight={teamPerfPct} />
      </div>

      {/* Section 1: Tổng quan từng nhân sự */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Tổng quan hiệu suất — Năm {selYear}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            TB doanh số tháng chỉ tính trên {avgDivisor} tháng đã kết thúc trong năm (bỏ tháng đang diễn ra) • hiệu suất = TB doanh số tháng / KPI theo cấp độ PT
          </p>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left")}>Nhân sự</th>
                <th className={cn(th, "text-center")}>KPI/tháng</th>
                <th className={cn(th, "text-center")}>TB DS/tháng</th>
                <th className={cn(th, "text-center")}>DS cả năm</th>
                <th className={cn(th, "text-center")}>Khách hàng</th>
                <th className={cn(th, "text-center")}>Tỉ lệ transform</th>
                <th className={cn(th, "text-center")}>Hiệu suất</th>
              </tr>
            </thead>
            <tbody>
              {overviewRows.map((row) => (
                <tr key={row.ptId} className="even:bg-[#fafafa]">
                  <td className={cn(td, "font-semibold text-gray-800")}>{nameWithRole(row.ptName, row.ptRole, row.ptLevelName)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-500")}>{fmtRevenue(row.kpi)}</td>
                  <td className={cn(td, "text-center")}>{fmtRevenue(row.avgMonth)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{fmtRevenue(row.yearRevenue)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-800")}>{row.clientCount}</td>
                  <td className={cn(td, "text-center")}>
                    <span className="font-semibold text-blue-600" title={`${row.transformedCount}/${row.clientCount} khách đạt transform`}>
                      {fmtPct(row.transformPct)}
                    </span>
                  </td>
                  <td className={cn(td, "text-center")}><PerfPct pct={row.perfPct} /></td>
                </tr>
              ))}
              {house && (houseYearRevenue > 0 || houseYearCustomers > 0) && (
                <tr className="even:bg-[#fafafa] bg-gray-50/40">
                  <td className={cn(td, "font-semibold text-gray-500")}>
                    🏠 Nhân sự đã nghỉ / Phòng tập
                  </td>
                  <td className={cn(td, "text-center text-gray-300")}>—</td>
                  <td className={cn(td, "text-center text-gray-500")}>{fmtRevenue(house ? avgElapsed(house.revenue) : 0)}</td>
                  <td className={cn(td, "text-center font-semibold text-gray-700")}>{fmtRevenue(houseYearRevenue)}</td>
                  <td className={cn(td, "text-center text-gray-300")}>—</td>
                  <td className={cn(td, "text-center text-gray-300")}>—</td>
                  <td className={cn(td, "text-center text-gray-300")}>—</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className={cn(td, "font-extrabold text-gray-900")}>Toàn đội</td>
                <td className={cn(td, "text-center font-bold text-gray-700")}>{fmtRevenue(teamMonthlyTarget)}</td>
                <td className={cn(td, "text-center font-bold text-gray-700")}>{fmtRevenue(teamAvgMonth)}</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{fmtRevenue(teamYearRevenue)}</td>
                <td className={cn(td, "text-center font-extrabold text-gray-900")}>{teamClientCount}</td>
                <td className={cn(td, "text-center font-bold text-blue-600")} title={`${teamTransformedCount}/${teamClientCount} khách đạt transform`}>{fmtPct(teamTransformPct)}</td>
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
              Doanh số, số khách chốt và tỉ lệ chốt (khách mua / lead) của {selected ? nameWithRole(selected.ptName, selected.ptRole, selected.ptLevelName) : "toàn đội"} theo từng tháng
            </p>
          </div>
          <select value={selPT} onChange={(e) => setSelPT(e.target.value)} className={filterSelectCls}>
            <option value="">Toàn đội</option>
            {personnel.map((p) => (
              <option key={p.ptId} value={p.ptId}>{nameWithRole(p.ptName, p.ptRole, p.ptLevelName)}</option>
            ))}
          </select>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left")}>Tháng</th>
                <th className={cn(th, "text-center")}>Doanh số</th>
                <th className={cn(th, "text-center")}>Khách chốt</th>
                <th className={cn(th, "text-center")}>Số lead</th>
                <th className={cn(th, "text-center")}>Tỉ lệ chốt</th>
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
          TB doanh số {detAvgMonths} tháng đã kết thúc: <span className="font-semibold text-gray-600">{fmtRevenue(detAvgRevenue)}</span>
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
