"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Loader2, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format-date";
import { MonthBranchPicker, currentMonthBranch, type MonthBranchValue } from "./month-branch-picker";

type Agg = {
  clients: number;
  done: number[];
  rated: number;
  satisfied: number;
  oldFaults: number;
  recurredFaults: number;
  registered: number;
};
type ClientRow = {
  clientId: string; clientName: string; ptId: string; ptName: string; branchName: string;
  startDate: string; refunded: boolean;
  days: { day: number; done: boolean; date: string | null; score: number | null; comment: string | null }[];
  recurrence: { old: number; recurred: number } | null;
  registeredPackage: string | null;
};
type Data = { total: Agg; byPt: (Agg & { ptId: string; ptName: string })[]; clients: ClientRow[] };

/** Một chỉ số so với chỉ tiêu. `lowerIsBetter` cho "lỗi cũ còn lặp lại". */
type Kpi = { label: string; num: number; den: number; target: number; lowerIsBetter?: boolean };

function kpisOf(a: Agg): Kpi[] {
  return [
    { label: "Hoàn thành Buổi 1", num: a.done[0], den: a.clients, target: 100 },
    { label: "Tập tiếp Buổi 2", num: a.done[1], den: a.done[0], target: 80 },
    { label: "Tập tiếp Buổi 3", num: a.done[2], den: a.done[1], target: 80 },
    { label: "Tập tiếp Buổi 4", num: a.done[3], den: a.done[2], target: 80 },
    { label: "Hài lòng (≥ 4★)", num: a.satisfied, den: a.rated, target: 90 },
    { label: "Lỗi cũ còn lặp lại", num: a.recurredFaults, den: a.oldFaults, target: 20, lowerIsBetter: true },
    { label: "Đăng ký lộ trình", num: a.registered, den: a.done[0], target: 50 },
  ];
}

const pct = (k: Kpi) => (k.den > 0 ? Math.round((k.num / k.den) * 100) : null);
const met = (k: Kpi) => {
  const p = pct(k);
  if (p == null) return null;
  return k.lowerIsBetter ? p <= k.target : p >= k.target;
};

function KpiCell({ k }: { k: Kpi }) {
  const p = pct(k);
  const ok = met(k);
  return (
    <span className={cn("font-bold", ok == null ? "text-gray-300" : ok ? "text-emerald-600" : "text-amber-600")}>
      {p == null ? "—" : `${p}%`}
      {k.den > 0 && <span className="block text-[10px] font-medium text-gray-400">{k.num}/{k.den}</span>}
    </span>
  );
}

/**
 * Lộ trình L0 — phiếu đánh giá FM tự điền từ dữ liệu: hoàn thành từng buổi,
 * hài lòng (khách tự chấm), lỗi cũ lặp lại (PT tick), đăng ký lộ trình (Hậu L0).
 * Nhóm khách theo tháng BẮT ĐẦU gói L0. Xem /api/dashboard/l0.
 */
export function L0Stats({ branches }: { branches: { id: string; name: string }[] }) {
  const [period, setPeriod] = useState<MonthBranchValue>(currentMonthBranch);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClients, setShowClients] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ month: String(period.month), year: String(period.year), ...(period.branchId ? { branchId: period.branchId } : {}) });
    fetch(`/api/dashboard/l0?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const totalKpis = data ? kpisOf(data.total) : [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Lộ trình Khởi động L0</h2>
            <p className="text-xs text-gray-400 font-medium">Khách bắt đầu L0 trong tháng · tự tính từ nhật ký, điểm khách chấm và lỗi PT tick</p>
          </div>
        </div>
        <MonthBranchPicker value={period} onChange={setPeriod} branches={branches} />
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : !data || data.total.clients === 0 ? (
        <div className="py-12 flex flex-col items-center gap-2">
          <Sparkles className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">Chưa có khách bắt đầu L0 trong tháng</p>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {totalKpis.map((k) => {
              const p = pct(k);
              const ok = met(k);
              return (
                <div key={k.label} className={cn("rounded-xl px-3 py-2.5 border", ok == null ? "border-gray-100 bg-gray-50" : ok ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/50")}>
                  <p className={cn("text-xl font-extrabold", ok == null ? "text-gray-300" : ok ? "text-emerald-600" : "text-amber-600")}>
                    {p == null ? "—" : `${p}%`}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-600 leading-tight">{k.label}</p>
                  <p className="text-[10px] text-gray-400">{k.den > 0 ? `${k.num}/${k.den} · ` : ""}chỉ tiêu {k.lowerIsBetter ? "≤" : "≥"} {k.target}%</p>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">PT</th>
                  <th className="py-2 pr-3">Khách</th>
                  {kpisOf(data.total).map((k) => <th key={k.label} className="py-2 pr-3">{k.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.byPt.map((p) => (
                  <tr key={p.ptId} className="border-b border-gray-50 align-top">
                    <td className="py-2.5 pr-3 font-bold text-gray-800">{p.ptName}</td>
                    <td className="py-2.5 pr-3 font-semibold text-gray-600">{p.clients}</td>
                    {kpisOf(p).map((k) => <td key={k.label} className="py-2.5 pr-3"><KpiCell k={k} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowClients((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800"
            >
              {showClients ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Phiếu theo từng khách ({data.clients.length})
            </button>
            {showClients && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs min-w-[820px]">
                  <thead>
                    <tr className="text-left font-bold text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3">Khách</th>
                      <th className="py-2 pr-3">PT</th>
                      {[1, 2, 3, 4].map((d) => <th key={d} className="py-2 pr-3">Buổi {d}</th>)}
                      <th className="py-2 pr-3">Lỗi cũ lặp lại</th>
                      <th className="py-2 pr-3">Đăng ký lộ trình</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map((c) => (
                      <tr key={c.clientId} className="border-b border-gray-50 align-top">
                        <td className="py-2 pr-3">
                          <Link href={`/dashboard/clients/${c.clientId}`} className="font-bold text-gray-800 hover:text-[#f15b5c]">{c.clientName}</Link>
                          <p className="text-[10px] text-gray-400">
                            {c.branchName} · bắt đầu {fmtDate(c.startDate)}
                            {c.refunded && <span className="ml-1 font-bold text-red-500">· đã hoàn tiền</span>}
                          </p>
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{c.ptName}</td>
                        {c.days.map((d) => (
                          <td key={d.day} className="py-2 pr-3" title={d.comment ?? undefined}>
                            {d.done ? (
                              <span className="inline-flex flex-col">
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                                  <Check className="w-3 h-3" />{d.date ? fmtDate(d.date).slice(0, 5) : ""}
                                </span>
                                {d.score != null && (
                                  <span className={cn("inline-flex items-center gap-0.5 font-bold", d.score >= 4 ? "text-amber-500" : "text-red-500")}>
                                    <Star className="w-3 h-3 fill-current" />{d.score}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                        <td className="py-2 pr-3 text-gray-600">
                          {c.recurrence ? `${c.recurrence.recurred}/${c.recurrence.old}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {c.registeredPackage
                            ? <span className="font-bold text-emerald-600">{c.registeredPackage}</span>
                            : <span className="text-gray-300">Chưa</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
