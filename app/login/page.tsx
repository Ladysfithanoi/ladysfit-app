"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasLogo, setHasLogo] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email hoặc mật khẩu không đúng.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          {hasLogo ? (
            <div className="mb-4">
              <Image
                src="/logo.png"
                alt="Ladysfit"
                width={120}
                height={120}
                className="object-contain"
                onError={() => setHasLogo(false)}
                priority
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-[#f15b5c] flex items-center justify-center mb-4 shadow-lg shadow-[#f15b5c]/30">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-11 h-11"
              >
                <path
                  d="M24 8C15.163 8 8 15.163 8 24s7.163 16 16 16 16-7.163 16-16S32.837 8 24 8z"
                  fill="white"
                  fillOpacity="0.2"
                />
                <path
                  d="M16 20c0-1.1.9-2 2-2h4v-4a2 2 0 1 1 4 0v4h4a2 2 0 1 1 0 4h-4v4a2 2 0 1 1-4 0v-4h-4a2 2 0 0 1-2-2z"
                  fill="white"
                />
                <circle cx="32" cy="32" r="6" fill="white" fillOpacity="0.9" />
                <path
                  d="M30 32l1.5 1.5L34 30"
                  stroke="#f15b5c"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-[#f15b5c] text-center tracking-tight">
            Dashboard Khách Hàng
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-gray-700 font-semibold text-sm">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@ladysfit.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 rounded-xl border-gray-200 focus-visible:ring-[#f15b5c] focus-visible:ring-offset-0 text-gray-800 placeholder:text-gray-300 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-gray-700 font-semibold text-sm">
              Mật khẩu
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-12 rounded-xl border-gray-200 focus-visible:ring-[#f15b5c] focus-visible:ring-offset-0 text-gray-800 placeholder:text-gray-300 text-sm pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-[#f15b5c] font-medium">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <p className="text-xs text-gray-400 font-medium">
              Quên mật khẩu? Liên hệ Admin để được reset
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl text-white font-bold text-sm tracking-wide transition-all duration-200 shadow-md shadow-[#f15b5c]/25 hover:shadow-lg hover:shadow-[#f15b5c]/30 hover:-translate-y-0.5 active:translate-y-0"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Đăng nhập"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-10 font-medium">
          © 2026 Trung Trung. All rights reserved.
        </p>
      </div>
    </div>
  );
}
