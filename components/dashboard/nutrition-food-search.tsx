"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, X } from "lucide-react";
import type { MealItem } from "./nutrition-designer";

interface FoodResult {
  fdcId?: number;
  isLocal: boolean;
  nameEn: string;
  nameVi: string;
  brandOwner: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MEAL_SLOTS = ["Sáng", "Trưa", "Xế", "Tối", "Bữa 5", "Bữa 6"];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function NutritionFoodSearch({
  mealsPerDay,
  onAdd,
}: {
  mealsPerDay: number;
  onAdd: (item: MealItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [portion, setPortion] = useState("100");
  const [mealSlot, setMealSlot] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data: FoodResult[] = await res.json();
          setResults(data);
          setOpen(data.length > 0);
        }
      } finally {
        setLoading(false);
      }
    }, 500);
  }, [query]);

  function handleSelect(food: FoodResult) {
    setSelected(food);
    setOpen(false);
    setPortion("100");
    setQuery(food.nameVi);
  }

  function handleAdd() {
    if (!selected) return;
    const p = Math.max(1, parseFloat(portion) || 100);
    const factor = p / 100;
    const mealLabel = `Bữa ${mealSlot + 1} - ${MEAL_SLOTS[mealSlot] ?? `Bữa ${mealSlot + 1}`}`;
    onAdd({
      mealName: mealLabel,
      name: `${selected.nameVi} (${p}g)`,
      calories: Math.round(selected.calories * factor),
      protein: round1(selected.protein * factor),
      fat: round1(selected.fat * factor),
      carbs: round1(selected.carbs * factor),
    });
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const p = parseFloat(portion) || 100;
  const factor = p / 100;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500">Thêm thực phẩm thủ công</label>

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="🔍 Tìm thực phẩm (tiếng Anh hoặc Việt)..."
            className="w-full h-9 rounded-xl border border-gray-200 bg-white pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-200 border-t-[#f15b5c] rounded-full animate-spin" />
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {results.map((food, i) => (
              <button
                key={food.fdcId ?? `local-${i}`}
                onMouseDown={() => handleSelect(food)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-800 truncate">{food.nameVi}</p>
                      {food.isLocal && (
                        <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full flex-shrink-0">VN</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{food.nameEn}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end text-[10px] font-bold">
                    <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">🔥{food.calories}</span>
                    <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">P:{food.protein}g</span>
                    <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">C:{food.carbs}g</span>
                    <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">F:{food.fat}g</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected food form */}
      {selected && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800">{selected.nameVi}</p>
              <p className="text-xs text-gray-400">{selected.nameEn} · per 100g</p>
            </div>
            <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <select
              value={mealSlot}
              onChange={(e) => setMealSlot(Number(e.target.value))}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
            >
              {Array.from({ length: mealsPerDay }, (_, i) => (
                <option key={i} value={i}>
                  Bữa {i + 1} - {MEAL_SLOTS[i] ?? `Bữa ${i + 1}`}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <input
                type="number"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                min={1}
                className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
            </div>
            <button
              onClick={handleAdd}
              className="h-8 px-3 bg-[#f15b5c] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 flex-shrink-0"
            >
              <Plus className="w-3 h-3" /> Thêm
            </button>
          </div>

          {/* Macro preview for selected portion */}
          <div className="flex gap-1 flex-wrap text-[10px] font-bold">
            <span className="bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
              🔥 {Math.round(selected.calories * factor)} kcal
            </span>
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              P: {round1(selected.protein * factor)}g
            </span>
            <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
              C: {round1(selected.carbs * factor)}g
            </span>
            <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
              F: {round1(selected.fat * factor)}g
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
