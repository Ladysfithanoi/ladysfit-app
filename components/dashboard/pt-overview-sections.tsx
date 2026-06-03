"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Users, TrendingDown, TrendingUp, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PTStats } from "./pt-dashboard";

const PAGE_SIZE = 5;

function timeAgo(isoDate: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  return `${Math.floor(diffDays / 30)} tháng trước`;
}

function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
      <span className="text-xs font-semibold text-gray-400">
        Trang {page + 1}/{totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page === 0}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Trang trước"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages - 1}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Trang sau"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ClientProgressCard({ clients }: { clients: PTStats["clientProgress"] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.fullName.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset to the first page whenever the search term changes.
  useEffect(() => { setPage(0); }, [query]);
  // Keep the page in range if the filtered list shrinks.
  useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);

  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#f15b5c]" />
            <h2 className="text-base font-extrabold text-gray-900">Tiến độ khách hàng của tôi</h2>
          </div>
          <Link
            href="/dashboard/clients"
            className="text-xs font-semibold text-gray-400 hover:text-[#f15b5c] transition-colors"
          >
            Xem tất cả
          </Link>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên khách hàng..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          />
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="py-14 flex flex-col items-center gap-2">
          <Users className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">Chưa có khách hàng</p>
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
                {pageItems.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-2.5 group">
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
                      <span className="text-sm font-bold text-[#f15b5c]">{c.currentWeight} kg</span>
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
          <Pager
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </>
      )}
    </div>
  );
}

export function RecentWeightLogsCard({ logs }: { logs: PTStats["recentLogs"] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const pageItems = logs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <TrendingDown className="w-4 h-4 text-[#f15b5c]" />
        <h2 className="text-base font-extrabold text-gray-900">Cập nhật cân nặng gần đây</h2>
      </div>
      {logs.length === 0 ? (
        <div className="py-14 flex items-center justify-center">
          <p className="text-sm text-gray-300 font-semibold">Chưa có cập nhật</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {pageItems.map((log, i) => (
              <Link
                key={`${log.clientId}-${log.logDate}-${i}`}
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
                    <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">{log.clientName}</p>
                    <p className="text-xs text-gray-400">{timeAgo(log.logDate)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-extrabold text-gray-900">{log.weight} kg</p>
                  {log.change !== null && (
                    <div
                      className={cn(
                        "flex items-center justify-end gap-0.5 text-xs font-bold",
                        log.change < 0 ? "text-emerald-500" : log.change > 0 ? "text-red-400" : "text-gray-400"
                      )}
                    >
                      {log.change < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : log.change > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : null}
                      {log.change !== 0 ? `${log.change > 0 ? "+" : ""}${log.change.toFixed(1)} kg` : "Không đổi"}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <Pager
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </>
      )}
    </div>
  );
}
