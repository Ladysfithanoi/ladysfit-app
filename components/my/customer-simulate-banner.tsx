"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, LogOut } from "lucide-react";

/**
 * Thanh "Đang giả lập khách hàng" ở cổng /my — chỉ hiện khi Admin vào bằng
 * Cài đặt → Giả lập → Khách hàng (provider "client-simulate", lib/client-auth.ts).
 * Đọc thẳng /api/my/auth/session: SessionProvider gốc ghi đè basePath toàn cục.
 */
export function CustomerSimulateBanner() {
  const [simulated, setSimulated] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    fetch("/api/my/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setSimulated(!!s?.user?.simulatedBy))
      .catch(() => {});
  }, []);

  if (!simulated) return null;

  async function exit() {
    setLeaving(true);
    try {
      const { csrfToken } = await (await fetch("/api/my/auth/csrf")).json();
      await fetch("/api/my/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, json: "true" }),
      });
    } finally {
      window.location.href = "/dashboard/settings?tab=simulate";
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
      <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="flex-1 min-w-0 text-xs text-amber-800">
        Đang giả lập <b>khách hàng test</b>. Thao tác được ghi vào khách test.
      </p>
      <button
        onClick={exit}
        disabled={leaving}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
      >
        {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        Thoát
      </button>
    </div>
  );
}
