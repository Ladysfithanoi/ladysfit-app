"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, Dumbbell } from "lucide-react";

type StaffStat = {
  userId: string;
  name: string;
  role: string;
  daysReported: number;
  tasksTotal: number;
  tasksCompleted: number;
  taskRate: number;
  teachingSetup: number;
  teachingDone: number;
  teachingRate: number;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

const selectCls =
  "h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer";
const th = "border border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-500 uppercase whitespace-nowrap";
const td = "border border-gray-200 px-3 py-2.5 text-xs text-gray-700";

function rateColor(pct: number): string {
  if (pct >= 100) return "text-green-600";
  if (pct >= 70) return "text-yellow-600";
  return "text-red-500";
}

export function ChecklistMonthlyStats() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState<StaffStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checklist/monthly-stats?month=${month}&year=${year}`);
      if (res.ok) {
        const data = (await res.json()) as { stats: StaffStat[] };
        setStats(data.stats ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const totals = stats.reduce(
    (acc, s) => ({
      tasksTotal: acc.tasksTotal + s.tasksTotal,
      tasksCompleted: acc.tasksCompleted + s.tasksCompleted,
      teachingSetup: acc.teachingSetup + s.teachingSetup,
      teachingDone: acc.teachingDone + s.teachingDone,
    }),
    { tasksTotal: 0, tasksCompleted: 0, teachingSetup: 0, teachingDone: 0 }
  );
  const totalTaskRate = totals.tasksTotal > 0 ? Math.round((totals.tasksCompleted / totals.tasksTotal) * 1000) / 10 : 0;
  const totalTeachRate = totals.teachingSetup > 0 ? Math.round((totals.teachingDone / totals.teachingSetup) * 1000) / 10 : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#f15b5c]/10">
          <BarChart3 className="w-4 h-4 text-[#f15b5c] ml-1.5" />
          <span className="text-sm font-bold text-[#f15b5c] pr-1">Thống kê tháng</span>
        </div>
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={selectCls}>
          {MONTHS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={selectCls}>
          {YEARS.map((y) => <option key={y} value={y}>Năm {y}</option>)}
        </select>
      </div>

      <div>
        <h2 className="text-base font-extrabold text-gray-900">
          Hiệu suất công việc nhân sự — Tháng {month}/{year}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Tổng hợp từ check-list ngày: công việc hoàn thành và số buổi dạy (dòng đánh dấu <Dumbbell className="inline w-3 h-3 text-[#f15b5c]" />)
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>
      ) : stats.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-300">
          Không có nhân sự nào trong phạm vi quản lý
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
            <table className="w-full border-collapse" style={{ minWidth: 720 }}>
              <thead>
                <tr className="bg-[#f5f5f5]">
                  <th className={cn(th, "text-left")}>Nhân sự</th>
                  <th className={cn(th, "text-center")}>Ngày báo cáo</th>
                  <th className={cn(th, "text-center")}>Công việc HT</th>
                  <th className={cn(th, "text-center")}>Tỉ lệ CV</th>
                  <th className={cn(th, "text-center")}>Setup buổi</th>
                  <th className={cn(th, "text-center")}>Đã dạy</th>
                  <th className={cn(th, "text-center")}>Tỉ lệ buổi</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.userId} className="even:bg-[#fafafa]">
                    <td className={cn(td, "font-semibold text-gray-800")}>
                      {s.name}
                      <span className="ml-1.5 text-[10px] font-bold text-gray-400">{s.role}</span>
                    </td>
                    <td className={cn(td, "text-center")}>{s.daysReported}</td>
                    <td className={cn(td, "text-center font-semibold text-gray-800")}>
                      {s.tasksCompleted}/{s.tasksTotal}
                    </td>
                    <td className={cn(td, "text-center")}>
                      <span className={cn("font-bold", rateColor(s.taskRate))}>{s.taskRate}%</span>
                    </td>
                    <td className={cn(td, "text-center font-semibold text-gray-800")}>{s.teachingSetup}</td>
                    <td className={cn(td, "text-center font-semibold text-emerald-600")}>{s.teachingDone}</td>
                    <td className={cn(td, "text-center")}>
                      {s.teachingSetup > 0
                        ? <span className={cn("font-bold", rateColor(s.teachingRate))}>{s.teachingRate}%</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className={cn(td, "font-extrabold text-gray-900")}>Tổng</td>
                  <td className={cn(td, "text-center")}>—</td>
                  <td className={cn(td, "text-center font-extrabold text-gray-900")}>
                    {totals.tasksCompleted}/{totals.tasksTotal}
                  </td>
                  <td className={cn(td, "text-center font-bold")}>
                    <span className={rateColor(totalTaskRate)}>{totalTaskRate}%</span>
                  </td>
                  <td className={cn(td, "text-center font-extrabold text-gray-900")}>{Math.round(totals.teachingSetup * 10) / 10}</td>
                  <td className={cn(td, "text-center font-extrabold text-emerald-600")}>{Math.round(totals.teachingDone * 10) / 10}</td>
                  <td className={cn(td, "text-center font-bold")}>
                    {totals.teachingSetup > 0
                      ? <span className={rateColor(totalTeachRate)}>{totalTeachRate}%</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 leading-relaxed">
        <span className="font-semibold">Cách tính:</span> Công việc hoàn thành = dòng có KPI và T.Đạt ≥ 80% KPI.
        Buổi dạy = các dòng được đánh dấu <Dumbbell className="inline w-3 h-3 text-[#f15b5c]" /> (Setup = tổng KPI, Đã dạy = tổng T.Đạt).
        Số liệu lấy từ check-list ngày mà nhân sự đã lưu trong tháng.
      </p>
    </div>
  );
}
