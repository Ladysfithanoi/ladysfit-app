"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NutritionFoodSearch } from "@/components/dashboard/nutrition-food-search";
import type { MealItem, MealPlanRow } from "@/components/dashboard/nutrition-designer";

// ── Khách tự soạn thực đơn ──────────────────────────────────────────────────
//
// Khách chủ động chọn món trong đúng mốc calo/macro PT đã tính: nhờ AI soạn cả
// thực đơn, hoặc tự tra từng món rồi thêm tay. Phần TÍNH TOÁN (calo, đạm, béo,
// tinh bột mục tiêu) chỉ để đối chiếu — không có ô nào sửa được, và server cũng
// không nhận các trường đó từ đây.

function MacroBadge({ label, value, unit = "g", color }: {
  label: string; value: number; unit?: string; color: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", color)}>
      {label} {Math.round(value)}{unit}
    </span>
  );
}

export function MenuBuilder({
  plan,
  onSaved,
  onClose,
}: {
  plan: MealPlanRow;
  onSaved: (plan: MealPlanRow) => void;
  onClose: () => void;
}) {
  const [mealsPerDay, setMealsPerDay] = useState(plan.mealsPerDay);
  const [likes, setLikes] = useState(plan.likes ?? "");
  const [dislikes, setDislikes] = useState(plan.dislikes ?? "");
  const [meals, setMeals] = useState<MealItem[]>(plan.days[0]?.meals ?? []);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totals = {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein: meals.reduce((s, m) => s + m.protein, 0),
    fat: meals.reduce((s, m) => s + m.fat, 0),
    carbs: meals.reduce((s, m) => s + m.carbs, 0),
  };

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      // Mốc calo/macro gửi lên lấy từ chính chế độ ăn PT đã tính, để AI soạn
      // đúng khung đó — khách không nhập được con số nào ở đây.
      const res = await fetch("/api/nutrition/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          der: plan.der,
          protein: plan.protein,
          fat: plan.fat,
          carbs: plan.carbs,
          mealsPerDay,
          likes,
          dislikes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "AI đang bận, thử lại sau");
      const data = await res.json();
      setMeals(Array.isArray(data) ? data : data.meals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (meals.length === 0) { setError("Hãy chọn ít nhất một món trước khi lưu"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/my/meal-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealsPerDay, likes: likes || null, dislikes: dislikes || null, meals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được");
      onSaved(data as MealPlanRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full h-10 rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-gray-900">Tự chọn thực đơn</h3>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              Chọn món trong đúng mốc calo PT đã tính cho bạn. Mốc calo và macro giữ nguyên, bạn chỉ đổi món.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Mốc PT đã tính — chỉ để đối chiếu, không sửa được */}
          <div className="bg-gray-50 rounded-2xl p-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">
              Mục tiêu PT tính cho bạn
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              <MacroBadge label="🔥" value={plan.der} unit=" kcal" color="bg-red-50 text-red-600" />
              <MacroBadge label="P" value={plan.protein} color="bg-blue-50 text-blue-700" />
              <MacroBadge label="F" value={plan.fat} color="bg-yellow-50 text-yellow-700" />
              <MacroBadge label="C" value={plan.carbs} color="bg-green-50 text-green-700" />
            </div>
          </div>

          {/* Sở thích ăn uống — đầu vào cho AI */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Số bữa ăn/ngày</label>
              <select value={mealsPerDay} onChange={(e) => setMealsPerDay(Number(e.target.value))} className={inputCls}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} bữa</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">
                Bạn thích ăn gì <span className="text-gray-300 font-normal">(tùy chọn)</span>
              </label>
              <input
                type="text" value={likes} onChange={(e) => setLikes(e.target.value)}
                placeholder="Bỏ trống = AI tự chọn"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">
                Không ăn được / dị ứng <span className="text-gray-300 font-normal">(tùy chọn)</span>
              </label>
              <input
                type="text" value={dislikes} onChange={(e) => setDislikes(e.target.value)}
                placeholder="Bỏ trống = không kiêng gì"
                className={inputCls}
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || saving}
            className="w-full h-11 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: "#6c5ce7" }}
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> AI đang soạn (10-15 giây)...</>
              : <><Sparkles className="w-4 h-4" /> Nhờ AI soạn thực đơn</>}
          </button>

          {/* Tự tra & thêm món */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest mb-2">Hoặc tự chọn món</p>
            <NutritionFoodSearch
              mealsPerDay={mealsPerDay}
              onAdd={(item) => setMeals((prev) => [...prev, item])}
            />
          </div>

          {/* Danh sách món đang có */}
          {meals.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Thực đơn của bạn</p>
              {meals.map((meal, i) => (
                <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: "#f15b5c" }}>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50/60">
                    <span className="text-xs font-extrabold text-gray-800 truncate">{meal.mealName}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <MacroBadge label="🔥" value={meal.calories} unit=" kcal" color="bg-red-50 text-red-600" />
                      <button
                        onClick={() => setMeals((prev) => prev.filter((_, j) => j !== i))}
                        className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="px-3 py-2 text-xs text-gray-600 leading-relaxed">{meal.name}</p>
                </div>
              ))}

              {/* Đối chiếu tổng với mốc PT đặt */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "🔥 Calo", actual: totals.calories, target: plan.der, unit: " kcal", bg: "bg-red-50", text: "text-red-600" },
                  { label: "P", actual: totals.protein, target: plan.protein, unit: "g", bg: "bg-blue-50", text: "text-blue-700" },
                  { label: "F", actual: totals.fat, target: plan.fat, unit: "g", bg: "bg-yellow-50", text: "text-yellow-700" },
                  { label: "C", actual: totals.carbs, target: plan.carbs, unit: "g", bg: "bg-green-50", text: "text-green-700" },
                ].map(({ label, actual, target, unit, bg, text }) => (
                  <div key={label} className={cn("rounded-2xl px-3 py-2 border border-gray-100", bg)}>
                    <p className={cn("text-[10px] font-extrabold mb-0.5", text)}>{label}</p>
                    <p className={cn("text-sm font-extrabold", text)}>{Math.round(actual)}{unit}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Mục tiêu: {Math.round(target)}{unit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 space-y-2 flex-shrink-0">
          {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-11 px-5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={saving || meals.length === 0}
              className="flex-1 h-11 rounded-2xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Đang lưu...</> : "Lưu thực đơn"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
