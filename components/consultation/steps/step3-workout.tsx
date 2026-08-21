"use client";

import { useState, useEffect } from "react";
import { Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOVEMENT_BASE_CODES,
  getSlotsForSessionType,
  basePhase,
} from "@/lib/workout-structure";
import { CopyFromClientModal, type CopiedSession } from "@/components/dashboard/copy-from-client-modal";

// ── Types ─────────────────────────────────────────────────────────────────

type PhaseData = {
  id: string;
  name: string;
  isActive: boolean;
  sessionTypes: string[];
  defaultReps: string;
  templateKey: string;
  /** Chuyển động nền tảng theo tên buổi, lấy từ Kho bài tập (/api/admin/phases). */
  movements?: Record<string, string[]>;
};

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
  phaseId?: string;
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
              phase={basePhase(phase)}
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

// Chuyển động của một buổi: ưu tiên Kho bài tập (chỉ ở đó mới có giai đoạn Admin
// tự tạo), rơi về mẫu tĩnh khi giai đoạn chưa được cấu hình chuyển động nào.
function slotsOf(phase: PhaseData, sessionType: string) {
  const codes = phase.movements?.[sessionType];
  if (codes && codes.length > 0) {
    return codes.map((code) => ({ code, name: code }));
  }
  return getSlotsForSessionType(sessionType, phase.templateKey || undefined);
}

function buildMovementsFromType(phase: PhaseData, sessionType: string): DraftMovement[] {
  const isCardio = sessionType === "Cardio";
  const defaultReps = phase.defaultReps;
  return slotsOf(phase, sessionType).map((slot, i) => ({
    movementCode: slot.code,
    movementName: slot.name,
    selectedExercise: "",
    customExercise: "",
    sets: isCardio ? 6 : 3,
    reps: isCardio ? "20-60s" : defaultReps,
    order: i,
  }));
}

