"use client";

import { useMemo, useState } from "react";
import { Target, UserCheck, UserX, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

type Quality = {
  branchId: string;
  eligible: number;
  eligibleTransformed: number;
  notEligible: number;
  notEligibleTransformed: number;
  notTransformed: number;
  notTransformedOngoing: number;
};

type Branch = { id: string; name: string };

export function TransformQualityStats({
  quality,
  branches,
}: {
  quality: Quality[];
  branches: Branch[];
}) {
  const [branchId, setBranchId] = useState("");

  // Aggregate the per-branch rows for the current selection (all branches or one).
  const agg = useMemo(() => {
    const rows = branchId ? quality.filter((q) => q.branchId === branchId) : quality;
    return rows.reduce(
      (s, q) => ({
        eligible: s.eligible + q.eligible,
        eligibleTransformed: s.eligibleTransformed + q.eligibleTransformed,
        notEligible: s.notEligible + q.notEligible,
        notEligibleTransformed: s.notEligibleTransformed + q.notEligibleTransformed,
        notTransformed: s.notTransformed + q.notTransformed,
        notTransformedOngoing: s.notTransformedOngoing + q.notTransformedOngoing,
      }),
      { eligible: 0, eligibleTransformed: 0, notEligible: 0, notEligibleTransformed: 0, notTransformed: 0, notTransformedOngoing: 0 }
    );
  }, [quality, branchId]);

  const eligibleNotTransformed = agg.eligible - agg.eligibleTransformed;
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

  const rateAchieved = pct(agg.eligibleTransformed, agg.eligible);
  const rateMissed = pct(eligibleNotTransformed, agg.eligible);
  const rateUnexpected = pct(agg.notEligibleTransformed, agg.notEligible);
  const rateOngoing = pct(agg.notTransformedOngoing, agg.notTransformed);

  const cards = [
    {
      title: "Đạt Transform / đủ điều kiện",
      value: `${rateAchieved.toFixed(1)}%`,
      sub: `${agg.eligibleTransformed}/${agg.eligible} KH đủ điều kiện`,
      Icon: UserCheck,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
    },
    {
      title: "Đủ điều kiện nhưng chưa Transform",
      value: `${rateMissed.toFixed(1)}%`,
      sub: `${eligibleNotTransformed}/${agg.eligible} KH đủ điều kiện`,
      Icon: UserX,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      title: "Chưa đủ điều kiện nhưng vẫn Transform",
      value: `${rateUnexpected.toFixed(1)}%`,
      sub: `${agg.notEligibleTransformed}/${agg.notEligible} KH chưa đủ điều kiện`,
      Icon: Target,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
    },
    {
      title: "Chưa Transform vì chưa hết lộ trình",
      value: `${rateOngoing.toFixed(1)}%`,
      sub: `${agg.notTransformedOngoing}/${agg.notTransformed} KH chưa Transform`,
      Icon: Hourglass,
      iconBg: "bg-[#f15b5c]/10",
      iconColor: "text-[#f15b5c]",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Target className="w-4 h-4 text-[#f15b5c]" />
        <h2 className="text-base font-extrabold text-gray-900">Thống kê Transform đạt chuẩn</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Filter + explainer */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 font-medium">
            Đủ điều kiện giảm 7kg = cân nặng (kg) − chiều cao (cm) + 100 ≥ 7
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(({ title, value, sub, Icon, iconBg, iconColor }) => (
            <div key={title} className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", iconBg)}>
                <Icon className={cn("w-4 h-4", iconColor)} />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{value}</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{title}</p>
              <p className="text-xs font-bold text-gray-600 mt-0.5 truncate" title={sub}>{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
