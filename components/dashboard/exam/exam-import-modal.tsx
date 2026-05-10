"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, X, CheckCircle, FileSpreadsheet, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = "idle" | "loading" | "preview" | "importing" | "done";
type RowStatus = "valid" | "error" | "duplicate";
type ImportResult = { imported: number; skipped: number };

type ParsedRow = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  status: RowStatus;
  errorMsg?: string;
};

export function ExamImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
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

  async function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

        console.log("Raw rows:", raw);

        const parsed = raw
          .slice(1)
          .filter((row) => (row as unknown[]).some((cell) => cell !== undefined && cell !== ""))
          .map((row) => ({
            question: String((row as unknown[])[0] ?? "").trim(),
            optionA: String((row as unknown[])[1] ?? "").trim(),
            optionB: String((row as unknown[])[2] ?? "").trim(),
            optionC: String((row as unknown[])[3] ?? "").trim(),
            optionD: String((row as unknown[])[4] ?? "").trim(),
            correctAnswer: String((row as unknown[])[5] ?? "").trim().toUpperCase(),
          }));

        console.log("Parsed questions:", parsed);

        if (parsed.length === 0) {
          alert("Không tìm thấy câu hỏi nào trong file.");
          return;
        }

        setStep("loading");

        const validated: ParsedRow[] = parsed.map((row) => {
          if (!row.question) return { ...row, status: "error", errorMsg: "Thiếu câu hỏi" };
          if (!row.optionA || !row.optionB || !row.optionC || !row.optionD)
            return { ...row, status: "error", errorMsg: "Thiếu đáp án" };
          if (!["A", "B", "C", "D"].includes(row.correctAnswer))
            return { ...row, status: "error", errorMsg: "Đáp án đúng phải là A, B, C hoặc D" };
          return { ...row, status: "valid" };
        });

        const validTexts = validated.filter((r) => r.status === "valid").map((r) => r.question);
        if (validTexts.length > 0) {
          const res = await fetch("/api/exam/import/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texts: validTexts }),
          });
          if (res.ok) {
            const { duplicates } = (await res.json()) as { duplicates: string[] };
            const dupSet = new Set(duplicates.map((d) => d.toLowerCase()));
            setRows(
              validated.map((row): ParsedRow =>
                row.status === "valid" && dupSet.has(row.question.toLowerCase())
                  ? { ...row, status: "duplicate", errorMsg: "Trùng lặp - bỏ qua" }
                  : row
              )
            );
          } else {
            setRows(validated);
          }
        } else {
          setRows(validated);
        }

        setStep("preview");
      } catch {
        alert("Không thể đọc file. Vui lòng dùng file .xlsx hoặc .xls.");
        setStep("idle");
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
    const validRows = rows.filter((r) => r.status === "valid");
    if (validRows.length === 0) return;
    setStep("importing");
    try {
      const res = await fetch("/api/exam/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: validRows.map(({ question, optionA, optionB, optionC, optionD, correctAnswer }) => ({
            question,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
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

  const validCount = rows.filter((r) => r.status === "valid").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const dupCount = rows.filter((r) => r.status === "duplicate").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[820px] mx-4 flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-extrabold text-gray-900">Nhập câu hỏi từ Excel</h2>
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
                  File mẫu gồm 6 cột:{" "}
                  <strong>Câu hỏi, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng</strong>.
                  Cột Đáp án đúng nhập A, B, C hoặc D.
                </p>
                <a
                  href="/api/exam/template"
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

          {/* LOADING */}
          {step === "loading" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="w-8 h-8 border-2 border-[#f15b5c] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Đang kiểm tra câu hỏi...</p>
            </div>
          )}

          {/* PREVIEW / IMPORTING */}
          {(step === "preview" || step === "importing") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-emerald-600">{validCount} hợp lệ</span>
                  {errorCount > 0 && <span className="text-red-500">{errorCount} lỗi</span>}
                  {dupCount > 0 && <span className="text-amber-600">{dupCount} trùng lặp</span>}
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
                <div className="overflow-auto max-h-[380px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 w-8">#</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 min-w-[160px]">Câu hỏi</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 min-w-[90px]">A</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 min-w-[90px]">B</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 min-w-[90px]">C</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 min-w-[90px]">D</th>
                        <th className="px-3 py-2.5 text-center font-bold text-gray-400 w-20">Đáp án đúng</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 min-w-[130px]">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-t border-gray-50 ${
                            row.status === "error"
                              ? "bg-red-50/40"
                              : row.status === "duplicate"
                              ? "bg-amber-50/40"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-800 font-medium max-w-[180px]">
                            <div className="line-clamp-2">
                              {row.question || <span className="text-red-400 italic">Trống</span>}
                            </div>
                          </td>
                          {(["optionA", "optionB", "optionC", "optionD"] as const).map((key) => (
                            <td key={key} className="px-3 py-2 text-gray-600 max-w-[110px]">
                              <div className="truncate">
                                {row[key] || <span className="text-red-400 italic">Trống</span>}
                              </div>
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`font-bold ${
                                ["A", "B", "C", "D"].includes(row.correctAnswer)
                                  ? "text-emerald-600"
                                  : "text-red-400"
                              }`}
                            >
                              {row.correctAnswer || "–"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {row.status === "valid" && (
                              <span className="text-emerald-600 font-semibold">Hợp lệ</span>
                            )}
                            {row.status === "error" && (
                              <span className="flex items-center gap-1 text-red-500 font-semibold">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                {row.errorMsg}
                              </span>
                            )}
                            {row.status === "duplicate" && (
                              <span className="text-amber-600 font-semibold">Trùng lặp - bỏ qua</span>
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
                  Đã thêm{" "}
                  <strong className="text-[#f15b5c]">{result.imported}</strong> câu hỏi
                  {result.skipped > 0 && (
                    <>
                      , bỏ qua{" "}
                      <strong className="text-gray-700">{result.skipped}</strong> trùng lặp
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex items-center justify-end gap-3">
          {(step === "idle" || step === "loading" || step === "done") && (
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
                Nhập {validCount} câu hỏi
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
