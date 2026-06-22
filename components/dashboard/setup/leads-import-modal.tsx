"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, X, CheckCircle, FileSpreadsheet, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatus, LEAD_STATUS_LABEL, PTUser } from "./types";

type Step = "idle" | "preview" | "importing" | "done";
type RowStatus = "valid" | "error";
type ImportResult = { imported: number; skipped: number; errors: { row: number; message: string }[] };

type ParsedRow = {
  customerName: string;
  month: number | null;
  year: number | null;
  ptName: string;           // raw name typed in the sheet
  assignedPTId: string;     // resolved
  yearOfBirth: number | null;
  phone: string;
  source: string;
  referralSource: string;
  forecast: string;
  status: LeadStatus;
  packageRegistered: string;
  actualRevenue: number | null;
  remainingPayment: number | null;
  fitpartnerRevenue: number | null;
  signDate: string;         // ISO yyyy-mm-dd or ""
  notes: string;
  remark: string;
  rowStatus: RowStatus;
  errorMsg?: string;
};

// Map both Vietnamese labels and raw codes → status code.
const STATUS_MAP: Record<string, LeadStatus> = {
  "dang cham": "TAKECARE", "takecare": "TAKECARE",
  "khong dang ky": "FAIL", "fail": "FAIL",
  "dat coc": "DE", "de": "DE",
  "da thanh toan": "PIF", "pif": "PIF",
  "thanh toan not": "PB", "pb": "PB",
};

function normalize(s: string): string {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

function cellStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

// Date cell → ISO yyyy-mm-dd (accepts Date object, Excel serial number, dd/mm/yyyy, yyyy-mm-dd).
function parseDateCell(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? "" : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF?.parse_date_code(v);
    if (d && d.y) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    return "";
  }
  const s = String(v).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${pad(parseInt(m[2]))}-${pad(parseInt(m[1]))}`;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad(parseInt(m[2]))}-${pad(parseInt(m[3]))}`;
  return "";
}

