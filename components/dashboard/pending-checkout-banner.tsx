"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

type PendingItem = {
  id: string;
  clientId: string;
  clientName: string;
  ptName: string | null;
  sessionName: string;
  checkInAt: string | null;
};

function sinceLabel(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} tiếng ${m} phút trước` : `${h} tiếng trước`;
}

// On-demand alert: sessions checked in >90' ago with no check-out signature yet.
// The package was already deducted at check-in, but the PT hasn't been credited
// for teaching, so these need a check-out signature before they count for salary.
export function PendingCheckoutBanner() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/workout-logs/pending-checkout");
        if (!res.ok) return;
        const data = (await res.json()) as PendingItem[];
        if (active) setItems(data);
      } catch {
        // best-effort
      }
    };
    load();
    // Refresh periodically while the dashboard stays open.
    const t = setInterval(load, 5 * 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  if (dismissed || items.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50">
      {/* Compact one-line summary; click to expand the list */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left text-xs font-bold text-amber-800 truncate"
          title="Xem chi tiết"
        >
          {items.length} buổi chưa ký check-out (&gt;90&apos;)
          <span className="ml-1 font-semibold text-amber-600">{expanded ? "Thu gọn" : "Xem"}</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-400 hover:text-amber-700"
          title="Ẩn cảnh báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <ul className="px-3 pb-2 pt-1.5 border-t border-amber-100 grid gap-x-4 gap-y-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.id} className="text-xs text-amber-900 truncate">
              <Link
                href={`/dashboard/clients/${it.clientId}`}
                className="font-bold underline decoration-amber-300 hover:decoration-amber-600"
              >
                {it.clientName}
              </Link>
              {it.ptName ? <span className="text-amber-600"> · {it.ptName}</span> : null}
              <span className="text-amber-500"> · {sinceLabel(it.checkInAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
