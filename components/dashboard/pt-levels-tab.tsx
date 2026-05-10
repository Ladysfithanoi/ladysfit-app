"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Shield, ShieldOff } from "lucide-react";
import { AlertDialog } from "@/components/ui/alert-dialog";

type WorkoutPhase = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
};

type PTLevelPhaseAccess = {
  id: string;
  phaseId: string;
  hasAccess: boolean;
  phase: WorkoutPhase;
};

type PTLevel = {
  id: string;
  name: string;
  order: number;
  color: string;
  retestIntervalDays: number;
  isDefault: boolean;
  isActive: boolean;
  phaseAccess: PTLevelPhaseAccess[];
  _count: { users: number };
};

type SystemConfig = {
  id: string;
  enableLevelSystem: boolean;
};

const PRESET_COLORS = [
  { value: "#f97316", label: "Cam" },
  { value: "#22c55e", label: "Xanh lá" },
  { value: "#3b82f6", label: "Xanh dương" },
  { value: "#a855f7", label: "Tím" },
  { value: "#ec4899", label: "Hồng" },
  { value: "#f15b5c", label: "Đỏ" },
  { value: "#eab308", label: "Vàng" },
  { value: "#6b7280", label: "Xám" },
];

const inputCls =
  "w-full h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

function LevelBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

