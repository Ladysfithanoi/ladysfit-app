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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const PHASE_KEY_ORDER = Object.keys(SESSION_TYPES);

function displayPhaseKey(key: string): string {
  return key.replace("GD3 Chuyên mông 2", "Chuyên mông 2");
}

function dbPhase(phaseKey: string): string {
  return phaseKey.split(":")[0].trim();
}

export function ExerciseLibrary() {
  const [templates, setTemplates] = useState<MovementTemplate[]>([]);
  const [selected, setSelected] = useState<MovementTemplate | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [exLoading, setExLoading] = useState(false);

  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");

  const [openPhases, setOpenPhases] = useState<Set<string>>(
    new Set([PHASE_KEY_ORDER[0]])
  );
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
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/exercises/movements");
    const data = await res.json();
    setTemplates(data);
    setLoading(false);
  }, []);

  const loadExercises = useCallback(async (tpl: MovementTemplate) => {
    setExLoading(true);
    const phase = dbPhase(tpl.phaseKey);
    const res = await fetch(
      `/api/exercises?phase=${encodeURIComponent(phase)}&movement=${encodeURIComponent(tpl.movement)}`
    );
    const data = await res.json();
    setExercises(data);
    setExLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function selectTemplate(tpl: MovementTemplate) {
    setSelected(tpl);
    setEditingEx(null);
    setNewExercise("");
    setRightSearch("");
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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSession(key: string) {
    setOpenSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Movement CRUD ──────────────────────────────────────────────────────

  async function handleAddMovement() {
    if (!addingTo || !newMovement.trim()) return;
    const res = await fetch("/api/exercises/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addingTo, movement: newMovement.trim() }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Lỗi");
      return;
    }
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
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Không thể xóa");
      return;
    }
    if (selected?.id === tpl.id) setSelected(null);
    loadTemplates();
  }

  // ── Exercise CRUD ──────────────────────────────────────────────────────

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

  function handleDeleteClick(ex: Exercise) {
    setSelectedExercise(ex);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedExercise) return;
    await fetch(`/api/exercises/${selectedExercise.id}`, { method: "DELETE" });
    setDeleteDialogOpen(false);
    setSelectedExercise(null);
    if (selected) loadExercises(selected);
    loadTemplates();
  }

  // ── Filtering ─────────────────────────────────────────────────────────

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
    return exercises.filter((e) =>
      e.name.toLowerCase().includes(rightSearch.toLowerCase())
    );
  }, [exercises, rightSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Đang tải...
      </div>
    );
  }

  return (
    <>
    <div className="flex h-[calc(100vh-9rem)] border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="w-[340px] flex-shrink-0 border-r border-gray-100 flex flex-col">
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

        <div className="flex-1 overflow-y-auto">
          {PHASE_KEY_ORDER.map((phaseKey) => {
            const sessions = filteredGrouped[phaseKey];
            if (!sessions) return null;
            const isPhaseOpen = leftSearch ? true : openPhases.has(phaseKey);
            const sessionOrder = SESSION_TYPES[phaseKey]?.types ?? Object.keys(sessions);

            return (
              <div key={phaseKey}>
                {/* Phase header */}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left border-b border-gray-100"
                  onClick={() => togglePhase(phaseKey)}
                >
                  {isPhaseOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-[11px] font-bold text-gray-600 truncate">
                    {displayPhaseKey(phaseKey)}
                  </span>
                </button>

                {isPhaseOpen && (
                  <div>
                    {sessionOrder.map((sessionType) => {
                      const movs = sessions[sessionType];
                      if (!movs) return null;
                      const sessionKey = `${phaseKey}|${sessionType}`;
                      const isSessionOpen = leftSearch ? true : openSessions.has(sessionKey);

                      return (
                        <div key={sessionType}>
                          {/* Session type row */}
                          <div className="flex items-center pl-5 pr-2 py-1.5 hover:bg-gray-50 border-b border-gray-50">
                            <button
                              className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                              onClick={() => toggleSession(sessionKey)}
                            >
                              {isSessionOpen ? (
                                <ChevronDown className="w-3 h-3 text-gray-300 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                              )}
                              <span className="text-[11px] font-semibold text-gray-500 truncate">
                                {sessionType}
                              </span>
                              <span className="ml-1 text-[10px] text-gray-300 flex-shrink-0">
                                {movs.length}
                              </span>
                            </button>
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
                          </div>

                          {isSessionOpen && (
                            <div>
                              {movs.map((tpl) => (
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
                                      <button
                                        onClick={handleEditMovement}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => setEditingTpl(null)}
                                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                      >
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
                                      <span className="flex-1 text-xs text-gray-700 truncate">
                                        {tpl.movement}
                                      </span>
                                      <span
                                        className={`text-[10px] flex-shrink-0 mr-1 ${
                                          tpl.exerciseCount === 0 ? "text-red-400" : "text-gray-400"
                                        }`}
                                      >
                                        {tpl.exerciseCount}
                                      </span>
                                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                          className="p-0.5 rounded hover:bg-gray-200"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTpl(tpl);
                                            setEditMovement(tpl.movement);
                                          }}
                                        >
                                          <Pencil className="w-2.5 h-2.5 text-gray-400" />
                                        </button>
                                        <button
                                          className="p-0.5 rounded hover:bg-red-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteMovement(tpl);
                                          }}
                                        >
                                          <Trash2 className="w-2.5 h-2.5 text-red-400" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Add movement inline form */}
                              {addingTo?.phaseKey === phaseKey &&
                                addingTo?.sessionType === sessionType && (
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
                                    <button
                                      onClick={handleAddMovement}
                                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => setAddingTo(null)}
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            {/* Right panel header */}
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
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
            </div>

            {/* Exercise list */}
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
                          <button
                            onClick={handleEditExercise}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingEx(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="group flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-gray-50">
                          <span className="flex-1 text-sm text-gray-700">{ex.name}</span>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                            <button
                              className="p-1 rounded-lg hover:bg-gray-200"
                              onClick={() => {
                                setEditingEx(ex);
                                setEditExName(ex.name);
                              }}
                            >
                              <Pencil className="w-3 h-3 text-gray-400" />
                            </button>
                            <button
                              className="p-1 rounded-lg hover:bg-red-50"
                              onClick={() => handleDeleteClick(ex)}
                            >
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

            {/* Add exercise */}
            <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#f15b5c]/40"
                  placeholder="Tên bài tập mới..."
                  value={newExercise}
                  onChange={(e) => setNewExercise(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddExercise();
                  }}
                />
                <button
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#f15b5c] text-white text-sm font-semibold rounded-xl hover:bg-[#d94f50] disabled:opacity-40 transition-colors"
                  disabled={!newExercise.trim()}
                  onClick={handleAddExercise}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bài tập</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa bài tập{' '}
              <strong className="text-gray-900">{selectedExercise?.name}</strong>?
              <br />
              <span className="text-sm text-gray-500">
                Hành động này không thể hoàn tác.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-[#f15b5c] hover:bg-[#d94d4e] text-white"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
