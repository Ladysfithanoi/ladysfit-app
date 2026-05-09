"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  packageName: string;
  totalSessions: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  sessionsThisMonth: number;
  valuePerSession: number;
  totalValue: number;
  contractType: "NORMAL" | "KOC" | "KOL";
  koc: KOCData | null;
  photo: PhotoData | null;
};

type LightboxState = { images: string[]; index: number };
type UploadTarget  = { row: SessionRow; type: "checkin" | "transform"; images: string[] };

type Props = {
  ptId:    string;
  ptName:  string;
  month:   number;
  year:    number;
  canEdit: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const TH = "px-3 py-2 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap border-r border-gray-100 last:border-r-0";
const TD = "px-3 py-2.5 border-r border-gray-50 last:border-r-0";

// ── Main component ─────────────────────────────────────────────────────────

export function SessionDetailTable({ ptId, ptName, month, year, canEdit }: Props) {
  const [rows, setRows]         = useState<SessionRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [uploading, setUploading] = useState<UploadTarget | null>(null);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/salary/session-detail?ptId=${ptId}&month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json() as { rows: SessionRow[] };
        setRows(data.rows);
      }
    } finally {
      setLoading(false);
    }
  }, [ptId, month, year]);

  useEffect(() => { load(); }, [load]);

  function patchPhoto(enrollmentId: string, photo: PhotoData) {
    setRows(prev => prev.map(r => r.enrollmentId === enrollmentId ? { ...r, photo } : r));
  }

  async function savePhoto(row: SessionRow, type: "checkin" | "transform", images: string[]) {
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
      if (res.ok) patchPhoto(row.enrollmentId, await res.json() as PhotoData);
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

  function openUpload(row: SessionRow, type: "checkin" | "transform") {
    const images = type === "checkin"
      ? (row.photo?.checkinImages ?? [])
      : (row.photo?.transformImages ?? []);
    setUploading({ row, type, images: [...images] });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !uploading) return;
    const max = uploading.type === "checkin" ? 2 : 3;
    const toAdd: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (uploading.images.length + toAdd.length >= max) break;
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      toAdd.push(b64);
    }
    setUploading(u => u ? { ...u, images: [...u.images, ...toAdd] } : u);
  }

  async function handleSaveUpload() {
    if (!uploading) return;
    await savePhoto(uploading.row, uploading.type, uploading.images);
    setUploading(null);
  }

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     setLightbox(null);
      if (e.key === "ArrowLeft")  setLightbox(l => l && l.index > 0 ? { ...l, index: l.index - 1 } : l);
      if (e.key === "ArrowRight") setLightbox(l => l && l.index < l.images.length - 1 ? { ...l, index: l.index + 1 } : l);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const normalRows = rows.filter(r => r.contractType === "NORMAL");
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#fff5f5] border-b border-[#f15b5c]/10">
                    {[
                      "STT","Mã HĐ","Tên KH","Gói tập",
                      "Tổng buổi","Còn lại","Buổi dạy tháng",
                      "Giá trị/buổi","Tổng giá trị",
                      "Ảnh check-in","KH đạt Transform",
                    ].map(h => <th key={h} className={TH}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {normalRows.map(row => (
                    <NormalRow
                      key={row.enrollmentId}
                      row={row}
                      canEdit={canEdit}
                      onViewImage={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-100">
                      {["STT","Mã HĐ","Tên KH","Loại","Số buổi (max 60)","Buổi dạy","Cân đầu","Cân cuối","Giá/buổi","Tổng HH","Ảnh","Transform"].map(h => (
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
                        onViewImage={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-blue-50 border-b border-blue-100">
                      {["STT","Mã HĐ","Tên KH","Loại","Buổi dạy","Giá/buổi","Tổng HH","Ảnh","Transform"].map(h => (
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
                        onViewImage={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
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
      {lightbox && (
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
            <img src={lightbox.images[lightbox.index]} alt="" className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl shadow-2xl" />
          </div>
          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            {lightbox.index + 1} / {lightbox.images.length}
          </span>
          {lightbox.index > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: l.index - 1 } : l); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {lightbox.index < lightbox.images.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, index: l.index + 1 } : l); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

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
                    <div key={i} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setUploading(u => u ? { ...u, images: u.images.filter((_, j) => j !== i) } : u)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {uploading.images.length < (uploading.type === "checkin" ? 2 : 3) && (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#f15b5c]/40 hover:bg-red-50/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-gray-500">Click để thêm ảnh</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Tối đa {uploading.type === "checkin" ? 2 : 3} ảnh ({(uploading.type === "checkin" ? 2 : 3) - uploading.images.length} còn lại)
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
  onViewImage: (imgs: string[], idx: number) => void;
  onUpload: (type: "checkin" | "transform") => void;
  onToggleTransform: () => void;
}) {
  return (
    <tr className="border-b border-gray-50 hover:bg-white/80 divide-x divide-gray-50">
      <td className={cn(TD, "text-gray-400 text-center")}>{row.stt}</td>
      <td className={cn(TD, "font-mono text-gray-600 whitespace-nowrap")}>{row.contractCode ?? "—"}</td>
      <td className={cn(TD, "font-semibold text-gray-800 whitespace-nowrap")}>{row.clientName}</td>
      <td className={TD}>
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap",
          ["L1","L2","Loyalfit"].includes(row.packageName) ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
          {row.packageName}
        </span>
      </td>
      <td className={cn(TD, "text-center text-gray-600")}>{row.totalSessions}</td>
      <td className={cn(TD, "text-center font-semibold whitespace-nowrap", row.sessionsRemaining <= 5 ? "text-red-500" : "text-gray-600")}>
        {row.sessionsRemaining}
      </td>
      <td className={cn(TD, "text-center font-bold whitespace-nowrap", row.sessionsThisMonth > 0 ? "text-gray-800" : "text-gray-400")}>
        {row.sessionsThisMonth > 0 ? row.sessionsThisMonth : "—"}
      </td>
      <td className={cn(TD, "text-gray-600 whitespace-nowrap")}>{vnd(row.valuePerSession)}</td>
      <td className={cn(TD, "font-semibold whitespace-nowrap", row.totalValue > 0 ? "text-gray-800" : "text-gray-400")}>
        {row.totalValue > 0 ? vnd(row.totalValue) : "—"}
      </td>
      <td className={TD}>
        <CheckinCell images={row.photo?.checkinImages ?? []} canEdit={canEdit}
          onView={idx => onViewImage(row.photo!.checkinImages, idx)} onUpload={() => onUpload("checkin")} />
      </td>
      <td className={TD}>
        <TransformCell
          hasTransformed={row.photo?.hasTransformed ?? false}
          transformImages={row.photo?.transformImages ?? []}
          canEdit={canEdit}
          onToggle={onToggleTransform}
          onView={idx => onViewImage(row.photo!.transformImages, idx)}
          onUpload={() => onUpload("transform")}
        />
      </td>
    </tr>
  );
}

function KOCRow({ row, canEdit, onViewImage, onUpload, onToggleTransform }: {
  row: SessionRow;
  canEdit: boolean;
  onViewImage: (imgs: string[], idx: number) => void;
  onUpload: (type: "checkin" | "transform") => void;
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
      <td className={cn(TD, "font-semibold text-gray-800 whitespace-nowrap")}>{row.clientName}</td>
      <td className={TD}>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">KOC</span>
      </td>
      <td className={cn(TD, "text-center text-gray-600")}>{koc?.totalSessions ?? 0} / 60</td>
      <td className={cn(TD, "text-center font-bold", row.sessionsThisMonth > 0 ? "text-gray-800" : "text-gray-400")}>
        {row.sessionsThisMonth > 0 ? row.sessionsThisMonth : "—"}
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
        <CheckinCell images={row.photo?.checkinImages ?? []} canEdit={canEdit}
          onView={idx => onViewImage(row.photo!.checkinImages, idx)} onUpload={() => onUpload("checkin")} />
      </td>
      <td className={TD}>
        <TransformCell
          hasTransformed={row.photo?.hasTransformed ?? false}
          transformImages={row.photo?.transformImages ?? []}
          canEdit={canEdit}
          onToggle={onToggleTransform}
          onView={idx => onViewImage(row.photo!.transformImages, idx)}
          onUpload={() => onUpload("transform")}
        />
      </td>
    </tr>
  );
}

function KOLRow({ row, canEdit, onViewImage, onUpload, onToggleTransform }: {
  row: SessionRow;
  canEdit: boolean;
  onViewImage: (imgs: string[], idx: number) => void;
  onUpload: (type: "checkin" | "transform") => void;
  onToggleTransform: () => void;
}) {
  return (
    <tr className="border-b border-blue-50 hover:bg-white/80 divide-x divide-blue-50">
      <td className={cn(TD, "text-gray-400 text-center")}>{row.stt}</td>
      <td className={cn(TD, "font-mono text-gray-600 whitespace-nowrap")}>{row.contractCode ?? "—"}</td>
      <td className={cn(TD, "font-semibold text-gray-800 whitespace-nowrap")}>{row.clientName}</td>
      <td className={TD}>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">KOL</span>
      </td>
      <td className={cn(TD, "text-center font-bold", row.sessionsThisMonth > 0 ? "text-gray-800" : "text-gray-400")}>
        {row.sessionsThisMonth > 0 ? row.sessionsThisMonth : "—"}
      </td>
      <td className={cn(TD, "text-blue-700 font-semibold whitespace-nowrap")}>60,000đ</td>
      <td className={cn(TD, "font-semibold whitespace-nowrap", row.totalValue > 0 ? "text-blue-700" : "text-gray-400")}>
        {row.totalValue > 0 ? vnd(row.totalValue) : "—"}
      </td>
      <td className={TD}>
        <CheckinCell images={row.photo?.checkinImages ?? []} canEdit={canEdit}
          onView={idx => onViewImage(row.photo!.checkinImages, idx)} onUpload={() => onUpload("checkin")} />
      </td>
      <td className={TD}>
        <TransformCell
          hasTransformed={row.photo?.hasTransformed ?? false}
          transformImages={row.photo?.transformImages ?? []}
          canEdit={canEdit}
          onToggle={onToggleTransform}
          onView={idx => onViewImage(row.photo!.transformImages, idx)}
          onUpload={() => onUpload("transform")}
        />
      </td>
    </tr>
  );
}

// ── Sub-cells ──────────────────────────────────────────────────────────────

function CheckinCell({ images, canEdit, onView, onUpload }: {
  images: string[];
  canEdit: boolean;
  onView: (idx: number) => void;
  onUpload: () => void;
}) {
  if (images.length === 0) {
    if (!canEdit) return <span className="text-gray-300 text-xs">—</span>;
    return (
      <button onClick={onUpload} className="flex items-center gap-1 text-gray-400 hover:text-[#f15b5c] transition-colors text-[10px] font-semibold whitespace-nowrap">
        <Camera className="w-3.5 h-3.5" /> Thêm ảnh
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {images.map((img, i) => (
        <button key={i} onClick={() => onView(i)} className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 hover:border-[#f15b5c] transition-colors flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
      {canEdit && images.length < 2 && (
        <button onClick={onUpload} className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-200 hover:border-[#f15b5c] flex items-center justify-center text-gray-400 hover:text-[#f15b5c] transition-colors flex-shrink-0">
          <Camera className="w-4 h-4" />
        </button>
      )}
    </div>
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
          {canEdit && transformImages.length < 3 && (
            <button onClick={onUpload} className="w-12 h-12 rounded-lg border-2 border-dashed border-green-200 hover:border-green-400 flex items-center justify-center text-green-400 hover:text-green-600 transition-colors flex-shrink-0">
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
