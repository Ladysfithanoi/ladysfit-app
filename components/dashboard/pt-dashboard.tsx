import Link from "next/link";
import { Users, Flame, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeightChart, WeekDayData } from "./weight-chart";
import { UpgradeCard } from "./exam/upgrade-card";

export type PTStats = {
  totalClients: number;
  activeClients: number;
  transformedCount: number;
  clientProgress: {
    id: string;
    fullName: string;
    currentWeight: number;
    initialWeight: number;
    targetWeight: number;
    lostKg: number;
    progressPct: number;
    isTransformed: boolean;
  }[];
  recentLogs: {
    clientId: string;
    clientName: string;
    weight: number;
    change: number | null;
    logDate: string;
  }[];
  weeklyChart: WeekDayData[];
};

function timeAgo(isoDate: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  return `${Math.floor(diffDays / 30)} tháng trước`;
}

export function PTDashboard({
  stats,
  greeting,
  userName,
  role,
}: {
  stats: PTStats;
  greeting: string;
  userName: string;
  role?: string;
}) {
  const cards = [
    {
      title: "Khách hàng của tôi",
      value: stats.totalClients,
      Icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      badge: "bg-blue-50 text-blue-500",
      label: "Tổng",
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
  ];

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">
          {greeting}, {userName} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-1 font-medium">
          Tổng quan khách hàng của bạn.
        </p>
      </div>

      {/* Upgrade card for RESTRICTED or FREE roles */}
      {(role === "RESTRICTED" || role === "FREE") && <UpgradeCard />}

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {cards.map(({ title, value, Icon, iconBg, iconColor, badge, label }) => (
          <div
            key={title}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn("p-2.5 rounded-xl", iconBg)}>
                <Icon className={cn("w-5 h-5", iconColor)} />
              </div>
              <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", badge)}>
                {label}
              </span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</p>
            <p className="text-sm text-gray-400 mt-0.5 font-semibold">{title}</p>
          </div>
        ))}
      </div>

      {/* Client progress table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#f15b5c]" />
            <h2 className="text-base font-extrabold text-gray-900">
              Tiến độ khách hàng của tôi
            </h2>
          </div>
          <Link
            href="/dashboard/clients"
            className="text-xs font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors"
          >
            Xem tất cả
          </Link>
        </div>
        {stats.clientProgress.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-2">
            <Users className="w-8 h-8 text-gray-200" />
            <p className="text-sm text-gray-300 font-semibold">Chưa có khách hàng</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  {["Tên KH", "Cân nặng HT", "Đã giảm", "Tiến độ", "Tình trạng"].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                        i === 0 ? "text-left" : i === 3 ? "text-left" : "text-center"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.clientProgress.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="flex items-center gap-2.5 group"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-extrabold text-[#f15b5c]">
                            {c.fullName[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800 group-hover:text-[#f15b5c] transition-colors">
                          {c.fullName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-sm font-bold text-[#f15b5c]">
                        {c.currentWeight} kg
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-sm font-extrabold text-emerald-500">
                        {c.lostKg > 0 ? `−${c.lostKg.toFixed(1)} kg` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 min-w-[110px]">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${c.progressPct}%`, backgroundColor: "#f15b5c" }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500 w-9 text-right shrink-0">
                          {c.progressPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {c.isTransformed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f15b5c]/10 text-[#f15b5c] whitespace-nowrap">
                          ⭐ Transform
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent weight logs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <TrendingDown className="w-4 h-4 text-[#f15b5c]" />
            <h2 className="text-base font-extrabold text-gray-900">
              Cập nhật cân nặng gần đây
            </h2>
          </div>
          {stats.recentLogs.length === 0 ? (
            <div className="py-14 flex items-center justify-center">
              <p className="text-sm text-gray-300 font-semibold">Chưa có cập nhật</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.recentLogs.map((log, i) => (
                <Link
                  key={i}
                  href={`/dashboard/clients/${log.clientId}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-extrabold text-[#f15b5c]">
                        {log.clientName[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {log.clientName}
                      </p>
                      <p className="text-xs text-gray-400">{timeAgo(log.logDate)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-extrabold text-gray-900">{log.weight} kg</p>
                    {log.change !== null && (
                      <div
                        className={cn(
                          "flex items-center justify-end gap-0.5 text-xs font-bold",
                          log.change < 0
                            ? "text-emerald-500"
                            : log.change > 0
                            ? "text-red-400"
                            : "text-gray-400"
                        )}
                      >
                        {log.change < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : log.change > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : null}
                        {log.change !== 0
                          ? `${log.change > 0 ? "+" : ""}${log.change.toFixed(1)} kg`
                          : "Không đổi"}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 8-week chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-[#f15b5c]" />
            <h2 className="text-base font-extrabold text-gray-900">Tiến độ giảm cân của tôi</h2>
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
