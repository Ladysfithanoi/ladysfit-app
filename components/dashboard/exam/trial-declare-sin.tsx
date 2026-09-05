"use client";

import { useState } from "react";
import { Swords, AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SIN_LABEL, SIN_DOMAIN, SINS, SIN_SEPHIRAH,
  DECLARED_POINT_MULTIPLIER, honorCost,
  type DeclaredSetup, type Sin,
} from "@/lib/exam-trial";
import { KabbalahTree } from "./kabbalah-tree";

/**
 * Cửa vào kỳ thi thử thách — ba nhịp:
 *
 *   1. Bảy ô tròn, chọn MỘT đại tội mình phải vượt qua.
 *   2. Cây Kabbalah tiến thêm một bậc — nhịp nghỉ để người thi thấy mình vừa
 *      bước vào hành trình, không phải vừa bấm xong một cái nút.
 *   3. Mới vào đề.
 *
 * Không phải chọn thế mạnh mà là nhận mình yếu ở đâu: vòng của tội đã khai sẽ
 * khó hơn, điểm nhân đôi, và bắt buộc phải qua.
 *
 * Đề chưa được gửi xuống ở bước này (xem app/api/exam/take): phải khai xong mới
 * thấy đề, nếu không thì người ta mở đề, xem vòng nào dễ, rồi mới khai.
 */

type SinOption = { sin: Sin; roundName: string | null; available: boolean };

