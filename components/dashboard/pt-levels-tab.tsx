"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Shield, ShieldOff, Clock, Loader2 } from "lucide-react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { TRIAL_SETUP_DEFAULT, TRIAL_SETUP_LIMITS } from "@/lib/exam-trial";

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
  monthlyTarget: number;
  promoteMinAvgRevenue: number;
  promoteMinTransform: number;
  // De ly thuyet rieng cua cap: null = dung so chung o trang Bai thi.
  examNumQuestions: number | null;
  examPassingScore: number | null;
  // FLAT = trắc nghiệm phẳng; TRIAL = đề thử thách nhiều vòng (7 đại tội).
  examFormat: "FLAT" | "TRIAL";
  trialRoundsPerAttempt: number | null;
  trialCaseRounds: number | null;
  trialCardsPerRound: number | null;
  trialItemsPerCase: number | null;
  isDefault: boolean;
  isActive: boolean;
  phaseAccess: PTLevelPhaseAccess[];
  _count: { users: number };
};

type SystemConfig = {
  id: string;
  enableLevelSystem: boolean;
  minSessionMinutes: number;
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

/** Ô nhập nào ứng với giới hạn nào trong TRIAL_SETUP_LIMITS. */
const TRIAL_KEY = {
  trialRoundsPerAttempt: "roundsPerAttempt",
  trialCaseRounds: "caseRounds",
  trialCardsPerRound: "cardsPerRound",
  trialItemsPerCase: "itemsPerCase",
} as const;

const inputCls =
  "w-full h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

function LevelBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white whitespace-nowrap"
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
  const [toastType, setToastType] = useState<"success" | "error">("success");
  // Minimum session duration (minutes) editor
  const [minMinutesInput, setMinMinutesInput] = useState("30");
  const [savingMinMinutes, setSavingMinMinutes] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<PTLevel | null>(null);
  const [form, setForm] = useState({
    name: "",
    color: "#f97316",
    retestIntervalDays: 30,
    monthlyTarget: 38,
    promoteMinAvgRevenue: 30.4,
    promoteMinTransform: 1,
    // Chuoi rong = de trong o nhap = dung so chung.
    examNumQuestions: "",
    examPassingScore: "",
    examFormat: "FLAT" as "FLAT" | "TRIAL",
    trialRoundsPerAttempt: "",
    trialCaseRounds: "",
    trialCardsPerRound: "",
    trialItemsPerCase: "",
    isDefault: false,
    phaseIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<PTLevel | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToastType(type);
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
    if (cfgRes.ok) {
      const cfg: SystemConfig = await cfgRes.json();
      setConfig(cfg);
      setMinMinutesInput(String(cfg.minSessionMinutes ?? 30));
    }
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

  async function handleSaveMinMinutes() {
    const value = Math.round(Number(minMinutesInput));
    if (!Number.isFinite(value) || value <= 0) {
      showToast("Số phút không hợp lệ", "error");
      return;
    }
    setSavingMinMinutes(true);
    try {
      const res = await fetch("/api/admin/system-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSessionMinutes: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Lưu thất bại (mã ${res.status})`);
      }
      const updated: SystemConfig = await res.json();
      setConfig(updated);
      setMinMinutesInput(String(updated.minSessionMinutes));
      showToast(`✓ Đã lưu: buổi tập tối thiểu ${updated.minSessionMinutes} phút`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lưu thất bại, vui lòng thử lại", "error");
    } finally {
      setSavingMinMinutes(false);
    }
  }

  function openAdd() {
    setEditingLevel(null);
    setForm({ name: "", color: "#f97316", retestIntervalDays: 30, monthlyTarget: 38, promoteMinAvgRevenue: 30.4, promoteMinTransform: 1, examNumQuestions: "", examPassingScore: "", examFormat: "FLAT", trialRoundsPerAttempt: "", trialCaseRounds: "", trialCardsPerRound: "", trialItemsPerCase: "", isDefault: false, phaseIds: [] });
    setModalOpen(true);
  }

  function openEdit(level: PTLevel) {
    setEditingLevel(level);
    setForm({
      name: level.name,
      color: level.color,
      retestIntervalDays: level.retestIntervalDays,
      monthlyTarget: level.monthlyTarget,
      promoteMinAvgRevenue: level.promoteMinAvgRevenue,
      promoteMinTransform: level.promoteMinTransform,
      examNumQuestions: level.examNumQuestions == null ? "" : String(level.examNumQuestions),
      examPassingScore: level.examPassingScore == null ? "" : String(level.examPassingScore),
      examFormat: level.examFormat,
      trialRoundsPerAttempt: level.trialRoundsPerAttempt == null ? "" : String(level.trialRoundsPerAttempt),
      trialCaseRounds: level.trialCaseRounds == null ? "" : String(level.trialCaseRounds),
      trialCardsPerRound: level.trialCardsPerRound == null ? "" : String(level.trialCardsPerRound),
      trialItemsPerCase: level.trialItemsPerCase == null ? "" : String(level.trialItemsPerCase),
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
            monthlyTarget: form.monthlyTarget,
            promoteMinAvgRevenue: form.promoteMinAvgRevenue,
            promoteMinTransform: form.promoteMinTransform,
            examNumQuestions: form.examNumQuestions === "" ? null : Number(form.examNumQuestions),
            examPassingScore: form.examPassingScore === "" ? null : Number(form.examPassingScore),
            examFormat: form.examFormat,
            trialRoundsPerAttempt: form.trialRoundsPerAttempt === "" ? null : Number(form.trialRoundsPerAttempt),
            trialCaseRounds: form.trialCaseRounds === "" ? null : Number(form.trialCaseRounds),
            trialCardsPerRound: form.trialCardsPerRound === "" ? null : Number(form.trialCardsPerRound),
            trialItemsPerCase: form.trialItemsPerCase === "" ? null : Number(form.trialItemsPerCase),
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
        <div
          className={`fixed bottom-6 right-6 z-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg ${
            toastType === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
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

        {/* ── Section 1b: Minimum session duration ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#fff0f0] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#f15b5c]" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Thời lượng buổi tập tối thiểu</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Buổi tập chỉ được tính khi thời gian từ lúc check-in đến lúc khách ký ≥ số phút này
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={minMinutesInput}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setMinMinutesInput(e.target.value)}
              className="w-24 h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            />
            <span className="text-sm text-gray-500">phút</span>
            <button
              onClick={handleSaveMinMinutes}
              disabled={savingMinMinutes}
              className="ml-2 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#f15b5c] text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
            >
              {savingMinMinutes && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Lưu
            </button>
          </div>
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
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">STT</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">Tên cấp độ</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">Thi lại sau</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">KPI/tháng</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">Giai đoạn tiếp cận</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">Nhân sự</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">Mặc định</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">Trạng thái</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level, i) => (
                    <tr key={level.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-gray-400 whitespace-nowrap">{i + 1}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <LevelBadge name={level.name} color={level.color} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">{level.retestIntervalDays} ngày</td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{level.monthlyTarget} tr</td>
                      <td className="px-4 py-3.5">
                        {level.phaseAccess.length === 0 ? (
                          <span className="text-xs text-gray-400 whitespace-nowrap">Tất cả</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 min-w-[160px]">
                            {level.phaseAccess.map((a) => (
                              <span key={a.id} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                                {a.phase.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">{level._count.users}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {level.isDefault && (
                          <span className="text-[10px] bg-[#f15b5c]/10 text-[#f15b5c] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                            Mặc định
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
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
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, retestIntervalDays: parseInt(e.target.value) || 30 }))
                  }
                  className={inputCls}
                />
              </div>

              {/* KPI doanh số */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">KPI doanh số (triệu/tháng)</label>
                <input
                  type="number"
                  min={1}
                  value={form.monthlyTarget}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, monthlyTarget: parseInt(e.target.value) || 0 }))
                  }
                  className={inputCls}
                />
                <p className="text-[11px] text-gray-400">
                  Dùng để tính hiệu suất doanh số của nhân sự ở cấp độ này (VD: Thử việc 15, PT chính thức 38).
                </p>
              </div>

              {/* Điều kiện thăng hạng */}
              <div className="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50">
                <p className="text-xs font-bold text-gray-600">Điều kiện để thăng lên cấp kế tiếp</p>
                {/* Cấu hình đề thử thách — chỉ hiện khi cấp này thật sự dùng dạng
                    đề đó. Bốn con số này trước đây nằm trong mã nguồn, mỗi lần
                    muốn đổi độ dài bài thi lại phải sửa mã và deploy. */}
                {form.examFormat === "TRIAL" && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                      Cấu hình đề thử thách
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ["trialRoundsPerAttempt", "Số đại tội mỗi lượt", TRIAL_SETUP_DEFAULT.roundsPerAttempt],
                        ["trialCaseRounds", "Trong đó là Case Study", TRIAL_SETUP_DEFAULT.caseRounds],
                        ["trialCardsPerRound", "Thẻ mỗi vòng phân loại", TRIAL_SETUP_DEFAULT.cardsPerRound],
                        ["trialItemsPerCase", "Hồ sơ mỗi vòng Case Study", TRIAL_SETUP_DEFAULT.itemsPerCase],
                      ] as const).map(([key, label, dflt]) => (
                        <div key={key} className="space-y-1">
                          <label className="text-[11px] font-semibold text-gray-500">{label}</label>
                          <input
                            type="number"
                            min={TRIAL_SETUP_LIMITS[TRIAL_KEY[key]].min}
                            max={TRIAL_SETUP_LIMITS[TRIAL_KEY[key]].max}
                            placeholder={`Mặc định ${dflt}`}
                            value={form[key]}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] leading-snug text-gray-400">
                      Ví dụ: 3 đại tội mỗi lượt, trong đó 1 Case Study — người thi làm 1 vòng dựng
                      khay ăn hoặc dựng giáo án, cộng 2 vòng phân loại tình huống. Vòng của tội đã
                      khai luôn đứng đầu và tính vào số này. Bỏ trống ô nào thì dùng số mặc định.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500">DS TB tối thiểu (triệu/tháng)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={form.promoteMinAvgRevenue}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, promoteMinAvgRevenue: parseFloat(e.target.value) || 0 }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500">Số transform tối thiểu</label>
                    <input
                      type="number"
                      min={0}
                      value={form.promoteMinTransform}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, promoteMinTransform: parseInt(e.target.value) || 0 }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">
                  PT ở cấp này phải đạt các mốc trên (kèm đậu lý thuyết & thực hành) mới được thăng. VD: Thử việc 15tr / 0, Cấp 1–3 là 30,4tr / 1. Cấp cao nhất bỏ trống.
                </p>
              </div>

              {/* Đề lý thuyết riêng của cấp — mỗi cấp một ngân hàng đề riêng, nên
                  độ dài và ngưỡng đạt cũng nên riêng. Bỏ trống = dùng số chung. */}
              <div className="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50">
                <p className="text-xs font-bold text-gray-600">Đề lý thuyết của cấp này</p>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Dạng đề</label>
                  <select
                    value={form.examFormat}
                    onChange={(e) => setForm((f) => ({ ...f, examFormat: e.target.value as "FLAT" | "TRIAL" }))}
                    className={inputCls}
                  >
                    <option value="FLAT">Trắc nghiệm phẳng (A/B/C/D)</option>
                    <option value="TRIAL">Thử thách nhiều vòng (7 đại tội)</option>
                  </select>
                  <p className="text-[11px] text-gray-400">
                    Chọn “Thử thách nhiều vòng” rồi soạn vòng ở trang Bài thi → Đề thử thách.
                    Đổi dạng đề là đổi hẳn trang làm bài của người ở cấp này.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500">Số câu mỗi bài</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      placeholder="Dùng số chung"
                      value={form.examNumQuestions}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setForm((f) => ({ ...f, examNumQuestions: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500">Điểm đạt (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="Dùng số chung"
                      value={form.examPassingScore}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setForm((f) => ({ ...f, examPassingScore: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">
                  Bỏ trống = dùng số chung ở trang Bài thi. Câu hỏi của từng cấp soạn tại trang Bài thi → Ngân hàng câu hỏi.
                </p>
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
        loading={deleting}
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
