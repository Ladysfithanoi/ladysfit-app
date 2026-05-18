"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Ruler, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { cn } from "@/lib/utils";

export type MeasurementLog = {
  id:            string;
  measuredDate:  string;
  waist:         number | null;
  belly:         number | null;
  armSize:       number | null;
  armFromElbow:  number | null;
  thighSize:     number | null;
  thighFromKnee: number | null;
  calfSize:      number | null;
  calfFromKnee:  number | null;
  notes:         string | null;
  measuredBy:    { id: string; name: string | null } | null;
};

const FORM_FIELDS: { key: keyof MeasurementLog; label: string; placeholder: string }[] = [
  { key: "waist",         label: "Eo (cm)",                   placeholder: "70" },
  { key: "belly",         label: "Bụng (cm)",                 placeholder: "80" },
  { key: "armSize",       label: "Cánh tay (cm)",             placeholder: "30" },
  { key: "armFromElbow",  label: "Cánh tay từ khuỷu (cm)",   placeholder: "25" },
  { key: "thighSize",     label: "Đùi (cm)",                  placeholder: "55" },
  { key: "thighFromKnee", label: "Đùi từ đầu gối (cm)",      placeholder: "40" },
  { key: "calfSize",      label: "Bắp chân (cm)",             placeholder: "35" },
  { key: "calfFromKnee",  label: "Bắp chân từ đầu gối (cm)", placeholder: "30" },
];

const CHART_METRICS: { key: keyof MeasurementLog; label: string; color: string }[] = [
  { key: "waist",     label: "Eo",       color: "#f15b5c" },
  { key: "belly",     label: "Bụng",     color: "#f97316" },
  { key: "armSize",   label: "Cánh tay", color: "#8b5cf6" },
  { key: "thighSize", label: "Đùi",      color: "#06b6d4" },
  { key: "calfSize",  label: "Bắp chân", color: "#10b981" },
];

