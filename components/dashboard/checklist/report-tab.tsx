"use client";

import { useState, useEffect, useCallback } from "react";
import { Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffMember } from "./checklist-page";

type ReportType = "WEEKLY" | "MONTHLY";

type TaskRow = {
  task: string;
  kpi: string;
  actual: string;
};

type MonthlyTarget = {
  revenueTarget: number;
  fitTarget: number;
  cooperationTarget: number;
  transformTarget: number;
  googleReviewTarget: number;
  cvTarget: number;
};

type Props = {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  staffList: StaffMember[];
};

const STANDARD_TASKS: { label: string; targetField: keyof MonthlyTarget }[] = [
  { label: "Doanh số", targetField: "revenueTarget" },
  { label: "FIT", targetField: "fitTarget" },
  { label: "KH hợp tác", targetField: "cooperationTarget" },
  { label: "Transform", targetField: "transformTarget" },
  { label: "Google Business", targetField: "googleReviewTarget" },
  { label: "CV tuyển dụng", targetField: "cvTarget" },
];

function makeDefaultRows(mt: MonthlyTarget | null): TaskRow[] {
  return STANDARD_TASKS.map(({ label, targetField }) => ({
    task: label,
    kpi: mt ? String(mt[targetField]) : "",
    actual: "",
  }));
}

const inputCls = "h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50";
const textAreaCls = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none disabled:bg-gray-50 disabled:text-gray-500";

