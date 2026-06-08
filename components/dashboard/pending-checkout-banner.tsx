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
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 md:p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-amber-800">
            {items.length} buổi tập chưa ký check-out (quá 90 phút)
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Khách đã check-in nhưng PT chưa cho khách ký check-out. Buổi chưa được tính cho PT — vui lòng cho khách ký để tính buổi dạy.
          </p>
          <ul className="mt-2 space-y-1">
            {items.map((it) => (
              <li key={it.id} className="text-xs text-amber-900">
                <Link
                  href={`/dashboard/clients/${it.clientId}`}
                  className="font-bold underline decoration-amber-300 hover:decoration-amber-600"
                >
                  {it.clientName}
                </Link>
                {it.ptName ? <span className="text-amber-700"> · PT {it.ptName}</span> : null}
                {it.sessionName ? <span className="text-amber-600"> · {it.sessionName}</span> : null}
                <span className="text-amber-500"> · check-in {sinceLabel(it.checkInAt)}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-500 hover:text-amber-700"
          title="Ẩn cảnh báo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
