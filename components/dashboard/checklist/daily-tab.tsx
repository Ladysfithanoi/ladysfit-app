"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { Plus, Trash2, CalendarDays, User, Users, Download, X, LayoutGrid, ArrowUpDown, Dumbbell, ChevronLeft, ChevronRight, LogOut, CheckCircle2, Star, Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffMember } from "./checklist-page";
import { useFormAutoSave, loadDraft } from "@/hooks/use-form-auto-save";
import { MAX_RATING, MIN_RATING, RATING_LABEL } from "@/lib/checklist-review";

/** Khoảng lặng sau lần gõ cuối rồi mới đẩy check-list lên máy chủ. */
const AUTOSAVE_MS = 1200;

// ── helpers ───────────────────────────────────────────────────────────────────
// Use local-time methods to build YYYY-MM-DD — avoids UTC midnight crossing local-date boundary
function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO() {
  return localYMD(new Date());
}
function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localYMD(dt);
}
// Nhân sự được điền trước cho hôm nay và tối đa 31 ngày tới; ngày đã qua chỉ xem.
const EDIT_AHEAD_DAYS = 31;
function maxEditableISO() {
  return addDaysISO(todayISO(), EDIT_AHEAD_DAYS);
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
// The end-of-day reflection used to be 4 separate boxes; it is now a single box.
// For check-lists saved under the old layout, fold the legacy fields into one
// string so nothing written before the change is lost.
function mergeLegacyReflection(c: {
  dailyResults: string | null;
  dailyCompleted: string | null;
  dailyIncomplete: string | null;
  dailyNextPlan: string | null;
}): string {
  if (c.dailyResults && c.dailyResults.trim()) return c.dailyResults;
  const parts: string[] = [];
  if (c.dailyCompleted?.trim()) parts.push(`✅ Đã hoàn thành:\n${c.dailyCompleted.trim()}`);
  if (c.dailyIncomplete?.trim()) parts.push(`⏳ Chưa hoàn thành:\n${c.dailyIncomplete.trim()}`);
  if (c.dailyNextPlan?.trim()) parts.push(`➡️ Giải pháp / kế hoạch:\n${c.dailyNextPlan.trim()}`);
  return parts.join("\n\n");
}
// Normalize arbitrary time input → "HH:MM" (24h), returns "" if invalid
function normalizeTime(raw: string): string {
  const s = raw.trim().replace(/[^\d:]/g, "");
  if (!s) return "";
  let h: number, m: number;
  if (s.includes(":")) {
    const [hStr, mStr] = s.split(":");
    h = parseInt(hStr, 10);
    m = parseInt(mStr ?? "0", 10);
  } else if (s.length <= 2) {
    h = parseInt(s, 10); m = 0;
  } else if (s.length === 3) {
    h = parseInt(s[0], 10); m = parseInt(s.slice(1), 10);
  } else {
    h = parseInt(s.slice(0, 2), 10); m = parseInt(s.slice(2, 4), 10);
  }
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Sort rows by time ascending; rows without time go to the end
function sortRowsByTime(rows: Row[]): Row[] {
  const withTime = [...rows.filter((r) => r.time)].sort((a, b) => a.time.localeCompare(b.time));
  const withoutTime = rows.filter((r) => !r.time);
  return [...withTime, ...withoutTime].map((r, i) => ({ ...r, order: i + 1 }));
}

// Mặc định lấy ngày hôm qua để nhập lại danh sách công việc; nếu đang xem đúng
// ngày hôm qua thì lùi thêm một ngày nữa cho khác ngày đang mở.
function defaultImportDate(ownDate: string): string {
  const yesterday = addDaysISO(todayISO(), -1);
  return yesterday === ownDate ? addDaysISO(yesterday, -1) : yesterday;
}

// ── calendar helpers ──────────────────────────────────────────────────────────
// Trục thời gian phủ trọn 24 giờ như Google Calendar — không cắt đầu/cuối ngày,
// công việc lúc 5h sáng hay 23h đêm đều nằm đúng chỗ trên lịch.
const CAL_START = 0;   // 00:00
const CAL_END   = 24;  // 24:00
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
  isTeaching: boolean;
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
    /** Mốc nhân sự bấm Check-out — rỗng nghĩa là ngày đó chưa chốt. */
    checkedOutAt: string | null;
    fmRating: number | null;
    fmComment: string | null;
    fmReviewedAt: string | null;
    fmReviewer: { name: string | null; email: string } | null;
    items: Array<Record<string, unknown>>;
  } | null;
  totalActual: number;
};

type OverviewStaff = {
  userId: string;
  name: string;
  role: string;
  branchName: string;
  filled: boolean;
  checkedOut: boolean;
  checkedOutAt: string | null;
  fmRating: number | null;
  reviewed: boolean;
  tasksTotal: number;
  tasksCompleted: number;
  taskRate: number;
  teachingSetup: number;
  teachingDone: number;
  targetNote: string;
  reflection: string;
};

type Props = {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  staffList: StaffMember[];
  /**
   * Mở thẳng check-list của một nhân sự trong một ngày — chuông thông báo
   * Check-out gắn sẵn hai giá trị này vào đường dẫn, để FM bấm một phát là tới
   * đúng chỗ thay vì phải tự chọn lại người và ngày.
   */
  initialTeamUserId?: string;
  initialDate?: string;
};

