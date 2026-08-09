"use client";

/**
 * Lịch nghỉ — lịch tháng kiểu Google Calendar, bấm vào ngày nào để đánh dấu nghỉ
 * ngày đó và chọn loại nghỉ:
 *   • Nghỉ phép năm — vẫn hưởng đủ lương, tối đa 12 ngày/năm (mỗi tháng làm việc
 *     1 ngày), một đợt liên tiếp tối đa 5 ngày, không dùng hết thì mất khi hết năm.
 *   • Nghỉ thường — bị trừ 1 ngày công thực tế của bảng lương tháng đó.
 *   • Nghỉ nửa ngày — chỉ bị trừ 0,5 ngày công thực tế.
 *
 * Chủ nhật không tích được vì ngày công chuẩn đã trừ sẵn Chủ nhật.
 * Xem lib/leave-days.ts cho toàn bộ quy tắc phía server.
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, X, Umbrella, Ban, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDays } from "@/lib/work-days";

type LeaveType = "ANNUAL" | "UNPAID" | "HALF_DAY";

type Staff = {
  id:    string;
  name:  string | null;
  email: string;
  role:  string;
  /** Cơ sở của nhân sự — FM thuộc tất cả cơ sở mình quản lý. */
  branchIds: string[];
};

type Branch = { id: string; name: string };

type Props = {
  currentUserId:   string;
  currentUserRole: string;
  staffList:       Staff[];
  /** Cơ sở người đang đăng nhập được xem; từ 2 cơ sở trở lên mới hiện bộ lọc. */
  branches:        Branch[];
};

