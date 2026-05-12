"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

type ArisingTask = { id: string; content: string; kpi: string; actual: string };

type KpiRow = {
  label: string;
  weekTarget: number;
  weekActual: number;
  pct: number;
  isFloat: boolean;
};

type WeekBound = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
};

type ReportData = {
  id?: string;
  arisingTasks?: string | null;
  incompleteWork?: string | null;
};

type Props = {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
  currentUserRole: string;
  userName: string;
  isReadOnly: boolean;
};

function getRoleDisplay(role: string): string {
  switch (role) {
    case "ADMIN": return "Admin";
    case "FM": return "FM";
    case "COO": return "COO";
    case "CEO_FITPARTNER": return "CEO";
    case "FREE": return "PT";
    case "RESTRICTED": return "PT";
    default: return role;
  }
}

function getCurrentWeek(month: number, year: number): number {
  const d = new Date(year, month - 1, 1);
  const dow = d.getDay() || 7;
  const firstMon = new Date(d);
  firstMon.setDate(d.getDate() - dow + 1);
  const today = new Date();
  if (today.getMonth() + 1 !== month || today.getFullYear() !== year) return 1;
  for (let w = 5; w >= 1; w--) {
    const wStart = new Date(firstMon);
    wStart.setDate(firstMon.getDate() + (w - 1) * 7);
    if (today >= wStart) return w;
  }
  return 1;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getDate()} - ${e.getDate()}/${e.getMonth() + 1}`;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "text-emerald-600 font-bold";
  if (pct >= 70) return "text-yellow-600 font-bold";
  return "text-red-500 font-bold";
}

const isFitpartnerLabel = (label: string) => label.toLowerCase().includes("fitpartner");

export function WeeklyReportTab({ branchId, branchName, month, year, currentUserRole, userName, isReadOnly }: Props) {
  const isFitpartner = branchName.toLowerCase().includes("fitpartner");
  const canEdit = (currentUserRole === "FM" || currentUserRole === "CEO_FITPARTNER" || currentUserRole === "COO") && !isReadOnly;

  const [selectedWeek, setSelectedWeek] = useState(() => getCurrentWeek(month, year));
  const [weekBounds, setWeekBounds] = useState<WeekBound[]>([]);
  const [kpiRows, setKpiRows] = useState<KpiRow[]>([]);
  const [arisingTasks, setArisingTasks] = useState<ArisingTask[]>([]);
  const [incompleteWork, setIncompleteWork] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/setup/weekly-report?branchId=${branchId}&month=${month}&year=${year}&weekNumber=${selectedWeek}`
      );
      if (res.ok) {
        const data: { report: ReportData | null; kpi: KpiRow[]; weekBounds: WeekBound[] } = await res.json();
        setWeekBounds(data.weekBounds ?? []);
        const rows = isFitpartner
          ? data.kpi
          : data.kpi.filter((r) => !isFitpartnerLabel(r.label));
        setKpiRows(rows);
        const report = data.report;
        setArisingTasks(report?.arisingTasks ? (JSON.parse(report.arisingTasks) as ArisingTask[]) : []);
        setIncompleteWork(report?.incompleteWork ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year, selectedWeek, isFitpartner]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Reset selected week when month/year changes
  useEffect(() => {
    setSelectedWeek(getCurrentWeek(month, year));
  }, [month, year]);

  function addArisingTask() {
    setArisingTasks((prev) => [
      ...prev,
      { id: Date.now().toString(), content: "", kpi: "", actual: "" },
    ]);
  }

  function removeArisingTask(id: string) {
    setArisingTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function updateArisingTask(id: string, field: keyof ArisingTask, value: string) {
    setArisingTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  async function saveReport() {
    setSaving(true);
    try {
      await fetch("/api/setup/weekly-report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          month,
          year,
          weekNumber: selectedWeek,
          arisingTasks: arisingTasks.length > 0 ? JSON.stringify(arisingTasks) : null,
          incompleteWork: incompleteWork.trim() || null,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  const currentBound = weekBounds.find((b) => b.weekNumber === selectedWeek);
  const dateRange = currentBound ? formatDateRange(currentBound.weekStart, currentBound.weekEnd) : "";

  const thStyle = "border border-gray-300 px-3 py-2 text-left text-xs font-bold text-white";
  const tdStyle = "border border-gray-200 px-3 py-2 text-xs text-gray-700";

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Week selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-500">Tuần:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((w) => {
            const bound = weekBounds.find((b) => b.weekNumber === w);
            const range = bound ? formatDateRange(bound.weekStart, bound.weekEnd) : "";
            return (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                  selectedWeek === w
                    ? "bg-[#f15b5c] text-white border-[#f15b5c]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}
                title={range}
              >
                W{w}
              </button>
            );
          })}
        </div>
        {dateRange && (
          <span className="text-xs text-gray-400">({dateRange})</span>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Report header */}
            <div className="text-center space-y-1">
              <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wide">
                BÁO CÁO CÔNG VIỆC
              </h2>
            </div>

            {/* Info row */}
            <div className="grid grid-cols-3 gap-4 text-sm border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-r border-gray-200">
                <span className="text-gray-400 text-xs font-semibold">Vị trí:</span>{" "}
                <span className="font-semibold text-gray-700">{getRoleDisplay(currentUserRole)} {userName}</span>
              </div>
              <div className="px-4 py-2.5 border-r border-gray-200">
                <span className="text-gray-400 text-xs font-semibold">Cơ sở:</span>{" "}
                <span className="font-semibold text-gray-700">{branchName}</span>
              </div>
              <div className="px-4 py-2.5">
                <span className="text-gray-400 text-xs font-semibold">Tuần:</span>{" "}
                <span className="font-semibold text-gray-700">TUẦN {selectedWeek} {dateRange && `(${dateRange})`}</span>
              </div>
            </div>

            {/* Table 1: Important tasks (KPI) */}
            <div>
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr>
                      <th
                        colSpan={5}
                        className="border border-gray-300 px-4 py-2.5 text-center text-sm font-extrabold text-white uppercase"
                        style={{ backgroundColor: "#f15b5c" }}
                      >
                        I/ CÔNG VIỆC QUAN TRỌNG
                      </th>
                    </tr>
                    <tr style={{ backgroundColor: "#f15b5c" }}>
                      <th className={thStyle + " w-8"}>STT</th>
                      <th className={thStyle}>Nội dung công việc</th>
                      <th className={cn(thStyle, "text-center w-24")}>KPI tuần (MT)</th>
                      <th className={cn(thStyle, "text-center w-24")}>Thực đạt</th>
                      <th className={cn(thStyle, "text-center w-16")}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiRows.map((row, idx) => (
                      <tr key={row.label} className="even:bg-gray-50/50">
                        <td className={cn(tdStyle, "text-center text-gray-400")}>{idx + 1}</td>
                        <td className={cn(tdStyle, "font-semibold text-gray-700")}>{row.label}</td>
                        <td className={cn(tdStyle, "text-center text-gray-500")}>
                          {row.isFloat ? row.weekTarget.toFixed(1) : Math.round(row.weekTarget)}
                        </td>
                        <td className={cn(tdStyle, "text-center font-bold text-gray-800")}>
                          {row.isFloat ? row.weekActual.toFixed(1) : row.weekActual}
                        </td>
                        <td className={cn(tdStyle, "text-center")}>
                          <span className={pctColor(row.pct)}>{row.pct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Arising tasks (editable) */}
            <div>
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr>
                      <th
                        colSpan={5}
                        className="border border-gray-300 px-4 py-2.5 text-center text-sm font-extrabold text-white uppercase"
                        style={{ backgroundColor: "#f15b5c" }}
                      >
                        II/ CÔNG VIỆC PHÁT SINH
                      </th>
                    </tr>
                    <tr style={{ backgroundColor: "#f15b5c" }}>
                      <th className={thStyle + " w-8"}>STT</th>
                      <th className={thStyle}>Nội dung công việc</th>
                      <th className={cn(thStyle, "text-center w-28")}>KPI / Mục tiêu</th>
                      <th className={cn(thStyle, "text-center w-24")}>Thực đạt</th>
                      {canEdit && <th className={cn(thStyle, "w-10")} />}
                    </tr>
                  </thead>
                  <tbody>
                    {arisingTasks.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canEdit ? 5 : 4}
                          className="border border-gray-200 px-4 py-4 text-center text-xs text-gray-300 italic"
                        >
                          Chưa có công việc phát sinh
                        </td>
                      </tr>
                    ) : (
                      arisingTasks.map((task, idx) => (
                        <tr key={task.id} className="even:bg-gray-50/50">
                          <td className={cn(tdStyle, "text-center text-gray-400")}>{idx + 1}</td>
                          <td className={tdStyle}>
                            {canEdit ? (
                              <input
                                value={task.content}
                                onChange={(e) => updateArisingTask(task.id, "content", e.target.value)}
                                placeholder="Mô tả công việc..."
                                className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30 rounded px-1"
                              />
                            ) : (
                              task.content
                            )}
                          </td>
                          <td className={cn(tdStyle, "text-center")}>
                            {canEdit ? (
                              <input
                                value={task.kpi}
                                onChange={(e) => updateArisingTask(task.id, "kpi", e.target.value)}
                                placeholder="—"
                                className="w-full text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30 rounded px-1"
                              />
                            ) : (
                              task.kpi || "—"
                            )}
                          </td>
                          <td className={cn(tdStyle, "text-center")}>
                            {canEdit ? (
                              <input
                                value={task.actual}
                                onChange={(e) => updateArisingTask(task.id, "actual", e.target.value)}
                                placeholder="—"
                                className="w-full text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30 rounded px-1"
                              />
                            ) : (
                              task.actual || "—"
                            )}
                          </td>
                          {canEdit && (
                            <td className={cn(tdStyle, "text-center")}>
                              <button
                                onClick={() => removeArisingTask(task.id)}
                                className="text-gray-300 hover:text-red-400 text-base leading-none"
                              >
                                ×
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {canEdit && (
                <button
                  onClick={addArisingTask}
                  className="mt-2 text-xs font-semibold text-[#f15b5c] hover:opacity-80"
                >
                  + Thêm công việc
                </button>
              )}
            </div>

            {/* Section 2: Incomplete work */}
            <div className="space-y-2">
              <div
                className="px-4 py-2.5 text-sm font-extrabold text-white uppercase text-center rounded-t-lg"
                style={{ backgroundColor: "#f15b5c" }}
              >
                II/ VIỆC CHƯA HOÀN THÀNH - NGUYÊN NHÂN VÀ GIẢI PHÁP
              </div>
              {canEdit ? (
                <textarea
                  value={incompleteWork}
                  onChange={(e) => setIncompleteWork(e.target.value)}
                  rows={5}
                  placeholder="(Giải pháp phải thật cụ thể, có kèm deadline và người phụ trách)"
                  className="w-full rounded-b-lg border border-gray-200 px-4 py-3 text-sm bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
              ) : (
                <div className="w-full rounded-b-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 min-h-[80px] whitespace-pre-wrap bg-gray-50">
                  {incompleteWork || <span className="text-gray-300 italic">Chưa có nội dung</span>}
                </div>
              )}
            </div>

            {/* Save button */}
            {canEdit && (
              <div className="flex justify-end">
                <button
                  onClick={saveReport}
                  disabled={saving}
                  className="px-6 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60 shadow-sm"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  {saving ? "Đang lưu..." : "Lưu báo cáo tuần"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
