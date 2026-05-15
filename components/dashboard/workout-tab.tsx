"use client";

import { useState, useEffect, useCallback } from "react";
import { Archive, ChevronDown, ChevronUp, ClipboardList, Dumbbell, Loader2, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PHASE1_WORKOUT_TYPE,
  MOVEMENT_BASE_CODES,
  getSessionTypeOptions,
  getSlotsForSessionType,
  getPhaseLabel,
  getDefaultReps,
} from "@/lib/workout-structure";
import {
  getAllowedWorkoutTypeOptions,
} from "@/lib/workout-permissions";
import { SessionLogForm, SessionLogHistory } from "./session-log-panel";

// ── Types ──────────────────────────────────────────────────────────────────

export type WorkoutMovement = {
  id: string;
  movementCode: string;
  movementName: string;
  selectedExercise: string;
  sets: number;
  reps: string;
  order: number;
};

export type WorkoutSession = {
  id: string;
  sessionName: string;
  order: number;
  movements: WorkoutMovement[];
};

export type WorkoutWeek = {
  id: string;
  weekNumber: number;
  notes: string | null;
  sessions: WorkoutSession[];
};

export type WorkoutProgram = {
  id: string;
  phase: string;
  workoutType: string | null;
  sessionsPerWeek: number;
  currentWeek: number;
  notes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
  packageEnrollment: { id: string; packageName: string } | null;
  weeks: WorkoutWeek[];
  sessions: WorkoutSession[]; // legacy sessions without a week
};

export type SetLogRow = {
  id: string;
  movementId: string | null;
  movementName: string;
  exerciseName: string;
  set1Load: string | null; set1Reps: number | null;
  set2Load: string | null; set2Reps: number | null;
  set3Load: string | null; set3Reps: number | null;
  set4Load: string | null; set4Reps: number | null;
  set5Load: string | null; set5Reps: number | null;
  set6Load: string | null; set6Reps: number | null;
  exerciseNotes: string | null;
};

export type WorkoutLogRow = {
  id: string;
  sessionId: string;
  weekId: string;
  programId: string;
  sessionDate: string;
  notes: string | null;
  createdBy: { id: string; name: string | null };
  createdAt: string;
  setLogs: SetLogRow[];
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Style constants ────────────────────────────────────────────────────────

const inputCls =
  "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";
const selectCls = inputCls;

// ── ExerciseSelect ─────────────────────────────────────────────────────────

function ExerciseSelect({
  phase,
  movementCode,
  value,
  onChange,
}: {
  phase: string;
  movementCode: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([]);
  const baseCode = MOVEMENT_BASE_CODES[movementCode] ?? movementCode;

  useEffect(() => {
    const params = new URLSearchParams({ phase, movement: baseCode });
    fetch(`/api/exercises?${params}`)
      .then((r) => r.json())
      .then(setExercises)
      .catch(() => {});
  }, [phase, baseCode]);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(selectCls, "h-9 text-xs")}>
      <option value="">— Chọn bài tập —</option>
      {exercises.map((ex) => (
        <option key={ex.id} value={ex.name}>{ex.name}</option>
      ))}
      <option value="__custom__">Tự nhập...</option>
    </select>
  );
}

// ── Draft types for edit mode ──────────────────────────────────────────────

type DraftMovement = {
  movementCode: string;
  movementName: string;
  selectedExercise: string;
  customExercise: string;
  sets: number;
  reps: string;
  order: number;
};

type DraftSession = {
  sessionName: string;
  sessionType: string;
  order: number;
  movements: DraftMovement[];
};

function sessionToDraft(s: WorkoutSession): DraftSession {
  const parts = s.sessionName.split("—");
  const sessionType = parts.length > 1 ? parts.slice(1).join("—").trim() : s.sessionName;
  return {
    sessionName: s.sessionName,
    sessionType,
    order: s.order,
    movements: s.movements.map((m) => ({
      movementCode: m.movementCode,
      movementName: m.movementName,
      selectedExercise: m.selectedExercise,
      customExercise: "",
      sets: m.sets,
      reps: m.reps,
      order: m.order,
    })),
  };
}

function buildMovementsFromType(sessionType: string, workoutType?: string, phase?: string): DraftMovement[] {
  const isCardio = sessionType === "Cardio";
  return getSlotsForSessionType(sessionType, workoutType).map((slot, i) => ({
    movementCode: slot.code,
    movementName: slot.name,
    selectedExercise: "",
    customExercise: "",
    sets: isCardio ? 6 : 3,
    reps: isCardio ? "20-60s" : getDefaultReps(phase ?? "Giai đoạn 1"),
    order: i,
  }));
}

