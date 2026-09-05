"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  AlarmClock,
  Cloud,
  CloudOff,
  ChevronDown,
  ChevronUp,
  Skull,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionMedia } from "./question-media";
import { QuestionPreview } from "./question-preview";
import { MealRound, type MealBriefView } from "./trial-meal-round";
import { SortRound, type SortCardView } from "./trial-sort-round";
import { ProgramRound, type ProgramCaseView } from "./trial-program-round";
import {
  SIN_LABEL, SORT_ZONE_LABEL, PILLAR_LABEL, SIN_SEPHIRAH, KETHER, CHOKMAH, BINAH, SEPHIROT,
  honorAfter, honorRulesFor, declaredSetupFor, trialSetupFor,
  type MealEntry, type SortZone, type Sin, type ProgramEntry,
  type DeclaredSetup, type HonorBase,
} from "@/lib/exam-trial";
import { TrialDeclareSin } from "./trial-declare-sin";
import { KabbalahTree, KabbalahLegend, type SephirahStatus } from "./kabbalah-tree";

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

/** Một vòng của đề thử thách (7 đại tội) — đã bỏ đáp án trước khi gửi xuống. */
type TrialRound = {
  id: string;
  type: "MEAL" | "SORT" | "PROGRAM";
  /** Đại tội của vòng — hiện kèm tên vòng cho thí sinh biết đang bị đo mảng nào. */
  sin: Sin | null;
  name: string;
  intro: string | null;
  maxPoints: number;
  passPercent: number;
  failPenalty: number;
  briefs: MealBriefView[];
  cards: SortCardView[];
  cases: ProgramCaseView[];
};

/**
 * Bài làm cả lượt, khoá theo vòng rồi tới từng mục trong vòng:
 *   khay ăn   → { briefId: MealEntry[] }
 *   phân loại → { cardId: SortZone }
 *   giáo án   → { caseId: ProgramEntry[] }
 */
type TrialCell = MealEntry[] | SortZone | ProgramEntry[];
type TrialState = Record<string, Record<string, TrialCell>>;

/**
 * Sephirot sáng lên sau một lượt thi: mỗi VÒNG ĐÃ ĐẠT thắp đúng sephirah của
 * đại tội nó đo. Vòng trượt thì để tối — cây chỉ kể những gì thật sự vượt qua.
 * Đạt cả kỳ thì Kether sáng thêm.
 */
function litSephirot(r: TrialSubmitResult, rounds: TrialRound[]): number[] {
  const out: number[] = [];
  for (const rs of r.rounds) {
    if (!rs.passed) continue;
    const round = rounds.find((x) => x.id === rs.roundId);
    if (round?.sin) out.push(SIN_SEPHIRAH[round.sin]);
  }
  // Ba ô trên Vực Thẳm: thực hành, doanh số+transform, và vương miện. Đậu lý
  // thuyết chưa đưa ai lên cấp — cây phải nói đúng điều đó.
  const p = r.promotion;
  if (p?.practical?.ok) out.push(CHOKMAH);
  if (p?.revenue?.ok && p?.transform?.ok) out.push(BINAH);
  if (p && p.exam?.ok && p.practical?.ok && p.revenue?.ok && p.transform?.ok) out.push(KETHER);
  else if (!p && r.passed) out.push(KETHER); // thi thử: không có dữ liệu thăng cấp
  return out;
}

/**
 * Trạng thái từng ô của cây cho bảng chú giải ở màn kết quả.
 *
 * Bảy ô dưới đọc từ chính lượt thi vừa rồi; ba ô trên đọc từ điều kiện thăng
 * cấp (evaluatePtById ở API trial-submit). Thi thử không có dữ liệu thăng cấp
 * nên ba ô trên nói thẳng là không tính ở đây, chứ không im lặng để người ta
 * tưởng mình vừa trượt.
 */
function sephirahStatus(
  r: TrialSubmitResult,
  rounds: TrialRound[],
): Record<number, SephirahStatus> {
  const out: Record<number, SephirahStatus> = {};
  const supernalKey: Record<number, string> = {
    [CHOKMAH]: "practical",
    [BINAH]: "revenue",
    [KETHER]: "exam",
  };

  for (const s of SEPHIROT) {
    if (!s.sin) {
      const p = r.promotion;
      if (!p) {
        out[s.id] = { text: "Không tính ở bài thi thử", tone: "off" };
        continue;
      }
      if (s.id === KETHER) {
        const all = ["exam", "practical", "revenue", "transform"].every((k) => p[k]?.ok);
        out[s.id] = all
          ? { text: "Đủ cả bốn điều kiện — đã đủ để lên cấp", tone: "ok" }
          : { text: "Chưa đủ bốn điều kiện thăng cấp", tone: "warn" };
        continue;
      }
      if (s.id === BINAH) {
        const ok = !!p.revenue?.ok && !!p.transform?.ok;
        const detail = [p.revenue?.detail, p.transform?.detail].filter(Boolean).join(" · ");
        out[s.id] = { text: detail || (ok ? "Đã đạt" : "Chưa đạt"), tone: ok ? "ok" : "warn" };
        continue;
      }
      const cond = p[supernalKey[s.id]];
      out[s.id] = {
        text: cond?.detail || (cond?.ok ? "Đã đạt" : "Chưa đạt"),
        tone: cond?.ok ? "ok" : "warn",
      };
      continue;
    }

    const round = rounds.find((x) => x.sin === s.sin);
    if (!round) {
      // Đề có đủ bảy tội nhưng một lượt chỉ bốc vài vòng — nói rõ là chưa
      // rơi vào lượt này, chứ không phải đề thiếu.
      out[s.id] = { text: "Không rơi vào lượt thi này", tone: "off" };
      continue;
    }
    const res = r.rounds.find((x) => x.roundId === round.id);
    if (!res) {
      out[s.id] = { text: `${round.name} · chưa chấm`, tone: "off" };
      continue;
    }
    const declared = r.declaredSin === s.sin ? " · tội đã khai" : "";
    out[s.id] = {
      text: `${round.name} · ${res.points}/${res.maxPoints} điểm · ${res.passed ? "đạt" : "trượt"}${declared}`,
      tone: res.passed ? "ok" : "warn",
    };
  }
  return out;
}


