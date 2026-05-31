"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

type Transform = {
  id: string;
  fullName: string;
  branchName: string;
  ptName: string;
  lostKg: number;
  updatedAt: string;
};

const PAGE_SIZE = 5;

function timeAgo(isoDate: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  return `${Math.floor(diffDays / 30)} tháng trước`;
}

export function RecentTransformsTable({ transforms }: { transforms: Transform[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.ceil(transforms.length / PAGE_SIZE);
  const safePage = Math.min(page, pageCount || 1);
  const pageItems = transforms.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50">
              {["Tên KH", "Cơ sở", "Nhân sự phụ trách", "Đã giảm", "Thời gian"].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    "px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                    i >= 3 ? "text-center" : "text-left"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((t) => (
              <tr
                key={t.id}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/clients/${t.id}`}
                    className="flex items-center gap-2 group"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-extrabold text-[#f15b5c]">
                        {t.fullName[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-[#f15b5c] transition-colors whitespace-nowrap">
                      {t.fullName}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">
                  {t.branchName}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">
                  {t.ptName}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-extrabold text-emerald-500 whitespace-nowrap">
                    −{t.lostKg.toFixed(1)} kg
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                    {timeAgo(t.updatedAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={safePage}
        pageCount={pageCount}
        total={transforms.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="khách"
      />
    </>
  );
}
