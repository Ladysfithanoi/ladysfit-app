"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

/**
 * Bước nhập mã xác minh khi đăng nhập trên thiết bị mới — dùng chung cho
 * /login (nhân sự) và /my/login (khách). Mã được gửi qua /api/login-otp.
 */
export function LoginOtpStep({
  maskedEmail,
  initialRetryAfterSec,
  loading,
  error,
  onSubmit,
  onResend,
  onBack,
}: {
  maskedEmail: string;
  initialRetryAfterSec: number;
  loading: boolean;
  error: string;
  onSubmit: (code: string) => void;
  onResend: () => Promise<number | null>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(initialRetryAfterSec);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function handleResend() {
    setResending(true);
    const next = await onResend();
    setResending(false);
    if (next !== null) setResendIn(next);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onSubmit(code);
      }}
      className="space-y-4"
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-[#f15b5c]/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-[#f15b5c]" />
        </div>
        <p className="text-sm font-extrabold text-gray-800">Xác minh thiết bị mới</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Đây là lần đầu tài khoản đăng nhập trên thiết bị này. Mã 6 số đã được gửi tới{" "}
          <span className="font-bold text-gray-700">{maskedEmail}</span>. Kiểm tra cả mục Spam/Quảng cáo nếu không thấy.
        </p>
      </div>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="••••••"
        className="w-full h-14 rounded-2xl border border-gray-200 px-4 text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
      />

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-[#f15b5c] font-semibold">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full h-12 rounded-2xl text-white font-bold text-sm shadow-sm disabled:opacity-50 transition-opacity flex items-center justify-center"
        style={{ backgroundColor: "#f15b5c" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác minh & đăng nhập"}
      </button>

      <div className="flex items-center justify-between text-xs font-semibold">
        <button type="button" onClick={onBack} className="text-gray-400 hover:text-gray-600">
          ← Quay lại
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendIn > 0 || resending}
          className="text-[#f15b5c] disabled:text-gray-300"
        >
          {resending ? "Đang gửi..." : resendIn > 0 ? `Gửi lại mã (${resendIn}s)` : "Gửi lại mã"}
        </button>
      </div>
    </form>
  );
}

export type LoginOtpCheck =
  | { ok: true; otpRequired: false }
  | { ok: true; otpRequired: true; maskedEmail: string; retryAfterSec: number }
  | { ok: false; error: string };

/** Gọi bước 1 — kiểm mật khẩu và (nếu máy lạ) gửi mã về email. */
export async function requestLoginOtp(
  kind: "staff" | "client",
  email: string,
  password: string,
): Promise<LoginOtpCheck> {
  try {
    const res = await fetch("/api/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Có lỗi xảy ra, vui lòng thử lại" };
    if (!data.otpRequired) return { ok: true, otpRequired: false };
    return { ok: true, otpRequired: true, maskedEmail: data.maskedEmail, retryAfterSec: data.retryAfterSec ?? 60 };
  } catch {
    return { ok: false, error: "Có lỗi xảy ra, vui lòng thử lại" };
  }
}
