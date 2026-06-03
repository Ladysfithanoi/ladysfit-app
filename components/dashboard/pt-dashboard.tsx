import { Users, Flame, Trophy, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeightChart, WeekDayData } from "./weight-chart";
import { UpgradeCard } from "./exam/upgrade-card";
import { ClientProgressCard, RecentWeightLogsCard } from "./pt-overview-sections";

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

      {/* Upgrade card for PT roles */}
      {role === "PT" && <UpgradeCard />}

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

      {/* Client progress table — paginated + name search */}
      <ClientProgressCard clients={stats.clientProgress} />

      {/* Bottom 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent weight logs — paginated */}
        <RecentWeightLogsCard logs={stats.recentLogs} />

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
