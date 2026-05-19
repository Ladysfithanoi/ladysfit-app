"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingDown, TrendingUp, Plus } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { DateMaskInput } from "@/components/ui/date-mask-input";
import { cn } from "@/lib/utils";

type WeightLog = { id: string; date: string; weight: number; note: string | null };

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function WeightTab({
  weightLogs,
  targetWeight,
}: {
  weightLogs: WeightLog[];
  targetWeight: number;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sorted = [...weightLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last30 = sorted.slice(-30);
  const chartData = last30.map((l) => ({
    date: formatDate(l.date),
    weight: l.weight,
  }));

  const now = new Date();
  const monday = getMonday(now);
  const lastMonday = new Date(monday);
  lastMonday.setDate(monday.getDate() - 7);
  const thisWeek = sorted.filter((l) => new Date(l.date) >= monday);
  const lastWeek = sorted.filter((l) => { const d = new Date(l.date); return d >= lastMonday && d < monday; });
  const avg = (arr: WeightLog[]) => arr.length ? arr.reduce((s, l) => s + l.weight, 0) / arr.length : null;
  const thisAvg = avg(thisWeek);
  const lastAvg = avg(lastWeek);
  const weekChange = thisAvg !== null && lastAvg !== null ? thisAvg - lastAvg : null;

  const sortedDesc = [...sorted].reverse();
  const minY = chartData.length ? Math.min(...chartData.map((d) => d.weight), targetWeight) - 1 : targetWeight - 5;
  const maxY = chartData.length ? Math.max(...chartData.map((d) => d.weight)) + 1 : targetWeight + 5;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/my/weight-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: fd.get("date"), weight: fd.get("weight"), note: fd.get("note") || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setSheetOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally { setLoading(false); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-gray-900">Cân nặng</h2>
        <button
          onClick={() => { setError(""); setSheetOpen(true); }}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-2xl text-white text-xs font-bold"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-3.5 h-3.5" /> Cập nhật
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm mb-4">
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-3">30 ngày gần nhất</p>
        {chartData.length < 2 ? (
          <div className="h-[200px] flex items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl">
            <p className="text-sm text-gray-300 font-bold">Cần ít nhất 2 lần cân</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 48, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }} interval="preserveStartEnd" />
              <YAxis domain={[minY, maxY]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} unit="kg" width={38} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs font-bold">
                      <p className="text-gray-400">{label}</p>
                      <p className="text-[#f15b5c]">{payload[0].value} kg</p>
                    </div>
                  ) : null
                }
              />
              <ReferenceLine y={targetWeight} stroke="#9ca3af" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: `Mục tiêu ${targetWeight}kg`, position: "right", fontSize: 9, fill: "#9ca3af", fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="weight" stroke="#f15b5c" strokeWidth={2.5}
                dot={{ r: 3, fill: "#f15b5c", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#f15b5c", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Weekly stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-bold mb-1">TB tuần này</p>
          <p className="text-2xl font-black text-gray-900">{thisAvg ? `${thisAvg.toFixed(1)}` : "—"}</p>
          {thisAvg && <p className="text-xs text-gray-400">kg</p>}
        </div>
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-bold mb-1">So tuần trước</p>
          {weekChange !== null ? (
            <div className="flex items-center gap-1">
              {weekChange < 0 ? <TrendingDown className="w-4 h-4 text-emerald-500" /> : <TrendingUp className="w-4 h-4 text-red-400" />}
              <p className={cn("text-2xl font-black", weekChange < 0 ? "text-emerald-500" : "text-red-400")}>
                {weekChange > 0 ? "+" : ""}{weekChange.toFixed(1)}
              </p>
            </div>
          ) : (
            <p className="text-2xl font-black text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* Log list */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-700">Lịch sử cân</p>
        </div>
        {sortedDesc.length === 0 ? (
          <div className="py-10 flex items-center justify-center">
            <p className="text-sm text-gray-300 font-bold">Chưa có dữ liệu</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {sortedDesc.map((log, i) => {
              const prev = sortedDesc[i + 1];
              const change = prev ? log.weight - prev.weight : null;
              return (
                <div key={log.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{new Date(log.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                    {log.note && <p className="text-xs text-gray-400 mt-0.5">{log.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-gray-900">{log.weight} kg</p>
                    {change !== null && (
                      <p className={cn("text-xs font-bold", change < 0 ? "text-emerald-500" : change > 0 ? "text-red-400" : "text-gray-400")}>
                        {change < 0 ? "▼" : change > 0 ? "▲" : ""} {Math.abs(change).toFixed(1)} kg
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Cập nhật cân nặng">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Ngày *</label>
            <DateMaskInput name="date" required defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Cân nặng (kg) *</label>
            <input name="weight" type="number" step="0.1" required placeholder="65.5"
              className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Ghi chú</label>
            <textarea name="note" rows={2} placeholder="Ghi chú thêm..."
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50 resize-none" />
          </div>
          {error && <p className="text-sm text-[#f15b5c] font-semibold">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full h-12 rounded-2xl text-white font-bold text-sm disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}>
            {loading ? "Đang lưu..." : "Lưu"}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}
