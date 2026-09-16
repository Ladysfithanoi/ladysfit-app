"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Footprints, Timer, Dumbbell, Plus } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";

export type PortalActivityLog = {
  id: string;
  date: string;
  steps: number | null;
  minutesActive: number | null;
  minutesGym: number | null;
  note: string | null;
};

const STEP_GOAL = 8000;
const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const inputCls =
  "w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50";

// Use local date parts to avoid UTC-shift bugs in non-UTC timezones
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Số bước chân mỗi ngày — sống ở trang Tổng quan (/my), không còn ở trang Tập luyện.
 */
export function OutsideGymActivity({ activityLogs }: { activityLogs: PortalActivityLog[] }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const now = new Date();
  const todayStr = localDateStr(now);
  const today = activityLogs.find((l) => l.date.startsWith(todayStr));

  // Steps per day for this week (Mon–Sun)
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = localDateStr(d); // local date, not UTC
    const log = activityLogs.find((l) => l.date.startsWith(ds));
    return { day: DAY_LABELS[i], steps: log?.steps ?? 0 };
  });

  const stepPct = today?.steps
    ? Math.min(100, Math.round((today.steps / STEP_GOAL) * 100))
    : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/my/activity-logs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayStr,
          steps: fd.get("steps") ? Number(fd.get("steps")) : null,
          minutesActive: fd.get("minutesActive") ? Number(fd.get("minutesActive")) : null,
          note: fd.get("note") || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setSheetOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-extrabold text-gray-700">Vận động ngoài phòng tập</p>
          <button
            onClick={() => { setError(""); setSheetOpen(true); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-2xl text-white text-xs font-bold"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Plus className="w-3 h-3" />
            Cập nhật hôm nay
          </button>
        </div>

        {/* Today summary — 3 cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-blue-50 rounded-2xl p-3 text-center">
            <Footprints className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-black text-blue-600">{today?.steps ?? "—"}</p>
            <p className="text-[10px] font-bold text-blue-400 mt-0.5">Bước chân</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-3 text-center">
            <Timer className="w-4 h-4 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-black text-green-600">{today?.minutesActive ?? "—"}</p>
            <p className="text-[10px] font-bold text-green-400 mt-0.5">Phút vận động</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-3 text-center">
            <Dumbbell className="w-4 h-4 text-orange-500 mx-auto mb-1" />
            <p className="text-xl font-black text-orange-500">{today?.minutesGym ?? "—"}</p>
            <p className="text-[10px] font-bold text-orange-400 mt-0.5">Phút tập gym</p>
          </div>
        </div>

        {/* Step goal progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold text-gray-500">
            <span>
              {today?.steps ?? 0} / {STEP_GOAL.toLocaleString()} bước
            </span>
            <span style={{ color: "#f15b5c" }}>{stepPct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stepPct}%`, backgroundColor: "#f15b5c" }}
            />
          </div>
          <p className="text-[10px] text-gray-400 font-semibold">
            Mục tiêu: {STEP_GOAL.toLocaleString()} bước/ngày
          </p>
        </div>
      </div>

      {/* Steps bar chart — this week */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-4">
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-3">
          Số bước chân — tuần này
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 700 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : `${v}`}
            />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs font-bold">
                    <p className="text-gray-400">{label}</p>
                    <p style={{ color: "#f15b5c" }}>{(payload[0].value as number).toLocaleString()} bước</p>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="steps" fill="#f15b5c" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Cập nhật vận động hôm nay"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Số bước chân</label>
            <input
              name="steps"
              type="number"
              min="0"
              placeholder="8000"
              defaultValue={today?.steps ?? ""}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">
              Số phút vận động ngoài phòng
            </label>
            <input
              name="minutesActive"
              type="number"
              min="0"
              placeholder="30"
              defaultValue={today?.minutesActive ?? ""}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Ghi chú</label>
            <textarea
              name="note"
              rows={2}
              defaultValue={today?.note ?? ""}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50 resize-none"
            />
          </div>
          {error && (
            <p className="text-sm font-semibold" style={{ color: "#f15b5c" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl text-white font-bold text-sm disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}
