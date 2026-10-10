"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cùng hình dạng với SalaryPeriodSummary (lib/salary-period). */
type Summary = {
  months: number[];
  rows: {
    userId: string; name: string; role: string; position: string;
    branchId: string; branchName: string;
    byMonth: Record<number, number>; total: number;
  }[];
  monthTotals: Record<number, number>;
  grandTotal: number;
};

function vnd(n: number) { return n.toLocaleString("vi-VN") + "đ"; }

const TH = "px-3 py-2.5 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap border-r border-gray-200 last:border-r-0";

/**
 * Lương theo quý / năm — chỉ phần ĐÃ THANH TOÁN, mỗi người một dòng, mỗi tháng
 * một cột. Không có chi tiết từng khoản (đó là việc của bảng lương tháng).
 */
export function SalaryPeriodSummary({ kind, year, quarter, branchId }: {
  kind: "quarter" | "year";
  year: number;
  quarter: number;
  /** Rỗng = tất cả cơ sở (COO). */
  branchId: string;
}) {
  const [data, setData]         = useState<Summary | null>(null);
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError]       = useState("");

  const query = `kind=${kind}&year=${year}&quarter=${quarter}${branchId ? `&branchId=${branchId}` : ""}`;
  const periodLabel = kind === "year" ? `năm ${year}` : `quý ${quarter}/${year}`;
  const showBranch = !branchId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/salary/period?${query}`)
      .then(async res => {
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}`);
        return res.json() as Promise<Summary>;
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch((e: Error) => { if (!cancelled) { setData(null); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/salary/period?${query}&format=xlsx`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setError("Lỗi xuất Excel: " + (err.error ?? `HTTP ${res.status}`));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const match = (res.headers.get("Content-Disposition") ?? "").match(/filename\*=UTF-8''(.+)/);
      a.href = url;
      a.download = match ? decodeURIComponent(match[1]) : `luong-${kind}-${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const months = data?.months ?? [];
  const peopleCount = new Set(data?.rows.map(r => r.userId) ?? []).size;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: `Đã thanh toán ${periodLabel}`, value: vnd(data?.grandTotal ?? 0), color: "text-green-600" },
          { label: "Số nhân sự đã nhận lương",    value: `${peopleCount} người`,       color: "text-gray-700" },
          { label: "TB mỗi tháng",
            value: vnd(Math.round((data?.grandTotal ?? 0) / Math.max(1, months.filter(m => (data?.monthTotals[m] ?? 0) > 0).length))),
            color: "text-[#f15b5c]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
            <p className={cn("text-lg font-extrabold", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <p className="text-sm font-extrabold text-gray-700">Lương đã thanh toán — {periodLabel}</p>
          <button onClick={handleExport} disabled={exporting || !data || data.rows.length === 0}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 whitespace-nowrap">
            <Download className="w-4 h-4 shrink-0" />
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
        </div>

        {error && <p className="px-5 py-3 text-sm text-red-500">{error}</p>}

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Đang tải...</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 italic">
            Chưa có lương nào được thanh toán trong {periodLabel}.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] border-b border-gray-200">
                  {["Nhân viên", ...(showBranch ? ["Cơ sở"] : []), ...months.map(m => `T${m}`), "Tổng"].map(h => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={`${r.userId}:${r.branchId}`} className="border-b border-gray-100 hover:bg-gray-50/50 divide-x divide-gray-100">
                    <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap min-w-[160px]">
                      {r.name}
                      <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">{r.position}</span>
                    </td>
                    {showBranch && <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.branchName}</td>}
                    {months.map(m => (
                      <td key={m} className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                        {r.byMonth[m] ? vnd(r.byMonth[m]) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 font-bold text-green-600 whitespace-nowrap">{vnd(r.total)}</td>
                  </tr>
                ))}
                <tr className="bg-[#f5f5f5] font-bold divide-x divide-gray-100">
                  <td className="px-3 py-2.5 text-gray-700">TỔNG</td>
                  {showBranch && <td />}
                  {months.map(m => (
                    <td key={m} className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{vnd(data.monthTotals[m] ?? 0)}</td>
                  ))}
                  <td className="px-3 py-2.5 text-green-700 whitespace-nowrap">{vnd(data.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="px-5 py-2 text-[10px] text-gray-400 italic border-t border-gray-50">
          * Chỉ gồm tháng lương đã chuyển &ldquo;Đã thanh toán&rdquo;. Muốn xem chi tiết từng khoản, chọn xem theo Tháng.
        </p>
      </div>
    </div>
  );
}
