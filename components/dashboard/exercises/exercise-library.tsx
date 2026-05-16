"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Search,
  Dumbbell,
} from "lucide-react";
import { SESSION_TYPES } from "@/lib/workout-constants";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ExerciseImportModal } from "./import-modal";

// ── Types ──────────────────────────────────────────────────────────────────

type Phase = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  sessionTypes: string[];
  _count: { programs: number };
};

type MovementTemplate = {
  id: string;
  phaseKey: string;
  sessionType: string;
  movement: string;
  exerciseCount: number;
};

type Exercise = {
  id: string;
  phase: string;
  type: string;
  movement: string;
  name: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const PHASE_KEY_ORDER = Object.keys(SESSION_TYPES);

function displayPhaseKey(key: string): string {
  return key.replace("GD3 Chuyên mông 2", "Chuyên mông 2");
}

function dbPhase(phaseKey: string): string {
  return phaseKey.split(":")[0].trim();
}

function matchDBPhase(phases: Phase[], phaseKey: string): Phase | undefined {
  return phases.find(
    (p) =>
      p.name === phaseKey ||
      phaseKey.startsWith(p.name + ":") ||
      phaseKey.startsWith(p.name + " ")
  );
}

/**
 * Merged ordered session types for a phaseKey:
 * static config order → template-only types → DB-only types (newly added without templates).
 */
function getMergedSessionTypes(
  dbP: Phase | undefined,
  sessions: Record<string, MovementTemplate[]> | undefined,
  phaseKey: string
): string[] {
  const dbTypes = dbP?.sessionTypes ?? [];
  const templateTypes = sessions ? Object.keys(sessions) : [];
  const staticOrder = SESSION_TYPES[phaseKey]?.types ?? [];

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const t of staticOrder) {
    if (!seen.has(t)) { ordered.push(t); seen.add(t); }
  }
  for (const t of templateTypes) {
    if (!seen.has(t)) { ordered.push(t); seen.add(t); }
  }
  for (const t of dbTypes) {
    if (!seen.has(t)) { ordered.push(t); seen.add(t); }
  }
  return ordered;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ExerciseLibrary() {
  // Templates & Exercises
  const [templates, setTemplates] = useState<MovementTemplate[]>([]);
  const [selected, setSelected] = useState<MovementTemplate | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [exLoading, setExLoading] = useState(false);

  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");

  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set());
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set());

  // Movement CRUD
  const [addingTo, setAddingTo] = useState<{ phaseKey: string; sessionType: string } | null>(null);
  const [newMovement, setNewMovement] = useState("");
  const [editingTpl, setEditingTpl] = useState<MovementTemplate | null>(null);
  const [editMovement, setEditMovement] = useState("");

  // Exercise CRUD
  const [newExercise, setNewExercise] = useState("");
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  const [editExName, setEditExName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<{ id: string; name: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Phase CRUD
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseFormOpen, setPhaseFormOpen] = useState(false);
  const [phaseFormName, setPhaseFormName] = useState("");
  const [phaseFormOrder, setPhaseFormOrder] = useState(1);
  const [phaseFormLoading, setPhaseFormLoading] = useState(false);
  const [phaseFormError, setPhaseFormError] = useState("");
  const [inlineEditPhase, setInlineEditPhase] = useState<Phase | null>(null);
  const [inlineEditName, setInlineEditName] = useState("");
  const [inlineEditOrder, setInlineEditOrder] = useState(1);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [deletingPhase, setDeletingPhase] = useState<Phase | null>(null);
  const [phaseDeleteError, setPhaseDeleteError] = useState("");
  const [phaseDeleteLoading, setPhaseDeleteLoading] = useState(false);

  // Session Type CRUD
  const [addingSessionTo, setAddingSessionTo] = useState<{ phaseId: string; phaseKey: string } | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionSaving, setNewSessionSaving] = useState(false);
  const [editingSession, setEditingSession] = useState<{ phaseId: string; phaseKey: string; name: string } | null>(null);
  const [editSessionName, setEditSessionName] = useState("");
  const [sessionRenameSaving, setSessionRenameSaving] = useState(false);
  const [deletingSession, setDeletingSession] = useState<{ phaseId: string; phaseKey: string; name: string } | null>(null);
  const [sessionDeleteError, setSessionDeleteError] = useState("");
  const [sessionDeleteLoading, setSessionDeleteLoading] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/exercises/movements");
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const loadPhases = useCallback(async () => {
    const res = await fetch("/api/admin/phases");
    if (!res.ok) return;
    const data: Phase[] = await res.json();
    if (!Array.isArray(data)) return;
    setPhases(data);
    setOpenPhases((prev) => {
      if (prev.size > 0 || data.length === 0) return prev;
      return new Set([data[0].name]);
    });
  }, []);

  const loadExercises = useCallback(async (tpl: MovementTemplate) => {
    setExLoading(true);
    const phase = dbPhase(tpl.phaseKey);
    const res = await fetch(
      `/api/exercises?phase=${encodeURIComponent(phase)}&movement=${encodeURIComponent(tpl.movement)}`
    );
    const data = await res.json();
    setExercises(Array.isArray(data) ? data : []);
    setExLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([loadTemplates(), loadPhases()]);
  }, [loadTemplates, loadPhases]);

  function selectTemplate(tpl: MovementTemplate) {
    setSelected(tpl);
    setEditingEx(null);
    setNewExercise("");
    setRightSearch("");
    setSelectedExerciseIds(new Set());
    setMobileView("detail");
    loadExercises(tpl);
  }

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, MovementTemplate[]>> = {};
    for (const t of templates) {
      if (!map[t.phaseKey]) map[t.phaseKey] = {};
      if (!map[t.phaseKey][t.sessionType]) map[t.phaseKey][t.sessionType] = [];
      map[t.phaseKey][t.sessionType].push(t);
    }
    return map;
  }, [templates]);

  function togglePhase(key: string) {
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleSession(key: string) {
    setOpenSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── Movement CRUD ────────────────────────────────────────────────────────

  async function handleAddMovement() {
    if (!addingTo || !newMovement.trim()) return;
    const res = await fetch("/api/exercises/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addingTo, movement: newMovement.trim() }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? "Lỗi"); return; }
    setAddingTo(null);
    setNewMovement("");
    loadTemplates();
  }

  async function handleEditMovement() {
    if (!editingTpl || !editMovement.trim()) return;
    await fetch(`/api/exercises/movements/${editingTpl.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movement: editMovement.trim() }),
    });
    if (selected?.id === editingTpl.id) setSelected(null);
    setEditingTpl(null);
    setEditMovement("");
    loadTemplates();
  }

  async function handleDeleteMovement(tpl: MovementTemplate) {
    const res = await fetch(`/api/exercises/movements/${tpl.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? "Không thể xóa"); return; }
    if (selected?.id === tpl.id) setSelected(null);
    loadTemplates();
  }

  // ── Exercise CRUD ────────────────────────────────────────────────────────

  async function handleAddExercise() {
    if (!selected || !newExercise.trim()) return;
    await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: dbPhase(selected.phaseKey),
        movement: selected.movement,
        name: newExercise.trim(),
      }),
    });
    setNewExercise("");
    loadExercises(selected);
    loadTemplates();
  }

  async function handleEditExercise() {
    if (!editingEx || !editExName.trim()) return;
    await fetch(`/api/exercises/${editingEx.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editExName.trim() }),
    });
    setEditingEx(null);
    setEditExName("");
    if (selected) loadExercises(selected);
  }

  async function handleConfirmDeleteExercise() {
    if (!exerciseToDelete) return;
    await fetch(`/api/exercises/${exerciseToDelete.id}`, { method: "DELETE" });
    setDeleteDialogOpen(false);
    setExerciseToDelete(null);
    if (selected) loadExercises(selected);
    loadTemplates();
  }

  function toggleSelectAll() {
    if (filteredExercises.length > 0 && filteredExercises.every((e) => selectedExerciseIds.has(e.id))) {
      setSelectedExerciseIds(new Set());
    } else {
      setSelectedExerciseIds(new Set(filteredExercises.map((e) => e.id)));
    }
  }

  function toggleSelectExercise(id: string) {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleConfirmBulkDelete() {
    const ids = Array.from(selectedExerciseIds);
    await fetch("/api/exercises", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setBulkDeleteConfirmOpen(false);
    setSelectedExerciseIds(new Set());
    if (selected) loadExercises(selected);
    loadTemplates();
  }

  // ── Phase CRUD ───────────────────────────────────────────────────────────

  function openPhaseForm() {
    setPhaseFormName("");
    setPhaseFormOrder(phases.length + 1);
    setPhaseFormError("");
    setPhaseFormOpen(true);
  }

  async function handleAddPhase() {
    if (!phaseFormName.trim()) return;
    setPhaseFormLoading(true);
    setPhaseFormError("");
    try {
      const res = await fetch("/api/admin/phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: phaseFormName.trim(), order: phaseFormOrder }),
      });
      if (!res.ok) {
        const d = await res.json();
        setPhaseFormError(d.error ?? "Có lỗi xảy ra");
        return;
      }
      setPhaseFormOpen(false);
      await loadPhases();
    } catch { setPhaseFormError("Có lỗi xảy ra"); }
    finally { setPhaseFormLoading(false); }
  }

  function startInlineEditPhase(phase: Phase) {
    setInlineEditPhase(phase);
    setInlineEditName(phase.name);
    setInlineEditOrder(phase.order);
  }

  async function handleSaveInlineEditPhase() {
    if (!inlineEditPhase || !inlineEditName.trim() || inlineSaving) return;
    setInlineSaving(true);
    try {
      const res = await fetch(`/api/admin/phases/${inlineEditPhase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inlineEditName.trim(), order: inlineEditOrder }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error ?? "Có lỗi xảy ra"); return; }
      setInlineEditPhase(null);
      await loadPhases();
    } finally { setInlineSaving(false); }
  }

  async function handleConfirmDeletePhase() {
    if (!deletingPhase) return;
    setPhaseDeleteLoading(true);
    setPhaseDeleteError("");
    try {
      const res = await fetch(`/api/admin/phases/${deletingPhase.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setPhaseDeleteError(d.error ?? "Có lỗi xảy ra");
        return;
      }
      setDeletingPhase(null);
      await loadPhases();
    } finally { setPhaseDeleteLoading(false); }
  }

  // ── Session Type CRUD ────────────────────────────────────────────────────

  function openAddSession(phaseId: string, phaseKey: string) {
    setAddingSessionTo({ phaseId, phaseKey });
    setNewSessionName("");
    // Ensure the phase is expanded
    setOpenPhases((prev) => new Set(prev).add(phaseKey));
  }

  async function handleAddSessionType() {
    if (!addingSessionTo || !newSessionName.trim() || newSessionSaving) return;
    setNewSessionSaving(true);
    try {
      const res = await fetch(`/api/admin/phases/${addingSessionTo.phaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addSessionType: newSessionName.trim() }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error ?? "Có lỗi xảy ra"); return; }
      setAddingSessionTo(null);
      setNewSessionName("");
      await loadPhases();
    } finally { setNewSessionSaving(false); }
  }

  function startEditSession(phaseId: string, phaseKey: string, name: string) {
    setEditingSession({ phaseId, phaseKey, name });
    setEditSessionName(name);
  }

  async function handleSaveRenameSession() {
    if (!editingSession || !editSessionName.trim() || sessionRenameSaving) return;
    if (editSessionName.trim() === editingSession.name) { setEditingSession(null); return; }
    setSessionRenameSaving(true);
    try {
      const res = await fetch(`/api/admin/phases/${editingSession.phaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renameSession: {
            phaseKey: editingSession.phaseKey,
            from: editingSession.name,
            to: editSessionName.trim(),
          },
        }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error ?? "Có lỗi xảy ra"); return; }
      setEditingSession(null);
      await Promise.all([loadPhases(), loadTemplates()]);
    } finally { setSessionRenameSaving(false); }
  }

  async function handleConfirmDeleteSession() {
    if (!deletingSession) return;
    setSessionDeleteLoading(true);
    setSessionDeleteError("");
    try {
      const res = await fetch(`/api/admin/phases/${deletingSession.phaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removeSession: { phaseKey: deletingSession.phaseKey, name: deletingSession.name },
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSessionDeleteError(d.error ?? "Có lỗi xảy ra");
        return;
      }
      setDeletingSession(null);
      await loadPhases();
    } finally { setSessionDeleteLoading(false); }
  }

  // ── Filtering ────────────────────────────────────────────────────────────

  const filteredGrouped = useMemo(() => {
    if (!leftSearch.trim()) return grouped;
    const q = leftSearch.toLowerCase();
    const result: Record<string, Record<string, MovementTemplate[]>> = {};
    for (const [phaseKey, sessions] of Object.entries(grouped)) {
      for (const [sessionType, movs] of Object.entries(sessions)) {
        const matched = movs.filter((m) => m.movement.toLowerCase().includes(q));
        if (matched.length > 0) {
          if (!result[phaseKey]) result[phaseKey] = {};
          result[phaseKey][sessionType] = matched;
        }
      }
    }
    return result;
  }, [grouped, leftSearch]);

  const filteredExercises = useMemo(() => {
    if (!rightSearch.trim()) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(rightSearch.toLowerCase()));
  }, [exercises, rightSearch]);

  // Build ordered phase-key list: DB phases first (by order), then orphan template keys
  const { orderedPhaseKeys, phaseKeyToDBPhase } = useMemo(() => {
    const map = new Map<string, Phase>();
    for (const phaseKey of PHASE_KEY_ORDER) {
      const matched = matchDBPhase(phases, phaseKey);
      if (matched) map.set(phaseKey, matched);
    }

    const dbSorted = [...phases].sort((a, b) => a.order - b.order);
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const dp of dbSorted) {
      for (const phaseKey of PHASE_KEY_ORDER) {
        if (map.get(phaseKey)?.id === dp.id && !seen.has(phaseKey)) {
          ordered.push(phaseKey);
          seen.add(phaseKey);
        }
      }
      const hasTemplate = Array.from(map.entries()).some(([, p]) => p.id === dp.id);
      if (!hasTemplate && !seen.has(dp.name)) {
        ordered.push(dp.name);
        seen.add(dp.name);
        map.set(dp.name, dp);
      }
    }
    for (const phaseKey of PHASE_KEY_ORDER) {
      if (!seen.has(phaseKey)) { ordered.push(phaseKey); seen.add(phaseKey); }
    }
    return { orderedPhaseKeys: ordered, phaseKeyToDBPhase: map };
  }, [phases]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Đang tải...
      </div>
    );
  }

  const canDeletePhase = deletingPhase ? deletingPhase._count.programs === 0 : false;

  return (
    <>
    <div className="flex h-[calc(100vh-9rem)] border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">

      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div className={`${mobileView === "detail" ? "hidden sm:flex" : "flex"} w-full sm:w-[340px] flex-shrink-0 border-r border-gray-100 flex-col`}>

        {/* Search header */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Chuyển động</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40 focus:bg-white"
              placeholder="Tìm chuyển động..."
              value={leftSearch}
              onChange={(e) => setLeftSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Phase + session list */}
        <div className="flex-1 overflow-y-auto">
          {orderedPhaseKeys.map((phaseKey) => {
            const sessions = filteredGrouped[phaseKey];
            const dbP = phaseKeyToDBPhase.get(phaseKey);
            const isAddingSession = addingSessionTo?.phaseId === dbP?.id && addingSessionTo?.phaseKey === phaseKey;

            // When searching, hide phases with no matching movements (but keep if adding session)
            if (leftSearch.trim() && !sessions && !isAddingSession) return null;

            const isPhaseOpen = leftSearch ? true : openPhases.has(phaseKey);
            const mergedSessionTypes = getMergedSessionTypes(dbP, sessions, phaseKey);
            const isInlineEditingPhase = inlineEditPhase?.id === dbP?.id && !!dbP;

            return (
              <div key={phaseKey}>
                {/* ── Phase header ─────────────────────────────────────── */}
                <div className="group flex items-center gap-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 border-b border-gray-100">
                  {isInlineEditingPhase ? (
                    /* Inline edit phase */
                    <div className="flex items-center gap-1 w-full">
                      <input
                        className="flex-1 min-w-0 text-xs px-2 py-1 border border-[#f15b5c]/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30"
                        value={inlineEditName}
                        onChange={(e) => setInlineEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveInlineEditPhase();
                          if (e.key === "Escape") setInlineEditPhase(null);
                        }}
                        placeholder="Tên giai đoạn"
                        autoFocus
                      />
                      <input
                        type="number"
                        className="w-10 text-xs px-1.5 py-1 border border-gray-200 rounded-lg focus:outline-none text-center"
                        value={inlineEditOrder}
                        onChange={(e) => setInlineEditOrder(Number(e.target.value))}
                        min={1}
                        title="Thứ tự"
                      />
                      <button onClick={handleSaveInlineEditPhase} disabled={inlineSaving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setInlineEditPhase(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Phase toggle button */}
                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => togglePhase(phaseKey)}
                      >
                        {isPhaseOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                        <span className="text-[11px] font-bold text-gray-600 truncate">
                          {displayPhaseKey(phaseKey)}
                        </span>
                      </button>

                      {/* Action icons — visible on hover */}
                      {dbP && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
                          {/* + Add session type */}
                          <button
                            className="p-0.5 rounded hover:bg-[#f15b5c]/10"
                            title="Thêm loại buổi tập"
                            onClick={(e) => { e.stopPropagation(); openAddSession(dbP.id, phaseKey); }}
                          >
                            <Plus className="w-2.5 h-2.5 text-[#f15b5c]" />
                          </button>
                          {/* Edit phase */}
                          <button
                            className="p-0.5 rounded hover:bg-gray-200"
                            title="Sửa giai đoạn"
                            onClick={(e) => { e.stopPropagation(); startInlineEditPhase(dbP); }}
                          >
                            <Pencil className="w-2.5 h-2.5 text-gray-400" />
                          </button>
                          {/* Delete phase */}
                          <button
                            className="p-0.5 rounded hover:bg-red-50"
                            title="Xóa giai đoạn"
                            onClick={(e) => { e.stopPropagation(); setDeletingPhase(dbP); setPhaseDeleteError(""); }}
                          >
                            <Trash2 className="w-2.5 h-2.5 text-red-400" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Sessions area ─────────────────────────────────────── */}
                {!isInlineEditingPhase && isPhaseOpen && (mergedSessionTypes.length > 0 || isAddingSession) && (
                  <div>
                    {mergedSessionTypes.map((sessionType) => {
                      const movs = sessions?.[sessionType];
                      const sessionKey = `${phaseKey}|${sessionType}`;
                      const isSessionOpen = leftSearch ? true : openSessions.has(sessionKey);
                      const isEditingThisSession =
                        editingSession?.phaseKey === phaseKey && editingSession?.name === sessionType;

                      return (
                        <div key={sessionType}>
                          {/* Session type header */}
                          <div className="group flex items-center pl-5 pr-2 py-1.5 hover:bg-gray-50 border-b border-gray-50">
                            {isEditingThisSession ? (
                              /* Inline rename session */
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  className="flex-1 min-w-0 text-xs px-2 py-1 border border-[#f15b5c]/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30"
                                  value={editSessionName}
                                  onChange={(e) => setEditSessionName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveRenameSession();
                                    if (e.key === "Escape") setEditingSession(null);
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={handleSaveRenameSession}
                                  disabled={sessionRenameSaving}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingSession(null)}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Toggle session */}
                                <button
                                  className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                                  onClick={() => toggleSession(sessionKey)}
                                >
                                  {isSessionOpen
                                    ? <ChevronDown className="w-3 h-3 text-gray-300 flex-shrink-0" />
                                    : <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                                  <span className="text-[11px] font-semibold text-gray-500 truncate">
                                    {sessionType}
                                  </span>
                                  <span className="ml-1 text-[10px] text-gray-300 flex-shrink-0">
                                    {movs?.length ?? 0}
                                  </span>
                                </button>

                                {/* Session type actions (hover) */}
                                {dbP && (
                                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity mr-1">
                                    <button
                                      className="p-0.5 rounded hover:bg-gray-200"
                                      title="Đổi tên loại buổi tập"
                                      onClick={() => startEditSession(dbP.id, phaseKey, sessionType)}
                                    >
                                      <Pencil className="w-2.5 h-2.5 text-gray-400" />
                                    </button>
                                    <button
                                      className="p-0.5 rounded hover:bg-red-50"
                                      title="Xóa loại buổi tập"
                                      onClick={() => {
                                        setDeletingSession({ phaseId: dbP.id, phaseKey, name: sessionType });
                                        setSessionDeleteError("");
                                      }}
                                    >
                                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                    </button>
                                  </div>
                                )}

                                {/* + Add movement */}
                                <button
                                  className="p-1 rounded hover:bg-[#f15b5c]/10 text-[#f15b5c] flex-shrink-0"
                                  title="Thêm chuyển động"
                                  onClick={() => {
                                    setAddingTo({ phaseKey, sessionType });
                                    setOpenSessions((prev) => new Set(prev).add(sessionKey));
                                    setOpenPhases((prev) => new Set(prev).add(phaseKey));
                                    setNewMovement("");
                                  }}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>

                          {/* Movements list */}
                          {!isEditingThisSession && isSessionOpen && (
                            <div>
                              {(movs ?? []).map((tpl) => (
                                <div key={tpl.id}>
                                  {editingTpl?.id === tpl.id ? (
                                    <div className="flex items-center gap-1 pl-9 pr-2 py-1">
                                      <input
                                        className="flex-1 min-w-0 text-xs px-2 py-1 border border-[#f15b5c]/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30"
                                        value={editMovement}
                                        onChange={(e) => setEditMovement(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleEditMovement();
                                          if (e.key === "Escape") setEditingTpl(null);
                                        }}
                                        autoFocus
                                      />
                                      <button onClick={handleEditMovement} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button onClick={() => setEditingTpl(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div
                                      className={`group flex items-center gap-1 pl-9 pr-2 py-1.5 cursor-pointer ${
                                        selected?.id === tpl.id
                                          ? "bg-[#f15b5c]/10 border-l-2 border-[#f15b5c]"
                                          : "hover:bg-gray-50 border-l-2 border-transparent"
                                      }`}
                                      onClick={() => selectTemplate(tpl)}
                                    >
                                      <span className="flex-1 text-xs text-gray-700 truncate">{tpl.movement}</span>
                                      <span className={`text-[10px] flex-shrink-0 mr-1 ${tpl.exerciseCount === 0 ? "text-red-400" : "text-gray-400"}`}>
                                        {tpl.exerciseCount}
                                      </span>
                                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                          className="p-0.5 rounded hover:bg-gray-200"
                                          onClick={(e) => { e.stopPropagation(); setEditingTpl(tpl); setEditMovement(tpl.movement); }}
                                        >
                                          <Pencil className="w-2.5 h-2.5 text-gray-400" />
                                        </button>
                                        <button
                                          className="p-0.5 rounded hover:bg-red-50"
                                          onClick={(e) => { e.stopPropagation(); handleDeleteMovement(tpl); }}
                                        >
                                          <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Add movement inline form */}
                              {addingTo?.phaseKey === phaseKey && addingTo?.sessionType === sessionType && (
                                <div className="flex items-center gap-1 pl-9 pr-2 py-1">
                                  <input
                                    className="flex-1 min-w-0 text-xs px-2 py-1 border border-[#f15b5c]/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30"
                                    placeholder="VD: A9. Core"
                                    value={newMovement}
                                    onChange={(e) => setNewMovement(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleAddMovement();
                                      if (e.key === "Escape") setAddingTo(null);
                                    }}
                                    autoFocus
                                  />
                                  <button onClick={handleAddMovement} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setAddingTo(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add session type inline form */}
                    {isAddingSession && (
                      <div className="flex items-center gap-1 pl-5 pr-2 py-1.5 bg-[#f15b5c]/5 border-b border-gray-50">
                        <input
                          className="flex-1 min-w-0 text-xs px-2 py-1 border border-[#f15b5c]/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30"
                          placeholder="Tên loại buổi tập (VD: Tạ 3)"
                          value={newSessionName}
                          onChange={(e) => setNewSessionName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddSessionType();
                            if (e.key === "Escape") setAddingSessionTo(null);
                          }}
                          autoFocus
                        />
                        <button
                          onClick={handleAddSessionType}
                          disabled={newSessionSaving}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setAddingSessionTo(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add phase button */}
          {!leftSearch.trim() && (
            <div className="p-2 border-t border-gray-100 bg-gray-50/40">
              <button
                onClick={openPhaseForm}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-[#f15b5c] hover:bg-[#f15b5c]/5 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" />
                Thêm giai đoạn
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div className={`${mobileView === "list" ? "hidden sm:flex" : "flex"} flex-1 flex-col min-w-0`}>
        {selected ? (
          <>
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
              <button
                className="sm:hidden flex items-center gap-1 text-xs text-[#f15b5c] font-semibold mb-2"
                onClick={() => setMobileView("list")}
              >
                ← Danh sách chuyển động
              </button>
              <h2 className="text-sm font-bold text-gray-800">{selected.movement}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {displayPhaseKey(selected.phaseKey)} &middot; {selected.sessionType}
              </p>
              <div className="relative mt-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40 focus:bg-white"
                  placeholder="Tìm bài tập..."
                  value={rightSearch}
                  onChange={(e) => setRightSearch(e.target.value)}
                />
              </div>
              {filteredExercises.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={filteredExercises.every((e) => selectedExerciseIds.has(e.id))}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded accent-[#f15b5c] cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs text-gray-500 flex-1">
                    {selectedExerciseIds.size > 0 ? `Đã chọn ${selectedExerciseIds.size}` : "Chọn tất cả"}
                  </span>
                  {selectedExerciseIds.size > 0 && (
                    <button
                      onClick={() => setBulkDeleteConfirmOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Xóa {selectedExerciseIds.size} mục đã chọn
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-3">
              {exLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>
              ) : filteredExercises.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  {rightSearch ? "Không tìm thấy" : "Chưa có bài tập"}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {filteredExercises.map((ex) => (
                    <div key={ex.id}>
                      {editingEx?.id === ex.id ? (
                        <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-gray-50">
                          <input
                            className="flex-1 text-sm px-2 py-1 border border-[#f15b5c]/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/30"
                            value={editExName}
                            onChange={(e) => setEditExName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditExercise();
                              if (e.key === "Escape") setEditingEx(null);
                            }}
                            autoFocus
                          />
                          <button onClick={handleEditExercise} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingEx(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="group flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={selectedExerciseIds.has(ex.id)}
                            onChange={() => toggleSelectExercise(ex.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded accent-[#f15b5c] cursor-pointer flex-shrink-0"
                          />
                          <span className="flex-1 text-sm text-gray-700">{ex.name}</span>
                          <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1">
                            <button className="p-1 rounded-lg hover:bg-gray-200" onClick={() => { setEditingEx(ex); setEditExName(ex.name); }}>
                              <Pencil className="w-3 h-3 text-gray-400" />
                            </button>
                            <button className="p-1 rounded-lg hover:bg-red-50" onClick={() => { setExerciseToDelete({ id: ex.id, name: ex.name }); setDeleteDialogOpen(true); }}>
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40"
                  placeholder="Tên bài tập mới..."
                  value={newExercise}
                  onChange={(e) => setNewExercise(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddExercise(); }}
                />
                <button
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#f15b5c] text-white text-sm font-semibold rounded-xl hover:bg-[#d94f50] disabled:opacity-40 transition-colors"
                  disabled={!newExercise.trim()}
                  onClick={handleAddExercise}
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors"
                  onClick={() => setImportOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> Excel
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="hidden sm:flex flex-1 flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400">Chọn một chuyển động</p>
              <p className="text-xs text-gray-300 mt-1">để xem và quản lý bài tập</p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Exercise delete dialog ─────────────────────────────────────────── */}
    <AlertDialog
      open={deleteDialogOpen}
      onClose={() => { setDeleteDialogOpen(false); setExerciseToDelete(null); }}
      title="Xóa bài tập"
      description={`Bạn có chắc muốn xóa bài tập "${exerciseToDelete?.name}"?\nHành động này không thể hoàn tác.`}
      confirmLabel="Xóa bài tập"
      cancelLabel="Hủy"
      onConfirm={handleConfirmDeleteExercise}
      variant="danger"
    />

    {/* ── Bulk delete dialog ────────────────────────────────────────────── */}
    <AlertDialog
      open={bulkDeleteConfirmOpen}
      onClose={() => setBulkDeleteConfirmOpen(false)}
      title="Xóa bài tập đã chọn"
      description={`Bạn có chắc chắn muốn xóa ${selectedExerciseIds.size} bài tập đã chọn?\nHành động này không thể hoàn tác.`}
      confirmLabel="Xóa"
      cancelLabel="Hủy"
      onConfirm={handleConfirmBulkDelete}
      variant="danger"
    />

    {/* ── Phase delete dialog ────────────────────────────────────────────── */}
    <AlertDialog
      open={!!deletingPhase}
      onClose={() => { setDeletingPhase(null); setPhaseDeleteError(""); }}
      variant="danger"
      title="Xóa giai đoạn"
      description={
        phaseDeleteError
          ? phaseDeleteError
          : !canDeletePhase
          ? `Giai đoạn "${deletingPhase?.name}" đang có ${deletingPhase?._count.programs} chương trình, không thể xóa.`
          : `Bạn có chắc muốn xóa giai đoạn "${deletingPhase?.name}"?\nHành động này không thể hoàn tác.`
      }
      confirmLabel={canDeletePhase && !phaseDeleteError ? "Xóa" : undefined}
      onConfirm={canDeletePhase && !phaseDeleteError ? handleConfirmDeletePhase : () => { setDeletingPhase(null); setPhaseDeleteError(""); }}
      cancelLabel={canDeletePhase && !phaseDeleteError ? "Hủy" : "Đóng"}
      loading={phaseDeleteLoading}
    />

    {/* ── Session type delete dialog ─────────────────────────────────────── */}
    <AlertDialog
      open={!!deletingSession}
      onClose={() => { setDeletingSession(null); setSessionDeleteError(""); }}
      variant="danger"
      title="Xóa loại buổi tập"
      description={
        sessionDeleteError
          ? sessionDeleteError
          : `Bạn có chắc muốn xóa loại buổi tập "${deletingSession?.name}"?\nThao tác này sẽ bị từ chối nếu còn chuyển động thuộc loại này.`
      }
      confirmLabel={!sessionDeleteError ? "Xóa" : undefined}
      onConfirm={!sessionDeleteError ? handleConfirmDeleteSession : () => { setDeletingSession(null); setSessionDeleteError(""); }}
      cancelLabel={!sessionDeleteError ? "Hủy" : "Đóng"}
      loading={sessionDeleteLoading}
    />

    {/* ── Phase add modal ────────────────────────────────────────────────── */}
    {phaseFormOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        onClick={() => setPhaseFormOpen(false)}
      >
        <div className="bg-white rounded-2xl shadow-xl w-80 p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-bold text-gray-800 mb-4">Thêm giai đoạn mới</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Tên giai đoạn <span className="text-[#f15b5c]">*</span>
              </label>
              <input
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40"
                value={phaseFormName}
                onChange={(e) => setPhaseFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPhase();
                  if (e.key === "Escape") setPhaseFormOpen(false);
                }}
                placeholder="VD: Giai đoạn 4"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Thứ tự hiển thị</label>
              <input
                type="number"
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40"
                value={phaseFormOrder}
                onChange={(e) => setPhaseFormOrder(Number(e.target.value))}
                min={1}
              />
            </div>
            {phaseFormError && <p className="text-xs text-[#f15b5c]">{phaseFormError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddPhase}
                disabled={phaseFormLoading || !phaseFormName.trim()}
                className="flex-1 py-2 bg-[#f15b5c] text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-[#d94f50] transition-colors"
              >
                {phaseFormLoading ? "Đang lưu..." : "Thêm mới"}
              </button>
              <button
                onClick={() => setPhaseFormOpen(false)}
                className="py-2 px-4 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    <ExerciseImportModal
      open={importOpen}
      onClose={() => setImportOpen(false)}
      onImported={() => { loadTemplates(); if (selected) loadExercises(selected); }}
      phase={selected ? dbPhase(selected.phaseKey) : undefined}
      movement={selected?.movement}
    />
    </>
  );
}
