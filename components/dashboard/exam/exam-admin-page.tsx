"use client";

import { useState } from "react";
import { FileText, Plus, Trash2, Edit2, Check, X, Settings, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format-date";

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
  FREE: "Tự do",
  RESTRICTED: "Hạn chế",
};

const TABS = [
  { key: "bank", label: "Ngân hàng câu hỏi", icon: FileText },
  { key: "config", label: "Cấu hình", icon: Settings },
  { key: "results", label: "Kết quả thi", icon: ClipboardList },
] as const;

type Tab = typeof TABS[number]["key"];

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
}: {
  questions: Question[];
  config: Config;
  attempts: Attempt[];
}) {
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

  // Config state
  const [configForm, setConfigForm] = useState(initialConfig);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

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
        body: JSON.stringify(configForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfigForm({ numQuestions: updated.numQuestions, passingScore: updated.passingScore });
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2000);
      }
    } finally {
      setConfigSaving(false);
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
            <button
              onClick={() => { setShowAdd(true); setForm(emptyForm); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Plus className="w-4 h-4" />
              Thêm câu hỏi
            </button>
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
            <div className="overflow-x-auto">
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
