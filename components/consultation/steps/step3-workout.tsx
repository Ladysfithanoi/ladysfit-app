"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PHASE_OPTIONS,
  PHASE1_WORKOUT_TYPE,
  MOVEMENT_BASE_CODES,
  getSessionTypeOptions,
  getSlotsForSessionType,
  getDefaultReps,
} from "@/lib/workout-structure";
import {
  getAllowedPhaseOptions,
  getAllowedWorkoutTypeOptions,
} from "@/lib/workout-permissions";

// ── Types ─────────────────────────────────────────────────────────────────

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
  key: string;
  sessionType: string;
  movements: DraftMovement[];
};

type WorkoutDesign = {
  phase: string;
  workoutType: string;
  sessionsPerWeek: number;
  startWeek: number;
  sessions: DraftSession[];
};

// ── Constants ─────────────────────────────────────────────────────────────

const SESSION_LABELS = ["A", "B", "C", "D", "E", "F", "G"];

const selectCls =
  "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

// ── Exercise Select ────────────────────────────────────────────────────────

function ExerciseSelect({
  phase,
  movementCode,
  value,
  onChange,
  disabled,
}: {
  phase: string;
  movementCode: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(selectCls, "h-9 text-xs", disabled && "bg-gray-50 text-gray-400")}
    >
      <option value="">— Chọn bài tập —</option>
      {exercises.map((ex) => (
        <option key={ex.id} value={ex.name}>{ex.name}</option>
      ))}
      <option value="__custom__">Tự nhập...</option>
    </select>
  );
}

// ── Movement Row ───────────────────────────────────────────────────────────

