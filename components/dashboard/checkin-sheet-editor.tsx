"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SHEET_TOTAL_ROWS,
  isoFromSheetDay,
  isoFromSheetTime,
  sheetDay,
  sheetTime,
  type SheetOverride,
  type SheetRow,
} from "@/lib/checkin-sheet";

/**
 * TRÌNH SỬA PHIẾU CHECK-IN.
 *
 * Sửa LỚP PHỦ chứ không sửa buổi tập: xem đầu lib/checkin-sheet.ts. Cột chữ ký
 * và cột ảnh check-out khoá cứng, chỉ hiện có/không — hai thứ đó là bằng chứng
 * buổi tập có thật.
 *
 * Mỗi ô nhập giữ đúng giá trị ĐANG IN trên phiếu, và ô để trống nghĩa là "dùng
 * số hệ thống tự tính" chứ không phải "xoá trắng". Nhờ vậy sửa một ô không vô
 * tình đóng băng những ô mình không đụng tới: số cân mang theo từ lần cân trước
 * vẫn tự cập nhật khi khách cân lại.
 */

type Original = {
  contractCode: string | null;
  clientName: string;
  ptName: string;
  fmName: string;
  totalSessions: number;
  startDate: string | null;
  endDate: string | null;
  price: number;
};

type Props = {
  rows: SheetRow[];
  original: Original;
  override: SheetOverride;
  saving: boolean;
  onCancel: () => void;
  onSave: (next: SheetOverride) => void;
};

/** Dòng đang nằm trên bàn sửa. `logId` null = buổi ghi tay. */
type DraftRow = {
  key: string;
  logId: string | null;
  day: string;
  time: string;
  /** Ô cân nặng. Rỗng = dùng số hệ thống tự tính (hiện mờ ở placeholder). */
  weight: string;
  /** Số cân hệ thống đang tính cho dòng này — chỉ để gợi ý, không lưu. */
  autoWeight: number | null;
  hasSignature: boolean;
  hasPhoto: boolean;
};

const INPUT =
  "h-9 w-full rounded-lg border border-gray-200 px-2.5 text-xs font-semibold text-gray-700 " +
  "outline-none transition-colors focus:border-[#f15b5c] disabled:bg-gray-50 disabled:text-gray-400";

const LABEL = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400";

function fmtVnd(n: number): string {
  return n.toLocaleString("vi-VN");
}

