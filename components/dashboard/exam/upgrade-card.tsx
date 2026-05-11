"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GraduationCap, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ExamStatus = {
  role: string;
  upgradeDate: string | null;
  freeUpgradedAt: string | null;
  daysLeft: number | null;
  expired: boolean;
  retestIntervalDays: number;
  ptLevelName: string | null;
  ptLevelColor: string | null;
  defaultLevelName: string | null;
  defaultLevelColor: string | null;
  lastAttempt: {
    id: string;
    score: number;
    total: number;
    passed: boolean;
    createdAt: string;
  } | null;
  passingScore: number;
  numQuestions: number;
  enableLevelSystem: boolean;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function UpgradeCard() {
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exam/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStatus(data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!status) return null;
  if (!status.enableLevelSystem) return null;

  // ─── FREE role: active or expired ───
  if (status.role === "FREE") {
    const daysLeft = status.daysLeft ?? 0;
    const isExpired = status.expired;
    const isWarning = !isExpired && daysLeft <= 7;
    const retestDays = status.retestIntervalDays;
    const levelName = status.ptLevelName || "Tự do";
    const levelColor = status.ptLevelColor || "#3b82f6";
    const daysUsed = retestDays - daysLeft;
    const progressPct = Math.min(100, Math.round((daysUsed / retestDays) * 100));

    if (isExpired) {
      return (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-100 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-extrabold text-gray-900">Quyền truy cập hết hạn</p>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: levelColor + "22", color: levelColor }}>
                  {levelName}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Thời gian cấp độ {levelName} đã hết. Tài khoản sẽ về cấp Hạn chế khi đăng nhập lại.
              </p>
              {status.upgradeDate && (
                <p className="text-xs text-gray-400 mt-1">
                  Được thăng cấp ngày: {formatDate(status.upgradeDate)}
                </p>
              )}
              <Link
                href="/dashboard/exam/take"
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 border-[#f15b5c] text-[#f15b5c] hover:bg-[#f15b5c] hover:text-white transition-all"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Thi lại để gia hạn
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-blue-50 shrink-0">
            <GraduationCap className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-extrabold text-gray-900">Cấp độ hiện tại</p>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: levelColor + "22", color: levelColor }}>
                {levelName}
              </span>
            </div>

            {/* Upgrade date & duration */}
            <div className="space-y-0.5 mb-3">
              {status.upgradeDate && (
                <p className="text-xs text-gray-500 font-medium">
                  Được thăng cấp ngày:{" "}
                  <span className="font-bold text-gray-700">{formatDate(status.upgradeDate)}</span>
                </p>
              )}
              <p className="text-xs text-gray-500 font-medium">
                Thời hạn duy trì:{" "}
                <span className="font-bold text-gray-700">{retestDays} ngày</span>
              </p>
            </div>

            {/* Countdown */}
            <div className="flex items-center gap-2 mb-2">
              <Clock
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  isWarning ? "text-orange-500" : "text-[#f15b5c]"
                )}
              />
              <span
                className={cn(
                  "text-xs font-extrabold",
                  isWarning ? "text-orange-500" : "text-[#f15b5c]"
                )}
              >
                Còn {daysLeft} ngày
              </span>
              {isWarning && (
                <span className="text-xs text-orange-400 font-medium">— Sắp hết hạn!</span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: isWarning ? "#f97316" : "#f15b5c",
                }}
              />
            </div>

            {/* Action button */}
            <Link
              href="/dashboard/exam/take"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 border-[#f15b5c] text-[#f15b5c] hover:bg-[#f15b5c] hover:text-white transition-all"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Thi duy trì cấp độ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESTRICTED role ───
  if (status.role === "RESTRICTED") {
    const lastFailed = status.lastAttempt && !status.lastAttempt.passed;
    const targetName = status.defaultLevelName || "Tự do";
    return (
      <div className="bg-white rounded-2xl border border-[#f15b5c]/20 shadow-sm p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-[#f15b5c]/10 shrink-0">
            <GraduationCap className="w-5 h-5 text-[#f15b5c]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-gray-900">Thăng cấp lên {targetName}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              Vượt qua bài kiểm tra để mở khóa đầy đủ tính năng trong 30 ngày
            </p>

            <div className="mt-2.5 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="font-bold text-gray-700">{status.numQuestions}</span> câu hỏi
              </span>
              <span className="text-gray-200">·</span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                Điểm đạt{" "}
                <span className="font-bold text-gray-700">{status.passingScore}%</span>
              </span>
            </div>

            {lastFailed && status.lastAttempt && (
              <p className="mt-2 text-xs text-red-500 font-semibold">
                Lần trước: {Math.round((status.lastAttempt.score / status.lastAttempt.total) * 100)}% — Chưa đạt
              </p>
            )}

            <Link
              href="/dashboard/exam/take"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {lastFailed ? "Thi lại ngay" : "Bắt đầu thi"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
