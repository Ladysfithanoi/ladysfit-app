"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  Send,
  CalendarClock,
  FlaskConical,
  ListChecks,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionMedia } from "./question-media";
import { QuestionPreview } from "./question-preview";

type Question = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

type ExamResult = {
  scorePct: number;
  correctCount: number;
  total: number;
  passed: boolean;
  promoted: boolean;
};

const OPTIONS = ["A", "B", "C", "D"] as const;

/**
 * Trang làm bài. `mock` = Admin thi thử: cùng một giao diện, cùng cách bốc đề,
 * nhưng chấm qua /api/exam/mock-grade nên không ghi vào lịch sử thi và không
 * đụng tới cấp độ PT — và chấm xong thì soi lại được từng câu kèm đáp án đúng.
 */
export function ExamTakePage({ mock = false }: { mock?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passingScore, setPassingScore] = useState(80);
  const [scheduleNote, setScheduleNote] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<ExamResult | null>(null);
  // Đáp án đúng từng câu — chỉ có ở bài thi thử, để soi lại đề sau khi chấm.
  const [correctById, setCorrectById] = useState<Record<string, string>>({});
  // Nộp xong thì điểm hiện trong hộp thoại giữa màn hình, không đẩy người thi
  // lên đầu trang rồi bắt kéo xuống tìm.
  const [showResultModal, setShowResultModal] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Bảng theo dõi câu hỏi bấm vào là nhảy tới đúng thẻ câu đó.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    async function loadExam() {
      try {
        const res = await fetch(`/api/exam/take${mock ? "?mock=1" : ""}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Không thể tải đề thi");
          return;
        }
        const data = await res.json();
        setQuestions(data.questions);
        setPassingScore(data.passingScore);
        setScheduleNote(data.scheduleNote ?? "");
      } catch {
        setError("Có lỗi xảy ra khi tải đề thi");
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [mock]);

  async function handleSubmit() {
    if (Object.keys(answers).length < questions.length) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(mock ? "/api/exam/mock-grade" : "/api/exam/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error ?? "Không nộp được bài. Vui lòng thử lại.");
      } else {
        const data = await res.json();
        setCorrectById(data.correctById ?? {});
        setResult({
          scorePct: data.scorePct,
          correctCount: data.correctCount,
          total: data.total,
          passed: data.passed,
          promoted: !!data.promoted,
        });
        setShowResultModal(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function goToQuestion(id: string) {
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const exitPath = mock ? "/dashboard/exam" : "/dashboard";
  // Chỉ bài thi thử mới có đáp án đúng để soi lại; bài thi thật không bao giờ
  // trả về đáp án nên cũng không có gì để xem lại.
  const canReview = Object.keys(correctById).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-gray-400 font-semibold">Đang tải đề thi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="bg-red-50 border border-red-100 rounded-2xl px-6 py-8 text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-base font-bold text-red-600">{error}</p>
          <button
            onClick={() => router.push(exitPath)}
            className="mt-5 flex items-center gap-2 mx-auto text-sm font-semibold text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            {mock ? "Thi thử — Bài kiểm tra thăng cấp" : "Bài kiểm tra thăng cấp"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">
            Điểm đạt: {passingScore}% — {questions.length} câu hỏi
          </p>
        </div>
        {!result && (
          <div className="text-right">
            <p className="text-sm font-bold text-gray-700">{answeredCount}/{questions.length}</p>
            <p className="text-xs text-gray-400">đã trả lời</p>
          </div>
        )}
      </div>

      {mock && !result && (
        <div className="flex items-start gap-2 px-4 py-2.5 mb-4 rounded-xl bg-violet-50 border border-violet-100">
          <FlaskConical className="w-4 h-4 text-violet-500 shrink-0 mt-px" />
          <p className="text-xs font-semibold text-violet-700 leading-snug">
            Bài thi thử: đề bốc đúng như thi thật, chấm đúng công thức thật, nhưng kết quả
            không lưu vào lịch sử thi và không ảnh hưởng cấp độ của ai. Nộp xong sẽ soi lại
            được từng câu kèm đáp án đúng.
          </p>
        </div>
      )}

      {scheduleNote && !result && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-amber-50 border border-amber-100">
          <CalendarClock className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs font-semibold text-amber-700">
            {scheduleNote} Hết giờ sẽ không nộp được bài.
          </p>
        </div>
      )}

      {/* Đã nộp: dải điểm gọn ở đầu trang, bấm vào xem lại hộp thoại điểm. */}
      {result && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-5 rounded-2xl border",
            result.passed ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
          )}
        >
          <div className="flex items-center gap-2.5">
            {result.passed ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <p className={cn("text-sm font-extrabold", result.passed ? "text-emerald-700" : "text-red-600")}>
              {result.scorePct}% — đúng {result.correctCount}/{result.total} câu
              <span className="font-semibold text-gray-500"> (điểm đạt {passingScore}%)</span>
            </p>
          </div>
          <button
            onClick={() => setShowResultModal(true)}
            className="text-xs font-bold text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            Xem lại kết quả
          </button>
        </div>
      )}

      {!result && (
        <>
          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: questions.length > 0 ? `${(answeredCount / questions.length) * 100}%` : "0%",
                backgroundColor: "#f15b5c",
              }}
            />
          </div>

          {/* Bảng theo dõi câu hỏi — dính dưới thanh điều hướng khi cuộn, để biết
              còn sót câu nào và nhảy thẳng tới câu đó. */}
          <div className="sticky top-16 z-20 mb-5 rounded-2xl border border-gray-100 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <ListChecks className="h-3.5 w-3.5 text-gray-400" />
                {allAnswered
                  ? "Đã làm hết các câu"
                  : `Còn ${questions.length - answeredCount} câu chưa làm`}
              </p>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Đã làm
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  Chưa làm
                </span>
              </div>
            </div>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {questions.map((q, idx) => {
                const done = !!answers[q.id];
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(q.id)}
                    title={done ? `Câu ${idx + 1} — đã làm` : `Câu ${idx + 1} — chưa làm, bấm để tới`}
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-lg text-xs font-extrabold text-white transition-transform hover:scale-105",
                      done ? "bg-emerald-500" : "bg-red-400"
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Danh sách câu hỏi: đang làm bài, hoặc soi lại sau khi nộp ── */}
      {reviewing && canReview ? (
        <div className="space-y-3">
          <p className="text-sm font-extrabold text-gray-900">Xem lại bài làm ({questions.length} câu)</p>
          {questions.map((q, idx) => {
            const chosen = answers[q.id];
            const correct = correctById[q.id];
            const ok = chosen === correct;
            return (
              <div key={q.id}>
                <div className="mb-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold",
                      ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                    )}
                  >
                    {ok ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    Câu {idx + 1} — {ok ? "đúng" : "sai"}
                  </span>
                </div>
                <QuestionPreview
                  index={idx + 1}
                  label="Câu hỏi trong đề"
                  chosen={chosen}
                  data={{
                    question: q.question,
                    optionA: q.optionA,
                    optionB: q.optionB,
                    optionC: q.optionC,
                    optionD: q.optionD,
                    correct: correct ?? "",
                    imageUrl: q.imageUrl ?? "",
                    videoUrl: q.videoUrl ?? "",
                  }}
                />
              </div>
            );
          })}
          <div className="pt-2">
            <button
              onClick={() => router.push(exitPath)}
              className="h-11 w-full rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {mock ? "Về ngân hàng câu hỏi" : "Về trang chủ"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              ref={(el) => {
                cardRefs.current[q.id] = el;
              }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 scroll-mt-32"
            >
              <p className="text-sm font-semibold text-gray-800">
                <span className="text-[#f15b5c] font-extrabold mr-1.5">Câu {idx + 1}.</span>
                {q.question}
              </p>
              {/* Ảnh / video minh hoạ (nếu câu hỏi có) — xem xong mới chọn đáp án. */}
              <QuestionMedia imageUrl={q.imageUrl} videoUrl={q.videoUrl} />
              <div className="space-y-2 mt-3">
                {OPTIONS.map((opt) => {
                  const value = q[`option${opt}` as keyof Question] as string;
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      disabled={!!result}
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all",
                        selected
                          ? "border-2 border-[#f15b5c] bg-[#f15b5c]/5 text-gray-800"
                          : "border border-gray-200 bg-gray-50 text-gray-600",
                        !result && !selected && "hover:border-gray-300 hover:bg-gray-100"
                      )}
                    >
                      <span
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          selected ? "bg-[#f15b5c] text-white" : "bg-gray-200 text-gray-500"
                        )}
                      >
                        {opt}
                      </span>
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!result && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => router.push(exitPath)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {mock ? "Thoát thi thử" : "Hủy bài thi"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-opacity",
                allAnswered && !submitting ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"
              )}
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Send className="w-4 h-4" />
              {submitting ? "Đang nộp..." : "Nộp bài"}
            </button>
          </div>
          {!allAnswered && (
            <p className="text-xs text-gray-400 text-right mt-2">
              Còn {questions.length - answeredCount} câu chưa trả lời
            </p>
          )}
          {submitError && (
            <p className="text-xs font-semibold text-red-500 text-right mt-2">{submitError}</p>
          )}
        </>
      )}

      {/* ── Hộp thoại điểm ── */}
      {result && showResultModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowResultModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn("relative px-6 py-8 text-center", result.passed ? "bg-emerald-50" : "bg-red-50")}>
              <button
                onClick={() => setShowResultModal(false)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/60 hover:text-gray-600"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
              {result.passed ? (
                <CheckCircle className="mx-auto mb-3 h-14 w-14 text-emerald-500" />
              ) : (
                <XCircle className="mx-auto mb-3 h-14 w-14 text-red-400" />
              )}
              <p className={cn("text-2xl font-extrabold", result.passed ? "text-emerald-700" : "text-red-600")}>
                {mock
                  ? result.passed
                    ? "Bài thi thử: ĐẠT"
                    : "Bài thi thử: CHƯA ĐẠT"
                  : result.passed
                    ? "Chúc mừng! Bạn đã đạt!"
                    : "Chưa đạt"}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                {mock
                  ? "Kết quả không được lưu và không ảnh hưởng cấp độ của ai."
                  : result.passed
                    ? result.promoted
                      ? "Bạn đã đủ điều kiện và được thăng lên cấp độ mới!"
                      : "Bạn đã đạt phần lý thuyết. Cần đạt thêm thực hành, doanh số và transform để được thăng hạng."
                    : "Bạn có thể thử lại sau"}
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-gray-900">{result.scorePct}%</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-400">Điểm của bạn</p>
                </div>
                <div className="h-10 w-px bg-gray-100" />
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-gray-900">{passingScore}%</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-400">Điểm đạt</p>
                </div>
                <div className="h-10 w-px bg-gray-100" />
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-gray-900">
                    {result.correctCount}/{result.total}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-400">Câu đúng</p>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {canReview && (
                  <button
                    onClick={() => {
                      setReviewing(true);
                      setShowResultModal(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-11 w-full rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    Xem lại bài làm
                  </button>
                )}
                <button
                  onClick={() => router.push(exitPath)}
                  className={cn(
                    "h-11 w-full rounded-xl text-sm font-bold transition-colors",
                    canReview
                      ? "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      : "text-white hover:opacity-90"
                  )}
                  style={canReview ? undefined : { backgroundColor: "#f15b5c" }}
                >
                  {mock ? "Không, về ngân hàng câu hỏi" : "Về trang chủ"}
                </button>
                {mock && (
                  <button
                    onClick={() => window.location.reload()}
                    className="h-10 w-full rounded-xl text-xs font-bold text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                  >
                    Thi thử lại với đề khác
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