function buildDraftSessions(phase: PhaseData, spw: number): DraftSession[] {
  return Array.from({ length: spw }, (_, i) => {
    const sessionType = phase.sessionTypes[i % phase.sessionTypes.length] ?? "";
    return {
      key: SESSION_LABELS[i] ?? String(i + 1),
      sessionType,
      movements: buildMovementsFromType(phase, sessionType),
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
  canSaveAndContinue = true,
}: {
  onNext: (p: Record<string, unknown>) => Promise<void>;
  onPrev: () => void;
  isReadOnly: boolean;
  workoutDesign?: WorkoutDesign | null;
  userRole?: string;
  canSaveAndContinue?: boolean;
  enableLevelSystem?: boolean;
}) {
  const hasSaved = !!savedDesign;

  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [phaseId, setPhaseId] = useState(savedDesign?.phaseId ?? "");
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number | "">(savedDesign?.sessionsPerWeek ?? 3);
  const [startWeek, setStartWeek] = useState<number | "">(savedDesign?.startWeek ?? 1);
  const [draftSessions, setDraftSessions] = useState<DraftSession[] | null>(
    hasSaved ? restoreDesign(savedDesign!) : null
  );
  const [activeSession, setActiveSession] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showCopyClient, setShowCopyClient] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const selectedPhase = phases.find((p) => p.id === phaseId) ?? phases[0] ?? null;
  const sessionTypeOptions = selectedPhase?.sessionTypes ?? [];

  useEffect(() => {
    fetch("/api/admin/phases")
      .then((r) => r.json())
      .then((data: PhaseData[]) => {
        const active = data.filter((p) => p.isActive);
        setPhases(active);
        if (!savedDesign?.phaseId && active.length > 0) {
          setPhaseId(active[0].id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If saved design has no phaseId, resolve it by name match after phases load
  useEffect(() => {
    if (savedDesign?.phase && !savedDesign.phaseId && phases.length > 0 && !phaseId) {
      const match = phases.find((p) => p.name === savedDesign.phase);
      if (match) setPhaseId(match.id);
    }
  }, [phases, savedDesign, phaseId]);

  function handleConfigConfirm() {
    if (!selectedPhase) return;
    const drafts = buildDraftSessions(selectedPhase, Number(sessionsPerWeek) || 3);
    setDraftSessions(drafts);
    setActiveSession(0);
  }

  function handleSessionTypeChange(idx: number, newType: string) {
    if (!selectedPhase) return;
    setDraftSessions((prev) =>
      prev
        ? prev.map((s, i) =>
            i === idx
              ? { ...s, sessionType: newType, movements: buildMovementsFromType(selectedPhase, newType) }
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

  // Sao chép giáo án 1 tuần từ khách khác: khớp buổi theo VỊ TRÍ, điền bài tập cho
  // các chuyển động trùng mã; giữ nguyên phần còn lại để PT tự chỉnh sau.
  function handleCopyFromClient(
    clientName: string,
    srcSessions: CopiedSession[],
    sessionIndices: number[]
  ) {
    let filled = 0;
    const chosen = new Set(sessionIndices);
    setDraftSessions((prev) =>
      prev
        ? prev.map((s, si) => {
            if (!chosen.has(si)) return s;
            const src = srcSessions[si];
            if (!src) return s;
            const byCode = new Map(
              src.movements.filter((m) => m.selectedExercise).map((m) => [m.movementCode, m.selectedExercise])
            );
            return {
              ...s,
              movements: s.movements.map((m) => {
                const ex = byCode.get(m.movementCode);
                if (!ex) return m;
                filled++;
                return { ...m, selectedExercise: ex, customExercise: "" };
              }),
            };
          })
        : prev
    );
    setCopyMsg(
      filled > 0 ? `Đã sao chép ${filled} bài tập từ lịch của ${clientName}` : "Không có bài tập phù hợp để sao chép"
    );
    setTimeout(() => setCopyMsg(""), 3000);
  }

  async function handleSave() {
    if (!draftSessions || !selectedPhase) return;
    setSaving(true);
    await onNext({
      workoutDesign: {
        phaseId: selectedPhase.id,
        phase: selectedPhase.name,
        workoutType: selectedPhase.templateKey || selectedPhase.name,
        sessionsPerWeek: Number(sessionsPerWeek) || 3,
        startWeek: Number(startWeek) || 1,
        sessions: draftSessions.map((s) => {
          const isCardio = s.sessionType === "Cardio";
          return {
            ...s,
            movements: s.movements.map((m) => ({
              ...m,
              sets: isCardio ? 6 : 3,
              reps: isCardio ? "20-60s" : selectedPhase.defaultReps,
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
              <div className="px-4 py-3 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
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
        <div className="p-5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
          <button onClick={onPrev} className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 w-full sm:w-auto">
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
                <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} className={selectCls}>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Số buổi/tuần *</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  inputMode="numeric"
                  value={sessionsPerWeek}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSessionsPerWeek(v === "" ? "" : parseInt(v) || "");
                  }}
                  onBlur={() => {
                    const n = Number(sessionsPerWeek);
                    setSessionsPerWeek(isNaN(n) || n < 1 ? 1 : Math.min(7, n));
                  }}
                  className={selectCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Tuần bắt đầu</label>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={startWeek}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStartWeek(v === "" ? "" : parseInt(v) || "");
                  }}
                  onBlur={() => {
                    const n = Number(startWeek);
                    setStartWeek(isNaN(n) || n < 1 ? 1 : n);
                  }}
                  className={selectCls}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
          <button onClick={onPrev} className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 w-full sm:w-auto">
            ← Quay lại
          </button>
          <button
            onClick={handleConfigConfirm}
            disabled={!selectedPhase}
            className="py-3 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-60 w-full sm:w-auto"
            style={{ backgroundColor: "#f15b5c" }}
          >
            Tiếp tục — chọn bài tập →
          </button>
          <button
            onClick={handleSkip}
            className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 w-full sm:w-auto"
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
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-extrabold text-gray-800">Chọn bài tập</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCopyClient(true)}
              title="Sao chép giáo án 1 tuần từ khách hàng khác của bạn"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold border border-[#f15b5c]/30 text-[#f15b5c] bg-white hover:bg-[#fff0f0] transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Sao chép lịch khách
            </button>
            <button
              onClick={() => setDraftSessions(null)}
              className="text-xs text-[#f15b5c] hover:underline font-semibold whitespace-nowrap"
            >
              ← Đổi cấu hình
            </button>
          </div>
        </div>
        {copyMsg && (
          <p className="text-xs font-semibold text-emerald-600 mb-2">{copyMsg}</p>
        )}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700">
            {selectedPhase?.name}
          </span>
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
                {sessionTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="px-4 pb-4 pt-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
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
                      phase={selectedPhase?.name ?? ""}
                      onChange={(updated) => updateMovement(si, mi, updated)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
        <button onClick={onPrev} className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 w-full sm:w-auto">
          ← Quay lại
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !canSaveAndContinue}
          className="py-3 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 w-full sm:w-auto"
          style={{ backgroundColor: "#f15b5c" }}
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Đang lưu...</> : "Lưu & Tiếp tục →"}
        </button>
        <button
          onClick={handleSkip}
          className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 w-full sm:w-auto"
        >
          Bỏ qua
        </button>
      </div>

      {/* Sao chép lịch tập từ khách khác của PT */}
      <CopyFromClientModal
        open={showCopyClient}
        onClose={() => setShowCopyClient(false)}
        onApply={handleCopyFromClient}
      />
    </div>
  );
}
