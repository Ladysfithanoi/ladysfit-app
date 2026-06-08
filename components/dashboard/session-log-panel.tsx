"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronDown, ChevronUp, Loader2, ClipboardList, Pencil, Check, Copy, Clock, PenLine, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkoutLogRow, SetLogRow } from "./workout-tab";

// ── Helpers ────────────────────────────────────────────────────────────────

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
  const reps = [sl.set1Reps, sl.set2Reps, sl.set3Reps, sl.set4Reps, sl.set5Reps, sl.set6Reps]
    .filter((r): r is string => r != null && r !== "")
    .map((r) => parseFloat(r))
    .filter((n) => !isNaN(n));
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

type EditSetLogDraft = {
  id: string;
  movementName: string;
  exerciseName: string;
  sets: SetDraft[];
  exerciseNotes: string;
};

// Map persisted set-log rows into the editable table drafts.
function toSetLogDrafts(setLogs: WorkoutLogRow["setLogs"]): EditSetLogDraft[] {
  return setLogs.map((sl) => ({
    id: sl.id,
    movementName: sl.movementName,
    exerciseName: sl.exerciseName,
    exerciseNotes: sl.exerciseNotes ?? "",
    sets: [
      { load: sl.set1Load ?? "", reps: sl.set1Reps ?? "" },
      { load: sl.set2Load ?? "", reps: sl.set2Reps ?? "" },
      { load: sl.set3Load ?? "", reps: sl.set3Reps ?? "" },
      { load: sl.set4Load ?? "", reps: sl.set4Reps ?? "" },
      { load: sl.set5Load ?? "", reps: sl.set5Reps ?? "" },
      { load: sl.set6Load ?? "", reps: sl.set6Reps ?? "" },
    ],
  }));
}

// ── SignaturePad (customer signs to confirm the session) ───────────────────

export function SignaturePad({
  onConfirm,
  onCancel,
  saving,
}: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Size the canvas to its rendered width so coordinates line up 1:1.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * ratio;
    canvas.height = cssH * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">Khách ký xác nhận buổi tập</h3>
          <p className="text-xs text-gray-400 mt-0.5">Đề nghị khách dùng ngón tay ký vào ô bên dưới</p>
        </div>

        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full h-44 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 touch-none cursor-crosshair"
          style={{ touchAction: "none" }}
        />

        <div className="flex gap-2">
          <button
            onClick={clear}
            disabled={saving}
            className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            Xóa
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (canvas) onConfirm(canvas.toDataURL("image/png"));
            }}
            disabled={!hasDrawn || saving}
            className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xác nhận...</> : <><Check className="w-4 h-4" />Xác nhận & tính buổi</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LiveSessionPanel (check-in → ghi số liệu → khách ký) ───────────────────

function fmtClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Hard cap on a single session's length. Past this the timer stops and the
// session is auto-cancelled (never counted) — guards against a PT forgetting to
// check out, which would otherwise let the clock run forever.
const MAX_SESSION_MINUTES = 120;

