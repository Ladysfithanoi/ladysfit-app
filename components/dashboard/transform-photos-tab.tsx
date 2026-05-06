"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Eye, EyeOff, X } from "lucide-react";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type TransformPhoto = {
  id:            string;
  weightBefore:  number;
  weightAfter:   number;
  durationMonths: number;
  imageUrl:      string;
  isActive:      boolean;
  order:         number;
};

const inputCls = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

// ── Form panel ──────────────────────────────────────────────────────────

function PhotoFormPanel({
  editing,
  onClose,
  onSaved,
}: {
  editing:  TransformPhoto | null;
  onClose:  () => void;
  onSaved:  (p: TransformPhoto) => void;
}) {
  const [weightBefore,   setWeightBefore]   = useState(String(editing?.weightBefore   ?? ""));
  const [weightAfter,    setWeightAfter]     = useState(String(editing?.weightAfter    ?? ""));
  const [durationMonths, setDurationMonths]  = useState(String(editing?.durationMonths ?? ""));
  const [order,          setOrder]           = useState(String(editing?.order          ?? "0"));
  const [isActive,       setIsActive]        = useState(editing?.isActive ?? true);
  const [preview,        setPreview]         = useState<string | null>(editing?.imageUrl ?? null);
  const [fileObj,        setFileObj]         = useState<File | null>(null);
  const [loading,        setLoading]         = useState(false);
  const [error,          setError]           = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileObj(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!editing && !fileObj) { setError("Vui lòng chọn ảnh"); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      if (fileObj)        fd.append("image",          fileObj);
      fd.append("weightBefore",   weightBefore);
      fd.append("weightAfter",    weightAfter);
      fd.append("durationMonths", durationMonths);
      fd.append("order",          order);
      fd.append("isActive",       String(isActive));

      const url    = editing ? `/api/transform-photos/${editing.id}` : "/api/transform-photos";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, { method, body: fd });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Có lỗi xảy ra"); }
      const saved: TransformPhoto = await res.json();
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-sm font-extrabold text-gray-900">
            {editing ? "Chỉnh sửa ảnh transform" : "Thêm ảnh transform"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Image upload */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">Ảnh *</p>
            <div
              className={cn(
                "relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors",
                preview ? "border-gray-200" : "border-gray-300 hover:border-[#f15b5c]/50"
              )}
              style={{ aspectRatio: "3/4", maxWidth: 160 }}
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <Image src={preview} alt="preview" fill className="object-cover" sizes="160px" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-300">
                  <Plus className="w-6 h-6" />
                  <span className="text-xs font-semibold">Chọn ảnh</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
            {preview && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="mt-1.5 text-xs font-semibold text-[#f15b5c] hover:opacity-80">
                Đổi ảnh
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Cân nặng trước (kg) *</label>
              <input required type="number" step="0.1" min="0" value={weightBefore}
                onChange={(e) => setWeightBefore(e.target.value)} className={inputCls} placeholder="80" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Cân nặng sau (kg) *</label>
              <input required type="number" step="0.1" min="0" value={weightAfter}
                onChange={(e) => setWeightAfter(e.target.value)} className={inputCls} placeholder="65" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Thời gian tập (tháng) *</label>
              <input required type="number" min="1" value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)} className={inputCls} placeholder="3" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Thứ tự hiển thị</label>
              <input type="number" min="0" value={order}
                onChange={(e) => setOrder(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={cn(
                "w-10 h-5 rounded-full transition-colors flex items-center px-0.5",
                isActive ? "bg-[#f15b5c]" : "bg-gray-200"
              )}
              onClick={() => setIsActive((v) => !v)}
            >
              <div className={cn("w-4 h-4 bg-white rounded-full shadow transition-transform", isActive ? "translate-x-5" : "translate-x-0")} />
            </div>
            <span className="text-sm font-semibold text-gray-700">Hiển thị</span>
          </label>

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {loading ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm mới"}
            </button>
            <button type="button" onClick={onClose}
              className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main tab ────────────────────────────────────────────────────────────

export function TransformPhotosTab() {
  const [photos,  setPhotos]  = useState<TransformPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<TransformPhoto | null>(null);
  const [deleting, setDeleting] = useState<TransformPhoto | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/transform-photos?all=1")
      .then((r) => r.json())
      .then((d) => { setPhotos(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(load, []);

  function openAdd()                   { setEditing(null); setFormOpen(true); }
  function openEdit(p: TransformPhoto) { setEditing(p);    setFormOpen(true); }

  function onSaved(saved: TransformPhoto) {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
  }

  async function toggleActive(photo: TransformPhoto) {
    const fd = new FormData();
    fd.append("weightBefore",   String(photo.weightBefore));
    fd.append("weightAfter",    String(photo.weightAfter));
    fd.append("durationMonths", String(photo.durationMonths));
    fd.append("order",          String(photo.order));
    fd.append("isActive",       String(!photo.isActive));
    const res = await fetch(`/api/transform-photos/${photo.id}`, { method: "PUT", body: fd });
    if (res.ok) {
      const updated: TransformPhoto = await res.json();
      setPhotos((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    await fetch(`/api/transform-photos/${deleting.id}`, { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== deleting.id));
    setDeleting(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-extrabold text-gray-900">Ảnh Transform</h2>
          <p className="text-xs text-gray-400 mt-0.5">{photos.length} ảnh</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-9 px-4 rounded-xl text-white text-sm font-bold"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-4 h-4" /> Thêm ảnh
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-300 animate-pulse">Đang tải...</div>
      ) : photos.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-gray-300 font-semibold">Chưa có ảnh transform nào</p>
          <button onClick={openAdd} className="mt-3 text-sm font-bold text-[#f15b5c] hover:opacity-80">
            + Thêm ảnh đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo) => {
            const kgLost = photo.weightBefore - photo.weightAfter;
            return (
              <div key={photo.id} className={cn("group relative rounded-2xl border bg-white shadow-sm overflow-hidden transition-all", photo.isActive ? "border-gray-100" : "border-dashed border-gray-200 opacity-60")}>
                {/* Image */}
                <div className="relative w-full bg-gray-50" style={{ aspectRatio: "3/4" }}>
                  {photo.imageUrl ? (
                    <Image src={photo.imageUrl} alt={`-${kgLost.toFixed(0)}kg`} fill className="object-cover" sizes="200px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-200 text-xs">No image</div>
                  )}
                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => openEdit(photo)}
                      className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(photo)}
                      className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white">
                      {photo.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setDeleting(photo)}
                      className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-red-500 hover:bg-white">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Badge */}
                  {!photo.isActive && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-gray-500 text-white text-[9px] font-bold">ẨN</span>
                  )}
                </div>
                {/* Stats */}
                <div className="px-2.5 py-2">
                  <p className="text-xs font-extrabold" style={{ color: "#f15b5c" }}>−{kgLost.toFixed(1)} kg</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{photo.weightBefore} → {photo.weightAfter} kg · {photo.durationMonths} tháng</p>
                  <p className="text-[10px] text-gray-300">STT: {photo.order}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <PhotoFormPanel
          editing={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={onSaved}
        />
      )}

      <AlertDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Xóa ảnh transform"
        description={`Bạn có chắc muốn xóa ảnh này?\nHành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        variant="danger"
        onConfirm={handleDelete}
      />
    </>
  );
}