// ── EditMovementRow ────────────────────────────────────────────────────────

function EditMovementRow({
  mov,
  phase,
  onChange,
}: {
  mov: DraftMovement;
  phase: string;
  onChange: (updated: DraftMovement) => void;
}) {
  const isCustom = mov.selectedExercise === "__custom__";
  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 pr-3 text-xs font-semibold text-gray-600 whitespace-nowrap w-32 align-top pt-3">
        {mov.movementName}
      </td>
      <td className="py-2 pr-3 min-w-[180px]">
        <ExerciseSelect
          phase={phase}
          movementCode={mov.movementCode}
          value={mov.selectedExercise}
          onChange={(v) =>
            onChange({ ...mov, selectedExercise: v, customExercise: v !== "__custom__" ? "" : mov.customExercise })
          }
        />
        {isCustom && (
          <input
            type="text"
            placeholder="Nhập tên bài tập..."
            value={mov.customExercise}
            onChange={(e) => onChange({ ...mov, customExercise: e.target.value })}
            className="mt-1 w-full h-8 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          />
        )}
      </td>
      <td className="py-2 pr-3 w-16">
        <span className="text-sm text-gray-500">{mov.sets}</span>
      </td>
      <td className="py-2 w-28">
        <span className="text-sm text-gray-500">{mov.reps}</span>
      </td>
    </tr>
  );
}

// ── ProgramView ────────────────────────────────────────────────────────────

