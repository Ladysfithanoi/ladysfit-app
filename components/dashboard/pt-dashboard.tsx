import Link from "next/link";
import { Users, Flame, Trophy, TrendingDown, Crown, Medal, Award } from "lucide-react";
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

// Huy hiệu hạng hiển thị ngay trên tên — top 3 có trang trí riêng.
function RankBadge({ rank, total, points }: { rank: number; total: number; points: number }) {
  const deco =
    rank === 1
      ? { Icon: Crown, cls: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm shadow-amber-300/50" }
      : rank === 2
        ? { Icon: Medal, cls: "bg-gradient-to-r from-slate-300 to-slate-400 text-white shadow-sm shadow-slate-300/50" }
        : rank === 3
          ? { Icon: Award, cls: "bg-gradient-to-r from-orange-400 to-amber-600 text-white shadow-sm shadow-orange-300/50" }
          : { Icon: Trophy, cls: "bg-gray-100 text-gray-600" };

  return (
    <Link
      href="/dashboard/ranking"
      title="Xếp hạng cả năm — bấm để xem theo tháng / quý"
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold hover:opacity-90 transition-opacity",
        deco.cls
      )}
    >
      <deco.Icon className="w-3.5 h-3.5" />
      Hạng {rank}/{total}
      <span className="opacity-70 font-bold">· {points} điểm</span>
    </Link>
  );
}

export function PTDashboard({
  stats,
  greeting,
  userName,
  role,
  myRank,
}: {
  stats: PTStats;
  greeting: string;
  userName: string;
  role?: string;
  myRank?: { rank: number; total: number; points: number } | null;
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
        {myRank && (
          <div className="mb-2">
            <RankBadge rank={myRank.rank} total={myRank.total} points={myRank.points} />
          </div>
        )}
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
