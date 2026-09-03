"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Trash2, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOODS } from "@/lib/foods-data";
import { mealTotals, type MealEntry } from "@/lib/exam-trial";

/**
 * Vòng "Phàm ăn" — dựng khay ăn cho một hồ sơ khách sao cho chạm đúng chỉ tiêu.
 *
 * Thí sinh THẤY chỉ tiêu và thấy tổng đang đi tới đâu, nhưng KHÔNG thấy mình đã
 * đạt hay chưa: hiện dấu tích ngay thì bài biến thành trò mò mẫm kéo thanh cho
 * xanh, chẳng đo được ai biết dựng thực đơn. Chấm điểm nằm hết ở server.
 */

export type MealBriefView = {
  id: string;
  clientProfile: string;
  targetCalories: number | null;
  targetProtein: number | null;
  targetFat: number | null;
  targetCarbs: number | null;
  tolerancePercent: number;
  bannedFoods: string[];
};

const METRIC_LABEL = {
  calories: "Calo (kcal)",
  protein: "Đạm (g)",
  fat: "Béo (g)",
  carbs: "Đường bột (g)",
} as const;

export function MealRound({
  brief,
  entries,
  onChange,
  disabled,
}: {
  brief: MealBriefView;
  entries: MealEntry[];
  onChange: (next: MealEntry[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const totals = mealTotals(entries);

  // Lọc trong 526 món — chỉ hiện 20 kết quả đầu, danh sách dài hơn thì người ta
  // cuộn chứ không đọc, mà lại làm chậm máy yếu.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return FOODS.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.nameEn ?? "").toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query]);

  function addFood(name: string) {
    if (disabled) return;
    if (entries.some((e) => e.food === name)) return;
    onChange([...entries, { food: name, grams: 100 }]);
    setQuery("");
  }

  function setGrams(name: string, grams: number) {
    onChange(entries.map((e) => (e.food === name ? { ...e, grams } : e)));
  }

  function remove(name: string) {
    onChange(entries.filter((e) => e.food !== name));
  }

  const targets = [
    ["calories", brief.targetCalories] as const,
    ["protein", brief.targetProtein] as const,
    ["fat", brief.targetFat] as const,
    ["carbs", brief.targetCarbs] as const,
  ].filter(([, t]) => t != null) as [keyof typeof METRIC_LABEL, number][];

  return (
    <div className="space-y-4">
      {/* Hồ sơ khách */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
          <Utensils className="h-3.5 w-3.5" />
          Hồ sơ khách
        </p>
        <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-gray-700">
          {brief.clientProfile}
        </p>
        {brief.bannedFoods.length > 0 && (
          <p className="mt-2.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
            Không được dùng: {brief.bannedFoods.join(", ")}
          </p>
        )}
      </div>

      {/* Chỉ tiêu và tổng hiện tại — cố ý KHÔNG chấm đúng/sai tại đây */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {targets.map(([metric, target]) => (
          <div key={metric} className="rounded-xl border border-gray-100 bg-white p-3">
            <p className="text-[11px] font-bold text-gray-400">{METRIC_LABEL[metric]}</p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-800">
              {totals[metric]}
            </p>
            <p className="text-[11px] font-semibold text-gray-400">
              cần {target} ± {brief.tolerancePercent}%
            </p>
          </div>
        ))}
      </div>

      {/* Tìm và thêm món */}
      {!disabled && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm món để thêm vào khay…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          />
          {matches.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {matches.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => addFood(f.name)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-gray-700">{f.name}</span>
                  <span className="shrink-0 text-[11px] font-bold text-gray-400">
                    {f.calories} kcal · {f.protein}đ /100g
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Khay ăn */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-gray-200 py-10">
          <Plus className="h-6 w-6 text-gray-200" />
          <p className="text-sm font-semibold text-gray-300">Khay ăn còn trống</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100">
          {entries.map((e) => {
            const banned = brief.bannedFoods.some(
              (b) => b.trim().toLowerCase() === e.food.trim().toLowerCase()
            );
            return (
              <div
                key={e.food}
                className={cn("flex items-center gap-3 px-3 py-2.5", banned && "bg-red-50/60")}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-700">
                  {e.food}
                </span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={10}
                  value={e.grams}
                  disabled={disabled}
                  onFocus={(ev) => ev.target.select()}
                  onChange={(ev) => setGrams(e.food, Math.max(0, parseInt(ev.target.value) || 0))}
                  className="h-9 w-20 shrink-0 rounded-lg border border-gray-200 px-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 disabled:bg-gray-50"
                />
                <span className="shrink-0 text-xs font-bold text-gray-400">g</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remove(e.food)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    aria-label={`Bỏ ${e.food}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
