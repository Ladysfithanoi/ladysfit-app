"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { UserMinus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminStats } from "./admin-dashboard";

type ChurnClient = AdminStats["churnClients"][number];
type Branch = { id: string; name: string };

const PAGE_SIZE = 8;

// Bucket key for a number of contracts: 1 / 2 / 3 / 4 (= "trên 3").
function bucketOf(contracts: number): 1 | 2 | 3 | 4 {
  if (contracts === 1) return 1;
  if (contracts === 2) return 2;
  if (contracts === 3) return 3;
  return 4;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ChurnStats({
  churnClients,
  branches,
}: {
  churnClients: ChurnClient[];
  branches: Branch[];
}) {
  const [branchId, setBranchId] = useState("");
  const [ptId, setPtId] = useState("");
  const [bucket, setBucket] = useState<"" | "1" | "2" | "3" | "4">("");
  const [statusFilter, setStatusFilter] = useState<"" | "churned" | "active">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // Customers within the selected branch (drives both the cards and the table).
  const branchClients = useMemo(
    () => (branchId ? churnClients.filter((c) => c.branchId === branchId) : churnClients),
    [churnClients, branchId]
  );

  // Churn-rate cards: total buyers + churned, per contract bucket.
  const cards = useMemo(() => {
    const acc = {
      1: { total: 0, churned: 0 },
      2: { total: 0, churned: 0 },
      3: { total: 0, churned: 0 },
      4: { total: 0, churned: 0 },
    };
    for (const c of branchClients) {
      const b = bucketOf(c.contracts);
      acc[b].total += 1;
      if (c.churned) acc[b].churned += 1;
    }
    return [
      { key: "1" as const, title: "Mua 1 lộ trình", ...acc[1], iconBg: "bg-red-50", iconColor: "text-red-500" },
      { key: "2" as const, title: "Mua 2 lộ trình", ...acc[2], iconBg: "bg-amber-50", iconColor: "text-amber-500" },
      { key: "3" as const, title: "Mua 3 lộ trình", ...acc[3], iconBg: "bg-blue-50", iconColor: "text-blue-500" },
      { key: "4" as const, title: "Trên 3 lộ trình", ...acc[4], iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
    ];
  }, [branchClients]);

  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

  // PT options depend on the selected branch.
  const ptOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of branchClients) {
      if (!map.has(c.ptId)) map.set(c.ptId, c.ptName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [branchClients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return branchClients.filter(
      (c) =>
        (!ptId || c.ptId === ptId) &&
        (!bucket || String(bucketOf(c.contracts)) === bucket) &&
        (!statusFilter || (statusFilter === "churned" ? c.churned : !c.churned)) &&
        (!q || c.fullName.toLowerCase().includes(q))
    );
  }, [branchClients, ptId, bucket, statusFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(0); }, [branchId, ptId, bucket, statusFilter, query]);
  useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);
  useEffect(() => { if (ptId && !ptOptions.some((p) => p.id === ptId)) setPtId(""); }, [ptOptions, ptId]);

  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const th = "px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap";
  const td = "px-5 py-3 text-sm whitespace-nowrap";
  const selectCls = "h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <UserMinus className="w-4 h-4 text-[#f15b5c]" />
        <h2 className="text-base font-extrabold text-gray-900">Tỉ lệ khách hàng rời bỏ</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Branch filter + explainer */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectCls}>
            <option value="">Tất cả cơ sở</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 font-medium">
            Rời bỏ = đã hết tất cả lộ trình (hoàn thành/hết hạn) và chưa mua lộ trình mới · Bấm vào thẻ để lọc danh sách
          </p>
        </div>

        {/* Summary cards: churn rate per number-of-contracts bucket (clickable filter) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(({ key, title, churned, total, iconBg, iconColor }) => {
            const active = bucket === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setBucket(active ? "" : key)}
                className={cn(
                  "text-left rounded-xl p-4 border transition-colors",
                  active ? "bg-[#f15b5c]/5 border-[#f15b5c]/40" : "bg-gray-50/60 border-gray-100 hover:border-gray-200"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", iconBg)}>
                  <UserMinus className={cn("w-4 h-4", iconColor)} />
                </div>
                <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{pct(churned, total).toFixed(1)}%</p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">{title}</p>
                <p className="text-xs font-bold text-gray-600 mt-0.5">{churned}/{total} KH rời bỏ</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Full list of buyers, filterable by bucket + status + PT + name */}
      <div className="px-6 py-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold text-gray-900">Danh sách khách hàng theo số lộ trình</h3>
          <span className="ml-auto text-xs font-semibold text-gray-400">{filtered.length} KH</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={bucket} onChange={(e) => setBucket(e.target.value as typeof bucket)} className={selectCls}>
            <option value="">Tất cả số lộ trình</option>
            <option value="1">Mua 1 lộ trình</option>
            <option value="2">Mua 2 lộ trình</option>
            <option value="3">Mua 3 lộ trình</option>
            <option value="4">Trên 3 lộ trình</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectCls}>
            <option value="">Tất cả trạng thái</option>
            <option value="churned">Đã rời bỏ</option>
            <option value="active">Còn lộ trình</option>
          </select>
          <select value={ptId} onChange={(e) => setPtId(e.target.value)} className={selectCls}>
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
          <UserMinus className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">
            {churnClients.length === 0 ? "Chưa có khách hàng nào mua lộ trình" : "Không tìm thấy khách hàng"}
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
                  <th className={cn(th, "text-center")}>Số lộ trình</th>
                  <th className={cn(th, "text-center")}>Trạng thái</th>
                  <th className={cn(th, "text-left")}>Lộ trình gần nhất</th>
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
                    <td className={cn(td, "text-center font-extrabold text-gray-800")}>{c.contracts}</td>
                    <td className={cn(td, "text-center")}>
                      {c.churned ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-500">Đã rời bỏ</span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">Còn lộ trình</span>
                      )}
                    </td>
                    <td className={cn(td, "text-gray-600")}>{c.packageName ?? "—"}</td>
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
