"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, X, ClipboardCheck, Plus, Trash2, ChevronUp, Loader2, Award, Search } from "lucide-react";
import {
  FIXED_SECTIONS,
  PER_EXERCISE_SECTIONS,
  SCORE_OPTIONS,
  DEFAULT_EXERCISES_COUNT,
  maxScoreFor,
  totalScoreOf,
  isComplete,
  type PracticalScores,
  type PracticalExercise,
} from "@/lib/practical-rubric";

type Condition = { key: string; label: string; ok: boolean; detail: string };
type Branch = { id: string; name: string };
type Row = {
  ptId: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  levelName: string | null;
  levelColor: string | null;
  nextLevelName: string | null;
  nextLevelId: string | null;
  conditions: Condition[];
  eligible: boolean;
  lastPractical: { passed: boolean; totalScore: number; maxScore: number; createdAt: string } | null;
};
type OverviewData = { rows: Row[]; branches: Branch[]; passPercent: number; enableLevelSystem: boolean };

const PAGE_SIZE = 8;

function emptyExercises(n: number): PracticalExercise[] {
  return Array.from({ length: n }, () => ({ name: "", scores: {} }));
}

function ScoreButtons({
  value,
  onChange,
  levels,
}: {
  value?: number;
  onChange: (v: number) => void;
  levels: [string, string, string];
}) {
  return (
    <div className="flex gap-1.5">
      {SCORE_OPTIONS.map((s, i) => (
        <button
          key={s}
          type="button"
          title={levels[i]}
          onClick={() => onChange(s)}
          className={cn(
            "w-9 h-9 rounded-lg text-sm font-bold border transition-colors",
            value === s
              ? s === 5
                ? "bg-emerald-500 text-white border-emerald-500"
                : s === 3
                  ? "bg-amber-400 text-white border-amber-400"
                  : "bg-rose-400 text-white border-rose-400"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function CriterionRow({
  code,
  name,
  levels,
  value,
  onChange,
}: {
  code: string;
  name: string;
  levels: [string, string, string];
  value?: number;
  onChange: (v: number) => void;
}) {
  const desc = value === 1 ? levels[0] : value === 3 ? levels[1] : value === 5 ? levels[2] : "";
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          <span className="text-gray-400 mr-1.5">{code}</span>
          {name}
        </p>
        {desc && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{desc}</p>}
      </div>
      <ScoreButtons value={value} onChange={onChange} levels={levels} />
    </div>
  );
}

export function PracticalPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);

  // Filters
  const [branchFilter, setBranchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Scoring modal state
  const [scoring, setScoring] = useState<Row | null>(null);
  const [fixedScores, setFixedScores] = useState<PracticalScores>({});
  const [exercises, setExercises] = useState<PracticalExercise[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/practical");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Lọc theo cơ sở + tìm theo tên + phân trang ──────────────────────────
  const allRows = data?.rows ?? [];
  const branches = data?.branches ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      const matchBranch = !branchFilter || r.branchId === branchFilter;
      const matchSearch = !q || r.name.toLowerCase().includes(q);
      return matchBranch && matchSearch;
    });
  }, [allRows, branchFilter, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, branchFilter]);

  function openScoring(row: Row) {
    setScoring(row);
    setFixedScores({});
    setExercises(emptyExercises(DEFAULT_EXERCISES_COUNT));
    setNotes("");
    setError("");
  }
  function closeScoring() { setScoring(null); }

  const total = useMemo(() => totalScoreOf(fixedScores, exercises), [fixedScores, exercises]);
  const max = useMemo(() => maxScoreFor(exercises.length), [exercises.length]);
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const passPercent = data?.passPercent ?? 70;
  const complete = isComplete(fixedScores, exercises);
  const wouldPass = complete && pct >= passPercent;

  function setFixed(code: string, v: number) {
    setFixedScores((s) => ({ ...s, [code]: v }));
  }
  function setExerciseScore(idx: number, code: string, v: number) {
    setExercises((exs) => exs.map((ex, i) => (i === idx ? { ...ex, scores: { ...ex.scores, [code]: v } } : ex)));
  }
  function setExerciseName(idx: number, name: string) {
    setExercises((exs) => exs.map((ex, i) => (i === idx ? { ...ex, name } : ex)));
  }
  function addExercise() { setExercises((exs) => [...exs, { name: "", scores: {} }]); }
  function removeExercise(idx: number) { setExercises((exs) => exs.filter((_, i) => i !== idx)); }

  async function submitScoring() {
    if (!scoring) return;
    if (!complete) { setError("Vui lòng chấm đủ tất cả tiêu chí và các bài tập."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/practical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ptId: scoring.ptId, exercises, scores: fixedScores, notes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Có lỗi xảy ra");
      setToast(
        `Đã lưu: ${d.totalScore}/${d.maxScore} (${Math.round((d.totalScore / d.maxScore) * 100)}%) — ${d.passed ? "ĐẠT" : "CHƯA ĐẠT"}${d.promoted ? " • Đã tự thăng hạng!" : ""}`
      );
      setTimeout(() => setToast(""), 5000);
      closeScoring();
      fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function manualPromote(row: Row) {
    if (!row.nextLevelId) return;
    if (!confirm(`Thăng ${row.name} lên cấp ${row.nextLevelName}? (Thủ công — bỏ qua điều kiện)`)) return;
    setPromoting(row.ptId);
    try {
      const res = await fetch("/api/practical/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ptId: row.ptId }),
      });
      const d = await res.json();
      if (res.ok) {
        setToast(`Đã thăng ${row.name} lên ${d.newLevelName}`);
        setTimeout(() => setToast(""), 4000);
        fetchData();
      } else {
        setToast(d.error ?? "Không thăng được");
        setTimeout(() => setToast(""), 4000);
      }
    } finally {
      setPromoting(null);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">Đang tải...</div>;
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg max-w-sm">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl font-extrabold text-gray-900">Kiểm tra thực hành & Thăng hạng</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Chấm buổi dạy mẫu theo rubric. PT được thăng hạng khi đủ cả 4 điều kiện: lý thuyết · thực hành · doanh số · transform. Điểm đạt thực hành: {passPercent}%.
        </p>
      </div>

      {data && !data.enableLevelSystem && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-semibold">
          Hệ thống phân cấp độ đang tắt — sẽ không có tự động thăng hạng.
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {branches.length > 1 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 min-w-[180px]"
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo tên nhân sự..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white"
          />
        </div>
        <p className="text-xs text-gray-400 font-semibold">
          Hiển thị <span className="text-gray-700">{filtered.length}</span> / <span className="text-gray-700">{allRows.length}</span> nhân sự
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["PT", "Cơ sở", "Cấp hiện tại", "Lý thuyết", "Thực hành", "Doanh số", "Transform", "Thăng lên", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => {
                const cond = (k: string) => row.conditions.find((c) => c.key === k);
                return (
                  <tr key={row.ptId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                      {row.lastPractical && (
                        <p className="text-[11px] text-gray-400">
                          TH gần nhất: {row.lastPractical.totalScore}/{row.lastPractical.maxScore} · {row.lastPractical.passed ? "Đạt" : "Chưa đạt"}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{row.branchName ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.levelName ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: (row.levelColor || "#6b7280") + "22", color: row.levelColor || "#6b7280" }}>
                          {row.levelName}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    {(["exam", "practical", "revenue", "transform"] as const).map((k) => {
                      const c = cond(k);
                      return (
                        <td key={k} className="px-4 py-3" title={c?.detail}>
                          {c?.ok ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><Check className="w-3.5 h-3.5" /> Đạt</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-500"><X className="w-3.5 h-3.5" /> {c?.detail ?? "Chưa"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      {row.nextLevelName ? (
                        <span className={cn("text-xs font-bold", row.eligible ? "text-emerald-600" : "text-gray-400")}>
                          {row.eligible && <Award className="inline w-3.5 h-3.5 mr-1" />}
                          {row.nextLevelName}
                        </span>
                      ) : <span className="text-xs text-gray-300">Kịch trần</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openScoring(row)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#f15b5c] px-2.5 py-1.5 rounded-lg hover:opacity-90"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" /> Chấm
                        </button>
                        {row.nextLevelId && (
                          <button
                            onClick={() => manualPromote(row)}
                            disabled={promoting === row.ptId}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {promoting === row.ptId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronUp className="w-3.5 h-3.5" />} Thăng tay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-300">
                  {allRows.length === 0 ? "Chưa có PT nào" : "Không tìm thấy nhân sự phù hợp"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 font-semibold">
            Trang <span className="text-gray-700">{currentPage}</span> / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 px-3 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "h-8 min-w-8 px-2.5 rounded-lg text-xs font-bold border",
                  p === currentPage ? "bg-[#f15b5c] text-white border-[#f15b5c]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 px-3 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* Scoring modal */}
      {scoring && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeScoring} />
          <div className="relative bg-gray-50 w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-base font-extrabold text-gray-900">Chấm thực hành — {scoring.name}</p>
                <p className="text-xs text-gray-400">{scoring.levelName ?? "Chưa có cấp độ"}</p>
              </div>
              <button onClick={closeScoring} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Fixed sections */}
              {FIXED_SECTIONS.map((section) => (
                <div key={section.code} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-sm font-extrabold text-gray-800 mb-2">{section.code}. {section.title}</p>
                  {section.criteria.map((c) => (
                    <CriterionRow
                      key={c.code}
                      code={c.code}
                      name={c.name}
                      levels={c.levels}
                      value={fixedScores[c.code]}
                      onChange={(v) => setFixed(c.code, v)}
                    />
                  ))}
                </div>
              ))}

              {/* Per-exercise sections */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-gray-800">Bài tập ({exercises.length})</p>
                  <button onClick={addExercise} className="inline-flex items-center gap-1 text-xs font-bold text-[#f15b5c]">
                    <Plus className="w-3.5 h-3.5" /> Thêm bài
                  </button>
                </div>
                {exercises.map((ex, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-[#f15b5c]/10 text-[#f15b5c] text-xs font-extrabold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                      <input
                        value={ex.name}
                        onChange={(e) => setExerciseName(idx, e.target.value)}
                        placeholder={`Tên bài tập ${idx + 1}`}
                        className="flex-1 h-9 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                      />
                      {exercises.length > 1 && (
                        <button onClick={() => removeExercise(idx)} className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    {PER_EXERCISE_SECTIONS.map((section) => (
                      <div key={section.code} className="mt-2">
                        <p className="text-xs font-bold text-gray-500 mb-1">{section.code}. {section.title}</p>
                        {section.criteria.map((c) => (
                          <CriterionRow
                            key={c.code}
                            code={c.code}
                            name={c.name}
                            levels={c.levels}
                            value={ex.scores[c.code]}
                            onChange={(v) => setExerciseScore(idx, c.code, v)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-bold text-gray-700 mb-1.5">Ghi chú</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Nhận xét chung, điểm cần cải thiện..."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
              </div>

              {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-[#f15b5c] font-semibold">{error}</div>}
            </div>

            {/* Footer summary + submit */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-extrabold text-gray-900">{total}/{max}</span>
                <span className={cn("ml-2 font-bold", wouldPass ? "text-emerald-600" : "text-gray-400")}>
                  {pct}% {complete ? (wouldPass ? "· ĐẠT" : "· CHƯA ĐẠT") : `(cần chấm đủ)`}
                </span>
              </div>
              <button
                onClick={submitScoring}
                disabled={saving || !complete}
                className="h-10 px-5 rounded-xl text-white font-bold text-sm bg-[#f15b5c] hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu kết quả"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
