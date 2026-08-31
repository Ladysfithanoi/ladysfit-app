"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Settings,
  ClipboardList,
  Upload,
  CalendarClock,
  Lock,
  Unlock,
  AlertCircle,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Eye,
  FlaskConical,
  ShieldCheck,
  Search,
  EyeOff,
  LifeBuoy,
  Clock,
  Unlock as UnlockIcon,
  UserCog,
  RotateCcw,
  TimerReset,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format-date";
import { fmtExamDate, todayVN, type ExamWindowState } from "@/lib/exam-schedule";
import { ExamImportModal } from "./exam-import-modal";
import { QuestionMedia, QuestionMediaFields } from "./question-media";
import { QuestionPreview } from "./question-preview";

type Question = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: string;
  order: number;
  createdAt: string;
  imageUrl: string | null;
  videoUrl: string | null;
};

type Config = {
  numQuestions: number;
  passingScore: number;
  shuffleQuestions: boolean;
  scheduleEnabled: boolean;
  examDate: string | null;
  examStartTime: string;
  examEndTime: string;
  durationMinutes: number;
  focusPenaltyMinutes: number;
  rankWeightExam: number;
  rankWeightRevenue: number;
  rankWeightTransform: number;
};

type RosterRow = {
  userId: string;
  name: string | null;
  email: string;
  levelName: string | null;
  levelColor: string | null;
  score: number | null;
  total: number | null;
  scorePct: number;
  passed: boolean;
  takenAt: string | null;
  /** Số lần rời khỏi trang thi trong lúc làm bài. */
  violations: number;
};

// FM bắt buộc thi: Admin tick tên ai phải làm bài. Điểm chỉ để nắm chuyên môn
// nên không có cột "vắng thi 0 điểm" như bảng HLV — xem lib/exam-required-fm.ts.
type FMRow = {
  userId: string;
  name: string | null;
  email: string;
  branchName: string | null;
  required: boolean;
  score: number | null;
  total: number | null;
  scorePct: number | null;
  passed: boolean;
  takenAt: string | null;
  violations: number;
};

/**
 * Một người trong bảng "Quyền vào thi từng người" của kỳ đang đặt lịch.
 * Gộp ba nguồn: khoá tay của Admin, lượt thi đang mở, và bài đã chấm.
 */
type AccessRow = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  branchName: string | null;
  blocked: boolean;
  startedAt: string | null;
  endsAt: string | null;
  submittedAt: string | null;
  savedCount: number;
  scorePct: number | null;
  passed: boolean;
  takenAt: string | null;
};

type Attempt = {
  id: string;
  userId: string;
  score: number;
  total: number;
  passed: boolean;
  createdAt: string;
  /** Số lần rời khỏi trang thi trong lúc làm bài. */
  violations: number;
  user: { id: string; name: string | null; email: string; role: string };
};

const CORRECT_OPTIONS = ["A", "B", "C", "D"];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  FM: "FM",
  PT: "Huấn luyện viên",
};

const TABS = [
  { key: "bank", label: "Ngân hàng câu hỏi", icon: FileText },
  { key: "schedule", label: "Lịch thi", icon: CalendarClock },
  { key: "config", label: "Cấu hình", icon: Settings },
  { key: "results", label: "Kết quả thi", icon: ClipboardList },
] as const;

type Tab = typeof TABS[number]["key"];

const PAGE_SIZE = 10;

// Hàng tab/nút trên màn hẹp: trượt ngang thay vì xuống dòng làm ô to, hàng lệch.
const SLIDER =
  "w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full";

// Ba tiêu chí tính điểm xếp hạng — chỉnh trọng số ngay tại đây
const WEIGHT_FIELDS = [
  { key: "rankWeightExam", label: "Điểm thi lý thuyết", hint: "% bài thi gần nhất trong năm" },
  { key: "rankWeightRevenue", label: "Doanh số trung bình", hint: "TB doanh số/tháng so với người cao nhất" },
  { key: "rankWeightTransform", label: "Số khách transform", hint: "So với người có nhiều transform nhất" },
] as const;

const WINDOW_BADGE: Record<ExamWindowState, { label: string; cls: string }> = {
  DISABLED: { label: "Đang đóng", cls: "bg-gray-100 text-gray-500" },
  NOT_SCHEDULED: { label: "Chưa đặt ngày", cls: "bg-amber-50 text-amber-600" },
  BEFORE: { label: "Sắp diễn ra", cls: "bg-blue-50 text-blue-600" },
  OPEN: { label: "Đang mở thi", cls: "bg-emerald-50 text-emerald-600" },
  AFTER: { label: "Đã kết thúc", cls: "bg-gray-100 text-gray-500" },
};

const emptyForm = {
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correct: "A",
  // Ảnh / video minh hoạ — để trống là câu hỏi chỉ có chữ.
  imageUrl: "",
  videoUrl: "",
};

