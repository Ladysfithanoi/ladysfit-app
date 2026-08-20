"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { NutritionFoodSearch } from "./nutrition-food-search";

// ── Nutrition calculation ──────────────────────────────────────────────────

export function phaseToStage(phase: string): number {
  if (phase.startsWith("Giai đoạn 1")) return 1;
  if (phase.startsWith("Giai đoạn 2")) return 2;
  if (phase.startsWith("Giai đoạn 3")) return 3;
  return 1;
}

// Macro mục tiêu suy ra từ mốc calo/ngày (DER). Đạm bám theo cân nặng lý tưởng nên
// không đổi theo DER; phần calo còn lại chia cho béo & tinh bột. Tách riêng để khi
// Admin/FM sửa tay mốc calo thì macro được tính lại đúng cùng một công thức.
export function macrosForDer(der: number, height: number) {
  const idealWeight = (height - 100) * 0.9;
  const protein = idealWeight * 2;

  // Floor values to prevent 0g Carb when DER is very low
  const MIN_CARBS = 30; // g
  const MIN_FAT   = 20; // g

  const remainAfterProtein = der - protein * 4;

  let fat: number;
  let carbs: number;

  if (remainAfterProtein <= MIN_CARBS * 4 + MIN_FAT * 9) {
    // DER critically low — preserve minimum carbs and fat
    fat   = MIN_FAT;
    carbs = MIN_CARBS;
  } else {
    const carbsAtStdFat = (remainAfterProtein - 50 * 9) / 4;
    if (carbsAtStdFat >= MIN_CARBS) {
      fat   = 50;
      carbs = carbsAtStdFat;
    } else {
      // Reduce fat to guarantee MIN_CARBS floor
      fat   = (remainAfterProtein - MIN_CARBS * 4) / 9;
      carbs = MIN_CARBS;
    }
  }

  return { protein, fat, carbs };
}

export function calculateNutrition(weight: number, height: number, hasDieted: boolean, stage: number) {
  const pal = stage === 1 ? 1.2 : stage === 2 ? 1.4 : 1.6;
  let tdee = weight * 22 * pal;
  if (hasDieted) tdee *= 0.9;

  const weightLossPercent = stage === 1 ? 0.01 : stage === 2 ? 0.005 : 0;
  const dailyDeficit = (weight * weightLossPercent * 7700) / 7;
  const der = tdee - dailyDeficit;

  return { tdee, der, ...macrosForDer(der, height) };
}

// ── Types ──────────────────────────────────────────────────────────────────

export type MealItem = {
  mealName: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type MealPlanRow = {
  id: string;
  tdee: number;
  der: number;
  protein: number;
  fat: number;
  carbs: number;
  mealsPerDay: number;
  likes: string | null;
  dislikes: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  days: {
    id: string;
    dayLabel: string;
    meals: MealItem[];
    totalCalories: number;
    totalProtein: number;
    totalFat: number;
    totalCarbs: number;
  }[];
};

// ── MacroBadge ─────────────────────────────────────────────────────────────

function MacroBadge({ label, value, unit = "g", color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", color)}>
      {label} {Math.round(value)}{unit}
    </span>
  );
}

// ── MealCard ───────────────────────────────────────────────────────────────

function MealCard({ meal, onDelete }: { meal: MealItem; onDelete?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: "#f15b5c" }}>
      <div className="flex flex-col gap-2 px-4 py-2.5 bg-gray-50/60 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-left min-w-0">
          <span className="text-xs font-extrabold text-gray-800 whitespace-nowrap flex-shrink-0">{meal.mealName}</span>
          {open ? <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:gap-1">
            <MacroBadge label="🔥" value={meal.calories} unit=" kcal" color="bg-red-50 text-red-600" />
            <MacroBadge label="P" value={meal.protein} color="bg-blue-50 text-blue-600" />
            <MacroBadge label="F" value={meal.fat} color="bg-yellow-50 text-yellow-700" />
            <MacroBadge label="C" value={meal.carbs} color="bg-green-50 text-green-700" />
          </div>
          {onDelete && (
            <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="px-4 py-3">
          <p className="text-xs text-gray-600 leading-relaxed">{meal.name}</p>
        </div>
      )}
    </div>
  );
}

// ── NutritionDesigner ──────────────────────────────────────────────────────

