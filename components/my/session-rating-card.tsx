"use client";

import { useEffect, useState } from "react";
import { Loader2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format-date";
import { MAX_COMMENT_LENGTH, SCORE_LABELS } from "@/lib/session-rating";

type Pending = { workoutLogId: string; date: string; ptName: string; sessionName: string };

// "Để sau" chỉ là tiện ích riêng của máy này — server vẫn coi buổi là chưa chấm.
const SKIP_KEY = "ladysfit-rating-skipped";

function skippedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SKIP_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Thẻ "Chị chấm buổi tập thế nào?" ở Tổng quan app khách: buổi gần nhất đã đóng
 * mà khách chưa chấm. 1–5 sao + nhận xét, gửi một lần. Điểm về Tổng quan
 * Admin/FM — xem lib/session-rating.
 */
export function SessionRatingCard() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/my/session-ratings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Pending | null) => {
        if (alive && d && !skippedIds().includes(d.workoutLogId)) setPending(d);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function skip() {
    if (!pending) return;
    try {
      localStorage.setItem(SKIP_KEY, JSON.stringify([...skippedIds(), pending.workoutLogId].slice(-30)));
    } catch {
      // Không lưu được thì lần sau hỏi lại, chấp nhận được.
    }
    setPending(null);
  }

  async function submit() {
    if (!pending || score === 0) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/my/session-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutLogId: pending.workoutLogId, score, comment }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error ?? "Có lỗi xảy ra");
      setThanks(true);
      setTimeout(() => { setPending(null); setThanks(false); }, 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setSending(false);
    }
  }

  if (!pending) return null;

  if (thanks) {
    return (
      <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-sm mb-4 text-center">
        <p className="text-2xl">💖</p>
        <p className="text-sm font-extrabold text-gray-800 mt-1">Cảm ơn chị đã đánh giá!</p>
        <p className="text-xs text-gray-400 mt-0.5">Ý kiến của chị giúp Ladysfit phục vụ tốt hơn.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-sm mb-4 relative">
      <button
        onClick={skip}
        className="absolute right-3 top-3 p-1.5 rounded-xl text-gray-300 hover:text-gray-500 hover:bg-gray-50"
        aria-label="Để sau"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="text-sm font-extrabold text-gray-800 pr-8">Chị chấm buổi tập thế nào?</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {fmtDate(pending.date)} · {pending.sessionName.split("—")[0].trim()} cùng PT {pending.ptName}
      </p>

      <div className="flex items-center justify-center gap-1.5 mt-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className="p-1 active:scale-90 transition-transform"
            aria-label={`${n} sao`}
          >
            <Star className={cn("w-8 h-8", n <= score ? "fill-amber-400 text-amber-400" : "text-gray-200")} />
          </button>
        ))}
      </div>
      <p className={cn("text-center text-xs font-bold mt-1 h-4", score ? "text-amber-600" : "text-transparent")}>
        {SCORE_LABELS[score] ?? "·"}
      </p>

      {score > 0 && (
        <>
          <textarea
            rows={3}
            value={comment}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(e) => setComment(e.target.value)}
            placeholder={score >= 4 ? "Điều chị thích ở buổi tập / PT hôm nay… (không bắt buộc)" : "Điều gì khiến chị chưa hài lòng? Ladysfit sẽ cải thiện ngay (không bắt buộc)"}
            className="w-full mt-3 rounded-2xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
          />
          {error && <p className="text-xs text-[#f15b5c] font-medium mt-1">{error}</p>}
          <button
            onClick={submit}
            disabled={sending}
            className="w-full mt-3 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" />}
            Gửi đánh giá
          </button>
        </>
      )}
    </div>
  );
}
