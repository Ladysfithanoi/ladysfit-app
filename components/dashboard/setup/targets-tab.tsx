"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ExtraTarget, MonthlyTarget, PTUser } from "./types";

type Props = {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
  currentUserId: string;
  currentUserRole: string;
  isReadOnly: boolean;
  isPT: boolean;
  isFM: boolean;
  ptList: PTUser[];
};

const BASE_KPI_KEYS = [
  { key: "revenue", label: "Doanh số (triệu)", shortLabel: "DS", targetKey: "revenueTarget", actualKey: "revenueActual", isFloat: true },
  { key: "fit", label: "FIT (KH trải nghiệm)", shortLabel: "FIT", targetKey: "fitTarget", actualKey: "fitActual", isFloat: false },
  { key: "coop", label: "KH hợp tác", shortLabel: "KH HT", targetKey: "cooperationTarget", actualKey: "cooperationActual", isFloat: false },
  { key: "transform", label: "Transform", shortLabel: "Transf.", targetKey: "transformTarget", actualKey: "transformActual", isFloat: false },
  { key: "google", label: "Google Business", shortLabel: "Google", targetKey: "googleReviewTarget", actualKey: "googleReviewActual", isFloat: false },
  { key: "cv", label: "CV tuyển dụng", shortLabel: "CV", targetKey: "cvTarget", actualKey: "cvActual", isFloat: false },
];

const FITPARTNER_KPI = { key: "fitpartnerRevenue", label: "Doanh thu Fitpartner (triệu)", shortLabel: "FP DS", targetKey: "fitpartnerRevenueTarget", actualKey: "fitpartnerRevenueActual", isFloat: true };

function getKpiKeys(isFitpartner: boolean) {
  return isFitpartner ? [BASE_KPI_KEYS[0], FITPARTNER_KPI, ...BASE_KPI_KEYS.slice(1)] : BASE_KPI_KEYS;
}

// ── Mục tiêu phát sinh ──────────────────────────────────────────────────────
//
// Bộ KPI ở trên là MỤC TIÊU CHỦ CHỐT: cố định, tháng nào cũng có. Mục tiêu phát
// sinh là hạng mục nhân sự tự thêm cho riêng một tháng, thêm bao nhiêu cũng được.
//
// Cách tính bám đúng mục tiêu chủ chốt để bảng tổng hợp chỉ có một luật:
// "Tháng đạt" = TỔNG thực đạt các tuần, % = Tháng đạt / Mục tiêu tháng.

/** Một dòng đang sửa trong form — chưa có id nghĩa là hạng mục mới thêm. */
type ExtraRow = {
  id?: string;
  name: string;
  unit: string;
  isFloat: boolean;
  monthTarget: number;
  weekTarget: number;
  weekActual: number;
};

const EMPTY_EXTRA_ROW: ExtraRow = {
  name: "", unit: "", isFloat: false, monthTarget: 0, weekTarget: 0, weekActual: 0,
};

function extraOf(t: MonthlyTarget | null | undefined): ExtraTarget[] {
  return t?.extraTargets ?? [];
}

function extraWeekOf(g: ExtraTarget, weekNumber: number) {
  return g.weeks.find((w) => w.weekNumber === weekNumber);
}

/** Thực đạt cả tháng của một mục tiêu phát sinh = tổng thực đạt các tuần. */
function extraMonthActual(g: ExtraTarget): number {
  return g.weeks.reduce((s, w) => s + (w.actual ?? 0), 0);
}

function fmtNum(v: number, isFloat: boolean): string {
  return isFloat ? v.toFixed(1) : String(Math.round(v));
}

/**
 * Tên các mục tiêu phát sinh của cả cơ sở, không trùng — mỗi tên thành một cụm
 * cột trong bảng Tổng hợp. Mỗi người đặt hạng mục khác nhau nên bảng phải lấy
 * hợp của tất cả; ai không có hạng mục đó thì ô để trống.
 */
/** Dòng tiêu đề nhóm trong bảng chỉ số — tách Chủ chốt với Phát sinh. */
function SectionRow({ label, colSpan, tone }: { label: string; colSpan: number; tone: "core" | "extra" }) {
  return (
    <tr className={tone === "core" ? "bg-[#f15b5c]/5" : "bg-indigo-50"}>
      <td
        colSpan={colSpan}
        className={cn(
          "px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wider",
          tone === "core" ? "text-[#f15b5c]" : "text-indigo-600"
        )}
      >
        {label}
      </td>
    </tr>
  );
}

/**
 * Các dòng mục tiêu phát sinh trong bảng chi tiết theo tuần — cùng bố cục với
 * dòng mục tiêu chủ chốt ngay bên trên (MT tháng · từng tuần MT/Đạt · Tháng đạt · %).
 */
