"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Camera, X, ChevronLeft, ChevronRight, Pencil, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESIDENT_PACKAGE, TRIAL_PACKAGE } from "@/lib/packages";

// ── Types ──────────────────────────────────────────────────────────────────

type PhotoData = {
  id: string;
  checkinImages: string[];
  transformImages: string[];
  hasTransformed: boolean;
};

type KOCData = {
  startWeight: number;
  endWeight: number | null;
  startWeightConfirmed: boolean;
  endWeightConfirmed: boolean;
  status: string;
  totalSessions: number;
  ratePerSession: number | null;
};

type SessionRow = {
  stt: number;
  enrollmentId: string;
  contractCode: string | null;
  clientId: string;
  clientName: string;
  isSubstitute: boolean;
  packageName: string;
  totalSessions: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  sessionsThisMonth: number;
  /** Trong đó: buổi do app ghi. */
  sessionsFromLogs: number;
  /** Và: phần Admin/FM cộng/trừ tay cho tháng này. */
  sessionsAdjusted: number;
  valuePerSession: number;
  totalValue: number;
  contractType: "NORMAL" | "KOC" | "KOL" | "TRANSFER";
  koc: KOCData | null;
  photo: PhotoData | null;
};

type PhotoType     = "checkin" | "transform";
// Lightbox giữ ĐỊA CHỈ ảnh (lộ trình + loại + vị trí) chứ không giữ bản sao mảng
// ảnh: đổi / xoá ngay trong lightbox thì ảnh đang xem cập nhật theo rows luôn.
type LightboxState = { enrollmentId: string; type: PhotoType; index: number };
type UploadTarget  = { row: SessionRow; type: PhotoType; images: string[] };

