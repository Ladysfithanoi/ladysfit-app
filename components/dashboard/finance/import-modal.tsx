"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { X, Download, Upload, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportRow = {
  transactionDate: string | null;
  category:        string;
  amount:          number | null;
  description:     string;
  rawDate:         string;
  rawAmount:       string;
  customer:        string;
  packageName:     string;
  pt:              string;
  contractCode:    string;
  errors:          string[];
  valid:           boolean;
  isDuplicate:     boolean;
};

type Props = {
  type:       "income" | "expense";
  branchId:   string;
  onClose:    () => void;
  onImported: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns YYYY-MM-DD string to avoid timezone offset when converting to ISO
function parseVNDate(val: string): string | null {
  const s = val.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    // Calendar validation only — local Date is fine here
    const check = new Date(year, month - 1, day);
    if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // Fallback: try ISO-style string, extract date part directly
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  return null;
}

function parseAmount(val: string): number | null {
  if (!val.trim()) return null;
  const n = parseFloat(val.replace(/[,.]/g, ""));
  return isNaN(n) || n <= 0 ? null : n;
}

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

function col(cells: string[], i: number) { return (cells[i] ?? "").toString().trim(); }

function parseRow(type: "income" | "expense", cells: string[]): ImportRow {
  const errors: string[] = [];

  if (type === "income") {
    const rawDate      = col(cells, 0);
    const category     = col(cells, 1) || "Thu khác";
    const customer     = col(cells, 2);
    const packageName  = col(cells, 3);
    const pt           = col(cells, 4);
    const contractCode = col(cells, 5);
    const rawAmount    = col(cells, 6);
    const mota         = col(cells, 7);

    let transactionDate: string | null = null;
    if (!rawDate) errors.push("Thiếu ngày");
    else {
      const parsed = parseVNDate(rawDate);
      if (!parsed) errors.push("Ngày không hợp lệ");
      else transactionDate = parsed;
    }

    let amount: number | null = null;
    if (!rawAmount) errors.push("Thiếu số tiền");
    else {
      amount = parseAmount(rawAmount);
      if (amount === null) errors.push("Số tiền không hợp lệ");
    }

    const parts = [
      customer,
      packageName,
      pt           ? `PT: ${pt}`   : "",
      contractCode ? `HĐ: ${contractCode}` : "",
    ].filter(Boolean);
    const description = parts.length > 0 ? parts.join(" | ") : mota;

    return {
      transactionDate, category, amount, description,
      rawDate, rawAmount, customer, packageName, pt, contractCode,
      errors, valid: errors.length === 0, isDuplicate: false,
    };
  } else {
    const rawDate   = col(cells, 0);
    const rawAmount = col(cells, 1);
    const description = col(cells, 2);

    let transactionDate: string | null = null;
    if (!rawDate) errors.push("Thiếu ngày");
    else {
      const parsed = parseVNDate(rawDate);
      if (!parsed) errors.push("Ngày không hợp lệ");
      else transactionDate = parsed;
    }

    let amount: number | null = null;
    if (!rawAmount) errors.push("Thiếu số tiền");
    else {
      amount = parseAmount(rawAmount);
      if (amount === null) errors.push("Số tiền không hợp lệ");
    }

    return {
      transactionDate, category: "Chi phí", amount, description,
      rawDate, rawAmount, customer: "", packageName: "", pt: "", contractCode: "",
      errors, valid: errors.length === 0, isDuplicate: false,
    };
  }
}

function downloadTemplate(type: "income" | "expense") {
  const wb = XLSX.utils.book_new();
  if (type === "income") {
    const data = [
      ["Ngày GD", "Danh mục", "Khách hàng", "Gói tập", "PT", "Mã HĐ", "Số tiền (VND)", "Mô tả"],
      ["08/05/2026", "Hợp đồng KH", "Nguyễn Văn A", "Gói 3 tháng", "Trần PT", "HD-001", "5000000", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [14, 16, 20, 18, 14, 12, 16, 30].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Bảng Thu");
  } else {
    const data = [
      ["Ngày GD", "Số tiền (VND)", "Mô tả"],
      ["08/05/2026", "1000000", "Tiền thuê mặt bằng"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [14, 16, 40].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Bảng Chi");
  }
  const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = type === "income" ? "mau-bang-thu.xlsx" : "mau-bang-chi.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

async function parseFile(file: File, type: "income" | "expense"): Promise<ImportRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const wb    = XLSX.read(new Uint8Array(arrayBuffer), { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const all   = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1, raw: false, dateNF: "dd/mm/yyyy",
  }) as string[][];

  return all
    .slice(1)
    .filter(r => r.some(c => c?.toString().trim()))
    .map(r => parseRow(type, r));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportModal({ type, branchId, onClose, onImported }: Props) {
  const [step, setStep]               = useState<"upload" | "preview" | "done">("upload");
  const [file, setFile]               = useState<File | null>(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [isParsing, setIsParsing]     = useState(false);
  const [rows, setRows]               = useState<ImportRow[]>([]);
  const [forceDuplicates, setForceDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult]           = useState<{ imported: number; skipped: number } | null>(null);
  const [parseError, setParseError]   = useState("");
  const fileRef                       = useRef<HTMLInputElement>(null);

  const validRows      = rows.filter(r => r.valid);
  const errorRows      = rows.filter(r => !r.valid);
  const duplicateRows  = rows.filter(r => r.valid && r.isDuplicate);
  const importableCount = forceDuplicates
    ? validRows.length
    : validRows.filter(r => !r.isDuplicate).length;

  function acceptFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setParseError("Chỉ chấp nhận file .xlsx hoặc .xls");
      return;
    }
    setFile(f);
    setParseError("");
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
    e.target.value = "";
  }

  async function handlePreview() {
    if (!file) return;
    setIsParsing(true);
    setParseError("");
    try {
      const parsed = await parseFile(file, type);
      if (parsed.length === 0) { setParseError("File không có dữ liệu"); return; }

      // Duplicate check for valid rows
      const validForCheck = parsed.filter(r => r.valid);
      if (validForCheck.length > 0) {
        const res = await fetch("/api/finance/import", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            type, branchId, dryRun: true,
            transactions: validForCheck.map(r => ({
              transactionDate: r.transactionDate,
              category:        r.category,
              amount:          r.amount,
              description:     r.description || undefined,
            })),
          }),
        });
        if (res.ok) {
          const { duplicateIndices } = await res.json() as { duplicateIndices: number[] };
          const dupSet = new Set(duplicateIndices);
          let vi = 0;
          for (const row of parsed) {
            if (row.valid) { row.isDuplicate = dupSet.has(vi); vi++; }
          }
        }
      }

      setRows(parsed);
      setStep("preview");
    } catch (err) {
      setParseError("Không thể đọc file. Kiểm tra lại định dạng.");
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImport() {
    setIsImporting(true);
    try {
      const res = await fetch("/api/finance/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          type, branchId, dryRun: false, forceDuplicates,
          transactions: validRows.map(r => ({
            transactionDate: r.transactionDate,
            category:        r.category,
            amount:          r.amount,
            description:     r.description || undefined,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json() as { imported: number; skipped: number };
        setResult(data);
        setStep("done");
        onImported();
      }
    } finally {
      setIsImporting(false);
    }
  }

  const label = type === "income" ? "khoản thu" : "khoản chi";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-[800px] bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div
          className="px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <p className="text-base font-extrabold text-white">Nhập dữ liệu từ Excel</p>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Upload ─────────────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="p-6 space-y-5">
              {/* Step 1 */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-gray-700">Bước 1 — Tải file mẫu</p>
                <p className="text-xs text-gray-500">
                  {type === "income"
                    ? "Cột: Ngày GD · Danh mục · Khách hàng · Gói tập · PT · Mã HĐ · Số tiền (VND) · Mô tả"
                    : "Cột: Ngày GD · Số tiền (VND) · Mô tả"}
                </p>
                <button
                  onClick={() => downloadTemplate(type)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors"
                  style={{ borderColor: "#f15b5c", color: "#f15b5c" }}
                >
                  <Download className="w-4 h-4" />
                  Tải file mẫu
                </button>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-700">Bước 2 — Tải file lên</p>
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                    isDragging
                      ? "border-[#f15b5c] bg-red-50"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <Upload className="w-7 h-7 text-gray-300" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500">
                      {file ? file.name : "Kéo thả hoặc click để chọn file"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Chấp nhận .xlsx, .xls</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={onFileChange}
                  />
                </div>
                {file && (
                  <p className="text-xs text-gray-500">
                    Đã chọn: <span className="font-semibold text-gray-700">{file.name}</span>
                    {" "}({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                {parseError && <p className="text-xs text-red-500 font-semibold">{parseError}</p>}
              </div>
            </div>
          )}

          {/* ── Preview ────────────────────────────────────────────────── */}
          {step === "preview" && (
            <div className="p-6 space-y-4">
              {/* Summary badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {validRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> {validRows.length} hợp lệ
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" /> {errorRows.length} lỗi
                  </span>
                )}
                {duplicateRows.length > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-xs font-bold">
                    ⚠ {duplicateRows.length} trùng lặp
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-auto max-h-80">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#f5f5f5] border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 w-8">#</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 whitespace-nowrap">Ngày</th>
                        {type === "income" && <>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 whitespace-nowrap">Danh mục</th>
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 whitespace-nowrap">Khách hàng</th>
                        </>}
                        {type === "expense" && (
                          <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 whitespace-nowrap">Mô tả</th>
                        )}
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 whitespace-nowrap">Số tiền</th>
                        <th className="px-3 py-2 text-left text-[11px] font-bold text-gray-400 whitespace-nowrap">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-gray-50 ${
                            !row.valid
                              ? "bg-red-50/60"
                              : row.isDuplicate
                              ? "bg-amber-50/40"
                              : "bg-white"
                          }`}
                        >
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.rawDate || "—"}</td>
                          {type === "income" && <>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.category}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{row.customer || "—"}</td>
                          </>}
                          {type === "expense" && (
                            <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate">{row.description || "—"}</td>
                          )}
                          <td className="px-3 py-2 font-semibold whitespace-nowrap">
                            {row.amount !== null ? vnd(row.amount) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {!row.valid ? (
                              <span className="text-red-500 font-semibold text-[10px]">⚠ {row.errors.join(", ")}</span>
                            ) : row.isDuplicate ? (
                              <span className="text-amber-600 font-semibold text-[10px]">⚠ Trùng lặp</span>
                            ) : (
                              <span className="text-emerald-600 font-semibold text-[10px]">✓ Hợp lệ</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Force duplicates */}
              {duplicateRows.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={forceDuplicates}
                    onChange={e => setForceDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#f15b5c]"
                  />
                  <span className="text-sm text-gray-600">Nhập kể cả các hàng trùng lặp</span>
                </label>
              )}
            </div>
          )}

          {/* ── Done ───────────────────────────────────────────────────── */}
          {step === "done" && result && (
            <div className="p-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold text-gray-800">
                  Đã nhập {result.imported} {label} thành công
                </p>
                {result.skipped > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Bỏ qua {result.skipped} hàng (trùng lặp)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {step === "upload" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handlePreview}
                disabled={!file || isParsing}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {isParsing && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isParsing ? "Đang xử lý..." : "Xem trước"}
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={() => { setStep("upload"); setRows([]); setForceDuplicates(false); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                ← Quay lại
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || importableCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {isImporting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isImporting ? "Đang nhập..." : `Nhập dữ liệu (${importableCount} hàng)`}
              </button>
            </>
          )}

          {step === "done" && (
            <button
              onClick={onClose}
              className="ml-auto px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-colors"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