function ProgramView({
  program,
  clientId,
  workoutLogs,
  onUpdate,
  onArchive,
  onLogAdded,
  userRole,
  isSubstitute,
  enableLevelSystem = true,
}: {
  program: WorkoutProgram;
  clientId: string;
  workoutLogs: WorkoutLogRow[];
  onUpdate: (updated: Partial<WorkoutProgram> & { id: string }) => void;
  onArchive: (id: string, status: "ACTIVE" | "ARCHIVED") => void;
  onLogAdded: (log: WorkoutLogRow, pkg: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  userRole?: string;
  isSubstitute?: boolean;
  enableLevelSystem?: boolean;
}) {
  // Determine initial week index (currentWeek)
  const initialWeekIdx = Math.max(
    0,
    program.weeks.findIndex((w) => w.weekNumber === program.currentWeek)
  );
  const [activeWeekIdx, setActiveWeekIdx] = useState(initialWeekIdx);
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);

  const [phases, setPhases] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/admin/phases")
      .then((r) => r.json())
      .then((data: { id: string; name: string; isActive: boolean }[]) =>
        setPhases(data.filter((p) => p.isActive))
      )
      .catch(() => {});
  }, []);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [draftSessions, setDraftSessions] = useState<DraftSession[]>([]);
  const [editPhase, setEditPhase] = useState(program.phase);
  const [editWorkoutType, setEditWorkoutType] = useState(
    program.workoutType ?? (getAllowedWorkoutTypeOptions(undefined, program.phase)[0]?.dbValue ?? PHASE1_WORKOUT_TYPE)
  );
  const [showPhaseChange, setShowPhaseChange] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingWeek, setAddingWeek] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState("");

  // Session logging
  const [loggingSessionId, setLoggingSessionId] = useState<string | null>(null);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);

  const currentWeekData = program.weeks[activeWeekIdx] ?? null;
  const isArchived = program.status === "ARCHIVED";
  const phaseLabel = getPhaseLabel(program.phase);
  const showType = program.workoutType && program.workoutType !== program.phase;

  const editTypeOptions = getAllowedWorkoutTypeOptions(userRole, editPhase, isSubstitute, enableLevelSystem);
  const showEditTypeDropdown = editTypeOptions.length > 0;
  const effectiveEditType = showEditTypeDropdown ? editWorkoutType : PHASE1_WORKOUT_TYPE;
  const editSessionTypeOptions = getSessionTypeOptions(editPhase, effectiveEditType);

  function enterEditMode() {
    if (!currentWeekData) return;
    const allowedTypes = getAllowedWorkoutTypeOptions(userRole, program.phase, isSubstitute, enableLevelSystem);
    const currentType = program.workoutType ?? PHASE1_WORKOUT_TYPE;
    const typeAllowed = allowedTypes.length === 0 || allowedTypes.some((t) => t.dbValue === currentType);
    setDraftSessions(currentWeekData.sessions.map(sessionToDraft));
    setEditPhase(program.phase);
    setEditWorkoutType(typeAllowed ? currentType : (allowedTypes[0]?.dbValue ?? PHASE1_WORKOUT_TYPE));
    setShowPhaseChange(false);
    setError("");
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setDraftSessions([]);
    setShowPhaseChange(false);
  }

  function handleEditPhaseChange(newPhase: string) {
    setEditPhase(newPhase);
    const opts = getAllowedWorkoutTypeOptions(userRole, newPhase, isSubstitute, enableLevelSystem);
    setEditWorkoutType(opts.length > 0 ? opts[0].dbValue : PHASE1_WORKOUT_TYPE);
  }

  function applyPhaseChange() {
    const newType = showEditTypeDropdown ? editWorkoutType : PHASE1_WORKOUT_TYPE;
    const typeOpts = getSessionTypeOptions(editPhase, newType);
    setDraftSessions((prev) =>
      prev.map((s, i) => {
        const sessionType = typeOpts[i % typeOpts.length]?.value ?? "";
        return { ...s, sessionType, movements: buildMovementsFromType(sessionType, newType, editPhase) };
      })
    );
    setShowPhaseChange(false);
  }

  function handleSessionTypeChange(sessionIdx: number, newType: string) {
    setDraftSessions((prev) =>
      prev.map((s, i) =>
        i === sessionIdx
          ? { ...s, sessionType: newType, movements: buildMovementsFromType(newType, effectiveEditType, editPhase) }
          : s
      )
    );
  }

  function updateMovement(sessionIdx: number, movIdx: number, updated: DraftMovement) {
    setDraftSessions((prev) =>
      prev.map((s, si) =>
        si === sessionIdx
          ? { ...s, movements: s.movements.map((m, mi) => (mi === movIdx ? updated : m)) }
          : s
      )
    );
  }

  async function handleSaveEdit() {
    if (!currentWeekData) return;
    setSaving(true);
    setError("");
    try {
      const defaultReps = getDefaultReps(editPhase);
      const sessions = draftSessions.map((s, idx) => {
        const isCardio = s.sessionType === "Cardio";
        return {
          sessionName: `Buổi ${String.fromCharCode(65 + idx)} — ${s.sessionType}`,
          order: idx,
          movements: s.movements.map((m) => ({
            movementCode: m.movementCode,
            movementName: m.movementName,
            selectedExercise: m.selectedExercise === "__custom__" ? m.customExercise : m.selectedExercise,
            sets: isCardio ? 6 : 3,
            reps: isCardio ? "20-60s" : defaultReps,
            order: m.order,
          })),
        };
      });

      const res = await fetch(
        `/api/clients/${clientId}/programs/${program.id}/weeks/${currentWeekData.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      const updatedWeek: WorkoutWeek = await res.json();

      onUpdate({
        id: program.id,
        phase: editPhase,
        workoutType: effectiveEditType,
        weeks: program.weeks.map((w) => (w.id === updatedWeek.id ? updatedWeek : w)),
      });
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddWeek() {
    setAddingWeek(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/programs/${program.id}/weeks`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      const { week, currentWeek } = await res.json() as { week: WorkoutWeek; currentWeek: number };
      onUpdate({
        id: program.id,
        currentWeek,
        weeks: [...program.weeks, week],
      });
      // Switch to new week
      setActiveWeekIdx(program.weeks.length);
      setActiveSessionIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setAddingWeek(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const newStatus = isArchived ? "ACTIVE" : "ARCHIVED";
      const res = await fetch(`/api/clients/${clientId}/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onArchive(program.id, newStatus);
    } finally {
      setArchiving(false);
    }
  }

  // If program has no weeks (legacy), show legacy sessions
  const hasWeeks = program.weeks.length > 0;
  const legacySessions = program.sessions;

  return (
    <div className={cn("bg-white rounded-2xl border shadow-sm overflow-hidden", isArchived ? "border-gray-100 opacity-70" : "border-gray-100")}>
      {/* ── Program header ── */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-50">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-extrabold text-gray-900">{phaseLabel}</span>
            {showType && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                {program.workoutType}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600">
              {program.sessionsPerWeek} buổi/tuần
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
              Tuần hiện tại: {program.currentWeek}
            </span>
            {isArchived && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Đã lưu trữ</span>
            )}
            {!isArchived && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Đang áp dụng</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {program.packageEnrollment && (
              <span className="text-xs text-gray-400">
                Lộ trình: <span className="font-semibold text-gray-600">{program.packageEnrollment.packageName}</span>
              </span>
            )}
            <span className="text-xs text-gray-400">
              PT: <span className="font-semibold text-gray-600">{program.createdBy.name ?? program.createdBy.email}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isArchived && !editMode && hasWeeks && (
            <button
              onClick={enterEditMode}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-[#f15b5c] text-[#f15b5c] hover:bg-[#f15b5c]/5 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Chỉnh sửa
            </button>
          )}
          <button
            onClick={handleArchive}
            disabled={archiving}
            title={isArchived ? "Kích hoạt lại" : "Lưu trữ"}
            className="p-2 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Notes ── */}
      {program.notes && (
        <div className="px-5 pt-3">
          <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
            {program.notes}
          </p>
        </div>
      )}

      {/* ── Legacy mode (no weeks) ── */}
      {!hasWeeks && (
        <div className="px-5 py-4">
          <p className="text-xs text-gray-400 font-semibold mb-3">Buổi tập (cấu trúc cũ)</p>
          <div className="flex gap-1 overflow-x-auto pb-1 mb-3">
            {legacySessions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveSessionIdx(i)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 transition-all",
                  i === activeSessionIdx
                    ? "border-[#f15b5c] text-[#f15b5c] bg-white"
                    : "border-transparent text-gray-500 bg-gray-50 hover:text-gray-700"
                )}
              >
                {s.sessionName.split("—")[0].trim()}
              </button>
            ))}
          </div>
          {legacySessions[activeSessionIdx] && (
            <SessionMovementsTable session={legacySessions[activeSessionIdx]} />
          )}
        </div>
      )}

      {/* ── Week-based display ── */}
      {hasWeeks && (
        <div>
          {/* Week tabs */}
          <div className="px-5 pt-4 flex items-center gap-2">
            <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
              {program.weeks.map((w, wi) => (
                <button
                  key={w.id}
                  onClick={() => { setActiveWeekIdx(wi); setActiveSessionIdx(0); if (editMode) cancelEdit(); }}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                    wi === activeWeekIdx
                      ? "bg-[#f15b5c] text-white border-[#f15b5c]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  )}
                >
                  Tuần {w.weekNumber}
                  {w.weekNumber === program.currentWeek && (
                    <span className="ml-1.5 text-[10px] opacity-80">(hiện tại)</span>
                  )}
                </button>
              ))}
            </div>
            {!editMode && (
              <button
                onClick={handleAddWeek}
                disabled={addingWeek}
                className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {addingWeek ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Thêm tuần mới
              </button>
            )}
          </div>

          {currentWeekData && (
            <div className="px-5 pb-5 pt-3">
              {/* ── Edit mode controls ── */}
              {editMode && (
                <div className="mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#f15b5c]">Đang chỉnh sửa Tuần {currentWeekData.weekNumber}</p>
                    <button
                      onClick={() => setShowPhaseChange((v) => !v)}
                      className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    >
                      Đổi giai đoạn / loại tập
                      {showPhaseChange ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {showPhaseChange && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-amber-700">
                        ⚠️ Đổi giai đoạn sẽ reset các bài tập đã chọn trong tuần này
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-600">Giai đoạn</label>
                          <select
                            value={editPhase}
                            onChange={(e) => handleEditPhaseChange(e.target.value)}
                            className="w-full h-9 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                          >
                            {phases.map((p) => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        {showEditTypeDropdown && (
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600">Mục tiêu</label>
                            <select
                              value={editWorkoutType}
                              onChange={(e) => setEditWorkoutType(e.target.value)}
                              className="w-full h-9 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                            >
                              {editTypeOptions.map((t) => (
                                <option key={t.dbValue} value={t.dbValue}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={applyPhaseChange}
                          className="h-8 px-4 rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: "#f15b5c" }}
                        >
                          Áp dụng & Reset bài tập
                        </button>
                        <button
                          onClick={() => setShowPhaseChange(false)}
                          className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Session tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 mb-3">
                {(editMode ? draftSessions : currentWeekData.sessions).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveSessionIdx(i); setLoggingSessionId(null); }}
                    className={cn(
                      "flex-shrink-0 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 transition-all whitespace-nowrap",
                      i === activeSessionIdx
                        ? "border-[#f15b5c] text-[#f15b5c] bg-white"
                        : "border-transparent text-gray-500 bg-gray-50 hover:text-gray-700"
                    )}
                  >
                    {editMode
                      ? `Buổi ${String.fromCharCode(65 + i)}`
                      : (s as WorkoutSession).sessionName.split("—")[0].trim()}
                  </button>
                ))}
              </div>

              {/* Session content */}
              {editMode ? (
                draftSessions[activeSessionIdx] && (
                  <div className="border border-[#f15b5c]/20 rounded-xl overflow-hidden bg-[#fff9f9]">
                    <div className="flex items-center gap-4 px-4 py-3 bg-[#fff0f0] border-b border-[#f15b5c]/10">
                      <span className="text-base font-bold text-[#f15b5c]">
                        Buổi {String.fromCharCode(65 + activeSessionIdx)}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Loại buổi</span>
                      <select
                        value={draftSessions[activeSessionIdx].sessionType}
                        onChange={(e) => handleSessionTypeChange(activeSessionIdx, e.target.value)}
                        className="h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white"
                      >
                        {editSessionTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="px-4 pb-3 pt-2 overflow-x-auto">
                      <table className="w-full min-w-[480px]">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {["Chuyển động", "Bài tập", "Sets", draftSessions[activeSessionIdx].sessionType === "Cardio" ? "Time" : "Reps"].map((h) => (
                              <th key={h} className="pb-2 text-left text-xs font-bold text-gray-400 pr-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {draftSessions[activeSessionIdx].movements.map((m, mi) => (
                            <EditMovementRow
                              key={m.movementCode + mi}
                              mov={m}
                              phase={editPhase}
                              onChange={(updated) => updateMovement(activeSessionIdx, mi, updated)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : (
                (() => {
                  const activeSession = currentWeekData.sessions[activeSessionIdx];
                  if (!activeSession) return null;
                  const sessionLogs = workoutLogs.filter((l) => l.sessionId === activeSession.id);
                  const lastLog = sessionLogs[0] ?? null;
                  const isLogging = loggingSessionId === activeSession.id;

                  // Previous week data for progressive overload suggestions
                  const prevWeek = program.weeks.find(
                    (w) => w.weekNumber === currentWeekData.weekNumber - 1
                  );
                  const prevWeekLogs = prevWeek
                    ? workoutLogs.filter(
                        (l) => l.weekId === prevWeek.id && l.sessionId === activeSession.id
                      )
                    : [];

                  return (
                    <>
                      <SessionMovementsTable session={activeSession} />

                      {/* ── Log section ── */}
                      <div className="mt-4 pt-3 border-t border-gray-50">
                        {isLogging ? (
                          <SessionLogForm
                            session={activeSession}
                            weekId={currentWeekData.id}
                            weekNumber={currentWeekData.weekNumber}
                            programId={program.id}
                            clientId={clientId}
                            phase={program.phase}
                            prevWeekLogs={prevWeekLogs}
                            onSaved={(log, pkg) => { onLogAdded(log, pkg); setLoggingSessionId(null); }}
                            onClose={() => setLoggingSessionId(null)}
                          />
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              onClick={() => setLoggingSessionId(activeSession.id)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold text-white"
                              style={{ backgroundColor: "#f15b5c" }}
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              Ghi lại buổi tập
                            </button>
                            {lastLog && (
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>Lần cuối: <span className="font-semibold text-gray-600">{fmtDate(lastLog.sessionDate)}</span></span>
                                <span>·</span>
                                <button
                                  onClick={() => setHistorySessionId(activeSession.id)}
                                  className="font-semibold text-[#f15b5c] hover:underline"
                                >
                                  Xem lịch sử ({sessionLogs.length})
                                </button>
                              </div>
                            )}
                            {!lastLog && (
                              <span className="text-xs text-gray-300 italic">Chưa có buổi nào được ghi lại</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* History modal */}
                      {historySessionId === activeSession.id && (
                        <SessionLogHistory
                          sessionName={activeSession.sessionName}
                          logs={sessionLogs}
                          phase={program.phase}
                          onClose={() => setHistorySessionId(null)}
                        />
                      )}
                    </>
                  );
                })()
              )}

              {/* Edit action buttons */}
              {editMode && (
                <div className="mt-4 space-y-2">
                  {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ backgroundColor: "#f15b5c" }}
                    >
                      {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Đang lưu...</> : "Lưu thay đổi"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && !editMode && (
        <div className="px-5 pb-4">
          <p className="text-xs text-[#f15b5c] font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

// ── SessionMovementsTable (read-only) ──────────────────────────────────────

function SessionMovementsTable({ session }: { session: WorkoutSession }) {
  const sessionType = session.sessionName.includes("—")
    ? session.sessionName.split("—").slice(1).join("—").trim()
    : "";

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {sessionType && (
        <div className="px-4 py-2 bg-gray-50/60 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500">{sessionType}</span>
        </div>
      )}
      <div className="px-4 py-3 overflow-x-auto">
        <table className="w-full min-w-[360px]">
          <thead>
            <tr className="border-b border-gray-100">
              {["Chuyển động", "Bài tập", "Lượng"].map((h) => (
                <th key={h} className="pb-2 text-left text-xs font-bold text-gray-400 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {session.movements.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 pr-4 text-xs font-semibold text-gray-600 whitespace-nowrap">{m.movementName}</td>
                <td className="py-2.5 pr-4 text-sm font-medium text-gray-800">
                  {m.selectedExercise || <span className="text-gray-300 italic text-xs">Chưa chọn</span>}
                </td>
                <td className="py-2.5 text-sm text-gray-500 whitespace-nowrap">{m.sets} sets × {m.reps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── WorkoutTab (main export) ───────────────────────────────────────────────

type PackageUpdate = {
  id: string;
  sessionsUsed: number;
  sessions: number;
  packageName: string;
  status: string;
};

export function WorkoutTab({
  clientId,
  initialPrograms,
  initialLogs,
  onPackageUpdated,
  userRole,
  isSubstitute,
  enableLevelSystem = true,
}: {
  clientId: string;
  initialPrograms: WorkoutProgram[];
  initialLogs?: WorkoutLogRow[];
  onPackageUpdated?: (pkg: PackageUpdate) => void;
  userRole?: string;
  isSubstitute?: boolean;
  enableLevelSystem?: boolean;
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRow[]>(initialLogs ?? []);
  const [showArchived, setShowArchived] = useState(false);

  const active = programs.filter((p) => p.status === "ACTIVE");
  const archived = programs.filter((p) => p.status === "ARCHIVED");

  const handleUpdate = useCallback(
    (patch: Partial<WorkoutProgram> & { id: string }) => {
      setPrograms((prev) =>
        prev.map((p) => (p.id === patch.id ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const handleLogAdded = useCallback((log: WorkoutLogRow, pkg: PackageUpdate | null) => {
    setWorkoutLogs((prev) => [log, ...prev]);
    if (pkg) onPackageUpdated?.(pkg);
  }, [onPackageUpdated]);

  function handleArchive(id: string, status: "ACTIVE" | "ARCHIVED") {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-gray-800">Chương trình tập</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {active.length} đang áp dụng · {archived.length} đã lưu trữ
          </p>
        </div>
        {isSubstitute && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full">
            ⚡ Truy cập đặc biệt - Dạy hộ
          </span>
        )}
      </div>

      {active.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 py-14 flex flex-col items-center gap-3">
          <Dumbbell className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-300 font-semibold">Chưa có chương trình tập</p>
          <p className="text-xs text-gray-300 text-center max-w-xs">
            Chương trình tập được tạo qua bước tư vấn
          </p>
        </div>
      )}

      {active.map((p) => (
        <ProgramView
          key={p.id}
          program={p}
          clientId={clientId}
          workoutLogs={workoutLogs.filter((l) => l.programId === p.id)}
          onUpdate={handleUpdate}
          onArchive={handleArchive}
          onLogAdded={handleLogAdded}
          userRole={userRole}
          isSubstitute={isSubstitute}
          enableLevelSystem={enableLevelSystem}
        />
      ))}

      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? "Ẩn" : "Xem"} {archived.length} chương trình đã lưu trữ
            {showArchived ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showArchived && (
            <div className="mt-3 space-y-3">
              {archived.map((p) => (
                <ProgramView
                  key={p.id}
                  program={p}
                  clientId={clientId}
                  workoutLogs={workoutLogs.filter((l) => l.programId === p.id)}
                  onUpdate={handleUpdate}
                  onArchive={handleArchive}
                  onLogAdded={handleLogAdded}
                  userRole={userRole}
                  isSubstitute={isSubstitute}
                  enableLevelSystem={enableLevelSystem}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
