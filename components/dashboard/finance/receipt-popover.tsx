"use client";

import { useState, type ChangeEvent } from "react";
import { X, Camera, Download, ChevronLeft, ChevronRight, Save } from "lucide-react";

type Props = {
  transactionId: string;
  initialImages: string[];
  canEdit:       boolean;
  onClose:       () => void;
  onSaved:       (images: string[]) => void;
  saveUrl?:      string;
  title?:        string;
};

function toBase64(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function downloadImage(src: string, idx: number) {
  if (src.startsWith("data:")) {
    const ext = src.startsWith("data:image/png")
      ? "png"
      : src.startsWith("data:image/webp")
      ? "webp"
      : "jpg";
    const a = document.createElement("a");
    a.href = src;
    a.download = `chung-tu-${idx + 1}.${ext}`;
    a.click();
  } else {
    window.open(src, "_blank");
  }
}

export function ReceiptPopover({ transactionId, initialImages, canEdit, onClose, onSaved, saveUrl, title = "Chứng từ giao dịch" }: Props) {
  const [images, setImages]         = useState<string[]>(initialImages);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState("");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files   = Array.from(e.target.files ?? []);
    const MAX_MB  = 5 * 1024 * 1024;
    for (const f of files) {
      if (f.size > MAX_MB) { showToast(`"${f.name}" vượt quá 5MB`); return; }
    }
    if (images.length + files.length > 5) { showToast("Tối đa 5 ảnh"); return; }
    const bases = await Promise.all(files.map(toBase64));
    setImages(prev => [...prev, ...bases]);
    e.target.value = "";
  }

  function removeImage(idx: number) {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    if (lightboxIdx !== null) {
      if (next.length === 0) setLightboxIdx(null);
      else setLightboxIdx(Math.min(lightboxIdx, next.length - 1));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = saveUrl ?? `/api/finance/transactions/${transactionId}/receipts`;
      const res = await fetch(url, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ images }),
      });
      if (res.ok) {
        onSaved(images);
        onClose();
      } else {
        showToast("Có lỗi khi lưu");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ── Gallery modal ───────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-extrabold text-gray-800">{title}</p>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Thumbnails */}
          <div className="p-5">
            {images.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {images.map((src, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover rounded-xl border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxIdx(i)}
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && images.length < 5 && (
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFiles}
                    />
                    <Camera className="w-5 h-5 text-gray-300" />
                  </label>
                )}
              </div>
            ) : canEdit ? (
              <label className="flex flex-col items-center justify-center gap-2 h-24 w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFiles}
                />
                <Camera className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-400 text-center">Tải ảnh lên · tối đa 5 ảnh · 5MB/ảnh</span>
              </label>
            ) : (
              <p className="text-center text-sm text-gray-400 italic py-6">Chưa có chứng từ</p>
            )}
          </div>

          {/* Save button */}
          {canEdit && (
            <div className="px-5 pb-5 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                style={{ backgroundColor: "#10b981" }}
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Đang lưu..." : "Lưu chứng từ"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox overlay ────────────────────────────────────── */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center">
          {/* Close → back to gallery */}
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev */}
          {lightboxIdx > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              onClick={() => setLightboxIdx(i => i! - 1)}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={images[lightboxIdx]}
            alt=""
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
          />

          {/* Next */}
          {lightboxIdx < images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              onClick={() => setLightboxIdx(i => i! + 1)}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Bottom bar */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
            <span className="text-white/50 text-sm tabular-nums">
              {lightboxIdx + 1} / {images.length}
            </span>
            <button
              onClick={() => downloadImage(images[lightboxIdx!], lightboxIdx!)}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Tải xuống
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
