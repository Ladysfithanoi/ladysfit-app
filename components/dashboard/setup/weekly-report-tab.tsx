"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormAutoSave, loadDraft } from "@/hooks/use-form-auto-save";

type ArisingTask = { id: string; content: string; kpi: string; actual: string };

type KpiRow = {
  label: string;
  weekTarget: number;
  weekActual: number;
  pct: number;
  isFloat: boolean;
};

type KpiRowPersonal = KpiRow & { actualKey: string };

type PerUserKpi = {
  monthlyTargetId: string | null;
  userId: string;
  userName: string;
  weeklyActualId: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  kpi: KpiRowPersonal[];
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
  solutions?: string | null;
};

type Props = {
  branchId: string;
  branchName: string;
  month: number;
  year: number;
  currentUserRole: string;
  currentUserId: string;
  userName: string;
  isReadOnly: boolean;
};

function getRoleDisplay(role: string): string {
  switch (role) {
    case "ADMIN": return "Admin";
    case "FM": return "FM";
    case "COO": return "COO";
    case "CEO_FITPARTNER": return "CEO";
    case "PT": return "PT";
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
  function dateDMY(iso: string) {
    const [, m, d] = iso.split("T")[0].split("-");
    return `${(d ?? "").padStart(2, "0")}/${(m ?? "").padStart(2, "0")}`;
  }
  return `${dateDMY(start)} - ${dateDMY(end)}`;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "text-emerald-600 font-bold";
  if (pct >= 70) return "text-yellow-600 font-bold";
  return "text-red-500 font-bold";
}

const isFitpartnerLabel = (label: string) => label.toLowerCase().includes("fitpartner");

export function WeeklyReportTab({
  branchId, branchName, month, year, currentUserRole, currentUserId, userName, isReadOnly,
}: Props) {
  const isFitpartner = branchName.toLowerCase().includes("fitpartner");
  // All active staff can fill in Part II/III of their branch report
  const canEdit = !isReadOnly;
  // Everyone can edit their own personal actuals
  const canEditOwn = !isReadOnly;

  const [selectedWeek, setSelectedWeek] = useState(() => getCurrentWeek(month, year));
  const [weekBounds, setWeekBounds] = useState<WeekBound[]>([]);
  const [kpiRows, setKpiRows] = useState<KpiRow[]>([]);
  const [perUserKpi, setPerUserKpi] = useState<PerUserKpi[]>([]);
  const [personalActuals, setPersonalActuals] = useState<Record<string, number>>({});
  const [arisingTasks, setArisingTasks] = useState<ArisingTask[]>([]);
  const [incompleteWork, setIncompleteWork] = useState("");
  const [solutions, setSolutions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savingActuals, setSavingActuals] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");

  // ── Auto-save draft ────────────────────────────────────────────────────────
  const draftKey = `ladysfit_draft_weekly_${branchId}_${year}_${month}_w${selectedWeek}_${currentUserId}`;
  const { clearDraft: clearWeeklyDraft } = useFormAutoSave(
    draftKey,
    { arisingTasks, incompleteWork, solutions },
    canEdit && !loading && isDirty
  );

  const fetchReport = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/setup/weekly-report?branchId=${branchId}&month=${month}&year=${year}&weekNumber=${selectedWeek}`
      );
      if (res.ok) {
        const data: { report: ReportData | null; kpi: KpiRow[]; perUserKpi: PerUserKpi[]; weekBounds: WeekBound[] } = await res.json();
        setWeekBounds(data.weekBounds ?? []);
        const rows = isFitpartner
          ? (data.kpi ?? [])
          : (data.kpi ?? []).filter((r) => !isFitpartnerLabel(r.label));
        setKpiRows(rows);
        setPerUserKpi(data.perUserKpi ?? []);
        const report = data.report;
        const dbArisingTasks = report?.arisingTasks ? (JSON.parse(report.arisingTasks) as ArisingTask[]) : [];
        const dbIncompleteWork = report?.incompleteWork ?? "";
        const dbSolutions = report?.solutions ?? "";

        const key = `ladysfit_draft_weekly_${branchId}_${year}_${month}_w${selectedWeek}_${currentUserId}`;
        const draft = loadDraft<{ arisingTasks: ArisingTask[]; incompleteWork: string; solutions: string }>(key);
        if (draft) {
          setArisingTasks(draft.arisingTasks ?? dbArisingTasks);
          setIncompleteWork(draft.incompleteWork ?? dbIncompleteWork);
          setSolutions(draft.solutions ?? dbSolutions);
        } else {
          setArisingTasks(dbArisingTasks);
          setIncompleteWork(dbIncompleteWork);
          setSolutions(dbSolutions);
        }
        setIsDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, [branchId, month, year, selectedWeek, isFitpartner, currentUserId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => {
    const myRow = perUserKpi.find((p) => p.userId === currentUserId);
    if (!myRow) return;
    const actuals: Record<string, number> = {};
    myRow.kpi.forEach((k) => {
      actuals[k.actualKey] = k.weekActual;
    });
    setPersonalActuals(actuals);
  }, [perUserKpi, currentUserId]);

  useEffect(() => {
    setSelectedWeek(getCurrentWeek(month, year));
  }, [month, year]);

  function addArisingTask() {
    setIsDirty(true);
    setArisingTasks((prev) => [
      ...prev,
      { id: Date.now().toString(), content: "", kpi: "", actual: "" },
    ]);
  }

  function removeArisingTask(id: string) {
    setIsDirty(true);
    setArisingTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function updateArisingTask(id: string, field: keyof ArisingTask, value: string) {
    setIsDirty(true);
    setArisingTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  function openModal(title: string, content: string) {
    setModalTitle(title);
    setModalContent(content);
    setModalOpen(true);
  }

  async function saveReport() {
    setSaving(true);
    try {
      const res = await fetch("/api/setup/weekly-report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          month,
          year,
          weekNumber: selectedWeek,
          arisingTasks: arisingTasks.length > 0 ? JSON.stringify(arisingTasks) : null,
          incompleteWork: incompleteWork.trim() || null,
          solutions: solutions.trim() || null,
        }),
      });
      if (res.ok) { clearWeeklyDraft(); setIsDirty(false); }
    } finally {
      setSaving(false);
    }
  }

  async function savePersonalActuals() {
    const myRow = perUserKpi.find((p) => p.userId === currentUserId);
    if (!myRow) return;
    const currentBound = weekBounds.find((b) => b.weekNumber === selectedWeek);
    if (!currentBound) return;

    setSavingActuals(true);
    try {
      let monthlyTargetId = myRow.monthlyTargetId;
      if (!monthlyTargetId) {
        const res = await fetch("/api/setup/targets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{
            branchId, userId: currentUserId, month, year,
            revenueTarget: 0, fitpartnerRevenueTarget: 0, fitTarget: 0,
            cooperationTarget: 0, transformTarget: 0, googleReviewTarget: 0, cvTarget: 0,
          }]),
        });
        const created = await res.json() as Array<{ id: string }>;
        monthlyTargetId = created[0]?.id ?? null;
      }
      if (!monthlyTargetId) { setSavingActuals(false); return; }

      await fetch("/api/setup/weekly-actual", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyTargetId,
          weekNumber: selectedWeek,
          weekStart: currentBound.weekStart,
          weekEnd: currentBound.weekEnd,
          ...personalActuals,
        }),
      });
      await fetchReport();
    } finally {
      setSavingActuals(false);
    }
  }

  const currentBound = weekBounds.find((b) => b.weekNumber === selectedWeek);
  const dateRange = currentBound ? formatDateRange(currentBound.weekStart, currentBound.weekEnd) : "";

  const thStyle = "border border-gray-300 px-3 py-2 text-left text-xs font-bold text-white";
  const tdStyle = "border border-gray-200 px-3 py-2 text-xs text-gray-700";

  const myPerUserRow = perUserKpi.find((p) => p.userId === currentUserId);
  const showAggregate = currentUserRole === "FM" || currentUserRole === "CEO_FITPARTNER" || currentUserRole === "COO";
  const showPerUser = currentUserRole === "FM" || currentUserRole === "CEO_FITPARTNER" || currentUserRole === "COO";

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Week selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-500">Tuần:</span>
        <div className="flex gap-1 flex-wrap">
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
              >
                <span>Tuần {w}</span>
                {range && <span className="ml-1 text-[11px] opacity-75">({range})</span>}
              </button>
            );
          })}
        </div>
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

            {/* ── PHẦN I: SỐ LIỆU TỰ ĐỘNG ─────────────────────────────── */}

            {/* Table 1a: My personal KPI (editable actuals) — visible to all roles */}
            {myPerUserRow && (
              <div>
                <div
                  className="px-4 py-2.5 text-sm font-extrabold text-white uppercase text-center rounded-t-lg"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  I/ SỐ LIỆU TỰ ĐỘNG — KPI CỦA TÔI
                </div>
                <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                      <tr style={{ backgroundColor: "#f15b5c" }}>
                        <th className={thStyle + " w-8"}>STT</th>
                        <th className={cn(thStyle, "sticky left-0 z-10 bg-[#f15b5c]")}>Nội dung công việc</th>
                        <th className={cn(thStyle, "text-center w-28")}>KPI tuần (MT)</th>
                        <th className={cn(thStyle, "text-center w-28")}>Thực đạt</th>
                        <th className={cn(thStyle, "text-center w-16")}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myPerUserRow.kpi
                        .filter((row) => isFitpartner || !isFitpartnerLabel(row.label))
                        .map((row, idx) => {
                          const actual = personalActuals[row.actualKey] ?? row.weekActual;
                          const pct = row.weekTarget > 0 ? Math.round((actual / row.weekTarget) * 100) : 0;
                          return (
                            <tr key={row.label} className="even:bg-gray-50/50">
                              <td className={cn(tdStyle, "text-center text-gray-400")}>{idx + 1}</td>
                              <td className={cn(tdStyle, "font-semibold text-gray-700 sticky left-0 z-10 bg-white")}>{row.label}</td>
                              <td className={cn(tdStyle, "text-center text-gray-500")}>
                                {row.isFloat ? row.weekTarget.toFixed(1) : Math.round(row.weekTarget)}
                              </td>
                              <td className={cn(tdStyle, "text-center p-1")}>
                                {canEditOwn ? (
                                  <input
                                    type="number"
                                    step={row.isFloat ? "0.1" : "1"}
                                    value={actual}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) =>
                                      setPersonalActuals((prev) => ({
                                        ...prev,
                                        [row.actualKey]: parseFloat(e.target.value) || 0,
                                      }))
                                    }
                                    className="w-full text-center bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/50 text-gray-800 font-bold"
                                  />
                                ) : (
                                  <span className="font-bold text-gray-800">
                                    {row.isFloat ? actual.toFixed(1) : actual}
                                  </span>
                                )}
                              </td>
                              <td className={cn(tdStyle, "text-center")}>
                                <span className={pctColor(pct)}>{pct}%</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {canEditOwn && (
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={savePersonalActuals}
                      disabled={savingActuals}
                      className="px-5 h-9 rounded-lg text-white font-bold text-xs disabled:opacity-60 shadow-sm"
                      style={{ backgroundColor: "#f15b5c" }}
                    >
                      {savingActuals ? "Đang lưu..." : "Lưu thực đạt của tôi"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Table 1b: Aggregate KPI (FM/CEO/COO view) */}
            {showAggregate && kpiRows.length > 0 && (
              <div>
                <div
                  className="px-4 py-2.5 text-sm font-extrabold text-white uppercase text-center rounded-t-lg"
                  style={{ backgroundColor: "#6b7280" }}
                >
                  TỔNG HỢP KPI TUẦN — TẤT CẢ NHÂN SỰ
                </div>
                <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                      <tr style={{ backgroundColor: "#6b7280" }}>
                        <th className={thStyle + " w-8"}>STT</th>
                        <th className={cn(thStyle, "sticky left-0 z-10 bg-[#6b7280]")}>Nội dung công việc</th>
                        <th className={cn(thStyle, "text-center w-24")}>KPI tuần (MT)</th>
                        <th className={cn(thStyle, "text-center w-24")}>Thực đạt</th>
                        <th className={cn(thStyle, "text-center w-16")}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiRows.map((row, idx) => (
                        <tr key={row.label} className="even:bg-gray-50/50">
                          <td className={cn(tdStyle, "text-center text-gray-400")}>{idx + 1}</td>
                          <td className={cn(tdStyle, "font-semibold text-gray-700 sticky left-0 z-10 bg-white")}>{row.label}</td>
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
            )}

            {/* Per-user KPI breakdown (FM/CEO/COO) */}
            {showPerUser && perUserKpi.length > 0 && (
              <div>
                <div
                  className="px-4 py-2.5 text-sm font-extrabold text-white uppercase text-center rounded-t-lg"
                  style={{ backgroundColor: "#6b7280" }}
                >
                  CHI TIẾT KPI TỪNG NHÂN SỰ
                </div>
                <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead>
                      <tr style={{ backgroundColor: "#6b7280" }}>
                        <th className={cn(thStyle, "sticky left-0 z-10 bg-[#6b7280]")}>Nhân sự</th>
                        <th className={thStyle}>Chỉ số</th>
                        <th className={cn(thStyle, "text-center w-24")}>MT tuần</th>
                        <th className={cn(thStyle, "text-center w-24")}>Thực đạt</th>
                        <th className={cn(thStyle, "text-center w-16")}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perUserKpi.map((pu) =>
                        pu.kpi
                          .filter((row) => isFitpartner || !isFitpartnerLabel(row.label))
                          .map((row, idx) => (
                            <tr key={`${pu.userId}-${row.label}`} className="even:bg-gray-50/50">
                              {idx === 0 && (
                                <td
                                  className={cn(tdStyle, "font-bold text-gray-800 align-top sticky left-0 z-10 bg-white")}
                                  rowSpan={isFitpartner ? pu.kpi.length : pu.kpi.filter((r) => !isFitpartnerLabel(r.label)).length}
                                >
                                  {pu.userName}
                                </td>
                              )}
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
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── PHẦN II: CÔNG VIỆC PHÁT SINH (BẢNG ĐIỀN TAY) ─────────── */}
            <div>
              <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full table-fixed border-collapse border border-gray-300 text-xs min-w-[480px]">
                  <thead>
                    <tr>
                      <th
                        colSpan={canEdit ? 5 : 4}
                        className="border border-gray-300 px-4 py-2.5 text-center text-sm font-extrabold text-white uppercase"
                        style={{ backgroundColor: "#f15b5c" }}
                      >
                        II/ CÔNG VIỆC PHÁT SINH
                      </th>
                    </tr>
                    <tr style={{ backgroundColor: "#f15b5c" }}>
                      <th className={thStyle + " w-8"}>STT</th>
                      <th className={cn(thStyle, "sticky left-0 z-10 bg-[#f15b5c]")}>Nội dung công việc</th>
                      <th className={cn(thStyle, "text-center w-32")}>KPI / Mục tiêu</th>
                      <th className={cn(thStyle, "text-center w-28")}>Thực đạt</th>
                      {canEdit && <th className={cn(thStyle, "w-10")} />}
                    </tr>
                  </thead>
                  <tbody>
                    {arisingTasks.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canEdit ? 5 : 4}
                          className="border border-gray-200 px-4 py-6 text-center text-xs text-gray-300 italic"
                        >
                          {canEdit
                            ? 'Chưa có công việc phát sinh — bấm "+ Thêm công việc phát sinh" để thêm dòng mới'
                            : "Chưa có công việc phát sinh"}
                        </td>
                      </tr>
                    ) : (
                      arisingTasks.map((task, idx) => (
                        <tr key={task.id} className="even:bg-gray-50/50">
                          <td className={cn(tdStyle, "text-center text-gray-400 font-semibold")}>{idx + 1}</td>
                          <td className={cn(tdStyle, "sticky left-0 z-10 bg-white overflow-hidden")}>
                            {canEdit ? (
                              <div className="flex items-center gap-1 min-w-0">
                                <input
                                  value={task.content}
                                  onChange={(e) => updateArisingTask(task.id, "content", e.target.value)}
                                  placeholder="Mô tả nội dung công việc..."
                                  className="min-w-0 w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30 rounded px-1 py-0.5"
                                />
                                {task.content && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openModal("Chi tiết công việc phát sinh", task.content); }}
                                    className="flex-shrink-0 p-0.5 text-gray-300 hover:text-[#f15b5c] transition-colors rounded"
                                    title="Xem toàn bộ nội dung"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div
                                className="group cursor-pointer"
                                onClick={() => task.content && openModal("Chi tiết công việc phát sinh", task.content)}
                                title="Click để xem toàn bộ nội dung"
                              >
                                <div className="line-clamp-2 overflow-hidden text-gray-700 group-hover:text-[#f15b5c] transition-colors">
                                  {task.content || <span className="text-gray-300 italic">—</span>}
                                </div>
                                {task.content && (
                                  <span className="text-[10px] text-gray-400 group-hover:text-[#f15b5c] transition-colors select-none">
                                    Xem đầy đủ ↗
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={cn(tdStyle, "text-center")}>
                            {canEdit ? (
                              <input
                                value={task.kpi}
                                onChange={(e) => updateArisingTask(task.id, "kpi", e.target.value)}
                                placeholder="—"
                                className="w-full text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30 rounded px-1 py-0.5"
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
                                className="w-full text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30 rounded px-1 py-0.5"
                              />
                            ) : (
                              task.actual || "—"
                            )}
                          </td>
                          {canEdit && (
                            <td className={cn(tdStyle, "text-center p-1")}>
                              <button
                                onClick={() => removeArisingTask(task.id)}
                                className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Add button below table too for convenience */}
              {canEdit && arisingTasks.length > 0 && (
                <button
                  onClick={addArisingTask}
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#f15b5c] hover:opacity-80 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm công việc phát sinh
                </button>
              )}
            </div>

            {/* ── PHẦN III: VIỆC CHƯA HOÀN THÀNH & GIẢI PHÁP ─────────────── */}
            <div className="space-y-4">
              {/* Section header */}
              <div
                className="px-4 py-2.5 text-sm font-extrabold text-white uppercase text-center rounded-t-lg"
                style={{ backgroundColor: "#f15b5c" }}
              >
                III/ VIỆC CHƯA HOÀN THÀNH & GIẢI PHÁP
              </div>

              {/* 3a: Danh sách việc chưa hoàn thành */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
                    Danh sách công việc chưa hoàn thành trong tuần
                  </label>
                  {incompleteWork && (
                    <button
                      type="button"
                      onClick={() => openModal("Chi tiết việc chưa hoàn thành", incompleteWork)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#f15b5c] transition-colors"
                      title="Xem toàn bộ nội dung"
                    >
                      <Eye className="w-3 h-3" />
                      Xem đầy đủ
                    </button>
                  )}
                </div>
                {canEdit ? (
                  <textarea
                    value={incompleteWork}
                    onChange={(e) => { setIncompleteWork(e.target.value); setIsDirty(true); }}
                    rows={4}
                    placeholder="Liệt kê từng công việc chưa hoàn thành, mỗi việc một dòng..."
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 min-h-[96px]"
                  />
                ) : (
                  <div
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 bg-gray-50 relative group cursor-pointer hover:border-[#f15b5c]/40 hover:bg-rose-50/30 transition-colors overflow-hidden"
                    style={{ minHeight: "80px", maxHeight: "120px" }}
                    onClick={() => incompleteWork && openModal("Chi tiết việc chưa hoàn thành", incompleteWork)}
                  >
                    <div className="line-clamp-3 overflow-hidden whitespace-pre-wrap">
                      {incompleteWork || <span className="text-gray-300 italic">Chưa có nội dung</span>}
                    </div>
                    {incompleteWork && (
                      <span className="absolute bottom-2 right-3 text-[10px] text-gray-400 group-hover:text-[#f15b5c] transition-colors select-none">
                        Xem đầy đủ ↗
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 3b: Giải pháp khắc phục */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
                    Giải pháp khắc phục / Kế hoạch xử lý tiếp theo
                  </label>
                  {solutions && (
                    <button
                      type="button"
                      onClick={() => openModal("Chi tiết giải pháp khắc phục", solutions)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#f15b5c] transition-colors"
                      title="Xem toàn bộ nội dung"
                    >
                      <Eye className="w-3 h-3" />
                      Xem đầy đủ
                    </button>
                  )}
                </div>
                {canEdit ? (
                  <textarea
                    value={solutions}
                    onChange={(e) => { setSolutions(e.target.value); setIsDirty(true); }}
                    rows={4}
                    placeholder="Mô tả giải pháp cụ thể, kèm deadline và người phụ trách..."
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 min-h-[96px]"
                  />
                ) : (
                  <div
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 bg-gray-50 relative group cursor-pointer hover:border-[#f15b5c]/40 hover:bg-rose-50/30 transition-colors overflow-hidden"
                    style={{ minHeight: "80px", maxHeight: "120px" }}
                    onClick={() => solutions && openModal("Chi tiết giải pháp khắc phục", solutions)}
                  >
                    <div className="line-clamp-3 overflow-hidden whitespace-pre-wrap">
                      {solutions || <span className="text-gray-300 italic">Chưa có nội dung</span>}
                    </div>
                    {solutions && (
                      <span className="absolute bottom-2 right-3 text-[10px] text-gray-400 group-hover:text-[#f15b5c] transition-colors select-none">
                        Xem đầy đủ ↗
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Save report button (FM/CEO/COO only) */}
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

      {/* ── MODAL XEM CHI TIẾT ──────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onMouseDown={() => setModalOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

          {/* Panel */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-gray-100"
            style={{ maxHeight: "80vh" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: "#f15b5c" }} />
                <h3 className="text-sm font-bold text-gray-800">{modalTitle}</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {modalContent}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 h-9 rounded-lg font-bold text-sm text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f15b5c" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
