"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { MonthlyTarget } from "./types";

type Props = {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
  currentUserRole: string;
  isPT: boolean;
};

const BASE_KPI_ROWS = [
  { label: "Doanh số (triệu)", targetKey: "revenueTarget", actualKey: "revenueActual", isFloat: true },
  { label: "FIT (KH trải nghiệm)", targetKey: "fitTarget", actualKey: "fitActual", isFloat: false },
  { label: "KH hợp tác", targetKey: "cooperationTarget", actualKey: "cooperationActual", isFloat: false },
  { label: "Transform", targetKey: "transformTarget", actualKey: "transformActual", isFloat: false },
  { label: "Google Business", targetKey: "googleReviewTarget", actualKey: "googleReviewActual", isFloat: false },
  { label: "CV tuyển dụng", targetKey: "cvTarget", actualKey: "cvActual", isFloat: false },
];

const FITPARTNER_KPI_ROW = { label: "Doanh thu Fitpartner (triệu)", targetKey: "fitpartnerRevenueTarget", actualKey: "fitpartnerRevenueActual", isFloat: true };

const WEEKS = [1, 2, 3, 4, 5];

function pctColor(pct: number) {
  if (pct >= 100) return "text-emerald-600 font-bold";
  if (pct >= 70) return "text-yellow-600 font-bold";
  return "text-red-500 font-bold";
}

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

export function ReportTab({ branchId, branchName, month, year, currentUserRole, isPT }: Props) {
  const isFitpartner = branchName.toLowerCase().includes("fitpartner");
  const KPI_ROWS = isFitpartner ? [BASE_KPI_ROWS[0], FITPARTNER_KPI_ROW, ...BASE_KPI_ROWS.slice(1)] : BASE_KPI_ROWS;
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes editing state (FM/CEO only)
  const [notesEdit, setNotesEdit] = useState<{ weekNumber: number } | null>(null);
  const [notesText, setNotesText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const canEditNotes = currentUserRole === "FM" || currentUserRole === "CEO_FITPARTNER";

  const fetchReport = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const url = isPT
        ? `/api/setup/targets?branchId=${branchId}&month=${month}&year=${year}`
        : `/api/setup/report?branchId=${branchId}&month=${month}&year=${year}`;
      const res = await fetch(url);
      if (res.ok) setTargets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year, isPT]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function openNotesEdit(weekNumber: number) {
    // Use existing notes from first weeklyActual found for this week (deduplicated)
    const allNotes = targets
      .flatMap((t) => t.weeklyActuals.filter((a) => a.weekNumber === weekNumber))
      .map((a) => a.weeklyTaskNotes)
      .filter(Boolean) as string[];
    const uniqueNotes = Array.from(new Set(allNotes));
    setNotesText(uniqueNotes.join("\n\n"));
    setNotesEdit({ weekNumber });
  }

  async function saveNotes() {
    if (!notesEdit || !targets.length) return;
    setNotesSaving(true);
    const w = notesEdit.weekNumber;
    const { weekStart, weekEnd } = computeWeekDates(year, month, w);

    // Update notes for ALL targets for this week (branch-level note)
    await Promise.all(
      targets.map((t) =>
        fetch("/api/setup/weekly-notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthlyTargetId: t.id,
            weekNumber: w,
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            weeklyTaskNotes: notesText.trim() || null,
          }),
        })
      )
    );
    setNotesSaving(false);
    setNotesEdit(null);
    fetchReport();
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>;
  if (targets.length === 0) return <div className="py-12 text-center text-sm text-gray-300">Chưa có dữ liệu</div>;

  // Aggregate across all PTs for the branch
  const aggregate = KPI_ROWS.map((row) => {
    const monthTarget = targets.reduce((s, t) => s + ((t[row.targetKey as keyof MonthlyTarget] as number) ?? 0), 0);
    const weekActuals = WEEKS.map((w) =>
      targets.reduce((s, t) => {
        const wa = t.weeklyActuals.find((a) => a.weekNumber === w);
        return s + ((wa?.[row.actualKey as keyof typeof wa] as number) ?? 0);
      }, 0)
    );
    const monthActual = weekActuals.reduce((s, v) => s + v, 0);
    const pct = monthTarget > 0 ? Math.round((monthActual / monthTarget) * 100) : 0;
    return { ...row, monthTarget, weekActuals, monthActual, pct };
  });

  return (
    <div className="space-y-5">
      {/* Branch aggregate table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Báo cáo tổng hợp tháng {month}/{year}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase w-8">STT</th>
                <th className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase">Công việc</th>
                {WEEKS.map((w) => (
                  <th key={w} className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">T{w} MT</th>
                ))}
                {WEEKS.map((w) => (
                  <th key={w} className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">T{w} ĐẠT</th>
                ))}
                <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">Tháng MT</th>
                <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase whitespace-nowrap">Tháng ĐẠT</th>
                <th className="px-3 py-2.5 text-center font-bold text-gray-400 uppercase">%</th>
              </tr>
            </thead>
            <tbody>
              {aggregate.map((row, idx) => {
                const weeklyTarget = row.monthTarget > 0 ? row.monthTarget / 5 : 0;
                return (
                  <tr key={row.label} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                    <td className="px-4 py-2.5 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">{row.label}</td>
                    {WEEKS.map((_, i) => (
                      <td key={i} className="px-3 py-2.5 text-center text-gray-400">
                        {row.isFloat ? weeklyTarget.toFixed(1) : Math.round(weeklyTarget)}
                      </td>
                    ))}
                    {row.weekActuals.map((v, i) => (
                      <td key={i} className="px-3 py-2.5 text-center text-gray-700">
                        {row.isFloat ? v.toFixed(1) : v}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center text-gray-500">
                      {row.isFloat ? row.monthTarget.toFixed(1) : row.monthTarget}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-gray-800">
                      {row.isFloat ? row.monthActual.toFixed(1) : row.monthActual}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn("text-xs", pctColor(row.pct))}>{row.pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly task notes — visible to all roles; edit only for FM/CEO */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Việc phát sinh theo tuần</p>
        </div>
        <div className="p-5 space-y-4">
          {WEEKS.map((w) => {
            const allNotes = targets
              .flatMap((t) => t.weeklyActuals.filter((a) => a.weekNumber === w))
              .map((a) => a.weeklyTaskNotes)
              .filter(Boolean) as string[];
            const uniqueNotes = Array.from(new Set(allNotes));
            return (
              <div key={w}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-gray-500">Tuần {w}</p>
                  {canEditNotes && (
                    <button
                      onClick={() => openNotesEdit(w)}
                      className="text-xs font-semibold text-[#f15b5c] hover:opacity-80"
                    >
                      ✏️ Cập nhật
                    </button>
                  )}
                </div>
                {uniqueNotes.length > 0 ? (
                  <div className="space-y-1">
                    {uniqueNotes.map((note, i) => (
                      <p key={i} className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 whitespace-pre-wrap">
                        {note}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 italic">Chưa có ghi chú</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes edit modal */}
      {notesEdit && (
        <>
          <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setNotesEdit(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-base">Công việc phát sinh - Tuần {notesEdit.weekNumber}</h2>
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
                onClick={saveNotes}
                disabled={notesSaving}
                className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {notesSaving ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                onClick={() => setNotesEdit(null)}
                className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold"
              >
                Hủy
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
