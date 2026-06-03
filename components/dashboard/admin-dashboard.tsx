import Link from "next/link";
import { Users, Flame, Trophy, Building2, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WeightChart, WeekDayData } from "./weight-chart";
import { FMPTSessions } from "./fm-pt-sessions";
import { RecentTransformsTable } from "./recent-transforms-table";
import { BranchPerformance } from "./branch-performance";
import { TransformStats } from "./transform-stats";
import { TransformQualityStats } from "./transform-quality-stats";
import { NotTransformedTable } from "./not-transformed-table";
import { ChurnStats } from "./churn-stats";

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
  transformEvents: {
    branchId: string;
    branchName: string;
    date: string;
  }[];
  transformQuality: {
    branchId: string;
    eligible: number;
    eligibleTransformed: number;
    notEligible: number;
    notEligibleTransformed: number;
    eligibleNotTransformedOngoing: number;
  }[];
  notTransformedClients: {
    id: string;
    fullName: string;
    branchId: string;
    branchName: string;
    ptId: string;
    ptName: string;
    currentWeight: number;
    initialWeight: number;
    lostKg: number;
    eligible: boolean | null;
    hasOngoingProgram: boolean;
  }[];
  churnClients: {
    id: string;
    fullName: string;
    branchId: string;
    branchName: string;
    ptId: string;
    ptName: string;
    contracts: number;
    churned: boolean;
    packageName: string | null;
    endDate: string | null;
  }[];
  weeklyChart: WeekDayData[];
};

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
      <BranchPerformance branchStats={stats.branchStats} />

      {/* Transform statistics over time (total + per-branch + month/quarter) */}
      <TransformStats
        events={stats.transformEvents}
        branches={stats.branchStats.map((b) => ({ id: b.id, name: b.name, totalKH: b.totalKH }))}
      />

      {/* Transform quality — eligible (≥7kg above ideal) vs achieved + avg programs */}
      <TransformQualityStats
        quality={stats.transformQuality}
        branches={stats.branchStats.map((b) => ({ id: b.id, name: b.name }))}
      />

      {/* Detail table: clients who haven't Transformed yet, filterable by branch + PT */}
      <NotTransformedTable
        clients={stats.notTransformedClients}
        branches={stats.branchStats.map((b) => ({ id: b.id, name: b.name }))}
      />

      {/* Churn rate by number of lộ trình bought + full filterable list of buyers */}
      <ChurnStats
        churnClients={stats.churnClients}
        branches={stats.branchStats.map((b) => ({ id: b.id, name: b.name }))}
      />

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