export function LeadsImportModal({
  open,
  onClose,
  onImported,
  branchId,
  isPT,
  currentUserId,
  currentUserName,
  ptList,
  defaultMonth,
  defaultYear,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  branchId: string;
  isPT: boolean;
  currentUserId: string;
  currentUserName: string;
  ptList: PTUser[];
  defaultMonth: number;
  defaultYear: number;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function close() {
    if (step === "importing") return;
    setStep("idle");
    setRows([]);
    setResult(null);
    setDragOver(false);
    onClose();
  }

  function resolvePT(name: string): string {
    if (isPT) return currentUserId;
    const n = normalize(name);
    if (!n) return "";
    const hit = ptList.find(
      (p) => normalize(p.name ?? "") === n || normalize(p.email) === n
    );
    return hit?.id ?? "";
  }

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];

        const parsed: ParsedRow[] = raw
          .slice(1)
          .filter((row) => (row as unknown[]).some((c) => c !== undefined && c !== null && c !== ""))
          .map((row): ParsedRow => {
            const r = row as unknown[];
            const customerName = cellStr(r[0]);
            const month = cellNum(r[1]) ?? defaultMonth;
            const year = cellNum(r[2]) ?? defaultYear;
            const ptName = cellStr(r[3]);
            const assignedPTId = resolvePT(ptName);
            const statusRaw = cellStr(r[9]);
            const status = STATUS_MAP[normalize(statusRaw)] ?? "TAKECARE";

            const base: ParsedRow = {
              customerName,
              month: month ? Math.round(month) : null,
              year: year ? Math.round(year) : null,
              ptName,
              assignedPTId,
              yearOfBirth: cellNum(r[4]) ? Math.round(cellNum(r[4])!) : null,
              phone: cellStr(r[5]),
              source: cellStr(r[6]),
              referralSource: cellStr(r[7]),
              forecast: cellStr(r[8]),
              status,
              packageRegistered: cellStr(r[10]),
              actualRevenue: cellNum(r[11]),
              remainingPayment: cellNum(r[12]),
              fitpartnerRevenue: cellNum(r[13]),
              signDate: parseDateCell(r[14]),
              notes: cellStr(r[15]),
              remark: cellStr(r[16]),
              rowStatus: "valid",
            };

            // Validation
            if (!base.customerName) return { ...base, rowStatus: "error", errorMsg: "Thiếu tên khách hàng" };
            if (!base.month || base.month < 1 || base.month > 12) return { ...base, rowStatus: "error", errorMsg: "Tháng không hợp lệ (1-12)" };
            if (!base.year) return { ...base, rowStatus: "error", errorMsg: "Thiếu năm" };
            if (!isPT && !base.assignedPTId) {
              return { ...base, rowStatus: "error", errorMsg: ptName ? `Không tìm thấy NS \"${ptName}\"` : "Thiếu nhân sự phụ trách" };
            }
            return base;
          });

        if (parsed.length === 0) {
          alert("Không tìm thấy dòng dữ liệu nào trong file.");
          return;
        }
        setRows(parsed);
        setStep("preview");
      } catch {
        alert("Không thể đọc file. Vui lòng dùng file .xlsx hoặc .xls.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.rowStatus === "valid");
    if (valid.length === 0) return;
    setStep("importing");
    try {
      const res = await fetch("/api/setup/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          leads: valid.map((r) => ({
            customerName: r.customerName,
            month: r.month,
            year: r.year,
            assignedPTId: r.assignedPTId,
            yearOfBirth: r.yearOfBirth,
            phone: r.phone,
            source: r.source,
            referralSource: r.referralSource,
            forecast: r.forecast,
            status: r.status,
            packageRegistered: r.packageRegistered,
            actualRevenue: r.actualRevenue,
            remainingPayment: r.remainingPayment,
            fitpartnerRevenue: r.fitpartnerRevenue,
            signDate: r.signDate || null,
            notes: r.notes,
            remark: r.remark,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi server");
      setResult(data);
      setStep("done");
      onImported();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi khi nhập");
      setStep("preview");
    }
  }

  if (!open) return null;

  const validCount = rows.filter((r) => r.rowStatus === "valid").length;
  const errorCount = rows.filter((r) => r.rowStatus === "error").length;
  const templateUrl = `/api/setup/leads/template?branchId=${encodeURIComponent(branchId)}&month=${defaultMonth}&year=${defaultYear}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[880px] mx-4 flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-extrabold text-gray-900">Tải lên Setup từ Excel</h2>
          <button onClick={close} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* IDLE */}
          {step === "idle" && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">Tải file mẫu</p>
                <p className="text-xs text-amber-700 mb-3">
                  Bắt buộc: <strong>Khách hàng, Tháng, Năm</strong>. Cột <strong>Tháng / Năm</strong> quyết
                  định lead được lọc theo tháng / quý. Xem sheet <strong>Hướng dẫn</strong> trong file để biết
                  giá trị Tình trạng và tên Nhân sự hợp lệ.
                </p>
                <a
                  href={templateUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-white text-sm font-semibold text-amber-800 hover:bg-amber-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Tải file mẫu (.xlsx)
                </a>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Tải lên file đã điền</p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                    dragOver
                      ? "border-[#f15b5c] bg-[#f15b5c]/5"
                      : "border-gray-200 hover:border-[#f15b5c]/50 hover:bg-gray-50/50"
                  }`}
                >
                  <FileSpreadsheet className="w-10 h-10 text-gray-300" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500">Kéo thả file vào đây</p>
                    <p className="text-xs text-gray-400 mt-0.5">hoặc nhấn để chọn file .xlsx / .xls</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
                />
              </div>
            </div>
          )}

          {/* PREVIEW / IMPORTING */}
          {(step === "preview" || step === "importing") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-emerald-600">{validCount} hợp lệ</span>
                  {errorCount > 0 && <span className="text-red-500">{errorCount} lỗi (sẽ bỏ qua)</span>}
                </div>
                <button
                  onClick={() => { setStep("idle"); setRows([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  disabled={step === "importing"}
                  className="text-xs text-gray-400 hover:text-[#f15b5c] underline underline-offset-2 disabled:opacity-40"
                >
                  Đổi file
                </button>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[420px]">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-100">
                        {["#", "Khách hàng", "Tháng", "Năm", "Nhân sự", "Nguồn", "Tình trạng", "DT (tr)", "Trạng thái"].map((h, i) => (
                          <th key={i} className="px-3 py-2.5 text-left font-bold text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={`border-t border-gray-50 ${row.rowStatus === "error" ? "bg-red-50/40" : ""}`}>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-800 font-medium">
                            {row.customerName || <span className="text-red-400 italic">Trống</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{row.month ?? "–"}</td>
                          <td className="px-3 py-2 text-gray-600">{row.year ?? "–"}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {isPT ? currentUserName : (
                              row.assignedPTId
                                ? (ptList.find((p) => p.id === row.assignedPTId)?.name ?? row.ptName)
                                : <span className="text-red-400 italic">{row.ptName || "Trống"}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{row.source || "–"}</td>
                          <td className="px-3 py-2 text-gray-600">{LEAD_STATUS_LABEL[row.status]}</td>
                          <td className="px-3 py-2 text-emerald-600 font-medium">{row.actualRevenue ?? "–"}</td>
                          <td className="px-3 py-2">
                            {row.rowStatus === "valid" ? (
                              <span className="text-emerald-600 font-semibold">Hợp lệ</span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500 font-semibold">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                {row.errorMsg}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DONE */}
          {step === "done" && result && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-gray-900">Nhập thành công!</p>
                <p className="text-sm text-gray-500 mt-1">
                  Đã thêm <strong className="text-[#f15b5c]">{result.imported}</strong> lead
                  {result.skipped > 0 && (
                    <>, bỏ qua <strong className="text-gray-700">{result.skipped}</strong> dòng lỗi</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex items-center justify-end gap-3">
          {(step === "idle" || step === "done") && (
            <Button variant="outline" onClick={close} className="h-10 rounded-xl px-5">
              Đóng
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={close} className="h-10 rounded-xl px-5">
                Hủy
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0}
                className="h-10 rounded-xl text-white font-semibold gap-2 disabled:opacity-40"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Upload className="w-4 h-4" />
                Nhập {validCount} lead
              </Button>
            </>
          )}

          {step === "importing" && (
            <Button
              disabled
              className="h-10 rounded-xl text-white font-semibold opacity-70"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Đang nhập...
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
