"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BellRing, Check, X } from "lucide-react";

/**
 * Dòng nhắc "đến hẹn chăm sóc lại", nằm ngay dưới dòng nhắc buổi tập chưa ký
 * check-out. Hẹn được đặt trong ô Chăm sóc của Setup doanh số.
 *
 * Cùng một khuôn với PendingCheckoutBanner — một dòng gọn, bấm vào mới bung
 * danh sách — để hai lời nhắc xếp chồng nhau không biến đầu trang thành một bức
 * tường chữ.
 */

type FollowUp = {
  id:           string;
  customerName: string;
  phone:        string | null;
  followUpAt:   string;
  followUpNote: string | null;
  ptName:       string | null;
  branchName:   string | null;
  due:          boolean;
};

/** "14:30" hoặc "14:30 · 24/09" nếu cái hẹn không phải hôm nay. */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return hhmm;
  return `${hhmm} · ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function FollowUpReminderBanner() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/setup/leads/follow-ups");
      if (!res.ok) return;
      setItems(await res.json() as FollowUp[]);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    load();
    // Một cái hẹn 14:30 phải tự nổi lên lúc 14:30 dù người ta để yên trang từ
    // sáng, nên vẫn hỏi lại theo nhịp như dòng nhắc check-out.
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function markDone(id: string) {
    setDoneIds(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/setup/leads/${id}/follow-up`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ done: true }),
      });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {
      // Không tắt được thì trả lại nút cho người dùng bấm lần nữa.
      setDoneIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  const visible = items.filter(i => !doneIds.has(i.id));
  if (dismissed || visible.length === 0) return null;

  const dueCount  = visible.filter(i => i.due).length;
  const soonCount = visible.length - dueCount;

  return (
    <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50">
      <div className="flex items-center gap-2 px-3 py-2">
        <BellRing className="w-4 h-4 text-sky-600 flex-shrink-0" />
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex-1 min-w-0 text-left text-xs font-bold text-sky-800 truncate"
          title="Xem chi tiết"
        >
          {dueCount > 0
            ? `${dueCount} khách đến hẹn chăm sóc lại`
            : `${soonCount} hẹn chăm sóc hôm nay`}
          {dueCount > 0 && soonCount > 0 && (
            <span className="font-semibold text-sky-600"> · {soonCount} hẹn nữa hôm nay</span>
          )}
          <span className="ml-1 font-semibold text-sky-600">{expanded ? "Thu gọn" : "Xem"}</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-sky-400 hover:text-sky-700"
          title="Ẩn nhắc hẹn"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <ul className="px-3 pb-2 pt-1.5 border-t border-sky-100 grid gap-x-4 gap-y-1.5 grid-cols-1 lg:grid-cols-2">
          {visible.map(it => (
            <li key={it.id} className="flex items-start gap-2 text-xs text-sky-900 min-w-0">
              <span className={it.due ? "font-extrabold text-sky-700" : "font-bold text-sky-500"}>
                {whenLabel(it.followUpAt)}
              </span>
              <span className="flex-1 min-w-0">
                <Link
                  href="/dashboard/setup"
                  className="font-bold underline decoration-sky-300 hover:decoration-sky-600"
                >
                  {it.customerName}
                </Link>
                {it.phone && <span className="text-sky-700"> · {it.phone}</span>}
                {it.ptName && <span className="text-sky-500"> · {it.ptName}</span>}
                {it.followUpNote && (
                  <span className="block text-sky-600 truncate">{it.followUpNote}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => markDone(it.id)}
                title="Đã chăm xong — tắt nhắc"
                className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-sky-600 hover:text-sky-800"
              >
                <Check className="w-3 h-3" /> Xong
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
