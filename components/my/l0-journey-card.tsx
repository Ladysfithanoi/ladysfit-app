"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, CheckCircle2, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format-date";
import { L0_DAYS, L0_GLOSSARY, type L0Day } from "@/lib/l0-program";
import { BottomSheet } from "./bottom-sheet";

type DesignExercise = { name: string; sets: number; reps: string; load: string };

type L0Data = {
  programStatus: "ACTIVE" | "ARCHIVED";
  days: { day: L0Day; done: boolean; inProgress: boolean; date: string | null }[];
  design: { sessionId: string; exercises: DesignExercise[] } | null;
  /** Danh sách bài cố định của gói L0 — khách chỉ chọn trong đây. */
  choices: string[];
  summary: {
    faultsDay1: number | null;
    faultsDay4: number | null;
    exercises: { key: string; title: string; fixed: string[]; remaining: { title: string; fix: string }[] }[];
  } | null;
} | null;

const CLIENT_TAGLINE: Record<L0Day, string> = {
  1: "Học 5 bài nền tảng đầu tiên",
  2: "Học thêm 5 bài mới, cảm nhận cơ rõ hơn",
  3: "Chị tự thiết kế và tự tập — PT quan sát",
  4: "Buổi tập hoàn chỉnh cùng PT + tổng kết tiến bộ",
};

/**
 * Lộ trình Khởi động (L0) trên app khách: tiến độ 4 buổi, soạn buổi tự tập
 * (Buổi 3) và — chỉ sau Buổi 4 — bản tổng kết lỗi kỹ thuật đã sửa / còn cần
 * lưu ý. Buổi 1–3 không hiện lỗi: PT chỉ ghi nhận, dồn Review vào Buổi 4.
 */
