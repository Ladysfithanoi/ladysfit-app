"use client";

import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Ruler, Plus, Trash2, X } from "lucide-react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type MeasurementLog = {
  id: string;
  measuredDate: string;
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

const METRICS: { key: keyof MeasurementLog; label: string; color: string }[] = [
  { key: "waist",         label: "Eo",              color: "#f15b5c" },
  { key: "belly",         label: "Bụng",            color: "#f97316" },
  { key: "armSize",       label: "Bắp tay",         color: "#8b5cf6" },
  { key: "thighSize",     label: "Bắp đùi",         color: "#06b6d4" },
  { key: "calfSize",      label: "Bắp chân",        color: "#10b981" },
];

const ALL_FIELDS: { key: keyof MeasurementLog; label: string; placeholder: string }[] = [
  { key: "waist",         label: "Eo (cm)",                   placeholder: "70" },
  { key: "belly",         label: "Bụng (cm)",                 placeholder: "80" },
  { key: "armSize",       label: "Bắp tay (cm)",              placeholder: "30" },
  { key: "armFromElbow",  label: "Bắp tay từ khuỷu (cm)",    placeholder: "25" },
  { key: "thighSize",     label: "Bắp đùi (cm)",              placeholder: "55" },
  { key: "thighFromKnee", label: "Bắp đùi từ đầu gối (cm)", placeholder: "40" },
  { key: "calfSize",      label: "Bắp chân (cm)",             placeholder: "35" },
  { key: "calfFromKnee",  label: "Bắp chân từ đầu gối (cm)", placeholder: "30" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatShort(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const inputCls = "w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

// ── Add form modal ────────────────────────────────────────────────────────

function AddMeasurementModal({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose:  () => void;
  onSaved:  (log: MeasurementLog) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]     = useState(today);
  const [vals, setVals]     = useState<Record<string, string>>({});
  const [notes, setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  function set(key: string, v: string) {
    setVals((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { measuredDate: date, notes: notes || null };
      for (const f of ALL_FIELDS) {
        const v = vals[f.key as string];
        payload[f.key as string] = v ? parseFloat(v) : null;
      }
      const res = await fetch(`/api/clients/${clientId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      const saved: MeasurementLog = await res.json();
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-sm font-extrabold text-gray-900">Thêm số đo cơ thể</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Ngày đo *</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ALL_FIELDS.map((f) => (
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

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {loading ? "Đang lưu..." : "Thêm số đo"}
            </button>
            <button type="button" onClick={onClose}
              className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────

function MeasurementsChart({ logs }: { logs: MeasurementLog[] }) {
  const [active, setActive] = useState<Set<string>>(
    new Set(METRICS.map((m) => m.key as string))
  );

  const sorted = [...logs].sort(
    (a, b) => new Date(a.measuredDate).getTime() - new Date(b.measuredDate).getTime()
  );

  const chartData = sorted.map((l) => {
    const row: Record<string, unknown> = { date: formatShort(l.measuredDate) };
    for (const m of METRICS) {
      row[m.key as string] = l[m.key] ?? undefined;
    }
    return row;
  });

  if (chartData.length === 0) return null;

  function toggle(key: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  return (
    <div>
      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {METRICS.map((m) => (
          <button
            key={m.key as string}
            onClick={() => toggle(m.key as string)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all",
              active.has(m.key as string)
                ? "text-white border-transparent"
                : "bg-white text-gray-400 border-gray-200"
            )}
            style={active.has(m.key as string) ? { backgroundColor: m.color, borderColor: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #f3f4f6" }}
            formatter={(val: unknown, name: unknown) => {
              const m = METRICS.find((x) => (x.key as string) === name);
              return [`${val} cm`, m?.label ?? String(name)];
            }}
          />
          {METRICS.filter((m) => active.has(m.key as string)).map((m) => (
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

// ── Main component ────────────────────────────────────────────────────────

export function BodyMeasurementsSection({
  clientId,
  canDelete,
}: {
  clientId:  string;
  canDelete: boolean;
}) {
  const [logs,       setLogs]       = useState<MeasurementLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [delTarget,  setDelTarget]  = useState<MeasurementLog | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/measurements`)
      .then((r) => r.json())
      .then((d) => { setLogs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  function onSaved(log: MeasurementLog) {
    setLogs((prev) => {
      const idx = prev.findIndex((l) => l.id === log.id);
      if (idx === -1) return [log, ...prev];
      const next = [...prev]; next[idx] = log; return next;
    });
  }

  async function handleDelete() {
    if (!delTarget) return;
    await fetch(`/api/clients/${clientId}/measurements/${delTarget.id}`, { method: "DELETE" });
    setLogs((prev) => prev.filter((l) => l.id !== delTarget.id));
    setDelTarget(null);
  }

  const sortedDesc = [...logs].sort(
    (a, b) => new Date(b.measuredDate).getTime() - new Date(a.measuredDate).getTime()
  );

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-purple-50">
            <Ruler className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <h3 className="text-sm font-extrabold text-gray-700">Số đo cơ thể</h3>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-white text-xs font-bold shadow-sm"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm số đo
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-300 animate-pulse">Đang tải...</div>
      ) : logs.length === 0 ? (
        <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-100 rounded-xl">
          <p className="text-sm text-gray-300 font-semibold">Chưa có số đo nào</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          {logs.length >= 2 && (
            <div className="mb-5">
              <MeasurementsChart logs={logs} />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Ngày", "Eo", "Bụng", "Bắp tay", "Bắp đùi", "Bắp chân", "Người đo", ""].map((h) => (
                    <th key={h} className="pb-2 text-left font-bold text-gray-400 uppercase tracking-wide pr-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDesc.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                    <td className="py-2.5 font-semibold text-gray-600 pr-3 whitespace-nowrap">
                      {formatDate(log.measuredDate)}
                    </td>
                    <td className="py-2.5 text-gray-700 pr-3">{log.waist   != null ? `${log.waist} cm`   : "—"}</td>
                    <td className="py-2.5 text-gray-700 pr-3">{log.belly   != null ? `${log.belly} cm`   : "—"}</td>
                    <td className="py-2.5 text-gray-700 pr-3">{log.armSize != null ? `${log.armSize} cm` : "—"}</td>
                    <td className="py-2.5 text-gray-700 pr-3">{log.thighSize != null ? `${log.thighSize} cm` : "—"}</td>
                    <td className="py-2.5 text-gray-700 pr-3">{log.calfSize  != null ? `${log.calfSize} cm`  : "—"}</td>
                    <td className="py-2.5 pr-3">
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
                    <td className="py-2.5">
                      {canDelete && (
                        <button onClick={() => setDelTarget(log)}
                          className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modalOpen && (
        <AddMeasurementModal
          clientId={clientId}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
        />
      )}

      <AlertDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title="Xóa số đo"
        description={`Bạn có chắc muốn xóa số đo ngày ${delTarget ? formatDate(delTarget.measuredDate) : ""}?\nHành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
