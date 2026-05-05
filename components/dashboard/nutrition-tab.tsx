"use client";

import { useState } from "react";
import { Salad, Archive, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NutritionDesigner, type MealPlanRow, type MealItem } from "./nutrition-designer";

// ── MacroBadge ─────────────────────────────────────────────────────────────

function MacroBadge({ label, value, unit = "g", color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", color)}>
      {label} {Math.round(value)}{unit}
    </span>
  );
}

// ── NutritionTab ───────────────────────────────────────────────────────────

export function NutritionTab({
  clientId,
  initialPlans,
  clientWeight,
  clientHeight,
}: {
  clientId: string;
  initialPlans: MealPlanRow[];
  clientWeight: number;
  clientHeight: number;
}) {
  const [plans, setPlans] = useState<MealPlanRow[]>(initialPlans);
  const [showDesigner, setShowDesigner] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const activePlan = plans.find((p) => p.status === "ACTIVE") ?? null;

  function handleSaved(plan: MealPlanRow) {
    setPlans((prev) => [plan, ...prev.map((p) => ({ ...p, status: "ARCHIVED" as const }))]);
    setShowDesigner(false);
  }

  async function handleArchive(planId: string) {
    setArchiving(true);
    try {
      await fetch(`/api/clients/${clientId}/meal-plans/${planId}`, { method: "DELETE" });
      setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, status: "ARCHIVED" } : p));
    } finally {
      setArchiving(false);
    }
  }

  if (showDesigner) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-gray-800">Thiết kế chế độ ăn</p>
          <button
            onClick={() => setShowDesigner(false)}
            className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
          >
            Hủy
          </button>
        </div>
        <NutritionDesigner
          clientId={clientId}
          initialWeight={clientWeight}
          initialHeight={clientHeight}
          existingPlan={null}
          onSaved={handleSaved}
          saveLabel="Lưu chế độ ăn"
        />
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 py-14 flex flex-col items-center gap-4">
        <div className="p-3 rounded-2xl bg-green-50">
          <Salad className="w-8 h-8 text-green-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-extrabold text-gray-700">Chưa có chế độ ăn</p>
          <p className="text-xs text-gray-400 mt-1">Thiết kế chế độ ăn cho khách hàng</p>
        </div>
        <button
          onClick={() => setShowDesigner(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-white text-xs font-bold"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="w-3.5 h-3.5" />
          Thiết kế chế độ ăn
        </button>
      </div>
    );
  }

  const day = activePlan.days[0] ?? null;
  const meals: MealItem[] = day?.meals ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-gray-800">Chế độ ăn hiện tại</h2>
          <p className="text-xs text-gray-400 mt-0.5">Cập nhật lần cuối {new Date(activePlan.createdAt).toLocaleDateString("vi-VN")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleArchive(activePlan.id)}
            disabled={archiving}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5" />
            Lưu trữ
          </button>
          <button
            onClick={() => setShowDesigner(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-white text-xs font-bold"
            style={{ backgroundColor: "#f15b5c" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo mới
          </button>
        </div>
      </div>

      {/* Macro targets */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 font-semibold mb-2">Chỉ số mục tiêu</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">TDEE (duy trì)</span>
              <span className="text-sm font-bold text-gray-700">{Math.round(activePlan.tdee)} kcal</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">DER (mục tiêu)</span>
              <span className="text-sm font-extrabold text-[#f15b5c]">{Math.round(activePlan.der)} kcal</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 font-semibold mb-2">Macro/ngày</p>
          <div className="flex flex-wrap gap-1.5">
            <MacroBadge label="P" value={activePlan.protein} color="bg-blue-50 text-blue-700" />
            <MacroBadge label="F" value={activePlan.fat} color="bg-yellow-50 text-yellow-700" />
            <MacroBadge label="C" value={activePlan.carbs} color="bg-green-50 text-green-700" />
          </div>
          {activePlan.likes && <p className="text-xs text-gray-400 mt-2 truncate">Thích: {activePlan.likes}</p>}
          {activePlan.dislikes && <p className="text-xs text-gray-400 truncate">Kiêng: {activePlan.dislikes}</p>}
        </div>
      </div>

      {/* Meal cards read-only */}
      {meals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Thực đơn mẫu</p>
          {meals.map((meal, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: "#f15b5c" }}>
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/60">
                <span className="text-xs font-extrabold text-gray-800">{meal.mealName}</span>
                <div className="flex gap-1">
                  <MacroBadge label="🔥" value={meal.calories} unit=" kcal" color="bg-red-50 text-red-600" />
                  <MacroBadge label="P" value={meal.protein} color="bg-blue-50 text-blue-600" />
                  <MacroBadge label="F" value={meal.fat} color="bg-yellow-50 text-yellow-700" />
                  <MacroBadge label="C" value={meal.carbs} color="bg-green-50 text-green-700" />
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-600 leading-relaxed">{meal.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
