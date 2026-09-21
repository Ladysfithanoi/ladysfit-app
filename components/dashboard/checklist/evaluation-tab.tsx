"use client";

/**
 * Tổng kết đánh giá — màn của FM/Admin.
 *
 * Đánh giá được chấm theo TỪNG NGÀY (xem thẻ "Đánh giá của FM" trong Check-list
 * ngày). Màn này cộng chúng lại theo ngày / tuần / tháng / quý / năm để nhìn
 * tổng quan một nhân sự thay vì phải mở lại từng ngày một.
 *
 * Mọi phép chia kỳ nằm ở lib/checklist-review.ts, không tự tính lại ở đây.
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Star, CheckCircle2, ClipboardList, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERIODS,
  PERIOD_LABEL,
  MAX_RATING,
  RATING_LABEL,
  fmtVN,
  shiftPeriod,
  type Period,
} from "@/lib/checklist-review";

type StaffRow = {
  userId:         string;
  name:           string;
  role:           string;
  branchName:     string;
  daysFilled:     number;
  daysCheckedOut: number;
  daysReviewed:   number;
  avgRating:      number | null;
  tasksTotal:     number;
  tasksDone:      number;
  taskRate:       number;
};

type DetailDay = {
  date:           string;
  checkedOutAt:   string | null;
  reflection:     string;
  fmRating:       number | null;
  fmComment:      string | null;
  fmReviewedAt:   string | null;
  fmReviewerName: string | null;
};

type Summary = {
  period: Period;
  from:   string;
  to:     string;
  label:  string;
  staff:  StaffRow[];
  detail: DetailDay[] | null;
};

/** Hôm nay theo lịch máy người dùng, dạng "YYYY-MM-DD". */
function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Màu theo mức điểm — cùng một thang dùng lại ở mọi chỗ hiển thị điểm. */
function ratingTone(avg: number | null): string {
  if (avg == null) return "text-gray-300";
  if (avg >= 4.5)  return "text-emerald-600";
  if (avg >= 3.5)  return "text-lime-600";
  if (avg >= 2.5)  return "text-amber-500";
  return "text-[#f15b5c]";
}

