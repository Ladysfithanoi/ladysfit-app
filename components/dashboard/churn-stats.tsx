"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { UserMinus, UserX, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminStats } from "./admin-dashboard";

type ChurnRow = AdminStats["churnStats"][number];
type ChurnedRow = AdminStats["churnedAfterOne"][number];
type Branch = { id: string; name: string };

const PAGE_SIZE = 5;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ChurnStats({
  churnStats,
  churnedAfterOne,
  branches,
}: {
  churnStats: ChurnRow[];
  churnedAfterOne: ChurnedRow[];
  branches: Branch[];
}) {
  const [branchId, setBranchId] = useState("");
  const [ptId, setPtId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // Aggregate churn buckets across the selected branch (or all branches).
  const agg = useMemo(() => {
    const rows = branchId ? churnStats.filter((r) => r.branchId === branchId) : churnStats;
    return rows.reduce(
      (s, r) => ({
        total1: s.total1 + r.total1, churned1: s.churned1 + r.churned1,
        total2: s.total2 + r.total2, churned2: s.churned2 + r.churned2,
        total3: s.total3 + r.total3, churned3: s.churned3 + r.churned3,
        total4plus: s.total4plus + r.total4plus, churned4plus: s.churned4plus + r.churned4plus,
      }),
      { total1: 0, churned1: 0, total2: 0, churned2: 0, total3: 0, churned3: 0, total4plus: 0, churned4plus: 0 }
    );
  }, [churnStats, branchId]);

  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

  const cards = [
    { title: "Mua 1 lộ trình", churned: agg.churned1, total: agg.total1, iconBg: "bg-red-50", iconColor: "text-red-500" },
    { title: "Mua 2 lộ trình", churned: agg.churned2, total: agg.total2, iconBg: "bg-amber-50", iconColor: "text-amber-500" },
    { title: "Mua 3 lộ trình", churned: agg.churned3, total: agg.total3, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
    { title: "Trên 3 lộ trình", churned: agg.churned4plus, total: agg.total4plus, iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
  ];

  // ── Churned-after-one table ──────────────────────────────────────────────
  const ptOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of churnedAfterOne) {
      if (branchId && c.branchId !== branchId) continue;
      if (!map.has(c.ptId)) map.set(c.ptId, c.ptName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [churnedAfterOne, branchId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return churnedAfterOne.filter(
      (c) =>
        (!branchId || c.branchId === branchId) &&
        (!ptId || c.ptId === ptId) &&
        (!q || c.fullName.toLowerCase().includes(q))
    );
  }, [churnedAfterOne, branchId, ptId, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(0); }, [branchId, ptId, query]);
  useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);
  useEffect(() => { if (ptId && !ptOptions.some((p) => p.id === ptId)) setPtId(""); }, [ptOptions, ptId]);

  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const th = "px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap";
  const td = "px-5 py-3 text-sm whitespace-nowrap";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <UserMinus className="w-4 h-4 text-[#f15b5c]" />
        <h2 className="text-base font-extrabold text-gray-900">Tỉ lệ khách hàng rời bỏ</h2>
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
            Rời bỏ = đã hết tất cả lộ trình (hoàn thành/hết hạn) và chưa mua lộ trình mới
          </p>
        </div>

        {/* Summary cards: churn rate per number-of-programs bucket */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(({ title, churned, total, iconBg, iconColor }) => (
            <div key={title} className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", iconBg)}>
                <UserMinus className={cn("w-4 h-4", iconColor)} />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{pct(churned, total).toFixed(1)}%</p>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">{title}</p>
              <p className="text-xs font-bold text-gray-600 mt-0.5">{churned}/{total} KH rời bỏ</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table: customers who bought only 1 lộ trình then left */}
      <div className="px-6 py-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4 text-[#f15b5c]" />
          <h3 className="text-sm font-extrabold text-gray-900">Khách hàng chỉ mua 1 lộ trình rồi nghỉ</h3>
          <span className="ml-auto text-xs font-semibold text-gray-400">{filtered.length} KH</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ptId}
            onChange={(e) => setPtId(e.target.value)}
            className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
          >
            <option value="">Tất cả nhân sự</option>
            {ptOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên khách hàng..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-14 flex flex-col items-center gap-2">
          <UserX className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">
            {churnedAfterOne.length === 0 ? "Chưa có khách hàng nào rời bỏ sau 1 lộ trình" : "Không tìm thấy khách hàng"}
          </p>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className={cn(th, "text-left")}>Tên KH</th>
                  <th className={cn(th, "text-left")}>Cơ sở</th>
                  <th className={cn(th, "text-left")}>Nhân sự</th>
                  <th className={cn(th, "text-left")}>Lộ trình đã mua</th>
                  <th className={cn(th, "text-center")}>Đã giảm</th>
                  <th className={cn(th, "text-center")}>Ngày kết thúc</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                    <td className={td}>
                      <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-2.5 group">
                        <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-extrabold text-[#f15b5c]">{c.fullName[0].toUpperCase()}</span>
                        </div>
                        <span className="font-semibold text-gray-800 group-hover:text-[#f15b5c] transition-colors">
                          {c.fullName}
                        </span>
                      </Link>
                    </td>
                    <td className={cn(td, "text-gray-600")}>{c.branchName}</td>
                    <td className={cn(td, "text-gray-600")}>{c.ptName}</td>
                    <td className={cn(td, "text-gray-600")}>{c.packageName ?? "—"}</td>
                    <td className={cn(td, "text-center font-extrabold text-emerald-500")}>
                      {c.lostKg > 0 ? `−${c.lostKg.toFixed(1)} kg` : "—"}
                    </td>
                    <td className={cn(td, "text-center text-gray-500")}>{fmtDate(c.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
              <span className="text-xs font-semibold text-gray-400">Trang {page + 1}/{totalPages}</span>
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
        </>
      )}
    </div>
  );
}
