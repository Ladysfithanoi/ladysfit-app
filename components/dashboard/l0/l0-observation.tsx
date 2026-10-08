"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, MessageCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  L0_ASSESSMENT_FIELDS,
  faultGuideFor,
  faultsBefore,
  type FaultHistory,
  type L0Assessment,
  type L0Day,
} from "@/lib/l0-program";

export type L0ObservationRow = {
  id: string;
  movementName: string;
  exerciseName: string;
  faults: number[];
};

const KIND_LABEL = {
  exercise: "Thư viện L0",
  finisher: "Finisher",
  general: "5 yếu tố chung",
} as const;

/**
 * Quan sát kỹ thuật trong buổi L0: PT tick lỗi theo bảng "5 lỗi thường gặp"
 * của từng bài (bài ngoài thư viện → 5 yếu tố chung). Buổi 1–3 chỉ ghi nhận,
 * KHÔNG nói với khách; Buổi 4 so với lỗi đã tick trước đó để Review.
 */
export function L0Observation({
  day,
  rows,
  onToggle,
  history,
  assessment,
  onAssessmentChange,
}: {
  day: L0Day;
  rows: L0ObservationRow[];
  onToggle: (rowId: string, fault: number) => void;
  /** Lỗi đã tick ở các buổi L0 TRƯỚC buổi này. */
  history: FaultHistory[];
  assessment: L0Assessment;
  onAssessmentChange: (next: L0Assessment) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const historyByKey = useMemo(() => new Map(history.map((h) => [h.guide.key, h])), [history]);

  const items = rows
    .map((row) => ({ row, guide: faultGuideFor(row.exerciseName, row.movementName) }))
    .filter((x): x is { row: L0ObservationRow; guide: NonNullable<typeof x.guide> } => x.guide != null);

  const ticked = rows.reduce((n, r) => n + r.faults.length, 0);

  // Buổi 4: lỗi cũ còn lặp lại, tính ngay trên những gì PT đang tick.
  let oldCount = 0;
  let recurred = 0;
  if (day === 4) {
    for (const { row, guide } of items) {
      const h = historyByKey.get(guide.key);
      if (!h) continue;
      const before = faultsBefore(h, 4);
      oldCount += before.length;
      recurred += before.filter((f) => row.faults.includes(f)).length;
    }
  }
  const todayKeys = new Set(items.map((x) => x.guide.key));
  const notToday = day === 4
    ? history.filter((h) => !todayKeys.has(h.guide.key) && faultsBefore(h, 4).length > 0)
    : [];

  return (
    <div className="rounded-xl border border-violet-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-violet-50/60 border-b border-violet-100 text-left"
      >
        <span className="min-w-0">
          <span className="block text-xs font-extrabold text-violet-800">
            Quan sát kỹ thuật — {day === 4 ? "Review Buổi 4" : day === 3 ? "Buổi tự tập" : "tick lỗi khi khách tập"}
          </span>
          <span className="block text-[11px] text-violet-600/80 mt-0.5">
            {day < 4
              ? `Đã tick ${ticked} lỗi · Chỉ ghi nhận, KHÔNG nói lỗi với khách ở buổi này`
              : oldCount > 0
                ? `Lỗi cũ còn lặp lại: ${recurred}/${oldCount} (${Math.round((recurred / oldCount) * 100)}%) · chỉ tiêu ≤ 20%`
                : "Tick lại lỗi còn gặp để đo tiến bộ so với 3 buổi trước"}
          </span>
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4 text-violet-400 shrink-0" /> : <ChevronUp className="w-4 h-4 text-violet-400 shrink-0" />}
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2.5">
          {items.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">
              Chưa có bài tập nào trong buổi — {day === 3 ? "khách soạn trên app rồi bấm \"Cập nhật bài tập theo chương trình\"." : "thêm bài vào giáo án trước."}
            </p>
          )}
          {items.map(({ row, guide }) => (
            <ExerciseCard
              key={row.id}
              day={day}
              row={row}
              guide={guide}
              history={historyByKey.get(guide.key) ?? null}
              onToggle={(f) => onToggle(row.id, f)}
            />
          ))}

          {notToday.length > 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                Bài đã học không có trong buổi hôm nay — lỗi đã ghi nhận
              </p>
              {notToday.map((h) => (
                <p key={h.guide.key} className="text-[11px] text-gray-600 leading-relaxed">
                  <span className="font-semibold">{h.guide.title}:</span>{" "}
                  {faultsBefore(h, 4).map((f) => h.guide.faults[f - 1]?.title).filter(Boolean).join(" · ")}
                </p>
              ))}
            </div>
          )}

          {day === 3 && (
            <div className="rounded-lg border border-violet-100 bg-violet-50/30 p-3 space-y-2">
              <p className="text-xs font-extrabold text-gray-800">Đánh giá nội bộ của PT</p>
              <p className="text-[11px] text-gray-500 -mt-1">Ghi lại để Review ở Buổi 4 — không phải nhận xét trực tiếp với khách.</p>
              {L0_ASSESSMENT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-0.5">
                  <label className="text-[11px] font-semibold text-gray-600">{f.label}</label>
                  <textarea
                    rows={2}
                    value={assessment[f.key]}
                    onChange={(e) => onAssessmentChange({ ...assessment, [f.key]: e.target.value })}
                    placeholder={f.hint}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none bg-white"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  day,
  row,
  guide,
  history,
  onToggle,
}: {
  day: L0Day;
  row: L0ObservationRow;
  guide: NonNullable<ReturnType<typeof faultGuideFor>>;
  history: FaultHistory | null;
  onToggle: (fault: number) => void;
}) {
  const [showTell, setShowTell] = useState(false);
  const ex = guide.exercise;
  const before = history && day > 1 ? faultsBefore(history, day) : [];
  const seenOn = (f: number) =>
    history
      ? ([1, 2, 3] as L0Day[]).filter((d) => d < day && (history.byDay[d] ?? []).includes(f))
      : [];

  // Gợi ý Review Buổi 4: lỗi cũ còn lặp → nhắc đúng 1 lỗi; không còn → khen.
  const stillOld = before.filter((f) => row.faults.includes(f));
  const fixedOld = before.filter((f) => !row.faults.includes(f));

  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-800 truncate">
            <span className="text-gray-400 font-semibold">{row.movementName} · </span>
            {row.exerciseName.replace(/\s*\(.*$/, "")}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {KIND_LABEL[guide.kind]}
            {guide.kind === "exercise" && <> · {guide.title}</>}
          </p>
        </div>
        {ex && (
          <button
            type="button"
            onClick={() => setShowTell((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md border border-violet-200 text-[10px] font-bold text-violet-700 hover:bg-violet-50"
          >
            {showTell ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            Tell · Show
          </button>
        )}
      </div>

      {ex && showTell && (
        <div className="mt-2 rounded-md bg-violet-50/50 border border-violet-100 px-2.5 py-2 space-y-1 text-[11px] text-gray-700 leading-relaxed">
          <p><span className="font-bold">Khớp:</span> {ex.joints}</p>
          <p><span className="font-bold">Nhóm cơ:</span> {ex.muscles}</p>
          <p><span className="font-bold">Mục đích:</span> {ex.purpose}</p>
          <p><span className="font-bold">Setup:</span> {ex.setup}</p>
          {ex.cues.map((c, i) => (
            <p key={c}><span className="font-bold">Lưu ý {i + 1}:</span> {c}</p>
          ))}
          <p className="text-[10px] italic text-gray-500">Làm mẫu 5+ reps chậm rãi. Không liệt kê lỗi ở bước Show.</p>
        </div>
      )}

      <div className="mt-2 space-y-1">
        {guide.faults.map((fault, i) => {
          const n = i + 1;
          const on = row.faults.includes(n);
          const seen = seenOn(n);
          const wasOld = before.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onToggle(n)}
              className={cn(
                "w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors border",
                on ? "border-red-200 bg-red-50" : "border-transparent hover:bg-gray-50"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  on ? "bg-red-500 border-red-500" : "border-gray-300 bg-white"
                )}
              >
                {on && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[11px] leading-snug", on ? "font-bold text-red-700" : "text-gray-700")}>
                  {n}. {fault.title}
                  {seen.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700 align-middle">
                      {seen.map((d) => `B${d}`).join(" ")}
                    </span>
                  )}
                  {day === 4 && wasOld && !on && (
                    <span className="ml-1 inline-flex items-center rounded bg-green-100 px-1 text-[9px] font-bold text-green-700 align-middle">
                      đã sửa
                    </span>
                  )}
                </span>
                {(on || (day === 4 && wasOld)) && (
                  <span className="block text-[10px] text-gray-500 leading-snug mt-0.5">→ Sửa: {fault.fix}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {day === 4 && before.length > 0 && (
        <div className="mt-2 rounded-md bg-violet-50/60 border border-violet-100 px-2.5 py-1.5">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-600">
            <MessageCircle className="w-3 h-3" />
            Gợi ý Review bài này
          </p>
          {fixedOld.length > 0 && (
            <p className="text-[11px] text-gray-700 leading-snug">
              Khen: đã sửa được &quot;{guide.faults[fixedOld[0] - 1]?.title}&quot;.
            </p>
          )}
          {stillOld.length > 0 ? (
            <p className="text-[11px] text-gray-700 leading-snug">
              Góp ý đúng 1 lỗi: &quot;{guide.faults[stillOld[0] - 1]?.title}&quot; — {guide.faults[stillOld[0] - 1]?.fix}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-[11px] text-green-700 leading-snug">
              <RotateCcw className="w-3 h-3" /> Lỗi cũ không còn lặp lại — chốt bằng một câu khích lệ.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
