"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  History,
  ArrowLeft,
  Check,
  XCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  EyeOff,
  Lock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format-date";
import { QuestionMedia } from "./question-media";

/**
 * ── Xem lại bài thi cũ ───────────────────────────────────────────────────────
 *
 * Nhân sự tự mở lịch sử thi của CHÍNH MÌNH: danh sách có bộ lọc và phân trang,
 * bấm vào một bài thì mở ra đúng đề đã làm kèm đáp án mình đã chọn.
 *
 * Chỉ xem, không sửa: ô đáp án ở đây là thẻ tĩnh chứ không phải nút bấm, và
 * cũng không có đường nào gửi dữ liệu đi. Bài đã nộp là đã chốt.
 *
 * Có chủ đích: KHÔNG hiện đáp án đúng, chỉ đánh dấu câu mình làm đúng hay sai.
 * Ngân hàng câu hỏi dùng lại cho các kỳ sau nên lộ đáp án ra đây là biến bài
 * thi thăng cấp thành bài chép — xem app/api/exam/my-attempts/[id].
 */

const OPTIONS = ["A", "B", "C", "D"] as const;

type AttemptRow = {
  id: string;
  score: number;
  total: number;
  scorePct: number;
  passed: boolean;
  createdAt: string;
  violations: number;
};

type ListData = {
  attempts: AttemptRow[];
  page: number;
  totalPages: number;
  total: number;
  grandTotal: number;
  years: number[];
  passingScore: number;
};

type DetailItem = {
  id: string;
  index: number;
  missing: boolean;
  chosen: string;
  isCorrect: boolean;
  question?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

type DetailData = {
  id: string;
  score: number;
  total: number;
  scorePct: number;
  passed: boolean;
  createdAt: string;
  violations: number;
  passingScore: number;
  items: DetailItem[];
};

type ResultFilter = "all" | "passed" | "failed";

const RESULT_TABS: { key: ResultFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "passed", label: "Đạt" },
  { key: "failed", label: "Chưa đạt" },
];

/** Dải điểm gọn dùng chung cho đầu danh sách và đầu bài chi tiết. */
function ScoreBadge({ passed, scorePct }: { passed: boolean; scorePct: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
      )}
    >
      {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {passed ? "Đạt" : "Chưa đạt"} · {scorePct}%
    </span>
  );
}

// ─── Một câu trong bài đã nộp (chỉ xem) ──────────────────────────────────────