type Props = {
  ptId:    string;
  ptName:  string;
  month:   number;
  year:    number;
  canEdit: boolean;
  /** Cơ sở của dòng lương — Admin làm nhiều cơ sở chỉ thấy khách cơ sở này. */
  branchId?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

/** Số ảnh tối đa mỗi loại. Ô ảnh check-in đã đổi thành link hồ sơ KH — chỉ còn ảnh Transform tải lên. */
const MAX_IMAGES: Record<PhotoType, number> = { checkin: 4, transform: 3 };

function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Nhãn "dạy hộ": khách này không thuộc PT nhưng PT dạy hộ, buổi được ghi công cho PT.
function SubstituteBadge() {
  return (
    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-600 whitespace-nowrap align-middle">
      dạy hộ
    </span>
  );
}
const TH = "px-3 py-2 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap border-r border-gray-100 last:border-r-0";
const TD = "px-3 py-2.5 border-r border-gray-50 last:border-r-0";

/**
 * Ô "Số buổi" của tháng, có tách phần chỉnh tay.
 *
 * Con số này hay bị đem so với phiếu check-in của khách rồi thấy lệch. Lệch là
 * đúng: buổi Admin/FM chỉnh tay cố ý không lên phiếu, và ngược lại dòng ghi tay
 * trên phiếu cố ý không lên bảng lương. Nói thẳng ra ngay tại ô số thì không ai
 * phải đi hỏi con số thứ tư từ đâu ra nữa.
 */
function SessionCount({ row }: { row: SessionRow }) {
  if (row.sessionsThisMonth <= 0 && row.sessionsAdjusted === 0) {
    return <span className="text-gray-400">—</span>;
  }
  const adj = row.sessionsAdjusted;
  return (
    <span
      className="inline-flex flex-col items-center leading-tight"
      title={
        adj === 0
          ? `${row.sessionsFromLogs} buổi app ghi`
          : `${row.sessionsFromLogs} buổi app ghi ${adj > 0 ? "+" : "−"} ${Math.abs(adj)} buổi Admin/FM chỉnh tay`
          + " · buổi chỉnh tay không hiện trên phiếu check-in của khách"
      }
    >
      <span className={row.sessionsThisMonth > 0 ? "text-gray-800" : "text-gray-400"}>
        {row.sessionsThisMonth > 0 ? row.sessionsThisMonth : "—"}
      </span>
      {adj !== 0 && (
        <span className="mt-0.5 rounded px-1 text-[10px] font-bold text-amber-700 bg-amber-50">
          {row.sessionsFromLogs} {adj > 0 ? "+" : "−"} {Math.abs(adj)} tay
        </span>
      )}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SessionDetailTable({ ptId, ptName, month, year, canEdit, branchId }: Props) {
  const [rows, setRows]         = useState<SessionRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [uploading, setUploading] = useState<UploadTarget | null>(null);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Ô chọn file dùng chung cho nút "Đổi ảnh" (trong màn sửa lẫn lightbox).
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<{ where: "draft" | "lightbox"; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const branchParam = branchId ? `&branchId=${branchId}` : "";
      const res = await fetch(`/api/salary/session-detail?ptId=${ptId}&month=${month}&year=${year}${branchParam}`);
      if (res.ok) {
        const data = await res.json() as { rows: SessionRow[] };
        setRows(data.rows);
      }
    } finally {
      setLoading(false);
    }
  }, [ptId, month, year, branchId]);

  useEffect(() => { load(); }, [load]);

  function patchPhoto(enrollmentId: string, photo: PhotoData) {
    setRows(prev => prev.map(r => r.enrollmentId === enrollmentId ? { ...r, photo } : r));
  }

  async function savePhoto(row: SessionRow, type: PhotoType, images: string[]): Promise<boolean> {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ptId, clientId: row.clientId,
        packageEnrollmentId: row.enrollmentId, month, year,
      };
      if (type === "checkin") body.checkinImages = images;
      else                    body.transformImages = images;

      const res = await fetch("/api/salary/session-photos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        alert("Không lưu được ảnh, vui lòng thử lại.");
        return false;
      }
      patchPhoto(row.enrollmentId, await res.json() as PhotoData);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function toggleTransform(row: SessionRow) {
    const res = await fetch("/api/salary/session-photos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ptId, clientId: row.clientId,
        packageEnrollmentId: row.enrollmentId, month, year,
        hasTransformed: !(row.photo?.hasTransformed ?? false),
      }),
    });
    if (res.ok) patchPhoto(row.enrollmentId, await res.json() as PhotoData);
  }

  function openUpload(row: SessionRow, type: PhotoType) {
    const images = type === "checkin"
      ? (row.photo?.checkinImages ?? [])
      : (row.photo?.transformImages ?? []);
    setUploading({ row, type, images: [...images] });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !uploading) return;
    const max = MAX_IMAGES[uploading.type];
    const toAdd: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (uploading.images.length + toAdd.length >= max) break;
      toAdd.push(await readAsDataURL(file));
    }
    setUploading(u => u ? { ...u, images: [...u.images, ...toAdd] } : u);
  }

  async function handleSaveUpload() {
    if (!uploading) return;
    if (await savePhoto(uploading.row, uploading.type, uploading.images)) setUploading(null);
  }

  // Ảnh đang mở trong lightbox, đọc sống từ rows.
  const lightboxRow = lightbox ? rows.find(r => r.enrollmentId === lightbox.enrollmentId) : undefined;
  const lightboxImages = lightbox && lightboxRow
    ? (lightbox.type === "checkin" ? lightboxRow.photo?.checkinImages : lightboxRow.photo?.transformImages) ?? []
    : [];

  function pickReplacement(where: "draft" | "lightbox", index: number) {
    replaceTarget.current = { where, index };
    if (replaceRef.current) replaceRef.current.value = "";
    replaceRef.current?.click();
  }

  async function handleReplaceFile(files: FileList | null) {
    const target = replaceTarget.current;
    const file = files?.[0];
    if (!target || !file || !file.type.startsWith("image/")) return;
    const b64 = await readAsDataURL(file);
    if (target.where === "draft") {
      // Trong màn sửa: chỉ đổi bản nháp, bấm "Lưu ảnh" mới ghi.
      setUploading(u => u ? { ...u, images: u.images.map((img, j) => j === target.index ? b64 : img) } : u);
    } else if (lightbox && lightboxRow) {
      // Trong lightbox: không có nút Lưu nên ghi luôn.
      await savePhoto(lightboxRow, lightbox.type, lightboxImages.map((img, j) => j === target.index ? b64 : img));
    }
  }

  async function deleteLightboxImage() {
    if (!lightbox || !lightboxRow) return;
    if (!confirm("Xoá ảnh này khỏi phiếu lương?")) return;
    const next = lightboxImages.filter((_, j) => j !== lightbox.index);
    if (!(await savePhoto(lightboxRow, lightbox.type, next))) return;
    if (next.length === 0) setLightbox(null);
    else setLightbox(l => l ? { ...l, index: Math.min(l.index, next.length - 1) } : l);
  }

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     setLightbox(null);
      if (e.key === "ArrowLeft")  setLightbox(l => l && l.index > 0 ? { ...l, index: l.index - 1 } : l);
      if (e.key === "ArrowRight") setLightbox(l => l && l.index < lightboxImages.length - 1 ? { ...l, index: l.index + 1 } : l);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, lightboxImages.length]);

  const normalRows = rows.filter(r => r.contractType === "NORMAL" || r.contractType === "TRANSFER");
  const kocRows    = rows.filter(r => r.contractType === "KOC");
  const kolRows    = rows.filter(r => r.contractType === "KOL");

  const totalThisMonth = normalRows.reduce((s, r) => s + r.sessionsThisMonth, 0);
  const totalValue     = normalRows.reduce((s, r) => s + r.totalValue, 0);
  const kocTotal       = kocRows.reduce((s, r) => s + r.totalValue, 0);
  const kolTotal       = kolRows.reduce((s, r) => s + r.totalValue, 0);

  return (
    <>
      <div className="space-y-4">
        {/* ── NORMAL table ── */}
        <div className="bg-[#fdf8f8] border border-[#f15b5c]/10 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#f15b5c]/10 flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-[#f15b5c]">
              Chi tiết buổi dạy — {ptName} — Tháng {month}/{year}
            </p>
            <div className="flex items-center gap-4 text-[10px] text-gray-400 font-semibold flex-shrink-0">
              <span>Tổng buổi dạy: <span className="text-gray-700 font-bold">{totalThisMonth}</span></span>
              <span>Tổng giá trị: <span className="font-bold" style={{ color: "#f15b5c" }}>{vnd(totalValue)}</span></span>
            </div>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs text-gray-400">Đang tải...</div>
          ) : normalRows.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400 italic">Không có hợp đồng NORMAL ACTIVE nào</div>
          ) : (
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fff5f5] border-b border-[#f15b5c]/10">
                    {[
                      "STT","Mã HĐ","Tên KH","Gói tập",
                      "Tổng buổi","Còn lại","Buổi dạy tháng",
                      "Giá trị/buổi","Tổng giá trị",
                      "Link","KH đạt Transform",
                    ].map(h => <th key={h} className={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {normalRows.map(row => (
                    <NormalRow
                      key={row.enrollmentId}
                      row={row}
                      canEdit={canEdit}
                      onViewImage={(type, idx) => setLightbox({ enrollmentId: row.enrollmentId, type, index: idx })}
                      onUpload={(type) => openUpload(row, type)}
                      onToggleTransform={() => toggleTransform(row)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── KOC table ── */}
        {(kocRows.length > 0 || !loading) && (
          <div className="bg-[#fffbf0] border border-amber-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-amber-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">KOC</span>
                <p className="text-xs font-bold text-amber-700">Hợp đồng KOC — {ptName}</p>
              </div>
              <div className="text-[10px] text-gray-400 font-semibold">
                Hoa hồng KOC: <span className="text-amber-700 font-bold">{vnd(kocTotal)}</span>
              </div>
            </div>
            {kocRows.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400 italic">Không có hợp đồng KOC</div>
            ) : (
              <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-100">
                      {["STT","Mã HĐ","Tên KH","Loại","Số buổi (max 60)","Buổi dạy","Cân đầu","Cân cuối","Giá/buổi","Tổng HH","Link","Transform"].map(h => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kocRows.map(row => (
                      <KOCRow
                        key={row.enrollmentId}
                        row={row}
                        canEdit={canEdit}
                        onViewImage={(type, idx) => setLightbox({ enrollmentId: row.enrollmentId, type, index: idx })}
                        onUpload={(type) => openUpload(row, type)}
                        onToggleTransform={() => toggleTransform(row)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── KOL table ── */}
        {(kolRows.length > 0 || !loading) && (
          <div className="bg-[#f0f4ff] border border-blue-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-blue-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">KOL</span>
                <p className="text-xs font-bold text-blue-700">Hợp đồng KOL — {ptName}</p>
              </div>
              <div className="text-[10px] text-gray-400 font-semibold">
                Hoa hồng KOL: <span className="text-blue-700 font-bold">{vnd(kolTotal)}</span>
              </div>
            </div>
            {kolRows.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400 italic">Không có hợp đồng KOL</div>
            ) : (
              <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-blue-50 border-b border-blue-100">
                      {["STT","Mã HĐ","Tên KH","Loại","Buổi dạy","Giá/buổi","Tổng HH","Link","Transform"].map(h => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kolRows.map(row => (
                      <KOLRow
                        key={row.enrollmentId}
                        row={row}
                        canEdit={canEdit}
                        onViewImage={(type, idx) => setLightbox({ enrollmentId: row.enrollmentId, type, index: idx })}
                        onUpload={(type) => openUpload(row, type)}
                        onToggleTransform={() => toggleTransform(row)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center select-none"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightbox(null)}
        >
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center justify-center px-16 py-16 w-full h-full" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxImages[lightbox.index]} alt="" className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl" />
          </div>
          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            {lightbox.index + 1} / {lightboxImages.length}
          </span>
          {canEdit && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => pickReplacement("lightbox", lightbox.index)}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> Đổi ảnh
              </button>
              <button
                onClick={deleteLightboxImage}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> {saving ? "Đang lưu..." : "Xoá ảnh"}
              </button>
            </div>
          )}
          {lightbox.index > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: l.index - 1 } : l); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {lightbox.index < lightboxImages.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: l.index + 1 } : l); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      <input ref={replaceRef} type="file" accept="image/*" className="hidden" onChange={e => handleReplaceFile(e.target.files)} />

      {/* Upload modal */}
      {uploading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setUploading(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-extrabold text-gray-800">
                {uploading.type === "checkin" ? "📷 Ảnh check-in" : "🌟 Ảnh Transform"}
                {" — "}{uploading.row.clientName}
              </p>
              <button onClick={() => setUploading(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {uploading.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {uploading.images.map((img, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => pickReplacement("draft", i)}
                        title="Đổi ảnh này"
                        className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 bg-black/55 py-0.5 text-[10px] font-semibold text-white"
                      >
                        <RefreshCw className="w-3 h-3" /> Đổi
                      </button>
                      {/* Hiện sẵn, không đợi rê chuột: PT thao tác trên điện
                          thoại, mà màn cảm ứng thì không có "hover" — nút ẩn
                          tới khi rê chuột là nút không tồn tại. */}
                      <button
                        onClick={() => setUploading(u => u ? { ...u, images: u.images.filter((_, j) => j !== i) } : u)}
                        title="Xoá ảnh này"
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {uploading.images.length < MAX_IMAGES[uploading.type] && (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#f15b5c]/40 hover:bg-red-50/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-gray-500">Click để thêm ảnh</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Tối đa {MAX_IMAGES[uploading.type]} ảnh ({MAX_IMAGES[uploading.type] - uploading.images.length} còn lại)
                  </p>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setUploading(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Hủy</button>
              <button onClick={handleSaveUpload} disabled={saving} className="px-5 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{ backgroundColor: "#f15b5c" }}>
                {saving ? "Đang lưu..." : "Lưu ảnh"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Row components ─────────────────────────────────────────────────────────

function NormalRow({ row, canEdit, onViewImage, onUpload, onToggleTransform }: {
  row: SessionRow;
  canEdit: boolean;
  onViewImage: (type: PhotoType, idx: number) => void;
  onUpload: (type: PhotoType) => void;
  onToggleTransform: () => void;
}) {
  return (
    <tr className="border-b border-gray-50 hover:bg-white/80 divide-x divide-gray-50">
      <td className={cn(TD, "text-gray-400 text-center")}>{row.stt}</td>
      <td className={cn(TD, "font-mono text-gray-600 whitespace-nowrap")}>{row.contractCode ?? "—"}</td>
      <td className={cn(TD, "font-semibold text-gray-800 whitespace-nowrap min-w-[180px]")}>{row.clientName}{row.isSubstitute && <SubstituteBadge />}</td>
      <td className={TD}>
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap",
          row.packageName === RESIDENT_PACKAGE      ? "bg-teal-100 text-teal-700"
          : row.packageName === TRIAL_PACKAGE       ? "bg-amber-100 text-amber-700"
          : ["L1","L2","Loyalfit"].includes(row.packageName) ? "bg-blue-100 text-blue-700"
          :                                           "bg-purple-100 text-purple-700")}>
          {row.packageName}
        </span>
      </td>
      <td className={cn(TD, "text-center text-gray-600")}>{row.totalSessions}</td>
      <td className={cn(TD, "text-center font-semibold whitespace-nowrap", row.sessionsRemaining <= 5 ? "text-red-500" : "text-gray-600")}>
        {row.sessionsRemaining}
      </td>
      <td className={cn(TD, "text-center font-bold whitespace-nowrap")}>
        <SessionCount row={row} />
      </td>
      <td className={cn(TD, "text-gray-600 whitespace-nowrap")}>{vnd(row.valuePerSession)}</td>
      <td className={cn(TD, "font-semibold whitespace-nowrap", row.totalValue > 0 ? "text-gray-800" : "text-gray-400")}>
        {row.totalValue > 0 ? vnd(row.totalValue) : "—"}
      </td>
      <td className={TD}>
        <ProfileLinkCell clientId={row.clientId} enrollmentId={row.enrollmentId} packageName={row.packageName} />
      </td>
      <td className={TD}>
        <TransformCell
          hasTransformed={row.photo?.hasTransformed ?? false}
          transformImages={row.photo?.transformImages ?? []}
          canEdit={canEdit}
          onToggle={onToggleTransform}
          onView={idx => onViewImage("transform", idx)}
          onUpload={() => onUpload("transform")}
        />
      </td>
    </tr>
  );
}

function KOCRow({ row, canEdit, onViewImage, onUpload, onToggleTransform }: {
  row: SessionRow;
  canEdit: boolean;
  onViewImage: (type: PhotoType, idx: number) => void;
  onUpload: (type: PhotoType) => void;
  onToggleTransform: () => void;
}) {
  const koc = row.koc;
  const confirmed = koc?.endWeightConfirmed;
  const rateDisplay = confirmed
    ? (koc!.ratePerSession != null && koc!.ratePerSession > 0 ? vnd(koc!.ratePerSession) : "Không đủ ĐK")
    : "Chờ kết quả";

  return (
    <tr className="border-b border-amber-50 hover:bg-white/80 divide-x divide-amber-50">
      <td className={cn(TD, "text-gray-400 text-center")}>{row.stt}</td>
      <td className={cn(TD, "font-mono text-gray-600 whitespace-nowrap")}>{row.contractCode ?? "—"}</td>
      <td className={cn(TD, "font-semibold text-gray-800 whitespace-nowrap min-w-[180px]")}>{row.clientName}{row.isSubstitute && <SubstituteBadge />}</td>
      <td className={TD}>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">KOC</span>
      </td>
      <td className={cn(TD, "text-center text-gray-600")}>{koc?.totalSessions ?? 0} / 60</td>
      <td className={cn(TD, "text-center font-bold")}>
        <SessionCount row={row} />
      </td>
      <td className={cn(TD, "text-gray-600 whitespace-nowrap")}>
        {koc ? `${koc.startWeight}kg` : "—"}
        {koc?.startWeightConfirmed && <span className="ml-1 text-green-500 text-[10px]">✓</span>}
      </td>
      <td className={cn(TD, "text-gray-600 whitespace-nowrap")}>
        {koc?.endWeight != null ? `${koc.endWeight}kg` : "—"}
        {koc?.endWeightConfirmed && <span className="ml-1 text-green-500 text-[10px]">✓</span>}
      </td>
      <td className={cn(TD, "whitespace-nowrap", confirmed ? "text-amber-700 font-semibold" : "text-gray-400 italic")}>
        {rateDisplay}
      </td>
      <td className={cn(TD, "font-semibold whitespace-nowrap", row.totalValue > 0 ? "text-amber-700" : "text-gray-400")}>
        {row.totalValue > 0 ? vnd(row.totalValue) : "—"}
      </td>
      <td className={TD}>
        <ProfileLinkCell clientId={row.clientId} enrollmentId={row.enrollmentId} packageName={row.packageName} />
      </td>
      <td className={TD}>
        <TransformCell
          hasTransformed={row.photo?.hasTransformed ?? false}
          transformImages={row.photo?.transformImages ?? []}
          canEdit={canEdit}
          onToggle={onToggleTransform}
          onView={idx => onViewImage("transform", idx)}
          onUpload={() => onUpload("transform")}
        />
      </td>
    </tr>
  );
}

function KOLRow({ row, canEdit, onViewImage, onUpload, onToggleTransform }: {
  row: SessionRow;
  canEdit: boolean;
  onViewImage: (type: PhotoType, idx: number) => void;
  onUpload: (type: PhotoType) => void;
  onToggleTransform: () => void;
}) {
  return (
    <tr className="border-b border-blue-50 hover:bg-white/80 divide-x divide-blue-50">
      <td className={cn(TD, "text-gray-400 text-center")}>{row.stt}</td>
      <td className={cn(TD, "font-mono text-gray-600 whitespace-nowrap")}>{row.contractCode ?? "—"}</td>
      <td className={cn(TD, "font-semibold text-gray-800 whitespace-nowrap min-w-[180px]")}>{row.clientName}{row.isSubstitute && <SubstituteBadge />}</td>
      <td className={TD}>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">KOL</span>
      </td>
      <td className={cn(TD, "text-center font-bold")}>
        <SessionCount row={row} />
      </td>
      <td className={cn(TD, "text-blue-700 font-semibold whitespace-nowrap")}>60,000đ</td>
      <td className={cn(TD, "font-semibold whitespace-nowrap", row.totalValue > 0 ? "text-blue-700" : "text-gray-400")}>
        {row.totalValue > 0 ? vnd(row.totalValue) : "—"}
      </td>
      <td className={TD}>
        <ProfileLinkCell clientId={row.clientId} enrollmentId={row.enrollmentId} packageName={row.packageName} />
      </td>
      <td className={TD}>
        <TransformCell
          hasTransformed={row.photo?.hasTransformed ?? false}
          transformImages={row.photo?.transformImages ?? []}
          canEdit={canEdit}
          onToggle={onToggleTransform}
          onView={idx => onViewImage("transform", idx)}
          onUpload={() => onUpload("transform")}
        />
      </td>
    </tr>
  );
}

// ── Sub-cells ──────────────────────────────────────────────────────────────

/**
 * Ô "Link": mở thẳng phiếu check-in của gói ở dòng này (hồ sơ khách tự bật phiếu
 * qua ?sheet=), khỏi phải tìm gói trong hồ sơ. Khách mua nhiều gói thì mỗi dòng
 * mở đúng phiếu của gói đó. Mở tab mới để không mất bảng lương đang xem.
 */
function ProfileLinkCell({ clientId, enrollmentId, packageName }: { clientId: string; enrollmentId: string; packageName: string }) {
  return (
    <Link
      href={`/dashboard/clients/${clientId}?sheet=${enrollmentId}`}
      target="_blank"
      rel="noopener"
      title={`Mở phiếu check-in ${packageName}`}
      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#f15b5c] hover:underline whitespace-nowrap"
    >
      <ExternalLink className="w-3.5 h-3.5" /> Phiếu check-in
    </Link>
  );
}

function TransformCell({ hasTransformed, transformImages, canEdit, onToggle, onView, onUpload }: {
  hasTransformed: boolean;
  transformImages: string[];
  canEdit: boolean;
  onToggle: () => void;
  onView: (idx: number) => void;
  onUpload: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[120px]">
      {canEdit ? (
        <button onClick={onToggle} className={cn(
          "flex items-center gap-1.5 text-[10px] font-bold rounded-full px-2.5 py-1 transition-all w-fit whitespace-nowrap",
          hasTransformed ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        )}>
          {hasTransformed ? "✓ Đã Transform" : "Chưa Transform"}
        </button>
      ) : (
        hasTransformed
          ? <span className="text-[10px] font-bold bg-green-100 text-green-700 rounded-full px-2.5 py-1 w-fit whitespace-nowrap">✓ Đã Transform</span>
          : <span className="text-gray-300 text-xs">—</span>
      )}
      {hasTransformed && (
        <div className="flex items-center gap-1">
          {transformImages.map((img, i) => (
            <button key={i} onClick={() => onView(i)} className="w-12 h-12 rounded-lg overflow-hidden border border-green-200 hover:border-green-500 transition-colors flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {canEdit && (
            <button
              onClick={onUpload}
              title={transformImages.length < MAX_IMAGES.transform ? "Thêm ảnh" : "Sửa / thay ảnh"}
              className="w-12 h-12 rounded-lg border-2 border-dashed border-green-200 hover:border-green-400 flex items-center justify-center text-green-400 hover:text-green-600 transition-colors flex-shrink-0"
            >
              {transformImages.length < MAX_IMAGES.transform ? <Camera className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