export function TrialDeclareSin({
  levelName,
  options,
  declaredSetup,
  mock = false,
  onDeclared,
}: {
  levelName: string | null;
  /** Đủ 7 tội; `available` cho biết đề của cấp này đã có vòng cho tội đó chưa. */
  options: SinOption[];
  /** Cái giá của việc khai ở cấp này — phải nói đúng số, vì chọn xong không đổi được. */
  declaredSetup: DeclaredSetup;
  /** Thi thử của Admin — không có lượt thi để ghi, chỉ chốt ở bộ nhớ trang. */
  mock?: boolean;
  onDeclared: (sin: Sin) => void;
}) {
  const [picked, setPicked] = useState<Sin | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Đã khai xong → chuyển sang nhịp cây Kabbalah trước khi vào đề.
  const [declared, setDeclared] = useState<Sin | null>(null);

  // Máy chủ trả đủ 7; phòng khi thiếu thì vẫn bày đủ 7 ô, ô thiếu coi như khoá.
  const byId = new Map(options.map((o) => [o.sin, o]));
  const all: SinOption[] = SINS.map(
    (sn) => byId.get(sn) ?? { sin: sn, roundName: null, available: false }
  );

  async function confirm() {
    if (!picked) return;
    setSaving(true);
    setError("");
    // Thi thử không ghi vào đâu cả — Admin kiểm đề bao nhiêu lần cũng được, và
    // ghi vào lượt thi thì lần sau họ không khai lại được nữa.
    if (mock) {
      setDeclared(picked);
      setSaving(false);
      return;
    }
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
      setDeclared(picked);
    } catch {
      setError("Có lỗi xảy ra. Thử lại giúp tôi.");
    } finally {
      setSaving(false);
    }
  }

  // ── Nhịp 2: cây Kabbalah tiến một bậc ──────────────────────────────────────
  if (declared) {
    return (
      <div className="mx-auto max-w-lg pb-16 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Bạn đã khai</p>
        <h1 className="mt-1 text-2xl font-extrabold" style={{ color: "#f15b5c" }}>
          {SIN_LABEL[declared]}
        </h1>
        <p className="mt-1 text-sm font-medium text-gray-500">{SIN_DOMAIN[declared]}</p>

        <div className="my-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <KabbalahTree
            lit={[]}
            target={SIN_SEPHIRAH[declared]}
            caption={`Đây là chỗ của ${SIN_LABEL[declared]} trên cây. Làm xong vòng này thì nó sáng lên.`}
          />
        </div>

        <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-500">
          Mỗi đại tội có một chỗ riêng trên cây. Bạn thi tội nào thì thắp sáng chỗ đó —
          và tội bạn vừa khai là chỗ bạn không được phép trượt.
        </p>

        <button
          onClick={() => onDeclared(declared)}
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl px-7 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#f15b5c" }}
        >
          Bắt đầu thi
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-2 text-xs text-gray-400">Bấm xong là đồng hồ làm bài bắt đầu chạy.</p>
      </div>
    );
  }

  // ── Nhịp 1: bảy ô tròn ─────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-6 flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-[#f15b5c]/10 p-2.5">
          <Swords className="h-5 w-5 text-[#f15b5c]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Khai một đại tội</h1>
          <p className="mt-0.5 text-xs font-medium text-gray-400 sm:text-sm">
            {levelName ? `Đề ${levelName} — ` : ""}
          {mock ? "thi thử: chọn lại được bao nhiêu lần cũng được" : "chọn một lần, không đổi lại được"}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3.5">
        <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Đây không phải chọn phần mình giỏi. Hãy chọn mảng bạn thấy mình{" "}
            <span className="font-extrabold">yếu nhất</span> — vòng đó sẽ khó hơn, điểm nhân{" "}
            {DECLARED_POINT_MULTIPLIER}, ngưỡng đạt cao hơn {declaredSetup.passBonus}%, và{" "}
            <span className="font-extrabold">bắt buộc phải qua</span>. Trượt vòng đã khai là
            trượt cả kỳ, dù các vòng khác có tốt tới đâu.
            {/* Thanh danh đắt hơn thì phải nói ra, vì đó là thứ ăn mòn ngay
                trong lúc chơi chứ không đợi tới lúc chấm. Cấp nào không đặt
                nặng hơn thì câu này không hiện. */}
            {(declaredSetup.costNear > honorCost(0.5) || declaredSetup.costFar > honorCost(0)) && (
              <>
                {" "}Ở vòng đó mỗi thẻ sai cũng đắt hơn: lệch một bậc mất{" "}
                {declaredSetup.costNear} Thanh danh, lệch hai bậc mất {declaredSetup.costFar}.
              </>
            )}
          </span>
        </p>
      </div>

      {/* Bảy ô tròn */}
      <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
        {all.map((o) => {
          const active = picked === o.sin;
          const locked = !o.available;
          return (
            <button
              key={o.sin}
              type="button"
              disabled={locked}
              onClick={() => setPicked(o.sin)}
              title={locked ? "Đề của cấp bạn chưa có vòng nào cho đại tội này" : SIN_DOMAIN[o.sin]}
              className={cn(
                "group flex w-[104px] flex-col items-center gap-2 sm:w-[124px]",
                locked && "cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "flex h-[88px] w-[88px] items-center justify-center rounded-full border-2 px-2 text-center text-[13px] font-extrabold leading-tight transition-all sm:h-[104px] sm:w-[104px] sm:text-sm",
                  locked
                    ? "border-gray-200 bg-gray-50 text-gray-300"
                    : active
                      ? "border-[#f15b5c] bg-[#f15b5c] text-white shadow-lg shadow-[#f15b5c]/25 scale-105"
                      : "border-gray-200 bg-white text-gray-700 group-hover:border-[#f15b5c] group-hover:text-[#f15b5c]"
                )}
              >
                {locked ? <Lock className="h-5 w-5" /> : SIN_LABEL[o.sin]}
              </span>
              <span
                className={cn(
                  "text-center text-[11px] font-semibold leading-snug",
                  locked ? "text-gray-300" : active ? "text-[#f15b5c]" : "text-gray-400"
                )}
              >
                {locked ? SIN_LABEL[o.sin] : SIN_DOMAIN[o.sin]}
              </span>
            </button>
          );
        })}
      </div>

      {all.some((o) => !o.available) && (
        <p className="mt-5 text-center text-xs font-semibold text-gray-400">
          Ô mờ là đại tội đề của cấp bạn chưa có vòng — quản lý còn đang soạn.
        </p>
      )}

      {error && <p className="mt-4 text-center text-sm font-bold text-red-500">{error}</p>}

      <button
        onClick={confirm}
        disabled={!picked || saving}
        className="mx-auto mt-7 block h-12 w-full max-w-sm rounded-xl text-sm font-extrabold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: "#f15b5c" }}
      >
        {saving
          ? "Đang ghi nhận…"
          : picked
            ? `Khai "${SIN_LABEL[picked]}"`
            : "Chọn một đại tội để tiếp tục"}
      </button>
    </div>
  );
}
