"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, Sparkles, Send, Save, User, Users,
  FileText, CheckCircle2, Clock, Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffMember } from "./checklist-page";
import { addDaysISO, mondayOf, weekLabel, ymd, VN_DAY_NAMES } from "@/lib/week";

// ── types ─────────────────────────────────────────────────────────────────────
// Nội dung báo cáo giờ là MỘT ô duy nhất, lưu vào cột `results`. Ba cột cũ
// (completed / incomplete / nextPlan) chỉ còn để đọc lại các báo cáo viết theo
// bố cục 4 ô trước đây — xem mergeReport().
type LegacyReport = {
  results:    string | null;
  completed:  string | null;
  incomplete: string | null;
  nextPlan:   string | null;
};

type WeekTask = {
  time: string; task: string; kpi: string; actual: number;
  pct: number | null; isTeaching: boolean; note: string;
};

type WeekDay = {
  date: string; dayName: string; filled: boolean;
  targetNote: string; reflection: string; tasks: WeekTask[];
  tasksTotal: number; tasksDone: number;
};

type WeekStats = {
  daysFilled: number; tasksTotal: number; tasksDone: number;
  taskRate: number; teachingDone: number;
};

type TeamRow = {
  userId: string; name: string; role: string; branchName: string;
  submitted: boolean; submittedAt: string | null; hasDraft: boolean; aiGenerated: boolean;
  results: string; completed: string; incomplete: string; nextPlan: string;
  daysFilled: number; tasksTotal: number; tasksDone: number; taskRate: number; teachingDone: number;
};

type Props = {
  currentUserId:   string;
  currentUserName: string;
  currentUserRole: string;
  staffList:       StaffMember[];
};

const PLACEHOLDER = `📈 Kết quả nổi bật trong tuần:
-

✅ Việc đã hoàn thành:
-

⏳ Việc chưa hoàn thành:
-

➡️ Kế hoạch tuần tới:
- `;

const LEGACY_LABELS: [keyof LegacyReport, string][] = [
  ["results",    "📈 Kết quả nổi bật trong tuần"],
  ["completed",  "✅ Việc đã hoàn thành"],
  ["incomplete", "⏳ Việc chưa hoàn thành"],
  ["nextPlan",   "➡️ Kế hoạch tuần tới"],
];

/**
 * Gộp báo cáo về một đoạn văn bản duy nhất. Báo cáo viết theo bố cục 4 ô cũ được
 * ghép lại kèm tiêu đề để không mất chữ nào; báo cáo mới chỉ có `results` thì trả
 * về nguyên văn.
 */