/** "18:42" — giờ phút của một mốc ISO, theo giờ máy người xem. */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── DateInput — iOS Safari locale fix ────────────────────────────────────────
// Safari on iOS renders <input type="date"> in device locale ("ngày 22 thg 05, 2026").
// Solution: display fmtDate() text ourselves; a transparent native input sits on top
// to capture taps and open the system date picker.
function DateInput({
  value, min, max, onChange, className,
}: {
  value: string; min?: string; max?: string;
  onChange: (v: string) => void; className?: string;
}) {
  return (
    <div className={cn(
      "relative h-9 rounded-xl border border-gray-200 bg-white flex items-center px-3 cursor-pointer overflow-hidden",
      className
    )}>
      <span className="text-sm text-gray-700 whitespace-nowrap pointer-events-none select-none">
        {fmtDate(value)}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        // Chrome/Edge trên desktop chỉ mở lịch khi bấm đúng icon lịch — mà icon
        // đang bị ẩn (opacity-0), nên bấm vào ô thấy "không hiện gì". Gọi tay
        // showPicker() để bấm chỗ nào trong ô cũng mở được.
        onClick={(e) => {
          const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
          try { el.showPicker?.(); } catch { /* trình duyệt cũ: để hành vi mặc định */ }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}

// ── MonthCalendarPicker — full-history month calendar ────────────────────────
// A click-to-open month grid with no lower bound, so the whole history stays
// reachable. `maxDate` (default: today) is the last selectable day — the daily
// tab passes a future date so staff can plan the days ahead.
function MonthCalendarPicker({
  value, onChange, className, maxDate,
}: {
  value: string; onChange: (v: string) => void; className?: string; maxDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const [y, m] = value.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // The dropdown is rendered fixed (not absolute) so it isn't clipped by any
  // ancestor with overflow-hidden (the FM toolbar card). Anchor it to the button.
  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const width = 256; // w-64
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
      if (left < 8) left = 8;
      setCoords({ top: r.bottom + 4, left });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    // Re-sync the visible month whenever the selected date changes externally.
    const [y, m] = value.split("-").map(Number);
    setView({ y, m: m - 1 });
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function close() { setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    // Fixed positioning is computed on open; close on scroll/resize so it never drifts.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const today = todayISO();
  const limit = maxDate ?? today;
  const [limY, limM] = limit.split("-").map(Number);
  const canNext = view.y < limY || (view.y === limY && view.m < limM - 1);

  function prevMonth() {
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  }
  function nextMonth() {
    if (!canNext) return;
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  }

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function ymdOf(d: number) {
    return `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="h-9 w-full rounded-xl border border-gray-200 bg-white flex items-center gap-2 px-3 text-sm text-gray-700 hover:border-[#f15b5c]/50 transition-colors"
      >
        <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="whitespace-nowrap">{fmtDate(value)}</span>
      </button>
      {open && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-64"
          style={{ top: coords.top, left: coords.left }}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-gray-700">Tháng {view.m + 1}/{view.y}</span>
            <button
              type="button"
              onClick={nextMonth}
              disabled={!canNext}
              className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-gray-400 mb-1">
            {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const ymd = ymdOf(d);
              const isFuture = ymd > limit;
              const isSel = ymd === value;
              const isToday = ymd === today;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isFuture}
                  onClick={() => { onChange(ymd); setOpen(false); }}
                  className={cn(
                    "h-8 rounded-lg text-xs font-semibold transition-colors",
                    isSel
                      ? "bg-[#f15b5c] text-white"
                      : isToday
                        ? "border border-[#f15b5c] text-[#f15b5c]"
                        : "text-gray-600 hover:bg-gray-100",
                    isFuture && "opacity-30 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// appearance-none + m-0: strips iOS Safari default input chrome (inner shadow, padding, border-radius)
// box-border: padding counted inward so input stays within column boundary
// text-[16px]: prevents iOS Safari auto-zoom (zoom triggers when font-size < 16px)
const inputCls =
  "h-7 w-full min-w-0 box-border m-0 appearance-none rounded-lg border border-gray-200 bg-white px-1.5 text-[16px] sm:text-xs leading-none focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

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

  // Trục 24h dài 1440px nên mở ra sẽ đứng ở 00:00 — vô nghĩa. Cuộn sẵn tới khung
  // giờ đáng quan tâm: công việc sớm nhất trong ngày, hoặc giờ hiện tại nếu là
  // hôm nay (giống cách Google Calendar mở ở "bây giờ").
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = timelineRef.current;
    const scroller = el?.closest("[data-cal-scroll]") as HTMLElement | null;
    if (!el || !scroller) return;
    const focusMins = scheduled.length > 0
      ? scheduled[0].startMins
      : isToday ? nowMins : 7 * 60;
    const offset =
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTop = Math.max(0, offset + minutesToPx(focusMins) - 24);
    // Chỉ chạy khi mở lịch — modal được mount lại mỗi lần mở.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div ref={timelineRef} className="flex" style={{ height: timelineHeight + 16 }}>

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

// ── SaveStatus — bảng không còn nút Lưu, nên phải nói rõ tình trạng ──────────
//
// Không có dòng này thì người điền chẳng có cách nào biết cái mình vừa gõ đã
// nằm trên máy chủ hay chưa — đó là cái giá của việc bỏ nút Lưu, và đây là chỗ
// trả lại.
function SaveStatus({
  state,
  savedAt,
  error,
}: {
  state:   "idle" | "pending" | "saving" | "saved" | "error";
  savedAt: string | null;
  error:   string;
}) {
  if (state === "error") {
    return (
      <p className="flex items-start gap-1.5 text-[11px] font-semibold text-[#f15b5c] leading-snug">
        <CloudOff className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>{error || "Không lưu được"}</span>
      </p>
    );
  }
  if (state === "saving" || state === "pending") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
        <Cloud className="w-3.5 h-3.5 shrink-0 animate-pulse" />
        Đang lưu...
      </p>
    );
  }
  if (state === "saved" && savedAt) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
        <Cloud className="w-3.5 h-3.5 shrink-0" />
        Đã tự lưu lúc {fmtTime(savedAt)}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
      <Cloud className="w-3.5 h-3.5 shrink-0" />
      Check-list tự lưu — không cần bấm Lưu
    </p>
  );
}

// ── FMReviewCard — nơi FM chấm sau khi đọc tự luận cuối ngày ─────────────────
//
// Điểm 1–5 là thứ duy nhất cộng lại được, nên màn Tổng kết đánh giá theo ngày /
// tuần / tháng / quý / năm sống nhờ chính ô này.
function FMReviewCard({
  canReview,
  checkedOutAt,
  rating,
  comment,
  reviewedAt,
  reviewerName,
  saving,
  onRating,
  onComment,
  onSave,
}: {
  canReview:    boolean;
  checkedOutAt: string | null;
  rating:       number | null;
  comment:      string;
  reviewedAt:   string | null;
  reviewerName: string | null;
  saving:       boolean;
  onRating:  (v: number | null) => void;
  onComment: (v: string) => void;
  onSave:    () => void;
}) {
  const stars = Array.from({ length: MAX_RATING - MIN_RATING + 1 }, (_, i) => MIN_RATING + i);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 bg-gray-800">
        <p className="text-sm font-extrabold text-white tracking-wide uppercase">Đánh giá của FM</p>
        {reviewedAt && (
          <span className="text-[11px] font-semibold text-white/70 whitespace-nowrap truncate">
            {reviewerName ? `${reviewerName} · ` : ""}{fmtTime(reviewedAt)}
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {!checkedOutAt && (
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-snug">
            Nhân sự chưa check-out ngày này — tự luận có thể còn viết dở.
          </p>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500">Điểm đánh giá</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {stars.map((v) => (
              <button
                key={v}
                type="button"
                disabled={!canReview}
                // Bấm lại đúng mức đang chọn là bỏ chọn — không cần thêm nút xoá.
                onClick={() => onRating(rating === v ? null : v)}
                title={RATING_LABEL[v]}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
                  rating != null && v <= rating
                    ? "text-amber-500"
                    : "text-gray-200",
                  canReview ? "hover:bg-amber-50" : "cursor-not-allowed"
                )}
              >
                <Star className="w-5 h-5" fill={rating != null && v <= rating ? "currentColor" : "none"} />
              </button>
            ))}
            <span className="ml-1 text-xs font-bold text-gray-500">
              {rating != null ? `${rating}/${MAX_RATING} · ${RATING_LABEL[rating]}` : "Chưa chấm"}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500">Nhận xét</label>
          <textarea
            value={comment}
            onChange={(e) => onComment(e.target.value)}
            disabled={!canReview}
            rows={4}
            placeholder={canReview ? "Nhận xét cho nhân sự về ngày làm việc này..." : ""}
            className={cn(
              "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-y",
              canReview ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed"
            )}
          />
        </div>

        {canReview && (
          <div className="flex justify-stretch sm:justify-end pt-1">
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Star className="w-4 h-4" />
              {saving ? "Đang lưu..." : reviewedAt ? "Cập nhật đánh giá" : "Lưu đánh giá"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function DailyTab({
  currentUserId,
  currentUserName,
  currentUserRole,
  staffList,
  initialTeamUserId,
  initialDate,
}: Props) {
  const isManager = currentUserRole === "FM" || currentUserRole === "ADMIN";

  // Tới từ chuông Check-out thì mở thẳng tab Quản lý PT của đúng người đó.
  const openedFromNotif = isManager && !!initialTeamUserId;
  const [fmSubTab, setFmSubTab] = useState<"own" | "team">(openedFromNotif ? "team" : "own");
  const isTeamView = isManager && fmSubTab === "team";

  const [ownDate, setOwnDate]   = useState(initialDate ?? todayISO());
  const [teamDate, setTeamDate] = useState(initialDate ?? todayISO());

  const firstPTId = staffList.find((s) => s.id !== currentUserId)?.id ?? currentUserId;
  const [teamSelectedId, setTeamSelectedId] = useState(
    openedFromNotif ? initialTeamUserId! : firstPTId
  );

  const selectedUserId = isTeamView ? teamSelectedId : currentUserId;
  const date = isTeamView ? teamDate : ownDate;

  // Form state
  const [position, setPosition]               = useState("");
  const [targetNote, setTargetNote]           = useState("");
  const [totalTarget, setTotalTarget]         = useState("");
  const [totalActual, setTotalActual]         = useState(0);
  const [rows, setRows]                       = useState<Row[]>([]);
  // Single end-of-day reflection box (replaces the former 4 boxes).
  const [dailyResults, setDailyResults]       = useState("");
  const [toast, setToast]     = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Bảng TỰ LƯU nên không còn nút Lưu; thay vào đó là một dòng trạng thái nhỏ
  // để người điền luôn biết việc mình gõ đã nằm trên máy chủ hay chưa.
  type SaveState = "idle" | "pending" | "saving" | "saved" | "error";
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt]     = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  // Chốt ngày làm việc
  const [checkedOutAt, setCheckedOutAt] = useState<string | null>(null);
  const [checkingOut, setCheckingOut]   = useState(false);

  // Đánh giá của FM cho ngày đang xem
  const [fmRating, setFmRating]           = useState<number | null>(null);
  const [fmComment, setFmComment]         = useState("");
  const [fmReviewedAt, setFmReviewedAt]   = useState<string | null>(null);
  const [fmReviewerName, setFmReviewerName] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving]   = useState(false);

  // Import modal state
  const [importOpen, setImportOpen]       = useState(false);
  const [importDate, setImportDate]       = useState(() => defaultImportDate(todayISO()));
  const [importRows, setImportRows]       = useState<Row[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importHasData, setImportHasData] = useState(false);

  // Calendar overview modal state
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Team overview modal state (FM/Admin: all staff check-lists at a glance)
  const [overviewOpen, setOverviewOpen]       = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewStaff, setOverviewStaff]     = useState<OverviewStaff[]>([]);

  // Điền được cho check-list của chính mình từ hôm nay trở đi (điền trước cả
  // tuần cũng được, tối đa 31 ngày). Ngày đã qua — của mình hay của nhân sự —
  // đều chỉ xem lại.
  const today     = todayISO();
  const maxEdit   = maxEditableISO();
  const isPastDay = date < today;
  const canEdit           = !isTeamView && !isPastDay && date <= maxEdit;
  const canEditReflection = canEdit;
  const isFutureDay       = date > today;

  // Check-out chỉ cho ngày hôm nay hoặc hôm qua (ca tối tan sau nửa đêm là
  // chuyện thường), và chỉ cho check-list của chính mình.
  const canCheckOut = !isTeamView
    && date <= today
    && date >= addDaysISO(today, -1)
    && !checkedOutAt;

  // FM/Admin chấm cho NGƯỜI KHÁC. Tự chấm cho mình thì điểm tổng kết vô nghĩa.
  const canReview = isManager && isTeamView && selectedUserId !== currentUserId;

  // ── Auto-save draft (own checklist only) ──────────────────────────────────
  const draftKey = `ladysfit_draft_checklist_${currentUserId}_${ownDate}`;
  const { clearDraft: clearChecklistDraft } = useFormAutoSave(
    draftKey,
    { position, targetNote, totalTarget, rows, dailyResults },
    canEdit && !loading && isDirty
  );

  const selectedUser = staffList.find((s) => s.id === selectedUserId);
  const displayName  = selectedUser?.name ?? selectedUser?.email ?? currentUserName;
  // Không còn giới hạn dưới: nhân sự xem lại được toàn bộ lịch sử của mình.

  /**
   * Form ĐANG GIỮ dữ liệu của ai, ngày nào — dạng `userId|YYYY-MM-DD`, rỗng khi
   * chưa nạp được gì.
   *
   * Mốc này là thứ quyết định lượt tự lưu ghi vào ngày nào, chứ KHÔNG phải ngày
   * đang chọn trên lịch. Vừa bấm sang ngày khác thì `date` đã đổi nhưng dữ liệu
   * mới chưa về, trên màn vẫn là bảng của ngày cũ — lấy `date` lúc đó là chép
   * nguyên việc hôm qua đè sang hôm nay.
   */
  const loadedKeyRef = useRef("");

  // ── fetch main ─────────────────────────────────────────────────────────────
  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    loadedKeyRef.current = "";
    try {
      const res = await fetch(`/api/checklist/daily?date=${date}&userId=${selectedUserId}`);
      if (!res.ok) {
        // Trước đây lỗi bị nuốt im lặng nên màn hình vẫn giữ nguyên dữ liệu của
        // ngày trước đó — nhìn như "không mở được ngày này". Giờ dọn form và
        // báo rõ lý do.
        const msg = await res.json().catch(() => null);
        setLoadError(msg?.error ?? "Không tải được check-list của ngày này");
        setPosition(""); setTargetNote(""); setTotalTarget("");
        setDailyResults(""); setRows([]); setTotalActual(0);
        setCheckedOutAt(null);
        setFmRating(null); setFmComment(""); setFmReviewedAt(null); setFmReviewerName(null);
        setIsDirty(false);
        return;
      }
      const data = (await res.json()) as ChecklistData;
      setTotalActual(data.totalActual);

      // Chốt ngày và đánh giá KHÔNG bao giờ lấy từ bản nháp trong máy: cả hai
      // đều do máy chủ quyết, bản nháp chỉ giữ phần người dùng đang gõ dở.
      const cl = data.checklist;
      setCheckedOutAt(cl?.checkedOutAt ?? null);
      setFmRating(cl?.fmRating ?? null);
      setFmComment(cl?.fmComment ?? "");
      setFmReviewedAt(cl?.fmReviewedAt ?? null);
      setFmReviewerName(cl?.fmReviewer?.name ?? cl?.fmReviewer?.email ?? null);
      setSaveState("idle");
      setSavedAt(null);

      type ChecklistDraft = {
        position: string; targetNote: string; totalTarget: string;
        rows: Row[]; dailyResults: string;
      };
      // Only restore draft for own checklist (not team-view)
      const isOwn = selectedUserId === currentUserId;
      const draft = isOwn
        ? loadDraft<ChecklistDraft>(`ladysfit_draft_checklist_${currentUserId}_${date}`)
        : null;

      const dbRows = data.checklist
        ? data.checklist.items.map((item) => ({
            id: item.id as string | undefined,
            order: item.order as number,
            time: (item.time as string) ?? "",
            task: (item.task as string) ?? "",
            kpi: (item.kpi as string) ?? "",
            actualResult: item.actualResult != null ? Number(item.actualResult) : 0,
            note: (item.note as string) ?? "",
            isTeaching: Boolean(item.isTeachingSession),
          }))
        : [];
      if (draft) {
        setPosition(draft.position ?? "");
        setTargetNote(draft.targetNote ?? "");
        setTotalTarget(draft.totalTarget ?? "");
        setDailyResults(draft.dailyResults ?? "");
        setRows(draft.rows ?? dbRows);
      } else if (data.checklist) {
        setPosition(data.checklist.position ?? "");
        setTargetNote(data.checklist.targetNote ?? "");
        setTotalTarget(data.checklist.totalTarget != null ? String(data.checklist.totalTarget) : "");
        setDailyResults(mergeLegacyReflection(data.checklist));
        setRows(dbRows);
      } else {
        setPosition(""); setTargetNote(""); setTotalTarget("");
        setDailyResults("");
        setRows([]);
      }
      setIsDirty(false);
      loadedKeyRef.current = `${selectedUserId}|${date}`;
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
            isTeaching: Boolean(item.isTeachingSession),
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

  // ── fetch team overview (FM/Admin) ─────────────────────────────────────────
  const openOverview = useCallback(async () => {
    setOverviewOpen(true);
    setOverviewLoading(true);
    setOverviewStaff([]);
    try {
      const res = await fetch(`/api/checklist/overview?date=${date}`);
      if (!res.ok) return;
      const data = (await res.json()) as { staff: OverviewStaff[] };
      setOverviewStaff(data.staff ?? []);
    } finally {
      setOverviewLoading(false);
    }
  }, [date]);

  function openImportModal() {
    const d = defaultImportDate(ownDate);
    setImportDate(d);
    setImportRows([]);
    setImportHasData(false);
    setImportOpen(true);
  }

  function handleImportConfirm() {
    setIsDirty(true);
    setRows(importRows.map((r, i) => ({ ...r, id: undefined, order: i + 1 })));
    setImportOpen(false);
    setToast("Đã nhập danh sách công việc ✓");
    setTimeout(() => setToast(""), 3000);
  }

  // ── row helpers ────────────────────────────────────────────────────────────
  function addRow() {
    setIsDirty(true);
    setRows((p) => [...p, { order: p.length + 1, time: "", task: "", kpi: "", actualResult: 0, note: "", isTeaching: false }]);
  }
  function removeRow(i: number) {
    setIsDirty(true);
    setRows((p) => p.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, order: idx + 1 })));
  }
  function insertRowAfter(i: number) {
    setIsDirty(true);
    setRows((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, { order: 0, time: "", task: "", kpi: "", actualResult: 0, note: "", isTeaching: false });
      return next.map((r, idx) => ({ ...r, order: idx + 1 }));
    });
  }
  function updateRow<K extends keyof Row>(i: number, key: K, value: Row[K]) {
    setIsDirty(true);
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function handleSortRows() {
    setIsDirty(true);
    setRows((prev) => sortRowsByTime(prev));
    setToast("Đã sắp xếp theo thời gian ↑");
    setTimeout(() => setToast(""), 2000);
  }

  // ── Tự lưu lên máy chủ ─────────────────────────────────────────────────────
  //
  // Check-list KHÔNG còn nút "Lưu": mỗi lần gõ được gom lại rồi đẩy lên sau
  // AUTOSAVE_MS. Nút duy nhất ở cuối bảng là CHECK-OUT — chốt ngày làm việc và
  // báo cho FM, chứ không phải để lưu.
  //
  // Ảnh chụp dữ liệu nằm trong ref: hàm lưu được gọi từ trong setTimeout và từ
  // nút Check-out, cả hai đều phải thấy giá trị MỚI NHẤT chứ không phải giá trị
  // đóng băng lúc hàm được tạo ra.
  const payloadRef = useRef({ position, targetNote, totalTarget, dailyResults, rows });
  payloadRef.current = { position, targetNote, totalTarget, dailyResults, rows };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const dirtyRef  = useRef(false);

  /**
   * Một lượt đẩy lên máy chủ.
   *
   * `tidy` chỉ bật lúc Check-out: nó chuẩn hoá giờ rồi xếp lại bảng theo thời
   * gian NGAY TRÊN MÀN HÌNH. Tự lưu thì không được làm vậy — bảng nhảy chỗ ngay
   * dưới con trỏ trong lúc người ta đang gõ là hỏng hết.
   */
  const doSave = useCallback(async (tidy = false): Promise<boolean> => {
    // Chưa nạp xong, hoặc đang xem check-list của người khác, thì không ghi gì.
    const [loadedUserId, loadedDate] = loadedKeyRef.current.split("|");
    if (!loadedDate || loadedUserId !== currentUserId) return false;

    const snap = payloadRef.current;
    const normalized = snap.rows.map((r) => ({ ...r, time: r.time ? normalizeTime(r.time) : "" }));
    const outRows = tidy ? sortRowsByTime(normalized) : normalized;
    if (tidy) setRows(outRows);

    setSaveState("saving");
    setSaveError("");
    try {
      const res = await fetch("/api/checklist/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date:            loadedDate,
          userId:          currentUserId,
          position:        snap.position,
          targetNote:      snap.targetNote || undefined,
          totalTarget:     snap.totalTarget ? parseFloat(snap.totalTarget) : undefined,
          dailyResults:    snap.dailyResults || undefined,
          // Ba ô tự luận cũ đã gộp thành một ô duy nhất phía trên.
          dailyCompleted:  undefined,
          dailyIncomplete: undefined,
          dailyNextPlan:   undefined,
          items: outRows.map((r, i) => ({
            order: tidy ? i + 1 : r.order,
            time: r.time || undefined,
            task: r.task,
            kpi: r.kpi || undefined,
            actualResult: r.actualResult || undefined,
            note: r.note || undefined,
            isTeachingSession: r.isTeaching || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        setSaveState("error");
        setSaveError(msg?.error ?? "Không lưu được check-list");
        return false;
      }
      dirtyRef.current = false;
      clearChecklistDraft();
      setSavedAt(new Date().toISOString());
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      setSaveError("Mất kết nối — bản nháp vẫn giữ trên máy, sẽ lưu lại khi bạn gõ tiếp");
      return false;
    }
  }, [currentUserId, clearChecklistDraft]);

  /**
   * Nối đuôi lượt đang chạy thay vì bắn song song: mỗi lượt POST xoá rồi tạo
   * lại toàn bộ dòng việc, hai lượt chồng nhau có thể để lại bảng thiếu dòng.
   */
  const pushSave = useCallback((tidy = false): Promise<boolean> => {
    const run = (savingRef.current ?? Promise.resolve(true)).then(() => doSave(tidy));
    savingRef.current = run.catch(() => false);
    return run;
  }, [doSave]);

  /** Đẩy nốt những gì còn đang chờ trong hàng đợi, rồi mới làm việc tiếp theo. */
  const flushSave = useCallback((tidy = false): Promise<boolean> => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    return pushSave(tidy);
  }, [pushSave]);

  // Hẹn giờ đẩy lên sau mỗi thay đổi. Chuỗi hoá để chỉ chạy lại khi nội dung
  // thật sự khác, không phải mỗi lần React vẽ lại.
  const formSnapshot = JSON.stringify({ position, targetNote, totalTarget, dailyResults, rows });
  useEffect(() => {
    if (!canEdit || loading || !isDirty) return;
    dirtyRef.current = true;
    setSaveState("pending");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; pushSave(); }, AUTOSAVE_MS);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [formSnapshot, canEdit, loading, isDirty, pushSave]);

  // Rời trang / đổi ngày khi còn dở: đẩy nốt lần cuối. Đóng hẳn tab thì lượt
  // này có thể không kịp bay đi — bản nháp trong máy là lưới an toàn cuối cùng.
  useEffect(() => {
    function flushIfDirty() { if (dirtyRef.current) pushSave(); }
    window.addEventListener("beforeunload", flushIfDirty);
    return () => {
      window.removeEventListener("beforeunload", flushIfDirty);
      flushIfDirty();
    };
  }, [pushSave]);

  // ── Chốt ngày làm việc ─────────────────────────────────────────────────────
  async function handleCheckOut() {
    // Chốt đúng cái ngày mà form đang giữ, không phải ngày vừa bấm trên lịch —
    // cùng lý do với doSave().
    const [, loadedDate] = loadedKeyRef.current.split("|");
    if (!loadedDate) return;

    setCheckingOut(true);
    try {
      // Lưu nốt TRƯỚC khi chốt: FM được mời vào đọc ngay sau thông báo, nên
      // những gì vừa gõ phải nằm sẵn trên máy chủ.
      const saved = await flushSave(true);
      if (!saved) {
        setToast("❌ Chưa lưu được check-list, thử lại giúp mình nhé");
        setTimeout(() => setToast(""), 5000);
        return;
      }

      const res = await fetch("/api/checklist/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: loadedDate }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setToast(`❌ ${data?.error ?? "Không check-out được"}`);
        setTimeout(() => setToast(""), 5000);
        return;
      }
      setCheckedOutAt(data.checkedOutAt);
      setToast(
        data.notified > 0
          ? `Đã check-out ✓ Đã báo ${data.notified} quản lý`
          : "Đã check-out ✓"
      );
      setTimeout(() => setToast(""), 4000);
    } finally {
      setCheckingOut(false);
    }
  }

  // ── Đánh giá của FM ────────────────────────────────────────────────────────
  async function handleSaveReview() {
    setReviewSaving(true);
    try {
      const res = await fetch("/api/checklist/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          userId:  selectedUserId,
          rating:  fmRating,
          comment: fmComment,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setToast(`❌ ${data?.error ?? "Không lưu được đánh giá"}`);
        setTimeout(() => setToast(""), 5000);
        return;
      }
      setFmReviewedAt(data.fmReviewedAt);
      setFmReviewerName(data.fmReviewerName);
      setToast(data.fmReviewedAt ? "Đã lưu đánh giá ✓" : "Đã gỡ đánh giá ✓");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setReviewSaving(false);
    }
  }

  // ── progress ───────────────────────────────────────────────────────────────
  const completedTasks = rows.filter((r) => {
    const k = parseFloat(r.kpi);
    return !isNaN(k) && k > 0 && (r.actualResult / k) * 100 >= 80;
  }).length;
  const pct = rows.length > 0 ? Math.round((completedTasks / rows.length) * 100) : 0;

  // Teaching-session tally for the day (rows marked "buổi dạy": KPI = planned, T.Đạt = done).
  const teachingRows = rows.filter((r) => r.isTeaching);
  const teachingPlanned = teachingRows.reduce((s, r) => {
    const k = parseFloat(r.kpi);
    return s + (!isNaN(k) && k > 0 ? k : 1);
  }, 0);
  const teachingDone = teachingRows.reduce((s, r) => s + (r.actualResult || 0), 0);

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
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Ngày:</label>
              <MonthCalendarPicker
                value={fmSubTab === "team" ? teamDate : ownDate}
                maxDate={maxEdit}
                onChange={(v) => fmSubTab === "team" ? setTeamDate(v) : setOwnDate(v)}
              />
            </div>

            <span className={cn(
              "text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap border",
              canEdit
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-amber-50 text-amber-600 border-amber-200"
            )}>
              {canEdit
                ? isFutureDay
                  ? `✏️ Điền trước · ${fmtDate(date)}`
                  : `✏️ Của bạn · ${fmtDate(date)}`
                : fmSubTab === "own"
                  ? `👁 Xem lại · ${fmtDate(date)}`
                  : `👁 Chỉ xem · ${fmtDate(date)}`}
            </span>

            {/* Tổng quan toàn bộ nhân sự cho ngày đang chọn */}
            <button
              onClick={openOverview}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold whitespace-nowrap transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Tổng quan nhân sự</span>
            </button>
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
              onChange={(e) => { setPosition(e.target.value); setIsDirty(true); }}
              disabled={!canEdit}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="VD: PT, FM..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Ngày báo cáo</label>
            {/* Trước đây quản lý chỉ thấy ô xám tĩnh, bấm vào không ra gì — phải
                lên tận thanh công cụ phía trên mới đổi được ngày. Giờ ô này là
                lịch bấm được cho mọi vai trò. */}
            {isManager ? (
              <MonthCalendarPicker
                value={date}
                maxDate={maxEdit}
                onChange={(v) => (isTeamView ? setTeamDate(v) : setOwnDate(v))}
                className="w-full"
              />
            ) : (
              <DateInput
                value={date}
                max={maxEdit}
                onChange={(v) => setOwnDate(v)}
                className="w-full focus-within:ring-2 focus-within:ring-[#f15b5c]/30"
              />
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Target tháng (triệu)</label>
            <input
              type="number" step="0.1"
              value={totalTarget}
              onChange={(e) => { setTotalTarget(e.target.value); setIsDirty(true); }}
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
              onChange={(e) => { setTargetNote(e.target.value); setIsDirty(true); }}
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
            {teachingRows.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <Dumbbell className="w-3.5 h-3.5 text-[#f15b5c]" />
                <span className="font-semibold text-gray-500">Buổi dạy:</span>
                <span className="font-bold text-gray-700">{teachingDone}/{teachingPlanned} buổi</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Thông báo trạng thái ngày (điền trước / chỉ xem) ──────────────── */}
      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 flex items-start gap-2.5">
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <p className="text-xs text-red-700 leading-relaxed font-semibold">{loadError}</p>
        </div>
      )}
      {!isTeamView && isPastDay && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2.5">
          <span className="text-base leading-none mt-0.5">👁</span>
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-bold">Ngày {fmtDate(date)} đã qua</span> — bạn xem lại được nhưng
            không chỉnh sửa được nữa. Muốn điền thì chọn hôm nay hoặc các ngày sắp tới.
          </p>
        </div>
      )}
      {!isTeamView && isFutureDay && canEdit && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 flex items-start gap-2.5">
          <span className="text-base leading-none mt-0.5">📝</span>
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-bold">Đang điền trước cho ngày {fmtDate(date)}.</span>{" "}
            Cứ lên kế hoạch sẵn, đến ngày đó chỉ cần vào điền phần thực đạt.
          </p>
        </div>
      )}

      {/* ── Bảng công việc ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-700 whitespace-nowrap">Danh sách công việc</p>
          <div className="flex items-center flex-wrap gap-2">
            {/* Xem tổng quan — luôn hiển thị */}
            <button
              onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Xem lịch</span>
            </button>
            {canEdit && rows.some((r) => r.time) && (
              <button
                onClick={handleSortRows}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">Sắp xếp giờ</span>
                <span className="sm:hidden">↕</span>
              </button>
            )}
            {canEdit && (
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-white text-xs font-bold whitespace-nowrap"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden xs:inline">Thêm công việc</span>
                <span className="xs:hidden">Thêm</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Đang tải...</div>
        ) : (
          <div
            className="w-full overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full"
            style={{ WebkitOverflowScrolling: "touch" } as CSSProperties}
          >
            <table className="w-full table-fixed text-xs border-collapse" style={{ minWidth: 680 }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: canEdit ? 192 : 232 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 48 }} />
                <col style={{ width: 92 }} />
                {canEdit && <col style={{ width: 52 }} />}
              </colgroup>
              <thead>
                <tr className="bg-[#f5f5f5] border-b border-gray-200">
                  <th style={{ width: 40, minWidth: 40 }}   className="px-1.5 py-2.5 text-center font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">STT</th>
                  <th style={{ width: 88, minWidth: 80 }}   className="px-1.5 py-2.5 text-left  font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">Giờ</th>
                  <th style={{ width: canEdit ? 192 : 232, minWidth: 140 }} className="px-1.5 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">Công việc</th>
                  <th style={{ width: 76, minWidth: 60 }}   className="px-1.5 py-2.5 text-left  font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">KPI</th>
                  <th style={{ width: 76, minWidth: 60 }}   className="px-1.5 py-2.5 text-left  font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">T.Đạt</th>
                  <th style={{ width: 48, minWidth: 40 }}   className="px-1.5 py-2.5 text-center font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">%</th>
                  <th style={{ width: 92, minWidth: 72 }}   className="px-1.5 py-2.5 text-left  font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">Note</th>
                  {canEdit && <th style={{ width: 52, minWidth: 44 }} className="px-1 py-2.5 text-center font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="px-3 py-10 text-center text-gray-300 italic text-sm">
                      {canEdit
                        ? 'Nhấn "+ Thêm" để bắt đầu'
                        : `Không có dữ liệu cho ngày ${fmtDate(date)}`}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 divide-x divide-gray-100">
                      <td className="px-1.5 py-1.5 text-gray-400 text-center overflow-hidden">{row.order}</td>
                      <td className="px-1.5 py-1.5 overflow-hidden">
                        {canEdit ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={5}
                            placeholder="HH:MM"
                            value={row.time}
                            onChange={(e) => updateRow(i, "time", e.target.value)}
                            onBlur={() => {
                              setRows((prev) => {
                                const updated = prev.map((r, idx) =>
                                  idx === i ? { ...r, time: normalizeTime(r.time) } : r
                                );
                                return updated[i].time ? sortRowsByTime(updated) : updated;
                              });
                            }}
                            className={inputCls}
                          />
                        ) : (
                          <span className="block truncate text-gray-600">{row.time ? `⏱ ${row.time}` : "—"}</span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 overflow-hidden">
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateRow(i, "isTeaching", !row.isTeaching)}
                              title={row.isTeaching ? "Đang đánh dấu là buổi dạy — bấm để bỏ" : "Đánh dấu dòng này là buổi dạy"}
                              className={cn(
                                "flex-shrink-0 p-1 rounded-md border transition-colors",
                                row.isTeaching
                                  ? "bg-[#f15b5c] border-[#f15b5c] text-white"
                                  : "border-gray-200 text-gray-300 hover:text-gray-500 hover:border-gray-300"
                              )}
                            >
                              <Dumbbell className="w-3 h-3" />
                            </button>
                            <input value={row.task} onChange={(e) => updateRow(i, "task", e.target.value)} className={inputCls} placeholder="Tên công việc..." />
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 font-semibold text-gray-800" title={row.task}>
                            {row.isTeaching && <Dumbbell className="w-3 h-3 text-[#f15b5c] flex-shrink-0" />}
                            <span className="truncate">{row.task || "—"}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 overflow-hidden">
                        {canEdit ? (
                          <input value={row.kpi} onChange={(e) => updateRow(i, "kpi", e.target.value)} className={inputCls} placeholder="KPI..." />
                        ) : (
                          <span className="block truncate text-gray-600" title={row.kpi}>{row.kpi || "—"}</span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 overflow-hidden">
                        {canEdit ? (
                          <input
                            type="number" min="0" step="any"
                            value={row.actualResult === 0 ? "" : row.actualResult}
                            onChange={(e) => updateRow(i, "actualResult", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                            className={inputCls} placeholder="0"
                          />
                        ) : (
                          <span className="block truncate text-gray-600">{row.actualResult > 0 ? row.actualResult : "—"}</span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 text-center overflow-hidden">
                        {(() => {
                          const kpiNum = parseFloat(row.kpi);
                          const hasKpi = !isNaN(kpiNum) && kpiNum > 0;
                          if (!hasKpi) return <span className="text-gray-300 font-semibold">—</span>;
                          const pctVal = (row.actualResult / kpiNum) * 100;
                          const color = pctVal >= 100 ? "text-green-600" : pctVal >= 70 ? "text-yellow-500" : "text-red-500";
                          return <span className={cn("font-bold text-xs", color)}>{pctVal.toFixed(0)}%</span>;
                        })()}
                      </td>
                      <td className="px-1.5 py-1.5 overflow-hidden">
                        {canEdit ? (
                          <input value={row.note} onChange={(e) => updateRow(i, "note", e.target.value)} className={inputCls} placeholder="Ghi chú..." />
                        ) : (
                          <span className="block truncate text-gray-500" title={row.note}>{row.note || "—"}</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-1 py-1.5 text-center overflow-hidden">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => insertRowAfter(i)}
                              className="p-0.5 text-gray-300 hover:text-emerald-500 transition-colors"
                              title="Chèn dòng phía dưới"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeRow(i)}
                              className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "#f15b5c" }}>
          <p className="text-sm font-extrabold text-white tracking-wide uppercase">Tự luận cuối ngày</p>
          {checkedOutAt ? (
            <span className="text-[11px] font-bold text-white/90 flex items-center gap-1.5 whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Đã check-out {fmtTime(checkedOutAt)}
            </span>
          ) : isTeamView ? (
            <span className="text-xs text-white/80 italic flex items-center gap-1.5 whitespace-nowrap">
              <span>👁️</span> Chế độ xem
            </span>
          ) : null}
        </div>
        <div className="p-5 space-y-1.5">
          <p className="text-xs text-gray-400 leading-relaxed">
            Tổng kết <span className="font-semibold text-gray-500">việc đã hoàn thành</span>,{" "}
            <span className="font-semibold text-gray-500">việc chưa hoàn thành</span> và{" "}
            <span className="font-semibold text-gray-500">giải pháp cho ngày mai</span>.
          </p>
          <textarea
            value={dailyResults}
            onChange={(e) => { setDailyResults(e.target.value); setIsDirty(true); }}
            disabled={!canEditReflection}
            rows={6}
            placeholder={canEditReflection ? "Tổng kết việc đã hoàn thành, việc chưa hoàn thành và giải pháp cho ngày mai..." : ""}
            className={cn(
              "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-y",
              canEditReflection
                ? "border-gray-200 bg-white"
                : "border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed"
            )}
          />
        </div>
      </div>

      {/* ── Đánh giá của FM ───────────────────────────────────────────────── */}
      {/* Nhân sự cũng THẤY đánh giá của mình — nhưng chỉ khi đã có, để những
          ngày chưa chấm không hiện ra một thẻ trống. Đánh giá mà người được
          đánh giá không đọc được thì không còn là phản hồi. */}
      {(isTeamView || !!fmReviewedAt) && <FMReviewCard
        canReview={canReview}
        checkedOutAt={checkedOutAt}
        rating={fmRating}
        comment={fmComment}
        reviewedAt={fmReviewedAt}
        reviewerName={fmReviewerName}
        saving={reviewSaving}
        onRating={setFmRating}
        onComment={setFmComment}
        onSave={handleSaveReview}
      />}

      {/* ── Tự lưu + Chốt ngày ────────────────────────────────────────────── */}
      {canEdit && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <SaveStatus state={saveState} savedAt={savedAt} error={saveError} />

          <div className="flex items-center gap-3 sm:ml-auto">
            <button
              onClick={openImportModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors bg-white"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Nhập từ ngày khác</span>
              <span className="sm:hidden">Nhập</span>
            </button>

            {/* Nút cuối bảng KHÔNG còn là "Lưu" — bảng tự lưu rồi. Bấm đây là
                chốt ngày làm việc và mời FM vào đọc. */}
            <button
              onClick={handleCheckOut}
              disabled={checkingOut || !canCheckOut}
              title={
                checkedOutAt ? "Ngày này đã chốt rồi"
                  : !canCheckOut ? "Chỉ check-out được cho hôm nay hoặc hôm qua"
                  : undefined
              }
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors",
                checkedOutAt
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default"
                  : "text-white disabled:opacity-60"
              )}
              style={checkedOutAt ? undefined : { backgroundColor: "#f15b5c" }}
            >
              {checkedOutAt ? <CheckCircle2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
              {checkedOutAt
                ? `Đã check-out ${fmtTime(checkedOutAt)}`
                : checkingOut ? "Đang chốt ngày..." : "Check-out"}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Tổng quan toàn bộ check-list nhân sự ───────────────────── */}
      {overviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 py-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOverviewOpen(false); }}
        >
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-sm font-extrabold text-gray-800">Tổng quan check-list nhân sự</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Toàn bộ nhân sự · {fmtDate(date)}</p>
              </div>
              <button
                onClick={() => setOverviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-xl hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary strip */}
            {!overviewLoading && overviewStaff.length > 0 && (
              <div className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex-shrink-0 text-xs">
                <span className="text-gray-500">
                  <span className="font-bold text-emerald-600">{overviewStaff.filter((s) => s.filled).length}</span> đã làm
                </span>
                <span className="text-gray-500">
                  <span className="font-bold text-amber-500">{overviewStaff.filter((s) => !s.filled).length}</span> chưa làm
                </span>
                <span className="text-gray-400 ml-auto">{overviewStaff.length} nhân sự</span>
              </div>
            )}

            {/* Body */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full"
              style={{ WebkitOverflowScrolling: "touch" } as CSSProperties}
            >
              {overviewLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-[#f15b5c]/30 border-t-[#f15b5c] animate-spin" />
                  <p className="text-xs text-gray-400">Đang tải tổng quan...</p>
                </div>
              ) : overviewStaff.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <span className="text-3xl">📋</span>
                  <p className="text-sm text-gray-400">Không có nhân sự nào</p>
                </div>
              ) : (
                overviewStaff.map((s) => {
                  const rateColor = s.taskRate >= 80 ? "bg-green-500" : s.taskRate >= 50 ? "bg-yellow-400" : "bg-[#f15b5c]";
                  const isMe = s.userId === currentUserId;
                  return (
                    <div
                      key={s.userId}
                      className={cn(
                        "rounded-xl border p-3.5",
                        s.filled ? "border-gray-200 bg-white" : "border-amber-100 bg-amber-50/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-800 truncate">{s.name}</span>
                            <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{s.role}</span>
                            {s.branchName && (
                              <span className="text-[10px] text-gray-400">· {s.branchName}</span>
                            )}
                            {isMe && (
                              <span className="text-[10px] font-semibold text-[#f15b5c] bg-[#f15b5c]/10 px-1.5 py-0.5 rounded-full">Bạn</span>
                            )}
                          </div>
                          {s.filled && s.targetNote && (
                            <p className="text-[11px] text-gray-400 mt-1 truncate">🎯 {s.targetNote}</p>
                          )}
                        </div>
                        {/* "Đã làm" chỉ nói có điền; "Đã check-out" mới là đã
                            chốt ngày và mời FM vào đọc — hai chuyện khác nhau. */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {s.checkedOut ? (
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                              🏁 Check-out{s.checkedOutAt ? ` ${fmtTime(s.checkedOutAt)}` : ""}
                            </span>
                          ) : s.filled ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                              Đã làm
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                              Chưa làm
                            </span>
                          )}
                          {s.reviewed && (
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5 whitespace-nowrap">
                              <Star className="w-2.5 h-2.5" fill="currentColor" />
                              {s.fmRating != null ? `${s.fmRating}/${MAX_RATING}` : "Đã đánh giá"}
                            </span>
                          )}
                        </div>
                      </div>

                      {s.filled && (
                        <>
                          {/* Progress */}
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-gray-400">Tiến độ công việc</span>
                              <span className="text-[11px] font-bold text-gray-600">
                                {s.tasksCompleted}/{s.tasksTotal} · {s.taskRate}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", rateColor)} style={{ width: `${s.taskRate}%` }} />
                            </div>
                          </div>

                          {s.teachingSetup > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                              <Dumbbell className="w-3.5 h-3.5 text-[#f15b5c]" />
                              <span className="font-semibold text-gray-400">Buổi dạy:</span>
                              <span className="font-bold text-gray-600">{s.teachingDone}/{s.teachingSetup} buổi</span>
                            </div>
                          )}

                          {s.reflection ? (
                            <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tự luận cuối ngày</p>
                              <p className="text-[12px] text-gray-600 whitespace-pre-wrap leading-relaxed">{s.reflection}</p>
                            </div>
                          ) : (
                            <p className="mt-2.5 pt-2.5 border-t border-gray-100 text-[11px] text-gray-300 italic">Chưa viết tự luận cuối ngày</p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
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
              data-cal-scroll
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
                <p className="text-[11px] text-gray-400 mt-0.5">Chọn một ngày đã làm để xem trước và nhập lại danh sách công việc</p>
              </div>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Chọn ngày:</label>
                <DateInput
                  value={importDate}
                  max={today}
                  onChange={(v) => setImportDate(v)}
                  className="flex-1"
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
