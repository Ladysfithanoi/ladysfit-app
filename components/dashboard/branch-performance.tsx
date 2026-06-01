"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

type BranchStat = {
  id: string;
  name: string;
  ptCount: number;
  totalKH: number;
  activeKH: number;
  transformedKH: number;
  transformRate: number;
};

const PAGE_SIZE = 4;

function rateStyle(rate: number) {
  if (rate < 30) return { text: "text-red-500", bg: "bg-red-50" };
  if (rate <= 60) return { text: "text-orange-500", bg: "bg-orange-50" };
  return { text: "text-green-600", bg: "bg-green-50" };
}

export function BranchPerformance({ branchStats }: { branchStats: BranchStat[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(branchStats.length / PAGE_SIZE);
  const safePage = Math.min(page, pageCount || 1);
  const pageItems = branchStats.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Building2 className="w-4 h-4 text-[#f15b5c]" />
        <h2 className="text-base font-extrabold text-gray-900">Hiệu quả theo cơ sở</h2>
      </div>
      {branchStats.length === 0 ? (
        <div className="py-14 flex items-center justify-center">
          <p className="text-sm text-gray-300 font-semibold">Chưa có dữ liệu</p>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  {["Cơ sở", "Số PT", "Tổng KH", "Đang tập", "Đã Transform", "Tỉ lệ Transform"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                          i === 0 ? "text-left" : "text-center"
                        )}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((b) => {
                  const rs = rateStyle(b.transformRate);
                  return (
                    <tr
                      key={b.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">{b.name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center text-sm font-bold text-gray-700">
                        {b.ptCount}
                      </td>
                      <td className="px-5 py-3.5 text-center text-sm font-bold text-gray-700">
                        {b.totalKH}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 min-w-[2rem]">
                          {b.activeKH}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f15b5c]/10 text-[#f15b5c] min-w-[2rem]">
                          {b.transformedKH}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-extrabold min-w-[3.5rem]",
                            rs.bg,
                            rs.text
                          )}
                        >
                          {b.totalKH > 0 ? `${b.transformRate.toFixed(0)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            pageCount={pageCount}
            total={branchStats.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="cơ sở"
          />
        </>
      )}
    </div>
  );
}
