"use client";

/**
 * Lịch nghỉ — lịch tháng kiểu Google Calendar, bấm vào ngày nào là nghỉ ngày đó.
 *
 * Số ngày nghỉ trong tháng được trừ thẳng vào ngày công thực tế của bảng lương
 * tháng đó (xem lib/leave-days.ts). Chủ nhật không tích được vì ngày công chuẩn
 * đã trừ sẵn Chủ nhật.
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

type Staff = { id: string; name: string | null; email: string; role: string };

type Props = {
  currentUserId:   string;
  currentUserRole: string;
  staffList:       Staff[];
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const ROLE_BADGE: Record<string, string> = {
  PT:    "bg-blue-100 text-blue-600",
  FM:    "bg-purple-100 text-purple-600",
  ADMIN: "bg-orange-100 text-orange-600",
};

/** Số ô trống trước ngày 1 khi tuần bắt đầu từ Thứ 2. */
function leadingBlanks(month: number, year: number) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

/** Chủ nhật — không tính công nên không tích nghỉ được. */
function isSunday(day: number, month: number, year: number) {
  return new Date(year, month - 1, day).getDay() === 0;
}

export function LeaveCalendarPage({ currentUserId, currentUserRole, staffList }: Props) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear]   = useState(today.getFullYear());
  const [userId, setUserId] = useState(
    staffList.some(s => s.id === currentUserId) ? currentUserId : (staffList[0]?.id ?? currentUserId),
  );

  const [leaveDays, setLeaveDays] = useState<Set<number>>(new Set());
  const [standard, setStandard]   = useState(0);
  const [loading, setLoading]     = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [toast, setToast]         = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const fetchLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave?userId=${userId}&month=${month}&year=${year}`);
      if (!res.ok) { setLeaveDays(new Set()); return; }
      const data = await res.json() as { days: number[]; standardWorkDays: number };
      setLeaveDays(new Set(data.days));
      setStandard(data.standardWorkDays);
    } finally { setLoading(false); }
  }, [userId, month, year]);

  useEffect(() => { fetchLeave(); }, [fetchLeave]);

  async function toggleDay(day: number) {
    if (isSunday(day, month, year) || savingDay !== null) return;

    // Tô màu ngay rồi mới gọi API; lỗi thì trả lại trạng thái cũ.
    const before = new Set(leaveDays);
    const next   = new Set(leaveDays);
    if (next.has(day)) next.delete(day); else next.add(day);
    setLeaveDays(next);
    setSavingDay(day);

    try {
      const res = await fetch("/api/leave", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, day, month, year }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setLeaveDays(before);
        showToast("Lỗi: " + (err.error ?? `HTTP ${res.status}`));
        return;
      }
      const data = await res.json() as { days: number[]; standardWorkDays: number };
      setLeaveDays(new Set(data.days));
      setStandard(data.standardWorkDays);
    } catch {
      setLeaveDays(before);
      showToast("Không lưu được, thử lại nhé");
    } finally { setSavingDay(null); }
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  }

  function goToday() {
    const now = new Date();
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
  }

  const total   = daysInMonth(month, year);
  const blanks  = leadingBlanks(month, year);
  // Chủ nhật đã nằm ngoài ngày công chuẩn nên không tính vào số ngày nghỉ.
  const countedLeave = Array.from(leaveDays).filter(d => !isSunday(d, month, year)).length;
  const actualDays   = Math.max(0, standard - countedLeave);

  const selectedStaff = staffList.find(s => s.id === userId);
  const isSelf        = userId === currentUserId;
  const canPickStaff  = staffList.length > 1;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f15b5c]/10 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-[#f15b5c]" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-800">Lịch nghỉ</h1>
          <p className="text-xs text-gray-400 font-medium">
            Bấm vào ngày để tích nghỉ — số ngày nghỉ tự trừ vào ngày công của bảng lương tháng đó.
          </p>
        </div>
      </div>

      {/* Thanh chọn nhân sự + tháng */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          {canPickStaff && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Nhân sự:</label>
              <select value={userId} onChange={e => setUserId(e.target.value)}
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30">
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {(s.name ?? s.email) + (s.id === currentUserId ? " (bạn)" : "")}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => shiftMonth(-1)}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="px-3 text-sm font-extrabold text-gray-700 whitespace-nowrap min-w-[130px] text-center">
              Tháng {month}, {year}
            </p>
            <button onClick={() => shiftMonth(1)}
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={goToday}
              className="ml-2 h-9 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Hôm nay
            </button>
          </div>
        </div>

        {selectedStaff && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", ROLE_BADGE[selectedStaff.role] ?? "bg-gray-100 text-gray-500")}>
              {selectedStaff.role === "ADMIN" ? "Admin" : selectedStaff.role}
            </span>
            <p className="text-sm font-semibold text-gray-700">{selectedStaff.name ?? selectedStaff.email}</p>
            {!isSelf && <span className="text-[10px] text-gray-400">— bạn đang sửa lịch hộ</span>}
          </div>
        )}
      </div>

      {/* Tổng kết ngày công */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Ngày công chuẩn",   value: `${standard} ngày`,     color: "text-gray-700" },
          { label: "Số ngày nghỉ",      value: `${countedLeave} ngày`, color: countedLeave > 0 ? "text-orange-500" : "text-gray-700" },
          { label: "Ngày công thực tế", value: `${actualDays} ngày`,   color: "text-[#f15b5c]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
            <p className={cn("text-lg font-extrabold", color)}>{loading ? "…" : value}</p>
          </div>
        ))}
      </div>

      {/* Lịch tháng */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-[#f5f5f5] border-b border-gray-200">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn(
              "px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide border-r border-gray-200 last:border-r-0",
              i === 6 ? "text-gray-300" : "text-gray-400",
            )}>
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: blanks }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[84px] sm:min-h-[104px] border-r border-b border-gray-100 bg-gray-50/40 last:border-r-0" />
          ))}

          {Array.from({ length: total }, (_, i) => i + 1).map(day => {
            const sunday  = isSunday(day, month, year);
            const off     = leaveDays.has(day);
            const isToday =
              day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                disabled={sunday || loading}
                className={cn(
                  "min-h-[84px] sm:min-h-[104px] p-2 flex flex-col items-start gap-1.5 text-left",
                  "border-r border-b border-gray-100 transition-colors",
                  sunday
                    ? "bg-gray-50/60 cursor-not-allowed"
                    : off
                      ? "bg-[#f15b5c]/10 hover:bg-[#f15b5c]/15"
                      : "bg-white hover:bg-gray-50",
                  savingDay === day && "opacity-60",
                )}
              >
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                  isToday
                    ? "bg-[#f15b5c] text-white"
                    : sunday
                      ? "text-gray-300"
                      : off
                        ? "text-[#f15b5c]"
                        : "text-gray-600",
                )}>
                  {day}
                </span>

                {sunday ? (
                  <span className="text-[10px] text-gray-300 font-medium">Chủ nhật</span>
                ) : off ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#f15b5c] text-white text-[10px] font-bold">
                    <Check className="w-3 h-3" /> Nghỉ
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
            <span className="w-3 h-3 rounded bg-[#f15b5c]" /> Ngày nghỉ
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
            <span className="w-3 h-3 rounded bg-gray-200" /> Chủ nhật — không tính ngày công
          </span>
          <span className="text-[11px] text-gray-400 italic ml-auto">
            * Ngày công chuẩn = số ngày trong tháng − số Chủ nhật.
            {currentUserRole === "PT" ? " FM vẫn có thể chỉnh lại ngày công khi chốt lương." : " Bảng lương sẽ tự trừ số ngày nghỉ này."}
          </span>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
