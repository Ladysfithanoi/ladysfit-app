"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Crown,
  Medal,
  Award,
  GraduationCap,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  periodLabel,
  type RankPeriod,
  type RankPeriodType,
  type RankRow,
  type RankWeights,
} from "@/lib/ranking-config";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const PAGE_SIZE = 10;

const PERIOD_TYPES: { key: RankPeriodType; label: string }[] = [
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const QUARTERS = [1, 2, 3, 4];

const selectCls =
  "h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer";

// Trang trí riêng cho top 3
const PODIUM = [
  {
    icon: Crown,
    card: "bg-gradient-to-b from-amber-50 to-yellow-100/60 border-amber-200 ring-2 ring-amber-300/60 shadow-lg shadow-amber-200/40",
    badge: "bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-md shadow-amber-300/50",
    label: "text-amber-700",
    title: "Quán quân",
  },
  {
    icon: Medal,
    card: "bg-gradient-to-b from-slate-50 to-slate-100 border-slate-200 ring-1 ring-slate-300/60 shadow-md shadow-slate-200/50",
    badge: "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md shadow-slate-300/50",
    label: "text-slate-600",
    title: "Á quân",
  },
  {
    icon: Award,
    card: "bg-gradient-to-b from-orange-50 to-orange-100/70 border-orange-200 ring-1 ring-orange-300/60 shadow-md shadow-orange-200/50",
    badge: "bg-gradient-to-br from-orange-400 to-amber-600 text-white shadow-md shadow-orange-300/50",
    label: "text-orange-700",
    title: "Hạng ba",
  },
];

function fmtRevenue(v: number) {
  if (v <= 0) return "0";
  return v >= 1 ? `${v.toFixed(1)} tr` : `${(v * 1000).toFixed(0)} k`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return last.charAt(0).toUpperCase() || "?";
}

export function RankingPage({
  rows,
  period,
  myId,
  weights,
}: {
  rows: RankRow[];
  period: RankPeriod;
  myId: string;
  weights: RankWeights;
}) {
  const router = useRouter();

  function goTo(next: Partial<RankPeriod>) {
    const p = { ...period, ...next };
    router.push(
      `/dashboard/ranking?period=${p.type}&year=${p.year}&month=${p.month}&quarter=${p.quarter}`
    );
  }
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const me = rows.find((r) => r.ptId === myId);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  const pageItems = rest.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Đổi kỳ thì danh sách đổi theo, đưa về trang đầu
  useEffect(() => {
    setPage(0);
  }, [period.type, period.year, period.month, period.quarter]);
  useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#f15b5c]/10">
            <Trophy className="w-5 h-5 text-[#f15b5c]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Xếp hạng nhân sự</h1>
            <p className="text-sm text-gray-400 font-medium mt-0.5">
              {periodLabel(period)} — tính theo điểm thi, doanh số trung bình và số khách
              transform
            </p>
          </div>
        </div>

        {/* Chọn kỳ: tháng / quý / năm */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {PERIOD_TYPES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => goTo({ type: key })}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition-all",
                  period.type === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {period.type === "month" && (
            <select
              value={period.month}
              onChange={(e) => goTo({ month: parseInt(e.target.value, 10) })}
              className={selectCls}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          )}

          {period.type === "quarter" && (
            <select
              value={period.quarter}
              onChange={(e) => goTo({ quarter: parseInt(e.target.value, 10) })}
              className={selectCls}
            >
              {QUARTERS.map((q) => (
                <option key={q} value={q}>
                  Quý {q}
                </option>
              ))}
            </select>
          )}

          <select
            value={period.year}
            onChange={(e) => goTo({ year: parseInt(e.target.value, 10) })}
            className={selectCls}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cách tính điểm */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 mb-5 rounded-2xl bg-gray-50 border border-gray-100">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cách tính</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-100">
          <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
          Điểm thi {weights.exam}%
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-100">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          Doanh số {weights.revenue}%
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-100">
          <Sparkles className="w-3.5 h-3.5 text-[#f15b5c]" />
          Transform {weights.transform}%
        </span>
        <span className="text-xs text-gray-400 font-medium">
          · Chỉ tính doanh số và transform phát sinh trong {periodLabel(period).toLowerCase()},
          chấm theo tương quan với người cao nhất · Chưa thi tính 0đ · Transform chỉ tính cho
          người đã kèm khách ít nhất 6 tuần trước ngày khách đạt mốc
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 flex flex-col items-center gap-2">
          <Trophy className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">Chưa có dữ liệu xếp hạng</p>
        </div>
      ) : (
        <>
          {/* Hạng của tôi */}
          {me && (
            <div className="flex items-center gap-4 px-5 py-4 mb-5 rounded-2xl bg-white border border-[#f15b5c]/20 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#f15b5c]/10 flex items-center justify-center shrink-0">
                <span className="text-lg font-extrabold text-[#f15b5c]">#{me.rank}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">
                  Hạng của bạn: {me.rank}/{rows.length}
                </p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {me.points} điểm · Thi {me.examScore}% · Doanh số TB{" "}
                  {fmtRevenue(me.avgMonthlyRevenue)}/tháng · {me.transformedCount} transform
                </p>
              </div>
            </div>
          )}

          {/* ─── Top 3 ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:items-end">
            {top3.map((row, i) => {
              const deco = PODIUM[i];
              const Icon = deco.icon;
              return (
                <div
                  key={row.ptId}
                  className={cn(
                    "relative rounded-2xl border p-5 transition-transform hover:-translate-y-0.5",
                    deco.card,
                    // Quán quân nổi hơn: cao hơn và nằm giữa bục
                    i === 0 ? "md:order-2 md:pb-7" : i === 1 ? "md:order-1" : "md:order-3"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold",
                        deco.badge
                      )}
                    >
                      {row.rank}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide",
                        deco.label
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {deco.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/80 border border-white flex items-center justify-center shrink-0">
                      <span className="text-base font-extrabold text-gray-700">
                        {initials(row.name)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-extrabold text-gray-900 truncate">{row.name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {row.levelName && (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: (row.levelColor || "#6b7280") + "22",
                              color: row.levelColor || "#6b7280",
                            }}
                          >
                            {row.levelName}
                          </span>
                        )}
                        {row.branchName && (
                          <span className="text-[11px] font-semibold text-gray-500 truncate">
                            {row.branchName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end gap-1.5">
                    <p className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
                      {row.points}
                    </p>
                    <p className="text-xs font-bold text-gray-400 mb-0.5">điểm</p>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white/70 py-2">
                      <p className="text-sm font-extrabold text-gray-800">{row.examScore}%</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Thi</p>
                    </div>
                    <div className="rounded-xl bg-white/70 py-2">
                      <p className="text-sm font-extrabold text-gray-800">
                        {fmtRevenue(row.avgMonthlyRevenue)}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">DS/tháng</p>
                    </div>
                    <div className="rounded-xl bg-white/70 py-2">
                      <p className="text-sm font-extrabold text-gray-800">{row.transformedCount}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Transform</p>
                    </div>
                  </div>

                  {row.ptId === myId && (
                    <span className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-[#f15b5c] text-white text-[10px] font-extrabold">
                      Bạn
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── Bảng xếp hạng còn lại ─── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-base font-extrabold text-gray-900">
                Bảng xếp hạng — {periodLabel(period)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {rows.length} nhân sự
                {rest.length > 0 && ` · hạng ${top3.length + 1}–${rows.length}`}
              </p>
            </div>

            {rest.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-300 font-semibold">Không còn nhân sự nào khác</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                {/* min-w-max: bảng giãn theo nội dung nên chữ không bị xuống dòng
                    trên màn hẹp — thay vào đó cả bảng trượt ngang trong khung trên. */}
                <table className="w-full min-w-max">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      {["Hạng", "Nhân sự", "Cấp độ", "Điểm thi", "Doanh số TB", "Transform", "Tổng điểm"].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={cn(
                              "px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                              i === 1 ? "text-left" : "text-center"
                            )}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((row) => (
                      <tr
                        key={row.ptId}
                        className={cn(
                          "border-b border-gray-50 last:border-0 transition-colors",
                          row.ptId === myId ? "bg-[#f15b5c]/5" : "hover:bg-gray-50/40"
                        )}
                      >
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex w-8 h-8 rounded-full bg-gray-100 items-center justify-center text-sm font-extrabold text-gray-600">
                            {row.rank}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                            {row.ptId === myId && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#f15b5c] text-white text-[10px] font-extrabold">
                                Bạn
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{row.branchName ?? row.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span
                            className="text-xs font-semibold px-2 py-1 rounded-full"
                            style={{
                              backgroundColor: (row.levelColor || "#6b7280") + "22",
                              color: row.levelColor || "#6b7280",
                            }}
                          >
                            {row.levelName ?? "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "text-sm font-bold",
                              row.hasExam ? "text-gray-800" : "text-gray-300"
                            )}
                          >
                            {row.examScore}%
                          </span>
                          {!row.hasExam && (
                            <p className="text-[10px] text-gray-400 font-semibold">Chưa thi</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center text-sm font-bold text-gray-800 whitespace-nowrap">
                          {fmtRevenue(row.avgMonthlyRevenue)}
                        </td>
                        <td className="px-5 py-3.5 text-center text-sm font-bold text-gray-800 whitespace-nowrap">
                          {row.transformedCount}
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <span className="text-sm font-extrabold text-[#f15b5c]">{row.points}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <span className="text-xs font-semibold text-gray-400">
                  Trang {page + 1}/{totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Trang sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
