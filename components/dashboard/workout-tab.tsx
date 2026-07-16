"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Copy, Dumbbell, Loader2, Pencil, Plus, Settings2, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOVEMENT_BASE_CODES,
  getSlotsForSessionType,
  basePhase,
} from "@/lib/workout-structure";
import { LiveSessionPanel, SessionLogHistory, SignaturePad, WeekLogOverview } from "./session-log-panel";
import { CopyFromClientModal, type CopiedSession } from "./copy-from-client-modal";
import { useFormAutoSave, loadDraft } from "@/hooks/use-form-auto-save";

// ── Types ──────────────────────────────────────────────────────────────────

type PhaseData = {
  id: string;
  name: string;
  isActive: boolean;
  sessionTypes: string[];
  defaultReps: string;
  templateKey: string;
};

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
  phaseId: string | null;
  workoutType: string | null;
  sessionsPerWeek: number;
  currentWeek: number;
  notes: string | null;
  status: "ACTIVE" | "ARCHIVED" | "LOCKED";
  manualPhaseOverride?: boolean;
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
  set1Load: string | null; set1Reps: string | null;
  set2Load: string | null; set2Reps: string | null;
  set3Load: string | null; set3Reps: string | null;
  set4Load: string | null; set4Reps: string | null;
  set5Load: string | null; set5Reps: string | null;
  set6Load: string | null; set6Reps: string | null;
  exerciseNotes: string | null;
};

export type WorkoutLogStatus = "IN_PROGRESS" | "AWAITING_CONFIRMATION" | "COMPLETED" | "VOID";
export type WorkoutConfirmMethod = "CLIENT_APP" | "SIGNATURE";

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
  status: WorkoutLogStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  firstInteractionAt: string | null;
  signatureUrl: string | null;
  checkInSignatureUrl?: string | null;
  packageCounted?: boolean;
  earlyEndApprovedAt?: string | null;
  confirmationMethod: WorkoutConfirmMethod | null;
  confirmedAt: string | null;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Thứ tự giai đoạn từ tên ("Giai đoạn 2: ..." → 2). 0 nếu không nhận diện được. */