/** Bài soi lại sau khi THI THỬ — kèm đáp án đúng, bài thi thật không có. */
type TrialReviewRound = {
  id: string;
  name: string;
  type: "MEAL" | "SORT" | "PROGRAM";
  points: number;
  maxPoints: number;
  passed: boolean;
  briefs: {
    id: string;
    clientProfile: string;
    ratio: number;
    totals: { calories: number; protein: number; fat: number; carbs: number };
    metrics: { metric: string; target: number; actual: number; min: number; max: number; ok: boolean }[];
    usedBanned: string[];
    explanation: string | null;
  }[];
  cards: {
    id: string;
    text: string;
    answer: SortZone | null;
    correct: SortZone;
    ratio: number;
    explanation: string | null;
  }[];
  cases: {
    id: string;
    clientProfile: string;
    ratio: number;
    metrics: { metric: string; target: number; actual: number; min: number; max: number; ok: boolean }[];
    missingPatterns: string[];
    usedBanned: string[];
    explanation: string | null;
  }[];
};

type TrialSubmitResult = {
  scorePct: number;
  score: number;
  total: number;
  penalty: number;
  passed: boolean;
  promoted: boolean;
  /** Trượt đúng vòng của tội đã khai — tự nó đánh rớt cả kỳ. */
  declaredFailed?: boolean;
  declaredSin?: Sin | null;
  pillar?: "SEVERITY" | "MERCY" | "BALANCE";
  rounds: { roundId: string; points: number; maxPoints: number; passed: boolean; penalty: number }[];
  /** Chỉ có ở thi thử. */
  review?: TrialReviewRound[];
  /** Ba điều kiện thăng cấp còn lại — ba ô trên Vực Thẳm của cây. */
  promotion?: Record<string, { ok: boolean; detail: string }> | null;
};

/**
 * Sau khi báo một lần rời trang thì nghỉ bấy nhiêu mili giây mới báo tiếp.
 * Một lần alt-tab thường bắn cả 'blur' lẫn 'visibilitychange'; server cũng gộp
 * lại bằng khoảng tương đương (VIOLATION_DEBOUNCE_MS trong lib/exam-session).
 */
const VIOLATION_COOLDOWN_MS = 6_000;

/**
 * Nhắc giờ: bắt đầu từ mốc 10 phút, sau đó mỗi phút nhắc lại một lần cho tới
 * lúc hết giờ. Lần đầu là hộp thoại phải bấm xác nhận — đó là lời báo trước
 * quan trọng nhất. Những lần sau chỉ là dải nhắc tự tắt: đang trong 10 phút
 * cuối mà cứ mỗi phút lại chặn màn hình một lần thì hại người thi hơn là giúp.
 */
const REMIND_FROM_MINUTES = 10;

/** Dải nhắc giờ tự tắt sau bấy nhiêu mili giây. */
const REMINDER_TOAST_MS = 6_000;

/**
 * Gom bao nhiêu mili giây rồi mới tự lưu một lần.
 *
 * Chọn ngắn (2 giây) vì cái cần cứu là bài của người thi: bấm vài câu liên tiếp
 * thì chỉ tốn một lượt ghi, mà mất điện đột ngột cũng chỉ mất đúng vài giây làm
 * bài cuối cùng.
 */
const AUTOSAVE_DEBOUNCE_MS = 2_000;