const SUMMARY_FIELDS: { key: keyof MeasurementLog; label: string }[] = [
  { key: "waist",     label: "Vòng eo"   },
  { key: "belly",     label: "Vòng bụng" },
  { key: "armSize",   label: "Cánh tay"  },
  { key: "thighSize", label: "Đùi"       },
  { key: "calfSize",  label: "Bắp chân"  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatShort(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const inputCls = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

// ── Summary cards ─────────────────────────────────────────────────────────

function SummaryCards({ logs }: { logs: MeasurementLog[] }) {
  if (logs.length === 0) return null;

  const sorted = [...logs].sort(
    (a, b) => new Date(a.measuredDate).getTime() - new Date(b.measuredDate).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const first  = sorted[0];

  const filled = SUMMARY_FIELDS.filter((f) => latest[f.key] != null);
  if (filled.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
        Số đo gần nhất · {formatDate(latest.measuredDate)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {filled.map((f) => {
          const cur  = latest[f.key] as number;
          const init = first[f.key] as number | null;
          const diff = init != null ? cur - init : null;
          return (
            <div key={f.key as string} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <p className="text-base font-extrabold text-gray-900">{cur} cm</p>
              <p className="text-[10px] font-bold text-gray-400 mt-0.5">{f.label}</p>
              {diff !== null && diff !== 0 && (
                <div className={cn(
                  "flex items-center gap-0.5 mt-1 text-[10px] font-bold",
                  diff < 0 ? "text-emerald-500" : "text-red-400"
                )}>
                  {diff < 0
                    ? <TrendingDown className="w-3 h-3" />
                    : <TrendingUp className="w-3 h-3" />}
                  {diff > 0 ? "+" : ""}{diff.toFixed(1)} cm
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────

function MeasurementsChart({ logs }: { logs: MeasurementLog[] }) {
  const [active, setActive] = useState<Set<string>>(
    new Set(CHART_METRICS.map((m) => m.key as string))
  );

  const sorted = [...logs].sort(
    (a, b) => new Date(a.measuredDate).getTime() - new Date(b.measuredDate).getTime()
  );

  const chartData = sorted.map((l) => {
    const row: Record<string, unknown> = { date: formatShort(l.measuredDate) };
    for (const m of CHART_METRICS) row[m.key as string] = l[m.key] ?? undefined;
    return row;
  });

  function toggle(key: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-5">
      <p className="text-xs font-bold text-gray-500 mb-3">Biểu đồ số đo</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CHART_METRICS.map((m) => (
          <button
            key={m.key as string}
            onClick={() => toggle(m.key as string)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all",
              active.has(m.key as string) ? "text-white border-transparent" : "bg-white text-gray-400 border-gray-200"
            )}
            style={active.has(m.key as string) ? { backgroundColor: m.color, borderColor: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #f3f4f6" }}
            formatter={(val: unknown, name: unknown) => {
              const m = CHART_METRICS.find((x) => (x.key as string) === name);
              return [`${val} cm`, m?.label ?? String(name)];
            }}
          />
          {CHART_METRICS.filter((m) => active.has(m.key as string)).map((m) => (
            <Line
              key={m.key as string}
              type="monotone"
              dataKey={m.key as string}
              stroke={m.color}
              strokeWidth={2}
              dot={{ r: 3, fill: m.color }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── History table ─────────────────────────────────────────────────────────

function HistoryTable({ logs }: { logs: MeasurementLog[] }) {
  const sorted = [...logs].sort(
    (a, b) => new Date(b.measuredDate).getTime() - new Date(a.measuredDate).getTime()
  );

  const TABLE_COLS: { key: keyof MeasurementLog; label: string }[] = [
    { key: "waist",     label: "Eo"       },
    { key: "belly",     label: "Bụng"     },
    { key: "armSize",   label: "Cánh tay" },
    { key: "thighSize", label: "Đùi"      },
    { key: "calfSize",  label: "Bắp chân" },
  ];

  function getDiff(colKey: keyof MeasurementLog, idx: number) {
    const cur  = sorted[idx][colKey] as number | null;
    const prev = sorted[idx + 1]?.[colKey] as number | null;
    if (cur == null || prev == null) return null;
    return cur - prev;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <p className="text-xs font-bold text-gray-500 px-4 pt-4 pb-2">Lịch sử đo</p>
      <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">Ngày</th>
              {TABLE_COLS.map((c) => (
                <th key={c.key as string} className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">Đo bởi</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((log, idx) => (
              <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  {formatDate(log.measuredDate)}
                </td>
                {TABLE_COLS.map((col) => {
                  const val  = log[col.key] as number | null;
                  const diff = getDiff(col.key, idx);
                  return (
                    <td key={col.key as string} className="px-3 py-3">
                      {val != null ? (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-gray-700">{val}</span>
                          {diff !== null && diff !== 0 && (
                            <span className={cn(
                              "text-[10px] font-bold flex items-center",
                              diff < 0 ? "text-emerald-500" : "text-red-400"
                            )}>
                              {diff < 0 ? "↓" : "↑"}{Math.abs(diff).toFixed(1)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-3">
                  {log.measuredBy ? (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      {log.measuredBy.name ?? "PT"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      Tự đo
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function MeasurementsTab({ initialLogs }: { initialLogs: MeasurementLog[] }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [vals,      setVals]      = useState<Record<string, string>>({});
  const [notes,     setNotes]     = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  function set(key: string, v: string) {
    setVals((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { measuredDate: date, notes: notes || null };
      for (const f of FORM_FIELDS) {
        const v = vals[f.key as string];
        payload[f.key as string] = v ? parseFloat(v) : null;
      }
      const res = await fetch("/api/my/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setSheetOpen(false);
      setVals({});
      setNotes("");
      setDate(today);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-purple-400" />
          <h1 className="text-base font-extrabold text-gray-900">Số đo cơ thể</h1>
        </div>
        <button
          onClick={() => { setError(""); setSheetOpen(true); }}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-white text-sm font-bold shadow-sm"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-4 h-4" />
          Cập nhật
        </button>
      </div>

      {initialLogs.length === 0 ? (
        <div className="py-20 text-center">
          <Ruler className="w-10 h-10 text-gray-100 mx-auto mb-3" />
          <p className="text-sm text-gray-300 font-semibold">Chưa có số đo nào</p>
          <p className="text-xs text-gray-200 mt-1">PT của bạn hoặc chính bạn có thể thêm số đo</p>
          <button
            onClick={() => setSheetOpen(true)}
            className="mt-4 text-sm font-bold text-[#f15b5c]"
          >
            + Cập nhật số đo đầu tiên
          </button>
        </div>
      ) : (
        <>
          <SummaryCards logs={initialLogs} />
          {initialLogs.length >= 2 && <MeasurementsChart logs={initialLogs} />}
          <HistoryTable logs={initialLogs} />
        </>
      )}

      {/* Add sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Cập nhật số đo của tôi">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Ngày đo</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FORM_FIELDS.map((f) => (
              <div key={f.key as string}>
                <label className="block text-xs font-bold text-gray-700 mb-1">{f.label}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={vals[f.key as string] ?? ""}
                  onChange={(e) => set(f.key as string, e.target.value)}
                  className={inputCls}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none"
              rows={2}
              placeholder="Ghi chú thêm..."
            />
          </div>

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl text-white font-bold disabled:opacity-50"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {loading ? "Đang lưu..." : "Lưu số đo"}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}