/** Khoá tạm cho một dòng ghi tay mới. Chỉ cần không trùng trong cùng tờ phiếu. */
function newRowId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function CheckinSheetEditor({
  rows, original, override, saving, onCancel, onSave,
}: Props) {
  const [header, setHeader] = useState(() => ({
    contractCode:  override.header.contractCode  ?? original.contractCode ?? "",
    clientName:    override.header.clientName    ?? original.clientName,
    ptName:        override.header.ptName        ?? original.ptName,
    fmName:        override.header.fmName        ?? original.fmName,
    totalSessions: String(override.header.totalSessions ?? original.totalSessions),
    startDate:     (override.header.startDate !== undefined ? override.header.startDate : original.startDate) ?? "",
    endDate:       (override.header.endDate   !== undefined ? override.header.endDate   : original.endDate)   ?? "",
    price:         String(override.header.price ?? original.price ?? 0),
  }));

  const [draft, setDraft] = useState<DraftRow[]>(() =>
    rows.map((r) => {
      const saved = r.manual
        ? override.extraRows.find((e) => e.id === r.id)?.weight
        : override.rows[r.id]?.weight;
      return {
        key: r.id,
        logId: r.manual ? null : r.id,
        day: sheetDay(r.date),
        time: sheetTime(r.checkOutAt),
        weight: saved != null ? String(saved) : "",
        autoWeight: r.weight,
        hasSignature: r.signatureUrl != null,
        hasPhoto: r.photoUrl != null,
      };
    })
  );

  const manualCount = draft.filter((r) => r.logId == null).length;
  const full = draft.length >= SHEET_TOTAL_ROWS;

  /** Dòng xếp theo ngày, đúng thứ tự sẽ in ra — sửa ngày là thấy nó nhảy chỗ. */
  const ordered = useMemo(
    () => [...draft].sort((a, b) => a.day.localeCompare(b.day)),
    [draft]
  );

  function patchRow(key: string, patch: Partial<DraftRow>) {
    setDraft((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    if (full) return;
    // Buổi ghi tay mặc định đứng TRƯỚC buổi sớm nhất đang có — đó là lý do tính
    // năng này tồn tại: điền bù những buổi tập từ trước khi có app.
    const earliest = draft.reduce<string | null>(
      (min, r) => (min == null || r.day < min ? r.day : min), null
    );
    const base = earliest ? new Date(`${earliest}T00:00:00.000Z`) : new Date();
    base.setUTCDate(base.getUTCDate() - 1);
    setDraft((prev) => [
      ...prev,
      {
        key: newRowId(), logId: null,
        day: base.toISOString().slice(0, 10), time: "",
        weight: "", autoWeight: null, hasSignature: false, hasPhoto: false,
      },
    ]);
  }

  function removeRow(key: string) {
    setDraft((prev) => prev.filter((r) => r.key !== key));
  }

  function resetHeaderField(field: keyof Original) {
    const v = original[field];
    setHeader((h) => ({
      ...h,
      [field]:
        field === "totalSessions" || field === "price" ? String(v ?? 0) : (v ?? ""),
    }));
  }

  function buildOverride(): SheetOverride {
    const next: SheetOverride = { header: {}, rows: {}, extraRows: [] };

    // Ô tiêu đề: chỉ ghi cái KHÁC số gốc. Giữ nguyên thì không đẻ ra bản sao,
    // nhờ vậy đổi tên PT phụ trách sau này vẫn tự chảy vào phiếu.
    if (header.contractCode.trim() !== (original.contractCode ?? "")) {
      next.header.contractCode = header.contractCode.trim();
    }
    if (header.clientName.trim() !== original.clientName) next.header.clientName = header.clientName.trim();
    if (header.ptName.trim()     !== original.ptName)     next.header.ptName     = header.ptName.trim();
    if (header.fmName.trim()     !== original.fmName)     next.header.fmName     = header.fmName.trim();

    const total = Math.round(Number(header.totalSessions));
    if (Number.isFinite(total) && total !== original.totalSessions) next.header.totalSessions = total;

    const price = Math.round(Number(header.price));
    if (Number.isFinite(price) && price !== original.price) next.header.price = price;

    for (const field of ["startDate", "endDate"] as const) {
      const typed = header[field] ? isoFromSheetDay(sheetDay(header[field])) : null;
      const base  = original[field];
      const same  = (typed == null && base == null)
                 || (typed != null && base != null && sheetDay(typed) === sheetDay(base));
      if (!same) next.header[field] = typed;
    }

    // Các dòng
    for (const r of draft) {
      const dateIso = isoFromSheetDay(r.day);
      if (dateIso == null) continue; // không có ngày thì không xếp được vào phiếu
      const timeIso = r.time ? isoFromSheetTime(r.day, r.time) : null;
      const w = r.weight.trim() === "" ? null : Number(r.weight.replace(",", "."));
      const weight = w != null && Number.isFinite(w) ? w : null;

      if (r.logId == null) {
        next.extraRows.push({ id: r.key, date: dateIso, checkOutAt: timeIso, weight });
      } else {
        next.rows[r.logId] = { date: dateIso, checkOutAt: timeIso, weight };
      }
    }

    return next;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Thông tin trên phiếu ── */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-gray-500">
          Thông tin trên phiếu
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            ["contractCode",  "Mã hợp đồng"],
            ["clientName",    "Họ tên hội viên"],
            ["ptName",        "Chữ ký HLV (tên)"],
            ["fmName",        "Đại diện trung tâm"],
          ] as const).map(([field, label]) => (
            <div key={field}>
              <label className={LABEL}>{label}</label>
              <div className="flex items-center gap-1.5">
                <input
                  className={INPUT}
                  value={header[field]}
                  onChange={(e) => setHeader((h) => ({ ...h, [field]: e.target.value }))}
                />
                <ResetBtn onClick={() => resetHeaderField(field)} />
              </div>
            </div>
          ))}
          <div>
            <label className={LABEL}>Tổng số buổi tập</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={0} className={INPUT}
                value={header.totalSessions}
                onChange={(e) => setHeader((h) => ({ ...h, totalSessions: e.target.value }))}
              />
              <ResetBtn onClick={() => resetHeaderField("totalSessions")} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Giá trị gói tập (đ)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={0} className={INPUT}
                value={header.price}
                onChange={(e) => setHeader((h) => ({ ...h, price: e.target.value }))}
              />
              <ResetBtn onClick={() => resetHeaderField("price")} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              In ra: {fmtVnd(Math.max(0, Math.round(Number(header.price)) || 0))} đ
            </p>
          </div>
          <div>
            <label className={LABEL}>Hợp đồng từ ngày</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date" className={INPUT}
                value={header.startDate ? sheetDay(header.startDate) : ""}
                onChange={(e) => setHeader((h) => ({ ...h, startDate: e.target.value }))}
              />
              <ResetBtn onClick={() => resetHeaderField("startDate")} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Đến ngày</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date" className={INPUT}
                value={header.endDate ? sheetDay(header.endDate) : ""}
                onChange={(e) => setHeader((h) => ({ ...h, endDate: e.target.value }))}
              />
              <ResetBtn onClick={() => resetHeaderField("endDate")} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          Sửa ở đây chỉ đổi chữ in trên tờ phiếu. Số buổi và thời hạn thật của lộ trình nằm ở
          hồ sơ khách, không đổi theo.
        </p>
      </div>

      {/* ── Các buổi tập ── */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
              Các buổi trên phiếu
            </p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {draft.length}/{SHEET_TOTAL_ROWS} dòng
              {manualCount > 0 && ` · ${manualCount} buổi ghi tay`}
            </p>
          </div>
          <button
            onClick={addRow}
            disabled={full}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-600 transition-colors hover:border-[#f15b5c] hover:text-[#f15b5c] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm buổi ghi tay
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                <th className="w-10 px-1 py-2 text-left">STT</th>
                <th className="px-1 py-2 text-left">Ngày</th>
                <th className="w-24 px-1 py-2 text-left">Giờ</th>
                <th className="w-28 px-1 py-2 text-left">Cân (kg)</th>
                <th className="w-24 px-1 py-2 text-center">Ký · Ảnh</th>
                <th className="w-10 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {ordered.map((r, idx) => (
                <tr key={r.key} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-1 py-1.5 font-bold text-gray-400">{idx + 1}</td>
                  <td className="px-1 py-1.5">
                    <input
                      type="date" className={INPUT}
                      value={r.day}
                      onChange={(e) => patchRow(r.key, { day: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      type="time" className={INPUT}
                      value={r.time}
                      onChange={(e) => patchRow(r.key, { time: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      type="number" step="0.1" min={20} max={300} className={INPUT}
                      placeholder={r.autoWeight != null ? String(r.autoWeight) : "—"}
                      value={r.weight}
                      onChange={(e) => patchRow(r.key, { weight: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    {r.logId == null ? (
                      <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-600">
                        ghi tay
                      </span>
                    ) : (
                      <span
                        className="flex items-center justify-center gap-1 text-[10px] font-bold text-gray-400"
                        title="Chữ ký và ảnh check-out không sửa được"
                      >
                        <Lock className="h-3 w-3" />
                        {r.hasSignature ? "ký" : "—"} · {r.hasPhoto ? "ảnh" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    {r.logId == null && (
                      <button
                        onClick={() => removeRow(r.key)}
                        className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label="Xoá buổi ghi tay"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {draft.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs font-semibold text-gray-400">
                    Lộ trình này chưa có buổi nào. Bấm “Thêm buổi ghi tay” để điền bù buổi cũ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
          Buổi ghi tay không có chữ ký và ảnh — in ra là ô trống, nhìn phân biệt được với buổi
          app ghi. Buổi ghi tay KHÔNG tính vào “Số buổi PT” của bảng lương; muốn sửa số buổi
          tính lương thì sửa ở hồ sơ khách. Ô cân để trống = dùng số cân gần nhất trước buổi.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSave(buildOverride())}
          disabled={saving}
          className={cn(
            "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40 sm:flex-none"
          )}
          style={{ backgroundColor: "#f15b5c" }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Lưu phiếu
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="h-11 shrink-0 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

function ResetBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
      title="Về số gốc của lộ trình"
      aria-label="Về số gốc của lộ trình"
    >
      <RotateCcw className="h-3.5 w-3.5" />
    </button>
  );
}
