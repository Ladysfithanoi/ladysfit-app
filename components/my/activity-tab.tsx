"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Footprints, Timer, Plus, ChevronDown, ChevronUp, Dumbbell } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";

type ActivityLog = {
  id: string;
  date: string;
  steps: number | null;
  minutesActive: number | null;
  minutesGym: number | null;
  note: string | null;
};

type PortalMovement = {
  id: string;
  movementName: string;
  selectedExercise: string;
  sets: number;
  reps: string;
  order: number;
};

type PortalSession = {
  id: string;
  sessionName: string;
  order: number;
  movements: PortalMovement[];
};

type PortalProgram = {
  id: string;
  phase: string;
  workoutType: string | null;
  sessionsPerWeek: number;
  currentWeek: number;
  notes: string | null;
  sessions: PortalSession[];
};

type SetLogItem = {
  id: string;
  movementName: string;
  exerciseName: string;
  set1Load: string | null; set1Reps: string | null;
  set2Load: string | null; set2Reps: string | null;
  set3Load: string | null; set3Reps: string | null;
  set4Load: string | null; set4Reps: string | null;
  set5Load: string | null; set5Reps: string | null;
  set6Load: string | null; set6Reps: string | null;
  exerciseNotes: string | null;
};

type WorkoutLogItem = {
  id: string;
  sessionDate: string;
  sessionName: string;
  workoutType: string | null;
  notes: string | null;
  createdByName: string | null;
  setLogs: SetLogItem[];
};

type PendingConfirmation = {
  id: string;
  sessionName: string;
  phase: string;
  ptName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
};