export function NutritionDesigner({
  consultationId,
  clientId,
  initialWeight,
  initialHeight,
  initialPhase,
  initialLikes,
  initialDislikes,
  existingPlan,
  onSaved,
  onSkip,
  isReadOnly = false,
  canEditCalories = false,
  saveLabel = "Lưu chế độ ăn",
}: {
  consultationId?: string;
  clientId?: string;
  initialWeight?: number;
  initialHeight?: number;
  initialPhase?: string;
  initialLikes?: string;
  initialDislikes?: string;
  existingPlan?: MealPlanRow | null;
  onSaved: (plan: MealPlanRow) => void;
  onSkip?: () => void;
  isReadOnly?: boolean;
  /** Admin/FM được sửa tay mốc calo mục tiêu (DER) thay vì dùng số tự tính. PT thì không. */
  canEditCalories?: boolean;
  saveLabel?: string;
}) {
  // Section 1: Metrics
  const [hasDieted, setHasDieted] = useState(false);
  const phase = initialPhase ?? "Giai đoạn 1";
  const weight = initialWeight ?? 60;
  const height = initialHeight ?? 160;
  const stage = phaseToStage(phase);
  const autoMetrics = calculateNutrition(weight, height, hasDieted, stage);

  // Mốc calo sửa tay (Admin/FM). null = dùng đúng số hệ thống tự tính. Giữ dạng
  // chuỗi để gõ dở ("1", "18"…) không bị nhảy về số tự tính giữa chừng. Mở lại một
  // chế độ ăn đã lưu lệch số tự tính thì lấy lại chính mốc đã lưu — chỉ làm vậy cho
  // người có quyền sửa, để luồng của PT giữ nguyên như cũ.
  const [derOverride, setDerOverride] = useState<string | null>(() => {
    if (!existingPlan || !canEditCalories) return null;
    const auto = calculateNutrition(weight, height, false, stage);
    return Math.round(existingPlan.der) === Math.round(auto.der)
      ? null
      : String(Math.round(existingPlan.der));
  });
  const derValue = derOverride !== null && Number(derOverride) > 0 ? Number(derOverride) : null;
  const metrics = derValue === null
    ? autoMetrics
    : { tdee: autoMetrics.tdee, der: derValue, ...macrosForDer(derValue, height) };

  // Section 2: Meal design
  const [mealsPerDay, setMealsPerDay] = useState(existingPlan?.mealsPerDay ?? 3);
  const [likes, setLikes] = useState(existingPlan?.likes ?? initialLikes ?? "");
  const [dislikes, setDislikes] = useState(existingPlan?.dislikes ?? initialDislikes ?? "");
  const [meals, setMeals] = useState<MealItem[]>(existingPlan?.days[0]?.meals ?? []);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const totalMeals = {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein:  meals.reduce((s, m) => s + m.protein, 0),
    fat:      meals.reduce((s, m) => s + m.fat, 0),
    carbs:    meals.reduce((s, m) => s + m.carbs, 0),
  };

  async function handleGenerate() {
    setGenerating(true);
    setGenError("");
    try {
      const reqBody = {
        der: metrics.der,
        protein: metrics.protein,
        fat: metrics.fat,
        carbs: metrics.carbs,
        mealsPerDay,
        likes,
        dislikes,
      };
      console.log("🟡 Calling /api/nutrition/generate-plan with:", reqBody);
      const res = await fetch("/api/nutrition/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      console.log("🟡 Response status:", res.status);
      if (!res.ok) {
        const errData = await res.json();
        console.log("🟡 Error response:", errData);
        throw new Error(errData.error ?? "Lỗi AI");
      }
      const data = await res.json();
      console.log("🟡 Response data:", data);
      setMeals(Array.isArray(data) ? data : data.meals);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (meals.length === 0) { setSaveError("Hãy tạo thực đơn trước khi lưu"); return; }
    setSaving(true);
    setSaveError("");
    try {
      const endpoint = consultationId
        ? `/api/consultation/${consultationId}/meal-plan`
        : `/api/clients/${clientId}/meal-plans`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tdee: metrics.tdee,
          der: metrics.der,
          protein: metrics.protein,
          fat: metrics.fat,
          carbs: metrics.carbs,
          mealsPerDay,
          likes: likes || null,
          dislikes: dislikes || null,
          meals,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi lưu");
      const saved: MealPlanRow = await res.json();
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

  return (
    <div className="space-y-5">
      {/* ── Section 1: Metrics ── */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Tính toán chỉ số</p>

        {/* Client info row */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <p className="text-gray-400 font-semibold">Cân nặng</p>
            <p className="text-gray-800 font-extrabold mt-0.5">{weight} kg</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <p className="text-gray-400 font-semibold">Chiều cao</p>
            <p className="text-gray-800 font-extrabold mt-0.5">{height} cm</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <p className="text-gray-400 font-semibold">Giai đoạn</p>
            <p className="text-gray-800 font-extrabold mt-0.5 leading-tight break-words">{phase}</p>
          </div>
        </div>

        {/* Dieted toggle */}
        {!isReadOnly && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setHasDieted((v) => !v); setDerOverride(null); }}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                hasDieted ? "bg-[#f15b5c]" : "bg-gray-200"
              )}
            >
              <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", hasDieted ? "translate-x-4" : "translate-x-0.5")} />
            </button>
            <p className="text-xs text-gray-600 font-semibold">
              {hasDieted ? "Đã từng giảm hơn 10% tổng trọng lượng" : "Chưa từng giảm hơn 10% tổng trọng lượng"}
            </p>
          </div>
        )}

        {/* Calculated values */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-semibold">TDEE (duy trì)</span>
              <span className="text-sm font-extrabold text-gray-800">{Math.round(metrics.tdee)} kcal</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400 font-semibold">DER (mục tiêu)</span>
              {canEditCalories && !isReadOnly ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={derOverride ?? String(Math.round(autoMetrics.der))}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDerOverride(e.target.value)}
                    className="w-20 h-7 rounded-lg border border-gray-200 px-2 text-right text-sm font-extrabold text-[#f15b5c] focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                  />
                  <span className="text-xs text-gray-400 font-semibold">kcal</span>
                </div>
              ) : (
                <span className="text-sm font-extrabold text-[#f15b5c]">{Math.round(metrics.der)} kcal</span>
              )}
            </div>
            {canEditCalories && !isReadOnly && derOverride !== null && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[10px] text-gray-400">
                  Hệ thống tự tính: {Math.round(autoMetrics.der)} kcal
                </span>
                <button
                  onClick={() => setDerOverride(null)}
                  className="text-[10px] font-bold text-gray-500 hover:text-[#f15b5c] underline"
                >
                  Dùng lại số tự tính
                </button>
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 space-y-1.5">
            <p className="text-xs text-gray-400 font-semibold mb-1">
              Macro mục tiêu
              {derValue !== null && (
                <span className="font-normal text-gray-300"> · tính theo mốc calo đã sửa</span>
              )}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <MacroBadge label="P" value={metrics.protein} color="bg-blue-50 text-blue-700" />
              <MacroBadge label="F" value={metrics.fat} color="bg-yellow-50 text-yellow-700" />
              <MacroBadge label="C" value={metrics.carbs} color="bg-green-50 text-green-700" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Meal design ── */}
      {!isReadOnly && (
        <div className="space-y-3">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Thiết kế thực đơn</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Số bữa ăn/ngày</label>
              <select
                value={mealsPerDay}
                onChange={(e) => setMealsPerDay(Number(e.target.value))}
                className={inputCls}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n} bữa</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">
                Thích ăn gì <span className="text-gray-300 font-normal">(Tùy chọn)</span>
              </label>
              <input
                type="text"
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
                placeholder="Bỏ trống = AI tự chọn ngẫu nhiên"
                className={inputCls}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500">
                Không thích / dị ứng <span className="text-gray-300 font-normal">(Tùy chọn)</span>
              </label>
              <input
                type="text"
                value={dislikes}
                onChange={(e) => setDislikes(e.target.value)}
                placeholder="Bỏ trống = không có kiêng kị"
                className={inputCls}
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full h-10 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70 transition-opacity"
            style={{ backgroundColor: "#6c5ce7" }}
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> AI đang soạn thực đơn (10-15 giây)...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> ✨ Gợi ý thực đơn bằng AI</>
            )}
          </button>
          {genError && <p className="text-xs text-red-500 font-medium">{genError}</p>}

          <div className="border-t border-gray-100 pt-3">
            <NutritionFoodSearch
              mealsPerDay={mealsPerDay}
              onAdd={(item) => setMeals((prev) => [...prev, item])}
            />
          </div>
        </div>
      )}

      {/* ── Meal cards ── */}
      {meals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Thực đơn</p>
          {meals.map((meal, i) => (
            <MealCard
              key={i}
              meal={meal}
              onDelete={isReadOnly ? undefined : () => setMeals((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}

          {/* Summary — 4-col comparison grid */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
            {[
              { label: "🔥 Calo", actual: Math.round(totalMeals.calories), target: Math.round(metrics.der), unit: " kcal", bg: "bg-red-50", text: "text-red-600" },
              { label: "P",       actual: Math.round(totalMeals.protein),  target: Math.round(metrics.protein), unit: "g", bg: "bg-blue-50", text: "text-blue-700" },
              { label: "F",       actual: Math.round(totalMeals.fat),      target: Math.round(metrics.fat),     unit: "g", bg: "bg-yellow-50", text: "text-yellow-700" },
              { label: "C",       actual: Math.round(totalMeals.carbs),    target: Math.round(metrics.carbs),   unit: "g", bg: "bg-green-50", text: "text-green-700" },
            ].map(({ label, actual, target, unit, bg, text }) => (
              <div key={label} className={cn("rounded-xl px-3 py-2.5 border border-gray-100", bg)}>
                <p className={cn("text-[10px] font-extrabold mb-1", text)}>{label}</p>
                <p className={cn("text-sm font-extrabold", text)}>{actual}{unit}</p>
                <p className="text-[10px] text-gray-400 font-medium">Mục tiêu: {target}{unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {!isReadOnly && (
        <div className="space-y-2 pt-1">
          {saveError && <p className="text-xs text-[#f15b5c] font-medium">{saveError}</p>}
          <div className="flex gap-2">
            {onSkip && (
              <button
                onClick={onSkip}
                className="h-10 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50"
              >
                Bỏ qua
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || meals.length === 0}
              className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang lưu...</> : saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
