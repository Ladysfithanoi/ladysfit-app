"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Upload, Save } from "lucide-react";

type Props = {
  recordId:      string;
  ptName:        string;
  month:         number;
  year:          number;
  initialImages: string[];
  mode:          "view" | "upload";
  initialIndex?: number;
  canEdit:       boolean;
  onClose:       () => void;
  onSaved:       (images: string[]) => void;
};

export function SessionImageModal({
  recordId, ptName, month, year, initialImages,
  mode, initialIndex = 0, canEdit, onClose, onSaved,
}: Props) {
  const [images, setImages]         = useState<string[]>(initialImages);
  const [viewIdx, setViewIdx]       = useState(initialIndex);
  const [currentMode, setCurrentMode] = useState<"view" | "upload">(mode);
  const [saving, setSaving]         = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const touchStartX                 = useRef(0);

  // Keyboard navigation in view mode
  useEffect(() => {
    if (currentMode !== "view") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   setViewIdx(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight")  setViewIdx(i => Math.min(images.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentMode, images.length, onClose]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 50) return;
    if (dx > 0) setViewIdx(i => Math.max(0, i - 1));
    else        setViewIdx(i => Math.min(images.length - 1, i + 1));
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const added: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (images.length + added.length >= 20) break;
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      added.push(b64);
    }
    setImages(prev => [...prev, ...added]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/salary/records/${recordId}/session-images`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ images }),
      });
      if (res.ok) onSaved(images);
    } finally {
      setSaving(false);
    }
  }

  // ── Lightbox / view mode ───────────────────────────────────────────────────
  if (currentMode === "view") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center select-none"
        style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
        onClick={onClose}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10 pointer-events-none">
          <span className="text-white/70 text-sm font-medium">
            {ptName} — Tháng {month}/{year}
          </span>
          <div className="flex items-center gap-3 pointer-events-auto">
            <span className="text-white/50 text-sm">{viewIdx + 1} / {images.length}</span>
            {canEdit && (
              <button
                onClick={e => { e.stopPropagation(); setCurrentMode("upload"); }}
                className="text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/25 transition-colors"
              >
                Sửa ảnh
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onClose(); }}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main image */}
        <div
          className="flex items-center justify-center px-16 py-20 w-full h-full"
          onClick={e => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[viewIdx]}
            alt={`Ảnh ${viewIdx + 1}`}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
            style={{ transition: "opacity 0.12s ease" }}
          />
        </div>

        {/* Prev arrow */}
        {images.length > 1 && viewIdx > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setViewIdx(i => i - 1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/22 text-white transition-colors"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}

        {/* Next arrow */}
        {images.length > 1 && viewIdx < images.length - 1 && (
          <button
            onClick={e => { e.stopPropagation(); setViewIdx(i => i + 1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/22 text-white transition-colors"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={e => e.stopPropagation()}
          >
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setViewIdx(i)}
                className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all ${
                  i === viewIdx
                    ? "border-white scale-110"
                    : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Upload mode ────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-extrabold text-gray-800">
            Ảnh buổi dạy — {ptName} — Tháng {month}/{year}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Thumbnails grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={`Ảnh ${i + 1}`}
                    className="w-full h-full object-cover cursor-pointer transition-opacity hover:opacity-90"
                    onClick={() => { setViewIdx(i); setCurrentMode("view"); }}
                  />
                  {canEdit && (
                    <button
                      onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/30 text-white text-[9px] text-center py-0.5">
                    {i + 1}/{images.length}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          {canEdit && images.length < 20 && (
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-[#f15b5c] bg-red-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            >
              <Upload className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-500">Kéo thả hoặc click để tải ảnh lên</p>
              <p className="text-xs text-gray-400 mt-1">
                JPEG, PNG, WebP — tối đa 20 ảnh ({20 - images.length} còn lại)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
          )}

          {!canEdit && images.length === 0 && (
            <p className="text-center text-sm text-gray-400 italic py-8">Không có ảnh buổi dạy</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {canEdit ? "Hủy" : "Đóng"}
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Save className="w-4 h-4" />
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
