"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ConsultationData } from "../consultation-wizard";

const inputCls = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white";

function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Thiếu cân", color: "text-blue-500" };
  if (bmi < 25)   return { label: "Bình thường", color: "text-green-600" };
  if (bmi < 30)   return { label: "Thừa cân", color: "text-orange-500" };
  if (bmi < 35)   return { label: "Béo phì độ 1", color: "text-red-500" };
  if (bmi < 40)   return { label: "Béo phì độ 2", color: "text-red-600" };
  return           { label: "Béo phì độ 3", color: "text-red-700" };
}

function getWHRInfo(whr: number): { label: string; color: string } {
  if (whr < 0.80)  return { label: "An toàn", color: "text-green-600" };
  if (whr <= 0.85) return { label: "Nguy cơ", color: "text-orange-500" };
  return            { label: "Nguy hiểm", color: "text-red-500" };
}

export function Step2Assessment({
  consultation, isReadOnly, onDraft, onNext, onPrev, canSaveAndContinue,
}: {
  consultation: ConsultationData;
  isReadOnly: boolean;
  onDraft: (p: Record<string, unknown>) => Promise<void>;
  onNext: (p: Record<string, unknown>) => Promise<void>;
  onPrev: () => void;
  canSaveAndContinue: boolean;
}) {
  const info = consultation.info as Record<string, unknown> | null;
  const assess = consultation.assessment as Record<string, unknown> | null;

  const height = info?.height ? Number(info.height) : 0;
  const weight = info?.currentWeight ? Number(info.currentWeight) : 0;

  const [waist, setWaist] = useState(assess?.waist ? String(assess.waist) : "");
  const [hip, setHip] = useState(assess?.hip ? String(assess.hip) : "");
  const [notes, setNotes] = useState((assess?.notes as string) ?? "");
  const [submitting, setSubmitting] = useState(false);

  const bmi = height > 0 && weight > 0 ? weight / Math.pow(height / 100, 2) : null;
  const bmiInfo = bmi ? getBMICategory(bmi) : null;
  const idealLow = height > 0 ? ((height - 100) * 0.9 - 5).toFixed(1) : null;
  const idealHigh = height > 0 ? ((height - 100) * 0.9 + 5).toFixed(1) : null;
  const whr = waist && hip ? Number(waist) / Number(hip) : null;
  const whrInfo = whr ? getWHRInfo(whr) : null;

  function buildPayload() {
    return {
      assessment: {
        waist: waist ? Number(waist) : null,
        hip: hip ? Number(hip) : null,
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        bmiCategory: bmiInfo?.label ?? null,
        idealWeight: idealLow ? `${idealLow} – ${idealHigh} kg` : null,
        whr: whr ? Math.round(whr * 100) / 100 : null,
        whrCategory: whrInfo?.label ?? null,
        notes: notes || null,
      },
    };
  }

  async function handleNext() {
    setSubmitting(true);
    await onNext(buildPayload());
    setSubmitting(false);
  }

  async function handleDraft() {
    setSubmitting(true);
    await onDraft(buildPayload());
    setSubmitting(false);
  }

  return (
    <div className="divide-y divide-gray-50">
      {/* Summary card */}
      {info && (
        <div className="p-5">
          <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">Thông tin từ bước 1</p>
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            {[
              { label: "Họ tên", value: info.fullName as string },
              { label: "Chiều cao", value: height ? `${height} cm` : "—" },
              { label: "Cân nặng", value: weight ? `${weight} kg` : "—" },
              { label: "Mục tiêu", value: info.targetWeight ? `${info.targetWeight} kg` : "—" },
            ].map((r) => (
              <div key={r.label} className="bg-gray-50 rounded-xl p-3 w-full sm:flex-1">
                <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{r.label}</p>
                <p className="text-sm font-bold text-gray-800">{r.value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Measurements */}
      <div className="p-5">
        <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">Bảng thẩm định chỉ số</p>
        <div className="flex flex-col sm:flex-row gap-4 w-full mb-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-600">Số đo vòng 2 - ngang rốn (cm)</label>
            <input type="number" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} disabled={isReadOnly} placeholder="75" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-600">Số đo vòng 3 - mông (cm)</label>
            <input type="number" step="0.1" value={hip} onChange={(e) => setHip(e.target.value)} disabled={isReadOnly} placeholder="95" className={inputCls} />
          </div>
        </div>

        {/* Calculated results */}
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">BMI</span>
              {bmi && <span className={cn("text-sm font-extrabold", bmiInfo?.color)}>{bmiInfo?.label}</span>}
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{bmi ? bmi.toFixed(1) : "—"}</p>
            <p className="text-xs text-gray-400">
              &lt;18.5 Thiếu cân · 18.5–24.9 Bình thường · 25–29.9 Thừa cân · 30–34.9 Béo phì độ 1 · 35–39.9 Béo phì độ 2 · ≥40 Béo phì độ 3
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-green-50 rounded-xl p-4 w-full sm:flex-1">
              <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1">Cân nặng lý tưởng</p>
              <p className="text-lg font-extrabold text-gray-900">
                {idealLow ? `${idealLow} – ${idealHigh} kg` : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">(Chiều cao - 100) × 0.9 ± 5</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 w-full sm:flex-1">
              <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1">WHR (Eo/Hông)</p>
              <p className={cn("text-lg font-extrabold", whrInfo ? whrInfo.color : "text-gray-900")}>
                {whr ? whr.toFixed(2) : "—"}
              </p>
              {whrInfo && <p className={cn("text-xs font-semibold mt-0.5", whrInfo.color)}>{whrInfo.label}</p>}
              {!whr && <p className="text-xs text-gray-400 mt-0.5">Điền vòng 2 và vòng 3</p>}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <label className="text-xs font-bold text-gray-600">Ghi chú thêm</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isReadOnly} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white resize-none" />
        </div>
      </div>

      {/* Actions */}
      {!isReadOnly && (
        <div className="p-5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
          <button onClick={onPrev} className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 w-full sm:w-auto">← Quay lại</button>
          <button onClick={handleDraft} disabled={submitting} className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 w-full sm:w-auto">Lưu nháp</button>
          <button onClick={handleNext} disabled={submitting || !canSaveAndContinue} className="py-3 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-50 w-full sm:w-auto" style={{ backgroundColor: "#f15b5c" }}>
            {submitting ? "Đang lưu..." : "Lưu & Tiếp tục →"}
          </button>
        </div>
      )}
      {isReadOnly && (
        <div className="p-5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
          <button onClick={onPrev} className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 w-full sm:w-auto">← Quay lại</button>
        </div>
      )}
    </div>
  );
}
