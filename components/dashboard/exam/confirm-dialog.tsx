"use client";

import { useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ── Hộp thoại hỏi lại & hộp thoại báo ────────────────────────────────────────
 *
 * Thay cho confirm() và alert() của trình duyệt. Hai thứ đó bung ra một khung
 * xám của Chrome, chữ Arial, nút tiếng Anh, kèm nguyên cái URL của trang —
 * giữa một giao diện đã dựng theo nhận diện thương hiệu thì trông như lỗi.
 *
 * Chúng còn CHẶN CỨNG luồng JavaScript: trong lúc hộp thoại mở, đồng hồ đếm
 * ngược và mọi thứ chạy nền đều đứng hình. Ở màn hình quản trị thì chỉ khó
 * chịu, nhưng đây là component dùng chung nên tránh luôn từ đầu.
 *
 * `tone: "danger"` cho việc không hoàn tác được — nút xác nhận chuyển sang đỏ
 * để người bấm kịp khựng lại một nhịp.
 */

export type DialogTone = "danger" | "normal";

export type ConfirmSpec = {
  title: string;
  message: string;
  /** Dòng cảnh báo phụ, in đậm — thường là hậu quả không lấy lại được. */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  onConfirm: () => void | Promise<void>;
};

const BRAND = "#f15b5c";

function Shell({
  tone,
  title,
  children,
  onClose,
  footer,
}: {
  tone: DialogTone;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer: React.ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/45" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl bg-white font-sans shadow-2xl">
          <div className={cn("relative px-6 py-6", danger ? "bg-red-50" : "bg-gray-50")}>
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/70 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
            <div
              className={cn(
                "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full",
                danger ? "bg-red-100" : "bg-white"
              )}
            >
              {danger ? (
                <AlertTriangle className="h-6 w-6 text-red-500" />
              ) : (
                <Info className="h-6 w-6" style={{ color: BRAND }} />
              )}
            </div>
            <p
              className={cn(
                "text-center text-base font-extrabold",
                danger ? "text-red-700" : "text-gray-900"
              )}
            >
              {title}
            </p>
          </div>

          <div className="px-6 py-5">
            {children}
            <div className="mt-5 flex items-center gap-2">{footer}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ConfirmDialog({
  spec,
  onClose,
}: {
  spec: ConfirmSpec;
  onClose: () => void;
}) {
  const [running, setRunning] = useState(false);
  const danger = (spec.tone ?? "normal") === "danger";

  async function run() {
    setRunning(true);
    try {
      await spec.onConfirm();
      onClose();
    } finally {
      setRunning(false);
    }
  }

  return (
    <Shell
      tone={spec.tone ?? "normal"}
      title={spec.title}
      onClose={running ? () => {} : onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={running}
            className="h-11 flex-1 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {spec.cancelLabel ?? "Huỷ"}
          </button>
          <button
            onClick={run}
            disabled={running}
            className="h-11 flex-1 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: danger ? "#ef4444" : BRAND }}
          >
            {running ? "Đang xử lý..." : spec.confirmLabel ?? "Xác nhận"}
          </button>
        </>
      }
    >
      <p className="text-center text-sm font-semibold leading-snug text-gray-600">
        {spec.message}
      </p>
      {spec.detail && (
        <p
          className={cn(
            "mt-2 text-center text-xs font-bold leading-snug",
            danger ? "text-red-600" : "text-gray-500"
          )}
        >
          {spec.detail}
        </p>
      )}
    </Shell>
  );
}

export type NoticeSpec = {
  title: string;
  message?: string;
  tone?: DialogTone;
  closeLabel?: string;
};

/** Hộp thoại chỉ để báo một chuyện — thay cho alert(). */
export function NoticeDialog({
  spec,
  onClose,
}: {
  spec: NoticeSpec;
  onClose: () => void;
}) {
  return (
    <Shell
      tone={spec.tone ?? "normal"}
      title={spec.title}
      onClose={onClose}
      footer={
        <button
          onClick={onClose}
          className="h-11 w-full rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: BRAND }}
        >
          {spec.closeLabel ?? "Đã hiểu"}
        </button>
      }
    >
      {spec.message && (
        <p className="text-center text-sm font-semibold leading-snug text-gray-600">
          {spec.message}
        </p>
      )}
    </Shell>
  );
}
