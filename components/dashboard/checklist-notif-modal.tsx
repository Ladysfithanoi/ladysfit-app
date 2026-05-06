"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, XCircle, ExternalLink } from "lucide-react";

type PTEntry = { id: string; name: string; branchName: string };

type DetailData = {
  date:      string;
  filled:    PTEntry[];
  notFilled: PTEntry[];
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ChecklistReportModal({
  date,
  onClose,
}: {
  date: string;   // ISO date string
  onClose: () => void;
}) {
  const [data, setData]       = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const d = new Date(date);
    const dateParam = d.toISOString().split("T")[0];
    fetch(`/api/notifications/checklist-report-detail?date=${dateParam}`)
      .then((r) => r.json())
      .then((j) => { setData(j); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="text-sm font-extrabold text-gray-900">
            Báo cáo Check-list — {data ? fmtDate(data.date) : "…"}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400 animate-pulse">Đang tải...</div>
          ) : !data ? (
            <div className="py-10 text-center text-sm text-gray-400">Không thể tải dữ liệu</div>
          ) : (
            <>
              {/* Filled */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-sm font-extrabold text-emerald-700">
                    Đã điền ({data.filled.length} người)
                  </p>
                </div>
                {data.filled.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-6">Không có</p>
                ) : (
                  <div className="space-y-1 pl-1">
                    {data.filled.map((pt) => (
                      <div key={pt.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-50/60">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-extrabold text-emerald-600">
                            {pt.name[0]?.toUpperCase() ?? "?"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{pt.name}</p>
                          <p className="text-[10px] text-gray-400">{pt.branchName}</p>
                        </div>
                        <a
                          href="/dashboard/checklist"
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:opacity-80 transition-opacity shrink-0"
                        >
                          Xem <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Not filled */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm font-extrabold text-red-600">
                    Chưa điền ({data.notFilled.length} người)
                  </p>
                </div>
                {data.notFilled.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-6">Không có</p>
                ) : (
                  <div className="space-y-1 pl-1">
                    {data.notFilled.map((pt) => (
                      <div key={pt.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-red-50/60">
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-extrabold text-red-400">
                            {pt.name[0]?.toUpperCase() ?? "?"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{pt.name}</p>
                          <p className="text-[10px] text-gray-400">{pt.branchName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