export function ReportTab({ currentUserId, currentUserRole, staffList }: Props) {
  const isFM = currentUserRole === "FM";
  const now = new Date();

  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [reportType, setReportType] = useState<ReportType>("MONTHLY");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [week, setWeek] = useState(1);

  const [taskRows, setTaskRows] = useState<TaskRow[]>(makeDefaultRows(null));
  const [results, setResults] = useState("");
  const [completed, setCompleted] = useState("");
  const [incomplete, setIncomplete] = useState("");
  const [nextPlan, setNextPlan] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const isOwnReport = selectedUserId === currentUserId;
  const canEdit = !isFM && isOwnReport;
  const selectedUser = staffList.find((s) => s.id === selectedUserId);
  const displayName = selectedUser?.name ?? selectedUser?.email ?? "";

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        month: String(month),
        year: String(year),
        userId: selectedUserId,
      });
      if (reportType === "WEEKLY") params.set("week", String(week));

      const res = await fetch(`/api/checklist/report?${params}`);
      if (!res.ok) return;
      const data = await res.json() as {
        report: {
          importantTasks: string;
          results: string | null;
          completed: string | null;
          incomplete: string | null;
          nextPlan: string | null;
        } | null;
        monthlyTarget: MonthlyTarget | null;
      };

      const defaultRows = makeDefaultRows(data.monthlyTarget);

      if (data.report) {
        try {
          const savedRows = JSON.parse(data.report.importantTasks) as TaskRow[];
          const merged = STANDARD_TASKS.map(({ label }, idx) => {
            const saved = savedRows.find((r) => r.task === label);
            return saved ?? defaultRows[idx];
          });
          setTaskRows(merged);
        } catch {
          setTaskRows(defaultRows);
        }
        setResults(data.report.results ?? "");
        setCompleted(data.report.completed ?? "");
        setIncomplete(data.report.incomplete ?? "");
        setNextPlan(data.report.nextPlan ?? "");
      } else {
        setTaskRows(defaultRows);
        setResults("");
        setCompleted("");
        setIncomplete("");
        setNextPlan("");
      }
    } finally {
      setLoading(false);
    }
  }, [reportType, month, year, week, selectedUserId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function updateTaskRow(i: number, key: keyof TaskRow, value: string) {
    setTaskRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/checklist/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          reportType,
          month,
          year,
          weekNumber: reportType === "WEEKLY" ? week : null,
          importantTasks: JSON.stringify(taskRows),
          results: results || undefined,
          completed: completed || undefined,
          incomplete: incomplete || undefined,
          nextPlan: nextPlan || undefined,
        }),
      });
      if (res.ok) {
        setToast("Đã lưu báo cáo ✓");
        setTimeout(() => setToast(""), 3000);
        fetchReport();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* FM staff selector */}
      {isFM && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Xem nhân sự:</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.email}{s.id === currentUserId ? " (bạn)" : ""}
                </option>
              ))}
            </select>
            <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">Chỉ xem</span>
          </div>
          <p className="text-xs text-gray-500 italic">
            Đang xem báo cáo của: <span className="font-semibold text-gray-700">{displayName}</span>
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["MONTHLY", "WEEKLY"] as ReportType[]).map((t) => (
              <button
                key={t}
                onClick={() => setReportType(t)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                  reportType === t ? "bg-white text-[#f15b5c] shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t === "MONTHLY" ? "Tháng" : "Tuần"}
              </button>
            ))}
          </div>

          {reportType === "WEEKLY" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Tuần:</label>
              <select
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>W{w}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Tháng:</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Năm:</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Đang tải...</div>
      ) : (
        <>
          {/* FM read-only banner */}
          {isFM && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-500 italic">
              <span>👁️</span>
              <span>Chế độ xem — chỉ PT mới có thể chỉnh sửa báo cáo</span>
            </div>
          )}

          {/* Section 1: Công việc quan trọng */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-sm font-extrabold text-gray-700">Công việc quan trọng</p>
            </div>
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f5f5f5] border-b border-gray-200">
                    {["STT", "Công việc", "KPI", "Thực đạt", "%"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200 last:border-r-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {taskRows.map((row, i) => {
                    const kpiNum = parseFloat(row.kpi);
                    const actualNum = parseFloat(row.actual);
                    const pct = !isNaN(kpiNum) && kpiNum > 0 && !isNaN(actualNum)
                      ? Math.round((actualNum / kpiNum) * 100)
                      : null;

                    return (
                      <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 divide-x divide-gray-100">
                        <td className="px-3 py-2 text-gray-400 w-10">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800 min-w-[140px]">{row.task}</td>
                        <td className="px-2 py-2 w-28">
                          {canEdit ? (
                            <input
                              value={row.kpi}
                              onChange={(e) => updateTaskRow(i, "kpi", e.target.value)}
                              className={inputCls}
                              placeholder="KPI..."
                            />
                          ) : <span className="text-gray-600">{row.kpi || "—"}</span>}
                        </td>
                        <td className="px-2 py-2 w-28">
                          {canEdit ? (
                            <input
                              value={row.actual}
                              onChange={(e) => updateTaskRow(i, "actual", e.target.value)}
                              className={inputCls}
                              placeholder="Thực đạt..."
                            />
                          ) : <span className="text-gray-600">{row.actual || "—"}</span>}
                        </td>
                        <td className="px-3 py-2 w-20">
                          {pct !== null ? (
                            <span className={cn(
                              "font-bold",
                              pct >= 100 ? "text-green-600" : pct >= 70 ? "text-yellow-500" : "text-[#f15b5c]"
                            )}>
                              {pct}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Tự luận */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-extrabold text-gray-700 mb-4">Tự luận</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: "Kết quả", value: results, set: setResults },
                { label: "Đã hoàn thành", value: completed, set: setCompleted },
                { label: "Chưa hoàn thành", value: incomplete, set: setIncomplete },
                { label: "Kế hoạch tiếp theo", value: nextPlan, set: setNextPlan },
              ] as { label: string; value: string; set: (v: string) => void }[]).map(({ label, value, set }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">{label}</label>
                  <textarea
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    disabled={!canEdit}
                    rows={4}
                    className={textAreaCls}
                    placeholder={canEdit ? `Nhập ${label.toLowerCase()}...` : ""}
                  />
                </div>
              ))}
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Save className="w-4 h-4" />
                {saving ? "Đang lưu..." : "Lưu báo cáo"}
              </button>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
