"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, ArrowLeft, Send, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionMedia } from "./question-media";

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

export function ExamTakePage() {
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

  useEffect(() => {
    async function loadExam() {
      try {
        const res = await fetch("/api/exam/take");
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
  }, []);

  async function handleSubmit() {
    if (Object.keys(answers).length < questions.length) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/exam/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error ?? "Không nộp được bài. Vui lòng thử lại.");
      } else {
        const data = await res.json();
        setResult({
          scorePct: data.scorePct,
          correctCount: data.correctCount,
          total: data.total,
          passed: data.passed,
          promoted: !!data.promoted,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

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
            onClick={() => router.push("/dashboard")}
            className="mt-5 flex items-center gap-2 mx-auto text-sm font-semibold text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className={cn(
              "px-6 py-8 text-center",
              result.passed ? "bg-emerald-50" : "bg-red-50"
            )}
          >
            {result.passed ? (
              <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            ) : (
              <XCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />
            )}
            <p
              className={cn(
                "text-2xl font-extrabold",
                result.passed ? "text-emerald-700" : "text-red-600"
              )}
            >
              {result.passed ? "Chúc mừng! Bạn đã đạt!" : "Chưa đạt"}
            </p>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              {result.passed
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
                <p className="text-xs text-gray-400 font-semibold mt-0.5">Điểm của bạn</p>
              </div>
              <div className="w-px h-10 bg-gray-100" />
              <div className="text-center">
                <p className="text-3xl font-extrabold text-gray-900">{passingScore}%</p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">Điểm đạt</p>
              </div>
              <div className="w-px h-10 bg-gray-100" />
              <div className="text-center">
                <p className="text-3xl font-extrabold text-gray-900">
                  {result.correctCount}/{result.total}
                </p>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">Câu đúng</p>
              </div>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 w-full h-11 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Bài kiểm tra thăng cấp</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">
            Điểm đạt: {passingScore}% — {questions.length} câu hỏi
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-700">{answeredCount}/{questions.length}</p>
          <p className="text-xs text-gray-400">đã trả lời</p>
        </div>
      </div>

      {scheduleNote && (
        <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-amber-50 border border-amber-100">
          <CalendarClock className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs font-semibold text-amber-700">
            {scheduleNote} Hết giờ sẽ không nộp được bài.
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: questions.length > 0 ? `${(answeredCount / questions.length) * 100}%` : "0%",
            backgroundColor: "#f15b5c",
          }}
        />
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all",
                      selected
                        ? "border-2 border-[#f15b5c] bg-[#f15b5c]/5 text-gray-800"
                        : "border border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
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

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Hủy bài thi
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
    </div>
  );
}
