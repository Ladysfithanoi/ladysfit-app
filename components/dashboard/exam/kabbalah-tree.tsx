"use client";

import { cn } from "@/lib/utils";
import { SIN_SEPHIRAH, SIN_LABEL, type Sin } from "@/lib/exam-trial";

/**
 * Cây Sự Sống (Kaballah) — bản đồ những đại tội một người đã đối mặt.
 *
 * KHÔNG phải thanh tiến độ. Mỗi đại tội có một sephirah riêng của nó (xem
 * SIN_SEPHIRAH trong lib/exam-trial.ts); làm xong vòng của tội nào thì đúng
 * sephirah đó sáng lên. Thí sinh không phải thi cả bảy tội — đề của cấp có bao
 * nhiêu vòng thì cây sáng bấy nhiêu chỗ.
 *
 * Ba sephirot trên cùng (Kether · Chokmah · Binah) không gắn tội nào; Kether chỉ
 * sáng khi đạt cả kỳ.
 *
 * Ba trụ cũng không phải hoạ tiết: trái Nghiêm khắc, phải Khoan dung, giữa Cân
 * bằng — đúng trục mà bài thi đang đo qua hướng lệch của bài làm (PILLAR_LABEL).
 */

type Node = { id: number; x: number; y: number };

/** Toạ độ 10 sephirot. x: 70 trụ trái · 150 trụ giữa · 230 trụ phải. */
const NODES: Node[] = [
  { id: 1, x: 150, y: 34 },
  { id: 2, x: 230, y: 104 },
  { id: 3, x: 70, y: 104 },
  { id: 4, x: 230, y: 192 },
  { id: 5, x: 70, y: 192 },
  { id: 6, x: 150, y: 250 },
  { id: 7, x: 230, y: 322 },
  { id: 8, x: 70, y: 322 },
  { id: 9, x: 150, y: 382 },
  { id: 10, x: 150, y: 444 },
];

/** 22 đường nối của bản kinh điển. */
const PATHS: [number, number][] = [
  [1, 2], [1, 3], [1, 6],
  [2, 3], [2, 4], [2, 6],
  [3, 5], [3, 6],
  [4, 5], [4, 6], [4, 7],
  [5, 6], [5, 8],
  [6, 7], [6, 8], [6, 9],
  [7, 8], [7, 9], [7, 10],
  [8, 9], [8, 10],
  [9, 10],
];

const SEPHIRAH_NAME: Record<number, string> = {
  1: "Kether — Vương miện",
  2: "Chokmah — Minh triết",
  3: "Binah — Thấu hiểu",
  4: "Chesed — Từ ái",
  5: "Geburah — Nghiêm cẩn",
  6: "Tiphareth — Vẻ đẹp",
  7: "Netzach — Bền bỉ",
  8: "Hod — Uy nghi",
  9: "Yesod — Nền móng",
  10: "Malkuth — Vương quốc",
};

/** Sephirah nào thuộc tội nào — tra ngược từ SIN_SEPHIRAH. */
const SIN_OF = Object.fromEntries(
  (Object.entries(SIN_SEPHIRAH) as [Sin, number][]).map(([sin, id]) => [id, sin])
) as Record<number, Sin | undefined>;

const BRAND = "#f15b5c";

export function KabbalahTree({
  lit,
  current,
  target,
  caption,
  className,
}: {
  /** Sephirot đã sáng — tội đã đối mặt xong. */
  lit: number[];
  /** Sephirah vừa sáng lên ở nhịp này (có vòng nhấp nháy). */
  current?: number | null;
  /** Sephirah đang nhắm tới nhưng chưa sáng — dùng ở màn khai tội. */
  target?: number | null;
  /** Một câu nói rõ chặng này đổi được bằng gì. */
  caption?: string;
  className?: string;
}) {
  const litSet = new Set(lit);
  const byId = new Map(NODES.map((n) => [n.id, n]));
  const focusId = current ?? target ?? null;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox="0 0 300 490" className="h-auto w-full max-w-[290px]" role="img" aria-label="Cây Kaballah">
        {PATHS.map(([a, b]) => {
          const na = byId.get(a)!;
          const nb = byId.get(b)!;
          const walked = litSet.has(a) && litSet.has(b);
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
              stroke={walked ? BRAND : "#e5e7eb"}
              strokeWidth={walked ? 2 : 1.2}
              opacity={walked ? 0.9 : 0.6}
            />
          );
        })}

        {NODES.map((n) => {
          const isLit = litSet.has(n.id);
          const isFocus = n.id === focusId;
          const sin = SIN_OF[n.id];
          const onLeft = n.x < 150;
          const onRight = n.x > 150;
          return (
            <g key={n.id}>
              {isFocus && (
                <circle cx={n.x} cy={n.y} r={22} fill="none" stroke={BRAND} strokeWidth={2} opacity={0.35}>
                  <animate attributeName="r" values="18;26;18" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={n.x} cy={n.y} r={13}
                fill={isLit ? BRAND : "#ffffff"}
                stroke={isLit || isFocus ? BRAND : "#d1d5db"}
                strokeWidth={2}
              />
              {/* Tên tội đặt cạnh sephirah của nó — cho thấy cây và bảy tội là một */}
              {sin && (
                <text
                  x={onLeft ? n.x - 20 : onRight ? n.x + 20 : n.x}
                  y={n.y + (onLeft || onRight ? 4 : 30)}
                  textAnchor={onLeft ? "end" : onRight ? "start" : "middle"}
                  fontSize="10.5"
                  fontWeight="700"
                  fill={isLit || isFocus ? BRAND : "#c7cbd1"}
                >
                  {SIN_LABEL[sin]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {focusId && (
        <p className="mt-2 text-sm font-extrabold" style={{ color: BRAND }}>
          {SEPHIRAH_NAME[focusId]}
        </p>
      )}
      {caption && <p className="mt-1 max-w-xs text-xs font-semibold leading-snug text-gray-500">{caption}</p>}
    </div>
  );
}
