"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { MonthlyTarget } from "./types";

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
  return { weekStart, weekEnd };
}

export function TargetsTab({ branchId, branchName, month, year, currentUserId, currentUserRole, isReadOnly, isPT, isFM }: Props) {
  const isFitpartner = branchName.toLowerCase().includes("fitpartner");
  const KPI_KEYS = getKpiKeys(isFitpartner);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // PT: set own target
  const [targetModal, setTargetModal] = useState(false);
  const [targetForm, setTargetForm] = useState<Record<string, number>>({});

  // Weekly actuals edit (PT + FM + CEO)
  const [weeklyEdit, setWeeklyEdit] = useState<{ targetId: string; weekNumber: number } | null>(null);
  const [weeklyForm, setWeeklyForm] = useState<Record<string, number | string>>({});
  const [saving, setSaving] = useState(false);

  // Notes-only edit (FM + CEO)
  const [notesEdit, setNotesEdit] = useState<{ targetId: string; weekNumber: number } | null>(null);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const isCEO = currentUserRole === "CEO_FITPARTNER";
  const canWriteNotes = isFM || isCEO;

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

  function openTargetModal() {
    const existing = targets.find((t) => t.userId === currentUserId);
    setTargetForm({
      revenueTarget: existing?.revenueTarget ?? 0,
      fitpartnerRevenueTarget: existing?.fitpartnerRevenueTarget ?? 0,
      fitTarget: existing?.fitTarget ?? 0,
      cooperationTarget: existing?.cooperationTarget ?? 0,
      transformTarget: existing?.transformTarget ?? 0,
      googleReviewTarget: existing?.googleReviewTarget ?? 0,
      cvTarget: existing?.cvTarget ?? 0,
    });
    setTargetModal(true);
  }

  async function saveOwnTarget() {
    setSaving(true);
    try {
      await fetch("/api/setup/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ branchId, userId: currentUserId, month, year, ...targetForm }]),
      });
      setTargetModal(false);
      fetchTargets();
    } finally {
      setSaving(false);
    }
  }

  function openWeeklyEdit(targetId: string, weekNumber: number) {
    const t = targets.find((t) => t.id === targetId);
    const w = t?.weeklyActuals.find((w) => w.weekNumber === weekNumber);
    setWeeklyForm({
      revenueActual: w?.revenueActual ?? 0,
      fitpartnerRevenueActual: w?.fitpartnerRevenueActual ?? 0,
      fitActual: w?.fitActual ?? 0,
      cooperationActual: w?.cooperationActual ?? 0,
      transformActual: w?.transformActual ?? 0,
      googleReviewActual: w?.googleReviewActual ?? 0,
      cvActual: w?.cvActual ?? 0,
      weeklyTaskNotes: w?.weeklyTaskNotes ?? "",
    });
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
    setSaving(false);
    setWeeklyEdit(null);
    fetchTargets();
  }

  function openNotesEdit(targetId: string, weekNumber: number) {
    const t = targets.find((t) => t.id === targetId);
    const wa = t?.weeklyActuals.find((w) => w.weekNumber === weekNumber);
    setNotesText(wa?.weeklyTaskNotes ?? "");
    setNotesEdit({ targetId, weekNumber });
  }

  async function saveNotesOnly() {
    if (!notesEdit) return;
    setNotesSaving(true);
    const { weekStart, weekEnd } = computeWeekDates(year, month, notesEdit.weekNumber);
    await fetch("/api/setup/weekly-notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyTargetId: notesEdit.targetId,
        weekNumber: notesEdit.weekNumber,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        weeklyTaskNotes: notesText.trim() || null,
      }),
    });
    setNotesSaving(false);
    setNotesEdit(null);
    fetchTargets();
  }

  const notesModal = notesEdit && (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setNotesEdit(null)} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-base">
            Công việc phát sinh - Tuần {notesEdit.weekNumber}
          </h2>
          <button onClick={() => setNotesEdit(null)}><span className="text-gray-400 text-lg">×</span></button>
        </div>
        <div className="flex-1 p-6">
          <label className="text-sm font-semibold text-gray-700">
            Việc chưa hoàn thành - Nguyên nhân và Giải pháp
          </label>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            rows={10}
            placeholder={"VD: 1. Kênh cá nhân PT chưa ra được lead...\n2. OUTDOOR chưa có lead..."}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 mt-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          />
        </div>
        <div className="px-6 py-4 border-t flex gap-3">
          <button
            onClick={saveNotesOnly}
            disabled={notesSaving}
            className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {notesSaving ? "Đang lưu..." : "Lưu"}
          </button>
          <button onClick={() => setNotesEdit(null)} className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold">
            Hủy
          </button>
        </div>
      </div>
    </>
  );

  const weeklyModal = weeklyEdit && (
    <>
      <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setWeeklyEdit(null)} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-base">Thực đạt Tuần {weeklyEdit.weekNumber}</h2>
          <button onClick={() => setWeeklyEdit(null)}><span className="text-gray-400 text-lg">×</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {KPI_KEYS.map((k) => (
            <div key={k.key}>
              <label className="text-xs font-semibold text-gray-600">{k.label}</label>
              <input
                type="number"
                step={k.isFloat ? "0.1" : "1"}
                value={weeklyForm[k.actualKey] ?? 0}
                onChange={(e) => setWeeklyForm((f) => ({ ...f, [k.actualKey]: parseFloat(e.target.value) || 0 }))}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 mt-1"
              />
            </div>
          ))}
          {canWriteNotes && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Công việc phát sinh / Setup tuần sau</label>
              <textarea
                value={weeklyForm.weeklyTaskNotes as string ?? ""}
                onChange={(e) => setWeeklyForm((f) => ({ ...f, weeklyTaskNotes: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-gray-50 mt-1 resize-none"
              />
            </div>
          )}
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

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>;

  // ─── PT VIEW ───
  if (isPT) {
    const myTarget = targets.find((t) => t.userId === currentUserId) ?? null;

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-500">Tháng {month}/{year}</p>
          <button
            onClick={openTargetModal}
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase whitespace-nowrap">Chỉ số</th>
                    <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">MT Tháng</th>
                    {WEEKS.map((w) => (
                      <th key={w} className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">
                        T{w} Đạt
                        <button onClick={() => openWeeklyEdit(myTarget.id, w)} className="ml-1 text-[#f15b5c] opacity-60 hover:opacity-100">✎</button>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">Tháng Đạt</th>
                    <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">%</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI_KEYS.map((k) => {
                    const monthTarget = myTarget[k.targetKey as keyof MonthlyTarget] as number;
                    const weekActuals = WEEKS.map((w) => {
                      const wa = myTarget.weeklyActuals.find((a) => a.weekNumber === w);
                      return (wa?.[k.actualKey as keyof typeof wa] as number) ?? 0;
                    });
                    const monthActual = weekActuals.reduce((s, v) => s + v, 0);
                    const achievement = monthTarget > 0 ? Math.round((monthActual / monthTarget) * 100) : 0;
                    return (
                      <tr key={k.key} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">{k.label}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{monthTarget}</td>
                        {weekActuals.map((v, i) => (
                          <td key={i} className="px-3 py-2 text-center text-gray-700">{k.isFloat ? v.toFixed(1) : v}</td>
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
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PT target-setting modal */}
        {targetModal && (
          <>
            <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setTargetModal(false)} />
            <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="font-bold text-base">
                  {myTarget ? "Chỉnh sửa" : "Đặt"} mục tiêu tháng {month}/{year}
                </h2>
                <button onClick={() => setTargetModal(false)}><span className="text-gray-400 text-lg">×</span></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {KPI_KEYS.map((k) => (
                  <div key={k.key}>
                    <label className="text-sm font-semibold text-gray-700">{k.label}</label>
                    <input
                      type="number"
                      step={k.isFloat ? "0.1" : "1"}
                      value={targetForm[k.targetKey] ?? 0}
                      onChange={(e) => setTargetForm((f) => ({ ...f, [k.targetKey]: parseFloat(e.target.value) || 0 }))}
                      className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 mt-1.5"
                    />
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t flex gap-3">
                <button
                  onClick={saveOwnTarget}
                  disabled={saving}
                  className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  {saving ? "Đang lưu..." : "Lưu mục tiêu"}
                </button>
                <button onClick={() => setTargetModal(false)} className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold">Hủy</button>
              </div>
            </div>
          </>
        )}

        {weeklyModal}
        {notesModal}
      </div>
    );
  }

  // ─── FM / CEO / ADMIN VIEW ───
  if (targets.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-300">Chưa có PT nào đặt mục tiêu tháng này</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary table: all PTs + total row */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Tổng hợp mục tiêu & thực đạt tháng {month}/{year}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase whitespace-nowrap">PT</th>
                {KPI_KEYS.map((k) => (
                  <Fragment key={k.key}>
                    <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">{k.shortLabel} MT</th>
                    <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">{k.shortLabel} ĐẠT</th>
                    <th className="px-2 py-2.5 text-center font-bold text-gray-400 uppercase">%</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                  <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">
                    {t.user.name ?? t.user.email}
                  </td>
                  {KPI_KEYS.map((k) => {
                    const mt = t[k.targetKey as keyof MonthlyTarget] as number;
                    const at = t.weeklyActuals.reduce((s, w) => s + ((w[k.actualKey as keyof typeof w] as number) ?? 0), 0);
                    const pct = mt > 0 ? Math.round((at / mt) * 100) : 0;
                    return (
                      <Fragment key={k.key}>
                        <td className="px-2 py-2.5 text-center text-gray-500">{k.isFloat ? mt.toFixed(1) : mt}</td>
                        <td className="px-2 py-2.5 text-center font-semibold text-gray-800">{k.isFloat ? at.toFixed(1) : at}</td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-bold", pctColor(pct))}>{pct}%</span>
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-gray-50 border-t-2 border-gray-100">
                <td className="px-4 py-2.5 font-extrabold text-gray-900">Tổng</td>
                {KPI_KEYS.map((k) => {
                  const totalMT = targets.reduce((s, t) => s + ((t[k.targetKey as keyof MonthlyTarget] as number) ?? 0), 0);
                  const totalAT = targets.reduce((s, t) =>
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
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-PT weekly breakdown (always shown; ✎ only for FM/CEO) */}
      {targets.map((t) => (
        <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-extrabold text-gray-800">{t.user.name ?? t.user.email}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase whitespace-nowrap">Chỉ số</th>
                  <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">MT Tháng</th>
                  {WEEKS.map((w) => (
                    <th key={w} className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">
                      T{w} Đạt
                      {!isReadOnly && (
                        <button
                          onClick={() => openWeeklyEdit(t.id, w)}
                          className="ml-1 text-[#f15b5c] opacity-60 hover:opacity-100"
                        >✎</button>
                      )}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">Tháng Đạt</th>
                  <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {KPI_KEYS.map((k) => {
                  const monthTarget = t[k.targetKey as keyof MonthlyTarget] as number;
                  const weekActuals = WEEKS.map((w) => {
                    const wa = t.weeklyActuals.find((a) => a.weekNumber === w);
                    return (wa?.[k.actualKey as keyof typeof wa] as number) ?? 0;
                  });
                  const monthActual = weekActuals.reduce((s, v) => s + v, 0);
                  const achievement = monthTarget > 0 ? Math.round((monthActual / monthTarget) * 100) : 0;
                  return (
                    <tr key={k.key} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 font-semibold text-gray-700 whitespace-nowrap">{k.label}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{monthTarget}</td>
                      {weekActuals.map((v, i) => (
                        <td key={i} className="px-3 py-2 text-center text-gray-700">{k.isFloat ? v.toFixed(1) : v}</td>
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
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100 bg-gray-50/50">
                  <td className="px-4 py-1.5 text-xs font-semibold text-gray-400 whitespace-nowrap">Ghi chú tuần</td>
                  <td />
                  {WEEKS.map((w) => {
                    const wa = t.weeklyActuals.find((a) => a.weekNumber === w);
                    const note = wa?.weeklyTaskNotes;
                    return (
                      <td key={w} className="px-3 py-1.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {note && (
                            <p className="text-[10px] text-gray-500 leading-tight max-w-[70px] truncate" title={note}>
                              {note}
                            </p>
                          )}
                          {canWriteNotes && (
                            <button
                              onClick={() => openNotesEdit(t.id, w)}
                              className="text-[10px] text-[#f15b5c] opacity-70 hover:opacity-100 whitespace-nowrap"
                            >
                              {note ? "✎ Sửa" : "+ Ghi chú"}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      {weeklyModal}
      {notesModal}
    </div>
  );
}
