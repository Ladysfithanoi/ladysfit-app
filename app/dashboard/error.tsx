"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <p className="text-4xl font-extrabold text-[#f15b5c] mb-4">!</p>
        <h2 className="text-lg font-bold text-gray-900">Đã xảy ra lỗi</h2>
        <p className="text-sm text-gray-400 mt-1">Không thể tải trang này.</p>
        <button
          onClick={reset}
          className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#f15b5c" }}
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