/** Dãy sao đặc/rỗng cho một điểm trung bình. */
function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-gray-300 italic">Chưa chấm</span>;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: MAX_RATING }, (_, i) => (
        <Star
          key={i}
          className={cn("w-3.5 h-3.5", i < Math.round(value) ? ratingTone(value) : "text-gray-200")}
          fill={i < Math.round(value) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function EvaluationTab() {
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(todayISO());
  const [data, setData]     = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  // Nhân sự đang bung chi tiết — chi tiết cả năm là 366 dòng tự luận nên chỉ
  // tải khi thật sự được mở.
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ period, date: anchor });
      if (openUserId) qs.set("userId", openUserId);
      const res = await fetch(`/api/checklist/evaluation?${qs.toString()}`);
      if (!res.ok) { setData(null); return; }
      setData(await res.json() as Summary);
    } finally {
      setLoading(false);
    }
  }, [period, anchor, openUserId]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Đổi kỳ thì đóng chi tiết lại: số liệu bên trong không còn thuộc kỳ đang xem.
  function changePeriod(next: Period) {
    setPeriod(next);
    setOpenUserId(null);
  }

  const openStaff = data?.staff.find(s => s.userId === openUserId) ?? null;

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Chọn kỳ ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {PERIODS.map((k) => (
            <button
              key={k}
              onClick={() => changePeriod(k)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all",
                period === k ? "bg-white text-[#f15b5c] shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {PERIOD_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAnchor(shiftPeriod(period, anchor, -1))}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors shrink-0"
            aria-label="Kỳ trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <p className="flex-1 min-w-0 text-center text-sm font-extrabold text-gray-800 truncate">
            {data?.label ?? "…"}
          </p>

          <button
            onClick={() => setAnchor(shiftPeriod(period, anchor, 1))}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors shrink-0"
            aria-label="Kỳ sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <input
            type="date"
            lang="vi"
            value={anchor}
            onChange={(e) => { if (e.target.value) setAnchor(e.target.value); }}
            className="h-9 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          />
        </div>

        {data && (
          <p className="text-[11px] text-gray-400">
            {fmtVN(data.from)} – {fmtVN(data.to)} · {data.staff.length} nhân sự
          </p>
        )}
      </div>

      {/* ── Bảng tổng kết ──────────────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="py-12 text-center text-sm text-gray-400 animate-pulse">Đang tải...</div>
      ) : !data || data.staff.length === 0 ? (
        <div className="py-12 text-center">
          <ClipboardList className="w-7 h-7 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Không có nhân sự nào trong phạm vi bạn quản lý</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Máy rộng: bảng. Điện thoại: mỗi người một thẻ, vì 7 cột thì không
              cách nào đọc nổi trên màn 400px. */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] border-b border-gray-200 text-left">
                  <th className="px-4 py-2.5 text-xs font-bold text-gray-400 uppercase">Nhân sự</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-400 uppercase text-center">Ngày có CL</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-400 uppercase text-center">Đã check-out</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-400 uppercase text-center">FM đã chấm</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-400 uppercase text-center">Điểm TB</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-gray-400 uppercase text-center">% việc đạt</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => (
                  <tr key={s.userId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.branchName || "—"}</p>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-gray-600">{s.daysFilled}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("font-bold", s.daysCheckedOut > 0 ? "text-emerald-600" : "text-gray-300")}>
                        {s.daysCheckedOut}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-gray-600">{s.daysReviewed}</td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <span className={cn("font-extrabold mr-1.5", ratingTone(s.avgRating))}>
                        {s.avgRating != null ? s.avgRating.toFixed(1) : "—"}
                      </span>
                      <Stars value={s.avgRating} />
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-gray-600">
                      {s.tasksTotal > 0 ? `${s.taskRate}%` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => setOpenUserId(s.userId)}
                        className="text-xs font-bold text-[#f15b5c] hover:opacity-80 whitespace-nowrap"
                      >
                        Chi tiết →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {data.staff.map((s) => (
              <button
                key={s.userId}
                onClick={() => setOpenUserId(s.userId)}
                className="w-full text-left px-4 py-3.5 hover:bg-gray-50/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{s.name}</p>
                    <p className="text-[11px] text-gray-400">{s.branchName || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-base font-extrabold leading-none", ratingTone(s.avgRating))}>
                      {s.avgRating != null ? s.avgRating.toFixed(1) : "—"}
                    </p>
                    <Stars value={s.avgRating} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                  <span>{s.daysFilled} ngày có CL</span>
                  <span className={s.daysCheckedOut > 0 ? "text-emerald-600 font-semibold" : ""}>
                    {s.daysCheckedOut} đã check-out
                  </span>
                  <span>{s.daysReviewed} lần chấm</span>
                  {s.tasksTotal > 0 && <span>{s.taskRate}% việc đạt</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chi tiết từng ngày của một nhân sự ─────────────────────────────── */}
      {openUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-3 py-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpenUserId(null); }}
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-800 truncate">
                  {openStaff?.name ?? "Chi tiết"}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{data?.label}</p>
              </div>
              <button
                onClick={() => setOpenUserId(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {loading ? (
                <p className="py-10 text-center text-sm text-gray-400 animate-pulse">Đang tải...</p>
              ) : !data?.detail || data.detail.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400 italic">
                  Không có check-list nào trong kỳ này
                </p>
              ) : (
                data.detail.map((d) => (
                  <div key={d.date} className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-extrabold text-gray-700">{fmtVN(d.date)}</p>
                      {d.checkedOutAt ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" /> Đã check-out
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-300">Chưa check-out</span>
                      )}
                      {d.fmRating != null && (
                        <span className={cn("ml-auto text-[11px] font-extrabold", ratingTone(d.fmRating))}>
                          {d.fmRating}/{MAX_RATING} · {RATING_LABEL[d.fmRating]}
                        </span>
                      )}
                    </div>

                    <div className="px-3.5 py-3 space-y-2.5">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                          Tự luận cuối ngày
                        </p>
                        {d.reflection ? (
                          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {d.reflection}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-300 italic">Chưa viết</p>
                        )}
                      </div>

                      {(d.fmComment || d.fmReviewedAt) && (
                        <div className="pt-2.5 border-t border-gray-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                            Đánh giá của FM
                            {d.fmReviewerName ? ` · ${d.fmReviewerName}` : ""}
                          </p>
                          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {d.fmComment || "— (chỉ chấm điểm, không có nhận xét)"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 px-4 sm:px-5 py-3.5 border-t border-gray-100">
              <button
                onClick={() => setOpenUserId(null)}
                className="w-full h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