/** Thanh chuyển vòng: màn hẹp trượt ngang thay vì xuống dòng. */
const SLIDER_ROUNDS =
  "w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full";

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
export function ExamTakePage({
  mock = false,
  mockLevelId,
  mockDeclaredSin,
}: {
  mock?: boolean;
  /** Thi thử đề của cấp nào — Admin chọn ở tab Ngân hàng câu hỏi. */
  mockLevelId?: string;
  /** Thi thử với tội đã khai nào — để kiểm cả cơ chế, không chỉ nội dung. */
  mockDeclaredSin?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passingScore, setPassingScore] = useState(80);
  const [scheduleNote, setScheduleNote] = useState("");
  // Đề của cấp nào — hiện ngay trên đầu bài để người thi biết mình đang làm gì.
  const [levelName, setLevelName] = useState<string | null>(null);
  // FM bắt buộc thi: điểm chỉ để Admin nắm trình độ, trượt không bị phạt gì.
  // Nói rõ ngay trên đề để người thi không tưởng mình đang bị đem ra đánh giá.
  const [noPenalty, setNoPenalty] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // ── Đề thử thách nhiều vòng ──────────────────────────────────────────────
  // Cấp nào đặt dạng TRIAL thì server trả rounds thay vì questions; cả trang
  // dùng chung khung này (đồng hồ, tự lưu, phạt rời trang), chỉ đổi phần thân.
  const [rounds, setRounds] = useState<TrialRound[]>([]);
  const [trialState, setTrialState] = useState<TrialState>({});
  const [roundIdx, setRoundIdx] = useState(0);
  // Nhịp giữa hai vòng: hiện cây Kabbalah với sephirah vừa thắp, rồi mới sang vòng kế.
  const [advanceFrom, setAdvanceFrom] = useState<TrialRound | null>(null);
  const [trialResult, setTrialResult] = useState<TrialSubmitResult | null>(null);
  // Mức lệch của từng thẻ đã bấm — nuôi thanh Thanh danh và mấy dòng báo kết
  // quả. Máy chủ trả về, client không tự tính được vì không có đáp án đúng.
  const [cardOutcomes, setCardOutcomes] = useState<Record<string, number>>({});
  // Mốc phạt sai liên tiếp của cấp — server gửi kèm đề, client chỉ vẽ lại.
  // Thang Thanh danh của vòng thường ở cấp này — hao mỗi thẻ và bảng mốc.
  const [honorBase, setHonorBase] = useState<HonorBase>(() => trialSetupFor(null));
  // Thang riêng của vòng đã khai — nặng hơn ở từng thẻ, do Admin đặt theo cấp.
  const [declaredSetup, setDeclaredSetup] = useState<DeclaredSetup>(() => declaredSetupFor(null));
  const [pendingCard, setPendingCard] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  // Chú giải cây ở màn kết quả: mặc định đóng, vì thứ người ta muốn thấy trước
  // là điểm, không phải mười ô sephirot.
  const [legendOpen, setLegendOpen] = useState(false);
  // Chưa khai tội thì chưa được xem đề — server chưa gửi vòng nào xuống.
  const [needsDeclaration, setNeedsDeclaration] = useState(false);
  const [sinOptions, setSinOptions] = useState<{ sin: Sin; roundName: string | null; available: boolean }[]>([]);
  const [declaredSin, setDeclaredSin] = useState<Sin | null>(null);
  // Thi thử không có lượt thi để ghi tội đã khai, nên giữ ở bộ nhớ trang.
  const [mockSin, setMockSin] = useState<Sin | null>((mockDeclaredSin as Sin) ?? null);
  // Đổi số này để bắt tải lại đề sau khi khai xong.
  const [reloadKey, setReloadKey] = useState(0);
  const trialRef = useRef<TrialState>({});
  const isTrial = rounds.length > 0;
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
  // Tự lưu: "saved" là đã ghi xong, "saving" đang ghi, "error" ghi hỏng.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
  // Nhắc giờ. Lần nhắc đầu tiên hiện hộp thoại, các lần sau hiện dải tự tắt.
  const [timeWarning, setTimeWarning] = useState<number | null>(null);
  const [timeToast, setTimeToast] = useState<number | null>(null);
  // Các mốc phút đã nhắc rồi — mỗi mốc chỉ nhắc đúng một lần.
  const firedMarks = useRef<Set<number>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cờ chống nộp hai lần: hết giờ nộp tự động trong lúc người thi cũng vừa bấm nộp.
  const submitLock = useRef(false);
  // Đã thử tự nộp khi hết giờ chưa — đồng hồ chạy mỗi giây nên nếu không nhớ,
  // một lần tự nộp hỏng sẽ thành bắn lại mỗi giây.
  const autoSubmitTried = useRef(false);

  // Bảng theo dõi câu hỏi bấm vào là nhảy tới đúng thẻ câu đó.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Đang gửi báo cáo rời trang — chặn đếm trùng một lần alt-tab.
  const reportingRef = useRef(false);
  // Tự lưu đáp án: hẹn giờ gom, và bản đáp án mới nhất để lúc rời trang gửi ngay.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef<Record<string, string>>({});

  useEffect(() => {
    async function loadExam() {
      try {
        const mockQuery = mock
          ? `?mock=1&levelId=${encodeURIComponent(mockLevelId ?? "")}` +
            (mockSin ? `&declaredSin=${encodeURIComponent(mockSin)}` : "")
          : "";
        const res = await fetch(`/api/exam/take${mockQuery}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Không thể tải đề thi");
          return;
        }
        const data = await res.json();
        setQuestions(data.questions);
        setPassingScore(data.passingScore);
        setScheduleNote(data.scheduleNote ?? "");
        setLevelName(data.levelName ?? null);
        setNeedsDeclaration(!!data.needsDeclaration);
        setSinOptions(data.sinOptions ?? []);
        setDeclaredSin(data.declaredSin ?? null);
        // Đặt trước cửa khai: màn khai tội phải nói đúng cái giá của cấp này.
        if (data.declaredSetup) setDeclaredSetup(data.declaredSetup as DeclaredSetup);
        if (data.honorBase) setHonorBase(data.honorBase as HonorBase);
        if (data.needsDeclaration) return; // chưa khai thì chưa có đề để dựng
        if (Array.isArray(data.rounds) && data.rounds.length > 0) {
          setRounds(data.rounds);
          const saved = (data.savedTrialState ?? {}) as TrialState;
          setTrialState(saved);
          trialRef.current = saved;
          setCardOutcomes((data.cardOutcomes ?? {}) as Record<string, number>);
        }
        setNoPenalty(!!data.noPenalty);
        setExamToken(data.examToken ?? null);
        setFocusPenaltyMinutes(data.focusPenaltyMinutes ?? 0);
        setViolations(data.violations ?? 0);
        setPenaltyMinutes(data.penaltyMinutes ?? 0);
        setResumed(!!data.resumed);
        // Bài đang làm dở đã tự lưu ở server — dựng lại đúng các câu đã chọn.
        if (data.savedAnswers && typeof data.savedAnswers === "object") {
          setAnswers(data.savedAnswers);
          answersRef.current = data.savedAnswers;
        }
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
  }, [mock, mockLevelId, mockSin, reloadKey]);

  /**
   * Nộp bài đề thử thách. Thi thử của Admin không ghi gì nên chỉ báo ngay là
   * đã xem xong đề; bài thật đi qua /api/exam/trial-submit, nơi server nạp lại
   * đề và tự chấm — client không gửi điểm lên bao giờ.
   */
  async function handleSubmitTrial(force = false) {
    if (!force && !mock && !trialComplete) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      // Thi thử chấm bằng ĐÚNG bộ luật của bài thật (xem lib/exam-trial-server
      // computeTrial) nhưng không ghi gì, và trả về cả đáp án để soi lại đề.
      const res = await fetch(
        mock ? "/api/exam/trial-mock-grade" : "/api/exam/trial-submit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trialState: trialRef.current,
            // Thi thử: báo luôn bộ vòng vừa được phát, để nơi chấm không
            // chấm sang những vòng khác của đề mà lượt này không bốc trúng.
            ...(mock
              ? {
                  levelId: mockLevelId,
                  declaredSin: mockSin,
                  roundIds: rounds.map((r) => r.id),
                  itemIds: rounds.flatMap((r) => [
                    ...r.briefs.map((b) => b.id),
                    ...r.cards.map((c) => c.id),
                  ]),
                }
              : {}),
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error ?? "Không nộp được bài. Vui lòng thử lại.");
        submitLock.current = false;
        return;
      }
      const data = (await res.json()) as TrialSubmitResult;
      setTrialResult(data);
      setResult({
        scorePct: data.scorePct,
        correctCount: data.score,
        total: data.total,
        passed: data.passed,
        promoted: !!data.promoted,
      });
      setShowResultModal(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Có lỗi xảy ra khi nộp bài.");
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(force = false) {
    if (submitLock.current) return;
    if (isTrial) return handleSubmitTrial(force);
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
        // Thi thu cham bang diem dat cua dung cap dang soi de.
        body: JSON.stringify({ answers: payload, examToken, levelId: mock ? mockLevelId ?? null : undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.error ?? "Không nộp được bài. Vui lòng thử lại.");
        // Nộp hỏng thì LUÔN mở khoá, kể cả lần tự nộp lúc hết giờ. Trước đây
        // khoá luôn: mạng chập đúng giây tự nộp là nút Nộp bài chết hẳn, người
        // thi ngồi nhìn bài mình mà không gửi đi được. Đồng hồ không bắn lại
        // nữa vì đã có autoSubmitTried, nên mở khoá ở đây là an toàn.
        submitLock.current = false;
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

  // ── Tự lưu bài đang làm ──────────────────────────────────────────────────
  // Đáp án nằm trong bộ nhớ trình duyệt cho tới lúc bấm nộp, nên hết giờ nộp
  // không kịp / mất mạng / sập trình duyệt là mất trắng cả bài. Cứ vài giây ghi
  // một lần lên server để còn chấm lại được — xem app/api/exam/autosave.
  //
  // Thi thử không lưu: bài của Admin vốn không ghi vào đâu cả.
  const saveAnswers = useCallback(
    async (payload: Record<string, string>, viaBeacon = false) => {
      if (mock) return;
      const body = JSON.stringify({ answers: payload });
      try {
        if (viaBeacon) {
          // Rời trang: gửi kiểu "bắn rồi quên" để yêu cầu vẫn đi dù tab đóng ngay.
          await fetch("/api/exam/autosave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          });
          return;
        }
        setSaveState("saving");
        const res = await fetch("/api/exam/autosave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        // Mạng chập thì thôi, lần chọn đáp án sau sẽ lưu lại cả bài.
        if (!viaBeacon) setSaveState("error");
      }
    },
    [mock]
  );

  /**
   * Ghi bài dở của đề thử thách. Cùng đường tự lưu với đề trắc nghiệm, chỉ khác
   * hình dạng gói tin — xem app/api/exam/autosave.
   */
  const saveTrial = useCallback(
    async (payload: TrialState, viaBeacon = false) => {
      if (mock) return;
      const body = JSON.stringify({ trialState: payload });
      try {
        if (viaBeacon) {
          await fetch("/api/exam/autosave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          });
          return;
        }
        setSaveState("saving");
        const res = await fetch("/api/exam/autosave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        if (!viaBeacon) setSaveState("error");
      }
    },
    [mock]
  );

/**
   * Trả lời một thẻ: gửi lên máy chủ, khoá lại, hiện hậu quả ngay.
   *
   * KHÔNG đi qua updateTrial() như vòng khay ăn. Vòng khay ăn sửa thoải mái rồi
   * hẹn giờ tự lưu; thẻ thì bấm một lần là xong, và chính máy chủ ghi bài làm
   * xuống ngay trong lượt gọi này — không có khoảng chờ tự lưu nào để mất.
   */
  async function answerCard(roundId: string, cardId: string, zone: SortZone) {
    if (pendingCard) return;
    setPendingCard(cardId);
    setCardError(null);
    try {
      const res = await fetch("/api/exam/trial-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          zone,
          ...(mock ? { mock: true, levelId: mockLevelId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCardError(data.error ?? "Không gửi được thẻ này. Thử lại nhé.");
        return;
      }
      setCardOutcomes((prev) => ({ ...prev, [cardId]: data.ratio }));
      setTrialState((prev) => {
        const next = { ...prev, [roundId]: { ...(prev[roundId] ?? {}), [cardId]: zone } };
        trialRef.current = next;
        return next;
      });
    } catch {
      setCardError("Mất kết nối. Thử lại nhé.");
    } finally {
      setPendingCard(null);
    }
  }


  /** Sửa bài làm một vòng: cập nhật ngay, hẹn giờ ghi xuống server. */
  function updateTrial(roundId: string, key: string, value: TrialCell) {
    setTrialState((prev) => {
      const next = { ...prev, [roundId]: { ...(prev[roundId] ?? {}), [key]: value } };
      trialRef.current = next;
      return next;
    });
    if (mock) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveTrial(trialRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /** Chọn một đáp án: cập nhật giao diện ngay, hẹn giờ ghi xuống server. */
  function pickAnswer(questionId: string, option: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: option };
      answersRef.current = next;
      return next;
    });
    if (mock) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveAnswers(answersRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  // Rời trang thì ghi nốt phần chưa kịp lưu — đây chính là lúc dễ mất bài nhất.
  useEffect(() => {
    if (mock || result || (questions.length === 0 && !isTrial)) return;
    function flush() {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      // Đề nhiều vòng lưu ở trialState, đề trắc nghiệm lưu ở answers.
      if (isTrial) {
        if (Object.keys(trialRef.current).length === 0) return;
        saveTrial(trialRef.current, true);
        return;
      }
      if (Object.keys(answersRef.current).length === 0) return;
      saveAnswers(answersRef.current, true);
    }
    function onHide() {
      if (document.hidden) flush();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [mock, result, questions.length, saveAnswers, saveTrial, isTrial]);

  // Dọn hẹn giờ tự lưu khi rời trang.
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  /** Dải nhắc giờ — hiện rồi tự tắt, lần nhắc mới đè lên lần cũ. */
  function popTimeToast(minutes: number) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setTimeToast(minutes);
    toastTimer.current = setTimeout(() => setTimeToast(null), REMINDER_TOAST_MS);
  }

  // Đồng hồ đếm ngược. Đếm theo mốc tuyệt đối chứ không trừ dần, để tab bị ẩn
  // rồi mở lại (trình duyệt bóp nhịp setInterval) vẫn ra đúng thời gian còn lại.
  useEffect(() => {
    if (endsAt == null || result) return;
    function tick() {
      const left = Math.max(0, endsAt! - Date.now());
      setRemainingMs(left);
      if (left === 0) {
        // Hết giờ là nộp, không hỏi han gì thêm — câu chưa làm cũng nộp. Chỉ
        // thử đúng một lần; hỏng thì người thi bấm Nộp bài lại bằng tay.
        if (!submitLock.current && !autoSubmitTried.current) {
          autoSubmitTried.current = true;
          setAutoSubmitted(true);
          handleSubmit(true);
        }
        return;
      }

      // Nhắc giờ theo từng mốc phút. Math.ceil nên "còn 10 phút" ứng với quãng
      // (9:00, 10:00] — vừa chạm 10:00 là nhắc, và chỉ nhắc một lần cho mốc đó.
      const minutesLeft = Math.ceil(left / 60_000);
      if (
        minutesLeft <= REMIND_FROM_MINUTES &&
        minutesLeft >= 1 &&
        !firedMarks.current.has(minutesLeft)
      ) {
        const isFirst = firedMarks.current.size === 0;
        // Bị trừ giờ vì rời trang có thể nhảy qua vài mốc cùng lúc — đánh dấu
        // luôn các mốc đã vượt, không dội một loạt nhắc dồn vào mặt người thi.
        for (let m = minutesLeft; m <= REMIND_FROM_MINUTES; m++) {
          firedMarks.current.add(m);
        }
        if (isFirst) setTimeWarning(minutesLeft);
        else popTimeToast(minutesLeft);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, result, questions, answers, examToken]);

  // Dọn hẹn giờ của dải nhắc khi rời trang.
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

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
    if (mock || result || (questions.length === 0 && !isTrial) || focusPenaltyMinutes <= 0) return;

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
  }, [mock, result, questions.length, focusPenaltyMinutes, isTrial]);

  // Đóng tab / F5 giữa chừng thì hỏi lại một câu. Tải lại không bốc được đề mới
  // và cũng không được cấp thêm giờ, nhưng người thi không biết điều đó nên cứ
  // nhắc — đỡ một phen hoảng.
  useEffect(() => {
    if (mock || result || (questions.length === 0 && !isTrial)) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mock, result, questions.length, isTrial]);

  function goToQuestion(id: string) {
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const answeredCount = Object.keys(answers).length;

  // ── Tiến độ đề thử thách ──────────────────────────────────────────────────
  // Vòng Phàm ăn coi là xong khi khay có ít nhất một món; vòng Sa ngã khi mọi
  // thẻ đã được xếp. Chưa xong hết thì nút Nộp bài chưa mở — nhưng hết giờ vẫn
  // tự nộp như thường, phần bỏ trống tính 0 điểm.
  const roundDone = (r: TrialRound) => {
    const st = trialState[r.id] ?? {};
    if (r.type === "MEAL") {
      return r.briefs.every((b) => {
        const v = st[b.id];
        return Array.isArray(v) && v.length > 0;
      });
    }
    // Cạn Thanh danh cũng là XONG vòng, dù còn thẻ chưa bấm: máy chủ không nhận
    // thêm thẻ nào của vòng đó nữa. Không tính thế thì người ta bị kẹt luôn ở
    // vòng mình vừa hỏng, không sang được vòng sau mà cũng không nộp được bài.
    if (r.type === "PROGRAM") {
      return r.cases.every((c) => {
        const v = st[c.id];
        return Array.isArray(v) && v.length > 0;
      });
    }
    return r.cards.every((c) => typeof st[c.id] === "string") || roundCollapsed(r);
  };
  /**
   * Luật trừ Thanh danh của một vòng: vòng của tội đã khai chạy thang riêng,
   * nặng hơn ở từng thẻ và có thể có bảng mốc riêng.
   */
  function honorRulesOf(r: TrialRound) {
    return honorRulesFor({
      base: honorBase,
      declared: !!declaredSin && r.sin === declaredSin,
      declaredSetup,
    });
  }

  /** Vòng phân loại đã cạn Thanh danh — tính bằng đúng hàm máy chủ dùng lúc chấm. */
  function roundCollapsed(r: TrialRound) {
    if (r.type !== "SORT") return false;
    const st = trialState[r.id] ?? {};
    // Đi theo ĐÚNG thứ tự thẻ đã phát: phần trừ lũy tiến phụ thuộc chuỗi sai
    // liền nhau, nên cộng dồn rời rạc từng thẻ sẽ ra một con số khác.
    return (
      honorAfter(
        r.cards.map((c) => {
          const answered = typeof st[c.id] === "string" && cardOutcomes[c.id] !== undefined;
          return { answer: answered ? (st[c.id] as SortZone) : null, ratio: cardOutcomes[c.id] ?? 0 };
        }),
        honorRulesOf(r)
      ) <= 0
    );
  }
  /**
   * ── CẠN THANH DANH Ở VÒNG KHAI = KỲ THI DỪNG TẠI ĐÂY ──────────────────────
   *
   * Trượt vòng đã khai là trượt cả kỳ, dù các vòng khác có tốt tới đâu
   * (scoreTrial.declaredFailed). Bắt người ta ngồi làm nốt hai vòng nữa chỉ để
   * nhận một kết quả đã chốt từ trước là vô nghĩa với cả họ lẫn người chấm.
   *
   * Cạn thanh là cách DUY NHẤT biết được điều đó ngay giữa chừng: trượt vòng
   * khai vì thiếu điểm thì phải chấm xong mới biết, mà lúc đó bài đã nộp rồi.
   * Vòng khai là Case Study thì không có thanh Thanh danh nên không có nhánh này.
   */
  const declaredRound = rounds.find((r) => !!declaredSin && r.sin === declaredSin) ?? null;
  const trialHalted = !!declaredRound && roundCollapsed(declaredRound);

  const trialDoneCount = rounds.filter(roundDone).length;
  // Dừng kỳ thi thì coi như đã xong — nút Nộp bài phải mở, không thì người ta
  // kẹt lại trong một bài thi đã kết thúc mà không nộp được.
  const trialComplete = rounds.length > 0 && (trialHalted || trialDoneCount === rounds.length);

  // ── Mở khoá tuần tự ────────────────────────────────────────────────────────
  // Vòng của tội đã khai đứng đầu (server sắp xếp), và vòng sau chỉ mở khi vòng
  // trước đã xong. Vòng ĐÃ XONG vẫn quay lại sửa được — chặn đi tới chứ không
  // chặn nhìn lại, vì nhận ra mình đọc sót một dòng ở hồ sơ trước không đáng bị
  // phạt bằng cách khoá luôn.
  const firstUnfinished = rounds.findIndex((r) => !roundDone(r));
  const unlockedCount = trialHalted
    ? rounds.indexOf(declaredRound) + 1
    : firstUnfinished === -1
      ? rounds.length
      : firstUnfinished + 1;
  // Xoá bớt bài ở vòng trước có thể khoá lại chính vòng đang xem — kéo về vòng
  // gần nhất còn mở thay vì để màn hình trống.
  const safeRoundIdx = Math.min(roundIdx, unlockedCount - 1);
  const currentRound: TrialRound | null = rounds[safeRoundIdx] ?? null;
  const nextLockedIdx = safeRoundIdx + 1 < rounds.length ? safeRoundIdx + 1 : -1;
  // Đề nhiều vòng dùng tiến độ vòng thay cho số câu đã trả lời.
  // Thi thử được nộp non: Admin thường chỉ muốn soi một vòng, bắt làm đủ cả đề
  // mỗi lần kiểm một câu chữ thì chẳng ai kiểm nữa.
  const allAnswered = mock ? true : isTrial ? trialComplete : answeredCount === questions.length;
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

  // ── Nhịp giữa hai vòng: cây Kabbalah ──────────────────────────────────────
  // Xong một vòng thì dừng lại một nhịp, thấy sephirah của tội vừa vượt qua
  // sáng lên, rồi mới sang vòng kế. Không cho quay về vòng cũ — đúng như đã
  // chốt: mỗi lần chỉ nhìn thấy một vòng.
  if (advanceFrom) {
    const doneIdx = rounds.findIndex((r) => r.id === advanceFrom.id);
    const next = rounds[doneIdx + 1] ?? null;
    const litNow = rounds
      .slice(0, doneIdx + 1)
      .map((r) => (r.sin ? SIN_SEPHIRAH[r.sin] : 0))
      .filter(Boolean);
    return (
      <div className="mx-auto max-w-lg pb-16 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Đã xong vòng</p>
        <h1 className="mt-1 text-2xl font-extrabold" style={{ color: "#f15b5c" }}>
          {advanceFrom.name}
        </h1>

        <div className="my-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <KabbalahTree
            lit={litNow}
            current={advanceFrom.sin ? SIN_SEPHIRAH[advanceFrom.sin] : null}
            caption={
              advanceFrom.sin === declaredSin
                ? "Bạn vừa đi qua chính tội mình khai. Điểm còn chờ chấm, nhưng chỗ này trên cây đã sáng."
                : "Một chỗ nữa trên cây vừa sáng lên."
            }
          />
        </div>

        {next ? (
          <>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
              Vòng tiếp theo: <span className="font-extrabold text-gray-700">{next.name}</span>
            </p>
            <button
              onClick={() => {
                setRoundIdx(doneIdx + 1);
                setAdvanceFrom(null);
              }}
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl px-7 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Vào vòng {next.name}
            </button>
          </>
        ) : (
          <>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
              Bạn đã đi hết các vòng của đề này.
            </p>
            <button
              onClick={() => setAdvanceFrom(null)}
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl px-7 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#f15b5c" }}
            >
              Xem lại rồi nộp bài
            </button>
          </>
        )}
      </div>
    );
  }

  // Khai tội xong mới được xem đề — server chưa gửi vòng nào xuống ở bước này.
  if (needsDeclaration) {
    return (
      <TrialDeclareSin
        levelName={levelName}
        options={sinOptions}
        declaredSetup={declaredSetup}
        honorBase={honorBase}
        mock={mock}
        onDeclared={(sin) => {
          setLoading(true);
          // Thi thử: chốt ở bộ nhớ rồi tải lại đề. Bài thật đã ghi vào lượt thi
          // ở /api/exam/declare-sin nên chỉ cần tải lại.
          if (mock) setMockSin(sin);
          else setReloadKey((k) => k + 1);
        }}
      />
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
            {/* Mỗi cấp một đề riêng nên phải nói rõ đây là đề nào */}
            {levelName ? `Đề ${levelName} — ` : ""}Điểm đạt: {passingScore}% —{" "}
            {isTrial ? `${rounds.length} vòng thử thách` : `${questions.length} câu hỏi`}
          </p>
        </div>
        {!result && (
          <div className="shrink-0 text-right">
            {/* Đồng hồ NGAY TRÊN ĐẦU BÀI.
                Trước đây nó chỉ nằm trong bảng theo dõi câu hỏi, mà bảng đó bị
                ẩn với đề nhiều vòng — server vẫn đếm giờ và vẫn tự nộp khi hết,
                nhưng người thi không thấy gì. Giờ để ở đây cho cả hai dạng đề. */}
            {remainingMs != null && (
              <div className="mb-1 flex justify-end">
                <CountdownChip ms={remainingMs} />
              </div>
            )}
            <p className="text-sm font-bold text-gray-700">
              {isTrial ? `${trialDoneCount}/${rounds.length}` : `${answeredCount}/${questions.length}`}
            </p>
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {isTrial ? "vòng đã xong" : "đã trả lời"}
            </p>
            {!mock && saveState !== "idle" && (
              <p
                className={cn(
                  "mt-0.5 flex items-center justify-end gap-1 text-[11px] font-bold whitespace-nowrap",
                  saveState === "error" ? "text-amber-600" : "text-gray-400"
                )}
                title={
                  saveState === "error"
                    ? "Chưa ghi được lên máy chủ — chọn thêm đáp án sẽ tự thử lại"
                    : "Bài của bạn được lưu tự động trên máy chủ"
                }
              >
                {saveState === "error" ? (
                  <>
                    <CloudOff className="h-3 w-3" /> Chưa lưu được
                  </>
                ) : (
                  <>
                    <Cloud className="h-3 w-3" />
                    {saveState === "saving" ? "Đang lưu..." : "Đã lưu"}
                  </>
                )}
              </p>
            )}
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
              {result.scorePct}% —{" "}
              {/* Đề nhiều vòng tính bằng ĐIỂM, không phải số câu đúng. */}
              {isTrial
                ? `${result.correctCount}/${result.total} điểm`
                : `đúng ${result.correctCount}/${result.total} câu`}
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
              width: isTrial
                ? `${rounds.length > 0 ? (trialDoneCount / rounds.length) * 100 : 0}%`
                : questions.length > 0
                  ? `${(answeredCount / questions.length) * 100}%`
                  : "0%",
              backgroundColor: "#f15b5c",
            }}
          />
        </div>
      )}

      {/* ── Đề thử thách: MỖI LẦN MỘT VÒNG ──────────────────────────────────
          Không bày các vòng khác ra cạnh, kể cả dạng đã khoá. Thấy vòng sau
          nằm chờ sẵn là người thi đã bắt đầu tính đường cho nó thay vì dồn
          sức vào vòng đang làm. Xong một vòng thì đi qua màn cây Kabbalah rồi
          mới sang vòng kế. */}
      {isTrial ? (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Vòng {safeRoundIdx + 1}/{rounds.length}
          </p>

          {currentRound && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold text-gray-900">{currentRound.name}</p>
                  {currentRound.sin && currentRound.name !== SIN_LABEL[currentRound.sin] && (
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-[#f15b5c]/10 px-2 py-0.5 text-[11px] font-bold text-[#f15b5c]">
                      {SIN_LABEL[currentRound.sin]}
                    </span>
                  )}
                </div>
                {/* Một dòng, không xuống dòng — màn hẹp trượt ngang */}
                <div className={SLIDER_ROUNDS}>
                  <p className="mt-0.5 w-max whitespace-nowrap text-xs font-semibold text-gray-400">
                    {currentRound.maxPoints} điểm · đạt vòng từ {currentRound.passPercent}% · trượt bị trừ {currentRound.failPenalty} điểm
                  </p>
                </div>
                {declaredSin && currentRound.sin === declaredSin && (
                  <p className="mt-2 rounded-xl bg-[#f15b5c]/10 px-3 py-2 text-xs font-bold leading-snug text-[#f15b5c]">
                    ★ Đây là tội bạn đã khai, nên nó đứng đầu — phải đối mặt trước đã.
                    Vòng này điểm nhân đôi, ngưỡng đạt cao hơn, và bắt buộc phải qua:
                    trượt vòng này là trượt cả kỳ.
                  </p>
                )}
                {currentRound.intro && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                    {currentRound.intro}
                  </p>
                )}
              </div>

              {currentRound.type === "PROGRAM" ? (
                <div className="space-y-5">
                  {currentRound.cases.map((pc, i) => (
                    <div key={pc.id}>
                      {currentRound.cases.length > 1 && (
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                          Hồ sơ {i + 1}/{currentRound.cases.length}
                        </p>
                      )}
                      <ProgramRound
                        programCase={pc}
                        entries={(trialState[currentRound.id]?.[pc.id] as ProgramEntry[]) ?? []}
                        disabled={!!result}
                        onChange={(next) => updateTrial(currentRound.id, pc.id, next)}
                      />
                    </div>
                  ))}
                </div>
              ) : currentRound.type === "MEAL" ? (
                <div className="space-y-6">
                  {currentRound.briefs.map((brief, i) => (
                    <div key={brief.id}>
                      {currentRound.briefs.length > 1 && (
                        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#f15b5c]">
                          Hồ sơ {i + 1}/{currentRound.briefs.length}
                        </p>
                      )}
                      <MealRound
                        brief={brief}
                        entries={(trialState[currentRound.id]?.[brief.id] as MealEntry[]) ?? []}
                        disabled={!!result}
                        onChange={(next) => updateTrial(currentRound.id, brief.id, next)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <SortRound
                  cards={currentRound.cards}
                  answers={
                    Object.fromEntries(
                      Object.entries(trialState[currentRound.id] ?? {}).filter(
                        ([, v]) => typeof v === "string"
                      )
                    ) as Record<string, SortZone>
                  }
                  outcomes={cardOutcomes}
                  rules={honorRulesOf(currentRound)}
                  pendingCardId={pendingCard}
                  error={cardError}
                  disabled={!!result}
                  onAnswer={(cardId, zone) => answerCard(currentRound.id, cardId, zone)}
                />
              )}
            </div>
          )}

          {/* ── Kỳ thi dừng vì cạn Thanh danh ở vòng khai ──────────────────
              Nói thẳng là hết, và vì sao. Để im thì người ta ngồi tìm nút sang
              vòng sau, tưởng màn hình hỏng. */}
          {trialHalted && !result && declaredRound && (
            <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-center">
              <Skull className="mx-auto h-9 w-9 text-red-400" />
              <p className="mt-2 text-lg font-extrabold text-red-700">Kỳ thi dừng tại đây</p>
              <p className="mx-auto mt-1.5 max-w-md text-xs font-semibold leading-relaxed text-red-600">
                Bạn đã cạn Thanh danh ở <b>{declaredRound.name}</b> — chính đại tội bạn tự khai.
                Trượt vòng đã khai là trượt cả kỳ, nên{" "}
                {rounds.length - 1 > 0 ? `${rounds.length - 1} vòng còn lại` : "phần còn lại"} không
                cần làm nữa. Bấm Nộp bài để xem kết quả.
              </p>
            </div>
          )}

          {/* Xong vòng này thì đi qua màn cây Kabbalah, rồi mới sang vòng sau.
              Vòng cuối không có nút này — chỗ đó là nút Nộp bài. */}
          {currentRound && !result && !trialHalted && nextLockedIdx !== -1 && (
            <button
              onClick={() => setAdvanceFrom(currentRound)}
              disabled={!roundDone(currentRound)}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition-colors",
                roundDone(currentRound)
                  ? "text-white"
                  : "cursor-not-allowed bg-gray-100 text-gray-400"
              )}
              style={roundDone(currentRound) ? { backgroundColor: "#f15b5c" } : undefined}
            >
              {roundDone(currentRound)
                ? `Sang vòng ${rounds[nextLockedIdx].name}`
                : `Làm xong vòng này mới mở được vòng sau`}
            </button>
          )}

          {/* Soi lại đề — CHỈ có ở thi thử. Người soạn đề cần thấy đáp án đúng
              và lời giải mới biết đề mình ra có chuẩn không. */}
          {trialResult?.review && (
            <div className="space-y-3">
              <p className="text-sm font-extrabold text-gray-900">Soi lại đề</p>
              {trialResult.review.map((rv) => (
                <div key={rv.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-3">
                    <span className="min-w-0 truncate text-sm font-extrabold text-gray-800">{rv.name}</span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums text-gray-700">
                      {rv.points}/{rv.maxPoints}
                    </span>
                  </div>

                  {/* Vòng dựng giáo án: chỉ tiêu số set, mẫu vận động còn thiếu */}
                  {rv.cases.map((c, i) => (
                    <div key={c.id} className="border-b border-gray-50 px-4 py-3 last:border-0">
                      <p className="text-xs font-extrabold text-[#f15b5c]">Hồ sơ {i + 1}</p>
                      {c.usedBanned.length > 0 && (
                        <p className="mt-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600">
                          Dùng bài chống chỉ định ({c.usedBanned.join(", ")}) — mất trắng hồ sơ này
                        </p>
                      )}
                      {c.missingPatterns.length > 0 && (
                        <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700">
                          Thiếu mẫu vận động: {c.missingPatterns.join(", ")}
                        </p>
                      )}
                      <div className={cn(SLIDER_ROUNDS, "mt-1.5")}>
                        <div className="flex w-max gap-2">
                          {c.metrics.map((m) => (
                            <span
                              key={m.metric}
                              className={cn(
                                "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold",
                                m.ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                              )}
                            >
                              {m.metric}: {m.actual} · cần {m.min}–{m.max} {m.ok ? "✓" : "✗"}
                            </span>
                          ))}
                        </div>
                      </div>
                      {c.explanation && (
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-500">
                          {c.explanation}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Vòng dựng khay ăn: từng chỉ tiêu đạt hay trượt */}
                  {rv.briefs.map((b, i) => (
                    <div key={b.id} className="border-b border-gray-50 px-4 py-3 last:border-0">
                      <p className="text-xs font-extrabold text-[#f15b5c]">Hồ sơ {i + 1}</p>
                      {b.usedBanned.length > 0 && (
                        <p className="mt-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600">
                          Dùng món cấm ({b.usedBanned.join(", ")}) — mất trắng hồ sơ này
                        </p>
                      )}
                      <div className={cn(SLIDER_ROUNDS, "mt-1.5")}>
                        <div className="flex w-max gap-2">
                          {b.metrics.map((m) => (
                            <span
                              key={m.metric}
                              className={cn(
                                "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold",
                                m.ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                              )}
                            >
                              {m.metric}: {m.actual} · cần {m.min}–{m.max} {m.ok ? "✓" : "✗"}
                            </span>
                          ))}
                        </div>
                      </div>
                      {b.explanation && (
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-gray-500">
                          {b.explanation}
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Vòng phân loại: bạn chọn gì, đúng là gì */}
                  {rv.cards.map((c, i) => (
                    <div key={c.id} className="border-b border-gray-50 px-4 py-3 last:border-0">
                      <p className="text-sm font-medium leading-relaxed text-gray-800">
                        <span className="mr-1.5 font-bold text-gray-300">{i + 1}.</span>
                        {c.text}
                      </p>
                      <div className={cn(SLIDER_ROUNDS, "mt-2")}>
                        <div className="flex w-max items-center gap-2">
                          <span
                            className={cn(
                              "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-bold",
                              c.ratio === 1
                                ? "bg-emerald-50 text-emerald-600"
                                : c.ratio > 0
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-red-50 text-red-500"
                            )}
                          >
                            Bạn chọn: {c.answer ? SORT_ZONE_LABEL[c.answer] : "bỏ trống"}
                          </span>
                          <span className="shrink-0 whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
                            Đúng: {SORT_ZONE_LABEL[c.correct]}
                          </span>
                        </div>
                      </div>
                      {c.explanation && (
                        <p className="mt-2 text-xs leading-relaxed text-gray-500">{c.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Hành trình trên cây — bậc đạt được đổi bằng việc thật, không phải
              trang trí: khai tội (Yesod) · vượt qua vòng đã khai (Tiphareth) ·
              đạt cả kỳ (Kether). Xem journeyStep() trong lib/exam-trial.ts. */}
          {trialResult && (
            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-5">
              <KabbalahTree
                lit={litSephirot(trialResult, rounds)}
                current={trialResult.passed ? KETHER : null}
                caption={
                  trialResult.declaredFailed
                    ? "Chỗ của tội bạn khai vẫn tối — đó là chỗ phải quay lại."
                    : trialResult.passed
                      ? "Đã qua lý thuyết. Ba ô trên Vực Thẳm là phần còn lại của con đường lên cấp."
                      : "Sephirot sáng là những tội bạn đã vượt qua."
                }
                detail
              />

              {/* Cây nói được chỗ nào sáng, nhưng không nói vì sao. Bảng này
                  mới trả lời: ô đó đo mảng năng lực gì, ghép vào tội nào, và
                  lượt thi vừa rồi để lại kết quả ra sao. */}
              <button
                onClick={() => setLegendOpen((v) => !v)}
                className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              >
                {legendOpen ? "Ẩn chú giải cây" : "Xem chú giải đủ 10 ô"}
                {legendOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {legendOpen && (
                <KabbalahLegend
                  lit={litSephirot(trialResult, rounds)}
                  status={sephirahStatus(trialResult, rounds)}
                  className="mt-3"
                />
              )}
            </div>
          )}

          {/* Trượt vòng đã khai thì phải nói thẳng lý do, đừng để người ta ngồi
              cộng điểm rồi không hiểu vì sao tổng đẹp mà vẫn trượt. */}
          {trialResult?.declaredFailed && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5">
              <p className="text-sm font-extrabold text-red-700">
                Trượt vòng của tội đã khai
                {trialResult.declaredSin ? ` — ${SIN_LABEL[trialResult.declaredSin]}` : ""}
              </p>
              <p className="mt-1 text-xs font-semibold leading-snug text-red-600">
                Vòng này bắt buộc phải qua nên cả kỳ tính là chưa đạt, dù tổng điểm có đủ.
                Đó là điều bạn nhận về khi tự khai mảng mình yếu — và cũng là chỗ đáng để
                luyện nhất trước kỳ sau.
              </p>
            </div>
          )}

          {/* Chân dung huấn luyện: nghiêng về trụ nào khi làm sai */}
          {trialResult?.pillar && (
            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Chân dung huấn luyện
              </p>
              <p className="mt-1 text-sm font-extrabold text-gray-800">
                Bạn nghiêng về: {PILLAR_LABEL[trialResult.pillar]}
              </p>
              <p className="mt-1 text-xs leading-snug text-gray-500">
                Đọc theo hướng lệch của những chỗ bạn làm sai — không phải điểm số, và không
                có trụ nào là sai. Nó cho biết khi phải quyết nhanh thì bạn ngả về đâu.
              </p>
            </div>
          )}

          {/* Bảng điểm từng vòng sau khi nộp — hỏng ở vòng nào thấy ngay vòng đó */}
          {trialResult && (
            <div className="overflow-hidden rounded-2xl border border-gray-100">
              {trialResult.rounds.map((rr) => {
                const r = rounds.find((x) => x.id === rr.roundId);
                return (
                  <div
                    key={rr.roundId}
                    className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-3 last:border-0"
                  >
                    <span className="min-w-0 truncate text-sm font-bold text-gray-700">
                      {r?.name ?? "Vòng"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-extrabold tabular-nums text-gray-800">
                        {rr.points}/{rr.maxPoints}
                      </span>
                      {rr.passed ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                          Đạt
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-500">
                          Trượt −{rr.penalty}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : reviewing && canReview ? (
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
                      onClick={() => pickAnswer(q.id, opt)}
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
      {/* Đề nhiều vòng không dùng bảng này: thanh chuyển vòng ở đầu trang đã làm
          đúng việc đó, mà bảng lại đếm theo câu hỏi nên sẽ hiện 0/0. */}
      {!result && !isTrial && (
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
      {!result && !isTrial && (
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

      {/* ── Nhắc giờ: dải tự tắt ở mỗi mốc phút ── */}
      {timeToast !== null && !result && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[65] w-[min(92vw,26rem)] -translate-x-1/2">
          <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
            <AlarmClock className="h-5 w-5 shrink-0 animate-pulse text-red-500" />
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-red-700">
                Còn {timeToast} phút làm bài
              </p>
              <p className="text-xs font-semibold text-gray-600">
                {!allAnswered
                  ? isTrial
                    ? `Còn ${rounds.length - trialDoneCount} vòng chưa xong — hết giờ hệ thống tự nộp.`
                    : `Còn ${questions.length - answeredCount} câu chưa làm — hết giờ hệ thống tự nộp.`
                  : isTrial
                    ? "Đã xong hết các vòng, bấm Nộp bài khi sẵn sàng."
                    : "Đã làm hết các câu, bấm Nộp bài khi sẵn sàng."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Nhắc giờ: hộp thoại báo trước, hiện một lần ở mốc đầu tiên ── */}
      {timeWarning !== null && !result && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-amber-50 px-6 py-7 text-center">
              <AlarmClock className="mx-auto mb-3 h-12 w-12 text-amber-500" />
              <p className="text-lg font-extrabold text-amber-700">
                Còn {timeWarning} phút làm bài
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-600">
                Hết giờ hệ thống sẽ <span className="font-extrabold">tự nộp bài</span>, kể cả
                khi bạn còn câu chưa làm.
              </p>
              {!allAnswered && (
                <p className="mt-2 text-sm font-extrabold text-red-600">
                  {isTrial
                    ? `Bạn còn ${rounds.length - trialDoneCount} vòng chưa xong.`
                    : `Bạn còn ${questions.length - answeredCount} câu chưa làm.`}
                </p>
              )}
            </div>
            <div className="px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 leading-snug">
                Từ giờ tới lúc hết, mỗi phút hệ thống sẽ nhắc bạn một lần.
              </p>
              <button
                onClick={() => setTimeWarning(null)}
                className="mt-4 h-11 w-full rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f15b5c" }}
              >
                Tôi đã rõ, làm tiếp
              </button>
            </div>
          </div>
        </div>
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

      {trackerOpen && !result && !isTrial && (
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
                  <p className="mt-0.5 text-xs font-semibold text-gray-400">
                    {isTrial ? "Điểm đạt được" : "Câu đúng"}
                  </p>
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