function MovementRow({
  mov,
  phase,
  onChange,
  readOnly,
}: {
  mov: DraftMovement;
  phase: string;
  onChange: (updated: DraftMovement) => void;
  readOnly?: boolean;
}) {
  const isCustom = mov.selectedExercise === "__custom__";

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 pr-3 text-xs font-semibold text-gray-700 whitespace-nowrap w-36">
        {mov.movementName}
      </td>
      <td className="py-2 pr-3 min-w-[180px]">
        {readOnly ? (
          <span className="text-sm font-medium text-gray-800">
            {mov.selectedExercise || <span className="text-gray-300 italic text-xs">Chưa chọn</span>}
          </span>
        ) : (
          <>
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
          </>
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

// ── Helpers ────────────────────────────────────────────────────────────────

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

function buildDraftSessions(phase: string, workoutType: string, spw: number): DraftSession[] {
  const typeOptions = getSessionTypeOptions(phase, workoutType);
  return Array.from({ length: spw }, (_, i) => {
    const sessionType = typeOptions[i % typeOptions.length]?.value ?? "";
    return {
      key: SESSION_LABELS[i] ?? String(i + 1),
      sessionType,
      movements: buildMovementsFromType(sessionType, workoutType, phase),
    };
  });
}

function restoreDesign(design: WorkoutDesign): DraftSession[] {
  return design.sessions.map((s) => ({
    key: s.key,
    sessionType: s.sessionType,
    movements: s.movements.map((m) => ({
      movementCode: m.movementCode,
      movementName: m.movementName,
      selectedExercise: m.selectedExercise,
      customExercise: m.customExercise ?? "",
      sets: m.sets,
      reps: m.reps,
      order: m.order,
    })),
  }));
}

// ── Main Component ─────────────────────────────────────────────────────────

export function Step3Workout({
  onNext,
  onPrev,
  isReadOnly,
  workoutDesign: savedDesign,
  userRole,
}: {
  onNext: (p: Record<string, unknown>) => Promise<void>;
  onPrev: () => void;
  isReadOnly: boolean;
  workoutDesign?: WorkoutDesign | null;
  userRole?: string;
}) {
  const hasSaved = !!savedDesign;

  // Config
  const [phase, setPhase] = useState(savedDesign?.phase ?? PHASE_OPTIONS[0].value);
  const [workoutType, setWorkoutType] = useState(savedDesign?.workoutType ?? PHASE1_WORKOUT_TYPE);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(savedDesign?.sessionsPerWeek ?? 3);
  const [startWeek, setStartWeek] = useState(savedDesign?.startWeek ?? 1);

  // Session builder (null = config not yet confirmed)
  const [draftSessions, setDraftSessions] = useState<DraftSession[] | null>(
    hasSaved ? restoreDesign(savedDesign!) : null
  );
  const [activeSession, setActiveSession] = useState(0);
  const [saving, setSaving] = useState(false);

  const typeOptions = getAllowedWorkoutTypeOptions(userRole, phase);
  const showTypeDropdown = typeOptions.length > 0;
  const effectiveWorkoutType = showTypeDropdown ? workoutType : PHASE1_WORKOUT_TYPE;
  const sessionTypeOptions = getSessionTypeOptions(phase, effectiveWorkoutType);

  function handlePhaseChange(newPhase: string) {
    setPhase(newPhase);
    const opts = getAllowedWorkoutTypeOptions(userRole, newPhase);
    setWorkoutType(opts.length > 0 ? opts[0].dbValue : PHASE1_WORKOUT_TYPE);
  }

  function handleConfigConfirm() {
    const drafts = buildDraftSessions(phase, effectiveWorkoutType, sessionsPerWeek);
    setDraftSessions(drafts);
    setActiveSession(0);
  }

  function handleSessionTypeChange(idx: number, newType: string) {
    setDraftSessions((prev) =>
      prev
        ? prev.map((s, i) =>
            i === idx
              ? { ...s, sessionType: newType, movements: buildMovementsFromType(newType, effectiveWorkoutType, phase) }
              : s
          )
        : prev
    );
  }

  function updateMovement(sessionIdx: number, movIdx: number, updated: DraftMovement) {
    setDraftSessions((prev) =>
      prev
        ? prev.map((s, si) =>
            si === sessionIdx
              ? { ...s, movements: s.movements.map((m, mi) => (mi === movIdx ? updated : m)) }
              : s
          )
        : prev
    );
  }

  async function handleSave() {
    if (!draftSessions) return;
    setSaving(true);
    const defaultReps = getDefaultReps(phase);
    await onNext({
      workoutDesign: {
        phase,
        workoutType: effectiveWorkoutType,
        sessionsPerWeek,
        startWeek,
        sessions: draftSessions.map((s) => {
          const isCardio = s.sessionType === "Cardio";
          return {
            ...s,
            movements: s.movements.map((m) => ({
              ...m,
              sets: isCardio ? 6 : 3,
              reps: isCardio ? "20-60s" : defaultReps,
            })),
          };
        }),
      },
    });
    setSaving(false);
  }

  async function handleSkip() {
    await onNext({});
  }

  // ── Read-only view ───────────────────────────────────────────────────────
  if (isReadOnly && savedDesign) {
    const sessions = restoreDesign(savedDesign);
    return (
      <div className="divide-y divide-gray-50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <h3 className="text-sm font-extrabold text-gray-800">Chương trình tập đã thiết kế</h3>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
              ✓ Đã lưu
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mb-5">
            <span className="px-3 py-1.5 rounded-xl bg-orange-50 text-xs font-bold text-orange-700">
              {savedDesign.phase}
            </span>
            {savedDesign.workoutType !== savedDesign.phase && (
              <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-xs font-bold text-blue-700">
                {savedDesign.workoutType}
              </span>
            )}
            <span className="px-3 py-1.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-600">
              {savedDesign.sessionsPerWeek} buổi/tuần
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-600">
              Bắt đầu tuần {savedDesign.startWeek}
            </span>
          </div>
          {sessions.map((s) => (
            <div key={s.key} className="border border-gray-100 rounded-xl overflow-hidden mb-2">
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                <span className="text-sm font-bold text-gray-800">Buổi {s.key}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600">
                  {s.sessionType}
                </span>
              </div>
              <div className="px-4 py-3 overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Chuyển động", "Bài tập", "Lượng"].map((h) => (
                        <th key={h} className="pb-2 text-left text-xs font-bold text-gray-400 pr-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.movements.map((m, mi) => (
                      <tr key={m.movementCode + mi} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 text-xs font-semibold text-gray-700 whitespace-nowrap w-36">{m.movementName}</td>
                        <td className="py-2 pr-3 text-sm font-medium text-gray-800">
                          {m.selectedExercise || <span className="text-gray-300 italic text-xs">Chưa chọn</span>}
                        </td>
                        <td className="py-2 text-sm text-gray-500 whitespace-nowrap">{m.sets} sets × {m.reps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 flex gap-3">
          <button onClick={onPrev} className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  // ── Config step (no sessions yet) ────────────────────────────────────────
  if (!draftSessions) {
    return (
      <div className="divide-y divide-gray-50">
        <div className="p-6">
          <h3 className="text-sm font-extrabold text-gray-800 mb-1">Thiết kế chương trình tập</h3>
          <p className="text-xs text-gray-400 mb-5">Cấu hình chương trình trước khi chọn bài tập</p>

          <div className="space-y-4">
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              Cấu hình chương trình
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Giai đoạn *</label>
                <select value={phase} onChange={(e) => handlePhaseChange(e.target.value)} className={selectCls}>
                  {getAllowedPhaseOptions().map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {showTypeDropdown && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Mục tiêu *</label>
                  <select value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} className={selectCls}>
                    {typeOptions.map((t) => (
                      <option key={t.dbValue} value={t.dbValue}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Số buổi/tuần *</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Math.min(7, Math.max(1, Number(e.target.value))))}
                  className={selectCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Tuần bắt đầu</label>
                <input
                  type="number"
                  min={1}
                  value={startWeek}
                  onChange={(e) => setStartWeek(Math.max(1, Number(e.target.value)))}
                  className={selectCls}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 flex gap-3">
          <button onClick={onPrev} className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            ← Quay lại
          </button>
          <button
            onClick={handleConfigConfirm}
            className="flex-1 h-10 rounded-xl text-white text-sm font-bold"
            style={{ backgroundColor: "#f15b5c" }}
          >
            Tiếp tục — chọn bài tập →
          </button>
          <button
            onClick={handleSkip}
            className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    );
  }

  // ── Session builder ───────────────────────────────────────────────────────
  return (
    <div className="divide-y divide-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-extrabold text-gray-800">Chọn bài tập</h3>
          <button
            onClick={() => setDraftSessions(null)}
            className="text-xs text-[#f15b5c] hover:underline font-semibold"
          >
            ← Đổi cấu hình
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700">{phase}</span>
          {showTypeDropdown && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">{workoutType}</span>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
            {sessionsPerWeek} buổi/tuần · Tuần {startWeek}
          </span>
        </div>

        {/* Session tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {draftSessions.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActiveSession(i)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                i === activeSession
                  ? "bg-[#f15b5c] text-white border-[#f15b5c]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-[#f15b5c]/40"
              )}
            >
              Buổi {s.key}
            </button>
          ))}
        </div>

        {/* Active session content */}
        {draftSessions.map((s, si) => (
          <div
            key={s.key}
            className={cn("border border-gray-100 rounded-xl overflow-hidden", si !== activeSession && "hidden")}
          >
            {/* Session header with type selector */}
            <div className="flex items-center gap-4 px-4 py-3 bg-gray-50/80 border-b border-gray-100">
              <span className="text-base font-bold text-[#f15b5c]">Buổi {s.key}</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Loại buổi</span>
              <select
                value={s.sessionType}
                onChange={(e) => handleSessionTypeChange(si, e.target.value)}
                className="h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white"
              >
                {sessionTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="px-4 pb-4 pt-2 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Chuyển động", "Bài tập", "Sets", s.sessionType === "Cardio" ? "Time" : "Reps"].map((h) => (
                      <th key={h} className="pb-2 text-left text-xs font-bold text-gray-400 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.movements.map((m, mi) => (
                    <MovementRow
                      key={m.movementCode + mi}
                      mov={m}
                      phase={phase}
                      onChange={(updated) => updateMovement(si, mi, updated)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 flex gap-3">
        <button onClick={onPrev} className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          ← Quay lại
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ backgroundColor: "#f15b5c" }}
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Đang lưu...</> : "Lưu & Tiếp tục →"}
        </button>
        <button
          onClick={handleSkip}
          className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
}
