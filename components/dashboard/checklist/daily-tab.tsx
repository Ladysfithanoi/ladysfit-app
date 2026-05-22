"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { Plus, Trash2, Save, CalendarDays, User, Users, Download, X, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffMember } from "./checklist-page";

// ── helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function firstDayOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function currentMonthLabel() {
  const d = new Date();
  return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
}
function defaultImportDate(ownDate: string): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().split("T")[0];
  const first = firstDayOfMonthISO();
  if (yesterday >= first && yesterday !== ownDate) return yesterday;
  if (first !== ownDate) return first;
  return first;
}

// ── calendar helpers ──────────────────────────────────────────────────────────
const CAL_START = 6;   // 06:00
const CAL_END   = 22;  // 22:00
const HOUR_PX   = 60;  // px per hour slot

const VN_DAY_SHORT: Record<number, string> = {
  0: "CHỦ NHẬT", 1: "THỨ 2", 2: "THỨ 3",
  3: "THỨ 4", 4: "THỨ 5", 5: "THỨ 6", 6: "THỨ 7",
};

function timeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function minutesToPx(mins: number): number {
  return ((mins - CAL_START * 60) / 60) * HOUR_PX;
}

function fmtMin(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getDayHeader(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return { dayName: VN_DAY_SHORT[d.getDay()], dayNum: String(d.getDate()) };
}

// ── types ─────────────────────────────────────────────────────────────────────
type Row = {
  id?: string;
  order: number;
  time: string;
  task: string;
  kpi: string;
  actualResult: number;
  note: string;
};

type ChecklistData = {
  checklist: {
    position: string;
    targetNote: string | null;
    totalTarget: number | null;
    dailyResults: string | null;
    dailyCompleted: string | null;
    dailyIncomplete: string | null;
    dailyNextPlan: string | null;
    items: Array<Record<string, unknown>>;
  } | null;
  totalActual: number;
};

type Props = {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  staffList: StaffMember[];
};

const inputCls =
  "h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full min-w-0";
const dateCls =
  "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

// ── Calendar Grid sub-component ───────────────────────────────────────────────
function CalendarGrid({ rows, date }: { rows: Row[]; date: string }) {
  const hours = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);
  const timelineHeight = (CAL_END - CAL_START) * HOUR_PX;

  // Partition rows
  const scheduled: (Row & { startMins: number })[] = [];
  const unscheduled: Row[] = [];

  for (const r of rows) {
    if (!r.time) { unscheduled.push(r); continue; }
    const mins = timeToMinutes(r.time);
    if (mins === null || mins < CAL_START * 60 || mins >= CAL_END * 60) {
      unscheduled.push(r); continue;
    }
    scheduled.push({ ...r, startMins: mins });
  }
  scheduled.sort((a, b) => a.startMins - b.startMins);

  // Current time indicator
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const isToday = date === todayISO();
  const showNowLine = isToday && nowMins >= CAL_START * 60 && nowMins < CAL_END * 60;

  // Overlap grouping: assign column index to avoid full overlap
  const colMap = new Map<number, number>();
  scheduled.forEach((r, idx) => {
    const endMins = r.startMins + 60;
    let col = 0;
    for (let j = 0; j < idx; j++) {
      const prev = scheduled[j];
      if (prev.startMins + 60 > r.startMins && prev.startMins < endMins) {
        col = Math.max(col, (colMap.get(j) ?? 0) + 1);
      }
    }
    colMap.set(idx, col);
  });
  const maxCol = Math.max(0, ...Array.from(colMap.values()));
  const colCount = maxCol + 1;

  const { dayName, dayNum } = getDayHeader(date);

  // Rendered as a fragment — the modal body div handles scrolling
  return (
    <>
      {/* Sticky header — stays visible while scrolling */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-end gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 tracking-widest leading-none">{dayName}</p>
            <p className="text-4xl font-black leading-tight"
               style={{ color: isToday ? "#f15b5c" : "#1a1a1a" }}>
              {dayNum}
            </p>
          </div>
          {isToday && (
            <span className="self-end mb-1 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#f15b5c" }}>
              Hôm nay
            </span>
          )}
        </div>
        <div className="self-end mb-1 ml-auto text-right">
          <p className="text-[10px] text-gray-300 font-medium">GMT+07</p>
          <p className="text-xs text-gray-400 font-semibold">{scheduled.length} công việc xếp lịch</p>
        </div>
      </div>

      {/* Unscheduled chips — sticky below header */}
      {unscheduled.length > 0 && (
        <div className="sticky top-[73px] z-10 bg-gray-50 border-b border-gray-100 px-5 py-2.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Chưa xếp giờ</p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((r, i) => (
              <span key={i}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 whitespace-nowrap">
                {r.task || `Công việc #${r.order}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline — explicit fixed height so parent can scroll over it */}
      <div className="flex" style={{ height: timelineHeight + 16 }}>

        {/* Hour labels column */}
        <div className="w-14 flex-shrink-0 select-none">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX }}
                 className="relative flex items-start justify-end pr-3 pt-0.5">
              <span className="text-[10px] font-semibold text-gray-300 -translate-y-1/2">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Grid + event blocks */}
        <div className="flex-1 relative border-l border-gray-100">

          {/* Hour grid lines */}
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX }}
                 className="border-t border-gray-100 first:border-t-0" />
          ))}
          <div className="border-t border-gray-100" />

          {/* Task blocks — absolutely positioned */}
          <div className="absolute inset-0 px-1.5">
            {scheduled.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <p className="text-[11px] text-gray-200 font-semibold italic">Chưa có công việc nào được xếp lịch</p>
              </div>
            )}
            {scheduled.map((r, idx) => {
              const top    = minutesToPx(r.startMins);
              const height = Math.max(HOUR_PX - 4, 40);
              const col    = colMap.get(idx) ?? 0;
              const wPct   = colCount > 1 ? `${Math.floor(100 / colCount) - 1}%` : "calc(100% - 4px)";
              const leftPct = colCount > 1 ? `${col * Math.floor(100 / colCount)}%` : "2px";

              const COLORS = ["#1a73e8", "#0b8043", "#7b1ea2", "#e67c00"];
              const bg = COLORS[r.order % COLORS.length];

              return (
                <div
                  key={idx}
                  className="absolute rounded-lg px-2.5 py-1.5 overflow-hidden shadow-sm"
                  style={{ top: top + 2, height, width: wPct, left: leftPct, backgroundColor: bg }}
                  title={`${r.task} — ${fmtMin(r.startMins)} – ${fmtMin(r.startMins + 60)}${r.kpi ? ` · KPI: ${r.kpi}` : ""}`}
                >
                  <p className="text-white text-[11px] font-bold leading-tight truncate">{r.task || "—"}</p>
                  <p className="text-white/75 text-[10px] leading-tight mt-0.5">
                    {fmtMin(r.startMins)} – {fmtMin(r.startMins + 60)}
                  </p>
                  {r.kpi && (
                    <p className="text-white/60 text-[9px] leading-tight truncate">KPI: {r.kpi}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current time indicator */}
          {showNowLine && (
            <div
              className="absolute left-0 right-0 pointer-events-none z-10"
              style={{ top: minutesToPx(nowMins) }}
            >
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 -ml-1.5"
                     style={{ backgroundColor: "#f15b5c" }} />
                <div className="flex-1 h-px" style={{ backgroundColor: "#f15b5c" }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function DailyTab({
  currentUserId,
  currentUserName,
  currentUserRole,
  staffList,
}: Props) {
  const isManager = currentUserRole === "FM" || currentUserRole === "ADMIN";

  const [fmSubTab, setFmSubTab] = useState<"own" | "team">("own");
  const isTeamView = isManager && fmSubTab === "team";

  const [ownDate, setOwnDate]   = useState(todayISO());
  const [teamDate, setTeamDate] = useState(todayISO());

  const firstPTId = staffList.find((s) => s.id !== currentUserId)?.id ?? currentUserId;
  const [teamSelectedId, setTeamSelectedId] = useState(firstPTId);

  const selectedUserId = isTeamView ? teamSelectedId : currentUserId;
  const date = isTeamView ? teamDate : ownDate;

  // Form state
  const [position, setPosition]               = useState("");
  const [targetNote, setTargetNote]           = useState("");
  const [totalTarget, setTotalTarget]         = useState("");
  const [totalActual, setTotalActual]         = useState(0);
  const [rows, setRows]                       = useState<Row[]>([]);
  const [dailyResults, setDailyResults]       = useState("");
  const [dailyCompleted, setDailyCompleted]   = useState("");
  const [dailyIncomplete, setDailyIncomplete] = useState("");
  const [dailyNextPlan, setDailyNextPlan]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState("");
  const [loading, setLoading] = useState(false);

  // Import modal state
  const [importOpen, setImportOpen]       = useState(false);
  const [importDate, setImportDate]       = useState(() => defaultImportDate(todayISO()));
  const [importRows, setImportRows]       = useState<Row[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importHasData, setImportHasData] = useState(false);

  // Calendar overview modal state
  const [calendarOpen, setCalendarOpen] = useState(false);

  const canEdit           = !isTeamView;
  const canEditReflection = !isTeamView;

  const selectedUser = staffList.find((s) => s.id === selectedUserId);
  const displayName  = selectedUser?.name ?? selectedUser?.email ?? currentUserName;
  const minDate = firstDayOfMonthISO();

  // ── fetch main ─────────────────────────────────────────────────────────────
  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checklist/daily?date=${date}&userId=${selectedUserId}`);
      if (!res.ok) return;
      const data = (await res.json()) as ChecklistData;
      setTotalActual(data.totalActual);
      if (data.checklist) {
        setPosition(data.checklist.position ?? "");
        setTargetNote(data.checklist.targetNote ?? "");
        setTotalTarget(data.checklist.totalTarget != null ? String(data.checklist.totalTarget) : "");
        setDailyResults(data.checklist.dailyResults ?? "");
        setDailyCompleted(data.checklist.dailyCompleted ?? "");
        setDailyIncomplete(data.checklist.dailyIncomplete ?? "");
        setDailyNextPlan(data.checklist.dailyNextPlan ?? "");
        setRows(
          data.checklist.items.map((item) => ({
            id: item.id as string | undefined,
            order: item.order as number,
            time: (item.time as string) ?? "",
            task: (item.task as string) ?? "",
            kpi: (item.kpi as string) ?? "",
            actualResult: item.actualResult != null ? Number(item.actualResult) : 0,
            note: (item.note as string) ?? "",
          }))
        );
      } else {
        setPosition(""); setTargetNote(""); setTotalTarget("");
        setDailyResults(""); setDailyCompleted(""); setDailyIncomplete(""); setDailyNextPlan("");
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [date, selectedUserId]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  // ── fetch import preview ───────────────────────────────────────────────────
  const fetchImportPreview = useCallback(async (d: string) => {
    if (d === ownDate) { setImportRows([]); setImportHasData(false); return; }
    setImportLoading(true);
    setImportRows([]);
    setImportHasData(false);
    try {
      const res = await fetch(`/api/checklist/daily?date=${d}&userId=${currentUserId}`);
      if (!res.ok) return;
      const data = (await res.json()) as ChecklistData;
      if (data.checklist && data.checklist.items.length > 0) {
        setImportHasData(true);
        setImportRows(
          data.checklist.items.map((item) => ({
            id: undefined,
            order: item.order as number,
            time: (item.time as string) ?? "",
            task: (item.task as string) ?? "",
            kpi: (item.kpi as string) ?? "",
            actualResult: item.actualResult != null ? Number(item.actualResult) : 0,
            note: (item.note as string) ?? "",
          }))
        );
      }
    } finally {
      setImportLoading(false);
    }
  }, [currentUserId, ownDate]);

  useEffect(() => {
    if (importOpen) fetchImportPreview(importDate);
  }, [importDate, importOpen, fetchImportPreview]);

  function openImportModal() {
    const d = defaultImportDate(ownDate);
    setImportDate(d);
    setImportRows([]);
    setImportHasData(false);
    setImportOpen(true);
  }

  function handleImportConfirm() {
    setRows(importRows.map((r, i) => ({ ...r, id: undefined, order: i + 1 })));
    setImportOpen(false);
    setToast("Đã nhập danh sách công việc ✓");
    setTimeout(() => setToast(""), 3000);
  }

  // ── row helpers ────────────────────────────────────────────────────────────
  function addRow() {
    setRows((p) => [...p, { order: p.length + 1, time: "", task: "", kpi: "", actualResult: 0, note: "" }]);
  }
  function removeRow(i: number) {
    setRows((p) => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, order: idx + 1 })));
  }
  function updateRow<K extends keyof Row>(i: number, key: K, value: Row[K]) {
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/checklist/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          userId: currentUserId,
          position,
          targetNote:      targetNote || undefined,
          totalTarget:     totalTarget ? parseFloat(totalTarget) : undefined,
          dailyResults:    dailyResults || undefined,
          dailyCompleted:  dailyCompleted || undefined,
          dailyIncomplete: dailyIncomplete || undefined,
          dailyNextPlan:   dailyNextPlan || undefined,
          items: rows.map((r) => ({
            order: r.order,
            time: r.time || undefined,
            task: r.task,
            kpi: r.kpi || undefined,
            actualResult: r.actualResult || undefined,
            note: r.note || undefined,
          })),
        }),
      });
      if (res.ok) {
        setToast("Đã lưu check-list ✓");
        setTimeout(() => setToast(""), 3000);
        fetchChecklist();
      }
    } finally {
      setSaving(false);
    }
  }

  // ── progress ───────────────────────────────────────────────────────────────
  const completedTasks = rows.filter((r) => {
    const k = parseFloat(r.kpi);
    return !isNaN(k) && k > 0 && (r.actualResult / k) * 100 >= 80;
  }).length;
  const pct = rows.length > 0 ? Math.round((completedTasks / rows.length) * 100) : 0;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── FM/Admin: 2 sub-tabs ──────────────────────────────────────────── */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 border-b border-gray-100">
            {(["own", "team"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFmSubTab(tab)}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all",
                  fmSubTab === tab
                    ? "text-[#f15b5c] border-b-2 border-[#f15b5c] bg-[#f15b5c]/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50/60"
                )}
              >
                {tab === "own" ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                <span className="hidden xs:inline">
                  {tab === "own" ? "Check-list của tôi" : "Quản lý PT"}
                </span>
                <span className="xs:hidden">
                  {tab === "own" ? "Của tôi" : "Quản lý PT"}
                </span>
              </button>
            ))}
          </div>

          <div className="px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2.5">
            {fmSubTab === "team" && (
              <div className="flex items-center gap-2 min-w-0">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Nhân sự:</label>
                <select
                  value={teamSelectedId}
                  onChange={(e) => setTeamSelectedId(e.target.value)}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 max-w-[200px] sm:max-w-none"
                >
                  {staffList.filter((s) => s.id !== currentUserId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Ngày:</label>
              <input
                type="date"
                value={fmSubTab === "team" ? teamDate : ownDate}
                min={minDate}
                max={todayISO()}
                onChange={(e) => {
                  if (!e.target.value) return;
                  fmSubTab === "team" ? setTeamDate(e.target.value) : setOwnDate(e.target.value);
                }}
                className={dateCls}
              />
            </div>

            <span className={cn(
              "text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap border",
              fmSubTab === "own"
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-amber-50 text-amber-600 border-amber-200"
            )}>
              {fmSubTab === "own" ? `✏️ Của bạn · ${currentMonthLabel()}` : `👁 Chỉ xem · ${currentMonthLabel()}`}
            </span>
          </div>
        </div>
      )}

      {/* ── Header card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Họ tên</label>
            <div className="h-9 rounded-xl border border-gray-100 bg-gray-50 px-3 flex items-center text-sm text-gray-600">
              {displayName}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Vị trí</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={!canEdit}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="VD: PT, FM..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Ngày báo cáo</label>
            {isManager ? (
              <div className="h-9 rounded-xl border border-gray-100 bg-gray-50 px-3 flex items-center text-sm text-gray-600 font-medium">
                {fmtDate(date)}
              </div>
            ) : (
              <input
                type="date"
                value={date}
                min={minDate}
                max={todayISO()}
                onChange={(e) => e.target.value && setOwnDate(e.target.value)}
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full"
              />
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Target tháng (triệu)</label>
            <input
              type="number" step="0.1"
              value={totalTarget}
              onChange={(e) => setTotalTarget(e.target.value)}
              disabled={!canEdit}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50"
              placeholder="50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Thực đạt tháng (triệu)</label>
            <div className="h-9 rounded-xl border border-gray-100 bg-gray-50 px-3 flex items-center text-sm font-semibold text-emerald-600">
              {totalActual.toFixed(1)}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Mục tiêu ngày</label>
            <input
              value={targetNote}
              onChange={(e) => setTargetNote(e.target.value)}
              disabled={!canEdit}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50"
              placeholder="Mục tiêu hôm nay..."
            />
          </div>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-500">Tiến độ — {fmtDate(date)}</span>
              <span className="text-xs font-bold text-gray-700">
                {completedTasks}/{rows.length} việc · {pct}%
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : "bg-[#f15b5c]"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Bảng công việc ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-700">Danh sách công việc</p>
          <div className="flex items-center gap-2">
            {/* Xem tổng quan — luôn hiển thị */}
            <button
              onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-bold transition-colors"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xem tổng quan</span>
              <span className="sm:hidden">Lịch</span>
            </button>
            {canEdit && (
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Plus className="w-3.5 h-3.5" /> Thêm công việc
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Đang tải...</div>
        ) : (
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full min-w-[540px] text-xs border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] border-b border-gray-200">
                  {["STT", "Giờ", "Công việc", "KPI", "Thực đạt", "%", "Note", ...(canEdit ? ["Xóa"] : [])].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="px-3 py-10 text-center text-gray-300 italic text-sm">
                      {canEdit
                        ? 'Nhấn "+ Thêm công việc" để bắt đầu'
                        : `Không có dữ liệu cho ngày ${fmtDate(date)}`}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 divide-x divide-gray-100">
                      <td className="px-3 py-2 text-gray-400 w-10">{row.order}</td>
                      <td className="px-2 py-2 w-24">
                        {canEdit ? (
                          <input type="time" step="60" value={row.time} onChange={(e) => updateRow(i, "time", e.target.value)} className={inputCls} />
                        ) : (
                          <span className="text-gray-600 whitespace-nowrap">{row.time ? `⏱️ ${row.time}` : "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 w-full">
                        {canEdit ? (
                          <input value={row.task} onChange={(e) => updateRow(i, "task", e.target.value)} className={inputCls} placeholder="Tên công việc..." />
                        ) : (
                          <span className="font-semibold text-gray-800">{row.task || "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 w-32">
                        {canEdit ? (
                          <input value={row.kpi} onChange={(e) => updateRow(i, "kpi", e.target.value)} className={inputCls} placeholder="KPI..." />
                        ) : (
                          <span className="text-gray-600">{row.kpi || "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 w-28">
                        {canEdit ? (
                          <input
                            type="number" min="0" step="any"
                            value={row.actualResult === 0 ? "" : row.actualResult}
                            onChange={(e) => updateRow(i, "actualResult", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                            className={inputCls} placeholder="0"
                          />
                        ) : (
                          <span className="text-gray-600">{row.actualResult > 0 ? row.actualResult : "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 w-20 text-center">
                        {(() => {
                          const kpiNum = parseFloat(row.kpi);
                          const hasKpi = !isNaN(kpiNum) && kpiNum > 0;
                          if (!hasKpi) return <span className="text-gray-300 font-semibold">—</span>;
                          const pctVal = (row.actualResult / kpiNum) * 100;
                          const color = pctVal >= 100 ? "text-green-600" : pctVal >= 70 ? "text-yellow-500" : "text-red-500";
                          return <span className={cn("font-bold text-xs", color)}>{pctVal.toFixed(1)}%</span>;
                        })()}
                      </td>
                      <td className="px-2 py-2 w-28">
                        {canEdit ? (
                          <input value={row.note} onChange={(e) => updateRow(i, "note", e.target.value)} className={inputCls} placeholder="Ghi chú..." />
                        ) : (
                          <span className="text-gray-500">{row.note || "—"}</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2 w-10">
                          <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tự luận cuối ngày ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: "#f15b5c" }}>
          <p className="text-sm font-extrabold text-white tracking-wide uppercase">Tự luận cuối ngày</p>
          {isTeamView && (
            <span className="text-xs text-white/80 italic flex items-center gap-1.5">
              <span>👁️</span> Chế độ xem
            </span>
          )}
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(
            [
              { label: "Kết quả ngày hôm nay",  key: "r", value: dailyResults,    set: setDailyResults,    placeholder: "Tổng kết kết quả đạt được trong ngày..." },
              { label: "Đã hoàn thành",          key: "c", value: dailyCompleted,  set: setDailyCompleted,  placeholder: "Liệt kê các công việc đã hoàn thành..." },
              { label: "Chưa hoàn thành",        key: "i", value: dailyIncomplete, set: setDailyIncomplete, placeholder: "Liệt kê công việc chưa hoàn thành và lý do..." },
              { label: "Kế hoạch tiếp theo",     key: "n", value: dailyNextPlan,   set: setDailyNextPlan,   placeholder: "Kế hoạch cho ngày/buổi làm việc tiếp theo..." },
            ] as { label: string; key: string; value: string; set: (v: string) => void; placeholder: string }[]
          ).map(({ label, key, value, set, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">{label}</label>
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                disabled={!canEditReflection}
                rows={3}
                placeholder={canEditReflection ? placeholder : ""}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none",
                  canEditReflection
                    ? "border-gray-200 bg-white"
                    : "border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Lưu + Nhập từ ngày khác ───────────────────────────────────────── */}
      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={openImportModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors bg-white"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Nhập từ ngày khác</span>
            <span className="sm:hidden">Nhập</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : "Lưu check-list"}
          </button>
        </div>
      )}

      {/* ── Modal: Xem tổng quan (Google Calendar style) ──────────────────── */}
      {calendarOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 py-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCalendarOpen(false); }}
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Modal toolbar — fixed, never scrolls */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tổng quan lịch ngày</span>
              <button
                onClick={() => setCalendarOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar body — this div scrolls, CalendarGrid renders flat content */}
            <div
              className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full"
              style={{ WebkitOverflowScrolling: "touch" } as CSSProperties}
            >
              <CalendarGrid rows={rows} date={date} />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nhập từ ngày khác ──────────────────────────────────────── */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onClick={(e) => { if (e.target === e.currentTarget) setImportOpen(false); }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-sm font-extrabold text-gray-800">Nhập từ ngày khác</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Chọn ngày trong tháng để xem trước và nhập danh sách</p>
              </div>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Chọn ngày:</label>
                <input
                  type="date"
                  value={importDate}
                  min={minDate}
                  max={todayISO()}
                  onChange={(e) => { if (e.target.value) setImportDate(e.target.value); }}
                  className={cn(dateCls, "flex-1")}
                />
                {importDate === ownDate && (
                  <span className="text-[11px] text-amber-500 font-medium whitespace-nowrap">Đang xem ngày này</span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
              {importDate === ownDate ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <span className="text-3xl">📅</span>
                  <p className="text-sm text-gray-400 text-center">
                    Hãy chọn một ngày khác với ngày đang xem ({fmtDate(ownDate)})
                  </p>
                </div>
              ) : importLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-[#f15b5c]/30 border-t-[#f15b5c] animate-spin" />
                  <p className="text-xs text-gray-400">Đang tải dữ liệu...</p>
                </div>
              ) : !importHasData ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <span className="text-3xl">📋</span>
                  <p className="text-sm font-semibold text-gray-400">Chưa có Check-list nào được ghi nhận</p>
                  <p className="text-[11px] text-gray-300">cho ngày {fmtDate(importDate)}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Danh sách {importRows.length} công việc — {fmtDate(importDate)}
                  </p>
                  {importRows.map((row, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50">
                      <input type="checkbox" disabled className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 flex-shrink-0 cursor-not-allowed opacity-40" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-700 leading-snug">{row.task || "—"}</span>
                          {row.time && (
                            <span className="text-[10px] text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">⏱ {row.time}</span>
                          )}
                          {row.kpi && (
                            <span className="text-[10px] text-blue-500 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">KPI: {row.kpi}</span>
                          )}
                        </div>
                        {row.note && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{row.note}</p>}
                      </div>
                      <span className="text-[10px] font-bold text-gray-300 flex-shrink-0">#{row.order}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 bg-gray-50/50">
              <p className="text-[11px] text-gray-400 leading-tight">
                {importHasData && importDate !== ownDate
                  ? "Dữ liệu sẽ ghi đè danh sách công việc hiện tại"
                  : "Chọn ngày có dữ liệu để kích hoạt nhập"}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setImportOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 font-semibold hover:bg-gray-100 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleImportConfirm}
                  disabled={!importHasData || importDate === ownDate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Xác nhận nhập
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