export function PTLevelsTab() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [levels, setLevels] = useState<PTLevel[]>([]);
  const [phases, setPhases] = useState<WorkoutPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [toast, setToast] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<PTLevel | null>(null);
  const [form, setForm] = useState({
    name: "",
    color: "#f97316",
    retestIntervalDays: 30,
    isDefault: false,
    phaseIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<PTLevel | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cfgRes, lvlRes, phaseRes] = await Promise.all([
      fetch("/api/admin/system-config"),
      fetch("/api/admin/pt-levels"),
      fetch("/api/admin/phases"),
    ]);
    if (cfgRes.ok) setConfig(await cfgRes.json());
    if (lvlRes.ok) setLevels(await lvlRes.json());
    if (phaseRes.ok) setPhases(await phaseRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleToggleSystem() {
    if (!config) return;
    setToggling(true);
    const res = await fetch("/api/admin/system-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enableLevelSystem: !config.enableLevelSystem }),
    });
    if (res.ok) {
      const updated: SystemConfig = await res.json();
      setConfig(updated);
      showToast(updated.enableLevelSystem ? "Đã bật hệ thống cấp độ" : "Đã tắt hệ thống cấp độ");
    }
    setToggling(false);
  }

  function openAdd() {
    setEditingLevel(null);
    setForm({ name: "", color: "#f97316", retestIntervalDays: 30, isDefault: false, phaseIds: [] });
    setModalOpen(true);
  }

  function openEdit(level: PTLevel) {
    setEditingLevel(level);
    setForm({
      name: level.name,
      color: level.color,
      retestIntervalDays: level.retestIntervalDays,
      isDefault: level.isDefault,
      phaseIds: level.phaseAccess.filter((a) => a.hasAccess).map((a) => a.phaseId),
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let res: Response;
      if (editingLevel) {
        // Update level fields
        res = await fetch(`/api/admin/pt-levels/${editingLevel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            color: form.color,
            retestIntervalDays: form.retestIntervalDays,
            isDefault: form.isDefault,
          }),
        });
        if (res.ok) {
          // Update phase access separately
          await fetch(`/api/admin/pt-levels/${editingLevel.id}/phase-access`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phaseIds: form.phaseIds }),
          });
        }
      } else {
        res = await fetch("/api/admin/pt-levels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      if (res.ok) {
        setModalOpen(false);
        await fetchAll();
        showToast(editingLevel ? "Đã cập nhật cấp độ" : "Đã thêm cấp độ");
      } else {
        const d = await res.json();
        showToast(d.error ?? "Có lỗi xảy ra");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!levelToDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/pt-levels/${levelToDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteOpen(false);
      setLevelToDelete(null);
      await fetchAll();
      showToast("Đã xóa cấp độ");
    } else {
      const d = await res.json();
      showToast(d.error ?? "Có lỗi xảy ra");
      setDeleteOpen(false);
    }
    setDeleting(false);
  }

  function togglePhaseId(phaseId: string) {
    setForm((f) => ({
      ...f,
      phaseIds: f.phaseIds.includes(phaseId)
        ? f.phaseIds.filter((id) => id !== phaseId)
        : [...f.phaseIds, phaseId],
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Đang tải...
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="space-y-6 max-w-3xl">
        {/* ── Section 1: System toggle ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {config?.enableLevelSystem ? (
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-500" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <ShieldOff className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-gray-800">Hệ thống phân cấp độ PT</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Khi tắt, nhân sự không cần thi và không nhận thông báo thi lại
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleSystem}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                config?.enableLevelSystem ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  config?.enableLevelSystem ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold">
            {config?.enableLevelSystem ? (
              <span className="text-green-600">✓ Đang bật</span>
            ) : (
              <span className="text-gray-400">Đang tắt</span>
            )}
          </p>
        </div>

        {/* ── Section 2: Level list ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Danh sách cấp độ</p>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f15b5c] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm cấp độ
            </button>
          </div>

          {levels.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Chưa có cấp độ nào
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500">STT</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Tên cấp độ</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Thi lại sau</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Giai đoạn tiếp cận</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Nhân sự</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Mặc định</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500">Trạng thái</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level, i) => (
                    <tr key={level.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <LevelBadge name={level.name} color={level.color} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">{level.retestIntervalDays} ngày</td>
                      <td className="px-4 py-3.5">
                        {level.phaseAccess.length === 0 ? (
                          <span className="text-xs text-gray-400">Tất cả</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {level.phaseAccess.map((a) => (
                              <span key={a.id} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                                {a.phase.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600">{level._count.users}</td>
                      <td className="px-4 py-3.5">
                        {level.isDefault && (
                          <span className="text-[10px] bg-[#f15b5c]/10 text-[#f15b5c] px-2 py-0.5 rounded-full font-bold">
                            Mặc định
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            level.isActive
                              ? "bg-green-50 text-green-600"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {level.isActive ? "Hoạt động" : "Tắt"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(level)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setLevelToDelete(level); setDeleteOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {editingLevel ? "Chỉnh sửa cấp độ" : "Thêm cấp độ mới"}
              </h3>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Tên cấp độ</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Hạn chế, Tự do..."
                  className={inputCls}
                  autoFocus
                />
              </div>

              {/* Color picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Màu badge</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        form.color === c.value ? "border-gray-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                {form.name && (
                  <div className="mt-1">
                    <LevelBadge name={form.name || "Preview"} color={form.color} />
                  </div>
                )}
              </div>

              {/* Retest interval */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Thi lại sau (ngày)</label>
                <input
                  type="number"
                  min={1}
                  value={form.retestIntervalDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, retestIntervalDays: parseInt(e.target.value) || 30 }))
                  }
                  className={inputCls}
                />
              </div>

              {/* Phase access */}
              {phases.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500">
                    Giai đoạn tập được tiếp cận
                  </label>
                  <p className="text-[11px] text-gray-400">
                    Để trống = tiếp cận tất cả giai đoạn
                  </p>
                  <div className="space-y-1.5 border border-gray-100 rounded-xl p-3 bg-gray-50">
                    {phases
                      .filter((p) => p.isActive)
                      .sort((a, b) => a.order - b.order)
                      .map((phase) => (
                        <label key={phase.id} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={form.phaseIds.includes(phase.id)}
                            onChange={() => togglePhaseId(phase.id)}
                            className="w-4 h-4 rounded accent-[#f15b5c]"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">
                            {phase.name}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {/* Default */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#f15b5c]"
                />
                <span className="text-sm text-gray-700">Cấp độ mặc định cho PT mới</span>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-[#f15b5c] rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? "Đang lưu..." : editingLevel ? "Cập nhật" : "Thêm cấp độ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete dialog ── */}
      <AlertDialog
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setLevelToDelete(null); }}
        title="Xóa cấp độ"
        description={
          levelToDelete?._count.users
            ? `Cấp độ "${levelToDelete.name}" có ${levelToDelete._count.users} nhân sự, không thể xóa.`
            : `Bạn có chắc muốn xóa cấp độ "${levelToDelete?.name}"? Hành động này không thể hoàn tác.`
        }
        confirmLabel={levelToDelete?._count.users ? "Đóng" : "Xóa"}
        cancelLabel={levelToDelete?._count.users ? undefined : "Hủy"}
        onConfirm={() => {
          if (levelToDelete?._count.users) {
            setDeleteOpen(false);
            setLevelToDelete(null);
          } else {
            handleDelete();
          }
        }}
        variant="danger"
      />
    </>
  );
}
