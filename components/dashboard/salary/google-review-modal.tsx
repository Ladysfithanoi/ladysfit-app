"use client";

import { useEffect, useRef, useState } from "react";
import { X, Upload, Trash2, RefreshCw, Pencil, Check, Loader2 } from "lucide-react";

// Ảnh đánh giá Google Business của một cơ sở trong một tháng. Mỗi ảnh = một
// đánh giá được thưởng (lib/google-review-bonus) — thêm, thay ảnh, sửa tên
// khách / ghi chú hay xoá ở đây là thưởng Google trên bảng lương đổi theo.

type Proof = {
  id: string;
  imageUrl: string;
  customerName: string | null;
  note: string | null;
};

type Props = {
  branchId:   string;
  branchName: string;
  month:      number;
  year:       number;
  canEdit:    boolean;
  onClose:    () => void;
  /** Gọi khi danh sách ảnh đổi — để bảng lương tính lại thưởng. */
  onChanged:  () => void;
};

const MAX_BYTES = 5 * 1024 * 1024;

async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Chỉ chấp nhận file ảnh");
  if (file.size > MAX_BYTES) throw new Error("Ảnh không được vượt quá 5MB");
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error ?? "Tải ảnh lên không thành công");
  return data.url as string;
}

export function GoogleReviewModal({ branchId, branchName, month, year, canEdit, onClose, onChanged }: Props) {
  const [proofs, setProofs]   = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null); // "add" | proof id
  const [error, setError]     = useState("");
  const [editId, setEditId]   = useState<string | null>(null);
  const [draft, setDraft]     = useState({ customerName: "", note: "" });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const addInput     = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceFor   = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/salary/google-reviews?branchId=${branchId}&month=${month}&year=${year}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Không tải được ảnh");
        if (alive) setProofs(data);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Không tải được ảnh");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [branchId, month, year]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (preview) setPreview(null); else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, onClose]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(null);
    }
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    run("add", async () => {
      for (const file of list) {
        const imageUrl = await uploadImage(file);
        const res = await fetch("/api/salary/google-reviews", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ branchId, month, year, imageUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Lưu ảnh không thành công");
        setProofs(prev => [...prev, data]);
      }
    });
  }

  async function patch(id: string, body: Partial<Pick<Proof, "imageUrl" | "customerName" | "note">>) {
    const res = await fetch(`/api/salary/google-reviews/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Lưu không thành công");
    setProofs(prev => prev.map(p => (p.id === id ? data : p)));
  }

  function replaceFile(files: FileList | null) {
    const id = replaceFor.current;
    replaceFor.current = null;
    const file = files?.[0];
    if (!id || !file) return;
    run(id, async () => patch(id, { imageUrl: await uploadImage(file) }));
  }

  function saveEdit(id: string) {
    run(id, async () => {
      await patch(id, { customerName: draft.customerName, note: draft.note });
      setEditId(null);
    });
  }

  function remove(id: string) {
    run(id, async () => {
      const res = await fetch(`/api/salary/google-reviews/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Xoá không thành công");
      }
      setProofs(prev => prev.filter(p => p.id !== id));
      setConfirmId(null);
    });
  }

  const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-800">Đánh giá Google Business</p>
            <p className="text-xs text-gray-400 truncate">
              {branchName} · Tháng {month}/{year} · {proofs.length} đánh giá = {vnd(proofs.length * 100_000)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {canEdit && (
            <button
              onClick={() => addInput.current?.click()}
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#f15b5c] hover:bg-red-50/40 py-5 text-sm font-semibold text-gray-500 disabled:opacity-50 transition-colors"
            >
              {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy === "add" ? "Đang tải ảnh lên..." : "Tải ảnh đánh giá lên (chọn được nhiều ảnh)"}
            </button>
          )}
          <p className="text-[11px] text-gray-400">
            Mỗi ảnh là một đánh giá, thưởng 100.000đ cho FM hưởng hoa hồng doanh số phòng.
          </p>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Đang tải...</p>
          ) : proofs.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">Chưa có ảnh đánh giá nào trong tháng này</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {proofs.map((p, i) => (
                <div key={p.id} className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50 flex flex-col">
                  <button onClick={() => setPreview(p.imageUrl)} className="relative block aspect-[4/3] bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt={`Đánh giá ${i + 1}`} className="w-full h-full object-cover" />
                    {busy === p.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                      </span>
                    )}
                  </button>

                  <div className="p-2.5 space-y-1.5 flex-1 flex flex-col">
                    {editId === p.id ? (
                      <>
                        <input
                          value={draft.customerName}
                          onChange={e => setDraft(d => ({ ...d, customerName: e.target.value }))}
                          placeholder="Tên khách"
                          className="w-full h-7 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                        />
                        <input
                          value={draft.note}
                          onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
                          placeholder="Ghi chú"
                          className="w-full h-7 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                        />
                        <div className="flex gap-1.5 pt-0.5">
                          <button
                            onClick={() => saveEdit(p.id)}
                            disabled={busy !== null}
                            className="flex-1 h-7 rounded-lg text-white text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-1"
                            style={{ backgroundColor: "#f15b5c" }}
                          >
                            <Check className="w-3.5 h-3.5" /> Lưu
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="h-7 px-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600"
                          >
                            Huỷ
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-gray-700 truncate">
                          {p.customerName || <span className="font-normal italic text-gray-400">Chưa ghi tên khách</span>}
                        </p>
                        {p.note && <p className="text-[11px] text-gray-500 line-clamp-2">{p.note}</p>}
                      </>
                    )}

                    {canEdit && editId !== p.id && (
                      <div className="flex items-center gap-1 pt-1 mt-auto">
                        {confirmId === p.id ? (
                          <>
                            <button
                              onClick={() => remove(p.id)}
                              disabled={busy !== null}
                              className="flex-1 h-7 rounded-lg bg-red-500 text-white text-[11px] font-bold disabled:opacity-50"
                            >
                              Xác nhận xoá
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="h-7 px-2 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-600"
                            >
                              Huỷ
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { replaceFor.current = p.id; replaceInput.current?.click(); }}
                              disabled={busy !== null}
                              title="Thay ảnh"
                              className="flex-1 h-7 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <RefreshCw className="w-3 h-3" /> Thay
                            </button>
                            <button
                              onClick={() => {
                                setDraft({ customerName: p.customerName ?? "", note: p.note ?? "" });
                                setEditId(p.id);
                              }}
                              disabled={busy !== null}
                              title="Sửa tên khách / ghi chú"
                              className="flex-1 h-7 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Pencil className="w-3 h-3" /> Sửa
                            </button>
                            <button
                              onClick={() => setConfirmId(p.id)}
                              disabled={busy !== null}
                              title="Xoá ảnh"
                              className="h-7 w-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 inline-flex items-center justify-center disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <input ref={addInput} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={replaceInput} type="file" accept="image/*" className="hidden"
          onChange={e => { replaceFile(e.target.files); e.target.value = ""; }} />
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={e => { e.stopPropagation(); setPreview(null); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Đánh giá Google" className="max-w-[92vw] max-h-[88vh] object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
