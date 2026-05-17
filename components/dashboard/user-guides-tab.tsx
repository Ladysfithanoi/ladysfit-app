"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog } from "@/components/ui/alert-dialog";

type UserGuide = {
  id: string;
  title: string;
  roleGroup: string;
  category: string;
  youtubeUrl: string;
  order: number;
  isActive: boolean;
};

const ROLE_GROUPS = [
  { value: "CEO", label: "CEO" },
  { value: "COO", label: "COO" },
  { value: "FM",  label: "FM"  },
  { value: "PT",  label: "PT"  },
];

const ROLE_GROUP_COLOR: Record<string, string> = {
  CEO: "bg-violet-50 text-violet-700",
  COO: "bg-blue-50 text-blue-700",
  FM:  "bg-emerald-50 text-emerald-700",
  PT:  "bg-amber-50 text-amber-700",
};

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const inputCls = "w-full h-11 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

const EMPTY_FORM = { title: "", roleGroup: "PT", category: "", youtubeUrl: "", order: 0 };

export function UserGuidesTab() {
  const [guides, setGuides]             = useState<UserGuide[]>([]);
  const [loading, setLoading]           = useState(true);
  const [formOpen, setFormOpen]         = useState(false);
  const [editing, setEditing]           = useState<UserGuide | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [pending, setPending]           = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [toast, setToast]               = useState("");

  const [form, setForm] = useState(EMPTY_FORM);

  const fetchGuides = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user-guides");
      if (res.ok) setGuides(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuides(); }, [fetchGuides]);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, order: guides.length });
    setError("");
    setFormOpen(true);
  }

  function openEdit(g: UserGuide) {
    setEditing(g);
    setForm({ title: g.title, roleGroup: g.roleGroup, category: g.category, youtubeUrl: g.youtubeUrl, order: g.order });
    setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim())      { setError("Vui lòng nhập tiêu đề"); return; }
    if (!form.category.trim())   { setError("Vui lòng nhập danh mục"); return; }
    if (!form.youtubeUrl.trim()) { setError("Vui lòng nhập link YouTube"); return; }
    if (!extractYouTubeId(form.youtubeUrl)) {
      setError("Link YouTube không hợp lệ. Vui lòng dùng dạng youtube.com/watch?v=... hoặc youtu.be/...");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url    = editing ? `/api/user-guides/${editing.id}` : "/api/user-guides";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi");
      setFormOpen(false);
      setEditing(null);
      await fetchGuides();
      showToast(editing ? "Đã cập nhật bài hướng dẫn" : "Đã thêm bài hướng dẫn mới");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await fetch(`/api/user-guides/${pending.id}`, { method: "DELETE" });
      setGuides((prev) => prev.filter((g) => g.id !== pending.id));
      setDeleteDialog(false);
      setPending(null);
      showToast("Đã xóa bài hướng dẫn");
    } finally {
      setDeleting(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const vidPreviewId = form.youtubeUrl ? extractYouTubeId(form.youtubeUrl) : null;

  // Group by roleGroup → category for display
  const grouped = ROLE_GROUPS
    .map((rg) => ({
      roleGroup: rg,
      guides: guides.filter((g) => g.roleGroup === rg.value),
    }))
    .filter((g) => g.guides.length > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-gray-800">Quản lý bài hướng dẫn</h2>
          <p className="text-xs text-gray-400 mt-0.5">{guides.length} bài hướng dẫn · Nhân sự có thể xem tại trang Hướng dẫn</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold shadow-sm"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-4 h-4" />
          Thêm bài hướng dẫn
        </button>
      </div>

      {/* Guide list grouped by roleGroup */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Đang tải...</div>
      ) : guides.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-sm font-semibold text-gray-300">Chưa có bài hướng dẫn nào</p>
          <p className="text-xs text-gray-300 mt-1">Nhấn "Thêm bài hướng dẫn" để bắt đầu</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ roleGroup: rg, guides: rgGuides }) => {
            // Sub-group by category within this roleGroup
            const categories = Array.from(new Set(rgGuides.map((g) => g.category)));
            return (
              <div key={rg.value} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* RoleGroup header */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full", ROLE_GROUP_COLOR[rg.value] ?? "bg-gray-100 text-gray-600")}>
                    {rg.label}
                  </span>
                  <span className="text-xs text-gray-400">{rgGuides.length} bài</span>
                </div>
                {/* Category sub-groups */}
                {categories.map((cat) => {
                  const catGuides = rgGuides.filter((g) => g.category === cat);
                  return (
                    <div key={cat}>
                      <div className="px-5 py-2 bg-gray-50/60 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500">{cat}</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {catGuides.map((g) => {
                          const vid = extractYouTubeId(g.youtubeUrl);
                          return (
                            <div key={g.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                              {vid && (
                                <img
                                  src={`https://img.youtube.com/vi/${vid}/default.jpg`}
                                  alt={g.title}
                                  className="w-16 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{g.title}</p>
                                <p className="text-xs text-gray-400 truncate mt-0.5">{g.youtubeUrl}</p>
                              </div>
                              <span className="text-xs text-gray-300 font-semibold flex-shrink-0">#{g.order}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => openEdit(g)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#f15b5c] hover:bg-[#f15b5c]/5 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => { setPending({ id: g.id, title: g.title }); setDeleteDialog(true); }}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit slide-over */}
      {formOpen && (
        <>
          <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setFormOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold">{editing ? "Chỉnh sửa bài hướng dẫn" : "Thêm bài hướng dẫn mới"}</h2>
              <button onClick={() => setFormOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Phân loại (roleGroup) */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Phân loại *</label>
                <select
                  value={form.roleGroup}
                  onChange={(e) => setForm((f) => ({ ...f, roleGroup: e.target.value }))}
                  className={inputCls}
                >
                  {ROLE_GROUPS.map((rg) => (
                    <option key={rg.value} value={rg.value}>{rg.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">Chọn nhóm nhân sự sẽ xem bài hướng dẫn này</p>
              </div>

              {/* Danh mục — free text */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Danh mục *</label>
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Ví dụ: Setup Doanh số, Mục tiêu KPI..."
                  className={inputCls}
                />
                <p className="text-xs text-gray-400">Nhập tên danh mục tùy ý để gom nhóm bài học</p>
              </div>

              {/* Tiêu đề */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Tiêu đề *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ví dụ: Cách duyệt mục tiêu tuần"
                  className={inputCls}
                />
              </div>

              {/* Link YouTube */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Link YouTube *</label>
                <input
                  value={form.youtubeUrl}
                  onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
                  placeholder="https://youtu.be/abc123 hoặc youtube.com/watch?v=..."
                  className={inputCls}
                />
                <p className="text-xs text-gray-400">Hỗ trợ: youtube.com/watch?v=... · youtu.be/... · youtube.com/embed/...</p>
              </div>

              {/* YouTube preview */}
              {vidPreviewId && (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={`https://img.youtube.com/vi/${vidPreviewId}/mqdefault.jpg`}
                    alt="Preview"
                    className="w-full object-cover"
                  />
                  <p className="text-xs text-emerald-600 font-semibold text-center py-1.5 bg-emerald-50">
                    ✓ Link YouTube hợp lệ — ID: {vidPreviewId}
                  </p>
                </div>
              )}

              {/* Thứ tự */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Thứ tự hiển thị</label>
                <input
                  type="number"
                  value={form.order}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                  className={inputCls}
                  min={0}
                />
                <p className="text-xs text-gray-400">Số nhỏ hơn → hiển thị trước</p>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm text-[#f15b5c] font-semibold">{error}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm mới"}
              </button>
              <button
                onClick={() => setFormOpen(false)}
                className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Hủy
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={deleteDialog}
        onClose={() => { if (!deleting) { setDeleteDialog(false); setPending(null); } }}
        title="Xóa bài hướng dẫn"
        description={`Bạn có chắc muốn xóa "${pending?.title}"?\nHành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
