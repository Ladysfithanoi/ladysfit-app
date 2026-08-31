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
  Timer,
  ShieldCheck,
  X,
  AlertTriangle,
  EyeOff,
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
 * Sau khi báo một lần rời trang thì nghỉ bấy nhiêu mili giây mới báo tiếp.
 * Một lần alt-tab thường bắn cả 'blur' lẫn 'visibilitychange'; server cũng gộp
 * lại bằng khoảng tương đương (VIOLATION_DEBOUNCE_MS trong lib/exam-session).
 */
const VIOLATION_COOLDOWN_MS = 6_000;

/** Mili giây → "MM:SS" (hoặc "H:MM:SS" khi thời lượng dài hơn một tiếng). */
function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Đồng hồ đếm ngược: xám bình thường, vàng dưới 5 phút, đỏ nhấp nháy dưới 1 phút. */
function CountdownChip({ ms, className }: { ms: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold tabular-nums",
        ms <= 60_000
          ? "bg-red-50 text-red-600 animate-pulse"
          : ms <= 5 * 60_000
            ? "bg-amber-50 text-amber-600"
            : "bg-gray-100 text-gray-700",
        className
      )}
      title="Thời gian còn lại của bài thi"
    >
      <Timer className="h-3.5 w-3.5" />
      {fmtClock(ms)}
    </span>
  );
}

/**
 * Bảng theo dõi câu hỏi: xanh là đã làm, đỏ là chưa, bấm vào nhảy tới câu đó.
 * Màn hình rộng thì nằm hẳn cột bên phải; màn hình hẹp thì cùng nội dung này
 * mở ra trong một modal, vì nhét thêm một bảng vào giữa đề bài trên điện thoại
 * chỉ tổ đẩy câu hỏi xuống và làm bài khó đọc hơn.
 */
