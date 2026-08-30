"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ClipboardCheck, CalendarClock, Lock, ShieldCheck } from "lucide-react";
import { fmtExamDate, type ExamWindowState } from "@/lib/exam-schedule";

/**
 * Thẻ mời làm bài kiểm tra dành cho FM được Admin chỉ định bắt buộc thi.
 *
 * Khác thẻ thăng cấp của HLV ở chỗ đây không phải cuộc đua: FM làm bài để ban
 * quản lý nắm chuyên môn, điểm không đụng tới chức vụ hay quyền lợi. Nên thẻ
 * này nói thẳng điều đó thay vì treo phần thưởng thăng cấp.
 *
 * FM không có tên trong danh sách thì API trả isRequiredFM = false và thẻ ẩn
 * hoàn toàn — xem lib/exam-required-fm.ts.
 */

type ExamStatus = {
  isRequiredFM: boolean;
  passingScore: number;
  numQuestions: number;
  lastAttempt: {
    score: number;
    total: number;
    passed: boolean;
    createdAt: string;
  } | null;
  exam: {
    state: ExamWindowState;
    open: boolean;
    message: string;
    examDate: string | null;
    examStartTime: string;
    examEndTime: string;
  };
};

export function FMExamCard() {
  const [status, setStatus] = useState<ExamStatus | null>(null);

  useEffect(() => {
    fetch("/api/exam/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStatus(data); })
      .catch(() => {});
  }, []);

  if (!status?.isRequiredFM) return null;

  const exam = status.exam;
  const last = status.lastAttempt;
  const lastPct =
    last && last.total > 0 ? Math.round((last.score / last.total) * 100) : null;

  return (
    <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-sky-50 shrink-0">
          <ClipboardCheck className="w-5 h-5 text-sky-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-gray-900">
            Bài kiểm tra chuyên môn dành cho bạn
          </p>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Ban quản lý đã chỉ định bạn làm bài kiểm tra của kỳ thi này
          </p>

          <div className="mt-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500">
              <span className="font-bold text-gray-700">{status.numQuestions}</span> câu hỏi
            </span>
            <span className="text-gray-200">·</span>
            <span className="text-xs text-gray-500">
              Điểm đạt <span className="font-bold text-gray-700">{status.passingScore}%</span>
            </span>
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-sky-600">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
            Điểm chỉ để ban quản lý nắm chuyên môn — không đạt cũng không bị phạt, không ảnh
            hưởng chức vụ hay quyền lợi của bạn.
          </p>

          {lastPct !== null && last && (
            <p className="mt-2 text-xs font-semibold text-gray-500">
              Lần gần nhất: {lastPct}% — {last.passed ? "Đạt" : "Chưa đạt"}
            </p>
          )}

          {exam.state === "BEFORE" && exam.examDate && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-500">
              <CalendarClock className="w-3.5 h-3.5" />
              Lịch thi: {fmtExamDate(exam.examDate)} · {exam.examStartTime}–{exam.examEndTime}
            </p>
          )}

          {exam.open ? (
            <Link
              href="/dashboard/exam/take"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 text-xs font-bold text-white hover:opacity-90 transition-opacity"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              {last ? "Làm lại bài kiểm tra" : "Bắt đầu làm bài"}
            </Link>
          ) : (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-gray-500">{exam.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
