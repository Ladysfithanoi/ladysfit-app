"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { UserX, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminStats } from "./admin-dashboard";

type Row = AdminStats["notTransformedClients"][number];
type Branch = { id: string; name: string };

const PAGE_SIZE = 10;

export function NotTransformedTable({
  clients,
  branches,
}: {
  clients: Row[];
  branches: Branch[];
}) {
  const [branchId, setBranchId] = useState("");
  const [ptId, setPtId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // PT options depend on the selected branch (only staff that have such clients).
  const ptOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clients) {
      if (branchId && c.branchId !== branchId) continue;
      if (!map.has(c.ptId)) map.set(c.ptId, c.ptName);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [clients, branchId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (!branchId || c.branchId === branchId) &&
        (!ptId || c.ptId === ptId) &&
        (!q || c.fullName.toLowerCase().includes(q))
    );
  }, [clients, branchId, ptId, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(0); }, [branchId, ptId, query]);
  useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);
  // Reset PT filter if it no longer belongs to the selected branch.
  useEffect(() => {
    if (ptId && !ptOptions.some((p) => p.id === ptId)) setPtId("");
  }, [ptOptions, ptId]);

  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const th = "px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap";
  const td = "px-5 py-3 text-sm whitespace-nowrap";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center gap-2">
          <UserX className="w-4 h-4 text-[#f15b5c]" />
          <h2 className="text-base font-extrabold text-gray-900">Khách hàng chưa Transform</h2>
          <span className="ml-auto text-xs font-semibold text-gray-400">{filtered.length} KH</span>
        </div>
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

      {clients.length === 0 ? (
        <div className="py-14 flex flex-col items-center gap-2">
          <UserX className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">Tất cả khách hàng đã Transform 🎉</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 flex flex-col items-center gap-2">
          <Search className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">Không tìm thấy khách hàng</p>
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
                  <th className={cn(th, "text-center")}>Cân nặng HT</th>
                  <th className={cn(th, "text-center")}>Đã giảm</th>
                  <th className={cn(th, "text-center")}>Đủ điều kiện</th>
                  <th className={cn(th, "text-center")}>Lộ trình</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                    <td className={td}>
                      <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-2.5 group">
                        <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-extrabold text-[#f15b5c]">
                            {c.fullName[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-800 group-hover:text-[#f15b5c] transition-colors">
                          {c.fullName}
                        </span>
                      </Link>
                    </td>
                    <td className={cn(td, "text-gray-600")}>{c.branchName}</td>
                    <td className={cn(td, "text-gray-600")}>{c.ptName}</td>
                    <td className={cn(td, "text-center font-bold text-[#f15b5c]")}>{c.currentWeight} kg</td>
                    <td className={cn(td, "text-center font-extrabold text-emerald-500")}>
                      {c.lostKg > 0 ? `−${c.lostKg.toFixed(1)} kg` : "—"}
                    </td>
                    <td className={cn(td, "text-center")}>
                      {c.eligible === null ? (
                        <span className="text-xs font-semibold text-gray-300">Không rõ</span>
                      ) : c.eligible ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                          Đủ ĐK
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                          Chưa đủ
                        </span>
                      )}
                    </td>
                    <td className={cn(td, "text-center")}>
                      {c.hasOngoingProgram ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600">
                          Còn lộ trình
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-500">
                          Hết lộ trình
                        </span>
                      )}
                    </td>
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