// Sessions the PT finished that need THIS client to confirm on their own device.
// Confirming here is the anti-forgery proof the client was actually present.
function PendingConfirmations({ items }: { items: PendingConfirmation[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (items.length === 0) return null;

  async function act(id: string, action: "confirm" | "reject") {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/my/workout-logs/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5 mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">✋</span>
        <p className="text-sm font-extrabold text-amber-800">Xác nhận buổi tập của bạn</p>
      </div>
      {items.map((it) => {
        const label = it.sessionName.split("—")[0].trim();
        const mins =
          it.checkInAt && it.checkOutAt
            ? Math.round((new Date(it.checkOutAt).getTime() - new Date(it.checkInAt).getTime()) / 60000)
            : null;
        const busy = busyId === it.id;
        return (
          <div key={it.id} className="rounded-2xl bg-white border border-amber-200 p-4">
            <p className="text-sm font-bold text-gray-800">{label} — {it.phase}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              PT: {it.ptName ?? "—"}{mins != null ? ` · ${mins} phút` : ""}
            </p>
            <p className="text-xs text-gray-400 mt-1">Bạn xác nhận đã tập buổi này chứ?</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => act(it.id, "confirm")}
                disabled={busy}
                className="flex-1 h-11 rounded-2xl bg-green-600 text-white text-sm font-bold disabled:opacity-60"
              >
                {busy ? "Đang xử lý..." : "✓ Xác nhận đã tập"}
              </button>
              <button
                onClick={() => act(it.id, "reject")}
                disabled={busy}
                className="h-11 px-4 rounded-2xl border border-gray-300 text-sm font-semibold text-gray-500 disabled:opacity-60"
              >
                Không phải
              </button>
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

function WorkoutProgramSection({ program }: { program: PortalProgram | null }) {
  const [activeSession, setActiveSession] = useState(0);
  const [expanded, setExpanded] = useState(true);

  if (!program) {
    return (
      <div className="rounded-3xl border border-[#f15b5c]/20 bg-[#fff5f5] p-5 mb-4">
        <p className="text-xs font-extrabold text-[#f15b5c]/60 uppercase tracking-widest mb-3">
          Chương trình tập của tôi
        </p>
        <div className="flex flex-col items-center justify-center gap-2 py-6">
          <span className="text-4xl">🏋️</span>
          <p className="text-sm font-extrabold text-gray-700 mt-1">Chưa có chương trình tập</p>
          <p className="text-xs text-gray-400 font-semibold text-center leading-relaxed max-w-[240px]">
            PT của bạn sẽ cập nhật chương trình tập tại đây
          </p>
        </div>
      </div>
    );
  }

  const currentSession = program.sessions[activeSession];
  const subtitle = [program.phase, program.workoutType].filter(Boolean).join(" · ");

  return (
    <div className="rounded-3xl border border-[#f15b5c]/20 bg-[#fff5f5] mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div>
          <p className="text-xs font-extrabold text-[#f15b5c]/70 uppercase tracking-widest mb-0.5">
            Chương trình tập · Tuần {program.currentWeek}
          </p>
          <p className="text-sm font-bold text-gray-800 text-left">
            {subtitle} · {program.sessionsPerWeek} buổi/tuần
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-[#f15b5c]/50" />
          : <ChevronDown className="w-4 h-4 text-[#f15b5c]/50" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {program.notes && (
            <div className="bg-white/60 rounded-2xl px-4 py-3 mb-3 border border-[#f15b5c]/10">
              <p className="text-xs text-gray-600 font-medium leading-relaxed">{program.notes}</p>
            </div>
          )}

          {/* Session tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
            {program.sessions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveSession(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  i === activeSession
                    ? "bg-[#f15b5c] text-white shadow-sm"
                    : "bg-white/70 text-gray-500 border border-gray-200"
                }`}
              >
                {s.sessionName.split("—")[0].trim()}
              </button>
            ))}
          </div>

          {currentSession && (
            <>
              <p className="text-xs font-semibold text-gray-500 mb-2">{currentSession.sessionName}</p>
              <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                {currentSession.movements.map((m, i) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i < currentSession.movements.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-extrabold text-[#f15b5c]">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-semibold">{m.movementName}</p>
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {m.selectedExercise || <span className="text-gray-300 italic font-normal">Chưa xác định</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gray-700">{m.sets > 1 ? `${m.sets} set` : ""}</p>
                      <p className="text-xs text-gray-500">{m.reps}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const SET_KEYS = [1, 2, 3, 4, 5, 6] as const;

function setVal(sl: SetLogItem, n: typeof SET_KEYS[number]) {
  const load = sl[`set${n}Load` as keyof SetLogItem] as string | null;
  const reps = sl[`set${n}Reps` as keyof SetLogItem] as number | null;
  if (load == null && reps == null) return null;
  if (load != null && reps != null) return `${load}×${reps}`;
  if (reps != null) return `${reps} reps`;
  return `${load}`;
}

function ProgressionBadge({ sl }: { sl: SetLogItem }) {
  const notes = sl.exerciseNotes?.toLowerCase() ?? "";
  if (notes.includes("tăng tạ")) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
        💪 {sl.exerciseName}: Hãy tăng tạ ở buổi tới!
      </span>
    );
  }
  if (notes.includes("tăng rep")) {
    const match = sl.exerciseNotes?.match(/(\d+)\s*reps?/i);
    const target = match ? ` ${match[1]}` : "";
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
        📈 {sl.exerciseName}: Cố đạt{target} reps ở buổi tới!
      </span>
    );
  }
  return null;
}

function WorkoutLogCard({ log }: { log: WorkoutLogItem }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const date = new Date(log.sessionDate);
  const dateStr = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const sessionLabel = log.workoutType
    ? `${log.sessionName.split("—")[0].trim()} — ${log.workoutType}`
    : log.sessionName;

  const badges = log.setLogs
    .map((sl) => <ProgressionBadge key={sl.id} sl={sl} />)
    .filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-xs text-gray-400 font-semibold mb-0.5">{dateStr}</p>
          <p className="text-sm font-extrabold text-gray-800 truncate">{sessionLabel}</p>
          {log.createdByName && (
            <p className="text-[10px] text-gray-400 mt-0.5">PT ghi lại: {log.createdByName}</p>
          )}
        </div>
        <div className="shrink-0">
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Body — animated */}
      <div
        ref={bodyRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: open ? (bodyRef.current?.scrollHeight ?? 2000) + "px" : "0px" }}
      >
        <div className="px-4 pb-4 border-t border-gray-50">
          {/* Session notes */}
          {log.notes && (
            <div className="mt-3 mb-3 bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-500 font-medium leading-relaxed">{log.notes}</p>
            </div>
          )}

          {/* Progression badges */}
          {badges.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3 mt-3">
              {badges}
            </div>
          )}

          {/* Exercise table */}
          {log.setLogs.length > 0 && (
            <div className="overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full -mx-4 px-4 mt-3">
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 font-bold text-gray-400 pr-2 w-1/3">Bài tập</th>
                    {SET_KEYS.map((n) => (
                      <th key={n} className="text-center pb-2 font-bold text-gray-400 px-1 w-[48px]">S{n}</th>
                    ))}
                    <th className="text-left pb-2 font-bold text-gray-400 pl-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {log.setLogs.map((sl) => {
                    const sets = SET_KEYS.map((n) => setVal(sl, n));
                    const hasNote = sl.exerciseNotes &&
                      !sl.exerciseNotes.toLowerCase().includes("tăng tạ") &&
                      !sl.exerciseNotes.toLowerCase().includes("tăng rep");
                    return (
                      <tr key={sl.id}>
                        <td className="py-2 pr-2 align-top">
                          <p className="text-[10px] text-gray-400 leading-tight">{sl.movementName}</p>
                          <p className="font-semibold text-gray-800 leading-tight">{sl.exerciseName}</p>
                        </td>
                        {sets.map((v, i) => (
                          <td key={i} className="py-2 px-1 text-center align-top">
                            {v
                              ? <span className="font-semibold text-gray-700 whitespace-nowrap">{v}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                        ))}
                        <td className="py-2 pl-2 align-top text-gray-400 italic">
                          {hasNote ? sl.exerciseNotes : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const HISTORY_DEFAULT = 2;

function WorkoutLogHistory({ logs }: { logs: WorkoutLogItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const extraRef = useRef<HTMLDivElement>(null);

  if (logs.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-100 bg-white p-5 mb-4">
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">
          Lịch sử buổi tập
        </p>
        <div className="flex flex-col items-center gap-2 py-6">
          <Dumbbell className="w-8 h-8 text-gray-200" />
          <p className="text-sm font-extrabold text-gray-500 mt-1 text-center">
            PT chưa ghi lại buổi tập nào.
          </p>
          <p className="text-xs text-gray-400 font-semibold text-center leading-relaxed max-w-[260px]">
            Hãy tập luyện và PT sẽ cập nhật tiến độ của bạn!
          </p>
        </div>
      </div>
    );
  }

  const visible = logs.slice(0, HISTORY_DEFAULT);
  const hidden = logs.slice(HISTORY_DEFAULT);
  const hasMore = hidden.length > 0;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 mb-4">
      <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">
        Lịch sử buổi tập · {logs.length} buổi
      </p>

      {/* Always-visible first 2 */}
      <div className="space-y-3">
        {visible.map((log) => (
          <WorkoutLogCard key={log.id} log={log} />
        ))}
      </div>

      {/* Extra logs — animated */}
      {hasMore && (
        <>
          <div
            ref={extraRef}
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: expanded ? (extraRef.current?.scrollHeight ?? 4000) + "px" : "0px" }}
          >
            <div className="space-y-3 pt-3">
              {hidden.map((log) => (
                <WorkoutLogCard key={log.id} log={log} />
              ))}
            </div>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full py-2.5 rounded-2xl text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Ẩn bớt
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Xem thêm ({hidden.length} buổi)
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

const STEP_GOAL = 8000;
const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const inputCls =
  "w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50";

export function ActivityTab({
  activityLogs,
  workoutProgram = null,
  workoutLogs = [],
  pendingConfirmations = [],
}: {
  activityLogs: ActivityLog[];
  workoutProgram?: PortalProgram | null;
  workoutLogs?: WorkoutLogItem[];
  pendingConfirmations?: PendingConfirmation[];
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Use local date parts to avoid UTC-shift bugs in non-UTC timezones
  function localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

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
      console.log("Saving date:", todayStr);
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
      <h2 className="text-lg font-extrabold text-gray-900 mb-4">Tập luyện</h2>

      {/* ── Pending session confirmations (anti-forgery) ── */}
      <PendingConfirmations items={pendingConfirmations} />

      {/* ── Section 1: Workout program (PT-created, read-only) ── */}
      <WorkoutProgramSection program={workoutProgram} />

      {/* ── Section 2: Workout log history (PT-logged, read-only) ── */}
      <WorkoutLogHistory logs={workoutLogs} />

      {/* ── Section 3: Outside-gym activity (self-update) ── */}
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

        {/* Today summary — 2 cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
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
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
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
