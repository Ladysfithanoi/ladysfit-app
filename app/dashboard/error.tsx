"use client";

import { useEffect } from "react";

// Màn "Đã xảy ra lỗi" của toàn bộ dashboard.
//
// Trước đây màn này chỉ ghi lỗi ra console của điện thoại — không ai đọc được, PT
// chỉ thấy "Không thể tải trang này" và phải tự tải lại. Giờ:
//   • Gửi lỗi thật về máy chủ (bảng client_error_logs) để tra ra nguyên nhân.
//   • Lỗi do app vừa cập nhật (trang cũ đòi một file JS của bản cũ đã bị thay)
//     thì tự tải lại một lần — tải lại là hết, không bắt PT bấm.
//   • "Thử lại" tải lại hẳn trang thay vì chỉ vẽ lại: vẽ lại trên đúng trạng thái
//     vừa hỏng thường hỏng y như cũ. Số liệu buổi tập đã tự lưu nên không mất.

const RELOAD_KEY = "dashboardErrorReloadAt";

/** Lỗi kiểu "trang cũ, bản mới" — tải lại là khỏi. */
function isStaleBuild(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Failed to fetch dynamically|Importing a module script failed/i.test(text);
}

export default function DashboardError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);

    fetch("/api/client-errors", {
      method:    "POST",
      headers:   { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message: `${error.name}: ${error.message}`,
        stack:   error.stack ?? null,
        digest:  error.digest ?? null,
        url:     window.location.href,
      }),
    }).catch(() => {});

    // Tự tải lại tối đa một lần mỗi 30 giây, để lỗi lặp lại không thành vòng
    // tải lại bất tận.
    if (isStaleBuild(error)) {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // Không đọc được sessionStorage thì để PT tự bấm.
      }
    }
  }, [error]);

  return (
    <div className="flex items-center justify-center px-4 py-24">
      <div className="text-center max-w-sm">
        <p className="text-4xl font-extrabold text-[#f15b5c] mb-4">!</p>
        <h2 className="text-lg font-bold text-gray-900">Đã xảy ra lỗi</h2>
        <p className="text-sm text-gray-400 mt-1">
          Không thể tải trang này. Bấm tải lại — số liệu bài tập đã nhập được tự lưu nên không mất.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#f15b5c" }}
        >
          Tải lại trang
        </button>
        <p className="mt-4 text-[10px] text-gray-300 break-words">{error.message}</p>
      </div>
    </div>
  );
}
