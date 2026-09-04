"use client";

import { useState } from "react";
import { Swords, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SIN_LABEL, SIN_DOMAIN,
  DECLARED_POINT_MULTIPLIER, DECLARED_PASS_BONUS,
  type Sin,
} from "@/lib/exam-trial";

/**
 * Màn KHAI TỘI — bước bắt buộc trước khi được xem đề.
 *
 * Không phải chọn thế mạnh mà là nhận mình yếu ở đâu. Vòng của tội đã khai sẽ
 * khó hơn, điểm nhân đôi, và bắt buộc phải qua — không bù bằng các vòng khác.
 *
 * Đề chưa được gửi xuống ở bước này (xem app/api/exam/take): phải khai xong mới
 * thấy đề, nếu không thì người ta mở đề, xem vòng nào dễ, rồi mới khai.
 */
export function TrialDeclareSin({
  levelName,
  options,
  onDeclared,
}: {
  levelName: string | null;
  /** Các tội mà đề của cấp này thật sự có vòng. */
  options: { sin: Sin; roundName: string }[];
  onDeclared: () => void;
}) {
  const [picked, setPicked] = useState<Sin | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!picked) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/exam/declare-sin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sin: picked }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Không ghi nhận được lựa chọn. Thử lại giúp tôi.");
        return;
      }
      onDeclared();
    } catch {
      setError("Có lỗi xảy ra. Thử lại giúp tôi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <div className="mb-6 flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-[#f15b5c]/10 p-2.5">
          <Swords className="h-5 w-5 text-[#f15b5c]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Khai một đại tội</h1>
          <p className="mt-0.5 text-xs font-medium text-gray-400 sm:text-sm">
            {levelName ? `Đề ${levelName} — ` : ""}bước này làm một lần, không đổi lại được
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3.5">
        <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Đây không phải chọn phần mình giỏi. Hãy chọn mảng bạn thấy mình{" "}
            <span className="font-extrabold">yếu nhất</span> — vòng đó sẽ khó hơn, điểm nhân{" "}
            {DECLARED_POINT_MULTIPLIER}, ngưỡng đạt cao hơn {DECLARED_PASS_BONUS}%, và{" "}
            <span className="font-extrabold">bắt buộc phải qua</span>. Trượt vòng đã khai là
            trượt cả kỳ, dù các vòng khác có tốt tới đâu.
          </span>
        </p>
      </div>

      <div className="space-y-2.5">
        {options.map((o) => {
          const active = picked === o.sin;
          return (
            <button
              key={o.sin}
              type="button"
              onClick={() => setPicked(o.sin)}
              className={cn(
                "w-full rounded-2xl border px-4 py-3.5 text-left transition-all",
                active
                  ? "border-[#f15b5c] bg-[#f15b5c]/5 ring-2 ring-[#f15b5c]/20"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    active ? "border-[#f15b5c] bg-[#f15b5c]" : "border-gray-300"
                  )}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className={cn("text-base font-extrabold", active ? "text-[#f15b5c]" : "text-gray-800")}>
                  {SIN_LABEL[o.sin]}
                </span>
              </div>
              <p className="mt-1 pl-[30px] text-sm font-medium text-gray-500">{SIN_DOMAIN[o.sin]}</p>
            </button>
          );
        })}
      </div>

      {options.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm font-semibold text-gray-300">
          Đề của cấp này chưa có vòng nào gắn đại tội. Liên hệ quản lý.
        </p>
      )}

      {error && <p className="mt-4 text-sm font-bold text-red-500">{error}</p>}

      <button
        onClick={confirm}
        disabled={!picked || saving}
        className="mt-6 h-12 w-full rounded-xl text-sm font-extrabold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: "#f15b5c" }}
      >
        {saving
          ? "Đang ghi nhận…"
          : picked
            ? `Khai "${SIN_LABEL[picked]}" và vào thi`
            : "Chọn một đại tội để tiếp tục"}
      </button>
      <p className="mt-2 text-center text-xs text-gray-400">
        Bấm xong là đồng hồ làm bài bắt đầu chạy.
      </p>
    </div>
  );
}
