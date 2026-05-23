"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp, Loader2, ClipboardList, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateMaskInput } from "@/components/ui/date-mask-input";
import type { WorkoutSession, WorkoutLogRow, SetLogRow } from "./workout-tab";
import { useFormAutoSave, loadDraft } from "@/hooks/use-form-auto-save";

// ── Helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const SETS = [1, 2, 3, 4, 5, 6] as const;

// ── Progressive overload logic ─────────────────────────────────────────────

const REP_RANGES: Record<string, { min: number; max: number }> = {
  "Giai đoạn 1": { min: 15, max: 20 },
  "Giai đoạn 2": { min: 12, max: 15 },
  "Giai đoạn 3": { min: 10, max: 12 },
};

function getRepRange(phase: string): { min: number; max: number } | null {
  if (phase.startsWith("Giai đoạn 1")) return REP_RANGES["Giai đoạn 1"];
  if (phase.startsWith("Giai đoạn 2")) return REP_RANGES["Giai đoạn 2"];
  if (phase.startsWith("Giai đoạn 3")) return REP_RANGES["Giai đoạn 3"];
  return null;
}

function isCardioSession(sessionName: string): boolean {
  return sessionName.includes("Cardio") || sessionName.includes("cardio");
}

type Suggestion =
  | { type: "increase_weight"; avgReps: number }
  | { type: "increase_reps"; targetReps: number; avgReps: number }
  | null;

function avgRepsFromSetLog(sl: SetLogRow): number | null {
  const reps = [sl.set1Reps, sl.set2Reps, sl.set3Reps, sl.set4Reps, sl.set5Reps, sl.set6Reps].filter(
    (r): r is number => r != null
  );
  if (reps.length === 0) return null;
  return reps.reduce((a, b) => a + b, 0) / reps.length;
}

function calcSuggestion(avgReps: number, range: { min: number; max: number }): Suggestion {
  if (avgReps > range.max) return { type: "increase_weight", avgReps };
  if (avgReps >= range.min) return { type: "increase_reps", targetReps: range.max, avgReps };
  return { type: "increase_reps", targetReps: range.min, avgReps };
}

function getSuggestionFromSetLog(sl: SetLogRow, phase: string): Suggestion {
  const range = getRepRange(phase);
  if (!range) return null;
  const avg = avgRepsFromSetLog(sl);
  if (avg == null) return null;
  return calcSuggestion(avg, range);
}

// Build "Lần trước" reference summary for a SetLogRow
function buildPrevRef(sl: SetLogRow): string | null {
  const sets = [
    { load: sl.set1Load, reps: sl.set1Reps },
    { load: sl.set2Load, reps: sl.set2Reps },
    { load: sl.set3Load, reps: sl.set3Reps },
    { load: sl.set4Load, reps: sl.set4Reps },
    { load: sl.set5Load, reps: sl.set5Reps },
    { load: sl.set6Load, reps: sl.set6Reps },
  ].filter((s) => s.load != null || s.reps != null);
  if (sets.length === 0) return null;
  const first = sets[0];
  const parts: string[] = [];
  if (first.load) parts.push(`${first.load}kg`);
  if (first.reps) parts.push(`×${first.reps} reps`);
  return parts.join(" ") || null;
}

// ── SuggestionBadge ────────────────────────────────────────────────────────

