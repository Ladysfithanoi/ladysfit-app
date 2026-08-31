"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GraduationCap, CalendarClock, Lock, CheckCircle2, EyeOff } from "lucide-react";
import { fmtExamDate, type ExamWindowState } from "@/lib/exam-schedule";
import { ExamHistoryLink } from "./exam-history-modal";

type ExamStatus = {
  role: string;
  retestIntervalDays: number;
  ptLevelName: string | null;
  ptLevelColor: string | null;
  defaultLevelName: string | null;
  defaultLevelColor: string | null;
  nextLevelName: string | null;
  nextLevelColor: string | null;
  isAtDefaultLevel: boolean;
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
  // Mỗi người chỉ thi một lần một kỳ — thi rồi thì không còn nút vào thi.
  alreadyTaken: boolean;
  exam: {
    state: ExamWindowState;
    open: boolean;
    message: string;
    examDate: string | null;
    examStartTime: string;
    examEndTime: string;
    durationMinutes: number;
    focusPenaltyMinutes: number;
  };
};

export function UpgradeCard() {
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exam/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStatus(data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !status) return null;
  if (!status.enableLevelSystem) return null;
  if (!status.nextLevelName) return null; // already at top level

  const targetColor = status.nextLevelColor || "#f15b5c";
  const exam = status.exam ?? {
    state: "DISABLED" as ExamWindowState,
    open: false,
    message: "Kỳ thi đang đóng. Vui lòng chờ quản lý mở lịch thi.",
    examDate: null,
    examStartTime: "00:00",
    examEndTime: "23:59",
    durationMinutes: 0,
    focusPenaltyMinutes: 0,
  };
  const lastFailed = status.lastAttempt && !status.lastAttempt.passed;
  const currentLevelName = status.ptLevelName;
  const currentLevelColor = status.ptLevelColor;

  return (
    <div className="bg-white rounded-2xl border border-[#f15b5c]/20 shadow-sm p-5 mb-5">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-[#f15b5c]/10 shrink-0">
          <GraduationCap className="w-5 h-5 text-[#f15b5c]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-extrabold text-gray-900">
              Nâng lên cấp{" "}
              <span style={{ color: targetColor }}>{status.nextLevelName}</span>
            </p>
            {currentLevelName && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: (currentLevelColor || "#6b7280") + "22", color: currentLevelColor || "#6b7280" }}
              >
                Hiện tại: {currentLevelName}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-medium">
            Vượt qua bài kiểm tra để thăng lên cấp độ cao hơn
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

          {/* Lịch thi: chỉ mở nút thi trong đúng khung giờ */}
          {exam.state === "BEFORE" && exam.examDate && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-500">
              <CalendarClock className="w-3.5 h-3.5" />
              Lịch thi: {fmtExamDate(exam.examDate)} · {exam.examStartTime}–{exam.examEndTime}
            </p>
          )}

          {/* Luật thi: mỗi người một lần, và rời trang là mất giờ */}
          {exam.open && !status.alreadyTaken && (
            <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2">
              <EyeOff className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-orange-700 leading-snug">
                Mỗi người chỉ được thi <span className="font-extrabold">một lần duy nhất</span>.
                {exam.focusPenaltyMinutes > 0 && (
                  <> Rời khỏi trang thi bị trừ {exam.focusPenaltyMinutes} phút mỗi lần.</>
                )}
              </p>
            </div>
          )}

          {status.alreadyTaken ? (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-emerald-700">
                Bạn đã hoàn thành bài thi của kỳ này. Mỗi người chỉ thi một lần duy nhất nên
                không vào thi lại được nữa.
              </p>
            </div>
          ) : exam.open ? (
            <Link
              href="/dashboard/exam/take"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Bắt đầu thi
            </Link>
          ) : (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-gray-500">{exam.message}</p>
            </div>
          )}

          {/* Lịch sử thi của chính mình — chỉ hiện khi đã từng làm bài */}
          {status.lastAttempt && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <ExamHistoryLink />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