function ExtraGoalRows({ goals, weeks }: { goals: ExtraTarget[]; weeks: number[] }) {
  return (
    <>
      {goals.map((g) => {
        const monthActual = extraMonthActual(g);
        const pct = g.monthTarget > 0 ? Math.round((monthActual / g.monthTarget) * 100) : 0;
        return (
          <tr key={g.id} className="border-b border-gray-100 last:border-0 divide-x divide-gray-100 even:bg-[#fafafa]">
            <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap sticky left-0 z-10 bg-white">
              {g.name}
              {g.unit && <span className="ml-1 text-[10px] font-normal text-gray-400">({g.unit})</span>}
            </td>
            <td className="px-3 py-2 text-center text-gray-500">{fmtNum(g.monthTarget, g.isFloat)}</td>
            {weeks.map((w) => {
              const wk = extraWeekOf(g, w);
              return (
                <td key={w} className="px-3 py-2 text-center">
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] text-gray-400">{fmtNum(wk?.target ?? 0, g.isFloat)}</span>
                    <span className="font-semibold text-gray-700">{fmtNum(wk?.actual ?? 0, g.isFloat)}</span>
                  </div>
                </td>
              );
            })}
            <td className="px-3 py-2 text-center font-bold text-gray-800">{fmtNum(monthActual, g.isFloat)}</td>
            <td className="px-3 py-2 text-center">
              <span className={cn("px-2 py-0.5 rounded-full font-bold text-xs", pctColor(pct))}>{pct}%</span>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/**
 * Gộp các hạng mục phát sinh CÙNG TÊN của một người thành một con số. Người dùng
 * đặt trùng tên hai lần thì cộng lại, thay vì lặng lẽ chỉ lấy dòng đầu.
 */
function extraRollup(goals: ExtraTarget[], name: string) {
  const matched = goals.filter((g) => g.name === name);
  if (matched.length === 0) return null;
  return {
    isFloat: matched.some((g) => g.isFloat),
    target: matched.reduce((s, g) => s + g.monthTarget, 0),
    actual: matched.reduce((s, g) => s + extraMonthActual(g), 0),
  };
}

function extraNamesOf(targets: MonthlyTarget[]): string[] {
  const names: string[] = [];
  for (const t of targets) {
    for (const g of extraOf(t)) {
      if (!names.includes(g.name)) names.push(g.name);
    }
  }
  return names;
}

function pctColor(pct: number) {
  if (pct >= 100) return "text-emerald-600 bg-emerald-50";
  if (pct >= 70) return "text-yellow-600 bg-yellow-50";
  return "text-red-500 bg-red-50";
}

const WEEKS = [1, 2, 3, 4, 5];

function computeWeekDates(year: number, month: number, weekNumber: number) {
  const d = new Date(year, month - 1, 1);
  const dow = d.getDay() || 7;
  const firstMon = new Date(d);
  firstMon.setDate(d.getDate() - dow + 1);
  const weekStart = new Date(firstMon);
  weekStart.setDate(firstMon.getDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  // The final reporting week (5) always ends on the last calendar day of the month;
  // also clamp any earlier week that would spill past month-end (short months).
  const lastDay = new Date(year, month, 0);
  if (weekNumber === 5 || weekEnd > lastDay) {
    weekEnd.setFullYear(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
  }
  return { weekStart, weekEnd };
}

export function TargetsTab({ branchId, branchName, month, year, currentUserId, currentUserRole, isReadOnly, isPT, ptList }: Props) {
  const isFitpartner = branchName.toLowerCase().includes("fitpartner");
  const KPI_KEYS = getKpiKeys(isFitpartner);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // Target modal (unified for PT self + FM/Admin setting targets for any PT)
  const [targetModalUserId, setTargetModalUserId] = useState<string | null>(null);
  const [targetModalUserName, setTargetModalUserName] = useState<string>("");
  const [targetModalTab, setTargetModalTab] = useState<"month" | "week">("month");
  const [targetModalWeek, setTargetModalWeek] = useState(1);
  const [targetForm, setTargetForm] = useState<Record<string, number>>({});
  const [weeklyTargetForm, setWeeklyTargetForm] = useState<Record<string, number>>({});
  // Mục tiêu phát sinh đang sửa trong hộp Đặt mục tiêu — dùng chung cho cả tab
  // Tháng lẫn tab Tuần: một danh sách hạng mục, tab Tháng điền ô mục tiêu tháng,
  // tab Tuần điền ô mục tiêu tuần. Thêm hạng mục ở tab nào cũng được.
  const [extraForm, setExtraForm] = useState<ExtraRow[]>([]);
  // Mục tiêu phát sinh trong hộp nhập số liệu tuần (mục tiêu + thực đạt).
  const [weeklyExtraForm, setWeeklyExtraForm] = useState<ExtraRow[]>([]);

  // Weekly actuals edit (PT + FM + CEO)
  const [weeklyEdit, setWeeklyEdit] = useState<{ targetId: string; weekNumber: number } | null>(null);
  const [weeklyForm, setWeeklyForm] = useState<Record<string, number | string>>({});
  const [saving, setSaving] = useState(false);
  const [filterRole, setFilterRole] = useState<"all" | "ADMIN" | "FM" | "PT">("all");

  const fetchTargets = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/setup/targets?branchId=${branchId}&month=${month}&year=${year}`);
      if (res.ok) setTargets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  /** Dựng các dòng mục tiêu phát sinh của một người, kèm số của tuần đang chọn. */
  function buildExtraRows(userId: string, weekNumber: number): ExtraRow[] {
    const existing = targets.find((t) => t.userId === userId);
    return extraOf(existing).map((g) => {
      const w = extraWeekOf(g, weekNumber);
      return {
        id: g.id,
        name: g.name,
        unit: g.unit ?? "",
        isFloat: g.isFloat,
        monthTarget: g.monthTarget,
        weekTarget: w?.target ?? 0,
        weekActual: w?.actual ?? 0,
      };
    });
  }

  /** Đổi tuần trong hộp Đặt mục tiêu: nạp lại ô mục tiêu tuần của các hạng mục
   *  đã lưu, GIỮ NGUYÊN hạng mục người dùng vừa thêm mà chưa lưu. */
  function loadExtraWeek(userId: string, weekNumber: number) {
    const saved = buildExtraRows(userId, weekNumber);
    setExtraForm((rows) => [...saved, ...rows.filter((r) => !r.id)]);
  }

  function loadWeekTargets(userId: string, weekNumber: number) {
    const existing = targets.find((t) => t.userId === userId);
    const wa = existing?.weeklyActuals.find((a) => a.weekNumber === weekNumber);
    setWeeklyTargetForm({
      revenueTarget: wa?.revenueTarget ?? 0,
      fitpartnerRevenueTarget: wa?.fitpartnerRevenueTarget ?? 0,
      fitTarget: wa?.fitTarget ?? 0,
      cooperationTarget: wa?.cooperationTarget ?? 0,
      transformTarget: wa?.transformTarget ?? 0,
      googleReviewTarget: wa?.googleReviewTarget ?? 0,
      cvTarget: wa?.cvTarget ?? 0,
    });
  }

  function openTargetModal(userId: string, userName: string) {
    const existing = targets.find((t) => t.userId === userId);
    setTargetModalUserId(userId);
    setTargetModalUserName(userName);
    setTargetModalTab("month");
    setTargetModalWeek(1);
    setTargetForm({
      revenueTarget: existing?.revenueTarget ?? 0,
      fitpartnerRevenueTarget: existing?.fitpartnerRevenueTarget ?? 0,
      fitTarget: existing?.fitTarget ?? 0,
      cooperationTarget: existing?.cooperationTarget ?? 0,
      transformTarget: existing?.transformTarget ?? 0,
      googleReviewTarget: existing?.googleReviewTarget ?? 0,
      cvTarget: existing?.cvTarget ?? 0,
    });
    loadWeekTargets(userId, 1);
    setExtraForm(buildExtraRows(userId, 1));
  }

  async function saveTargetModal() {
    if (!targetModalUserId) return;
    setSaving(true);
    try {
      if (targetModalTab === "month") {
        const res = await fetch("/api/setup/targets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ branchId, userId: targetModalUserId, month, year, ...targetForm }]),
        });
        // Mục tiêu phát sinh treo vào bản ghi mục tiêu tháng, nên phải có id của
        // nó trước — lượt PUT ở trên vừa tạo (hoặc cập nhật) và trả về.
        const saved = await res.json() as Array<{ id: string }>;
        const monthlyTargetId = saved[0]?.id ?? targets.find((t) => t.userId === targetModalUserId)?.id;
        if (monthlyTargetId) {
          await saveExtraTargets(monthlyTargetId, null);
        }
      } else {
        // Ensure MonthlyTarget exists first (create with 0s if not yet set)
        let monthlyTargetId = targets.find((t) => t.userId === targetModalUserId)?.id;
        if (!monthlyTargetId) {
          const res = await fetch("/api/setup/targets", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([{
              branchId, userId: targetModalUserId, month, year,
              revenueTarget: 0, fitpartnerRevenueTarget: 0, fitTarget: 0,
              cooperationTarget: 0, transformTarget: 0, googleReviewTarget: 0, cvTarget: 0,
            }]),
          });
          const created = await res.json() as Array<{ id: string }>;
          monthlyTargetId = created[0]?.id;
        }
        if (!monthlyTargetId) return;
        const { weekStart, weekEnd } = computeWeekDates(year, month, targetModalWeek);
        await fetch("/api/setup/weekly-actual", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthlyTargetId,
            weekNumber: targetModalWeek,
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            ...weeklyTargetForm,
          }),
        });
        await saveExtraTargets(monthlyTargetId, targetModalWeek);
      }
      setTargetModalUserId(null);
      fetchTargets();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Ghi danh sách mục tiêu phát sinh. `weekNumber = null` là đang ở tab Tháng
   * (gửi mục tiêu tháng); có số tuần là đang ở tab Tuần (gửi mục tiêu tuần, giữ
   * nguyên mục tiêu tháng đã lưu).
   *
   * Luôn gửi ĐỦ danh sách — server xoá những hạng mục không còn trong mảng, đó
   * cũng chính là đường xoá một mục tiêu phát sinh.
   */
  async function saveExtraTargets(monthlyTargetId: string, weekNumber: number | null) {
    const rows = extraForm.filter((r) => r.name.trim() !== "");
    await fetch("/api/setup/extra-targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyTargetId,
        ...(weekNumber ? { weekNumber } : {}),
        goals: rows.map((r) => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          isFloat: r.isFloat,
          ...(weekNumber ? { weekTarget: r.weekTarget } : { monthTarget: r.monthTarget }),
        })),
      }),
    });
  }

  function openWeeklyEdit(targetId: string, weekNumber: number) {
    const t = targets.find((t) => t.id === targetId);
    const w = t?.weeklyActuals.find((w) => w.weekNumber === weekNumber);
    setWeeklyForm({
      // per-week targets
      revenueTarget: w?.revenueTarget ?? 0,
      fitpartnerRevenueTarget: w?.fitpartnerRevenueTarget ?? 0,
      fitTarget: w?.fitTarget ?? 0,
      cooperationTarget: w?.cooperationTarget ?? 0,
      transformTarget: w?.transformTarget ?? 0,
      googleReviewTarget: w?.googleReviewTarget ?? 0,
      cvTarget: w?.cvTarget ?? 0,
      // actuals
      revenueActual: w?.revenueActual ?? 0,
      fitpartnerRevenueActual: w?.fitpartnerRevenueActual ?? 0,
      fitActual: w?.fitActual ?? 0,
      cooperationActual: w?.cooperationActual ?? 0,
      transformActual: w?.transformActual ?? 0,
      googleReviewActual: w?.googleReviewActual ?? 0,
      cvActual: w?.cvActual ?? 0,
      weeklyTaskNotes: w?.weeklyTaskNotes ?? "",
    });
    // Mục tiêu phát sinh của tuần này — nhập cả mục tiêu lẫn thực đạt tại đây,
    // đúng như mục tiêu chủ chốt ngay bên trên.
    setWeeklyExtraForm(t ? buildExtraRows(t.userId, weekNumber) : []);
    setWeeklyEdit({ targetId, weekNumber });
  }

  async function saveWeekly() {
    if (!weeklyEdit) return;
    setSaving(true);
    const t = targets.find((t) => t.id === weeklyEdit.targetId);
    if (!t) { setSaving(false); return; }
    const wNum = weeklyEdit.weekNumber;
    const { weekStart, weekEnd } = computeWeekDates(year, month, wNum);

    await fetch("/api/setup/weekly-actual", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyTargetId: weeklyEdit.targetId,
        weekNumber: wNum,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        ...weeklyForm,
      }),
    });

    // Mục tiêu phát sinh của tuần — cùng một lượt lưu với mục tiêu chủ chốt.
    const extraRows = weeklyExtraForm.filter((r) => r.name.trim() !== "");
    await fetch("/api/setup/extra-targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyTargetId: weeklyEdit.targetId,
        weekNumber: wNum,
        goals: extraRows.map((r) => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          isFloat: r.isFloat,
          weekTarget: r.weekTarget,
          weekActual: r.weekActual,
        })),
      }),
    });

    setSaving(false);
    setWeeklyEdit(null);
    fetchTargets();
  }

  const weeklyModal = weeklyEdit && (() => {
    const { weekStart, weekEnd } = computeWeekDates(year, month, weeklyEdit.weekNumber);
    const _p = (n: number) => String(n).padStart(2, "0");
    const dateLabel = `${_p(weekStart.getDate())}/${_p(weekStart.getMonth() + 1)} - ${_p(weekEnd.getDate())}/${_p(weekEnd.getMonth() + 1)}`;
    return (
      <>
        <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setWeeklyEdit(null)} />
        <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h2 className="font-bold text-base">Tuần {weeklyEdit.weekNumber}: {dateLabel}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Mục tiêu & Thực đạt</p>
            </div>
            <button onClick={() => setWeeklyEdit(null)}><span className="text-gray-400 text-lg">×</span></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <p className="text-xs font-extrabold text-[#f15b5c] uppercase tracking-wide mb-3">
                Mục tiêu tuần — Chủ chốt
              </p>
              <div className="space-y-3">
                {KPI_KEYS.map((k) => (
                  <div key={k.key}>
                    <label className="text-xs font-semibold text-gray-600">{k.label}</label>
                    <input
                      type="number"
                      step={k.isFloat ? "0.1" : "1"}
                      value={weeklyForm[k.targetKey] ?? 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setWeeklyForm((f) => ({ ...f, [k.targetKey]: parseFloat(e.target.value) || 0 }))}
                      className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-3">
                Thực đạt — Chủ chốt
              </p>
              <div className="space-y-3">
                {KPI_KEYS.map((k) => (
                  <div key={k.key}>
                    <label className="text-xs font-semibold text-gray-600">{k.label}</label>
                    {k.actualKey === "revenueActual" ? (
                      <div className="w-full h-10 rounded-xl border border-gray-100 px-3 text-sm bg-gray-100 mt-1 flex items-center gap-2 text-gray-500">
                        <span className="font-semibold">{Number(weeklyForm[k.actualKey] ?? 0).toFixed(1)}</span>
                        <span className="text-xs text-gray-400">(tự động từ Sales Lead)</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step={k.isFloat ? "0.1" : "1"}
                        value={weeklyForm[k.actualKey] ?? 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setWeeklyForm((f) => ({ ...f, [k.actualKey]: parseFloat(e.target.value) || 0 }))}
                        className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Mục tiêu phát sinh của tuần: mục tiêu và thực đạt đi cùng dòng ── */}
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-extrabold text-indigo-600 uppercase tracking-wide">
                  Mục tiêu phát sinh
                </p>
                <button
                  type="button"
                  onClick={() => setWeeklyExtraForm((rows) => [...rows, { ...EMPTY_EXTRA_ROW }])}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                >
                  + Thêm hạng mục
                </button>
              </div>
              {weeklyExtraForm.length === 0 ? (
                <p className="text-xs text-gray-300 italic">Chưa có mục tiêu phát sinh nào cho tháng này.</p>
              ) : (
                <div className="space-y-3">
                  {weeklyExtraForm.map((row, i) => (
                    <div key={row.id ?? `new-${i}`} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={row.name}
                          placeholder="Tên hạng mục"
                          onChange={(e) => setWeeklyExtraForm((rows) =>
                            rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))}
                          className="flex-1 h-9 rounded-lg border border-gray-200 px-2.5 text-sm bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setWeeklyExtraForm((rows) => rows.filter((_, idx) => idx !== i))}
                          className="text-gray-300 hover:text-red-400 text-lg leading-none px-1"
                          title="Xoá hạng mục"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Mục tiêu tuần</label>
                          <input
                            type="number"
                            step={row.isFloat ? "0.1" : "1"}
                            value={row.weekTarget}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setWeeklyExtraForm((rows) =>
                              rows.map((r, idx) => (idx === i ? { ...r, weekTarget: parseFloat(e.target.value) || 0 } : r)))}
                            className="w-full h-9 rounded-lg border border-gray-200 px-2.5 text-sm bg-white mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Thực đạt</label>
                          <input
                            type="number"
                            step={row.isFloat ? "0.1" : "1"}
                            value={row.weekActual}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setWeeklyExtraForm((rows) =>
                              rows.map((r, idx) => (idx === i ? { ...r, weekActual: parseFloat(e.target.value) || 0 } : r)))}
                            className="w-full h-9 rounded-lg border border-gray-200 px-2.5 text-sm bg-white mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t flex gap-3">
            <button onClick={saveWeekly} disabled={saving} className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60" style={{ backgroundColor: "#f15b5c" }}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button onClick={() => setWeeklyEdit(null)} className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold">Hủy</button>
          </div>
        </div>
      </>
    );
  })();

  // ─── Unified target-setting modal (Month/Week tabs) ───
  const unifiedTargetModal = targetModalUserId !== null && (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setTargetModalUserId(null)} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-base">Đặt mục tiêu tháng {month}/{year}</h2>
            {targetModalUserName && <p className="text-xs text-gray-400 mt-0.5">{targetModalUserName}</p>}
          </div>
          <button onClick={() => setTargetModalUserId(null)}><span className="text-gray-400 text-lg">×</span></button>
        </div>
        {/* Month / Week tab switcher */}
        <div className="flex gap-1.5 px-6 pt-4">
          {(["month", "week"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTargetModalTab(tab)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-semibold border transition-all",
                targetModalTab === tab
                  ? "text-white border-transparent"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
              )}
              style={targetModalTab === tab ? { backgroundColor: "#f15b5c" } : {}}
            >
              {tab === "month" ? "Mục tiêu Tháng" : "Mục tiêu Tuần"}
            </button>
          ))}
        </div>
        {/* Week selector row */}
        {targetModalTab === "week" && (
          <div className="px-6 pt-3">
            <p className="text-xs font-semibold text-gray-400 mb-2">Chọn tuần:</p>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKS.map((w) => {
                const { weekStart: ws, weekEnd: we } = computeWeekDates(year, month, w);
                return (
                  <button
                    key={w}
                    onClick={() => {
                      setTargetModalWeek(w);
                      if (targetModalUserId) {
                        loadWeekTargets(targetModalUserId, w);
                        loadExtraWeek(targetModalUserId, w);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all leading-tight",
                      targetModalWeek === w
                        ? "text-white border-transparent"
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"
                    )}
                    style={targetModalWeek === w ? { backgroundColor: "#f15b5c" } : {}}
                  >
                    <div>Tuần {w}</div>
                    <div className="text-[9px] opacity-80">{String(ws.getDate()).padStart(2,"0")}/{String(ws.getMonth()+1).padStart(2,"0")} - {String(we.getDate()).padStart(2,"0")}/{String(we.getMonth()+1).padStart(2,"0")}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-xs font-extrabold text-[#f15b5c] uppercase tracking-wide">
            Mục tiêu chủ chốt
          </p>
          {KPI_KEYS.map((k) => (
            <div key={k.key}>
              <label className="text-sm font-semibold text-gray-700">{k.label}</label>
              {targetModalTab === "month" ? (
                <input
                  type="number"
                  step={k.isFloat ? "0.1" : "1"}
                  value={targetForm[k.targetKey] ?? 0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setTargetForm((f) => ({ ...f, [k.targetKey]: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 mt-1.5"
                />
              ) : (
                <input
                  type="number"
                  step={k.isFloat ? "0.1" : "1"}
                  value={weeklyTargetForm[k.targetKey] ?? 0}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setWeeklyTargetForm((f) => ({ ...f, [k.targetKey]: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 mt-1.5"
                />
              )}
            </div>
          ))}

          {/* ── Mục tiêu phát sinh: thêm bao nhiêu hạng mục cũng được ── */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-extrabold text-indigo-600 uppercase tracking-wide">
                Mục tiêu phát sinh
              </p>
              <button
                type="button"
                onClick={() => setExtraForm((rows) => [...rows, { ...EMPTY_EXTRA_ROW }])}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
              >
                + Thêm hạng mục
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">
              {targetModalTab === "month"
                ? "Hạng mục riêng của tháng này. Thực đạt nhập theo từng tuần, giống mục tiêu chủ chốt."
                : `Mục tiêu của tuần ${targetModalWeek} cho từng hạng mục phát sinh.`}
            </p>

            {extraForm.length === 0 ? (
              <p className="text-xs text-gray-300 italic">
                Chưa có hạng mục nào — bấm “Thêm hạng mục” để đặt mục tiêu phát sinh.
              </p>
            ) : (
              <div className="space-y-3">
                {extraForm.map((row, i) => (
                  <div key={row.id ?? `new-${i}`} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={row.name}
                        placeholder="Tên hạng mục (VD: Quay 10 video)"
                        onChange={(e) => setExtraForm((rows) =>
                          rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))}
                        className="flex-1 h-9 rounded-lg border border-gray-200 px-2.5 text-sm bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setExtraForm((rows) => rows.filter((_, idx) => idx !== i))}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none px-1"
                        title="Xoá hạng mục"
                      >
                        ×
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">
                          {targetModalTab === "month" ? "Mục tiêu tháng" : `Mục tiêu tuần ${targetModalWeek}`}
                        </label>
                        <input
                          type="number"
                          step={row.isFloat ? "0.1" : "1"}
                          value={targetModalTab === "month" ? row.monthTarget : row.weekTarget}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setExtraForm((rows) => rows.map((r, idx) => (idx === i
                              ? (targetModalTab === "month" ? { ...r, monthTarget: v } : { ...r, weekTarget: v })
                              : r)));
                          }}
                          className="w-full h-9 rounded-lg border border-gray-200 px-2.5 text-sm bg-white mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Đơn vị</label>
                        <input
                          value={row.unit}
                          placeholder="video, buổi, triệu…"
                          onChange={(e) => setExtraForm((rows) =>
                            rows.map((r, idx) => (idx === i ? { ...r, unit: e.target.value } : r)))}
                          className="w-full h-9 rounded-lg border border-gray-200 px-2.5 text-sm bg-white mt-1"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                      <input
                        type="checkbox"
                        checked={row.isFloat}
                        onChange={(e) => setExtraForm((rows) =>
                          rows.map((r, idx) => (idx === i ? { ...r, isFloat: e.target.checked } : r)))}
                      />
                      Cho phép số lẻ (tiền, giờ…)
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3">
          <button
            onClick={saveTargetModal}
            disabled={saving}
            className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
          <button onClick={() => setTargetModalUserId(null)} className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold">Hủy</button>
        </div>
      </div>
    </>
  );

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>;

  // ─── PT VIEW ───
  if (isPT) {
    const myTarget = targets.find((t) => t.userId === currentUserId) ?? null;

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-500">Tháng {month}/{year}</p>
          <button
            onClick={() => openTargetModal(currentUserId, "Mục tiêu của tôi")}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold shadow-sm"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {myTarget ? "Chỉnh sửa mục tiêu" : "Đặt mục tiêu tháng"}
          </button>
        </div>

        {!myTarget ? (
          <div className="py-12 text-center text-sm text-gray-300">Chưa đặt mục tiêu tháng này</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-[#f5f5f5] divide-x divide-gray-200">
                    <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase whitespace-nowrap sticky left-0 z-10 bg-[#f5f5f5]">Chỉ số</th>
                    <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">MT Tháng</th>
                    {WEEKS.map((w) => {
                      const { weekStart: ws, weekEnd: we } = computeWeekDates(year, month, w);
                      return (
                        <th key={w} className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">
                          <div>W{w}</div>
                          <div className="text-[9px] font-bold text-gray-400 normal-case">MT · Đạt</div>
                          <div className="text-[10px] font-normal text-gray-400 normal-case">{String(ws.getDate()).padStart(2,"0")}/{String(ws.getMonth()+1).padStart(2,"0")} - {String(we.getDate()).padStart(2,"0")}/{String(we.getMonth()+1).padStart(2,"0")}</div>
                          <button onClick={() => openWeeklyEdit(myTarget.id, w)} className="text-[#f15b5c] opacity-60 hover:opacity-100 text-[10px]">✎ sửa</button>
                        </th>
                      );
                    })}
                    <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">Tháng Đạt</th>
                    <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">%</th>
                  </tr>
                </thead>
                <tbody>
                  <SectionRow label="Mục tiêu chủ chốt" colSpan={WEEKS.length + 4} tone="core" />
                  {KPI_KEYS.map((k) => {
                    const monthTarget = myTarget[k.targetKey as keyof MonthlyTarget] as number;
                    const weekData = WEEKS.map((w) => {
                      const wa = myTarget.weeklyActuals.find((a) => a.weekNumber === w);
                      return {
                        target: (wa?.[k.targetKey as keyof typeof wa] as number) ?? 0,
                        actual: (wa?.[k.actualKey as keyof typeof wa] as number) ?? 0,
                      };
                    });
                    const monthActual = weekData.reduce((s, d) => s + d.actual, 0);
                    const achievement = monthTarget > 0 ? Math.round((monthActual / monthTarget) * 100) : 0;
                    return (
                      <tr key={k.key} className="border-b border-gray-100 last:border-0 divide-x divide-gray-100 even:bg-[#fafafa]">
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap sticky left-0 z-10 bg-white">{k.label}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{monthTarget}</td>
                        {weekData.map((d, i) => (
                          <td key={i} className="px-3 py-2 text-center">
                            <div className="flex flex-col leading-tight">
                              <span className="text-[11px] text-gray-400">{k.isFloat ? d.target.toFixed(1) : d.target}</span>
                              <span className="font-semibold text-gray-700">{k.isFloat ? d.actual.toFixed(1) : d.actual}</span>
                            </div>
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-bold text-gray-800">
                          {k.isFloat ? monthActual.toFixed(1) : monthActual}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full font-bold text-xs", pctColor(achievement))}>
                            {achievement}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {extraOf(myTarget).length > 0 && (
                    <>
                      <SectionRow label="Mục tiêu phát sinh" colSpan={WEEKS.length + 4} tone="extra" />
                      <ExtraGoalRows goals={extraOf(myTarget)} weeks={WEEKS} />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {unifiedTargetModal}
        {weeklyModal}
      </div>
    );
  }

  // ─── FM / CEO / ADMIN VIEW ───
  // Merge ptList with targets so all PTs are shown even without targets
  const EXCLUDED_ROLES = ["CEO_FITPARTNER", "COO"];
  const allPTs = ptList.length > 0
    ? ptList
    : targets.map((t) => t.user).filter((u) => !EXCLUDED_ROLES.includes(u.role));

  const filteredPTs = filterRole === "all"
    ? allPTs
    : allPTs.filter((pt) =>
        filterRole === "FM" ? pt.role === "FM"
        : filterRole === "ADMIN" ? pt.role === "ADMIN"
        : pt.role === "PT"
      );
  const filteredTargets = targets.filter((t) => filteredPTs.some((pt) => pt.id === t.userId));
  // Hợp các tên mục tiêu phát sinh của nhóm đang xem — mỗi tên thành một cụm cột
  // trong bảng Tổng hợp.
  const extraNames = extraNamesOf(filteredTargets);

  if (allPTs.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-300">Chưa có nhân sự nào trong cơ sở này</div>;
  }

  const isManagerView = currentUserRole === "ADMIN" || currentUserRole === "CEO_FITPARTNER" || currentUserRole === "COO";
  // CEO_FitPartner chỉ được XEM mục tiêu/KPI — không đặt/sửa cho nhân sự. (COO ngang quyền Admin)
  const canEditTargets = !isReadOnly && currentUserRole !== "CEO_FITPARTNER";
  const hasMultipleRoles = allPTs.some((pt) => pt.role === "FM") || allPTs.some((pt) => pt.role === "ADMIN");

  return (
    <div className="space-y-6">
      {/* Role filter pills — Admin/CEO/COO only */}
      {isManagerView && hasMultipleRoles && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">Lọc vai trò:</span>
          {(["all", "ADMIN", "FM", "PT"] as const).filter((r) =>
            r === "all" || allPTs.some((pt) => pt.role === r)
          ).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold border transition-all",
                filterRole === r
                  ? "bg-[#f15b5c] text-white border-[#f15b5c]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              {r === "all" ? "Tất cả" : r}
            </button>
          ))}
        </div>
      )}

      {/* Summary table: all PTs + total row */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Tổng hợp mục tiêu & thực đạt tháng {month}/{year}</p>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full text-xs">
            <thead>
              {/* Hàng gộp nhóm: Chủ chốt | Phát sinh */}
              <tr className="border-b border-gray-200 divide-x divide-gray-200">
                <th className="px-4 py-1.5 sticky left-0 z-10 bg-[#f5f5f5]" />
                <th
                  colSpan={KPI_KEYS.length * 3}
                  className="px-2 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#f15b5c] bg-[#f15b5c]/5"
                >
                  Mục tiêu chủ chốt
                </th>
                {extraNames.length > 0 && (
                  <th
                    colSpan={extraNames.length * 3}
                    className="px-2 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50"
                  >
                    Mục tiêu phát sinh
                  </th>
                )}
              </tr>
              <tr className="border-b border-gray-200 bg-[#f5f5f5] divide-x divide-gray-200">
                <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase whitespace-nowrap sticky left-0 z-10 bg-[#f5f5f5]">PT</th>
                {KPI_KEYS.map((k) => (
                  <Fragment key={k.key}>
                    <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">{k.shortLabel} MT</th>
                    <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">{k.shortLabel} ĐẠT</th>
                    <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase">%</th>
                  </Fragment>
                ))}
                {/* Mục tiêu phát sinh: mỗi tên hạng mục một cụm cột. Người không
                    đặt hạng mục đó thì ô để trống. */}
                {extraNames.map((name) => (
                  <Fragment key={`x-${name}`}>
                    <th className="px-2 py-2.5 text-center font-bold text-indigo-400 uppercase whitespace-nowrap">{name} MT</th>
                    <th className="px-2 py-2.5 text-center font-bold text-indigo-400 uppercase whitespace-nowrap">{name} ĐẠT</th>
                    <th className="px-2 py-2.5 text-center font-bold text-indigo-400 uppercase">%</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPTs.map((pt) => {
                const t = targets.find((tgt) => tgt.userId === pt.id) ?? null;
                return (
                  <tr key={pt.id} className="border-b border-gray-100 hover:bg-gray-50/40 divide-x divide-gray-100 even:bg-[#fafafa]">
                    <td className="px-4 py-2.5 whitespace-nowrap sticky left-0 z-10 bg-white">
                      <span className="font-semibold text-gray-800">{pt.name ?? pt.email}</span>
                      {!t && (
                        <span className="ml-2 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          Chưa đặt
                        </span>
                      )}
                    </td>
                    {KPI_KEYS.map((k) => {
                      const mt = t ? (t[k.targetKey as keyof MonthlyTarget] as number) : 0;
                      const at = t ? t.weeklyActuals.reduce((s, w) => s + ((w[k.actualKey as keyof typeof w] as number) ?? 0), 0) : 0;
                      const pct = mt > 0 ? Math.round((at / mt) * 100) : 0;
                      return (
                        <Fragment key={k.key}>
                          <td className="px-2 py-2.5 text-center text-gray-500">{t ? (k.isFloat ? mt.toFixed(1) : mt) : "—"}</td>
                          <td className="px-2 py-2.5 text-center font-semibold text-gray-800">{t ? (k.isFloat ? at.toFixed(1) : at) : "—"}</td>
                          <td className="px-2 py-2.5 text-center">
                            {t ? <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-bold", pctColor(pct))}>{pct}%</span> : <span className="text-gray-300">—</span>}
                          </td>
                        </Fragment>
                      );
                    })}
                    {extraNames.map((name) => {
                      const roll = extraRollup(extraOf(t), name);
                      if (!roll) {
                        return (
                          <Fragment key={`x-${name}`}>
                            <td className="px-2 py-2.5 text-center text-gray-300">—</td>
                            <td className="px-2 py-2.5 text-center text-gray-300">—</td>
                            <td className="px-2 py-2.5 text-center text-gray-300">—</td>
                          </Fragment>
                        );
                      }
                      const pct = roll.target > 0 ? Math.round((roll.actual / roll.target) * 100) : 0;
                      return (
                        <Fragment key={`x-${name}`}>
                          <td className="px-2 py-2.5 text-center text-gray-500">{fmtNum(roll.target, roll.isFloat)}</td>
                          <td className="px-2 py-2.5 text-center font-semibold text-gray-800">{fmtNum(roll.actual, roll.isFloat)}</td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-bold", pctColor(pct))}>{pct}%</span>
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="bg-gray-50 border-t-2 border-gray-200 divide-x divide-gray-200">
                <td className="px-4 py-2.5 font-extrabold text-gray-900 sticky left-0 z-10 bg-gray-50">Tổng</td>
                {KPI_KEYS.map((k) => {
                  const totalMT = filteredTargets.reduce((s, t) => s + ((t[k.targetKey as keyof MonthlyTarget] as number) ?? 0), 0);
                  const totalAT = filteredTargets.reduce((s, t) =>
                    s + t.weeklyActuals.reduce((ws, w) => ws + ((w[k.actualKey as keyof typeof w] as number) ?? 0), 0), 0);
                  const pct = totalMT > 0 ? Math.round((totalAT / totalMT) * 100) : 0;
                  return (
                    <Fragment key={k.key}>
                      <td className="px-2 py-2.5 text-center font-bold text-gray-600">{k.isFloat ? totalMT.toFixed(1) : totalMT}</td>
                      <td className="px-2 py-2.5 text-center font-bold text-emerald-700">{k.isFloat ? totalAT.toFixed(1) : totalAT}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-bold", pctColor(pct))}>{pct}%</span>
                      </td>
                    </Fragment>
                  );
                })}
                {extraNames.map((name) => {
                  // Cùng một tên hạng mục ở nhiều người thì cộng lại — đúng cách
                  // dòng Tổng đang làm với mục tiêu chủ chốt.
                  const rolls = filteredTargets
                    .map((t) => extraRollup(extraOf(t), name))
                    .filter((r): r is NonNullable<typeof r> => !!r);
                  const isFloat = rolls.some((r) => r.isFloat);
                  const totalMT = rolls.reduce((s, r) => s + r.target, 0);
                  const totalAT = rolls.reduce((s, r) => s + r.actual, 0);
                  const pct = totalMT > 0 ? Math.round((totalAT / totalMT) * 100) : 0;
                  return (
                    <Fragment key={`x-${name}`}>
                      <td className="px-2 py-2.5 text-center font-bold text-gray-600">{fmtNum(totalMT, isFloat)}</td>
                      <td className="px-2 py-2.5 text-center font-bold text-emerald-700">{fmtNum(totalAT, isFloat)}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-bold", pctColor(pct))}>{pct}%</span>
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-PT weekly breakdown */}
      {filteredPTs.map((pt) => {
        const t = targets.find((tgt) => tgt.userId === pt.id) ?? null;
        const ptName = pt.name ?? pt.email;

        if (!t) {
          return (
            <div key={pt.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-gray-800">{ptName}</p>
                  <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Chưa đặt mục tiêu</span>
                </div>
                {canEditTargets && (
                  <button
                    onClick={() => openTargetModal(pt.id, ptName)}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    Đặt mục tiêu
                  </button>
                )}
              </div>
              <div className="py-6 text-center text-sm text-gray-300">
                Nhân sự chưa đặt mục tiêu cho tháng {month}/{year}
              </div>
            </div>
          );
        }

        return (
        <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-extrabold text-gray-800">{ptName}</p>
            {canEditTargets && (
              <button
                onClick={() => openTargetModal(pt.id, ptName)}
                className="px-3 py-1 rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: "#f15b5c" }}
              >
                Đặt mục tiêu
              </button>
            )}
          </div>
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f5f5f5] divide-x divide-gray-200">
                  <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase whitespace-nowrap sticky left-0 z-10 bg-[#f5f5f5]">Chỉ số</th>
                  <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">MT Tháng</th>
                  {WEEKS.map((w) => {
                    const { weekStart: ws, weekEnd: we } = computeWeekDates(year, month, w);
                    return (
                      <th key={w} className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">
                        <div>W{w}</div>
                        <div className="text-[9px] font-bold text-gray-400 normal-case">MT · Đạt</div>
                        <div className="text-[10px] font-normal text-gray-400 normal-case">{String(ws.getDate()).padStart(2,"0")}/{String(ws.getMonth()+1).padStart(2,"0")} - {String(we.getDate()).padStart(2,"0")}/{String(we.getMonth()+1).padStart(2,"0")}</div>
                        {canEditTargets && (
                          <button onClick={() => openWeeklyEdit(t.id, w)} className="text-[#f15b5c] opacity-60 hover:opacity-100 text-[10px]">✎ sửa</button>
                        )}
                      </th>
                    );
                  })}
                  <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">Tháng Đạt</th>
                  <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                <SectionRow label="Mục tiêu chủ chốt" colSpan={WEEKS.length + 4} tone="core" />
                {KPI_KEYS.map((k) => {
                  const monthTarget = t[k.targetKey as keyof MonthlyTarget] as number;
                  const weekData = WEEKS.map((w) => {
                    const wa = t.weeklyActuals.find((a) => a.weekNumber === w);
                    return {
                      target: (wa?.[k.targetKey as keyof typeof wa] as number) ?? 0,
                      actual: (wa?.[k.actualKey as keyof typeof wa] as number) ?? 0,
                    };
                  });
                  const monthActual = weekData.reduce((s, d) => s + d.actual, 0);
                  const achievement = monthTarget > 0 ? Math.round((monthActual / monthTarget) * 100) : 0;
                  return (
                    <tr key={k.key} className="border-b border-gray-100 last:border-0 divide-x divide-gray-100 even:bg-[#fafafa]">
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap sticky left-0 z-10 bg-white">{k.label}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{monthTarget}</td>
                      {weekData.map((d, i) => (
                        <td key={i} className="px-3 py-2 text-center">
                          <div className="flex flex-col leading-tight">
                            <span className="text-[11px] text-gray-400">{k.isFloat ? d.target.toFixed(1) : d.target}</span>
                            <span className="font-semibold text-gray-700">{k.isFloat ? d.actual.toFixed(1) : d.actual}</span>
                          </div>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-bold text-gray-800">
                        {k.isFloat ? monthActual.toFixed(1) : monthActual}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn("px-2 py-0.5 rounded-full font-bold text-xs", pctColor(achievement))}>
                          {achievement}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {extraOf(t).length > 0 && (
                  <>
                    <SectionRow label="Mục tiêu phát sinh" colSpan={WEEKS.length + 4} tone="extra" />
                    <ExtraGoalRows goals={extraOf(t)} weeks={WEEKS} />
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}

      {weeklyModal}
      {unifiedTargetModal}
    </div>
  );
}