export function ExamAdminPage({
  questions: initialQuestions,
  config: initialConfig,
  attempts: initialAttempts,
  windowState,
  roster,
  fms,
  pendingGradeCount,
  accessRows,
}: {
  questions: Question[];
  config: Config;
  attempts: Attempt[];
  windowState: ExamWindowState;
  roster: RosterRow[];
  fms: FMRow[];
  /** Số lượt hết giờ chưa nộp nhưng còn bài đã tự lưu, chấm lại được. */
  pendingGradeCount: number;
  accessRows: AccessRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("bank");
  const [questions, setQuestions] = useState(initialQuestions);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [deletingAttemptId, setDeletingAttemptId] = useState<string | null>(null);
  // Thu lại bài của những người hết giờ mà không nộp được.
  const [gradingPending, setGradingPending] = useState(false);
  const [gradeMsg, setGradeMsg] = useState("");

  // ── Quyền vào thi từng người ─────────────────────────────────────────────
  const [accessSearch, setAccessSearch] = useState("");
  const [accessPage, setAccessPage] = useState(0);
  const [accessBusy, setAccessBusy] = useState<string | null>(null);
  const [accessMsg, setAccessMsg] = useState("");

  // Question form state
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Config state
  const [configForm, setConfigForm] = useState(initialConfig);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState("");

  // Ngân hàng câu hỏi — phân trang. Trang được kẹp lại thay vì reset về 0 để
  // xoá câu cuối cùng của trang cuối không văng người dùng về đầu danh sách.
  const [questionPage, setQuestionPage] = useState(0);
  const questionTotalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const questionSafePage = Math.min(questionPage, questionTotalPages - 1);
  const questionStart = questionSafePage * PAGE_SIZE;
  const pageQuestions = questions.slice(questionStart, questionStart + PAGE_SIZE);

  // Danh sách dự thi — phân trang
  const [rosterPage, setRosterPage] = useState(0);
  const rosterTotalPages = Math.max(1, Math.ceil(roster.length / PAGE_SIZE));
  const pageRoster = roster.slice(rosterPage * PAGE_SIZE, rosterPage * PAGE_SIZE + PAGE_SIZE);

  // Kết quả thi — phân trang
  const [resultsPage, setResultsPage] = useState(0);
  const resultsTotalPages = Math.max(1, Math.ceil(attempts.length / PAGE_SIZE));
  const pageAttempts = attempts.slice(
    resultsPage * PAGE_SIZE,
    resultsPage * PAGE_SIZE + PAGE_SIZE
  );

  const weightTotal =
    configForm.rankWeightExam + configForm.rankWeightRevenue + configForm.rankWeightTransform;
  const weightValid = weightTotal === 100;

  // Schedule state
  const [scheduleForm, setScheduleForm] = useState({
    scheduleEnabled: initialConfig.scheduleEnabled,
    examDate: initialConfig.examDate ?? "",
    examStartTime: initialConfig.examStartTime,
    examEndTime: initialConfig.examEndTime,
    durationMinutes: String(initialConfig.durationMinutes ?? 0),
    focusPenaltyMinutes: String(initialConfig.focusPenaltyMinutes ?? 0),
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  // ── FM bắt buộc thi ──────────────────────────────────────────────────────
  // Danh sách tick giữ trong state, chỉ ghi xuống DB khi bấm Lưu — Admin sửa
  // qua sửa lại vài tên trước khi chốt là chuyện thường.
  const [fmRequired, setFmRequired] = useState<Set<string>>(
    () => new Set(fms.filter((f) => f.required).map((f) => f.userId))
  );
  const [fmSearch, setFmSearch] = useState("");
  const [fmSaving, setFmSaving] = useState(false);
  const [fmSaved, setFmSaved] = useState(false);
  const [fmError, setFmError] = useState("");

  const accessQuery = accessSearch.trim().toLowerCase();
  const visibleAccess = accessQuery
    ? accessRows.filter(
        (r) =>
          (r.name ?? "").toLowerCase().includes(accessQuery) ||
          r.email.toLowerCase().includes(accessQuery) ||
          (r.branchName ?? "").toLowerCase().includes(accessQuery)
      )
    : accessRows;
  const accessTotalPages = Math.max(1, Math.ceil(visibleAccess.length / PAGE_SIZE));
  const accessSafePage = Math.min(accessPage, accessTotalPages - 1);
  const pageAccess = visibleAccess.slice(
    accessSafePage * PAGE_SIZE,
    accessSafePage * PAGE_SIZE + PAGE_SIZE
  );

  const fmQuery = fmSearch.trim().toLowerCase();
  const visibleFms = fmQuery
    ? fms.filter(
        (f) =>
          (f.name ?? "").toLowerCase().includes(fmQuery) ||
          f.email.toLowerCase().includes(fmQuery) ||
          (f.branchName ?? "").toLowerCase().includes(fmQuery)
      )
    : fms;

  // So với lúc mở trang — chưa đổi gì thì không cần bấm Lưu.
  const fmDirty =
    fmRequired.size !== fms.filter((f) => f.required).length ||
    fms.some((f) => f.required !== fmRequired.has(f.userId));

  function toggleFm(userId: string) {
    setFmSaved(false);
    setFmRequired((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSaveRequiredFms() {
    setFmError("");
    setFmSaving(true);
    try {
      const res = await fetch("/api/exam/required-fms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(fmRequired) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFmError(data.error ?? "Không lưu được danh sách FM bắt buộc thi");
        return;
      }
      setFmSaved(true);
      setTimeout(() => setFmSaved(false), 2000);
      router.refresh();
    } finally {
      setFmSaving(false);
    }
  }

  async function handleAddQuestion() {
    if (!form.question.trim() || !form.optionA || !form.optionB || !form.optionC || !form.optionD) return;
    setSaving(true);
    try {
      const res = await fetch("/api/exam/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const created = await res.json();
        setQuestions((prev) => [...prev, created]);
        // Câu mới nằm cuối danh sách — mở đúng trang cuối để thấy nó ngay.
        setQuestionPage(Math.ceil((questions.length + 1) / PAGE_SIZE) - 1);
        setForm(emptyForm);
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateQuestion(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/exam/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
        setEditId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuestion(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/exam/questions/${id}`, { method: "DELETE" });
      if (res.ok) setQuestions((prev) => prev.filter((q) => q.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveConfig() {
    setConfigError("");
    if (!weightValid) {
      setConfigError(`Tổng 3 trọng số phải bằng 100% (hiện tại ${weightTotal}%)`);
      return;
    }
    setConfigSaving(true);
    try {
      const res = await fetch("/api/exam/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Chỉ gửi phần cấu hình bài thi — lịch thi lưu riêng ở tab Lịch thi
        body: JSON.stringify({
          numQuestions: configForm.numQuestions,
          passingScore: configForm.passingScore,
          shuffleQuestions: configForm.shuffleQuestions,
          rankWeightExam: configForm.rankWeightExam,
          rankWeightRevenue: configForm.rankWeightRevenue,
          rankWeightTransform: configForm.rankWeightTransform,
        }),
      });
      const updated = await res.json();
      if (!res.ok) {
        setConfigError(updated.error ?? "Không lưu được cấu hình");
        return;
      }
      setConfigForm((prev) => ({
        ...prev,
        numQuestions: updated.numQuestions,
        passingScore: updated.passingScore,
        shuffleQuestions: updated.shuffleQuestions,
        rankWeightExam: updated.rankWeightExam,
        rankWeightRevenue: updated.rankWeightRevenue,
        rankWeightTransform: updated.rankWeightTransform,
      }));
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
      router.refresh();
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleSaveSchedule() {
    setScheduleError("");
    if (scheduleForm.scheduleEnabled && !scheduleForm.examDate) {
      setScheduleError("Cần chọn ngày thi khi bật lịch thi");
      return;
    }
    setScheduleSaving(true);
    try {
      const res = await fetch("/api/exam/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleEnabled: scheduleForm.scheduleEnabled,
          examDate: scheduleForm.examDate || null,
          examStartTime: scheduleForm.examStartTime,
          examEndTime: scheduleForm.examEndTime,
          durationMinutes: Number(scheduleForm.durationMinutes || 0),
          focusPenaltyMinutes: Number(scheduleForm.focusPenaltyMinutes || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScheduleError(data.error ?? "Không lưu được lịch thi");
        return;
      }
      setScheduleForm({
        scheduleEnabled: data.scheduleEnabled,
        examDate: data.examDate ?? "",
        examStartTime: data.examStartTime,
        examEndTime: data.examEndTime,
        durationMinutes: String(data.durationMinutes ?? 0),
        focusPenaltyMinutes: String(data.focusPenaltyMinutes ?? 0),
      });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
      router.refresh();
    } finally {
      setScheduleSaving(false);
    }
  }

  /**
   * Xoá một bài thi — đây cũng là cách CHO THI LẠI.
   *
   * Mỗi người chỉ thi một lần một kỳ, khoá nằm ở lượt thi phía server. Xoá bài
   * là xoá luôn lượt, nên người đó vào thi lại được (miễn còn trong khung giờ).
   * Bài đã kéo theo thăng cấp thì xoá bài KHÔNG hạ cấp lại — phải sửa tay ở
   * trang Cấp độ.
   */
  async function handleDeleteAttempt(a: Attempt) {
    const who = a.user.name ?? a.user.email;
    if (
      !confirm(
        `Xoá bài thi của ${who} (${a.score}/${a.total})?

` +
          "Bài thi và thông báo thăng cấp đi kèm sẽ bị xoá, và người này được vào thi lại " +
          "nếu kỳ thi còn mở. Không hoàn tác được."
      )
    )
      return;
    setDeletingAttemptId(a.id);
    try {
      const res = await fetch(`/api/exam/attempts/${a.id}`, { method: "DELETE" });
      if (res.ok) {
        setAttempts((prev) => prev.filter((x) => x.id !== a.id));
        router.refresh();
      }
    } finally {
      setDeletingAttemptId(null);
    }
  }

  /**
   * Chấm những lượt hết giờ mà không ai nộp, dựa trên bài đã tự lưu trong lúc
   * họ làm. Người còn đang ngồi thi không bị đụng tới.
   */
  async function handleGradePending() {
    setGradeMsg("");
    setGradingPending(true);
    try {
      const res = await fetch("/api/exam/grade-pending", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setGradeMsg(data.error ?? "Không chấm được");
        return;
      }
      setGradeMsg(
        data.graded > 0
          ? `Đã chấm ${data.graded} bài từ phần đã lưu` +
              (data.failed > 0 ? `, ${data.failed} bài không chấm được` : "")
          : "Không có bài nào để chấm"
      );
      router.refresh();
    } finally {
      setGradingPending(false);
    }
  }

  /**
   * Mở / khoá / gia hạn / cho thi lại cho một người.
   *
   * "Cho thi lại" xoá bài của kỳ này nên hỏi lại một câu trước khi làm — các
   * thao tác còn lại đều đảo ngược được nên không cần hỏi.
   */
  async function handleAccess(row: AccessRow, action: "block" | "unblock" | "extend" | "reset") {
    const who = row.name ?? row.email;
    if (action === "reset") {
      const warn = row.takenAt
        ? `Cho ${who} thi lại?\n\nBài đã chấm của kỳ này (${row.scorePct}%) sẽ bị xoá và không lấy lại được.`
        : `Mở lại lượt thi cho ${who}? Đề cũ sẽ bị bỏ, lần vào sau bốc đề mới.`;
      if (!confirm(warn)) return;
    }
    setAccessMsg("");
    setAccessBusy(row.userId + action);
    try {
      const res = await fetch("/api/exam/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.userId, action }),
      });
      const data = await res.json();
      setAccessMsg(res.ok ? `${who}: ${data.message}` : data.error ?? "Không thực hiện được");
      if (res.ok) router.refresh();
    } finally {
      setAccessBusy(null);
    }
  }

  async function reloadQuestions() {
    const res = await fetch("/api/exam/questions");
    if (res.ok) {
      const data = await res.json();
      setQuestions(data);
    }
  }

  function startEdit(q: Question) {
    setEditId(q.id);
    setEditForm({
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correct: q.correct,
      imageUrl: q.imageUrl ?? "",
      videoUrl: q.videoUrl ?? "",
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[#f15b5c]/10">
          <FileText className="w-5 h-5 text-[#f15b5c]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Đề thi thăng cấp</h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5 sm:text-sm">
            Quản lý ngân hàng câu hỏi và cấu hình bài kiểm tra
          </p>
        </div>
      </div>

      {/* Tabs — màn hẹp trượt ngang, mỗi tab luôn gọn trong 1 hàng */}
      <div className={cn("mb-6", SLIDER)}>
        <div className="flex w-max gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-semibold transition-all sm:px-4 sm:text-sm",
                tab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Bank Tab ─── */}
      {tab === "bank" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-base font-extrabold text-gray-900">Ngân hàng câu hỏi</p>
              <p className="text-xs text-gray-400 mt-0.5">{questions.length} câu hỏi</p>
            </div>
            {/* Ba nút hành động: màn hẹp trượt ngang, chữ không xuống dòng */}
            <div className={cn(SLIDER, "sm:w-auto sm:overflow-visible")}>
              <div className="flex w-max items-center gap-2 sm:w-auto">
                <button
                  onClick={() => router.push("/dashboard/exam/thi-thu")}
                  disabled={questions.length === 0}
                  title={questions.length === 0 ? "Chưa có câu hỏi nào để thi thử" : "Tự làm thử đề — không lưu kết quả"}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 px-3.5 py-2 text-[13px] font-bold text-gray-600 transition-colors hover:border-[#f15b5c] hover:text-[#f15b5c] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 sm:px-4 sm:text-sm"
                >
                  <FlaskConical className="w-4 h-4 shrink-0" />
                  Thi thử
                </button>
                <button
                  onClick={() => setImportOpen(true)}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 px-3.5 py-2 text-[13px] font-bold text-gray-600 transition-colors hover:border-[#f15b5c] hover:text-[#f15b5c] sm:px-4 sm:text-sm"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  Nhập từ Excel
                </button>
                <button
                  onClick={() => { setShowAdd(true); setForm(emptyForm); }}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90 sm:px-4 sm:text-sm"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Thêm câu hỏi
                </button>
              </div>
            </div>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="px-4 py-4 bg-gray-50 border-b border-gray-100 sm:px-6">
              <p className="text-sm font-bold text-gray-700 mb-3">Câu hỏi mới</p>
              <QuestionForm
                form={form}
                onChange={setForm}
                onSave={handleAddQuestion}
                onCancel={() => setShowAdd(false)}
                saving={saving}
                previewIndex={questions.length + 1}
              />
            </div>
          )}

          {questions.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Chưa có câu hỏi nào</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pageQuestions.map((q, i) => {
                // Số câu đánh theo cả ngân hàng, không theo vị trí trong trang.
                const idx = questionStart + i;
                return (
                <div key={q.id} className="px-4 py-4 sm:px-6">
                  {editId === q.id ? (
                    <div>
                      <p className="text-sm font-bold text-gray-700 mb-3">Chỉnh sửa câu {idx + 1}</p>
                      <QuestionForm
                        form={editForm}
                        onChange={setEditForm}
                        onSave={() => handleUpdateQuestion(q.id)}
                        onCancel={() => setEditId(null)}
                        saving={saving}
                        previewIndex={idx + 1}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            <span className="text-gray-400 mr-1.5">{idx + 1}.</span>
                            {q.question}
                          </p>
                          <QuestionMedia imageUrl={q.imageUrl} videoUrl={q.videoUrl} compact />
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => startEdit(q)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            disabled={deletingId === q.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 mt-2.5 sm:grid-cols-2">
                        {(["A", "B", "C", "D"] as const).map((opt) => (
                          <div
                            key={opt}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                              q.correct === opt
                                ? "bg-emerald-50 border border-emerald-200"
                                : "bg-gray-50"
                            )}
                          >
                            <span
                              className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                q.correct === opt
                                  ? "bg-emerald-500 text-white"
                                  : "bg-gray-200 text-gray-500"
                              )}
                            >
                              {opt}
                            </span>
                            <span className={cn("min-w-0 break-words font-medium", q.correct === opt ? "text-emerald-700" : "text-gray-600")}>
                              {q[`option${opt}` as keyof Question] as string}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {questionTotalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-50 sm:px-6">
              <span className="min-w-0 text-xs font-semibold text-gray-400">
                Trang {questionSafePage + 1}/{questionTotalPages} — câu {questionStart + 1}–
                {questionStart + pageQuestions.length} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuestionPage(Math.max(0, questionSafePage - 1))}
                  disabled={questionSafePage === 0}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setQuestionPage(Math.min(questionTotalPages - 1, questionSafePage + 1))}
                  disabled={questionSafePage >= questionTotalPages - 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Schedule Tab ─── */}
      {tab === "schedule" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-lg">
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between gap-3 sm:px-6">
              <div>
                <p className="text-base font-extrabold text-gray-900">Lịch thi</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Chỉ mở đề đúng ngày đã đặt, ngoài khung giờ không ai vào thi được
                </p>
              </div>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap",
                  WINDOW_BADGE[windowState].cls
                )}
              >
                {WINDOW_BADGE[windowState].label}
              </span>
            </div>

            <div className="px-4 py-5 space-y-5 sm:px-6">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Bật lịch thi</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={scheduleForm.scheduleEnabled}
                    onClick={() =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        scheduleEnabled: !prev.scheduleEnabled,
                        examDate: prev.examDate || todayVN(),
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      scheduleForm.scheduleEnabled ? "bg-[#f15b5c]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        scheduleForm.scheduleEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-semibold",
                      scheduleForm.scheduleEnabled ? "text-emerald-600" : "text-gray-500"
                    )}
                  >
                    {scheduleForm.scheduleEnabled ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Bật
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Tắt
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Tắt: khoá hoàn toàn, không ai vào thi được. Bật: chỉ thi được đúng ngày và
                  khung giờ bên dưới.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Ngày thi</label>
                <input
                  type="date"
                  value={scheduleForm.examDate}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, examDate: e.target.value }))
                  }
                  className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                />
                <p className="text-xs text-gray-400">
                  Trước ngày này và sau ngày này đều không vào thi được.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={scheduleForm.examStartTime}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, examStartTime: e.target.value }))
                    }
                    className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Giờ kết thúc</label>
                  <input
                    type="time"
                    value={scheduleForm.examEndTime}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, examEndTime: e.target.value }))
                    }
                    className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                Khung giờ trên là lúc PHÒNG THI MỞ CỬA — vào thi được từ lúc nào tới lúc nào.
                Để cả ngày thì đặt 00:00 → 23:59 (giờ Việt Nam).
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700">Thời lượng thi (phút)</label>
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={scheduleForm.durationMinutes}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, durationMinutes: e.target.value }))
                  }
                  className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                />
                <p className="text-xs text-gray-400">
                  Mỗi người được làm bài trong bấy nhiêu phút, tính từ lúc mở đề — hết giờ hệ
                  thống tự nộp bài dù còn câu chưa làm. Ai mở đề sát giờ đóng phòng thi thì chỉ
                  còn tới giờ đóng. Đặt 0 = không giới hạn thời gian.
                </p>
                {Number(scheduleForm.durationMinutes || 0) === 0 && (
                  <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-600">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    Đang để KHÔNG GIỚI HẠN: người thi có trọn khung giờ trên để làm bài và không
                    có đồng hồ đếm ngược.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                  <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                  Phạt rời khỏi trang thi (phút)
                </label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={scheduleForm.focusPenaltyMinutes}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, focusPenaltyMinutes: e.target.value }))
                  }
                  className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                />
                <p className="text-xs text-gray-400">
                  Mỗi lần thí sinh chuyển sang tab khác, mở cửa sổ khác hay thu nhỏ trình duyệt
                  để đọc tài liệu thì bị trừ bấy nhiêu phút vào thời gian làm bài của chính họ.
                  Trừ ở máy chủ nên tắt mạng, sửa giờ máy hay tải lại trang đều không gỡ được.
                  Đặt 0 = chỉ đếm số lần rời trang cho Admin xem, không trừ giờ.
                </p>
                {Number(scheduleForm.focusPenaltyMinutes || 0) > 0 &&
                  Number(scheduleForm.durationMinutes || 0) === 0 && (
                    <p className="flex items-start gap-1.5 text-xs font-semibold text-amber-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      Chưa đặt thời lượng thi thì không có giờ nào để trừ — hệ thống chỉ đếm số
                      lần rời trang. Đặt thời lượng ở ô trên để hình phạt có hiệu lực.
                    </p>
                  )}
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0 mt-px" />
                <p className="text-xs font-semibold text-gray-500 leading-snug">
                  Mỗi người chỉ được thi MỘT lần mỗi kỳ — nộp bài xong là khoá, tải lại trang
                  cũng ra đúng đề cũ và đúng thời gian còn lại. Cần cho ai thi lại thì xoá bài
                  của họ ở tab Kết quả thi.
                </p>
              </div>

              {scheduleError && (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  {scheduleError}
                </p>
              )}

              <div className="pt-1 flex items-center gap-3">
                <button
                  onClick={handleSaveSchedule}
                  disabled={scheduleSaving}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#f15b5c" }}
                >
                  {scheduleSaving ? "Đang lưu..." : "Lưu lịch thi"}
                </button>
                {scheduleSaved && (
                  <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Đã lưu
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bài hết giờ chưa nộp — còn cứu được từ phần đã tự lưu */}
          {pendingGradeCount > 0 && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-amber-800">
                      {pendingGradeCount} người hết giờ mà bài chưa nộp được
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-amber-700 leading-snug">
                      Mất mạng, sập trình duyệt hay đóng nhầm tab thì bài không nộp lên được,
                      nhưng phần họ đã làm vẫn được tự lưu lại. Bấm để chấm những bài đó — người
                      còn đang ngồi thi không bị đụng tới.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleGradePending}
                  disabled={gradingPending}
                  className="shrink-0 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {gradingPending ? "Đang chấm..." : "Chấm bài đã lưu"}
                </button>
              </div>
              {gradeMsg && (
                <p className="mt-2 text-xs font-bold text-amber-800">{gradeMsg}</p>
              )}
            </div>
          )}

          {/* Danh sách dự thi — ai không thi tính 0 điểm */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b border-gray-100 sm:px-6">
              <p className="text-base font-extrabold text-gray-900">Danh sách dự thi</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {initialConfig.examDate
                  ? `Kỳ thi ngày ${fmtExamDate(initialConfig.examDate)} · ${initialConfig.examStartTime}–${initialConfig.examEndTime} · HLV không thi tính 0 điểm`
                  : "Chưa đặt ngày thi"}
              </p>
            </div>

            {roster.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2">
                <CalendarClock className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-300 font-semibold">
                  {initialConfig.examDate ? "Chưa có HLV nào" : "Đặt ngày thi để theo dõi"}
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-gray-50 bg-gray-50/50 text-xs font-semibold sm:px-6">
                  <span className="text-gray-500">
                    Tổng <span className="font-bold text-gray-800">{roster.length}</span>
                  </span>
                  <span className="text-emerald-600">
                    Đạt{" "}
                    <span className="font-bold">{roster.filter((r) => r.passed).length}</span>
                  </span>
                  <span className="text-red-500">
                    Vắng thi (0đ){" "}
                    <span className="font-bold">
                      {roster.filter((r) => !r.takenAt).length}
                    </span>
                  </span>
                </div>
                <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        {["HLV", "Cấp độ", "Điểm", "Kết quả", "Rời trang", "Thời gian thi"].map((h, i) => (
                          <th
                            key={h}
                            className={cn(
                              "px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                              i === 0 ? "text-left" : "text-center"
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRoster.map((r) => (
                        <tr
                          key={r.userId}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-gray-800">
                              {r.name ?? r.email}
                            </p>
                            <p className="text-xs text-gray-400">{r.email}</p>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className="text-xs font-semibold px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: (r.levelColor || "#6b7280") + "22",
                                color: r.levelColor || "#6b7280",
                              }}
                            >
                              {r.levelName ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {r.takenAt ? (
                              <span className="text-sm font-bold text-gray-800">
                                {r.score}/{r.total} ({r.scorePct}%)
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-red-500">0%</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                                r.passed
                                  ? "bg-emerald-50 text-emerald-600"
                                  : r.takenAt
                                  ? "bg-red-50 text-red-500"
                                  : "bg-gray-100 text-gray-500"
                              )}
                            >
                              {r.passed ? (
                                <>
                                  <Check className="w-3 h-3" /> Đạt
                                </>
                              ) : r.takenAt ? (
                                <>
                                  <X className="w-3 h-3" /> Chưa đạt
                                </>
                              ) : windowState === "AFTER" ? (
                                <>
                                  <X className="w-3 h-3" /> Vắng thi — 0đ
                                </>
                              ) : (
                                "Chưa thi"
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {r.violations > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-500"
                                title="Số lần rời khỏi trang thi trong lúc làm bài"
                              >
                                <EyeOff className="w-3 h-3" />
                                {r.violations}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 font-semibold">
                                {r.takenAt ? "0" : "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="text-xs text-gray-400 font-medium">
                              {r.takenAt ? fmtDateTime(new Date(r.takenAt)) : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {rosterTotalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                    <span className="text-xs font-semibold text-gray-400">
                      Trang {rosterPage + 1}/{rosterTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRosterPage((p) => Math.max(0, p - 1))}
                        disabled={rosterPage === 0}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Trang trước"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRosterPage((p) => Math.min(rosterTotalPages - 1, p + 1))}
                        disabled={rosterPage >= rosterTotalPages - 1}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Trang sau"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Quyền vào thi từng người */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-100 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-base font-extrabold text-gray-900">
                  <UserCog className="w-4 h-4 text-[#f15b5c]" />
                  Quyền vào thi từng người
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                  Khoá ai đó không cho vào thi, cấp thêm thời lượng cho người đang làm dở, hoặc
                  cho thi lại từ đầu. Khoá chỉ áp dụng cho kỳ thi này.
                </p>
              </div>
              <div className="relative sm:w-56 sm:shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-300" />
                <input
                  value={accessSearch}
                  onChange={(e) => {
                    setAccessSearch(e.target.value);
                    setAccessPage(0);
                  }}
                  placeholder="Tìm theo tên, email, chi nhánh"
                  className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                />
              </div>
            </div>

            {accessMsg && (
              <p className="border-b border-gray-50 bg-gray-50/60 px-4 py-2.5 text-xs font-bold text-gray-600 sm:px-6">
                {accessMsg}
              </p>
            )}

            {!initialConfig.examDate ? (
              <div className="py-14 flex flex-col items-center gap-2">
                <CalendarClock className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-300 font-semibold">Đặt ngày thi để quản lý quyền vào thi</p>
              </div>
            ) : pageAccess.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2">
                <UserCog className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-300 font-semibold">Không có ai khớp tìm kiếm</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {pageAccess.map((r) => {
                    const expired = !!r.endsAt && new Date(r.endsAt).getTime() <= Date.now();
                    const working = !!r.startedAt && !r.submittedAt && !expired;
                    const stuck = !!r.startedAt && !r.submittedAt && expired;
                    const busy = accessBusy?.startsWith(r.userId);

                    return (
                      <div key={r.userId} className="px-4 py-3.5 sm:px-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800">
                                {r.name ?? r.email}
                              </p>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                                {ROLE_LABEL[r.role] ?? r.role}
                              </span>
                              {r.branchName && (
                                <span className="text-[11px] font-semibold text-gray-400">
                                  {r.branchName}
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              {r.blocked && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                                  <Lock className="w-3 h-3" /> Đang khoá
                                </span>
                              )}
                              {r.takenAt ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                                    r.passed
                                      ? "bg-emerald-50 text-emerald-600"
                                      : "bg-red-50 text-red-500"
                                  )}
                                >
                                  {r.passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                  Đã nộp · {r.scorePct}% · {fmtDateTime(new Date(r.takenAt))}
                                </span>
                              ) : working ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600">
                                  <Clock className="w-3 h-3" />
                                  Đang làm bài — hết giờ {fmtDateTime(new Date(r.endsAt!))}
                                </span>
                              ) : stuck ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                  <AlertCircle className="w-3 h-3" />
                                  Hết giờ, chưa nộp
                                  {r.savedCount > 0 ? ` · đã lưu ${r.savedCount} câu` : ""}
                                </span>
                              ) : (
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">
                                  Chưa vào thi
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => handleAccess(r, r.blocked ? "unblock" : "block")}
                              disabled={busy}
                              title={
                                r.blocked
                                  ? "Cho phép người này vào thi trở lại"
                                  : "Khoá, không cho người này vào thi kỳ này"
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50",
                                r.blocked
                                  ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
                              )}
                            >
                              {r.blocked ? (
                                <>
                                  <UnlockIcon className="w-3 h-3" /> Mở khoá
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" /> Khoá
                                </>
                              )}
                            </button>

                            {(working || stuck) && (
                              <button
                                onClick={() => handleAccess(r, "extend")}
                                disabled={busy}
                                title="Cấp lại trọn thời lượng từ bây giờ, giữ nguyên đề cũ"
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                              >
                                <TimerReset className="w-3 h-3" /> Gia hạn
                              </button>
                            )}

                            {(r.takenAt || r.startedAt) && (
                              <button
                                onClick={() => handleAccess(r, "reset")}
                                disabled={busy}
                                title="Xoá bài của kỳ này để người này thi lại từ đầu"
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" /> Cho thi lại
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {accessTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-50 px-5 py-3">
                    <span className="text-xs font-semibold text-gray-400">
                      Trang {accessSafePage + 1}/{accessTotalPages} · {visibleAccess.length} người
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAccessPage((p) => Math.max(0, p - 1))}
                        disabled={accessSafePage === 0}
                        aria-label="Trang trước"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setAccessPage((p) => Math.min(accessTotalPages - 1, p + 1))}
                        disabled={accessSafePage >= accessTotalPages - 1}
                        aria-label="Trang sau"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* FM bắt buộc thi — chỉ định ai phải làm bài và xem điểm của họ */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-100 sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="text-base font-extrabold text-gray-900">FM bắt buộc thi</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Tick tên FM phải làm bài kỳ này. Họ thi cùng đề, cùng khung giờ với HLV.
                </p>
              </div>
              <span className="shrink-0 self-start rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-600 whitespace-nowrap">
                Đã chọn {fmRequired.size}/{fms.length}
              </span>
            </div>

            <div className="flex items-start gap-2 px-4 py-3 bg-sky-50/60 border-b border-sky-100 sm:px-6">
              <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0 mt-px" />
              <p className="text-xs font-semibold text-sky-700 leading-snug">
                Bài thi của FM chỉ để bạn nắm chuyên môn: điểm lưu lại cho bạn xem, nhưng thi
                trượt KHÔNG bị phạt — không hạ cấp, không thông báo, không tính vào xếp hạng.
                Bỏ tick là kỳ sau họ không phải thi nữa.
              </p>
            </div>

            {fms.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2">
                <ShieldCheck className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-300 font-semibold">Chưa có FM nào</p>
              </div>
            ) : (
              <>
                {fms.length > 5 && (
                  <div className="px-4 py-3 border-b border-gray-50 sm:px-6">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                      <input
                        value={fmSearch}
                        onChange={(e) => setFmSearch(e.target.value)}
                        placeholder="Tìm FM theo tên, email hoặc chi nhánh"
                        className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
                      />
                    </div>
                  </div>
                )}

                {visibleFms.length === 0 ? (
                  <div className="py-10 text-center text-sm font-semibold text-gray-300">
                    Không tìm thấy FM nào khớp
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {visibleFms.map((fm) => {
                      const checked = fmRequired.has(fm.userId);
                      return (
                        <label
                          key={fm.userId}
                          className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/60 sm:px-6"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFm(fm.userId)}
                            className="h-4 w-4 shrink-0 accent-[#f15b5c]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-800">
                              {fm.name ?? fm.email}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {fm.branchName ? fm.branchName + " · " : ""}
                              {fm.email}
                            </p>
                          </div>
                          {/* Điểm kỳ này — chỉ hiện khi người đó đã nộp bài */}
                          <div className="shrink-0 text-right">
                            {fm.takenAt ? (
                              <>
                                <p className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                  {fm.score}/{fm.total} ({fm.scorePct}%)
                                </p>
                                <p
                                  className={cn(
                                    "text-xs font-bold",
                                    fm.passed ? "text-emerald-600" : "text-gray-400"
                                  )}
                                >
                                  {fm.passed ? "Đạt" : "Chưa đạt"} · {fmtDateTime(new Date(fm.takenAt))}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs font-semibold text-gray-300 whitespace-nowrap">
                                {checked ? "Chưa làm bài" : "Không phải thi"}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t border-gray-50 px-4 py-4 sm:px-6">
                  <button
                    onClick={handleSaveRequiredFms}
                    disabled={fmSaving || !fmDirty}
                    className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    {fmSaving ? "Đang lưu..." : "Lưu danh sách FM"}
                  </button>
                  {fmSaved && (
                    <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                      <Check className="w-4 h-4" /> Đã lưu
                    </span>
                  )}
                  {fmError && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                      <AlertCircle className="w-4 h-4" /> {fmError}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Config Tab ─── */}
      {tab === "config" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-lg">
          <div className="px-4 py-4 border-b border-gray-100 sm:px-6">
            <p className="text-base font-extrabold text-gray-900">Cấu hình bài thi</p>
            <p className="text-xs text-gray-400 mt-0.5">Số câu hỏi và điểm đạt</p>
          </div>
          <div className="px-4 py-5 space-y-5 sm:px-6">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">
                Số câu hỏi mỗi bài thi
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={configForm.numQuestions}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    numQuestions: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
              />
              <p className="text-xs text-gray-400">
                Ngân hàng hiện có {questions.length} câu. Nếu ít hơn số này thì dùng tất cả.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">
                Điểm đạt (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={configForm.passingScore}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    passingScore: Math.min(100, Math.max(1, parseInt(e.target.value) || 80)),
                  }))
                }
                className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
              />
              <p className="text-xs text-gray-400">
                Ví dụ: 80 = trả lời đúng ít nhất 80% mới đạt
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Xáo trộn câu hỏi</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={configForm.shuffleQuestions}
                  onClick={() => setConfigForm((prev) => ({ ...prev, shuffleQuestions: !prev.shuffleQuestions }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    configForm.shuffleQuestions ? "bg-[#f15b5c]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      configForm.shuffleQuestions ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm font-semibold text-gray-600">
                  {configForm.shuffleQuestions ? "Bật" : "Tắt"}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Khi bật, thứ tự câu hỏi sẽ được xáo trộn ngẫu nhiên cho mỗi lần thi
              </p>
            </div>

            {/* ── Trọng số tính điểm xếp hạng ── */}
            <div className="pt-1 border-t border-gray-100">
              <div className="flex items-center justify-between gap-3 pt-4 mb-1">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#f15b5c]" />
                  <label className="text-sm font-bold text-gray-700">
                    Trọng số tính điểm xếp hạng
                  </label>
                </div>
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-extrabold",
                    weightValid ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                  )}
                >
                  Tổng {weightTotal}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Quyết định tỉ trọng 3 tiêu chí ở bảng Xếp hạng. Tổng phải bằng 100%.
              </p>

              <div className="space-y-3">
                {WEIGHT_FIELDS.map(({ key, label, hint }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700">{label}</p>
                      <p className="text-xs text-gray-400">{hint}</p>
                    </div>
                    <div className="relative shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={configForm[key]}
                        onChange={(e) =>
                          setConfigForm((prev) => ({
                            ...prev,
                            [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                          }))
                        }
                        className="w-24 h-11 rounded-xl border border-gray-200 pl-4 pr-7 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {configError && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                <AlertCircle className="w-4 h-4" />
                {configError}
              </p>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={configSaving || !weightValid}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {configSaving ? "Đang lưu..." : "Lưu cấu hình"}
              </button>
              {configSaved && (
                <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Đã lưu
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <ExamImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={reloadQuestions}
      />

      {/* ─── Results Tab ─── */}
      {tab === "results" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-100 sm:px-6">
            <p className="text-base font-extrabold text-gray-900">Kết quả thi</p>
            <p className="text-xs text-gray-400 mt-0.5">{attempts.length} lượt thi</p>
          </div>

          {attempts.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2">
              <ClipboardList className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Chưa có kết quả thi nào</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    {["PT", "Cấp độ", "Điểm", "Kết quả", "Rời trang", "Thời gian", ""].map((h, i) => (
                      <th
                        key={h || "actions"}
                        className={cn(
                          "px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                          i === 0 ? "text-left" : "text-center"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageAttempts.map((a) => {
                    const scorePct = Math.round((a.score / a.total) * 100);
                    const date = new Date(a.createdAt);
                    return (
                      <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-gray-800">{a.user.name ?? a.user.email}</p>
                          <p className="text-xs text-gray-400">{a.user.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {ROLE_LABEL[a.user.role] ?? a.user.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-sm font-bold text-gray-800">
                            {a.score}/{a.total} ({scorePct}%)
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
                              a.passed
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-red-50 text-red-500"
                            )}
                          >
                            {a.passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {a.passed ? "Đạt" : "Chưa đạt"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {a.violations > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-500"
                              title="Số lần rời khỏi trang thi trong lúc làm bài"
                            >
                              <EyeOff className="w-3 h-3" />
                              {a.violations}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 font-semibold">0</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-xs text-gray-400 font-medium">
                            {fmtDateTime(date)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleDeleteAttempt(a)}
                            disabled={deletingAttemptId === a.id}
                            title="Xoá bài thi này — người này được vào thi lại"
                            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors"
                            aria-label="Xoá bài thi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {resultsTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
              <span className="text-xs font-semibold text-gray-400">
                Trang {resultsPage + 1}/{resultsTotalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setResultsPage((p) => Math.max(0, p - 1))}
                  disabled={resultsPage === 0}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setResultsPage((p) => Math.min(resultsTotalPages - 1, p + 1))}
                  disabled={resultsPage >= resultsTotalPages - 1}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  previewIndex,
}: {
  form: typeof emptyForm;
  onChange: (f: typeof emptyForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  /** Số thứ tự câu, để nhãn “Câu N.” trong bản xem trước khớp với lúc thi. */
  previewIndex?: number;
}) {
  const inputCls = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white";
  // Mặc định đóng để form gọn; ai cần soi ảnh/video hay đáp án thì mở ra.
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-3">
      <textarea
        placeholder="Nội dung câu hỏi *"
        value={form.question}
        onChange={(e) => onChange({ ...form, question: e.target.value })}
        rows={2}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white resize-none"
      />
      <QuestionMediaFields
        value={{ imageUrl: form.imageUrl, videoUrl: form.videoUrl }}
        onChange={(m) => onChange({ ...form, imageUrl: m.imageUrl, videoUrl: m.videoUrl })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["A", "B", "C", "D"] as const).map((opt) => (
          <div key={opt} className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{opt}.</span>
            <input
              type="text"
              placeholder={`Đáp án ${opt} *`}
              value={form[`option${opt}` as keyof typeof form]}
              onChange={(e) => onChange({ ...form, [`option${opt}`]: e.target.value })}
              className={cn(inputCls, "pl-8")}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-bold text-gray-700 shrink-0">Đáp án đúng:</label>
        <div className="flex gap-2">
          {CORRECT_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ ...form, correct: opt })}
              className={cn(
                "w-8 h-8 rounded-full text-sm font-bold transition-all",
                form.correct === opt
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      {showPreview && <QuestionPreview data={form} index={previewIndex} />}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving || !form.question.trim() || !form.optionA || !form.optionB || !form.optionC || !form.optionD}
          className="whitespace-nowrap px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#f15b5c" }}
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          onClick={onCancel}
          className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className={cn(
            "ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-xl text-sm font-bold transition-colors",
            showPreview ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-100"
          )}
        >
          <Eye className="w-4 h-4" />
          {showPreview ? "Ẩn xem trước" : "Xem trước"}
        </button>
      </div>
    </div>
  );
}