export function LiveSessionPanel({
  log,
  sessionName,
  weekNumber,
  phase,
  clientId,
  minSessionMinutes,
  prevWeekLogs,
  onUpdated,
  onCompleted,
  onVoided,
  onDeleted,
}: {
  log: WorkoutLogRow;
  sessionName: string;
  weekNumber: number;
  phase: string;
  clientId: string;
  minSessionMinutes: number;
  prevWeekLogs: WorkoutLogRow[];
  onUpdated: (log: WorkoutLogRow) => void;
  onCompleted: (log: WorkoutLogRow, pkg: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  onVoided: (log: WorkoutLogRow) => void;
  onDeleted: (logId: string) => void;
}) {
  const [notes, setNotes] = useState(log.notes ?? "");
  const [setLogs, setSetLogs] = useState<EditSetLogDraft[]>(() => toSetLogDrafts(log.setLogs));
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [copyTargetSet, setCopyTargetSet] = useState<number>(SETS.length);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const checkInMs = log.checkInAt ? new Date(log.checkInAt).getTime() : Date.now();
  const maxMs = MAX_SESSION_MINUTES * 60000;
  const rawElapsedMs = nowMs - checkInMs;
  const overMax = rawElapsedMs >= maxMs;
  // Freeze the displayed clock at the 2-hour cap so it never runs past it.
  const elapsedMs = Math.min(rawElapsedMs, maxMs);
  const elapsedMin = elapsedMs / 60000;

  const durationMet = elapsedMin >= minSessionMinutes;

  // Live ticking clock for the elapsed timer. Stops once the 2-hour cap is hit.
  useEffect(() => {
    if (overMax) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [overMax]);

  const isCardio = isCardioSession(sessionName);
  const repRange = isCardio ? null : getRepRange(phase);
  const showSuggestions = weekNumber >= 2 && !isCardio && repRange != null;

  // ── Rule: at least 6 exercises must each have weight (load) + reps filled for
  // 3 sets before the session can be signed/completed. Applies to EVERY session
  // (cardio included) — every session here has ≥6 exercises, so fewer than 6
  // complete means data wasn't entered. (Enforced again server-side.)
  const MIN_SETS_PER_EXERCISE = 3;
  const MIN_COMPLETE_EXERCISES = 6;
  const completeExerciseCount = setLogs.filter(
    (sl) =>
      sl.sets.filter((s) => s.load.trim() !== "" && s.reps.trim() !== "").length >=
      MIN_SETS_PER_EXERCISE
  ).length;
  const setsRequirementMet = completeExerciseCount >= MIN_COMPLETE_EXERCISES;
  const canFinish = durationMet && setsRequirementMet;

  // Build "Lần trước" + suggestion lookups from the previous week's completed log.
  const prevSuggestions = new Map<string, Suggestion>();
  const prevRefs = new Map<string, string>();
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
    setSetLogs((prev) =>
      prev.map((sl, i) =>
        i === movIdx
          ? { ...sl, sets: sl.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)) }
          : sl
      )
    );
  }

  function updateExerciseNotes(movIdx: number, value: string) {
    setSetLogs((prev) => prev.map((sl, i) => (i === movIdx ? { ...sl, exerciseNotes: value } : sl)));
  }

  function copySet1To(target: number) {
    setSetLogs((prev) =>
      prev.map((sl) => {
        const first = sl.sets[0];
        if (!first.load && !first.reps) return sl;
        return {
          ...sl,
          sets: sl.sets.map((s, j) => (j > 0 && j < target ? { load: first.load, reps: first.reps } : s)),
        };
      })
    );
  }

  const canCopySet1 = setLogs.some((sl) => sl.sets[0].load || sl.sets[0].reps);

  // Clear one whole Set column (load + reps) across every movement in the session.
  function clearSetColumn(setIdx: number) {
    setSetLogs((prev) =>
      prev.map((sl) => ({
        ...sl,
        sets: sl.sets.map((s, j) => (j === setIdx ? { load: "", reps: "" } : s)),
      }))
    );
  }

  const columnHasData = (setIdx: number) =>
    setLogs.some((sl) => sl.sets[setIdx]?.load || sl.sets[setIdx]?.reps);

  function buildSetLogPayload() {
    return setLogs.map((sl) => ({
      id: sl.id,
      set1Load: sl.sets[0].load || null, set1Reps: sl.sets[0].reps || null,
      set2Load: sl.sets[1].load || null, set2Reps: sl.sets[1].reps || null,
      set3Load: sl.sets[2].load || null, set3Reps: sl.sets[2].reps || null,
      set4Load: sl.sets[3].load || null, set4Reps: sl.sets[3].reps || null,
      set5Load: sl.sets[4].load || null, set5Reps: sl.sets[4].reps || null,
      set6Load: sl.sets[5].load || null, set6Reps: sl.sets[5].reps || null,
      exerciseNotes: sl.exerciseNotes || null,
    }));
  }

  const saveProgress = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/workout-logs/${log.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || null, setLogs: buildSetLogPayload() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      const updated = (await res.json()) as WorkoutLogRow;
      onUpdated(updated);
      setToast("Đã lưu số liệu");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, log.id, notes, setLogs]);

  // Re-sync the table's exercise list with the program's CURRENT movements,
  // keeping everything the PT has already typed. Saves first so nothing is lost.
  async function syncMovements() {
    setSyncing(true);
    setError("");
    try {
      await saveProgress();
      const res = await fetch(`/api/clients/${clientId}/workout-logs/${log.id}/sync-movements`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      const updated = data as WorkoutLogRow;
      onUpdated(updated);
      setSetLogs(toSetLogDrafts(updated.setLogs));
      setToast("Đã cập nhật bài tập theo chương trình");
      setTimeout(() => setToast(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSyncing(false);
    }
  }

  // Delete the current in-progress log (checked in by mistake). Removes the row
  // and its set logs; the session goes back to the "Check-in" state.
  async function deleteLog() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/workout-logs/${log.id}`, {
        method: "DELETE",
      });
      // 404 = the log was already removed (e.g. an over-cap check-out deleted it).
      // Either way it no longer exists, so revert the UI to the Check-in state.
      if (!res.ok && res.status !== 404) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      onDeleted(log.id);
    } catch (err) {
      // Keep the confirm dialog open so the error is visible next to the button.
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setDeleting(false);
    }
  }

  // NOTE: a session is NO LONGER auto-cancelled/deleted when it runs long. The
  // package was already deducted at check-in (client signed in), so deleting it
  // would wrongly refund the client and erase their check-in signature. A long
  // session stays open until the PT gets the check-out signature; the
  // "chưa ký check-out quá 90'" alert nudges the PT/FM instead.

  // Auto-save in-progress data (notes + sets) so a refresh or accidental tab
  // close never loses what the PT has typed. The session row already lives in
  // the DB from check-in; this keeps its contents in sync as they type.
  const skipFirstAutoSave = useRef(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  useEffect(() => {
    if (skipFirstAutoSave.current) {
      skipFirstAutoSave.current = false;
      return;
    }
    setAutoSaved(false);
    const handle = setTimeout(() => {
      setAutoSaving(true);
      fetch(`/api/clients/${clientId}/workout-logs/${log.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || null, setLogs: buildSetLogPayload() }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((updated) => {
          if (updated) {
            onUpdated(updated as WorkoutLogRow);
            setAutoSaved(true);
          }
        })
        .catch(() => {})
        .finally(() => setAutoSaving(false));
    }, 1200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, setLogs]);

  async function checkOut(method: "client_app" | "signature", signatureUrl = "") {
    setFinishing(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/workout-logs/${log.id}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, signatureUrl, notes: notes || null, setLogs: buildSetLogPayload() }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Over the 2-hour cap: the server already auto-cancelled & removed this log.
        // Drop it from state so the session reverts to the Check-in button.
        if (data.autoCancelled && data.deletedId) {
          setShowSig(false);
          onDeleted(data.deletedId as string);
          return;
        }
        throw new Error(data.error ?? "Có lỗi xảy ra");
      }
      setShowSig(false);
      if (!data.valid) {
        onVoided(data as WorkoutLogRow);
      } else if (data.awaitingConfirmation) {
        // Session now waits for the client to confirm on their own app.
        onUpdated(data as WorkoutLogRow);
      } else {
        onCompleted(data as WorkoutLogRow, data.packageUpdate ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setFinishing(false);
    }
  }

  // ── Poll for the client's confirmation while the session is waiting ──
  const [confirmResult, setConfirmResult] = useState<null | "completed" | "rejected">(null);
  const [checking, setChecking] = useState(false);
  const [checkNote, setCheckNote] = useState("");

  const pollStatus = useCallback(async (): Promise<"completed" | "rejected" | null> => {
    try {
      const res = await fetch(`/api/clients/${clientId}/workout-logs?sessionId=${log.sessionId}`);
      if (!res.ok) return null;
      const logs = (await res.json()) as WorkoutLogRow[];
      const me = logs.find((l) => l.id === log.id);
      if (!me) return null;
      if (me.status === "COMPLETED") return "completed";
      if (me.status === "VOID") return "rejected";
      return null;
    } catch {
      return null;
    }
  }, [clientId, log.sessionId, log.id]);

  // Auto-check every 5s while waiting for the client to confirm.
  useEffect(() => {
    if (log.status !== "AWAITING_CONFIRMATION" || confirmResult) return;
    const t = setInterval(async () => {
      const r = await pollStatus();
      if (r) setConfirmResult(r);
    }, 5000);
    return () => clearInterval(t);
  }, [log.status, confirmResult, pollStatus]);

  // Once resolved, show the outcome briefly then bubble it up to the parent.
  useEffect(() => {
    if (!confirmResult) return;
    const t = setTimeout(async () => {
      if (confirmResult === "completed") {
        let pkg: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null = null;
        try {
          const pres = await fetch(`/api/clients/${clientId}/packages`);
          if (pres.ok) {
            const pkgs = (await pres.json()) as { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string }[];
            const newest = pkgs[pkgs.length - 1];
            if (newest) pkg = { id: newest.id, sessionsUsed: newest.sessionsUsed, sessions: newest.sessions, packageName: newest.packageName, status: newest.status };
          }
        } catch {}
        onCompleted({ ...log, status: "COMPLETED", confirmationMethod: "CLIENT_APP", confirmedAt: new Date().toISOString() }, pkg);
      } else {
        onVoided({ ...log, status: "VOID" });
      }
    }, confirmResult === "completed" ? 1600 : 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmResult]);

  async function manualCheck() {
    setChecking(true);
    setCheckNote("");
    const r = await pollStatus();
    setChecking(false);
    if (r) setConfirmResult(r);
    else {
      setCheckNote("Khách chưa xác nhận, vui lòng đợi...");
      setTimeout(() => setCheckNote(""), 3000);
    }
  }

  // ── Waiting-for-client view (PT finished, client must confirm on their app) ──
  if (log.status === "AWAITING_CONFIRMATION") {
    // Resolved: client confirmed → success
    if (confirmResult === "completed") {
      return (
        <div className="mt-3 border border-green-300 rounded-xl overflow-hidden bg-green-50">
          <div className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-green-700">Khách đã xác nhận!</p>
              <p className="text-xs text-green-600 mt-0.5">Buổi tập đã được tính thành công.</p>
            </div>
          </div>
        </div>
      );
    }
    // Resolved: client rejected → not counted
    if (confirmResult === "rejected") {
      return (
        <div className="mt-3 border border-red-300 rounded-xl overflow-hidden bg-red-50">
          <div className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-red-700">Khách báo không phải buổi của họ</p>
              <p className="text-xs text-red-600 mt-0.5">Buổi tập này không được tính.</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="mt-3 border border-amber-300 rounded-xl overflow-hidden bg-amber-50/40">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="text-xs font-extrabold text-amber-700">Đang chờ khách xác nhận</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">
            Đã gửi yêu cầu xác nhận. Đề nghị khách mở <span className="font-bold">app Ladysfit trên điện thoại của khách</span> và bấm
            {" "}<span className="font-bold text-green-700">&quot;Xác nhận đã tập&quot;</span>. Buổi tập sẽ được tính ngay khi khách xác nhận.
          </p>
          <p className="text-xs text-gray-500">
            Màn hình tự kiểm tra mỗi vài giây. Anh/chị cũng có thể bấm &quot;Kiểm tra ngay&quot;.
          </p>

          <button
            onClick={manualCheck}
            disabled={checking}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Kiểm tra ngay
          </button>
          {checkNote && <p className="text-xs text-amber-700 font-medium">{checkNote}</p>}
          {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}

          <div className="pt-2 border-t border-amber-200">
            <p className="text-[11px] text-gray-400 mb-2">Khách không tiện dùng app?</p>
            <button
              onClick={() => setShowSig(true)}
              disabled={finishing}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-60"
            >
              <PenLine className="w-3.5 h-3.5" />
              Khách ký tại đây (dự phòng)
            </button>
          </div>
        </div>
        {showSig && (
          <SignaturePad
            saving={finishing}
            onCancel={() => setShowSig(false)}
            onConfirm={(dataUrl) => checkOut("signature", dataUrl)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 border border-[#f15b5c]/30 rounded-xl overflow-hidden bg-[#fff9f9]">
      {/* Header with live timer */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#fff0f0] border-b border-[#f15b5c]/10">
        <span className="text-xs font-extrabold text-[#f15b5c] flex items-center gap-1.5 min-w-0">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f15b5c] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f15b5c]" />
          </span>
          <span className="truncate">Buổi tập đang diễn ra</span>
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-gray-700 tabular-nums">
            <Clock className="w-4 h-4 text-[#f15b5c]" />
            {fmtClock(elapsedMs)}
          </span>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            title="Xóa buổi tập này (lỡ check-in nhầm)"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Mở rộng nhật ký" : "Thu nhỏ nhật ký"}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {collapsed && (
        <div className="px-4 py-2.5 text-xs text-gray-500 flex items-center justify-between gap-2">
          <span className="truncate">
            {sessionName.split("—")[0].trim()} · {durationMet ? "Đã đủ thời gian tối thiểu" : `Còn ${Math.max(0, Math.ceil(minSessionMinutes - elapsedMin))} phút`}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="font-semibold text-[#f15b5c] hover:underline flex-shrink-0"
          >
            Mở rộng
          </button>
        </div>
      )}

      <div className={cn("p-4 space-y-3", collapsed && "hidden")}>
        {/* Duration status */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 border",
            durationMet
              ? "text-green-700 bg-green-50 border-green-100"
              : "text-gray-500 bg-gray-50 border-gray-200"
          )}
        >
          <Clock className="w-4 h-4 flex-shrink-0" />
          {durationMet
            ? `Đã đủ thời gian tối thiểu (${minSessionMinutes} phút)`
            : `Cần tối thiểu ${minSessionMinutes} phút (còn ${Math.max(0, Math.ceil(minSessionMinutes - elapsedMin))} phút)`}
        </div>

        {/* Data-quality status: ≥6 exercises need weight + reps for 3 sets */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 border",
            setsRequirementMet
              ? "text-green-700 bg-green-50 border-green-100"
              : "text-gray-500 bg-gray-50 border-gray-200"
          )}
        >
          <ClipboardList className="w-4 h-4 flex-shrink-0" />
          {setsRequirementMet
            ? `Đã điền đủ cân nặng + reps cho ${MIN_SETS_PER_EXERCISE} set ở tối thiểu ${MIN_COMPLETE_EXERCISES} bài tập`
            : `Cần điền cân nặng + số reps cho ${MIN_SETS_PER_EXERCISE} set ở tối thiểu ${MIN_COMPLETE_EXERCISES} bài tập (đã có ${completeExerciseCount}/${MIN_COMPLETE_EXERCISES})`}
        </div>

        {/* Session notes */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">Ghi chú buổi tập</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú chung buổi tập..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none bg-white"
          />
        </div>

        {/* Sync exercises with program + copy Set 1 controls */}
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={syncMovements}
            disabled={syncing || saving || finishing}
            title="Đồng bộ danh sách bài tập trong nhật ký theo chương trình hiện tại (giữ nguyên số liệu đã nhập)"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Cập nhật bài tập theo chương trình
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500">Chép Set 1 đến</span>
            <select
              value={copyTargetSet}
              onChange={(e) => setCopyTargetSet(Number(e.target.value))}
              className="h-8 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40 bg-white"
            >
              {SETS.filter((n) => n >= 2).map((n) => (
                <option key={n} value={n}>Set {n}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => copySet1To(copyTargetSet)}
              disabled={!canCopySet1}
              title={`Sao chép thông số Set 1 của tất cả bài tập sang Set 2 đến Set ${copyTargetSet}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-[#f15b5c]/30 text-xs font-bold text-[#f15b5c] bg-white hover:bg-[#fff0f0] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy className="w-3.5 h-3.5" />
              Chép
            </button>
          </div>
        </div>

        {/* Set table */}
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full rounded-xl border border-gray-100">
          <table className="w-full text-xs" style={{ minWidth: showSuggestions ? 860 : 760 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-left font-bold text-gray-400 w-32">Chuyển động</th>
                <th className="px-3 py-2 text-left font-bold text-gray-400 w-36">Bài tập</th>
                {SETS.map((n, si) => (
                  <th key={n} className="px-1 py-2 text-center font-bold text-gray-400 w-[90px]">
                    <div className="inline-flex items-center gap-1">
                      Set {n}
                      <button
                        type="button"
                        onClick={() => clearSetColumn(si)}
                        disabled={!columnHasData(si)}
                        title={`Xóa toàn bộ số liệu cột Set ${n}`}
                        className="text-gray-300 hover:text-[#f15b5c] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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
                  <tr key={sl.id} className={cn("border-b border-gray-50 last:border-0", mi % 2 === 1 && "bg-gray-50/30")}>
                    <td className="px-3 py-2 font-semibold text-gray-700 align-top pt-3">{sl.movementName}</td>
                    <td className="px-3 py-2 align-top pt-2">
                      <span className="text-gray-600 block">{sl.exerciseName || <span className="text-gray-300 italic">—</span>}</span>
                      {prevRef && (
                        <span className="text-[10px] text-gray-400 mt-0.5 block">📅 Lần trước: {prevRef}</span>
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
                              value={s.load}
                              onChange={(e) => updateSet(mi, si, "load", e.target.value)}
                              placeholder="Ví dụ: 12kg, BW, Dây xanh..."
                              className={cn(
                                "w-14 h-7 rounded-lg border text-center text-xs focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40",
                                hasData ? "border-[#f15b5c]/30 bg-white text-gray-800" : "border-gray-200 bg-white text-gray-400"
                              )}
                            />
                            <input
                              type="text"
                              value={s.reps}
                              onChange={(e) => updateSet(mi, si, "reps", e.target.value)}
                              placeholder="Ví dụ: 12-10-8, 15, 12/bên..."
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
                        onChange={(e) => updateExerciseNotes(mi, e.target.value)}
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

        {/* Feedback */}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 font-semibold">
          {autoSaving ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Đang tự động lưu...</span>
          ) : autoSaved ? (
            <span className="inline-flex items-center gap-1 text-green-600"><Check className="w-3 h-3" />Đã tự động lưu</span>
          ) : (
            <span>Dữ liệu được tự động lưu, không lo mất khi thoát trang</span>
          )}
        </div>
        {toast && (
          <p className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">✓ {toast}</p>
        )}
        {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}

        {/* Action — khách ký check-out trên máy PT để xác nhận PT đã dạy buổi này */}
        <div className="pt-1">
          <button
            onClick={async () => { await saveProgress(); setShowSig(true); }}
            disabled={finishing || saving || !canFinish}
            title={
              !durationMet
                ? `Cần tối thiểu ${minSessionMinutes} phút`
                : !setsRequirementMet
                  ? `Cần điền cân nặng + số reps cho ${MIN_SETS_PER_EXERCISE} set ở tối thiểu ${MIN_COMPLETE_EXERCISES} bài tập`
                  : "Khách ký check-out để xác nhận PT đã dạy buổi này"
            }
            className="w-full h-11 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
            Khách ký check-out & kết thúc buổi
          </button>
          <p className="text-[11px] text-gray-400 mt-1.5 text-center">
            Buổi tập đã được trừ vào lộ trình khi check-in. Khách ký check-out để tính buổi dạy cho PT.
          </p>
        </div>
      </div>

      {showSig && (
        <SignaturePad
          saving={finishing}
          onCancel={() => setShowSig(false)}
          onConfirm={(dataUrl) => checkOut("signature", dataUrl)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900">Xóa buổi tập này?</p>
                <p className="text-xs text-gray-500 mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              Toàn bộ số liệu đã nhập trong buổi đang diễn ra này sẽ bị xóa. Buổi tập sẽ quay về trạng thái chưa check-in.
            </p>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={deleteLog}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors"
              >
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xóa...</> : "Xóa buổi này"}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); setError(""); }}
                disabled={deleting}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [setLogs, setSetLogs] = useState<EditSetLogDraft[]>(() => toSetLogDrafts(log.setLogs));
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
            set1Load: sl.sets[0].load || null, set1Reps: sl.sets[0].reps || null,
            set2Load: sl.sets[1].load || null, set2Reps: sl.sets[1].reps || null,
            set3Load: sl.sets[2].load || null, set3Reps: sl.sets[2].reps || null,
            set4Load: sl.sets[3].load || null, set4Reps: sl.sets[3].reps || null,
            set5Load: sl.sets[4].load || null, set5Reps: sl.sets[4].reps || null,
            set6Load: sl.sets[5].load || null, set6Reps: sl.sets[5].reps || null,
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
                          value={s.load}
                          onChange={(e) => updateSet(si, setIdx, "load", e.target.value)}
                          placeholder="Ví dụ: 12kg, BW, Dây xanh..."
                          className="w-14 h-7 rounded-lg border border-blue-200 text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white text-gray-800"
                        />
                        <input
                          type="text"
                          value={s.reps}
                          onChange={(e) => updateSet(si, setIdx, "reps", e.target.value)}
                          placeholder="Ví dụ: 12-10-8, 15, 12/bên..."
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

// ── WeekLogOverview ────────────────────────────────────────────────────────
// Read-only "bảng tổng quan" cho cả một tuần: mỗi buổi tập là một thẻ, hiển thị
// nhật ký đã hoàn thành (ngày, thời lượng, số liệu từng set) để xem nhanh cả
// tuần thay vì mở từng buổi một.

export type WeekOverviewSession = {
  id: string;
  label: string; // "Buổi 5"
  type: string; // loại buổi, ví dụ "Tạ 1" / "Cardio"
  logs: WorkoutLogRow[]; // các log COMPLETED của buổi này trong tuần, mới nhất trước
};

export function WeekLogOverview({
  weekNumber,
  sessions,
  onClose,
}: {
  weekNumber: number;
  sessions: WeekOverviewSession[];
  onClose: () => void;
}) {
  const trainedCount = sessions.filter((s) => s.logs.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900">Nhật ký tập — Tuần {weekNumber}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{trainedCount}/{sessions.length} buổi đã tập trong tuần</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {sessions.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <ClipboardList className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Tuần này chưa có buổi tập</p>
            </div>
          ) : (
            sessions.map((s) => {
              const latest = s.logs[0] ?? null;
              return (
                <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* Session header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gray-50/70 border-b border-gray-100">
                    <span className="text-sm font-bold text-gray-800">
                      {s.label}
                      {s.type && <span className="ml-2 text-xs font-semibold text-gray-400">{s.type}</span>}
                    </span>
                    {latest ? (
                      <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-semibold text-gray-600">{fmtDate(latest.sessionDate)}</span>
                        {latest.checkInAt && latest.checkOutAt && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round((new Date(latest.checkOutAt).getTime() - new Date(latest.checkInAt).getTime()) / 60000)} phút
                          </span>
                        )}
                        {s.logs.length > 1 && (
                          <span className="text-gray-400">(+{s.logs.length - 1} lần khác)</span>
                        )}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-400">Chưa tập</span>
                    )}
                  </div>

                  {/* Session body */}
                  {latest ? (
                    <div className="px-3 py-2.5">
                      {latest.notes && (
                        <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-2.5">
                          {latest.notes}
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
                            </tr>
                          </thead>
                          <tbody>
                            {latest.setLogs.map((sl, i) => {
                              const setValues = [
                                { load: sl.set1Load, reps: sl.set1Reps },
                                { load: sl.set2Load, reps: sl.set2Reps },
                                { load: sl.set3Load, reps: sl.set3Reps },
                                { load: sl.set4Load, reps: sl.set4Reps },
                                { load: sl.set5Load, reps: sl.set5Reps },
                                { load: sl.set6Load, reps: sl.set6Reps },
                              ];
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
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-xs text-gray-300 italic">Buổi này chưa được ghi nhật ký trong tuần.</div>
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

// ── SessionLogHistory ──────────────────────────────────────────────────────

export function SessionLogHistory({
  sessionName,
  logs: initialLogs,
  phase,
  clientId,
  onLogUpdated,
  onLogDeleted,
  onClose,
}: {
  sessionName: string;
  logs: WorkoutLogRow[];
  phase: string;
  clientId: string;
  onLogUpdated: (updated: WorkoutLogRow) => void;
  onLogDeleted: (logId: string, pkg?: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const isCardio = isCardioSession(sessionName);
  const showSuggestions = !isCardio && getRepRange(phase) != null;

  function handleLogSaved(updated: WorkoutLogRow) {
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    onLogUpdated(updated);
    setEditingLogId(null);
  }

  async function handleDelete(logId: string) {
    setDeletingId(logId);
    setDeleteError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/workout-logs/${logId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      onLogDeleted(logId, data.packageUpdate ?? null);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeletingId(null);
    }
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
                      {/* Delete button — removes the session and un-counts it */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(log.id); setDeleteError(""); }}
                        title="Xóa buổi tập này (trừ khỏi số buổi đã tính)"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
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

                        {/* Check-in/check-out confirmation */}
                        {(log.signatureUrl || log.checkInAt) && (
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {log.checkInAt && log.checkOutAt && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
                                <Clock className="w-3 h-3" />
                                Thời lượng: {Math.round((new Date(log.checkOutAt).getTime() - new Date(log.checkInAt).getTime()) / 60000)} phút
                              </span>
                            )}
                            {log.confirmationMethod === "CLIENT_APP" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg px-2.5 py-1">
                                <Check className="w-3 h-3" /> Khách xác nhận qua app
                              </span>
                            )}
                            {log.confirmationMethod === "SIGNATURE" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                                <PenLine className="w-3 h-3" /> Ký tại chỗ (dự phòng)
                              </span>
                            )}
                            {log.signatureUrl ? (
                              <div className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={log.signatureUrl}
                                  alt="Chữ ký khách"
                                  className="h-12 rounded-lg border border-gray-200 bg-white"
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirm delete a recorded session */}
      {confirmDeleteId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900">Xóa buổi tập này?</p>
                <p className="text-xs text-gray-500 mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              Buổi tập sẽ bị xóa khỏi lịch sử và <span className="font-bold text-red-600">trừ khỏi số buổi đã tính</span>. Nếu ghi lại nhật ký buổi này sau đó thì sẽ được tính lại.
            </p>
            {deleteError && <p className="text-xs text-red-500 font-medium">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors"
              >
                {deletingId === confirmDeleteId ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xóa...</> : "Xóa buổi này"}
              </button>
              <button
                onClick={() => { setConfirmDeleteId(null); setDeleteError(""); }}
                disabled={deletingId === confirmDeleteId}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