function QuestionTracker({
  questions,
  answers,
  remainingMs,
  onGo,
}: {
  questions: { id: string }[];
  answers: Record<string, string>;
  remainingMs: number | null;
  onGo: (id: string) => void;
}) {
  const answered = questions.filter((q) => !!answers[q.id]).length;
  const left = questions.length - answered;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
          <ListChecks className="h-3.5 w-3.5 text-gray-400" />
          Đã làm {answered}/{questions.length}
        </p>
        {remainingMs != null && <CountdownChip ms={remainingMs} />}
      </div>

      <p
        className={cn(
          "text-xs font-semibold",
          left === 0 ? "text-emerald-600" : "text-red-500"
        )}
      >
        {left === 0 ? "Đã làm hết các câu" : `Còn ${left} câu chưa làm`}
      </p>

      <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5 max-h-[45vh] overflow-y-auto">
        {questions.map((q, idx) => {
          const done = !!answers[q.id];
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onGo(q.id)}
              title={done ? `Câu ${idx + 1} — đã làm` : `Câu ${idx + 1} — chưa làm, bấm để tới`}
              className={cn(
                "h-9 rounded-lg text-xs font-extrabold text-white transition-transform hover:scale-105",
                done ? "bg-emerald-500" : "bg-red-400"
              )}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

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
  );
}

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
  // FM bắt buộc thi: điểm chỉ để Admin nắm trình độ, trượt không bị phạt gì.
  // Nói rõ ngay trên đề để người thi không tưởng mình đang bị đem ra đánh giá.
  const [noPenalty, setNoPenalty] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // ── Chống ra ngoài đọc tài liệu ──────────────────────────────────────────
  // Số phút bị trừ mỗi lần rời khỏi trang thi (0 = kỳ thi này không phạt), số
  // lần đã rời và tổng số phút đã mất. Server giữ con số thật; ở đây chỉ hiển thị.
  const [focusPenaltyMinutes, setFocusPenaltyMinutes] = useState(0);
  const [violations, setViolations] = useState(0);
  const [penaltyMinutes, setPenaltyMinutes] = useState(0);
  // Vừa bị bắt rời trang — hiện hộp thoại báo ngay khi người thi quay lại.
  const [penaltyNotice, setPenaltyNotice] = useState<{ minutes: number; times: number } | null>(null);
  // Mở lại đề đang làm dở: đề cũ, đồng hồ cũ, không phải bài mới.
  const [resumed, setResumed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<ExamResult | null>(null);
  // Đáp án đúng từng câu — chỉ có ở bài thi thử, để soi lại đề sau khi chấm.
  const [correctById, setCorrectById] = useState<Record<string, string>>({});
  // Nộp xong thì điểm hiện trong hộp thoại giữa màn hình, không đẩy người thi
  // lên đầu trang rồi bắt kéo xuống tìm.
  const [showResultModal, setShowResultModal] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  // Màn hình hẹp: bảng theo dõi nằm trong modal, mở bằng nút nổi góc phải.
  const [trackerOpen, setTrackerOpen] = useState(false);

  // ── Thời lượng làm bài ───────────────────────────────────────────────────
  // Mốc hết giờ do server tính và ký (lib/exam-ticket.ts); ở đây chỉ đếm ngược
  // tới mốc đó. Hết giờ là tự nộp, còn câu chưa làm cũng nộp.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [examToken, setExamToken] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  // Cờ chống nộp hai lần: hết giờ nộp tự động trong lúc người thi cũng vừa bấm nộp.
  const submitLock = useRef(false);

  // Bảng theo dõi câu hỏi bấm vào là nhảy tới đúng thẻ câu đó.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Đang gửi báo cáo rời trang — chặn đếm trùng một lần alt-tab.
  const reportingRef = useRef(false);

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
        setNoPenalty(!!data.noPenalty);
        setExamToken(data.examToken ?? null);
        setFocusPenaltyMinutes(data.focusPenaltyMinutes ?? 0);
        setViolations(data.violations ?? 0);
        setPenaltyMinutes(data.penaltyMinutes ?? 0);
        setResumed(!!data.resumed);
        if (data.endsAt) {
          const deadline = new Date(data.endsAt).getTime();
          setEndsAt(deadline);
          setRemainingMs(Math.max(0, deadline - Date.now()));
        }
      } catch {
        setError("Có lỗi xảy ra khi tải đề thi");
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [mock]);

  async function handleSubmit(force = false) {
    if (submitLock.current) return;
    if (!force && Object.keys(answers).length < questions.length) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      // Gửi ĐỦ id của mọi câu trong đề, câu chưa làm gửi chuỗi rỗng. Nếu chỉ gửi
      // các câu đã làm thì lúc hết giờ tự nộp, server lấy "tổng số câu" bằng số
      // câu nhận được — làm 5/20 câu đúng cả 5 sẽ thành 100%.
      const payload: Record<string, string> = {};
      for (const q of questions) payload[q.id] = answers[q.id] ?? "";

      const res = await fetch(mock ? "/api/exam/mock-grade" : "/api/exam/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload, examToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error ?? "Không nộp được bài. Vui lòng thử lại.");
        // Nộp hỏng thì mở khoá để còn thử lại; hết giờ thì thôi, khoá luôn.
        if (!force) submitLock.current = false;
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

  // Đồng hồ đếm ngược. Đếm theo mốc tuyệt đối chứ không trừ dần, để tab bị ẩn
  // rồi mở lại (trình duyệt bóp nhịp setInterval) vẫn ra đúng thời gian còn lại.
  useEffect(() => {
    if (endsAt == null || result) return;
    function tick() {
      const left = Math.max(0, endsAt! - Date.now());
      setRemainingMs(left);
      if (left === 0 && !submitLock.current) {
        setAutoSubmitted(true);
        handleSubmit(true);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, result, questions, answers, examToken]);

  // ── Bắt quả tang rời khỏi trang thi ─────────────────────────────────────
  // Hai nguồn tín hiệu, vì mỗi cái bắt thiếu một kiểu:
  //   • visibilitychange: chuyển tab, thu nhỏ trình duyệt, khoá màn hình điện thoại.
  //   • blur cửa sổ: mở CỬA SỔ khác (Word, PDF, Zalo) đè lên trong khi tab vẫn hiện.
  // Bấm play video minh hoạ trong đề cũng làm cửa sổ mất tiêu điểm — nhưng lúc
  // đó activeElement là chính cái iframe của trang, nên bỏ qua, không tính phạt.
  //
  // Trừ giờ là việc của server (app/api/exam/violation); ở đây chỉ báo về rồi
  // nhận lại mốc hết giờ mới, nên tắt JS hay sửa giờ máy cũng không gỡ được.
  useEffect(() => {
    if (mock || result || questions.length === 0 || focusPenaltyMinutes <= 0) return;

    async function report() {
      if (reportingRef.current || submitLock.current) return;
      reportingRef.current = true;
      try {
        // keepalive: rời trang xong đóng luôn tab thì yêu cầu vẫn tới được server.
        const res = await fetch("/api/exam/violation", { method: "POST", keepalive: true });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.counted) return;
        setViolations(data.violations ?? 0);
        setPenaltyMinutes(data.penaltyMinutes ?? 0);
        if (data.endsAt) setEndsAt(new Date(data.endsAt).getTime());
        setPenaltyNotice({
          minutes: data.lastPenaltyMinutes ?? 0,
          times: data.violations ?? 0,
        });
      } catch {
        // Mạng chập lúc đó thì thôi — không chặn người thi làm tiếp.
      } finally {
        setTimeout(() => {
          reportingRef.current = false;
        }, VIOLATION_COOLDOWN_MS);
      }
    }

    function onVisibility() {
      if (document.hidden) report();
    }
    function onBlur() {
      if (document.activeElement?.tagName === "IFRAME") return;
      report();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [mock, result, questions.length, focusPenaltyMinutes]);

  // Đóng tab / F5 giữa chừng thì hỏi lại một câu. Tải lại không bốc được đề mới
  // và cũng không được cấp thêm giờ, nhưng người thi không biết điều đó nên cứ
  // nhắc — đỡ một phen hoảng.
  useEffect(() => {
    if (mock || result || questions.length === 0) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mock, result, questions.length]);

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
    // Đệm đáy rộng ở màn hình hẹp để nút nổi không đè lên nút Nộp bài.
    <div className="mx-auto max-w-2xl pb-24 lg:max-w-5xl lg:pb-10">
      <div className="lg:flex lg:items-start lg:gap-6">
      {/* ── Cột trái: bài kiểm tra ── */}
      <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
            {mock
              ? "Thi thử — Bài kiểm tra thăng cấp"
              : noPenalty
                ? "Bài kiểm tra chuyên môn"
                : "Bài kiểm tra thăng cấp"}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium sm:text-sm">
            Điểm đạt: {passingScore}% — {questions.length} câu hỏi
          </p>
        </div>
        {!result && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-gray-700">{answeredCount}/{questions.length}</p>
            <p className="text-xs text-gray-400 whitespace-nowrap">đã trả lời</p>
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

      {noPenalty && !result && (
        <div className="flex items-start gap-2 px-4 py-2.5 mb-4 rounded-xl bg-sky-50 border border-sky-100">
          <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0 mt-px" />
          <p className="text-xs font-semibold text-sky-700 leading-snug">
            Bạn được chỉ định làm bài kiểm tra này. Điểm chỉ để ban quản lý nắm chuyên môn
            của bạn — không đạt cũng không bị phạt, không ảnh hưởng chức vụ hay lương
            thưởng. Cứ làm thoải mái.
          </p>
        </div>
      )}

      {/* Luật rời trang — nói trước khi người ta lỡ tay, không phải sau. */}
      {!mock && !result && focusPenaltyMinutes > 0 && (
        <div
          className={cn(
            "flex items-start gap-2 px-4 py-2.5 mb-4 rounded-xl border",
            violations > 0 ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-100"
          )}
        >
          <EyeOff
            className={cn(
              "w-4 h-4 shrink-0 mt-px",
              violations > 0 ? "text-red-500" : "text-orange-500"
            )}
          />
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-bold leading-snug",
                violations > 0 ? "text-red-700" : "text-orange-700"
              )}
            >
              Không được rời khỏi trang thi. Mỗi lần chuyển sang tab khác, mở cửa sổ khác hay
              thu nhỏ trình duyệt sẽ bị trừ thẳng {focusPenaltyMinutes} phút vào thời gian làm
              bài của bạn.
            </p>
            {violations > 0 && (
              <p className="mt-1 text-xs font-extrabold text-red-600">
                Bạn đã rời trang {violations} lần — đã bị trừ {penaltyMinutes} phút.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mở lại đề đang làm dở — nói rõ để khỏi tưởng mình được thi lại. */}
      {resumed && !result && (
        <div className="flex items-start gap-2 px-4 py-2.5 mb-4 rounded-xl bg-gray-50 border border-gray-200">
          <Timer className="w-4 h-4 text-gray-400 shrink-0 mt-px" />
          <p className="text-xs font-semibold text-gray-600 leading-snug">
            Đây là bài thi bạn đang làm dở — vẫn đúng đề cũ và đồng hồ chạy tiếp từ lúc bạn
            mở đề. Tải lại trang không đổi được đề, cũng không được cộng thêm giờ.
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
        <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: questions.length > 0 ? `${(answeredCount / questions.length) * 100}%` : "0%",
              backgroundColor: "#f15b5c",
            }}
          />
        </div>
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
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={() => router.push(exitPath)}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {mock ? "Thoát thi thử" : "Hủy bài thi"}
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={!allAnswered || submitting}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap px-5 py-2.5 rounded-xl text-white font-bold text-sm transition-opacity sm:px-6",
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

      </div>

      {/* ── Cột phải: bảng theo dõi, chỉ có ở màn hình rộng ── */}
      {!result && (
        <aside className="hidden lg:block lg:w-60 lg:shrink-0 lg:sticky lg:top-20">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <QuestionTracker
              questions={questions}
              answers={answers}
              remainingMs={remainingMs}
              onGo={goToQuestion}
            />
          </div>
        </aside>
      )}
      </div>

      {/* ── Màn hình hẹp: nút nổi góc phải, bấm mở bảng theo dõi ── */}
      {!result && (
        <button
          type="button"
          onClick={() => setTrackerOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full py-3 pl-4 pr-5 text-sm font-extrabold text-white shadow-lg lg:hidden"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <ListChecks className="h-4 w-4" />
          <span className="tabular-nums">
            {answeredCount}/{questions.length}
          </span>
          {remainingMs != null && (
            <span className="border-l border-white/40 pl-2 tabular-nums">{fmtClock(remainingMs)}</span>
          )}
          {violations > 0 && (
            <span className="flex items-center gap-1 border-l border-white/40 pl-2 tabular-nums">
              <EyeOff className="h-3.5 w-3.5" />
              {violations}
            </span>
          )}
        </button>
      )}

      {/* ── Vừa bị bắt rời trang ── */}
      {penaltyNotice && !result && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-red-50 px-6 py-7 text-center">
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-red-500" />
              <p className="text-lg font-extrabold text-red-700">Bạn vừa rời khỏi trang thi</p>
              <p className="mt-2 text-sm font-semibold text-gray-600">
                {penaltyNotice.minutes > 0 ? (
                  <>
                    Thời gian làm bài của bạn bị trừ{" "}
                    <span className="font-extrabold text-red-600">
                      {penaltyNotice.minutes} phút
                    </span>
                    .
                  </>
                ) : (
                  "Hệ thống đã ghi nhận lần rời trang này."
                )}
              </p>
              <p className="mt-1 text-xs font-bold text-gray-500">
                Đây là lần thứ {penaltyNotice.times}. Tổng đã bị trừ {penaltyMinutes} phút.
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 leading-snug">
                Hãy ở nguyên trên trang thi cho tới khi nộp bài. Mỗi lần rời trang tiếp theo
                vẫn bị trừ {focusPenaltyMinutes} phút.
              </p>
              <button
                onClick={() => setPenaltyNotice(null)}
                className="mt-4 h-11 w-full rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f15b5c" }}
              >
                Tôi đã hiểu, làm bài tiếp
              </button>
            </div>
          </div>
        </div>
      )}

      {trackerOpen && !result && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center lg:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setTrackerOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold text-gray-900">Theo dõi câu hỏi</p>
              <button
                onClick={() => setTrackerOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <QuestionTracker
              questions={questions}
              answers={answers}
              remainingMs={remainingMs}
              onGo={(id) => {
                setTrackerOpen(false);
                goToQuestion(id);
              }}
            />
          </div>
        </div>
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
                    : noPenalty
                      ? "Chưa đạt — không sao cả"
                      : "Chưa đạt"}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                {mock
                  ? "Kết quả không được lưu và không ảnh hưởng cấp độ của ai."
                  : noPenalty
                  ? "Điểm đã gửi cho ban quản lý để nắm chuyên môn. Kết quả này không ảnh hưởng chức vụ hay quyền lợi của bạn."
                  : result.passed
                    ? result.promoted
                      ? "Bạn đã đủ điều kiện và được thăng lên cấp độ mới!"
                      : "Bạn đã đạt phần lý thuyết. Cần đạt thêm thực hành, doanh số và transform để được thăng hạng."
                    : "Bạn có thể thử lại sau"}
              </p>
              {autoSubmitted && (
                <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-gray-600">
                  <Timer className="h-3.5 w-3.5" />
                  Hết thời lượng làm bài — hệ thống đã tự nộp bài
                </p>
              )}
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
