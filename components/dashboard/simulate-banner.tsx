"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Eye, Loader2, LogOut } from "lucide-react";

/** Thanh "Đang giả lập" — chỉ hiện khi Admin đang đóng vai (lib/simulate.ts). */
export function SimulateBanner() {
  const { data, update } = useSession();
  const [leaving, setLeaving] = useState(false);
  const user = data?.user;
  if (!user?.impersonator) return null;

  async function exit() {
    setLeaving(true);
    await update({ simulateUserId: null });
    window.location.href = "/dashboard/settings?tab=simulate";
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
      <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <p className="flex-1 min-w-0 text-sm text-amber-800">
        Đang giả lập <b>{user.name ?? user.email}</b> ({user.role}). Mọi thao tác được ghi như tài khoản này.
      </p>
      <button
        onClick={exit}
        disabled={leaving}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        Thoát giả lập
      </button>
    </div>
  );
}
