"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateMaskInput } from "@/components/ui/date-mask-input";
import type { StaffMember } from "./checklist-page";

type Row = {
  id?: string;
  order: number;
  startTime: string;
  endTime: string;
  task: string;
  kpi: string;
  actualResult: number;
  note: string;
};

type Props = {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  staffList: StaffMember[];
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const inputCls = "h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full min-w-0";

export function DailyTab({ currentUserId, currentUserName, currentUserRole, staffList }: Props) {
  const isFM = currentUserRole === "FM";

  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [date, setDate] = useState(todayISO());

  // Header fields
  const [position, setPosition] = useState("");
  const [targetNote, setTargetNote] = useState("");
  const [totalTarget, setTotalTarget] = useState("");
  const [totalActual, setTotalActual] = useState(0);

  const [rows, setRows] = useState<Row[]>([]);
  const [dailyResults, setDailyResults] = useState("");
  const [dailyCompleted, setDailyCompleted] = useState("");
  const [dailyIncomplete, setDailyIncomplete] = useState("");
  const [dailyNextPlan, setDailyNextPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const isOwnChecklist = selectedUserId === currentUserId;
  const canEdit = isOwnChecklist;
  const canEditReflection = !isFM && isOwnChecklist;

  const selectedUser = staffList.find((s) => s.id === selectedUserId);
  const displayName = selectedUser?.name ?? selectedUser?.email ?? "";

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checklist/daily?date=${date}&userId=${selectedUserId}`);
      if (!res.ok) return;
      const data = await res.json() as {
        checklist: {
          position: string;
          targetNote: string | null;
          totalTarget: number | null;
          dailyResults: string | null;
          dailyCompleted: string | null;
          dailyIncomplete: string | null;
          dailyNextPlan: string | null;
          items: Row[];
        } | null;
        totalActual: number;
      };
      setTotalActual(data.totalActual);
      if (data.checklist) {
        setPosition(data.checklist.position ?? "");
        setTargetNote(data.checklist.targetNote ?? "");
        setTotalTarget(data.checklist.totalTarget != null ? String(data.checklist.totalTarget) : "");
        setDailyResults(data.checklist.dailyResults ?? "");
        setDailyCompleted(data.checklist.dailyCompleted ?? "");
        setDailyIncomplete(data.checklist.dailyIncomplete ?? "");
        setDailyNextPlan(data.checklist.dailyNextPlan ?? "");
        setRows(data.checklist.items.map((item) => ({
          id: item.id,
          order: item.order,
          startTime: (item as unknown as Record<string, unknown>).startTime as string ?? "",
          endTime: (item as unknown as Record<string, unknown>).endTime as string ?? "",
          task: item.task,
          kpi: item.kpi ?? "",
          actualResult: (item as unknown as Record<string, unknown>).actualResult != null ? Number((item as unknown as Record<string, unknown>).actualResult) : 0,
          note: item.note ?? "",
        })));
      } else {
        setPosition("");
        setTargetNote("");
        setTotalTarget("");
        setDailyResults("");
        setDailyCompleted("");
        setDailyIncomplete("");
        setDailyNextPlan("");
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [date, selectedUserId]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  function addRow() {
    setRows((prev) => [...prev, { order: prev.length + 1, startTime: "", endTime: "", task: "", kpi: "", actualResult: 0, note: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, order: idx + 1 })));
  }

  function updateRow<K extends keyof Row>(i: number, key: K, value: Row[K]) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/checklist/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          userId: currentUserId,
          position,
          targetNote: targetNote || undefined,
          totalTarget: totalTarget ? parseFloat(totalTarget) : undefined,
          dailyResults: dailyResults || undefined,
          dailyCompleted: dailyCompleted || undefined,
          dailyIncomplete: dailyIncomplete || undefined,
          dailyNextPlan: dailyNextPlan || undefined,
          items: rows.map((r) => ({
            order: r.order,
            startTime: r.startTime || undefined,
            endTime: r.endTime || undefined,
            task: r.task,
            kpi: r.kpi || undefined,
            actualResult: r.actualResult || undefined,
            note: r.note || undefined,
          })),
        }),
      });
      if (res.ok) {
        setToast("Đã lưu check-list ✓");
        setTimeout(() => setToast(""), 3000);
        fetchChecklist();
      }
    } finally {
      setSaving(false);
    }
  }

  const completedTasks = rows.filter((r) => {
    const k = parseFloat(r.kpi);
    return !isNaN(k) && k > 0 && (r.actualResult / k) * 100 >= 80;
  }).length;
  const pct = rows.length > 0 ? Math.round((completedTasks / rows.length) * 100) : 0;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* FM staff selector */}
      {isFM && (
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
          {!isOwnChecklist && (
            <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">Chỉ xem</span>
          )}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Họ tên</label>
            <div className="h-9 rounded-xl border border-gray-100 bg-gray-50 px-3 flex items-center text-sm text-gray-600">
              {displayName || currentUserName}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Vị trí</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              disabled={!canEdit}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="VD: PT, FM..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Ngày báo cáo</label>
            <DateMaskInput
              value={date}
              onChange={setDate}
              disabled={!canEdit}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Target tháng (triệu)</label>
            <input
              type="number"
              step="0.1"
              value={totalTarget}
              onChange={(e) => setTotalTarget(e.target.value)}
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
              onChange={(e) => setTargetNote(e.target.value)}
              disabled={!canEdit}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full disabled:bg-gray-50"
              placeholder="Mục tiêu hôm nay..."
            />
          </div>
        </div>

        {/* Progress bar */}
        {rows.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-500">Tiến độ ngày {fmtDate(date)}</span>
              <span className="text-xs font-bold text-gray-700">{completedTasks}/{rows.length} công việc · {pct}% hoàn thành</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : "bg-[#f15b5c]")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Checklist table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-700">Danh sách công việc</p>
          {canEdit && (
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Plus className="w-3.5 h-3.5" /> Thêm công việc
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Đang tải...</div>
        ) : (
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            <table className="w-full min-w-[540px] text-xs border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] border-b border-gray-200">
                  {["STT", "Giờ", "Công việc", "KPI", "Thực đạt", "%", "Note", ...(canEdit ? ["Xóa"] : [])].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-r border-gray-200 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 8 : 7} className="px-3 py-8 text-center text-gray-300 italic">
                      {canEdit ? 'Nhấn "+ Thêm công việc" để bắt đầu' : "Chưa có công việc nào"}
                    </td>
                  </tr>
                ) : rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 divide-x divide-gray-100">
                    <td className="px-3 py-2 text-gray-400 w-10">{row.order}</td>
                    <td className="px-2 py-2 w-48">
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={row.startTime}
                            onChange={(e) => updateRow(i, "startTime", e.target.value)}
                            className={inputCls}
                          />
                          <span className="text-gray-400 text-xs shrink-0">–</span>
                          <input
                            type="time"
                            value={row.endTime}
                            onChange={(e) => updateRow(i, "endTime", e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-600 whitespace-nowrap font-medium">
                          {row.startTime || row.endTime
                            ? `${row.startTime || "?"}–${row.endTime || "?"}`
                            : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 w-full">
                      {canEdit ? (
                        <input
                          value={row.task}
                          onChange={(e) => updateRow(i, "task", e.target.value)}
                          className={inputCls}
                          placeholder="Tên công việc..."
                        />
                      ) : <span className="font-semibold text-gray-800">{row.task || "—"}</span>}
                    </td>
                    <td className="px-2 py-2 w-32">
                      {canEdit ? (
                        <input
                          value={row.kpi}
                          onChange={(e) => updateRow(i, "kpi", e.target.value)}
                          className={inputCls}
                          placeholder="KPI..."
                        />
                      ) : <span className="text-gray-600">{row.kpi || "—"}</span>}
                    </td>
                    <td className="px-2 py-2 w-28">
                      {canEdit ? (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.actualResult === 0 ? "" : row.actualResult}
                          onChange={(e) => updateRow(i, "actualResult", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                          className={inputCls}
                          placeholder="0"
                        />
                      ) : <span className="text-gray-600">{row.actualResult > 0 ? row.actualResult : "—"}</span>}
                    </td>
                    <td className="px-3 py-2 w-20 text-center">
                      {(() => {
                        const kpiNum = parseFloat(row.kpi);
                        const hasKpi = !isNaN(kpiNum) && kpiNum > 0;
                        if (!hasKpi) return <span className="text-gray-300 font-semibold">—</span>;
                        const pctVal = (row.actualResult / kpiNum) * 100;
                        const color = pctVal >= 100 ? "text-green-600" : pctVal >= 70 ? "text-yellow-500" : "text-red-500";
                        return <span className={cn("font-bold text-xs", color)}>{pctVal.toFixed(1)}%</span>;
                      })()}
                    </td>
                    <td className="px-2 py-2 w-28">
                      {canEdit ? (
                        <input
                          value={row.note}
                          onChange={(e) => updateRow(i, "note", e.target.value)}
                          className={inputCls}
                          placeholder="Ghi chú..."
                        />
                      ) : <span className="text-gray-500">{row.note || "—"}</span>}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 w-10">
                        <button onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tự luận cuối ngày */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: "#f15b5c" }}>
          <p className="text-sm font-extrabold text-white tracking-wide uppercase">Tự luận cuối ngày</p>
          {isFM && (
            <span className="text-xs text-white/80 italic flex items-center gap-1.5">
              <span>👁️</span> Chế độ xem — chỉ PT mới có thể chỉnh sửa
            </span>
          )}
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { label: "Kết quả ngày hôm nay", value: dailyResults, set: setDailyResults, placeholder: "Tổng kết kết quả đạt được trong ngày..." },
            { label: "Đã hoàn thành", value: dailyCompleted, set: setDailyCompleted, placeholder: "Liệt kê các công việc đã hoàn thành trong ngày..." },
            { label: "Chưa hoàn thành", value: dailyIncomplete, set: setDailyIncomplete, placeholder: "Liệt kê công việc chưa hoàn thành và lý do..." },
            { label: "Kế hoạch tiếp theo", value: dailyNextPlan, set: setDailyNextPlan, placeholder: "Kế hoạch cho ngày/buổi làm việc tiếp theo..." },
          ] as { label: string; value: string; set: (v: string) => void; placeholder: string }[]).map(({ label, value, set, placeholder }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">{label}</label>
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                disabled={!canEditReflection}
                rows={3}
                placeholder={canEditReflection ? placeholder : ""}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none",
                  canEditReflection
                    ? "border-gray-200 bg-white"
                    : "border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : "Lưu check-list"}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
