import Link from "next/link";
import { Users, Flame, Trophy, Building2, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeightChart, WeekDayData } from "./weight-chart";
import { FMPTSessions } from "./fm-pt-sessions";
import { RecentTransformsTable } from "./recent-transforms-table";

export type AdminStats = {
  totalClients: number;
  activeClients: number;
  transformedCount: number;
  branchCount: number;
  branchStats: {
    id: string;
    name: string;
    ptCount: number;
    totalKH: number;
    activeKH: number;
    transformedKH: number;
    transformRate: number;
  }[];
  recentTransforms: {
    id: string;
    fullName: string;
    branchName: string;
    ptName: string;
    lostKg: number;
    updatedAt: string;
  }[];
  weeklyChart: WeekDayData[];
};

function rateStyle(rate: number) {
  if (rate < 30) return { text: "text-red-500", bg: "bg-red-50" };
  if (rate <= 60) return { text: "text-orange-500", bg: "bg-orange-50" };
  return { text: "text-green-600", bg: "bg-green-50" };
}

export function AdminDashboard({
  stats,
  greeting,
  userName,
  isFM = false,
}: {
  stats: AdminStats;
  greeting: string;
  userName: string;
  isFM?: boolean;
}) {
  const cards = [
    {
      title: "Tổng khách hàng",
      value: stats.totalClients,
      Icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      badge: "bg-blue-50 text-blue-500",
      label: "Toàn hệ thống",
    },
    {
      title: "Đang tập",
      value: stats.activeClients,
      Icon: Flame,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      badge: "bg-orange-50 text-orange-500",
      label: "Hiện tại",
    },
    {
      title: "Đã Transform",
      value: stats.transformedCount,
      Icon: Trophy,
      iconBg: "bg-[#f15b5c]/10",
      iconColor: "text-[#f15b5c]",
      badge: "bg-[#f15b5c]/10 text-[#f15b5c]",
      label: "≥ 7 kg",
    },
    {
      title: "Tổng cơ sở",
      value: stats.branchCount,
      Icon: Building2,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-500",
      badge: "bg-purple-50 text-purple-500",
      label: "Chi nhánh",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">
          {greeting}, {userName} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-1 font-medium">
          Tổng quan toàn hệ thống Ladysfit.
        </p>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ title, value, Icon, iconBg, iconColor, badge, label }) => (
          <div
            key={title}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-row items-center justify-between w-full mb-3">
              <div className={cn("p-2.5 rounded-xl", iconBg)}>
                <Icon className={cn("w-5 h-5", iconColor)} />
              </div>
              <span className={cn("flex flex-row items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap", badge)}>
                {label}
              </span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</p>
            <p className="text-sm text-gray-400 mt-0.5 font-semibold">{title}</p>
          </div>
        ))}
      </div>

      {/* Branch performance */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Building2 className="w-4 h-4 text-[#f15b5c]" />
          <h2 className="text-base font-extrabold text-gray-900">Hiệu quả theo cơ sở</h2>
        </div>
        {stats.branchStats.length === 0 ? (
          <div className="py-14 flex items-center justify-center">
            <p className="text-sm text-gray-300 font-semibold">Chưa có dữ liệu</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  {["Cơ sở", "Số PT", "Tổng KH", "Đang tập", "Đã Transform", "Tỉ lệ Transform"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                          i === 0 ? "text-left" : "text-center"
                        )}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {stats.branchStats.map((b) => {
                  const rs = rateStyle(b.transformRate);
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center text-sm font-bold text-gray-700">
                        {b.ptCount}
                      </td>
                      <td className="px-5 py-3.5 text-center text-sm font-bold text-gray-700">
                        {b.totalKH}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 min-w-[2rem]">
                          {b.activeKH}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f15b5c]/10 text-[#f15b5c] min-w-[2rem]">
                          {b.transformedKH}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-extrabold min-w-[3.5rem]",
                            rs.bg,
                            rs.text
                          )}
                        >
                          {b.totalKH > 0 ? `${b.transformRate.toFixed(0)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FM-only: PT session statistics */}
      {isFM && (
        <FMPTSessions
          branches={stats.branchStats.map((b) => ({ id: b.id, name: b.name }))}
        />
      )}

      {/* Bottom 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent transforms */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#f15b5c]" />
              <h2 className="text-base font-extrabold text-gray-900">Transform gần đây</h2>
            </div>
            <Link
              href="/dashboard/clients"
              className="text-xs font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors"
            >
              Xem tất cả
            </Link>
          </div>
          {stats.recentTransforms.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-2">
              <Trophy className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Chưa có khách đạt Transform</p>
            </div>
          ) : (
            <RecentTransformsTable transforms={stats.recentTransforms} />
          )}
        </div>

        {/* 8-week chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-[#f15b5c]" />
            <h2 className="text-base font-extrabold text-gray-900">
              Tiến độ giảm cân toàn hệ thống
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-5 font-medium">
            Trung bình kg đã giảm — 8 tuần gần nhất
          </p>
          <WeightChart data={stats.weeklyChart} emptyMessage="Chưa có dữ liệu cân nặng" />
        </div>
      </div>
    </div>
  );
}