function SuggestionBadge({ suggestion }: { suggestion: Suggestion }) {
  if (!suggestion) return null;
  if (suggestion.type === "increase_weight") {
    return (
      <span
        title={`Trung bình ${suggestion.avgReps.toFixed(1)} reps/set - đã vượt ngưỡng tối đa, hãy tăng mức tạ`}
        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 cursor-help whitespace-nowrap select-none"
      >
        💪 Nên tăng tạ
      </span>
    );
  }
  return (
    <span
      title={`Trung bình ${suggestion.avgReps.toFixed(1)} reps/set - hãy cố đạt ${suggestion.targetReps} reps/set trước khi tăng tạ`}
      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 cursor-help whitespace-nowrap select-none"
    >
      📈 Tăng Reps lên {suggestion.targetReps}
    </span>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

type SetDraft = { load: string; reps: string };

type SetLogDraft = {
  movementId: string | null;
  movementName: string;
  exerciseName: string;
  sets: SetDraft[];
  exerciseNotes: string;
};

type EditSetLogDraft = {
  id: string;
  movementName: string;
  exerciseName: string;
  sets: SetDraft[];
  exerciseNotes: string;
};

// ── SessionLogForm ─────────────────────────────────────────────────────────

export function SessionLogForm({
  session,
  weekId,
  weekNumber,
  programId,
  clientId,
  phase,
  prevWeekLogs,
  onSaved,
  onClose,
}: {
  session: WorkoutSession;
  weekId: string;
  weekNumber: number;
  programId: string;
  clientId: string;
  phase: string;
  prevWeekLogs: WorkoutLogRow[];
  onSaved: (log: WorkoutLogRow, pkg: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState("");
  const [setLogs, setSetLogs] = useState<SetLogDraft[]>(() =>
    session.movements.map((m) => ({
      movementId: m.id,
      movementName: m.movementName,
      exerciseName: m.selectedExercise,
      sets: SETS.map(() => ({ load: "", reps: "" })),
      exerciseNotes: "",
    }))
  );
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState("");

  // ── Auto-save draft ────────────────────────────────────────────────────────
  const draftKey = `ladysfit_draft_session_${clientId}_${programId}_${weekId}_${session.id}`;
  const { clearDraft: clearSessionDraft } = useFormAutoSave(
    draftKey,
    { date, notes, setLogs },
    !saving && isDirty
  );

  // Restore draft on mount (no DB fetch here — state starts from session.movements)
  useEffect(() => {
    type SessionDraft = { date: string; notes: string; setLogs: SetLogDraft[] };
    const draft = loadDraft<SessionDraft>(draftKey);
    if (!draft) return;
    if (draft.date) setDate(draft.date);
    if (draft.notes !== undefined) setNotes(draft.notes);
    // Only restore setLogs if structure matches current session
    if (Array.isArray(draft.setLogs) && draft.setLogs.length === session.movements.length) {
      setSetLogs(draft.setLogs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const isCardio = isCardioSession(session.sessionName);
  const repRange = isCardio ? null : getRepRange(phase);
  const showSuggestions = weekNumber >= 2 && !isCardio && repRange != null;

  // Build lookup: movementName → suggestion + "Lần trước" reference
  const prevSuggestions = new Map<string, Suggestion>();
  const prevRefs = new Map<string, string>(); // movementName → "30kg × 12 reps"

  if (prevWeekLogs.length > 0) {
    const prevLog = prevWeekLogs[0];
    for (const sl of prevLog.setLogs) {
      const ref = buildPrevRef(sl);
      if (ref) prevRefs.set(sl.movementName, ref);
      if (showSuggestions && repRange) {
        const avg = avgRepsFromSetLog(sl);
        if (avg != null) prevSuggestions.set(sl.movementName, calcSuggestion(avg, repRange));
      }
    }
  }

  function updateSet(movIdx: number, setIdx: number, field: "load" | "reps", value: string) {
    setIsDirty(true);
    setSetLogs((prev) =>
      prev.map((sl, i) =>
        i === movIdx
          ? { ...sl, sets: sl.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)) }
          : sl
      )
    );
  }

  function updateNotes(movIdx: number, value: string) {
    setIsDirty(true);
    setSetLogs((prev) => prev.map((sl, i) => (i === movIdx ? { ...sl, exerciseNotes: value } : sl)));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        programId,
        weekId,
        sessionId: session.id,
        sessionDate: new Date(date).toISOString(),
        notes: notes || null,
        setLogs: setLogs.map((sl) => ({
          movementId: sl.movementId,
          movementName: sl.movementName,
          exerciseName: sl.exerciseName,
          set1Load: sl.sets[0].load || null, set1Reps: sl.sets[0].reps ? parseInt(sl.sets[0].reps) : null,
          set2Load: sl.sets[1].load || null, set2Reps: sl.sets[1].reps ? parseInt(sl.sets[1].reps) : null,
          set3Load: sl.sets[2].load || null, set3Reps: sl.sets[2].reps ? parseInt(sl.sets[2].reps) : null,
          set4Load: sl.sets[3].load || null, set4Reps: sl.sets[3].reps ? parseInt(sl.sets[3].reps) : null,
          set5Load: sl.sets[4].load || null, set5Reps: sl.sets[4].reps ? parseInt(sl.sets[4].reps) : null,
          set6Load: sl.sets[5].load || null, set6Reps: sl.sets[5].reps ? parseInt(sl.sets[5].reps) : null,
          exerciseNotes: sl.exerciseNotes || null,
        })),
      };

      const res = await fetch(`/api/clients/${clientId}/workout-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      const data = await res.json();
      const { packageUpdate, ...logData } = data;
      const saved = logData as WorkoutLogRow;
      if (packageUpdate) {
        setToast(`Đã lưu buổi tập! Tổng: ${packageUpdate.sessionsUsed}/${packageUpdate.sessions} buổi · ${packageUpdate.packageName}`);
        setTimeout(() => setToast(""), 4000);
      }
      clearSessionDraft();
      setIsDirty(false);
      onSaved(saved, packageUpdate ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 border border-[#f15b5c]/20 rounded-xl overflow-hidden bg-[#fff9f9]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#fff0f0] border-b border-[#f15b5c]/10">
        <span className="text-xs font-extrabold text-[#f15b5c]">Ghi lại buổi tập</span>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f15b5c]/10 text-gray-400 hover:text-[#f15b5c]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Date + session notes */}
        <div className="flex flex-wrap gap-3 items-start">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Ngày tập</label>
            <DateMaskInput
              value={date}
              onChange={(v) => { setDate(v); setIsDirty(true); }}
              className="h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white"
            />
          </div>
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="text-xs font-semibold text-gray-500">Ghi chú buổi tập</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
              placeholder="Ghi chú chung buổi tập..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none bg-white"
            />
          </div>
        </div>

        {/* Set table */}
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full rounded-xl border border-gray-100">
          <table className="w-full text-xs" style={{ minWidth: showSuggestions ? 860 : 760 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-left font-bold text-gray-400 w-32">Chuyển động</th>
                <th className="px-3 py-2 text-left font-bold text-gray-400 w-36">Bài tập</th>
                {SETS.map((n) => (
                  <th key={n} className="px-1 py-2 text-center font-bold text-gray-400 w-[90px]">
                    Set {n}
                    <div className="text-[9px] text-gray-300 font-normal">kg / reps</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-bold text-gray-400 w-28">Ghi chú</th>
                {showSuggestions && (
                  <th className="px-3 py-2 text-left font-bold text-gray-400 w-32">Gợi ý</th>
                )}
              </tr>
            </thead>
            <tbody>
              {setLogs.map((sl, mi) => {
                const suggestion = showSuggestions ? (prevSuggestions.get(sl.movementName) ?? null) : null;
                const prevRef = prevRefs.get(sl.movementName);
                return (
                  <tr key={mi} className={cn("border-b border-gray-50 last:border-0", mi % 2 === 1 && "bg-gray-50/30")}>
                    <td className="px-3 py-2 font-semibold text-gray-700 align-top pt-3">
                      {sl.movementName}
                    </td>
                    <td className="px-3 py-2 align-top pt-2">
                      <span className="text-gray-600 block">{sl.exerciseName || <span className="text-gray-300 italic">—</span>}</span>
                      {prevRef && (
                        <span className="text-[10px] text-gray-400 mt-0.5 block">
                          📅 Lần trước: {prevRef}
                        </span>
                      )}
                    </td>
                    {SETS.map((_, si) => {
                      const s = sl.sets[si];
                      const hasData = s.load || s.reps;
                      return (
                        <td key={si} className="px-1 py-1.5 align-top">
                          <div className="flex flex-col gap-0.5 items-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={s.load}
                              onChange={(e) => updateSet(mi, si, "load", e.target.value)}
                              placeholder="—"
                              className={cn(
                                "w-14 h-7 rounded-lg border text-center text-xs focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40",
                                hasData ? "border-[#f15b5c]/30 bg-white text-gray-800" : "border-gray-200 bg-white text-gray-400"
                              )}
                            />
                            <input
                              type="number"
                              min="0"
                              value={s.reps}
                              onChange={(e) => updateSet(mi, si, "reps", e.target.value)}
                              placeholder="—"
                              className={cn(
                                "w-14 h-7 rounded-lg border text-center text-xs focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40",
                                hasData ? "border-[#f15b5c]/30 bg-white text-gray-800" : "border-gray-200 bg-white text-gray-400"
                              )}
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 align-top">
                      <textarea
                        rows={2}
                        value={sl.exerciseNotes}
                        onChange={(e) => updateNotes(mi, e.target.value)}
                        placeholder="VD: đau gối..."
                        className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30 resize-none bg-white"
                      />
                    </td>
                    {showSuggestions && (
                      <td className="px-3 py-2 align-top pt-3">
                        {suggestion ? <SuggestionBadge suggestion={suggestion} /> : <span className="text-gray-200 text-[10px]">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        {toast && (
          <p className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            ✓ {toast}
          </p>
        )}
        {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-9 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang lưu...</> : "Lưu buổi tập"}
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditLogPanel (inline edit inside history) ──────────────────────────────

function EditLogPanel({
  log,
  clientId,
  onSaved,
  onClose,
}: {
  log: WorkoutLogRow;
  clientId: string;
  onSaved: (updated: WorkoutLogRow) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(log.notes ?? "");
  const [setLogs, setSetLogs] = useState<EditSetLogDraft[]>(() =>
    log.setLogs.map((sl) => ({
      id: sl.id,
      movementName: sl.movementName,
      exerciseName: sl.exerciseName,
      exerciseNotes: sl.exerciseNotes ?? "",
      sets: [
        { load: sl.set1Load ?? "", reps: sl.set1Reps?.toString() ?? "" },
        { load: sl.set2Load ?? "", reps: sl.set2Reps?.toString() ?? "" },
        { load: sl.set3Load ?? "", reps: sl.set3Reps?.toString() ?? "" },
        { load: sl.set4Load ?? "", reps: sl.set4Reps?.toString() ?? "" },
        { load: sl.set5Load ?? "", reps: sl.set5Reps?.toString() ?? "" },
        { load: sl.set6Load ?? "", reps: sl.set6Reps?.toString() ?? "" },
      ],
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateSet(slIdx: number, setIdx: number, field: "load" | "reps", value: string) {
    setSetLogs((prev) =>
      prev.map((sl, i) =>
        i === slIdx ? { ...sl, sets: sl.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)) } : sl
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/workout-logs/${log.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || null,
          setLogs: setLogs.map((sl) => ({
            id: sl.id,
            set1Load: sl.sets[0].load || null, set1Reps: sl.sets[0].reps ? parseInt(sl.sets[0].reps) : null,
            set2Load: sl.sets[1].load || null, set2Reps: sl.sets[1].reps ? parseInt(sl.sets[1].reps) : null,
            set3Load: sl.sets[2].load || null, set3Reps: sl.sets[2].reps ? parseInt(sl.sets[2].reps) : null,
            set4Load: sl.sets[3].load || null, set4Reps: sl.sets[3].reps ? parseInt(sl.sets[3].reps) : null,
            set5Load: sl.sets[4].load || null, set5Reps: sl.sets[4].reps ? parseInt(sl.sets[4].reps) : null,
            set6Load: sl.sets[5].load || null, set6Reps: sl.sets[5].reps ? parseInt(sl.sets[5].reps) : null,
            exerciseNotes: sl.exerciseNotes || null,
          })),
        }),
      });
      if (!res.ok) throw new Error("Có lỗi khi cập nhật");
      const updated = await res.json() as WorkoutLogRow;
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-blue-50 bg-blue-50/30 px-4 pb-4 pt-3 space-y-3">
      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500">Ghi chú buổi tập</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none bg-white"
          placeholder="Ghi chú..."
        />
      </div>

      {/* Set table */}
      <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full rounded-lg border border-gray-100">
        <table className="w-full text-xs" style={{ minWidth: 540 }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-3 py-2 text-left font-bold text-gray-400">Bài tập</th>
              {SETS.map((n) => (
                <th key={n} className="px-1 py-2 text-center font-bold text-gray-400 w-[90px]">
                  Set {n}
                  <div className="text-[9px] text-gray-300 font-normal">kg / reps</div>
                </th>
              ))}
              <th className="px-2 py-2 text-left font-bold text-gray-400 w-24">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {setLogs.map((sl, si) => (
              <tr key={si} className={cn("border-b border-gray-50 last:border-0", si % 2 === 1 && "bg-gray-50/30")}>
                <td className="px-3 py-2">
                  <p className="font-semibold text-gray-700">{sl.movementName}</p>
                  <p className="text-gray-400">{sl.exerciseName}</p>
                </td>
                {SETS.map((_, setIdx) => {
                  const s = sl.sets[setIdx];
                  return (
                    <td key={setIdx} className="px-1 py-1.5 align-top">
                      <div className="flex flex-col gap-0.5 items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={s.load}
                          onChange={(e) => updateSet(si, setIdx, "load", e.target.value)}
                          placeholder="—"
                          className="w-14 h-7 rounded-lg border border-blue-200 text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white text-gray-800"
                        />
                        <input
                          type="number"
                          min="0"
                          value={s.reps}
                          onChange={(e) => updateSet(si, setIdx, "reps", e.target.value)}
                          placeholder="—"
                          className="w-14 h-7 rounded-lg border border-blue-200 text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white text-gray-800"
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 align-top">
                  <textarea
                    rows={2}
                    value={sl.exerciseNotes}
                    onChange={(e) =>
                      setSetLogs((prev) => prev.map((r, i) => i === si ? { ...r, exerciseNotes: e.target.value } : r))
                    }
                    className="w-full rounded-lg border border-blue-200 px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none bg-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-white text-xs font-bold disabled:opacity-60 bg-blue-500 hover:bg-blue-600"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          {saving ? "Đang lưu..." : "Lưu chỉnh sửa"}
        </button>
        <button
          onClick={onClose}
          className="h-8 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

// ── SessionLogHistory ──────────────────────────────────────────────────────

export function SessionLogHistory({
  sessionName,
  logs: initialLogs,
  phase,
  clientId,
  onLogUpdated,
  onClose,
}: {
  sessionName: string;
  logs: WorkoutLogRow[];
  phase: string;
  clientId: string;
  onLogUpdated: (updated: WorkoutLogRow) => void;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const isCardio = isCardioSession(sessionName);
  const showSuggestions = !isCardio && getRepRange(phase) != null;

  function handleLogSaved(updated: WorkoutLogRow) {
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    onLogUpdated(updated);
    setEditingLogId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900">Lịch sử buổi tập</h3>
            <p className="text-xs text-gray-400 mt-0.5">{sessionName} · {logs.length} lần ghi</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {logs.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <ClipboardList className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Chưa có buổi nào được ghi lại</p>
            </div>
          ) : (
            logs.map((log) => {
              const isOpen = expanded === log.id;
              const isEditing = editingLogId === log.id;
              const hasAnyData = log.setLogs.some(
                (sl) => sl.set1Load || sl.set1Reps || sl.set2Load || sl.set2Reps || sl.set3Load || sl.set3Reps
              );
              return (
                <div key={log.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* Row header */}
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors">
                    <button
                      className="flex-1 flex items-center gap-3 text-left"
                      onClick={() => { setExpanded(isOpen ? null : log.id); setEditingLogId(null); }}
                    >
                      <span className="text-sm font-bold text-gray-800">{fmtDate(log.sessionDate)}</span>
                      {log.notes && (
                        <span className="text-xs text-gray-500 truncate max-w-[160px]">{'"'}{log.notes}{'"'}</span>
                      )}
                      {!hasAnyData && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Chưa ghi số liệu</span>
                      )}
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{log.createdBy.name ?? "PT"}</span>
                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditing) {
                            setEditingLogId(null);
                          } else {
                            setExpanded(log.id);
                            setEditingLogId(log.id);
                          }
                        }}
                        title="Chỉnh sửa buổi tập này"
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          isEditing
                            ? "bg-blue-100 text-blue-600"
                            : "text-gray-300 hover:text-blue-500 hover:bg-blue-50"
                        )}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setExpanded(isOpen ? null : log.id); setEditingLogId(null); }}
                        className="text-gray-400"
                      >
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    isEditing ? (
                      <EditLogPanel
                        log={log}
                        clientId={clientId}
                        onSaved={handleLogSaved}
                        onClose={() => setEditingLogId(null)}
                      />
                    ) : (
                      <div className="border-t border-gray-50 px-4 pb-4 pt-3">
                        {log.notes && (
                          <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-3">
                            {log.notes}
                          </p>
                        )}
                        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full rounded-lg border border-gray-100">
                          <table className="w-full text-xs" style={{ minWidth: 520 }}>
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-3 py-2 text-left font-bold text-gray-400">Bài tập</th>
                                {SETS.map((n) => (
                                  <th key={n} className="px-2 py-2 text-center font-bold text-gray-400">Set {n}</th>
                                ))}
                                {showSuggestions && (
                                  <th className="px-3 py-2 text-left font-bold text-gray-400">Gợi ý</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {log.setLogs.map((sl, i) => {
                                const setValues = [
                                  { load: sl.set1Load, reps: sl.set1Reps },
                                  { load: sl.set2Load, reps: sl.set2Reps },
                                  { load: sl.set3Load, reps: sl.set3Reps },
                                  { load: sl.set4Load, reps: sl.set4Reps },
                                  { load: sl.set5Load, reps: sl.set5Reps },
                                  { load: sl.set6Load, reps: sl.set6Reps },
                                ];
                                const suggestion = showSuggestions ? getSuggestionFromSetLog(sl, phase) : null;
                                return (
                                  <tr key={i} className={cn("border-b border-gray-50 last:border-0", i % 2 === 1 && "bg-gray-50/30")}>
                                    <td className="px-3 py-2">
                                      <p className="font-semibold text-gray-700">{sl.movementName}</p>
                                      <p className="text-gray-400">{sl.exerciseName}</p>
                                      {sl.exerciseNotes && (
                                        <p className="text-gray-400 italic mt-0.5">{'"'}{sl.exerciseNotes}{'"'}</p>
                                      )}
                                    </td>
                                    {setValues.map((sv, si) => (
                                      <td key={si} className="px-2 py-2 text-center">
                                        {sv.load != null || sv.reps != null ? (
                                          <div className="space-y-0.5">
                                            {sv.load != null && <div className="font-bold text-[#f15b5c]">{sv.load}</div>}
                                            {sv.reps != null && <div className="text-gray-600">×{sv.reps}</div>}
                                          </div>
                                        ) : (
                                          <span className="text-gray-200">—</span>
                                        )}
                                      </td>
                                    ))}
                                    {showSuggestions && (
                                      <td className="px-3 py-2 align-top">
                                        {suggestion ? <SuggestionBadge suggestion={suggestion} /> : <span className="text-gray-200">—</span>}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