export function L0JourneyCard() {
  const [data, setData] = useState<L0Data>(null);
  const [designOpen, setDesignOpen] = useState(false);

  function load() {
    fetch("/api/my/l0")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: L0Data) => setData(d))
      .catch(() => {});
  }
  useEffect(load, []);

  if (!data) return null;
  if (data.programStatus !== "ACTIVE" && !data.summary) return null;

  const allDone = data.days.every((d) => d.done);
  const nextDay = data.days.find((d) => !d.done)?.day ?? null;
  const canDesign = !!data.design && !data.days.find((d) => d.day === 3)?.done;

  return (
    <div className="bg-white rounded-3xl p-5 border border-violet-100 shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <p className="text-sm font-extrabold text-gray-800">Lộ trình Khởi động · 4 buổi</p>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {allDone ? "Chị đã hoàn thành trọn vẹn 4 buổi 🎉" : nextDay ? `Tiếp theo: Buổi ${nextDay} — ${CLIENT_TAGLINE[nextDay]}` : ""}
      </p>

      {/* Tiến độ 4 buổi */}
      <div className="flex items-start">
        {data.days.map((d, i) => (
          <div key={d.day} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div className={cn("absolute top-3.5 right-1/2 w-full h-0.5", d.done || d.inProgress ? "bg-violet-300" : "bg-gray-100")} />
            )}
            <div
              className={cn(
                "relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold",
                d.done ? "bg-violet-500 text-white" : d.inProgress ? "bg-violet-100 text-violet-600 ring-2 ring-violet-300" : "bg-gray-100 text-gray-400"
              )}
            >
              {d.done ? <Check className="w-4 h-4" /> : d.day}
            </div>
            <p className={cn("text-[10px] font-bold mt-1", d.done ? "text-violet-600" : "text-gray-400")}>Buổi {d.day}</p>
            <p className="text-[9px] text-gray-300 h-3">{d.date ? fmtDate(d.date).slice(0, 5) : ""}</p>
          </div>
        ))}
      </div>

      {canDesign && (
        <button
          onClick={() => setDesignOpen(true)}
          className="w-full mt-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border-2 border-violet-300 text-violet-700 bg-violet-50/50"
        >
          <Pencil className="w-4 h-4" />
          {data.design!.exercises.length > 0 ? `Sửa buổi tự tập (${data.design!.exercises.length} bài)` : "Soạn buổi tự tập (Buổi 3)"}
        </button>
      )}

      {!data.summary && (
        <p className="mt-4 text-[11px] text-gray-400 leading-relaxed bg-gray-50 rounded-2xl px-3.5 py-2.5">
          PT đang ghi nhận tiến bộ kỹ thuật của chị qua từng buổi. Sau Buổi 4, chị sẽ nhận bản tổng kết:
          những lỗi đã sửa được và lưu ý riêng để tự tập đúng.
        </p>
      )}

      {data.summary && <Summary summary={data.summary} />}

      {designOpen && data.design && (
        <DesignSheet
          sessionId={data.design.sessionId}
          initial={data.design.exercises}
          choices={data.choices}
          onClose={() => setDesignOpen(false)}
          onSaved={() => { setDesignOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function Summary({ summary }: { summary: NonNullable<NonNullable<L0Data>["summary"]> }) {
  const { faultsDay1, faultsDay4 } = summary;
  return (
    <div className="mt-4 space-y-3">
      {faultsDay1 != null && faultsDay4 != null && (
        <div className="rounded-2xl bg-violet-50 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Lỗi kỹ thuật</p>
            <p className="text-xs text-gray-500">Buổi 1 → Buổi 4</p>
          </div>
          <p className="text-2xl font-black text-violet-700">
            {faultsDay1} <span className="text-violet-300">→</span> {faultsDay4}
          </p>
        </div>
      )}
      {summary.exercises.length === 0 ? (
        <p className="text-xs text-gray-500 text-center">Chị thực hiện đúng kỹ thuật ở mọi bài — tuyệt vời! 🌟</p>
      ) : (
        <div>
          <p className="text-xs font-extrabold text-gray-700 mb-2">Bản lưu ý cá nhân của chị</p>
          <div className="space-y-2">
            {summary.exercises.map((e) => (
              <div key={e.key} className="rounded-2xl border border-gray-100 px-3.5 py-2.5">
                <p className="text-xs font-bold text-gray-800">{e.title}</p>
                {e.fixed.map((f) => (
                  <p key={f} className="flex items-start gap-1.5 text-[11px] text-emerald-600 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" /> Đã sửa: {f}
                  </p>
                ))}
                {e.remaining.map((r) => (
                  <p key={r.title} className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                    <span className="font-semibold text-amber-600">Lưu ý:</span> {r.title}
                    <span className="block text-gray-400">→ {r.fix}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DesignSheet({
  sessionId,
  initial,
  choices,
  onClose,
  onSaved,
}: {
  sessionId: string;
  initial: DesignExercise[];
  choices: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<DesignExercise[]>(
    initial.length > 0 ? initial : [{ name: "", sets: 3, reps: "12-15", load: "" }]
  );
  const [showGlossary, setShowGlossary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (i: number, patch: Partial<DesignExercise>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/my/l0", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, exercises: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Buổi 3 — chị tự thiết kế">
      <div className="space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          {L0_DAYS[3].purpose} Chị chọn bài trong danh sách bài của lộ trình L0, tự sắp thứ tự và số set/rep theo cách của mình — không có đáp án &quot;đúng duy nhất&quot;.
        </p>
        <button
          type="button"
          onClick={() => setShowGlossary((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600"
        >
          <BookOpen className="w-3.5 h-3.5" />
          {showGlossary ? "Ẩn giải thích thuật ngữ" : "Đọc giải thích thuật ngữ trước khi soạn"}
        </button>
        {showGlossary && (
          <div className="rounded-2xl bg-violet-50/60 px-3.5 py-2.5 space-y-1.5">
            {L0_GLOSSARY.map((g) => (
              <p key={g.term} className="text-[11px] text-gray-600 leading-relaxed">
                <span className="font-bold text-violet-700">{g.term}:</span> {g.meaning}
              </p>
            ))}
          </div>
        )}


        {rows.map((r, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-violet-600 w-5">{i + 1}.</span>
              <select
                value={r.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="flex-1 min-w-0 h-9 rounded-xl border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="">— Chọn bài tập —</option>
                {r.name && !choices.includes(r.name) && (
                  <option value={r.name} disabled>{r.name} (không có trong danh sách)</option>
                )}
                {choices.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                disabled={rows.length === 1}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 disabled:opacity-30"
                aria-label="Xoá bài"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 pl-7">
              <label className="text-[10px] font-bold text-gray-400">
                Số set
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={r.sets}
                  onChange={(e) => update(i, { sets: Number(e.target.value) })}
                  className="mt-0.5 w-full h-8 rounded-lg border border-gray-200 px-2 text-sm text-gray-700"
                />
              </label>
              <label className="text-[10px] font-bold text-gray-400">
                Số rep
                <input
                  value={r.reps}
                  onChange={(e) => update(i, { reps: e.target.value })}
                  placeholder="12-15"
                  className="mt-0.5 w-full h-8 rounded-lg border border-gray-200 px-2 text-sm text-gray-700"
                />
              </label>
              <label className="text-[10px] font-bold text-gray-400">
                Mức tạ
                <input
                  value={r.load}
                  onChange={(e) => update(i, { load: e.target.value })}
                  placeholder="VD: 4kg"
                  className="mt-0.5 w-full h-8 rounded-lg border border-gray-200 px-2 text-sm text-gray-700"
                />
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { name: "", sets: 3, reps: "12-15", load: "" }])}
          disabled={rows.length >= 12}
          className="w-full py-2.5 rounded-2xl border border-dashed border-violet-200 text-sm font-bold text-violet-600 flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Thêm bài
        </button>

        {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}
        <button
          onClick={save}
          disabled={saving || rows.every((r) => !r.name.trim())}
          className="w-full py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ backgroundColor: "#f15b5c" }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Lưu buổi tự tập
        </button>
      </div>
    </BottomSheet>
  );
}
