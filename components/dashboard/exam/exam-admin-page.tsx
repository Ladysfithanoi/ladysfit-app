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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format-date";
import { fmtExamDate, todayVN, type ExamWindowState } from "@/lib/exam-schedule";
import { ExamImportModal } from "./exam-import-modal";

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
};

type Config = {
  numQuestions: number;
  passingScore: number;
  shuffleQuestions: boolean;
  scheduleEnabled: boolean;
  examDate: string | null;
  examStartTime: string;
  examEndTime: string;
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
};

type Attempt = {
  id: string;
  userId: string;
  score: number;
  total: number;
  passed: boolean;
  createdAt: string;
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
};

export function ExamAdminPage({
  questions: initialQuestions,
  config: initialConfig,
  attempts: initialAttempts,
  windowState,
  roster,
}: {
  questions: Question[];
  config: Config;
  attempts: Attempt[];
  windowState: ExamWindowState;
  roster: RosterRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("bank");
  const [questions, setQuestions] = useState(initialQuestions);
  const [attempts] = useState(initialAttempts);

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

  // Schedule state
  const [scheduleForm, setScheduleForm] = useState({
    scheduleEnabled: initialConfig.scheduleEnabled,
    examDate: initialConfig.examDate ?? "",
    examStartTime: initialConfig.examStartTime,
    examEndTime: initialConfig.examEndTime,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

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
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfigForm((prev) => ({
          ...prev,
          numQuestions: updated.numQuestions,
          passingScore: updated.passingScore,
          shuffleQuestions: updated.shuffleQuestions,
        }));
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2000);
      }
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
      });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
      router.refresh();
    } finally {
      setScheduleSaving(false);
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
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-[#f15b5c]/10">
          <FileText className="w-5 h-5 text-[#f15b5c]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Đề thi thăng cấp</h1>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            Quản lý ngân hàng câu hỏi và cấu hình bài kiểm tra
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Bank Tab ─── */}
      {tab === "bank" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-base font-extrabold text-gray-900">Ngân hàng câu hỏi</p>
              <p className="text-xs text-gray-400 mt-0.5">{questions.length} câu hỏi</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors"
              >
                <Upload className="w-4 h-4" />
                Nhập từ Excel
              </button>
              <button
                onClick={() => { setShowAdd(true); setForm(emptyForm); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Plus className="w-4 h-4" />
                Thêm câu hỏi
              </button>
            </div>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-700 mb-3">Câu hỏi mới</p>
              <QuestionForm
                form={form}
                onChange={setForm}
                onSave={handleAddQuestion}
                onCancel={() => setShowAdd(false)}
                saving={saving}
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
              {questions.map((q, idx) => (
                <div key={q.id} className="px-6 py-4">
                  {editId === q.id ? (
                    <div>
                      <p className="text-sm font-bold text-gray-700 mb-3">Chỉnh sửa câu {idx + 1}</p>
                      <QuestionForm
                        form={editForm}
                        onChange={setEditForm}
                        onSave={() => handleUpdateQuestion(q.id)}
                        onCancel={() => setEditId(null)}
                        saving={saving}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm font-semibold text-gray-800">
                          <span className="text-gray-400 mr-1.5">{idx + 1}.</span>
                          {q.question}
                        </p>
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
                      <div className="grid grid-cols-2 gap-2 mt-2.5">
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
                            <span className={cn("font-medium", q.correct === opt ? "text-emerald-700" : "text-gray-600")}>
                              {q[`option${opt}` as keyof Question] as string}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Schedule Tab ─── */}
      {tab === "schedule" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
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

            <div className="px-6 py-5 space-y-5">
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
                Để cả ngày thì đặt 00:00 → 23:59 (giờ Việt Nam).
              </p>

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

          {/* Danh sách dự thi — ai không thi tính 0 điểm */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
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
                <div className="px-6 py-3 flex items-center gap-5 border-b border-gray-50 bg-gray-50/50 text-xs font-semibold">
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
                        {["HLV", "Cấp độ", "Điểm", "Kết quả", "Thời gian thi"].map((h, i) => (
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
                      {roster.map((r) => (
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
                            <span className="text-xs text-gray-400 font-medium">
                              {r.takenAt ? fmtDateTime(new Date(r.takenAt)) : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Config Tab ─── */}
      {tab === "config" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-lg">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-base font-extrabold text-gray-900">Cấu hình bài thi</p>
            <p className="text-xs text-gray-400 mt-0.5">Số câu hỏi và điểm đạt</p>
          </div>
          <div className="px-6 py-5 space-y-5">
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

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={configSaving}
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
          <div className="px-6 py-4 border-b border-gray-100">
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
                    {["PT", "Cấp độ", "Điểm", "Kết quả", "Thời gian"].map((h, i) => (
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
                  {attempts.map((a) => {
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
                          <span className="text-xs text-gray-400 font-medium">
                            {fmtDateTime(date)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
}: {
  form: typeof emptyForm;
  onChange: (f: typeof emptyForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const inputCls = "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white";

  return (
    <div className="space-y-3">
      <textarea
        placeholder="Nội dung câu hỏi *"
        value={form.question}
        onChange={(e) => onChange({ ...form, question: e.target.value })}
        rows={2}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-white resize-none"
      />
      <div className="grid grid-cols-2 gap-3">
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
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving || !form.question.trim() || !form.optionA || !form.optionB || !form.optionC || !form.optionD}
          className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#f15b5c" }}
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