/** Trạng thái lịch nghỉ một tháng, khớp response của /api/leave. */
type MonthState = {
  days:             { day: number; type: LeaveType }[];
  unpaidCount:      number;
  halfDayCount:     number;
  /** Tổng ngày công bị trừ: nghỉ thường 1, nghỉ nửa ngày 0,5 — có thể lẻ .5. */
  deductedDays:     number;
  annualQuota:      number;
  annualUsed:       number;
  annualRemaining:  number;
  standardWorkDays: number;
  actualWorkDays:   number;
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const ROLE_BADGE: Record<string, string> = {
  PT:    "bg-blue-100 text-blue-600",
  FM:    "bg-purple-100 text-purple-600",
  ADMIN: "bg-orange-100 text-orange-600",
};

const EMPTY: MonthState = {
  days: [], unpaidCount: 0, halfDayCount: 0, deductedDays: 0,
  annualQuota: 0, annualUsed: 0, annualRemaining: 0,
  standardWorkDays: 0, actualWorkDays: 0,
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

function weekdayLabel(day: number, month: number, year: number) {
  const d = new Date(year, month - 1, day).getDay();
  return d === 0 ? "Chủ nhật" : `Thứ ${d + 1}`;
}

export function LeaveCalendarPage({ currentUserId, currentUserRole, staffList, branches }: Props) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear]   = useState(today.getFullYear());
  const [userId, setUserId] = useState(
    staffList.some(s => s.id === currentUserId) ? currentUserId : (staffList[0]?.id ?? currentUserId),
  );
  // "" = tất cả cơ sở. Chỉ Admin và FM quản lý nhiều cơ sở mới thấy bộ lọc này.
  const [branchId, setBranchId] = useState("");

  const [state, setState]         = useState<MonthState>(EMPTY);
  const [loading, setLoading]     = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [toast, setToast]         = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  /** Nhân sự của một cơ sở; "" = tất cả cơ sở người đang đăng nhập được xem. */
  function staffOfBranch(bid: string) {
    return bid ? staffList.filter(s => s.branchIds.includes(bid)) : staffList;
  }

  const fetchLeave = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave?userId=${userId}&month=${month}&year=${year}`);
      setState(res.ok ? await res.json() as MonthState : EMPTY);
    } finally { setLoading(false); }
  }, [userId, month, year]);

  useEffect(() => { fetchLeave(); }, [fetchLeave]);

  /** Loại nghỉ đang tích của một ngày, `undefined` là ngày đi làm. */
  function typeOf(day: number): LeaveType | undefined {
    return state.days.find(d => d.day === day)?.type;
  }

  /**
   * Đặt loại nghỉ cho một ngày. Không tô màu trước vì server còn kiểm tra quỹ
   * phép và giới hạn 5 ngày liền — hiện đúng kết quả server trả về.
   */
  async function setDayType(day: number, type: LeaveType | "NONE") {
    if (isSunday(day, month, year) || savingDay !== null) return;
    setPickerDay(null);
    setSavingDay(day);
    try {
      const res = await fetch("/api/leave", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, day, month, year, type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast(err.error ?? `Lỗi HTTP ${res.status}`);
        return;
      }
      setState(await res.json() as MonthState);
    } catch {
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

  /** Đổi cơ sở → nếu người đang xem không thuộc cơ sở đó thì nhảy sang người đầu tiên. */
  function changeBranch(nextBranchId: string) {
    setBranchId(nextBranchId);
    const list = staffOfBranch(nextBranchId);
    if (list.length > 0 && !list.some(s => s.id === userId)) setUserId(list[0].id);
  }

  const total  = daysInMonth(month, year);
  const blanks = leadingBlanks(month, year);
  const annualThisMonth = state.days.filter(d => d.type === "ANNUAL").length;

  const selectedStaff = staffList.find(s => s.id === userId);
  const isSelf        = userId === currentUserId;
  const canPickStaff  = staffList.length > 1;
  // Từ 2 cơ sở trở lên (Admin, FM quản lý nhiều cơ sở) mới cần lọc theo cơ sở.
  const canPickBranch  = branches.length > 1;
  const visibleStaff   = canPickBranch ? staffOfBranch(branchId) : staffList;
  const selectedBranchNames = (selectedStaff?.branchIds ?? [])
    .map(id => branches.find(b => b.id === id)?.name)
    .filter(Boolean) as string[];

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
            Bấm vào ngày để chọn nghỉ phép (đủ lương), nghỉ thường (trừ 1 công) hoặc nghỉ nửa ngày (trừ 0,5 công).
          </p>
        </div>
      </div>

      {/* Thanh chọn cơ sở → nhân sự → tháng */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          {canPickBranch && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Cơ sở:</label>
              <select value={branchId} onChange={e => changeBranch(e.target.value)}
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30">
                <option value="">Tất cả cơ sở</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {canPickStaff && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Nhân sự:</label>
              {visibleStaff.length === 0 ? (
                <span className="h-9 flex items-center px-3 text-sm text-gray-400 italic">
                  Cơ sở này chưa có nhân sự
                </span>
              ) : (
                <select value={userId} onChange={e => setUserId(e.target.value)}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30">
                  {visibleStaff.map(s => (
                    <option key={s.id} value={s.id}>
                      {(s.name ?? s.email) + (s.id === currentUserId ? " (bạn)" : "")}
                    </option>
                  ))}
                </select>
              )}
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
            {selectedBranchNames.length > 0 && (
              <span className="text-[11px] text-gray-400 font-medium">· {selectedBranchNames.join(", ")}</span>
            )}
            {!isSelf && <span className="text-[10px] text-gray-400">— bạn đang sửa lịch hộ</span>}
          </div>
        )}
      </div>

      {/* Tổng kết phép năm + ngày công */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: `Phép năm ${year}`,
            value: `${state.annualUsed}/${state.annualQuota} ngày`,
            hint:  `còn ${state.annualRemaining} ngày${annualThisMonth > 0 ? ` · tháng này ${annualThisMonth}` : ""}`,
            color: state.annualRemaining > 0 ? "text-emerald-600" : "text-gray-400",
          },
          {
            label: "Nghỉ trừ công tháng này",
            value: `${formatDays(state.deductedDays)} ngày`,
            hint:  state.deductedDays > 0
              ? [
                  state.unpaidCount  > 0 ? `${state.unpaidCount} ngày thường` : "",
                  state.halfDayCount > 0 ? `${state.halfDayCount} buổi nửa ngày` : "",
                ].filter(Boolean).join(" · ")
              : "không bị trừ gì",
            color: state.deductedDays > 0 ? "text-[#f15b5c]" : "text-gray-700",
          },
          {
            label: "Ngày công chuẩn",
            value: `${state.standardWorkDays} ngày`,
            hint:  `tháng ${month} − số Chủ nhật`,
            color: "text-gray-700",
          },
          {
            label: "Ngày công thực tế",
            value: `${formatDays(state.actualWorkDays)} ngày`,
            hint:  "phép năm vẫn tính đủ công",
            color: "text-gray-800",
          },
        ].map(({ label, value, hint, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
            <p className={cn("text-lg font-extrabold", color)}>{loading ? "…" : value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>
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
            const type    = typeOf(day);
            const isToday =
              day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

            return (
              <button
                key={day}
                type="button"
                onClick={() => setPickerDay(day)}
                disabled={sunday || loading}
                className={cn(
                  "min-h-[84px] sm:min-h-[104px] p-2 flex flex-col items-start gap-1.5 text-left",
                  "border-r border-b border-gray-100 transition-colors",
                  sunday
                    ? "bg-gray-50/60 cursor-not-allowed"
                    : type === "ANNUAL"
                      ? "bg-emerald-50 hover:bg-emerald-100/70"
                      : type === "UNPAID"
                        ? "bg-[#f15b5c]/10 hover:bg-[#f15b5c]/15"
                        : type === "HALF_DAY"
                          ? "bg-amber-50 hover:bg-amber-100/70"
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
                      : type === "ANNUAL"
                        ? "text-emerald-600"
                        : type === "UNPAID"
                          ? "text-[#f15b5c]"
                          : type === "HALF_DAY"
                            ? "text-amber-600"
                            : "text-gray-600",
                )}>
                  {day}
                </span>

                {sunday ? (
                  <span className="text-[10px] text-gray-300 font-medium">Chủ nhật</span>
                ) : type === "ANNUAL" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">
                    <Umbrella className="w-3 h-3" /> Phép
                  </span>
                ) : type === "UNPAID" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#f15b5c] text-white text-[10px] font-bold">
                    <Check className="w-3 h-3" /> Nghỉ
                  </span>
                ) : type === "HALF_DAY" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold">
                    <Clock className="w-3 h-3" /> Nửa ngày
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
            <span className="w-3 h-3 rounded bg-emerald-500" /> Nghỉ phép — đủ lương
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
            <span className="w-3 h-3 rounded bg-[#f15b5c]" /> Nghỉ thường — trừ 1 ngày công
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
            <span className="w-3 h-3 rounded bg-amber-500" /> Nghỉ nửa ngày — trừ 0,5 ngày công
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
            <span className="w-3 h-3 rounded bg-gray-200" /> Chủ nhật — không tính ngày công
          </span>
        </div>
        <p className="px-5 pb-3 text-[11px] text-gray-400 italic">
          * Phép năm: mỗi tháng làm việc được 1 ngày, tối đa 12 ngày/năm, nghỉ liên tiếp
          tối đa 5 ngày, không dùng hết thì mất khi hết năm (không cộng dồn).
          {currentUserRole === "PT"
            ? " FM vẫn có thể chỉnh lại ngày công khi chốt lương."
            : " Bảng lương chỉ trừ nghỉ thường (1 công) và nghỉ nửa ngày (0,5 công)."}
        </p>
      </div>

      {/* Chọn loại nghỉ cho một ngày */}
      {pickerDay !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPickerDay(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-extrabold text-gray-800">
                  {weekdayLabel(pickerDay, month, year)}, {pickerDay}/{month}/{year}
                </p>
                <p className="text-[11px] text-gray-400 font-medium">
                  {selectedStaff?.name ?? selectedStaff?.email}
                </p>
              </div>
              <button onClick={() => setPickerDay(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {(() => {
                const current   = typeOf(pickerDay);
                const noQuota   = state.annualRemaining <= 0 && current !== "ANNUAL";
                return (
                  <>
                    <button
                      onClick={() => setDayType(pickerDay, "ANNUAL")}
                      disabled={noQuota}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                        current === "ANNUAL"
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:bg-gray-50",
                        noQuota && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Umbrella className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-gray-800">Nghỉ phép năm</span>
                        <span className="block text-[11px] text-gray-400">
                          {noQuota
                            ? `Hết phép năm ${year}`
                            : `Vẫn hưởng đủ lương · còn ${state.annualRemaining} ngày phép`}
                        </span>
                      </span>
                      {current === "ANNUAL" && <Check className="w-4 h-4 text-emerald-600" />}
                    </button>

                    <button
                      onClick={() => setDayType(pickerDay, "UNPAID")}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                        current === "UNPAID"
                          ? "border-[#f15b5c] bg-[#f15b5c]/10"
                          : "border-gray-200 hover:bg-gray-50",
                      )}
                    >
                      <Ban className="w-4 h-4 text-[#f15b5c] flex-shrink-0" />
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-gray-800">Nghỉ thường</span>
                        <span className="block text-[11px] text-gray-400">Trừ 1 ngày công của tháng</span>
                      </span>
                      {current === "UNPAID" && <Check className="w-4 h-4 text-[#f15b5c]" />}
                    </button>

                    <button
                      onClick={() => setDayType(pickerDay, "HALF_DAY")}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                        current === "HALF_DAY"
                          ? "border-amber-500 bg-amber-50"
                          : "border-gray-200 hover:bg-gray-50",
                      )}
                    >
                      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-gray-800">Nghỉ nửa ngày</span>
                        <span className="block text-[11px] text-gray-400">Chỉ trừ 0,5 ngày công của tháng</span>
                      </span>
                      {current === "HALF_DAY" && <Check className="w-4 h-4 text-amber-500" />}
                    </button>

                    {current && (
                      <button
                        onClick={() => setDayType(pickerDay, "NONE")}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Bỏ nghỉ ngày này
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