function parsePhaseOrder(name: string): number {
  const m = name.match(/Giai\s*đo[aạ]n\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Chỉ số buổi "hôm nay" trong một tuần: buổi đang tập dở (nếu có), nếu không thì
 *  buổi đầu tiên chưa có nhật ký hoàn thành. Trả -1 nếu cả tuần đã tập xong. */
function nextSessionIndex(week: WorkoutWeek | null, logs: WorkoutLogRow[]): number {
  if (!week) return -1;
  const active = week.sessions.findIndex((s) =>
    logs.some((l) => l.sessionId === s.id && (l.status === "IN_PROGRESS" || l.status === "AWAITING_CONFIRMATION"))
  );
  if (active >= 0) return active;
  const completed = new Set(
    logs.filter((l) => l.weekId === week.id && l.status === "COMPLETED").map((l) => l.sessionId)
  );
  return week.sessions.findIndex((s) => !completed.has(s.id));
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

function buildMovementsFromType(sessionType: string, templateKey: string, defaultReps: string): DraftMovement[] {
  const isCardio = sessionType === "Cardio";
  return getSlotsForSessionType(sessionType, templateKey || undefined).map((slot, i) => ({
    movementCode: slot.code,
    movementName: slot.name,
    selectedExercise: "",
    customExercise: "",
    sets: isCardio ? 6 : 3,
    reps: isCardio ? "20-60s" : defaultReps,
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
          phase={basePhase(phase ?? "")}
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
  onLogUpdated,
  onLogDeleted,
  onSessionDeleted,
  userRole,
  isSubstitute,
  enableLevelSystem = true,
  minSessionMinutes = 30,
  inheritedByExercise = null,
}: {
  program: WorkoutProgram;
  clientId: string;
  workoutLogs: WorkoutLogRow[];
  onUpdate: (updated: Partial<WorkoutProgram> & { id: string }) => void;
  onArchive: (id: string, status: "ACTIVE" | "ARCHIVED") => void;
  onLogAdded: (log: WorkoutLogRow, pkg: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  onLogUpdated: (updated: WorkoutLogRow, pkg?: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  onLogDeleted: (logId: string, pkg?: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  onSessionDeleted: (week: WorkoutWeek, sessionId: string, pkg?: { id: string; sessionsUsed: number; sessions: number; packageName: string; status: string } | null) => void;
  userRole?: string;
  isSubstitute?: boolean;
  enableLevelSystem?: boolean;
  minSessionMinutes?: number;
  /** Thông số gần nhất theo TÊN BÀI TẬP kế thừa từ giai đoạn trước (chỉ xem). */
  inheritedByExercise?: Map<string, SetLogRow> | null;
}) {
  // Determine initial week index (currentWeek)
  const initialWeekIdx = Math.max(
    0,
    program.weeks.findIndex((w) => w.weekNumber === program.currentWeek)
  );
  const [activeWeekIdx, setActiveWeekIdx] = useState(initialWeekIdx);
  // Mở sẵn đúng "buổi hôm nay" (buổi kế tiếp cần tập) của tuần hiện tại thay vì
  // luôn nhảy về buổi 1 — PT không phải dò từng buổi để biết đang tới buổi nào.
  const [activeSessionIdx, setActiveSessionIdx] = useState(() =>
    Math.max(0, nextSessionIndex(program.weeks[initialWeekIdx] ?? null, workoutLogs))
  );

  // Week navigation: only the most recent few weeks show as tabs; the rest live
  // behind a searchable "Xem thêm" picker so the bar doesn't grow endlessly.
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [weekSearch, setWeekSearch] = useState("");

  const [phases, setPhases] = useState<PhaseData[]>([]);
  useEffect(() => {
    fetch("/api/admin/phases")
      .then((r) => r.json())
      .then((data: PhaseData[]) => setPhases(data.filter((p) => p.isActive)))
      .catch(() => {});
  }, []);

  // Edit mode (session content)
  const [editMode, setEditMode] = useState(false);
  const [draftSessions, setDraftSessions] = useState<DraftSession[]>([]);
  const [editPhaseId, setEditPhaseId] = useState(program.phaseId ?? "");
  const [showPhaseChange, setShowPhaseChange] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingWeek, setAddingWeek] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState(false);
  const [confirmDeleteWeek, setConfirmDeleteWeek] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [copyingTemplate, setCopyingTemplate] = useState(false);
  const [copyTemplateMsg, setCopyTemplateMsg] = useState("");
  const [showCopyClient, setShowCopyClient] = useState(false);
  const [error, setError] = useState("");

  // Edit program metadata modal
  const [editProgOpen, setEditProgOpen] = useState(false);
  const [progForm, setProgForm] = useState({
    phaseId: program.phaseId ?? "",
    sessionsPerWeek: program.sessionsPerWeek,
    currentWeek: program.currentWeek,
    workoutType: program.workoutType ?? "",
    notes: program.notes ?? "",
  });
  const [progSaving, setProgSaving] = useState(false);
  const [progError, setProgError] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Session logging
  const [showWeekLog, setShowWeekLog] = useState(false);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState("");
  // Session waiting for the client's check-in signature before it can start.
  const [signCheckIn, setSignCheckIn] = useState<{ sessionId: string; weekId: string } | null>(null);
  const [checkInSigning, setCheckInSigning] = useState(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [deleteSessionError, setDeleteSessionError] = useState("");

  // Check-in requires the client's signature first (proof they showed up). This
  // is also the moment the package is deducted, so the signature is mandatory.
  async function handleCheckIn(sessionId: string, weekId: string, checkInSignatureUrl: string) {
    setCheckInSigning(true);
    setCheckingInId(sessionId);
    setCheckInError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/workout-logs/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: program.id, weekId, sessionId, checkInSignatureUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      const { packageUpdate, ...log } = data as WorkoutLogRow & { packageUpdate: PackageUpdate | null };
      setSignCheckIn(null);
      onLogAdded(log as WorkoutLogRow, packageUpdate ?? null);
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setCheckingInId(null);
      setCheckInSigning(false);
    }
  }

  const currentWeekData = program.weeks[activeWeekIdx] ?? null;
  const isArchived = program.status === "ARCHIVED";
  const isLocked = program.status === "LOCKED";
  // Mọi chương trình không phải ACTIVE đều chỉ-xem (đã qua hoặc bị khoá).
  const isReadOnly = program.status !== "ACTIVE";

  // Chỉ Admin được đổi giai đoạn tự do (kể cả về giai đoạn trước). PT/FM chỉ thấy
  // giai đoạn hiện tại trở lên — không chuyển khách về giai đoạn trước đó.
  const isAdmin = userRole === "ADMIN";
  const currentPhaseOrder = parsePhaseOrder(program.phase);
  const selectablePhases = isAdmin
    ? phases
    : phases.filter((p) => parsePhaseOrder(p.name) >= currentPhaseOrder);

  // Đánh số buổi liên tục qua các tuần: buổi đầu của một tuần nối tiếp số buổi
  // cuối của tuần trước (Buổi 1, 2, 3 … thay vì Buổi A, B, C). Tính động theo vị
  // trí nên luôn đúng kể cả với dữ liệu cũ và khi thêm/xóa tuần.
  const sessionNumberBase = (weekNumber: number) =>
    program.weeks
      .filter((w) => w.weekNumber < weekNumber)
      .reduce((sum, w) => sum + w.sessions.length, 0);
  const weekSessionBase = currentWeekData ? sessionNumberBase(currentWeekData.weekNumber) : 0;
  const sessionLabel = (i: number) => `Buổi ${weekSessionBase + i + 1}`;
  const sessionDisplayName = (s: WorkoutSession, i: number) => {
    const type = s.sessionName.includes("—")
      ? s.sessionName.split("—").slice(1).join("—").trim()
      : "";
    return type ? `${sessionLabel(i)} — ${type}` : sessionLabel(i);
  };

  // Tổng quan nhật ký cả tuần: mỗi buổi kèm các log COMPLETED (mới nhất trước).
  const weekLogSessions = currentWeekData
    ? currentWeekData.sessions.map((s, i) => ({
        id: s.id,
        label: sessionLabel(i),
        type: s.sessionName.includes("—") ? s.sessionName.split("—").slice(1).join("—").trim() : "",
        logs: workoutLogs
          .filter((l) => l.weekId === currentWeekData.id && l.sessionId === s.id && l.status === "COMPLETED")
          .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()),
      }))
    : [];

  // Show at most the 3 most recent weeks as tabs; older weeks go behind "Xem thêm".
  // The currently-selected week is always kept visible even if it's an old one.
  const RECENT_WEEKS = 3;
  const recentStartIdx = Math.max(0, program.weeks.length - RECENT_WEEKS);
  const visibleWeekIdxs = program.weeks
    .map((_, i) => i)
    .filter((i) => i >= recentStartIdx || i === activeWeekIdx);

  async function handleDeleteSession() {
    if (!currentWeekData) return;
    const sess = currentWeekData.sessions[activeSessionIdx];
    if (!sess) return;
    setDeletingSession(true);
    setDeleteSessionError("");
    try {
      const res = await fetch(
        `/api/clients/${clientId}/programs/${program.id}/weeks/${currentWeekData.id}/sessions/${sess.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      onSessionDeleted(data.week as WorkoutWeek, sess.id, data.packageUpdate ?? null);
      setActiveSessionIdx(0);
      setConfirmDeleteSession(false);
    } catch (err) {
      setDeleteSessionError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeletingSession(false);
    }
  }

  // Sessions with a live log (checked in / waiting for client confirmation) — used
  // to flag which session the client is currently training, on the week & session tabs.
  const activeSessionIds = new Set(
    workoutLogs
      .filter((l) => l.status === "IN_PROGRESS" || l.status === "AWAITING_CONFIRMATION")
      .map((l) => l.sessionId)
  );
  // Buổi đã tập xong trong tuần đang xem + chỉ số "buổi hôm nay" (buổi kế tiếp).
  const currentWeekCompletedIds = new Set(
    currentWeekData
      ? workoutLogs.filter((l) => l.weekId === currentWeekData.id && l.status === "COMPLETED").map((l) => l.sessionId)
      : []
  );
  const todaySessionIdx = nextSessionIndex(currentWeekData, workoutLogs);
  const editSelectedPhase = phases.find((p) => p.id === editPhaseId) ?? null;
  const editSessionTypeOptions = editSelectedPhase?.sessionTypes ?? [];

  // ── Auto-save draft for edit mode ─────────────────────────────────────────
  const draftKey = `ladysfit_draft_workout_program_${clientId}`;
  type WorkoutDraft = { programId: string; weekId: string; editPhaseId: string; draftSessions: DraftSession[] };
  const { clearDraft: clearWorkoutDraft } = useFormAutoSave<WorkoutDraft>(
    draftKey,
    { programId: program.id, weekId: currentWeekData?.id ?? "", editPhaseId, draftSessions },
    editMode && isDirty
  );

  function enterEditMode() {
    if (!currentWeekData) return;
    const draft = loadDraft<WorkoutDraft>(draftKey);
    if (draft && draft.programId === program.id && draft.weekId === currentWeekData.id) {
      setDraftSessions(draft.draftSessions);
      setEditPhaseId(draft.editPhaseId);
    } else {
      const resolvedPhaseId =
        program.phaseId ??
        phases.find((p) => p.name === program.phase)?.id ??
        "";
      setDraftSessions(currentWeekData.sessions.map(sessionToDraft));
      setEditPhaseId(resolvedPhaseId);
    }
    setShowPhaseChange(false);
    setError("");
    setIsDirty(false);
    setEditMode(true);
  }

  function cancelEdit() {
    clearWorkoutDraft();
    setIsDirty(false);
    setEditMode(false);
    setDraftSessions([]);
    setShowPhaseChange(false);
  }

  function exitEditModeOnly() {
    setEditMode(false);
    setDraftSessions([]);
    setShowPhaseChange(false);
  }

  function handleEditPhaseChange(newPhaseId: string) {
    setIsDirty(true);
    setEditPhaseId(newPhaseId);
  }

  function applyPhaseChange() {
    if (!editSelectedPhase) return;
    const { sessionTypes, templateKey, defaultReps } = editSelectedPhase;
    setIsDirty(true);
    setDraftSessions((prev) =>
      prev.map((s, i) => {
        const sessionType = sessionTypes[i % sessionTypes.length] ?? "";
        return { ...s, sessionType, movements: buildMovementsFromType(sessionType, templateKey, defaultReps) };
      })
    );
    setShowPhaseChange(false);
  }

  function handleSessionTypeChange(sessionIdx: number, newType: string) {
    const templateKey = editSelectedPhase?.templateKey ?? "";
    const defaultReps = editSelectedPhase?.defaultReps ?? "15-20";
    setIsDirty(true);
    setDraftSessions((prev) =>
      prev.map((s, i) =>
        i === sessionIdx
          ? { ...s, sessionType: newType, movements: buildMovementsFromType(newType, templateKey, defaultReps) }
          : s
      )
    );
  }

  // Điền nhanh bài tập cho buổi đang chọn từ "Lịch tập mẫu" admin thiết lập.
  // Chỉ ghi đè bài tập cho các chuyển động có trong lịch mẫu; giữ nguyên phần còn
  // lại. PT vẫn tự đổi bài tập khác được sau khi copy.
  async function copyFromTemplate() {
    const draft = draftSessions[activeSessionIdx];
    if (!draft) return;
    const phaseKey = editSelectedPhase?.name ?? program.phase;
    setCopyingTemplate(true);
    setCopyTemplateMsg("");
    try {
      const params = new URLSearchParams({ phaseKey, sessionType: draft.sessionType });
      const res = await fetch(`/api/workout-templates?${params}`);
      const rows: { movement: string; exercise: string }[] = res.ok ? await res.json() : [];
      const byMovement = new Map(rows.map((r) => [r.movement, r.exercise]));
      let filled = 0;
      setDraftSessions((prev) =>
        prev.map((s, si) =>
          si === activeSessionIdx
            ? {
                ...s,
                movements: s.movements.map((m) => {
                  const ex = byMovement.get(m.movementCode);
                  if (!ex) return m;
                  filled++;
                  return { ...m, selectedExercise: ex, customExercise: "" };
                }),
              }
            : s
        )
      );
      if (filled > 0) setIsDirty(true);
      setCopyTemplateMsg(
        filled > 0 ? `Đã điền ${filled} bài tập từ lịch mẫu` : "Lịch mẫu chưa có bài tập cho buổi này"
      );
      setTimeout(() => setCopyTemplateMsg(""), 2500);
    } catch {
      setCopyTemplateMsg("Không tải được lịch mẫu");
      setTimeout(() => setCopyTemplateMsg(""), 2500);
    } finally {
      setCopyingTemplate(false);
    }
  }

  // Sao chép giáo án 1 tuần từ khách khác của PT: khớp buổi theo VỊ TRÍ, trong mỗi
  // buổi điền bài tập cho các chuyển động trùng mã. Chỉ ghi đè chuyển động có bài
  // tập ở nguồn; giữ nguyên phần còn lại — PT vẫn tự sửa lại sau.
  function handleCopyFromClient(clientName: string, srcSessions: CopiedSession[]) {
    let filled = 0;
    setDraftSessions((prev) =>
      prev.map((s, si) => {
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
    );
    if (filled > 0) setIsDirty(true);
    setCopyTemplateMsg(
      filled > 0 ? `Đã sao chép ${filled} bài tập từ lịch của ${clientName}` : "Không có bài tập phù hợp để sao chép"
    );
    setTimeout(() => setCopyTemplateMsg(""), 3000);
  }

  function updateMovement(sessionIdx: number, movIdx: number, updated: DraftMovement) {
    setIsDirty(true);
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
      const defaultReps = editSelectedPhase?.defaultReps ?? "15-20";
      const sessions = draftSessions.map((s, idx) => {
        const isCardio = s.sessionType === "Cardio";
        return {
          sessionName: `Buổi ${weekSessionBase + idx + 1} — ${s.sessionType}`,
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

      // Nếu PT đổi giai đoạn trong giáo án → lưu giai đoạn vào CT + đánh dấu
      // override để engine tự động tôn trọng (không tự kéo về).
      const phaseChanged = editPhaseId !== (program.phaseId ?? "");
      if (phaseChanged && editSelectedPhase) {
        await fetch(`/api/clients/${clientId}/programs/${program.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: editSelectedPhase.name,
            phaseId: editSelectedPhase.id,
            workoutType: editSelectedPhase.templateKey || null,
            manualPhaseOverride: true,
          }),
        });
      }

      onUpdate({
        id: program.id,
        phase: editSelectedPhase?.name ?? program.phase,
        phaseId: editSelectedPhase?.id ?? program.phaseId,
        workoutType: editSelectedPhase?.templateKey ?? program.workoutType,
        ...(phaseChanged ? { manualPhaseOverride: true } : {}),
        weeks: program.weeks.map((w) => (w.id === updatedWeek.id ? updatedWeek : w)),
      });
      clearWorkoutDraft();
      setIsDirty(false);
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

  async function handleDeleteWeek() {
    if (!currentWeekData) return;
    setDeletingWeek(true);
    setError("");
    try {
      const res = await fetch(
        `/api/clients/${clientId}/programs/${program.id}/weeks/${currentWeekData.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      const { newCurrentWeek } = await res.json() as { newCurrentWeek: number };
      const newWeeks = program.weeks.filter((w) => w.id !== currentWeekData.id);
      onUpdate({ id: program.id, currentWeek: newCurrentWeek, weeks: newWeeks });
      setActiveWeekIdx(Math.max(0, activeWeekIdx - 1));
      setActiveSessionIdx(0);
      setConfirmDeleteWeek(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeletingWeek(false);
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

  function openProgModal() {
    setProgForm({
      phaseId: program.phaseId ?? "",
      sessionsPerWeek: program.sessionsPerWeek,
      currentWeek: program.currentWeek,
      workoutType: program.workoutType ?? "",
      notes: program.notes ?? "",
    });
    setProgError("");
    setEditProgOpen(true);
  }

  async function handleSaveProg() {
    setProgSaving(true);
    setProgError("");
    try {
      const selectedPhase = phases.find((p) => p.id === progForm.phaseId);
      // PT đổi giai đoạn thủ công → đánh dấu override để engine tôn trọng.
      const phaseChanged = progForm.phaseId !== (program.phaseId ?? "");
      const body = {
        phase: selectedPhase?.name ?? program.phase,
        phaseId: progForm.phaseId || null,
        sessionsPerWeek: progForm.sessionsPerWeek,
        currentWeek: progForm.currentWeek,
        workoutType: progForm.workoutType || null,
        notes: progForm.notes || null,
        ...(phaseChanged ? { manualPhaseOverride: true } : {}),
      };
      const res = await fetch(`/api/clients/${clientId}/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Có lỗi xảy ra");
      // API now returns the full program including updated weeks/sessions
      const updated = await res.json() as WorkoutProgram;
      onUpdate(updated);
      setEditProgOpen(false);
    } catch (err) {
      setProgError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setProgSaving(false);
    }
  }

  // If program has no weeks (legacy), show legacy sessions
  const hasWeeks = program.weeks.length > 0;
  const legacySessions = program.sessions;

  return (
    <div className={cn("bg-white rounded-2xl border shadow-sm overflow-hidden", isArchived ? "border-gray-100 opacity-70" : "border-gray-100")}>
      {/* ── Program header ── */}
      <div className="flex flex-col gap-3 px-5 py-4 border-b border-gray-50 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: title + badges */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-gray-900 w-full">{program.phase}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600">
              {program.sessionsPerWeek} buổi/tuần
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
              Tuần hiện tại: {program.currentWeek}
            </span>
            {isArchived && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Đã lưu trữ · chỉ xem</span>
            )}
            {isLocked && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">🔒 Đã khóa</span>
            )}
            {!isReadOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Đang áp dụng</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
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
        {/* Right: buttons (giai đoạn được hệ thống quản lý tự động — không sửa thủ công) */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-shrink-0">
          {!isReadOnly && !editMode && (
            <button
              onClick={openProgModal}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Settings2 className="w-3 h-3" />
              Thông tin CT
            </button>
          )}
          {!isReadOnly && !editMode && hasWeeks && (
            <button
              onClick={enterEditMode}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-[#f15b5c] text-[#f15b5c] hover:bg-[#f15b5c]/5 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Giáo án
            </button>
          )}
        </div>
      </div>

      {/* Banner cho chương trình bị khóa */}
      {isLocked && (
        <div className="px-5 pt-3">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            🔒 Giai đoạn này sẽ tự mở khóa sau khi khách hoàn thành tối thiểu 8 tuần tập ở giai đoạn hiện tại.
          </p>
        </div>
      )}

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
          {/* Week navigation */}
          <div className="px-5 pt-4 space-y-2">
            {/* Row 1: recent week tabs + "Xem thêm" picker for older weeks */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
                {visibleWeekIdxs.map((wi) => {
                  const w = program.weeks[wi];
                  const weekHasActive = w.sessions.some((s) => activeSessionIds.has(s.id));
                  const isActiveTab = wi === activeWeekIdx;
                  return (
                    <button
                      key={w.id}
                      onClick={() => { setActiveWeekIdx(wi); setActiveSessionIdx(Math.max(0, nextSessionIndex(program.weeks[wi] ?? null, workoutLogs))); if (editMode) exitEditModeOnly(); }}
                      className={cn(
                        "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                        isActiveTab
                          ? "bg-[#f15b5c] text-white border-[#f15b5c]"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {weekHasActive && (
                        <span className="relative flex h-2 w-2" title="Khách đang tập trong tuần này">
                          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isActiveTab ? "bg-white" : "bg-[#f15b5c]")} />
                          <span className={cn("relative inline-flex rounded-full h-2 w-2", isActiveTab ? "bg-white" : "bg-[#f15b5c]")} />
                        </span>
                      )}
                      Tuần {w.weekNumber}
                      {w.weekNumber === program.currentWeek && (
                        <span className="text-[10px] opacity-80">(hiện tại)</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {recentStartIdx > 0 && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => { setShowWeekPicker((v) => !v); setWeekSearch(""); }}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Xem thêm ({recentStartIdx})
                    {showWeekPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showWeekPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowWeekPicker(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white rounded-xl border border-gray-200 shadow-lg p-2">
                        <input
                          autoFocus
                          value={weekSearch}
                          onChange={(e) => setWeekSearch(e.target.value)}
                          placeholder="Tìm số tuần..."
                          inputMode="numeric"
                          className="w-full h-8 rounded-lg border border-gray-200 px-2.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40"
                        />
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {program.weeks
                            .map((w, wi) => ({ w, wi }))
                            .filter(({ w }) => weekSearch.trim() === "" || String(w.weekNumber).includes(weekSearch.trim()))
                            .reverse()
                            .map(({ w, wi }) => (
                              <button
                                key={w.id}
                                onClick={() => {
                                  setActiveWeekIdx(wi);
                                  setActiveSessionIdx(Math.max(0, nextSessionIndex(program.weeks[wi] ?? null, workoutLogs)));
                                  if (editMode) exitEditModeOnly();
                                  setShowWeekPicker(false);
                                  setWeekSearch("");
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                                  wi === activeWeekIdx ? "bg-[#f15b5c] text-white" : "text-gray-600 hover:bg-gray-50"
                                )}
                              >
                                Tuần {w.weekNumber}
                                {w.weekNumber === program.currentWeek && (
                                  <span className="text-[10px] opacity-80"> (hiện tại)</span>
                                )}
                              </button>
                            ))}
                          {program.weeks.filter((w) => weekSearch.trim() === "" || String(w.weekNumber).includes(weekSearch.trim())).length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-3">Không tìm thấy tuần</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Row 2: delete / add week — on their own line so they don't crowd the tabs */}
            {!editMode && (
              <div className="flex items-center justify-end gap-1.5">
                {currentWeekData && (
                  <button
                    onClick={() => setShowWeekLog(true)}
                    title={`Xem tổng quan nhật ký Tuần ${currentWeekData.weekNumber}`}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-[#f15b5c]/40 text-[#f15b5c] hover:bg-[#f15b5c]/5 transition-colors"
                  >
                    <ClipboardList className="w-3 h-3" />
                    Nhật ký tuần
                  </button>
                )}
                {!isReadOnly && program.weeks.length > 1 && currentWeekData && currentWeekData.id === program.weeks[program.weeks.length - 1].id && (
                  <button
                    onClick={() => setConfirmDeleteWeek(true)}
                    disabled={deletingWeek}
                    title={`Xóa Tuần ${currentWeekData.weekNumber}`}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Xóa tuần
                  </button>
                )}
                {!isReadOnly && (
                  <button
                    onClick={handleAddWeek}
                    disabled={addingWeek}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {addingWeek ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Thêm tuần mới
                  </button>
                )}
              </div>
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
                        ⚠️ Đổi giai đoạn sẽ reset các bài tập đã chọn trong tuần này. Đây là thao tác thủ công — hệ thống sẽ tôn trọng giai đoạn bạn chọn (không tự kéo về).
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-semibold text-gray-600">Giai đoạn</label>
                          <select
                            value={editPhaseId}
                            onChange={(e) => handleEditPhaseChange(e.target.value)}
                            className="w-full h-9 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                          >
                            {selectablePhases.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
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

              {/* Tổng quan tiến độ tuần: đã tập bao nhiêu buổi + buổi kế tiếp là buổi nào */}
              {!editMode && currentWeekData.sessions.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-xs">
                  <span className="text-gray-500">Tuần {currentWeekData.weekNumber}:</span>
                  <span className="font-bold text-emerald-600">
                    Đã tập {currentWeekCompletedIds.size}/{currentWeekData.sessions.length} buổi
                  </span>
                  {todaySessionIdx >= 0 ? (
                    <span className="font-semibold text-amber-600">· Buổi kế: {sessionLabel(todaySessionIdx)}</span>
                  ) : (
                    <span className="font-semibold text-emerald-600">· Đã hoàn thành tuần này 🎉</span>
                  )}
                </div>
              )}

              {/* Session tabs */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
                {(editMode ? draftSessions : currentWeekData.sessions).map((s, i) => {
                  const sid = (s as WorkoutSession).id;
                  const sessionActive = !editMode && activeSessionIds.has(sid);
                  const isDone = !editMode && currentWeekCompletedIds.has(sid);
                  const isToday = !editMode && !sessionActive && i === todaySessionIdx;
                  const isSelected = i === activeSessionIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => { setActiveSessionIdx(i); setCheckInError(""); }}
                      className={cn(
                        "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 transition-all whitespace-nowrap",
                        isSelected
                          ? "border-[#f15b5c] text-[#f15b5c] bg-white"
                          : isToday
                            ? "border-transparent text-amber-600 bg-amber-50 hover:text-amber-700"
                            : isDone
                              ? "border-transparent text-emerald-600 bg-emerald-50/60 hover:text-emerald-700"
                              : "border-transparent text-gray-500 bg-gray-50 hover:text-gray-700"
                      )}
                    >
                      {sessionActive ? (
                        <span className="relative flex h-2 w-2" title="Khách đang tập buổi này">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f15b5c] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f15b5c]" />
                        </span>
                      ) : isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : null}
                      {sessionLabel(i)}
                      {isToday && (
                        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
                          Buổi kế
                        </span>
                      )}
                    </button>
                  );
                })}
                </div>
                {!editMode && !isReadOnly && currentWeekData.sessions.length > 1 && (
                  <button
                    onClick={() => { setConfirmDeleteSession(true); setDeleteSessionError(""); }}
                    title="Xóa buổi đang chọn khỏi tuần này"
                    className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Xóa buổi</span>
                  </button>
                )}
              </div>

              {/* Session content */}
              {editMode ? (
                draftSessions[activeSessionIdx] && (
                  <div className="border border-[#f15b5c]/20 rounded-xl overflow-hidden bg-[#fff9f9]">
                    <div className="flex items-center gap-4 px-4 py-3 bg-[#fff0f0] border-b border-[#f15b5c]/10">
                      <span className="text-base font-bold text-[#f15b5c]">
                        {sessionLabel(activeSessionIdx)}
                      </span>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Loại buổi</span>
                      <select
                        value={draftSessions[activeSessionIdx].sessionType}
                        onChange={(e) => handleSessionTypeChange(activeSessionIdx, e.target.value)}
                        className="h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white"
                      >
                        {editSessionTypeOptions.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div className="ml-auto flex items-center gap-2">
                        {copyTemplateMsg && (
                          <span className="text-xs font-semibold text-gray-500 hidden sm:inline">{copyTemplateMsg}</span>
                        )}
                        <button
                          type="button"
                          onClick={copyFromTemplate}
                          disabled={copyingTemplate}
                          title="Điền bài tập từ Lịch tập mẫu admin thiết lập"
                          className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border border-[#f15b5c]/30 text-[#f15b5c] bg-white hover:bg-[#fff0f0] transition-colors disabled:opacity-50"
                        >
                          {copyingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy từ lịch mẫu
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCopyClient(true)}
                          title="Sao chép giáo án 1 tuần từ khách hàng khác của bạn"
                          className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border border-[#f15b5c]/30 text-[#f15b5c] bg-white hover:bg-[#fff0f0] transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Sao chép lịch khách
                        </button>
                      </div>
                    </div>
                    <div className="px-4 pb-3 pt-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
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
                              phase={editSelectedPhase?.name ?? program.phase}
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
                  // Only completed sessions count toward history / last-session / suggestions.
                  const completedLogs = sessionLogs.filter((l) => l.status === "COMPLETED");
                  // An active session is one in progress OR waiting for the client to confirm.
                  const inProgressLog = sessionLogs.find(
                    (l) => l.status === "IN_PROGRESS" || l.status === "AWAITING_CONFIRMATION"
                  ) ?? null;
                  const lastLog = completedLogs[0] ?? null;

                  // Thông số tuần trước để gợi ý tăng tiến + điền sẵn Set 1. Khớp
                  // buổi theo VỊ TRÍ (mỗi tuần có session ID riêng), nhưng duyệt
                  // NGƯỢC qua MỌI tuần trước — không chỉ tuần liền kề — và lấy buổi
                  // ở cùng vị trí có nhật ký COMPLETED gần nhất. Nhờ vậy các buổi
                  // mới thêm (vd nâng 3→5 buổi/tuần, buổi 4-5 bị thêm rỗng vào tuần
                  // đã tập xong nên tuần liền kề không có log) vẫn kế thừa được từ
                  // lần gần nhất khách thực sự tập buổi đó.
                  const priorWeeks = program.weeks
                    .filter((w) => w.weekNumber < currentWeekData.weekNumber)
                    .sort((a, b) => b.weekNumber - a.weekNumber);
                  let prevWeekLogs: WorkoutLogRow[] = [];
                  for (const pw of priorWeeks) {
                    const pwSession = pw.sessions[activeSessionIdx];
                    if (!pwSession) continue;
                    const logs = workoutLogs
                      .filter((l) => l.weekId === pw.id && l.sessionId === pwSession.id && l.status === "COMPLETED")
                      .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
                    if (logs.length > 0) { prevWeekLogs = logs; break; }
                  }

                  // Kế thừa từ giai đoạn TRƯỚC: ở tuần ĐẦU của chương trình (chưa có
                  // tuần trước trong cùng CT), nếu có thông số kế thừa theo TÊN BÀI
                  // TẬP thì dựng một "buổi tuần trước" ảo để gợi ý + điền sẵn Set 1
                  // theo đúng bài tập đã tập ở giai đoạn trước.
                  let effectivePrevWeekLogs = prevWeekLogs;
                  let inheritedPrev = false;
                  const isFirstWeek = program.weeks[0]?.id === currentWeekData.id;
                  if (prevWeekLogs.length === 0 && isFirstWeek && inheritedByExercise && inheritedByExercise.size > 0) {
                    const synthSetLogs = activeSession.movements
                      .map((m) => {
                        const src = m.selectedExercise ? inheritedByExercise.get(m.selectedExercise) : undefined;
                        if (!src) return null;
                        return {
                          ...src,
                          id: `inh-${m.id}`,
                          movementId: m.id,
                          movementName: m.movementName,
                          exerciseName: m.selectedExercise,
                        };
                      })
                      .filter((x): x is NonNullable<typeof x> => x !== null);
                    if (synthSetLogs.length > 0) {
                      const nowIso = new Date().toISOString();
                      effectivePrevWeekLogs = [{
                        id: `inh-${activeSession.id}`,
                        sessionId: activeSession.id,
                        weekId: currentWeekData.id,
                        programId: program.id,
                        sessionDate: nowIso,
                        notes: null,
                        createdBy: { id: "", name: null },
                        createdAt: nowIso,
                        setLogs: synthSetLogs,
                        status: "COMPLETED",
                        checkInAt: null,
                        checkOutAt: null,
                        firstInteractionAt: null,
                        signatureUrl: null,
                        confirmationMethod: null,
                        confirmedAt: null,
                      }];
                      inheritedPrev = true;
                    }
                  }

                  return (
                    <>
                      <SessionMovementsTable session={activeSession} />

                      {/* ── Log section ── */}
                      <div className="mt-4 pt-3 border-t border-gray-50">
                        {inProgressLog ? (
                          <LiveSessionPanel
                            log={inProgressLog}
                            sessionName={sessionDisplayName(activeSession, activeSessionIdx)}
                            weekNumber={currentWeekData.weekNumber}
                            phase={program.phase}
                            clientId={clientId}
                            minSessionMinutes={minSessionMinutes}
                            prevWeekLogs={effectivePrevWeekLogs}
                            inheritedPrev={inheritedPrev}
                            onUpdated={(log) => onLogUpdated(log)}
                            onCompleted={(log, pkg) => onLogUpdated(log, pkg)}
                            onVoided={(log) => onLogUpdated(log)}
                            onDeleted={(logId) => onLogDeleted(logId)}
                          />
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => { setCheckInError(""); setSignCheckIn({ sessionId: activeSession.id, weekId: currentWeekData.id }); }}
                                disabled={checkingInId === activeSession.id || isReadOnly}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold text-white disabled:opacity-60"
                                style={{ backgroundColor: "#f15b5c" }}
                              >
                                {checkingInId === activeSession.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <ClipboardList className="w-3.5 h-3.5" />}
                                Khách ký check-in & bắt đầu buổi
                              </button>
                              {checkInError && <span className="text-[11px] text-[#f15b5c] font-medium">{checkInError}</span>}
                              {signCheckIn?.sessionId === activeSession.id && (
                                <SignaturePad
                                  saving={checkInSigning}
                                  onCancel={() => { if (!checkInSigning) setSignCheckIn(null); }}
                                  onConfirm={(dataUrl) => handleCheckIn(signCheckIn.sessionId, signCheckIn.weekId, dataUrl)}
                                />
                              )}
                            </div>
                            {lastLog && (
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>Lần cuối: <span className="font-semibold text-gray-600">{fmtDate(lastLog.sessionDate)}</span></span>
                                <span>·</span>
                                <button
                                  onClick={() => setHistorySessionId(activeSession.id)}
                                  className="font-semibold text-[#f15b5c] hover:underline"
                                >
                                  Xem lịch sử ({completedLogs.length})
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
                          sessionName={sessionDisplayName(activeSession, activeSessionIdx)}
                          logs={completedLogs}
                          phase={program.phase}
                          clientId={clientId}
                          onLogUpdated={onLogUpdated}
                          onLogDeleted={onLogDeleted}
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

      {/* ── Edit Program Metadata Modal ── */}
      {editProgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-900">Chỉnh sửa chương trình tập</h3>
              <button
                onClick={() => setEditProgOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Phase (đổi thủ công — hệ thống sẽ tôn trọng lựa chọn này) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Giai đoạn</label>
                <select
                  value={progForm.phaseId}
                  onChange={(e) => setProgForm((f) => ({ ...f, phaseId: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                >
                  <option value="">— Chọn giai đoạn —</option>
                  {selectablePhases.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400">
                  {isAdmin
                    ? "Admin được đổi tự do mọi giai đoạn. Đổi thủ công sẽ ghi đè tiến trình tự động."
                    : "Chỉ được giữ nguyên hoặc chuyển lên giai đoạn cao hơn — không thể chuyển khách về giai đoạn trước (chỉ Admin mới được)."}
                </p>
              </div>

              {/* Sessions per week + Current week */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Số buổi/tuần</label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={progForm.sessionsPerWeek}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setProgForm((f) => ({ ...f, sessionsPerWeek: Number(e.target.value) }))}
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Tuần hiện tại</label>
                  <input
                    type="number"
                    min={1}
                    value={progForm.currentWeek}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setProgForm((f) => ({ ...f, currentWeek: Number(e.target.value) }))}
                    className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                  />
                </div>
              </div>

              {/* Workout type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Loại hình tập</label>
                <input
                  type="text"
                  placeholder="VD: Giảm mỡ, Tăng cơ, Phục hồi..."
                  value={progForm.workoutType}
                  onChange={(e) => setProgForm((f) => ({ ...f, workoutType: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Ghi chú chương trình</label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú về chương trình tập..."
                  value={progForm.notes}
                  onChange={(e) => setProgForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-none"
                />
              </div>

              {progError && (
                <p className="text-xs text-[#f15b5c] font-medium">{progError}</p>
              )}
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={handleSaveProg}
                disabled={progSaving}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {progSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Đang lưu...</> : "Lưu thay đổi"}
              </button>
              <button
                onClick={() => setEditProgOpen(false)}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete session modal ── */}
      {confirmDeleteSession && currentWeekData && currentWeekData.sessions[activeSessionIdx] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900">
                  Xóa {sessionLabel(activeSessionIdx)}?
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              Buổi tập này (cùng các bài tập và nhật ký đã ghi của nó trong Tuần {currentWeekData.weekNumber}) sẽ bị xóa.
              Các buổi đã hoàn thành sẽ được <span className="font-bold text-red-600">trừ khỏi số buổi đã tính</span>.
            </p>
            {deleteSessionError && <p className="text-xs text-red-500 font-medium">{deleteSessionError}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteSession}
                disabled={deletingSession}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors"
              >
                {deletingSession ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xóa...</> : "Xóa buổi này"}
              </button>
              <button
                onClick={() => { setConfirmDeleteSession(false); setDeleteSessionError(""); }}
                disabled={deletingSession}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Week log overview modal ── */}
      {showWeekLog && currentWeekData && (
        <WeekLogOverview
          weekNumber={currentWeekData.weekNumber}
          sessions={weekLogSessions}
          onClose={() => setShowWeekLog(false)}
        />
      )}

      {/* ── Sao chép lịch tập từ khách khác ── */}
      <CopyFromClientModal
        open={showCopyClient}
        onClose={() => setShowCopyClient(false)}
        onApply={handleCopyFromClient}
        excludeClientId={clientId}
      />

      {/* ── Confirm delete week modal ── */}
      {confirmDeleteWeek && currentWeekData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900">Xóa Tuần {currentWeekData.weekNumber}?</p>
                <p className="text-xs text-gray-500 mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              Toàn bộ dữ liệu ghi chép bài tập của <span className="font-bold text-red-600">Tuần {currentWeekData.weekNumber}</span> sẽ bị xóa vĩnh viễn!
            </p>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteWeek}
                disabled={deletingWeek}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors"
              >
                {deletingWeek ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xóa...</> : "Xóa tuần này"}
              </button>
              <button
                onClick={() => { setConfirmDeleteWeek(false); setError(""); }}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
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
      <div className="px-4 py-3 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
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
  minSessionMinutes = 30,
}: {
  clientId: string;
  initialPrograms: WorkoutProgram[];
  initialLogs?: WorkoutLogRow[];
  onPackageUpdated?: (pkg: PackageUpdate) => void;
  userRole?: string;
  isSubstitute?: boolean;
  enableLevelSystem?: boolean;
  minSessionMinutes?: number;
}) {
  const router = useRouter();
  const [programs, setPrograms] = useState(initialPrograms);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRow[]>(initialLogs ?? []);
  const [showArchived, setShowArchived] = useState(false);

  const active = programs.filter((p) => p.status === "ACTIVE");
  const archived = programs.filter((p) => p.status === "ARCHIVED");
  const locked = programs.filter((p) => p.status === "LOCKED");

  // Thứ tự giai đoạn từ tên ("Giai đoạn 2: ..." → 2) để biết đâu là giai đoạn trước.
  const phaseOrder = (name: string) => {
    const m = name.match(/Giai\s*đo[aạ]n\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  };

  // Kế thừa thông số: với chương trình giai đoạn N, lấy set-log COMPLETED gần nhất
  // theo TÊN BÀI TẬP từ mọi chương trình giai đoạn thấp hơn (N-1, ...).
  const inheritedFor = useCallback(
    (program: WorkoutProgram): Map<string, SetLogRow> | null => {
      const order = phaseOrder(program.phase);
      if (order < 2) return null;
      const lowerProgramIds = new Set(
        programs.filter((p) => phaseOrder(p.phase) > 0 && phaseOrder(p.phase) < order).map((p) => p.id)
      );
      if (lowerProgramIds.size === 0) return null;
      const lowerLogs = workoutLogs
        .filter((l) => l.status === "COMPLETED" && lowerProgramIds.has(l.programId))
        .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
      const map = new Map<string, SetLogRow>();
      for (const log of lowerLogs) {
        for (const sl of log.setLogs) {
          const ex = sl.exerciseName?.trim();
          if (ex && !map.has(ex)) map.set(ex, sl);
        }
      }
      return map.size > 0 ? map : null;
    },
    [programs, workoutLogs]
  );

  // Sau mỗi thay đổi cấu trúc (thêm/xóa tuần, sửa giáo án, hoàn thành buổi…) phải
  // làm mới Router Cache của Next.js. Nếu không, dữ liệu chỉ nằm trong state cục
  // bộ — rời tab rồi quay lại sẽ thấy bản RSC cũ (tuần mới "biến mất") cho tới khi
  // cache hết hạn. KHÔNG gọi khi đang autosave buổi dở (tránh refresh liên tục).
  const handleUpdate = useCallback(
    (patch: Partial<WorkoutProgram> & { id: string }) => {
      setPrograms((prev) =>
        prev.map((p) => (p.id === patch.id ? { ...p, ...patch } : p))
      );
      router.refresh();
    },
    [router]
  );

  const handleLogAdded = useCallback((log: WorkoutLogRow, pkg: PackageUpdate | null) => {
    setWorkoutLogs((prev) => [log, ...prev]);
    if (pkg) onPackageUpdated?.(pkg);
    router.refresh();
  }, [onPackageUpdated, router]);

  const handleLogUpdated = useCallback((updated: WorkoutLogRow, pkg?: PackageUpdate | null) => {
    setWorkoutLogs((prev) => prev.map((l) => l.id === updated.id ? updated : l));
    if (pkg) onPackageUpdated?.(pkg);
    // Chỉ refresh khi buổi đã chốt (hoàn thành/hủy) — không refresh ở mỗi lần
    // autosave số liệu đang nhập (gọi mỗi ~1.2s) để khỏi nện server.
    if (updated.status === "COMPLETED" || updated.status === "VOID") router.refresh();
  }, [onPackageUpdated, router]);

  const handleLogDeleted = useCallback((logId: string, pkg?: PackageUpdate | null) => {
    setWorkoutLogs((prev) => prev.filter((l) => l.id !== logId));
    if (pkg) onPackageUpdated?.(pkg);
    router.refresh();
  }, [onPackageUpdated, router]);

  const handleSessionDeleted = useCallback((week: WorkoutWeek, sessionId: string, pkg?: PackageUpdate | null) => {
    // Replace the week that owns this session and drop the deleted session's logs.
    setPrograms((prev) =>
      prev.map((p) => ({
        ...p,
        weeks: p.weeks.map((w) => (w.id === week.id ? week : w)),
      }))
    );
    setWorkoutLogs((prev) => prev.filter((l) => l.sessionId !== sessionId));
    if (pkg) onPackageUpdated?.(pkg);
    router.refresh();
  }, [onPackageUpdated, router]);

  function handleArchive(id: string, status: "ACTIVE" | "ARCHIVED") {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-gray-800">Chương trình tập</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {active.length} đang áp dụng · {archived.length} đã lưu trữ
            {locked.length > 0 ? ` · ${locked.length} đã khóa` : ""}
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
          onLogUpdated={handleLogUpdated}
          onLogDeleted={handleLogDeleted}
          onSessionDeleted={handleSessionDeleted}
          userRole={userRole}
          isSubstitute={isSubstitute}
          enableLevelSystem={enableLevelSystem}
          minSessionMinutes={minSessionMinutes}
          inheritedByExercise={inheritedFor(p)}
        />
      ))}

      {locked.length > 0 && (
        <div className="space-y-3">
          {locked.map((p) => (
            <ProgramView
              key={p.id}
              program={p}
              clientId={clientId}
              workoutLogs={workoutLogs.filter((l) => l.programId === p.id)}
              onUpdate={handleUpdate}
              onArchive={handleArchive}
              onLogAdded={handleLogAdded}
              onLogUpdated={handleLogUpdated}
              onLogDeleted={handleLogDeleted}
              onSessionDeleted={handleSessionDeleted}
              userRole={userRole}
              isSubstitute={isSubstitute}
              enableLevelSystem={enableLevelSystem}
              minSessionMinutes={minSessionMinutes}
            />
          ))}
        </div>
      )}

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
                  onLogUpdated={handleLogUpdated}
                  onLogDeleted={handleLogDeleted}
                  onSessionDeleted={handleSessionDeleted}
                  userRole={userRole}
                  isSubstitute={isSubstitute}
                  enableLevelSystem={enableLevelSystem}
                  minSessionMinutes={minSessionMinutes}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
