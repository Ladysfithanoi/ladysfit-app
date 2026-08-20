"use client";

import { useState, useEffect } from "react";
import { NutritionDesigner, type MealPlanRow } from "@/components/dashboard/nutrition-designer";
import type { ConsultationData } from "@/components/consultation/consultation-wizard";

export function Step4Diet({
  consultation,
  onNext,
  onPrev,
  isReadOnly,
  userRole,
}: {
  consultation: ConsultationData;
  onNext: (p: Record<string, unknown>) => Promise<void>;
  onPrev: () => void;
  isReadOnly: boolean;
  userRole?: string;
}) {
  const [existingPlan, setExistingPlan] = useState<MealPlanRow | null | undefined>(undefined);
  const [savedPlan, setSavedPlan] = useState<MealPlanRow | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const info = consultation.info as Record<string, unknown> | null;
  const wd = consultation.workoutDesign as Record<string, unknown> | null;

  const weight = Number(info?.currentWeight ?? 60);
  const height = Number(info?.height ?? 160);
  const phase = String(wd?.phase ?? "Giai đoạn 1");
  const likes = String(info?.foodPreferences ?? "");
  const dislikes = String(info?.foodAllergies ?? "");

  // Fetch existing plan for this consultation
  useEffect(() => {
    fetch(`/api/consultation/${consultation.id}/meal-plan`)
      .then((r) => r.json())
      .then((data) => setExistingPlan(data ?? null))
      .catch(() => setExistingPlan(null));
  }, [consultation.id]);

  async function handleSaved(plan: MealPlanRow) {
    setSavedPlan(plan);
    setAdvancing(true);
    await onNext({ nutritionSaved: true });
    setAdvancing(false);
  }

  async function handleSkip() {
    setAdvancing(true);
    await onNext({});
    setAdvancing(false);
  }

  // Show plan read-only if consultation is completed
  const displayPlan = savedPlan ?? existingPlan ?? null;

  return (
    <div className="divide-y divide-gray-50">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-xl bg-green-50">
            <span className="text-lg">🥗</span>
          </div>
          <div>
            <p className="text-base font-extrabold text-gray-800">Thiết kế chế độ ăn</p>
            <p className="text-xs text-gray-400 mt-0.5">Tính toán TDEE/DER và tạo thực đơn bằng AI</p>
          </div>
        </div>

        {existingPlan === undefined ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#f15b5c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <NutritionDesigner
            consultationId={consultation.id}
            initialWeight={weight}
            initialHeight={height}
            initialPhase={phase}
            initialLikes={likes}
            initialDislikes={dislikes}
            existingPlan={isReadOnly ? displayPlan : (existingPlan ?? null)}
            onSaved={handleSaved}
            onSkip={handleSkip}
            isReadOnly={isReadOnly}
            canEditCalories={["ADMIN", "FM"].includes(userRole ?? "")}
            saveLabel={advancing ? "Đang lưu..." : "Lưu & Tiếp tục →"}
          />
        )}
      </div>

      {/* Back button only — forward actions are inside NutritionDesigner */}
      <div className="p-5 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
        <button
          onClick={onPrev}
          className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 w-full sm:w-auto"
        >
          ← Quay lại
        </button>
        {isReadOnly && (
          <button
            onClick={handleSkip}
            className="py-3 px-5 rounded-xl text-white text-sm font-bold w-full sm:w-auto"
            style={{ backgroundColor: "#f15b5c" }}
          >
            Tiếp tục →
          </button>
        )}
      </div>
    </div>
  );
}