function ReviewQuestion({ item }: { item: DetailItem }) {
  if (item.missing) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-400">
          Câu {item.index}. Câu hỏi này đã bị xoá khỏi ngân hàng sau kỳ thi nên không hiện lại
          được nội dung.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold",
            item.isCorrect ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
          )}
        >
          {item.isCorrect ? (
            <CheckCircle className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          Câu {item.index} — {item.isCorrect ? "đúng" : item.chosen ? "sai" : "bỏ trống"}
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-800">
        <span className="mr-1.5 font-extrabold text-[#f15b5c]">Câu {item.index}.</span>
        {item.question}
      </p>

      <QuestionMedia imageUrl={item.imageUrl} videoUrl={item.videoUrl} />

      <div className="mt-3 space-y-2">
        {OPTIONS.map((opt) => {
          const value = item[`option${opt}` as keyof DetailItem] as string;
          const picked = item.chosen === opt;
          return (
            // Thẻ tĩnh, không phải nút — bài đã nộp thì không đổi đáp án được nữa.
            <div
              key={opt}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium",
                picked
                  ? item.isCorrect
                    ? "border-2 border-emerald-400 bg-emerald-50 text-gray-800"
                    : "border-2 border-red-300 bg-red-50 text-gray-800"
                  : "border border-gray-200 bg-gray-50 text-gray-500"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  picked
                    ? item.isCorrect
                      ? "bg-emerald-500 text-white"
                      : "bg-red-400 text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {opt}
              </span>
              {value}
              {picked && (
                <span className="ml-auto shrink-0 text-[11px] font-bold text-gray-500">
                  Bạn đã chọn
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function ExamHistoryModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<ListData | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ResultFilter>("all");
  const [year, setYear] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), result });
      if (year) qs.set("year", year);
      const res = await fetch(`/api/exam/my-attempts?${qs.toString()}`);
      if (!res.ok) {
        setError("Không tải được lịch sử thi");
        return;
      }
      const data: ListData = await res.json();
      setList(data);
      // Server kéo về trang cuối khi bộ lọc thu hẹp kết quả — theo cho khớp.
      if (data.page !== page) setPage(data.page);
    } catch {
      setError("Không tải được lịch sử thi");
    } finally {
      setListLoading(false);
    }
  }, [page, result, year]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!detailId) return;
    let alive = true;
    setDetailLoading(true);
    setDetail(null);
    fetch(`/api/exam/my-attempts/${detailId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        if (data) setDetail(data);
        else setError("Không mở được bài thi này");
      })
      .catch(() => alive && setError("Không mở được bài thi này"))
      .finally(() => alive && setDetailLoading(false));
    return () => {
      alive = false;
    };
  }, [detailId]);

  function changeFilter(next: Partial<{ result: ResultFilter; year: string }>) {
    if (next.result !== undefined) setResult(next.result);
    if (next.year !== undefined) setYear(next.year);
    setPage(1);
  }

  const inDetail = detailId !== null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="pointer-events-auto flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white font-sans shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b border-gray-100 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              {inDetail && (
                <button
                  onClick={() => {
                    setDetailId(null);
                    setDetail(null);
                  }}
                  aria-label="Quay lại danh sách"
                  className="mt-0.5 shrink-0 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base font-extrabold text-gray-900">
                  {!inDetail && <History className="h-4 w-4 text-[#f15b5c]" />}
                  {inDetail ? "Bài thi đã nộp" : "Xem lại bài thi cũ"}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-gray-400">
                  {inDetail && detail
                    ? fmtDateTime(new Date(detail.createdAt))
                    : list
                      ? `${list.grandTotal} bài thi đã làm`
                      : "Đang tải..."}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="mt-0.5 shrink-0 rounded-xl p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            {error && (
              <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}

            {/* ── Danh sách ── */}
            {!inDetail && (
              <>
                <div className="mb-4 space-y-2.5">
                  <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                    {RESULT_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => changeFilter({ result: tab.key })}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                          result === tab.key
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {list && list.years.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <select
                        value={year}
                        onChange={(e) => changeFilter({ year: e.target.value })}
                        className="h-9 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                      >
                        <option value="">Tất cả các năm</option>
                        {list.years.map((y) => (
                          <option key={y} value={String(y)}>
                            Năm {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {listLoading ? (
                  <p className="py-12 text-center text-sm font-semibold text-gray-300">
                    Đang tải...
                  </p>
                ) : !list || list.attempts.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <FileText className="h-8 w-8 text-gray-200" />
                    <p className="text-sm font-semibold text-gray-300">
                      {list && list.grandTotal === 0
                        ? "Bạn chưa làm bài thi nào"
                        : "Không có bài thi nào khớp bộ lọc"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {list.attempts.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setDetailId(a.id)}
                        className="w-full rounded-2xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-[#f15b5c] hover:bg-[#fff5f5] hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-gray-900">
                              {fmtDateTime(new Date(a.createdAt))}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-gray-500">
                              Đúng {a.score}/{a.total} câu · điểm đạt {list.passingScore}%
                            </p>
                            {a.violations > 0 && (
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-red-500">
                                <EyeOff className="h-3 w-3" />
                                Rời trang thi {a.violations} lần
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <ScoreBadge passed={a.passed} scorePct={a.scorePct} />
                            <span className="text-[11px] font-bold text-gray-400">
                              Xem lại →
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Chi tiết một bài ── */}
            {inDetail && (
              <>
                {detailLoading ? (
                  <p className="py-12 text-center text-sm font-semibold text-gray-300">
                    Đang mở bài thi...
                  </p>
                ) : detail ? (
                  <>
                    <div
                      className={cn(
                        "mb-4 rounded-2xl border px-4 py-3",
                        detail.passed
                          ? "border-emerald-100 bg-emerald-50"
                          : "border-red-100 bg-red-50"
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p
                          className={cn(
                            "text-sm font-extrabold",
                            detail.passed ? "text-emerald-700" : "text-red-600"
                          )}
                        >
                          {detail.scorePct}% — đúng {detail.score}/{detail.total} câu
                          <span className="font-semibold text-gray-500">
                            {" "}
                            (điểm đạt {detail.passingScore}%)
                          </span>
                        </p>
                        <ScoreBadge passed={detail.passed} scorePct={detail.scorePct} />
                      </div>
                      {detail.violations > 0 && (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-500">
                          <EyeOff className="h-3.5 w-3.5" />
                          Rời trang thi {detail.violations} lần trong lúc làm bài
                        </p>
                      )}
                    </div>

                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5">
                      <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <p className="text-xs font-semibold leading-snug text-gray-500">
                        Bài đã nộp — chỉ xem lại, không sửa được đáp án. Hệ thống đánh dấu câu
                        bạn làm đúng và làm sai, nhưng không hiện đáp án đúng vì ngân hàng câu
                        hỏi còn dùng cho các kỳ thi sau.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {detail.items.map((item) => (
                        <ReviewQuestion key={`${item.id}-${item.index}`} item={item} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm font-semibold text-gray-300">
                    Không mở được bài thi này
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer — phân trang chỉ có ở màn danh sách */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-5 py-3.5 sm:px-6">
            {!inDetail && list && list.totalPages > 1 ? (
              <>
                <span className="text-xs font-semibold text-gray-400">
                  Trang {list.page}/{list.totalPages} · {list.total} bài
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={list.page <= 1}
                    aria-label="Trang trước"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(list.totalPages, p + 1))}
                    disabled={list.page >= list.totalPages}
                    aria-label="Trang sau"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <span className="text-xs font-semibold text-gray-400">
                {inDetail ? "Chỉ xem lại, không chỉnh sửa được" : ""}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Nút "Xem lại" đặt trong thẻ cấp độ ở trang Tổng quan. */
export function ExamHistoryLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 underline-offset-2 transition-colors hover:text-[#f15b5c] hover:underline",
          className
        )}
      >
        <History className="h-3.5 w-3.5" />
        Xem lại bài thi cũ
      </button>
      {open && <ExamHistoryModal onClose={() => setOpen(false)} />}
    </>
  );
}
