"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Loader2, MessageSquareQuote, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format-date";
import { MonthBranchPicker, currentMonthBranch, type MonthBranchValue } from "./month-branch-picker";

type Stat = { count: number; avg: number | null; satisfiedPct: number | null; dist: number[] };
type Data = {
  summary: Stat;
  byPt: (Stat & { ptId: string; ptName: string; branchName: string; lastComment: string | null })[];
  ratings: {
    id: string; ptId: string; ptName: string; clientId: string; clientName: string; branchName: string;
    score: number; comment: string | null; createdAt: string; sessionDate: string; sessionName: string;
  }[];
};

function Stars({ score, size = "w-3 h-3" }: { score: number; size?: string }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= score ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
      ))}
    </span>
  );
}

/** Thanh phân bố 5→1 sao. Cùng một sắc vàng, đậm dần theo số sao. */
function DistBar({ dist }: { dist: number[] }) {
  const total = dist.reduce((a, b) => a + b, 0);
  if (!total) return <span className="text-[10px] text-gray-300">—</span>;
  const shades = ["#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706"];
  return (
    <div className="flex h-2 w-24 rounded-full overflow-hidden bg-gray-100" title={dist.map((n, i) => `${i + 1}★: ${n}`).join(" · ")}>
      {[4, 3, 2, 1, 0].map((i) =>
        dist[i] ? <div key={i} style={{ width: `${(dist[i] / total) * 100}%`, backgroundColor: shades[i] }} /> : null
      )}
    </div>
  );
}

/**
 * Khách chấm điểm buổi tập — Tổng quan Admin (toàn hệ thống) và FM (cơ sở
 * mình quản lý). Điểm theo PT đứng lớp + nhận xét của khách.
 */
export function SessionRatingsStats({ branches }: { branches: { id: string; name: string }[] }) {
  const [period, setPeriod] = useState<MonthBranchValue>(currentMonthBranch);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPt, setOpenPt] = useState<string | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ month: String(period.month), year: String(period.year), ...(period.branchId ? { branchId: period.branchId } : {}) });
    fetch(`/api/dashboard/session-ratings?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const s = data?.summary;
  const feed = (data?.ratings ?? []).filter((r) => (onlyLow ? r.score <= 3 : r.comment || r.score <= 3));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Khách chấm điểm PT</h2>
            <p className="text-xs text-gray-400 font-medium">Khách tự chấm trên app sau mỗi buổi tập · ≥ 4 sao là hài lòng</p>
          </div>
        </div>
        <MonthBranchPicker value={period} onChange={setPeriod} branches={branches} />
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : !s || s.count === 0 ? (
        <div className="py-12 flex flex-col items-center gap-2">
          <Star className="w-8 h-8 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">Chưa có đánh giá nào trong tháng</p>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-2xl font-extrabold text-amber-600">{s.avg?.toFixed(2)}<span className="text-sm text-amber-400"> /5</span></p>
              <p className="text-xs font-semibold text-gray-500">Điểm trung bình</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className={cn("text-2xl font-extrabold", (s.satisfiedPct ?? 0) >= 90 ? "text-emerald-600" : "text-gray-800")}>{s.satisfiedPct}%</p>
              <p className="text-xs font-semibold text-gray-500">Hài lòng (≥ 4★)</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-2xl font-extrabold text-gray-800">{s.count}</p>
              <p className="text-xs font-semibold text-gray-500">Lượt chấm</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">PT</th>
                  <th className="py-2 pr-3">Điểm TB</th>
                  <th className="py-2 pr-3">Hài lòng</th>
                  <th className="py-2 pr-3">Phân bố</th>
                  <th className="py-2 pr-3 text-right">Lượt</th>
                  <th className="py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {data!.byPt.map((p) => {
                  const open = openPt === p.ptId;
                  const mine = data!.ratings.filter((r) => r.ptId === p.ptId);
                  return (
                    <PtRow key={p.ptId} p={p} open={open} onToggle={() => setOpenPt(open ? null : p.ptId)} ratings={mine} />
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-gray-800">
                <MessageSquareQuote className="w-4 h-4 text-gray-400" /> Nhận xét của khách
              </p>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
                Chỉ ≤ 3 sao
              </label>
            </div>
            {feed.length === 0 ? (
              <p className="text-xs text-gray-300 font-semibold py-3 text-center">Chưa có nhận xét</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {feed.slice(0, 60).map((r) => (
                  <div key={r.id} className={cn("rounded-xl border px-3.5 py-2.5", r.score <= 3 ? "border-red-100 bg-red-50/40" : "border-gray-100")}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <Stars score={r.score} />
                      <Link href={`/dashboard/clients/${r.clientId}`} className="font-bold text-gray-800 hover:text-[#f15b5c]">{r.clientName}</Link>
                      <span className="text-gray-400">→ PT {r.ptName} · {r.branchName} · {fmtDate(r.sessionDate)}</span>
                    </div>
                    {r.comment && <p className="text-xs text-gray-600 mt-1 leading-relaxed">“{r.comment}”</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PtRow({
  p, open, onToggle, ratings,
}: {
  p: Data["byPt"][number]; open: boolean; onToggle: () => void; ratings: Data["ratings"];
}) {
  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer" onClick={onToggle}>
        <td className="py-2.5 pr-3">
          <p className="font-bold text-gray-800">{p.ptName}</p>
          <p className="text-[11px] text-gray-400">{p.branchName}</p>
        </td>
        <td className="py-2.5 pr-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="font-extrabold text-gray-800">{p.avg?.toFixed(2)}</span>
            <Stars score={Math.round(p.avg ?? 0)} />
          </span>
        </td>
        <td className={cn("py-2.5 pr-3 font-bold", (p.satisfiedPct ?? 0) >= 90 ? "text-emerald-600" : "text-amber-600")}>{p.satisfiedPct}%</td>
        <td className="py-2.5 pr-3"><DistBar dist={p.dist} /></td>
        <td className="py-2.5 pr-3 text-right font-semibold text-gray-600">{p.count}</td>
        <td className="py-2.5 text-gray-300">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-gray-50/60 px-3 py-2">
            <div className="space-y-1.5">
              {ratings.map((r) => (
                <div key={r.id} className="text-xs flex flex-wrap items-start gap-x-2">
                  <Stars score={r.score} />
                  <span className="font-semibold text-gray-700">{r.clientName}</span>
                  <span className="text-gray-400">{fmtDate(r.sessionDate)} · {r.sessionName.split("—")[0].trim()}</span>
                  {r.comment && <span className="w-full text-gray-600 pl-1">“{r.comment}”</span>}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