function mergeReport(r: LegacyReport | null | undefined): string {
  if (!r) return "";
  const hasLegacy = [r.completed, r.incomplete, r.nextPlan].some((v) => v?.trim());
  if (!hasLegacy) return r.results?.trim() ?? "";
  return LEGACY_LABELS
    .filter(([k]) => r[k]?.trim())
    .map(([k, label]) => `${label}:\n${r[k]!.trim()}`)
    .join("\n\n");
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ── main ──────────────────────────────────────────────────────────────────────
export function WeeklyReportTab({
  currentUserName, currentUserRole, staffList,
}: Props) {
  const isManager = currentUserRole === "FM" || currentUserRole === "ADMIN";

  const todayISO   = ymd(new Date());
  const thisMonday = mondayOf(todayISO);
  const dow        = new Date(todayISO + "T00:00:00").getDay(); // 0 = CN
  const isWeekend  = dow === 0 || dow === 6;

  // FM/ADMIN mở tab Báo cáo tuần là thấy ngay báo cáo của nhân sự, không phải
  // bấm chuyển tab hay đi vòng qua thông báo. Nhân sự thường vẫn vào ô của mình.
  const [subTab, setSubTab]       = useState<"own" | "team">(isManager ? "team" : "own");
  const [weekStart, setWeekStart] = useState(thisMonday);

  // Own report — một ô nội dung duy nhất
  const [content, setContent]     = useState("");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [savedAt, setSavedAt]     = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isDirty, setIsDirty]     = useState(false);
  const [toast, setToast]         = useState("");
  const [error, setError]         = useState("");

  // Raw week data (để tự tổng hợp thủ công)
  const [days, setDays]   = useState<WeekDay[]>([]);
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  // Team view
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isCurrentWeek = weekStart === thisMonday;
  const isPastWeek    = weekStart < thisMonday;
  // Tuần chưa tới thì chưa viết được; tuần này và các tuần đã qua đều sửa được.
  const canEdit       = subTab === "own" && weekStart <= thisMonday;
  // Nút tổng hợp mở vào Thứ 7 – Chủ Nhật của tuần hiện tại, còn tuần đã kết thúc
  // thì lúc nào cũng tổng hợp được.
  const canSummarize  = canEdit && (isPastWeek || isWeekend);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── fetch own report + raw week ────────────────────────────────────────────
  const fetchOwn = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/checklist/report?weekStart=${weekStart}`),
        fetch(`/api/checklist/weekly-summary?weekStart=${weekStart}`),
      ]);
      if (r1.ok) {
        const d = await r1.json();
        const rep = d.report;
        setContent(mergeReport(rep));
        setSubmittedAt(rep?.submittedAt ?? null);
        setSavedAt(rep?.updatedAt ?? null);
        setAiGenerated(rep?.aiGenerated ?? false);
      }
      if (r2.ok) {
        const d = await r2.json();
        setDays(d.days ?? []);
        setStats(d.stats ?? null);
      }
      setIsDirty(false);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/checklist/weekly-overview?weekStart=${weekStart}`);
      if (!res.ok) { setTeam([]); return; }
      const d = await res.json();
      setTeam(d.staff ?? []);
    } finally {
      setTeamLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    if (subTab === "own") fetchOwn();
    else fetchTeam();
  }, [subTab, fetchOwn, fetchTeam]);

  // ── actions ────────────────────────────────────────────────────────────────
  async function handleSummarize() {
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checklist/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Tổng hợp thất bại"); return; }
      setContent(d.content ?? "");
      setAiGenerated(true);
      setIsDirty(true);
      flash("AI đã tổng hợp xong — kiểm tra lại rồi bấm Lưu ✓");
    } catch {
      setError("Không kết nối được tới AI");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave(submit: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/checklist/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, content, submit, aiGenerated }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Lưu thất bại"); return; }
      setSubmittedAt(d.report?.submittedAt ?? null);
      setSavedAt(d.report?.updatedAt ?? null);
      setIsDirty(false);
      flash(
        submit
          ? d.notified > 0
            ? `Đã gửi báo cáo cho ${d.notified} FM ✓`
            : "Đã gửi báo cáo ✓"
          : "Đã lưu nháp ✓"
      );
    } catch {
      setError("Không lưu được, thử lại nhé");
    } finally {
      setSaving(false);
    }
  }

  const hasContent = content.trim().length > 0;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Sub-tabs (FM/Admin) ───────────────────────────────────────────── */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 border-b border-gray-100">
            {(["own", "team"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSubTab(tab)}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all",
                  subTab === tab
                    ? "text-[#f15b5c] border-b-2 border-[#f15b5c] bg-[#f15b5c]/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50/60"
                )}
              >
                {tab === "own" ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {tab === "own"
                  ? "Báo cáo của tôi"
                  : `Báo cáo nhân sự (${team.length || staffList.length})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Thanh chọn tuần ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((w) => addDaysISO(w, -7))}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Tuần trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center min-w-[190px]">
            <p className="text-sm font-extrabold text-gray-800 leading-tight">{weekLabel(weekStart)}</p>
            <p className="text-[10px] font-semibold text-gray-400">
              {isCurrentWeek ? "Tuần này" : isPastWeek ? "Tuần đã qua" : "Tuần sau"}
            </p>
          </div>
          <button
            onClick={() => setWeekStart((w) => addDaysISO(w, 7))}
            disabled={weekStart >= thisMonday}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Tuần sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!isCurrentWeek && (
          <button
            onClick={() => setWeekStart(thisMonday)}
            className="text-[11px] font-bold text-[#f15b5c] hover:underline"
          >
            Về tuần này
          </button>
        )}

        {subTab === "own" && stats && (
          <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold text-gray-500">
            <span>{stats.daysFilled}/7 ngày có check-list</span>
            <span className="text-gray-300">·</span>
            <span>{stats.tasksDone}/{stats.tasksTotal} việc đạt KPI ({stats.taskRate}%)</span>
            {stats.teachingDone > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1">
                  <Dumbbell className="w-3 h-3 text-[#f15b5c]" />{stats.teachingDone} buổi dạy
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ BÁO CÁO CỦA TÔI ═══════════════════════════════════════════════ */}
      {subTab === "own" && (
        <>
          {/* Trạng thái + nút tổng hợp */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-[#f15b5c]/10 flex-shrink-0">
                  <FileText className="w-4 h-4 text-[#f15b5c]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-800 truncate">{currentUserName}</p>
                  <p className="text-[11px] text-gray-400">
                    {submittedAt
                      ? `Đã gửi FM lúc ${fmtDateTime(submittedAt)}`
                      : savedAt
                        ? `Bản nháp — lưu lúc ${fmtDateTime(savedAt)}`
                        : "Chưa có báo cáo cho tuần này"}
                  </p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {submittedAt && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3" /> Đã gửi FM
                  </span>
                )}
                {aiGenerated && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2 py-1 rounded-full whitespace-nowrap">
                    <Sparkles className="w-3 h-3" /> AI tổng hợp
                  </span>
                )}
                <button
                  onClick={handleSummarize}
                  disabled={!canSummarize || aiLoading || loading}
                  title={
                    canSummarize
                      ? "AI đọc check-list cả tuần và viết sẵn báo cáo"
                      : "Nút tổng hợp mở vào Thứ 7 & Chủ Nhật (hoặc khi xem tuần đã qua)"
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  <Sparkles className={cn("w-3.5 h-3.5", aiLoading && "animate-pulse")} />
                  {aiLoading ? "AI đang tổng hợp..." : "Tổng hợp bằng AI"}
                </button>
              </div>
            </div>

            {!canSummarize && canEdit && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                Nút <b>Tổng hợp bằng AI</b> mở vào <b>Thứ 7 &amp; Chủ Nhật</b> — trong tuần bạn vẫn
                tự viết và lưu nháp bình thường.
              </p>
            )}
            {error && (
              <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Dữ liệu tuần (tự tổng hợp thủ công) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setRawOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors"
            >
              <span className="text-sm font-extrabold text-gray-700">
                Dữ liệu check-list cả tuần
                <span className="ml-2 text-[11px] font-semibold text-gray-400">
                  (7 ngày · xem để tự tổng hợp)
                </span>
              </span>
              <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", rawOpen && "rotate-180")} />
            </button>
            {rawOpen && (
              <div
                className="border-t border-gray-100 max-h-[420px] overflow-y-auto divide-y divide-gray-100"
                style={{ WebkitOverflowScrolling: "touch" } as CSSProperties}
              >
                {days.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-300 italic">Đang tải...</p>
                ) : (
                  days.map((d, i) => (
                    <div key={d.date} className={cn("px-4 py-3", !d.filled && "bg-gray-50/50")}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-gray-700">
                          {VN_DAY_NAMES[i]} · {fmtDayMonth(d.date)}
                        </span>
                        {d.filled ? (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {d.tasksDone}/{d.tasksTotal} việc đạt
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-500">Chưa điền</span>
                        )}
                        {d.targetNote && (
                          <span className="text-[11px] text-gray-400 truncate">🎯 {d.targetNote}</span>
                        )}
                      </div>
                      {d.tasks.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {d.tasks.map((t, j) => (
                            <li key={j} className="text-[11px] text-gray-500 flex items-start gap-1.5">
                              <span className="text-gray-300">•</span>
                              <span className="flex-1 min-w-0">
                                {t.time && <span className="text-gray-400">{t.time} </span>}
                                {t.isTeaching && <Dumbbell className="w-3 h-3 inline text-[#f15b5c] mr-0.5 -mt-0.5" />}
                                <span className="font-semibold text-gray-700">{t.task || "—"}</span>
                                {t.pct !== null && (
                                  <span className={cn(
                                    "ml-1 font-bold",
                                    t.pct >= 100 ? "text-green-600" : t.pct >= 70 ? "text-yellow-600" : "text-red-500"
                                  )}>
                                    {t.actual}/{t.kpi} ({t.pct}%)
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {d.reflection && (
                        <p className="mt-1.5 text-[11px] text-gray-500 whitespace-pre-wrap leading-relaxed border-l-2 border-gray-200 pl-2">
                          {d.reflection}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Nội dung báo cáo — một ô duy nhất */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: "#f15b5c" }}>
              <p className="text-sm font-extrabold text-white tracking-wide uppercase">
                Nội dung báo cáo tuần
              </p>
              {!canEdit && (
                <span className="text-xs text-white/80 italic">👁️ Chế độ xem</span>
              )}
            </div>
            <div className="p-5 space-y-1.5">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-400">Đang tải...</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Tổng kết <span className="font-semibold text-gray-500">kết quả nổi bật</span>,{" "}
                    <span className="font-semibold text-gray-500">việc đã / chưa hoàn thành</span> và{" "}
                    <span className="font-semibold text-gray-500">kế hoạch tuần tới</span> trong một ô.
                  </p>
                  <textarea
                    value={content}
                    onChange={(e) => { setContent(e.target.value); setIsDirty(true); }}
                    disabled={!canEdit}
                    rows={16}
                    placeholder={canEdit ? PLACEHOLDER : ""}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-y leading-relaxed",
                      canEdit ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed"
                    )}
                  />
                </>
              )}
            </div>
          </div>

          {/* Lưu / Gửi */}
          {canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {isDirty && (
                <span className="text-[11px] font-semibold text-amber-500 mr-auto">
                  Có thay đổi chưa lưu
                </span>
              )}
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors bg-white disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Đang lưu..." : "Lưu nháp"}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving || !hasContent}
                title={hasContent ? "Gửi báo cáo tuần này cho FM" : "Viết nội dung trước khi gửi"}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#f15b5c" }}
              >
                <Send className="w-4 h-4" />
                {submittedAt ? "Gửi lại cho FM" : "Gửi cho FM"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ══ BÁO CÁO NHÂN SỰ (FM/ADMIN) ════════════════════════════════════ */}
      {subTab === "team" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50/60 text-xs">
            <span className="text-gray-500">
              <span className="font-bold text-emerald-600">{team.filter((t) => t.submitted).length}</span> đã gửi
            </span>
            <span className="text-gray-500">
              <span className="font-bold text-blue-500">{team.filter((t) => t.hasDraft).length}</span> đang nháp
            </span>
            <span className="text-gray-500">
              <span className="font-bold text-amber-500">{team.filter((t) => !t.submitted && !t.hasDraft).length}</span> chưa làm
            </span>
            <span className="text-gray-400 ml-auto">{team.length} nhân sự</span>
          </div>

          <div className="divide-y divide-gray-100">
            {teamLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-[#f15b5c]/30 border-t-[#f15b5c] animate-spin" />
                <p className="text-xs text-gray-400">Đang tải báo cáo tuần...</p>
              </div>
            ) : team.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <span className="text-3xl">🗒️</span>
                <p className="text-sm text-gray-400">Không có nhân sự nào</p>
              </div>
            ) : (
              team.map((t) => {
                const open = expanded === t.userId;
                const hasReport = t.submitted || t.hasDraft;
                return (
                  <div key={t.userId}>
                    <button
                      onClick={() => setExpanded(open ? null : t.userId)}
                      className="w-full px-4 py-3.5 flex items-start gap-3 text-left hover:bg-gray-50/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-800 truncate">{t.name}</span>
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{t.role}</span>
                          {t.branchName && <span className="text-[10px] text-gray-400">· {t.branchName}</span>}
                          {t.aiGenerated && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-violet-500">
                              <Sparkles className="w-2.5 h-2.5" /> AI
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {t.daysFilled}/7 ngày check-list · {t.tasksDone}/{t.tasksTotal} việc đạt ({t.taskRate}%)
                          {t.teachingDone > 0 && ` · ${t.teachingDone} buổi dạy`}
                          {t.submittedAt && ` · gửi lúc ${fmtDateTime(t.submittedAt)}`}
                        </p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 border",
                        t.submitted
                          ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                          : t.hasDraft
                            ? "text-blue-600 bg-blue-50 border-blue-200"
                            : "text-amber-600 bg-amber-50 border-amber-200"
                      )}>
                        {t.submitted ? "Đã gửi" : t.hasDraft ? "Bản nháp" : "Chưa làm"}
                      </span>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 transition-transform",
                        open && "rotate-180"
                      )} />
                    </button>

                    {open && (
                      <div className="px-5 pb-4 -mt-1">
                        {!hasReport ? (
                          <p className="text-xs text-gray-300 italic py-2">
                            Nhân sự chưa viết báo cáo cho tuần này.
                          </p>
                        ) : (
                          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                            <p className="text-[12px] text-gray-600 whitespace-pre-wrap leading-relaxed">
                              {mergeReport(t) || (
                                <span className="text-gray-300 italic">Báo cáo còn trống</span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
