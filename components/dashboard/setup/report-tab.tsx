"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { MonthlyTarget } from "./types";
import { useFormAutoSave, loadDraft } from "@/hooks/use-form-auto-save";

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

export function ReportTab({ branchId, branchName, month, year, currentUserRole, isPT }: Props) {
  const isFitpartner = branchName.toLowerCase().includes("fitpartner");
  const KPI_ROWS = isFitpartner ? [BASE_KPI_ROWS[0], FITPARTNER_KPI_ROW, ...BASE_KPI_ROWS.slice(1)] : BASE_KPI_ROWS;
  const canEdit = currentUserRole === "FM" || currentUserRole === "CEO_FITPARTNER" || currentUserRole === "COO";

  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [incompleteWork, setIncompleteWork] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Auto-save draft ────────────────────────────────────────────────────────
  const draftKey = `ladysfit_draft_monthly_${branchId}_${year}_${month}`;
  const { clearDraft: clearMonthlyDraft } = useFormAutoSave(
    draftKey,
    { incompleteWork },
    canEdit && !loading
  );

  const fetchReport = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const url = isPT
        ? `/api/setup/targets?branchId=${branchId}&month=${month}&year=${year}`
        : `/api/setup/report?branchId=${branchId}&month=${month}&year=${year}`;
      const [targetsRes, reportRes] = await Promise.all([
        fetch(url),
        isPT ? Promise.resolve(null) : fetch(`/api/setup/monthly-report?branchId=${branchId}&month=${month}&year=${year}`),
      ]);
      if (targetsRes.ok) setTargets(await targetsRes.json());
      if (reportRes?.ok) {
        const r = await reportRes.json();
        const dbIncomplete = r?.incompleteWork ?? "";
        // Restore draft if exists
        const key = `ladysfit_draft_monthly_${branchId}_${year}_${month}`;
        const draft = loadDraft<{ incompleteWork: string }>(key);
        setIncompleteWork(draft?.incompleteWork ?? dbIncomplete);
      }
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year, isPT]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function saveReport() {
    setSaving(true);
    try {
      const res = await fetch("/api/setup/monthly-report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, month, year, incompleteWork: incompleteWork.trim() || null }),
      });
      if (res.ok) clearMonthlyDraft();
    } finally {
      setSaving(false);
    }
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

  const th = "border border-gray-200 px-3 py-2.5 font-bold text-gray-500 uppercase text-xs whitespace-nowrap";
  const td = "border border-gray-200 px-3 py-2.5 text-xs";

  return (
    <div className="space-y-5">
      {/* Branch aggregate table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">Báo cáo tổng hợp tháng {month}/{year}</p>
        </div>
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className={cn(th, "text-left w-8")}>STT</th>
                <th className={cn(th, "text-left")}>Công việc</th>
                {WEEKS.map((w) => (
                  <th key={w} className={cn(th, "text-center")}>W{w} MT</th>
                ))}
                {WEEKS.map((w) => (
                  <th key={w} className={cn(th, "text-center")}>W{w} ĐẠT</th>
                ))}
                <th className={cn(th, "text-center")}>Tháng MT</th>
                <th className={cn(th, "text-center")}>Tháng ĐẠT</th>
                <th className={cn(th, "text-center")}>%</th>
              </tr>
            </thead>
            <tbody>
              {aggregate.map((row, idx) => {
                const weeklyTarget = row.monthTarget > 0 ? row.monthTarget / 5 : 0;
                return (
                  <tr key={row.label} className="even:bg-[#fafafa]">
                    <td className={cn(td, "text-center text-gray-400")}>{idx + 1}</td>
                    <td className={cn(td, "font-semibold text-gray-700")}>{row.label}</td>
                    {WEEKS.map((_, i) => (
                      <td key={i} className={cn(td, "text-center text-gray-400")}>
                        {row.isFloat ? weeklyTarget.toFixed(1) : Math.round(weeklyTarget)}
                      </td>
                    ))}
                    {row.weekActuals.map((v, i) => (
                      <td key={i} className={cn(td, "text-center text-gray-700")}>
                        {row.isFloat ? v.toFixed(1) : v}
                      </td>
                    ))}
                    <td className={cn(td, "text-center text-gray-500")}>
                      {row.isFloat ? row.monthTarget.toFixed(1) : row.monthTarget}
                    </td>
                    <td className={cn(td, "text-center font-bold text-gray-800")}>
                      {row.isFloat ? row.monthActual.toFixed(1) : row.monthActual}
                    </td>
                    <td className={cn(td, "text-center")}>
                      <span className={pctColor(row.pct)}>{row.pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly incomplete work section — FM/CEO/ADMIN only */}
      {!isPT && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="px-5 py-3 text-sm font-extrabold text-white uppercase text-center"
            style={{ backgroundColor: "#f15b5c" }}
          >
            II/ VIỆC CHƯA HOÀN THÀNH - NGUYÊN NHÂN VÀ GIẢI PHÁP
          </div>
          <p className="text-xs text-gray-400 text-center px-5 py-2 bg-gray-50 border-b border-gray-100">
            (Giải pháp phải thật cụ thể: Thời gian, KPIs có thể đo lường và kiểm soát được)
          </p>
          <div className="p-5 space-y-4">
            {canEdit ? (
              <textarea
                value={incompleteWork}
                onChange={(e) => setIncompleteWork(e.target.value)}
                rows={6}
                placeholder="Nhập nội dung việc chưa hoàn thành, nguyên nhân và giải pháp..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
              />
            ) : (
              <div className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 min-h-[100px] whitespace-pre-wrap bg-gray-50">
                {incompleteWork || <span className="text-gray-300 italic">Chưa có nội dung</span>}
              </div>
            )}
            {canEdit && (
              <div className="flex justify-end">
                <button
                  onClick={saveReport}
                  disabled={saving}
                  className="px-6 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60 shadow-sm"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  {saving ? "Đang lưu..." : "Lưu báo cáo tháng"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
