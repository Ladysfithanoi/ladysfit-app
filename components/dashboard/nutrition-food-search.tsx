"use client";

import { useState, useRef } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
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

type Ingredient = {
  id: number;
  query: string;
  results: FoodResult[];
  loading: boolean;
  open: boolean;
  food: FoodResult | null;
  grams: string;
};

const MEAL_SLOTS = ["Sáng", "Trưa", "Xế", "Tối", "Bữa 5", "Bữa 6"];
const MAX_INGREDIENTS = 5;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function calcNutrients(food: FoodResult, grams: number) {
  const f = grams / 100;
  return {
    calories: Math.round(food.calories * f),
    protein: round1(food.protein * f),
    carbs: round1(food.carbs * f),
    fat: round1(food.fat * f),
  };
}

function newIngredient(): Ingredient {
  return {
    id: Date.now() + Math.random(),
    query: "",
    results: [],
    loading: false,
    open: false,
    food: null,
    grams: "100",
  };
}

export function NutritionFoodSearch({
  mealsPerDay,
  onAdd,
}: {
  mealsPerDay: number;
  onAdd: (item: MealItem) => void;
}) {
  const [mealName, setMealName] = useState("");
  const [mealSlot, setMealSlot] = useState(0);
  const [ingredients, setIngredients] = useState<Ingredient[]>([newIngredient()]);
  const [error, setError] = useState("");
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  function updateIngredient(id: number, patch: Partial<Ingredient>) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function handleQueryChange(id: number, value: string) {
    updateIngredient(id, { query: value, food: null, open: false });
    if (debounceRefs.current[id]) clearTimeout(debounceRefs.current[id]);
    if (!value.trim()) {
      updateIngredient(id, { results: [], loading: false });
      return;
    }
    updateIngredient(id, { loading: true });
    debounceRefs.current[id] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data: FoodResult[] = await res.json();
          updateIngredient(id, { results: data, open: data.length > 0, loading: false });
        } else {
          updateIngredient(id, { loading: false });
        }
      } catch {
        updateIngredient(id, { loading: false });
      }
    }, 500);
  }

  function handleSelect(id: number, food: FoodResult) {
    updateIngredient(id, { food, query: food.nameVi, open: false, results: [] });
  }

  function removeIngredient(id: number) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  function addIngredientRow() {
    if (ingredients.length >= MAX_INGREDIENTS) return;
    setIngredients((prev) => [...prev, newIngredient()]);
  }

  const totals = ingredients.reduce(
    (sum, ing) => {
      if (!ing.food) return sum;
      const g = parseFloat(ing.grams) || 0;
      const n = calcNutrients(ing.food, g);
      return {
        calories: sum.calories + n.calories,
        protein: sum.protein + n.protein,
        carbs: sum.carbs + n.carbs,
        fat: sum.fat + n.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const hasAnyFood = ingredients.some((i) => i.food !== null);

  function handleSave() {
    setError("");
    if (!mealName.trim()) {
      setError("Vui lòng nhập tên bữa ăn");
      return;
    }
    if (!hasAnyFood) {
      setError("Chọn ít nhất 1 nguyên liệu");
      return;
    }
    const slotLabel = `Bữa ${mealSlot + 1} - ${MEAL_SLOTS[mealSlot] ?? `Bữa ${mealSlot + 1}`}`;
    const ingredientNames = ingredients
      .filter((i) => i.food)
      .map((i) => `${i.food!.nameVi} (${i.grams}g)`)
      .join(", ");
    onAdd({
      mealName: `${slotLabel}: ${mealName.trim()}`,
      name: ingredientNames,
      calories: totals.calories,
      protein: round1(totals.protein),
      fat: round1(totals.fat),
      carbs: round1(totals.carbs),
    });
    setMealName("");
    setMealSlot(0);
    setIngredients([newIngredient()]);
    setError("");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">
        Thêm bữa ăn thủ công
      </p>

      {/* Slot + meal name */}
      <div className="flex gap-2">
        <select
          value={mealSlot}
          onChange={(e) => setMealSlot(Number(e.target.value))}
          className="h-9 rounded-xl border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 flex-shrink-0"
        >
          {Array.from({ length: mealsPerDay }, (_, i) => (
            <option key={i} value={i}>
              Bữa {i + 1} – {MEAL_SLOTS[i] ?? `Bữa ${i + 1}`}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="Tên bữa ăn (VD: Cơm gà xối mỡ)"
          className="flex-1 h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
        />
      </div>

      {/* Ingredient rows */}
      <div className="space-y-2">
        {ingredients.map((ing, idx) => {
          const g = parseFloat(ing.grams) || 0;
          const preview = ing.food && g > 0 ? calcNutrients(ing.food, g) : null;

          return (
            <div key={ing.id} className="bg-gray-50 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-gray-400 w-4 flex-shrink-0 text-center">
                  {idx + 1}
                </span>

                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={ing.query}
                    onChange={(e) => handleQueryChange(ing.id, e.target.value)}
                    onFocus={() => ing.results.length > 0 && updateIngredient(ing.id, { open: true })}
                    onBlur={() =>
                      setTimeout(() => updateIngredient(ing.id, { open: false }), 150)
                    }
                    placeholder="Tìm nguyên liệu..."
                    className="w-full h-8 rounded-lg border border-gray-200 bg-white pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                  />
                  {ing.loading && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-gray-200 border-t-[#f15b5c] rounded-full animate-spin" />
                  )}

                  {/* Dropdown results */}
                  {ing.open && ing.results.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {ing.results.map((food, fi) => (
                        <button
                          key={food.fdcId ?? `local-${fi}`}
                          onMouseDown={() => handleSelect(ing.id, food)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-bold text-gray-800 truncate">
                                  {food.nameVi}
                                </p>
                                {food.isLocal && (
                                  <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1 py-0.5 rounded-full flex-shrink-0">
                                    VN
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 truncate">{food.nameEn}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0 text-[10px] font-bold">
                              <span className="bg-red-50 text-red-500 px-1 py-0.5 rounded-full">
                                🔥{food.calories}
                              </span>
                              <span className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded-full">
                                P:{food.protein}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grams input */}
                <div className="relative w-[72px] flex-shrink-0">
                  <input
                    type="number"
                    value={ing.grams}
                    onChange={(e) => updateIngredient(ing.id, { grams: e.target.value })}
                    min={1}
                    className="w-full h-8 rounded-lg border border-gray-200 bg-white px-2 pr-6 text-xs focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                    g
                  </span>
                </div>

                {/* Remove row */}
                {ingredients.length > 1 && (
                  <button
                    onClick={() => removeIngredient(ing.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Per-ingredient macro preview */}
              {preview && (
                <div className="flex gap-1 ml-6 flex-wrap text-[10px] font-bold">
                  <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">
                    🔥{preview.calories} kcal
                  </span>
                  <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                    P: {preview.protein}g
                  </span>
                  <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">
                    C: {preview.carbs}g
                  </span>
                  <span className="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">
                    F: {preview.fat}g
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add ingredient button */}
      {ingredients.length < MAX_INGREDIENTS && (
        <button
          onClick={addIngredientRow}
          className="w-full h-8 rounded-xl border-2 border-dashed border-gray-200 text-xs font-semibold text-gray-400 hover:border-[#f15b5c]/40 hover:text-[#f15b5c] transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-3 h-3" /> Thêm nguyên liệu ({ingredients.length}/{MAX_INGREDIENTS})
        </button>
      )}

      {/* Combined totals */}
      {hasAnyFood && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-extrabold text-blue-700 mb-1.5">Tổng dinh dưỡng</p>
          <div className="flex gap-1.5 flex-wrap text-[10px] font-bold">
            <span className="bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
              🔥 {totals.calories} kcal
            </span>
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              P: {round1(totals.protein)}g
            </span>
            <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
              C: {round1(totals.carbs)}g
            </span>
            <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
              F: {round1(totals.fat)}g
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!hasAnyFood}
        className="w-full h-9 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: "#f15b5c" }}
      >
        <Plus className="w-4 h-4" /> Lưu bữa ăn
      </button>
    </div>
  );
}
