"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Trash2, Dumbbell, Ban, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXAM_EXERCISES, EXERCISE_BY_NAME } from "@/lib/exercises-data";
import { programTotals, programPatterns, PROGRAM_METRIC_LABEL, type ProgramEntry } from "@/lib/exam-trial";

/**
 * Vòng "Dựng giáo án" — case study về chuyên môn.
 *
 * Thí sinh THẤY chỉ tiêu và thấy tổng đang đi tới đâu, nhưng KHÔNG thấy mình đã
 * đạt hay chưa — cùng luật với vòng khay ăn. Hiện dấu tích ngay thì bài biến
 * thành trò kéo số cho xanh, chẳng đo được ai biết dựng buổi tập.
 *
 * Khác khay ăn ở chỗ khó hơn thật: bốn chỉ tiêu ràng buộc lẫn nhau (kéo nhóm này
 * lên là nhóm kia lệch), phải đủ mẫu vận động bắt buộc, và bài chống chỉ định thì
 * dùng một bài là hỏng cả hồ sơ.
 */

export type ProgramCaseView = {
  id: string;
  clientProfile: string;
  targetTotalSets: number | null;
  targetLowerSets: number | null;
  targetUpperSets: number | null;
  targetCoreSets: number | null;
  tolerancePercent: number;
  requiredPatterns: string[];
  bannedExercises: string[];
};

const GROUP_LABEL: Record<string, string> = {
  LOWER: "Thân dưới",
  UPPER: "Thân trên",
  CORE: "Core",
  CARDIO: "Tim mạch",
  OTHER: "Khởi động / giãn cơ",
};

const GROUP_CLS: Record<string, string> = {
  LOWER: "bg-violet-50 text-violet-700",
  UPPER: "bg-sky-50 text-sky-700",
  CORE: "bg-amber-50 text-amber-700",
  CARDIO: "bg-rose-50 text-rose-700",
  OTHER: "bg-gray-100 text-gray-500",
};

export function ProgramRound({
  programCase,
  entries,
  onChange,
  disabled,
}: {
  programCase: ProgramCaseView;
  entries: ProgramEntry[];
  onChange: (next: ProgramEntry[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const totals = programTotals(entries);
  const have = programPatterns(entries);

  // Lọc trong 256 bài — chỉ hiện 20 kết quả đầu, dài hơn thì người ta cuộn chứ
  // không đọc, mà lại làm chậm máy yếu.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return EXAM_EXERCISES.filter(
      (e) => e.name.toLowerCase().includes(q) || e.pattern.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [query]);

  function addExercise(name: string) {
    if (disabled) return;
    if (entries.some((e) => e.exercise === name)) return;
    onChange([...entries, { exercise: name, sets: 3 }]);
    setQuery("");
  }

  function setSets(name: string, sets: number) {
    onChange(entries.map((e) => (e.exercise === name ? { ...e, sets } : e)));
  }

  function remove(name: string) {
    onChange(entries.filter((e) => e.exercise !== name));
  }

  const metrics: { key: "total" | "lower" | "upper" | "core"; target: number | null; actual: number }[] = [
    { key: "total", target: programCase.targetTotalSets, actual: totals.total },
    { key: "lower", target: programCase.targetLowerSets, actual: totals.lower },
    { key: "upper", target: programCase.targetUpperSets, actual: totals.upper },
    { key: "core", target: programCase.targetCoreSets, actual: totals.core },
  ];

  return (
    <div className="space-y-4">
      {/* ── Hồ sơ khách ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-gray-800">
          {programCase.clientProfile}
        </p>
      </div>

      {/* ── Chống chỉ định: to, rõ, không thể bỏ sót ───────────────────────── */}
      {programCase.bannedExercises.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <div className="flex items-center gap-1.5">
            <Ban className="h-4 w-4 text-red-500" />
            <p className="text-xs font-extrabold uppercase tracking-wide text-red-700">Chống chỉ định</p>
          </div>
          <p className="mt-1.5 text-sm font-bold leading-snug text-red-700">
            {programCase.bannedExercises.join(" · ")}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-red-600">
            Đưa một bài trong số này vào giáo án là hồ sơ mất trắng, dù các con số có đẹp tới đâu.
          </p>
        </div>
      )}

      {/* ── Chỉ tiêu ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.key} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {PROGRAM_METRIC_LABEL[m.key]}
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-gray-800">{m.actual}</p>
            <p className="text-[11px] font-semibold text-gray-400">
              {m.target == null ? "không chấm" : `chỉ tiêu ${m.target} ±${programCase.tolerancePercent}%`}
            </p>
          </div>
        ))}
      </div>

      {/* ── Mẫu vận động bắt buộc ──────────────────────────────────────────── */}
      {programCase.requiredPatterns.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Mẫu vận động bắt buộc
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {programCase.requiredPatterns.map((p) => (
              <span
                key={p}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-bold",
                  have.has(p) ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                )}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tìm bài tập ────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Tìm bài tập — gõ tên bài hoặc mẫu vận động (Squat, Hinge, Push…)"
          className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 disabled:bg-gray-50"
        />
        {matches.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
            {matches.map((e) => (
              <button
                key={e.name}
                type="button"
                onClick={() => addExercise(e.name)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-700">{e.name}</span>
                <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold", GROUP_CLS[e.group])}>
                  {e.pattern}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Giáo án đang dựng ──────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-8 text-center">
          <Dumbbell className="mx-auto h-7 w-7 text-gray-200" />
          <p className="mt-2 text-sm font-semibold text-gray-400">Chưa có bài nào trong giáo án</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => {
            const info = EXERCISE_BY_NAME.get(e.exercise);
            const isBanned = programCase.bannedExercises.some(
              (b) => b.trim().toLowerCase() === e.exercise.trim().toLowerCase()
            );
            return (
              <div
                key={e.exercise}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2",
                  isBanned ? "border-red-300 bg-red-50" : "border-gray-100 bg-white"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", isBanned ? "text-red-700" : "text-gray-700")}>
                    {e.exercise}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-400">
                    {info ? `${info.pattern} · ${GROUP_LABEL[info.group]}` : "không có trong danh mục"}
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={e.sets}
                  disabled={disabled}
                  onChange={(ev) => setSets(e.exercise, Math.max(1, Math.min(20, parseInt(ev.target.value) || 1)))}
                  className="h-9 w-16 shrink-0 rounded-lg border border-gray-200 px-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 disabled:bg-gray-50"
                />
                <span className="shrink-0 text-[11px] font-bold text-gray-400">set</span>
                <button
                  type="button"
                  onClick={() => remove(e.exercise)}
                  disabled={disabled}
                  className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
