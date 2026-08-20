"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkoutProgram } from "@/components/dashboard/workout-tab";

// ── Chuyển giai đoạn tập cho khách ─────────────────────────────────────────
//
// Trước đây hệ thống tự tính lại giai đoạn ở mỗi lần mở trang và tự đổi trạng
// thái chương trình. Giờ việc chuyển hoàn toàn do người dùng bấm ở đây.
//
// Luật "ai được chuyển sang giai đoạn nào" nằm ở server (lib/phase-progression)
// và được trả về qua GET /api/clients/[id]/phase-switch. Màn này chỉ hiển thị
// đúng kết quả đánh giá đó, nên giao diện không bao giờ lệch luật với API.

type PhaseSwitchOption = {
  order: number;
  label: string;
  isCurrent: boolean;
  allowed: boolean;
  reason?: string;
  bypassesWeekGate: boolean;
};

type PhaseSwitchInfo = {
  currentOrder: number;
  currentPhase: string | null;
  completedWeeks: number;
  requiredWeeks: number;
  canBypass: boolean;
  options: PhaseSwitchOption[];
};

export function PhaseSwitchModal({
  clientId,
  onClose,
  onSwitched,
}: {
  clientId: string;
  onClose: () => void;
  onSwitched: (programs: WorkoutProgram[]) => void;
}) {
  const [info, setInfo] = useState<PhaseSwitchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [confirmOrder, setConfirmOrder] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/clients/${clientId}/phase-switch`)
      .then((r) => r.json())
      .then((data: PhaseSwitchInfo & { error?: string }) => {
        if (!alive) return;
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => {
        if (alive) setError("Không tải được danh sách giai đoạn");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [clientId]);

  async function doSwitch(order: number) {
    setSwitching(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/phase-switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      const data = (await res.json()) as { error?: string; programs?: WorkoutProgram[] };
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      onSwitched(data.programs ?? []);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setConfirmOrder(null);
    } finally {
      setSwitching(false);
    }
  }

  const pending = info?.options.find((o) => o.order === confirmOrder) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-gray-900">Chuyển giai đoạn tập</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {info?.currentPhase
                ? `Đang áp dụng: ${info.currentPhase}`
                : "Khách chưa có chương trình nào đang áp dụng"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {!loading && info && (
            <>
              {info.currentOrder > 0 && (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 leading-relaxed">
                  Khách đã hoàn thành{" "}
                  <span className="font-bold text-gray-700">
                    {info.completedWeeks}/{info.requiredWeeks} tuần
                  </span>{" "}
                  ở giai đoạn hiện tại — một tuần chỉ được tính khi có đủ buổi tập đã ghi nhật ký.
                </p>
              )}

              {info.options.map((o) => (
                <div
                  key={o.order}
                  className={cn(
                    "rounded-xl border px-4 py-3",
                    o.isCurrent ? "border-green-200 bg-green-50/50" : "border-gray-200"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">{o.label}</p>
                      {o.isCurrent && (
                        <p className="text-xs text-green-700 font-semibold mt-0.5">Đang áp dụng</p>
                      )}
                      {!o.isCurrent && o.reason && (
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{o.reason}</p>
                      )}
                      {!o.isCurrent && o.allowed && o.bypassesWeekGate && (
                        <p className="text-xs text-amber-600 font-semibold mt-0.5 leading-relaxed">
                          ⚡ Khách chưa đủ số tuần — chuyển sớm theo quyền quản lý
                        </p>
                      )}
                    </div>
                    {!o.isCurrent && (
                      <button
                        onClick={() => {
                          setError("");
                          setConfirmOrder(o.order);
                        }}
                        disabled={!o.allowed || switching}
                        className="flex-shrink-0 h-8 px-3 rounded-xl text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: "#f15b5c" }}
                      >
                        Chuyển
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}
        </div>
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <p className="text-sm font-extrabold text-gray-900">
              Chuyển khách sang {pending.label}?
            </p>
            <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 leading-relaxed">
              Chương trình đang áp dụng sẽ chuyển sang <span className="font-bold">Đã lưu trữ</span>{" "}
              (vẫn xem lại được; nhật ký và chữ ký của khách giữ nguyên). Nếu khách chưa có chương
              trình {pending.label}, hệ thống dựng sẵn tuần 1 theo mẫu để PT chọn bài tập.
            </p>
            {error && <p className="text-xs text-[#f15b5c] font-medium">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => doSwitch(pending.order)}
                disabled={switching}
                className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#f15b5c" }}
              >
                {switching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang chuyển...
                  </>
                ) : (
                  "Chuyển giai đoạn"
                )}
              </button>
              <button
                onClick={() => setConfirmOrder(null)}
                disabled={switching}
                className="h-10 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
