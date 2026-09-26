"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { LoginOtpStep, requestLoginOtp } from "@/components/auth/login-otp-step";

export default function MyLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Giữ lại email/mật khẩu cho bước nhập mã khi đăng nhập trên máy lạ.
  const [creds, setCreds] = useState({ email: "", password: "" });
  const [otpStep, setOtpStep] = useState<{ maskedEmail: string; retryAfterSec: number } | null>(null);

  async function doSignIn(email: string, password: string, otp?: string) {
    // Fetch CSRF token from the client auth endpoint (not the staff /api/auth endpoint)
    const csrfRes = await fetch("/api/my/auth/csrf");
    const { csrfToken } = await csrfRes.json();

    // POST directly to the client auth callback — bypasses the global __NEXTAUTH.basePath
    // which gets overwritten by the root SessionProvider in providers.tsx
    const res = await fetch("/api/my/auth/callback/client-credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        email,
        password,
        ...(otp ? { otp } : {}),
        csrfToken,
        callbackUrl: `${window.location.origin}/my`,
        json: "true",
      }),
    });

    const data = await res.json();

    if (data.url && !data.url.includes("error")) {
      // Hard navigation (không dùng router.push) để xoá sạch Router Cache phía
      // trình duyệt — tránh thấy dữ liệu của tài khoản khách đã đăng nhập trước
      // đó khi dùng chung 1 máy/điện thoại.
      window.location.href = "/my";
      return;
    }
    const code = data.url ? new URL(data.url, window.location.origin).searchParams.get("error") : null;
    setError(!code || code === "CredentialsSignin" ? "Email hoặc mật khẩu không đúng" : code);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string)?.trim().toLowerCase();
    const password = fd.get("password") as string;
    setCreds({ email, password });

    try {
      const check = await requestLoginOtp("client", email, password);
      if (!check.ok) {
        setError(check.error);
      } else if (check.otpRequired) {
        setOtpStep({ maskedEmail: check.maskedEmail, retryAfterSec: check.retryAfterSec });
      } else {
        await doSignIn(email, password);
      }
    } catch (err) {
      console.error("[my/login] error:", err);
      setError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(code: string) {
    setLoading(true);
    setError("");
    try {
      await doSignIn(creds.email, creds.password, code);
    } catch (err) {
      console.error("[my/login] error:", err);
      setError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    const check = await requestLoginOtp("client", creds.email, creds.password);
    if (!check.ok) {
      setError(check.error);
      return null;
    }
    return check.otpRequired ? check.retryAfterSec : 0;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[390px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Ladysfit" className="mx-auto mb-4" style={{ width: 80 }} />
          <h1 className="text-2xl font-black text-[#f15b5c]">Trang của tôi</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
          {otpStep ? (
            <LoginOtpStep
              maskedEmail={otpStep.maskedEmail}
              initialRetryAfterSec={otpStep.retryAfterSec}
              loading={loading}
              error={error}
              onSubmit={handleOtpSubmit}
              onResend={handleResend}
              onBack={() => {
                setOtpStep(null);
                setError("");
              }}
            />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="email@example.com"
                className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Mật khẩu</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full h-12 rounded-2xl border border-gray-200 px-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-[#f15b5c] font-semibold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl text-white font-bold text-sm shadow-sm disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
          )}

          <p className="text-center text-xs text-gray-400 font-semibold pt-2">
            Liên hệ PT để được cấp tài khoản
          </p>
        </div>
      </div>
    </div>
  );
}
