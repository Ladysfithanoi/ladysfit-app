"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, X, CheckCircle, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Step = "idle" | "preview" | "importing" | "done";
type ImportResult = { imported: number; skipped: number };

export function ExerciseImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [names, setNames] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function close() {
    if (step === "importing") return;
    setStep("idle");
    setNames([]);
    setResult(null);
    setDragOver(false);
    onClose();
  }

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

        console.log("Raw rows:", raw);

        const parsed = raw
          .slice(1)
          .map((row) => String((row as unknown[])[0] ?? "").trim())
          .filter((name) => name !== "");

        console.log("Parsed names:", parsed);

        setNames(parsed);
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
    if (names.length === 0) return;
    setStep("importing");
    try {
      const res = await fetch("/api/exercises/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-extrabold text-gray-900">Thêm bài tập từ Excel</h2>
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
                  File mẫu có 1 cột <strong>Tên bài tập</strong> với 3 ví dụ.
                </p>
                <a
                  href="/api/exercises/template"
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
                <span className="text-sm font-semibold text-gray-700">
                  {names.length} bài tập được tìm thấy
                </span>
                <button
                  onClick={() => { setStep("idle"); setNames([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  disabled={step === "importing"}
                  className="text-xs text-gray-400 hover:text-[#f15b5c] underline underline-offset-2 disabled:opacity-40"
                >
                  Đổi file
                </button>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[320px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left font-bold text-gray-400 w-10">#</th>
                        <th className="px-4 py-2.5 text-left font-bold text-gray-400">Tên bài tập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {names.map((name, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-4 py-2 text-gray-800 font-medium">{name}</td>
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
                  <strong className="text-[#f15b5c]">{result.imported}</strong> bài tập
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
                disabled={names.length === 0}
                className="h-10 rounded-xl text-white font-semibold gap-2 disabled:opacity-40"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Upload className="w-4 h-4" />
                Nhập {names.length} bài tập
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
