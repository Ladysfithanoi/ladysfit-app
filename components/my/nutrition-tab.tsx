"use client";

import { useState, useRef } from "react";
import { Salad, Camera, Trash2, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MealPlanRow, MealItem } from "@/components/dashboard/nutrition-designer";

// ── Types ──────────────────────────────────────────────────────────────────

type FoodLog = {
  id: string;
  foodName: string;
  quantity: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  scanDate: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const over = value > target;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold text-gray-600">
        <span>{label}</span>
        <span className={over ? "text-red-500" : ""}>{Math.round(value)} / {Math.round(target)}g</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", over ? "bg-red-400" : color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MacroBadge({ label, value, unit = "g", color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold", color)}>
      {label} {Math.round(value)}{unit}
    </span>
  );
}

// ── NutritionTab ───────────────────────────────────────────────────────────

export function NutritionTab({
  mealPlan,
  initialLogs,
  myPlateImageUrl,
  myPlateNote,
}: {
  mealPlan: MealPlanRow | null;
  initialLogs: FoodLog[];
  myPlateImageUrl?: string | null;
  myPlateNote?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"myplate" | "menu">(myPlateImageUrl ? "myplate" : "menu");
  const [showMyPlateModal, setShowMyPlateModal] = useState(false);

  const [logs, setLogs] = useState<FoodLog[]>(initialLogs);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    name: string; qty: string; calories: number; protein: number; fat: number; carbs: number;
  } | null>(null);
  const [scanError, setScanError] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const meals: MealItem[] = mealPlan?.days[0]?.meals ?? [];

  const totals = {
    calories: logs.reduce((s, l) => s + l.calories, 0),
    protein:  logs.reduce((s, l) => s + l.protein, 0),
    fat:      logs.reduce((s, l) => s + l.fat, 0),
    carbs:    logs.reduce((s, l) => s + l.carbs, 0),
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanError("");
    setScanResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = (reader.result as string).split(",")[1];
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/nutrition/scan-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Image: base64, mimeType: file.type }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi phân tích ảnh");
      const data = await res.json();
      setScanResult(data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAddToLog() {
    if (!scanResult) return;
    setAdding(true);
    try {
      const res = await fetch("/api/my/food-scan-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: scanResult.name,
          quantity: scanResult.qty,
          calories: scanResult.calories,
          protein: scanResult.protein,
          fat: scanResult.fat,
          carbs: scanResult.carbs,
        }),
      });
      if (!res.ok) throw new Error();
      const saved: FoodLog = await res.json();
      setLogs((prev) => [...prev, saved]);
      setScanResult(null);
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteLog(id: string) {
    await fetch(`/api/my/food-scan-logs/${id}`, { method: "DELETE" });
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-gray-900">Dinh dưỡng</h2>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-4">
        <button
          onClick={() => setActiveTab("myplate")}
          className={cn(
            "flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all",
            activeTab === "myplate" ? "bg-white shadow text-[#f15b5c]" : "text-gray-500"
          )}
        >
          🥗 MyPlate
        </button>
        <button
          onClick={() => setActiveTab("menu")}
          className={cn(
            "flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all",
            activeTab === "menu" ? "bg-white shadow text-[#f15b5c]" : "text-gray-500"
          )}
        >
          📋 Thực đơn
        </button>
      </div>

      {/* ── MyPlate tab ── */}
      {activeTab === "myplate" && (
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          {myPlateImageUrl ? (
            <>
              <img
                src={myPlateImageUrl}
                alt="MyPlate"
                className="w-full rounded-2xl cursor-pointer object-contain max-h-[70vh]"
                onClick={() => setShowMyPlateModal(true)}
              />
              {myPlateNote && (
                <p className="text-sm text-gray-600 mt-3 text-center leading-relaxed">{myPlateNote}</p>
              )}
              <p className="text-[10px] text-gray-300 text-center mt-2">Nhấn vào ảnh để xem toàn màn hình</p>
            </>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-3">
              <div className="p-3 rounded-2xl bg-green-50">
                <Salad className="w-7 h-7 text-green-300" />
              </div>
              <p className="text-xs text-gray-300 font-bold text-center">PT sẽ cập nhật MyPlate của bạn</p>
            </div>
          )}
        </div>
      )}

      {/* ── Menu tab ── */}
      {activeTab === "menu" && (
        mealPlan ? (
          <>
            {/* Macro targets */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-green-50">
                  <Salad className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-sm font-extrabold text-gray-700">Chế độ ăn của bạn</p>
              </div>
              {/* TỔNG CẢ NGÀY — 4 ô macro responsive */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-3">
                <div className="bg-white rounded-xl flex flex-col items-center justify-center p-2.5 border border-gray-100 shadow-sm md:p-4">
                  <span className="text-[11px] text-gray-400 md:text-xs">Calo</span>
                  <div className="flex flex-col items-center mt-0.5 md:flex-row md:items-baseline md:gap-0.5">
                    <span className="text-base font-bold text-[#f15b5c] md:text-xl">{Math.round(mealPlan.der)}</span>
                    <span className="text-[10px] text-[#f15b5c] font-medium md:text-xs">kcal</span>
                  </div>
                </div>
                <div className="bg-white rounded-xl flex flex-col items-center justify-center p-2.5 border border-gray-100 shadow-sm md:p-4">
                  <span className="text-[11px] text-gray-400 md:text-xs">Protein</span>
                  <div className="flex flex-col items-center mt-0.5 md:flex-row md:items-baseline md:gap-0.5">
                    <span className="text-base font-bold text-blue-600 md:text-xl">{Math.round(mealPlan.protein)}</span>
                    <span className="text-[10px] text-blue-400 font-medium md:text-xs">g</span>
                  </div>
                </div>
                <div className="bg-white rounded-xl flex flex-col items-center justify-center p-2.5 border border-gray-100 shadow-sm md:p-4">
                  <span className="text-[11px] text-gray-400 md:text-xs">Fat</span>
                  <div className="flex flex-col items-center mt-0.5 md:flex-row md:items-baseline md:gap-0.5">
                    <span className="text-base font-bold text-yellow-600 md:text-xl">{Math.round(mealPlan.fat)}</span>
                    <span className="text-[10px] text-yellow-500 font-medium md:text-xs">g</span>
                  </div>
                </div>
                <div className="bg-white rounded-xl flex flex-col items-center justify-center p-2.5 border border-gray-100 shadow-sm md:p-4">
                  <span className="text-[11px] text-gray-400 md:text-xs">Carbs</span>
                  <div className="flex flex-col items-center mt-0.5 md:flex-row md:items-baseline md:gap-0.5">
                    <span className="text-base font-bold text-green-600 md:text-xl">{Math.round(mealPlan.carbs)}</span>
                    <span className="text-[10px] text-green-500 font-medium md:text-xs">g</span>
                  </div>
                </div>
              </div>

              {/* Meal cards */}
              {meals.length > 0 && (
                <div className="space-y-2">
                  {meals.map((meal, i) => (
                    <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: "#f15b5c" }}>
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50/60">
                        <span className="text-xs font-extrabold text-gray-800">{meal.mealName}</span>
                        <MacroBadge label="🔥" value={meal.calories} unit=" kcal" color="bg-red-50 text-red-600" />
                      </div>
                      <p className="px-3 py-2 text-xs text-gray-600 leading-relaxed">{meal.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Daily tracking ── */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-4">
              <p className="text-sm font-extrabold text-gray-700 mb-3">Theo dõi hôm nay</p>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Calories</span>
                  <span className={totals.calories > mealPlan.der ? "text-red-500" : "text-green-600"}>
                    {Math.round(totals.calories)} / {Math.round(mealPlan.der)} kcal
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", totals.calories > mealPlan.der ? "bg-red-400" : "bg-[#f15b5c]")}
                    style={{ width: `${Math.min(100, (totals.calories / mealPlan.der) * 100)}%` }}
                  />
                </div>
                <MacroBar label="Protein" value={totals.protein} target={mealPlan.protein} color="bg-blue-400" />
                <MacroBar label="Fat"     value={totals.fat}     target={mealPlan.fat}     color="bg-yellow-400" />
                <MacroBar label="Carbs"   value={totals.carbs}   target={mealPlan.carbs}   color="bg-green-400" />
              </div>

              {logs.length > 0 && (
                <div className="space-y-2 mb-3">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between bg-gray-50 rounded-2xl px-3 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-gray-800">{log.foodName}</p>
                        <p className="text-[10px] text-gray-400">{log.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <MacroBadge label="🔥" value={log.calories} unit="" color="bg-red-50 text-red-600" />
                          <MacroBadge label="P" value={log.protein} color="bg-blue-50 text-blue-600" />
                        </div>
                        <button onClick={() => handleDeleteLog(log.id)} className="p-1 text-gray-300 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Food Scan ── */}
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
              <p className="text-sm font-extrabold text-gray-700 mb-3">Quét ảnh bữa ăn</p>

              {scanResult ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
                    <p className="text-sm font-extrabold text-gray-800">{scanResult.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{scanResult.qty}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <MacroBadge label="🔥" value={scanResult.calories} unit=" kcal" color="bg-red-50 text-red-600" />
                      <MacroBadge label="P" value={scanResult.protein} color="bg-blue-50 text-blue-600" />
                      <MacroBadge label="F" value={scanResult.fat} color="bg-yellow-50 text-yellow-700" />
                      <MacroBadge label="C" value={scanResult.carbs} color="bg-green-50 text-green-700" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddToLog}
                      disabled={adding}
                      className="flex-1 h-10 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
                      style={{ backgroundColor: "#f15b5c" }}
                    >
                      {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Thêm vào nhật ký
                    </button>
                    <button onClick={() => setScanResult(null)} className="h-10 px-4 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-500">
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={scanning}
                    className="w-full h-12 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors disabled:opacity-60"
                  >
                    {scanning ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích ảnh...</>
                    ) : (
                      <><Camera className="w-4 h-4" /> Quét ảnh món ăn</>
                    )}
                  </button>
                  {scanError && <p className="text-xs text-red-500 mt-2 font-medium">{scanError}</p>}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl gap-2">
              <Salad className="w-7 h-7 text-gray-200" />
              <p className="text-xs text-gray-300 font-bold text-center">PT sẽ cập nhật chế độ ăn của bạn</p>
            </div>
          </div>
        )
      )}

      {/* ── Fullscreen MyPlate modal ── */}
      {showMyPlateModal && myPlateImageUrl && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setShowMyPlateModal(false)}
        >
          <div
            className="relative max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMyPlateModal(false)}
              className="absolute -top-10 right-0 flex items-center gap-1.5 text-white text-sm font-bold hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" /> Đóng
            </button>
            <img
              src={myPlateImageUrl}
              alt="MyPlate"
              className="w-full rounded-2xl"
            />
            {myPlateNote && (
              <p className="text-sm text-gray-300 text-center mt-3 leading-relaxed">{myPlateNote}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
