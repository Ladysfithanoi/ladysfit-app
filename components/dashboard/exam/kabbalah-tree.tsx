"use client";

import { cn } from "@/lib/utils";

/**
 * Cây Sự Sống (Kaballah) — bản đồ hành trình của một kỳ thi thử thách.
 *
 * Mười sephirot xếp trên ba trụ, nối bằng đúng 22 đường của bản kinh điển. Thí
 * sinh bắt đầu ở Malkuth (đáy, thế giới vật chất) và mỗi mốc vượt qua được thì
 * tiến lên một bậc dọc theo trụ giữa — trụ Cân bằng.
 *
 * Ba trụ ở đây không phải hoạ tiết: trái là Nghiêm khắc, phải là Khoan dung,
 * giữa là Cân bằng — đúng cái trục mà bài thi đang đo qua hướng lệch của bài làm
 * (xem PILLAR_LABEL trong lib/exam-trial.ts).
 */

type Node = { id: number; name: string; x: number; y: number };

/** Toạ độ 10 sephirot. x: 70 trụ trái · 150 trụ giữa · 230 trụ phải. */
const NODES: Node[] = [
  { id: 1, name: "Kether", x: 150, y: 34 },
  { id: 2, name: "Chokmah", x: 230, y: 104 },
  { id: 3, name: "Binah", x: 70, y: 104 },
  { id: 4, name: "Chesed", x: 230, y: 192 },
  { id: 5, name: "Geburah", x: 70, y: 192 },
  { id: 6, name: "Tiphareth", x: 150, y: 250 },
  { id: 7, name: "Netzach", x: 230, y: 322 },
  { id: 8, name: "Hod", x: 70, y: 322 },
  { id: 9, name: "Yesod", x: 150, y: 382 },
  { id: 10, name: "Malkuth", x: 150, y: 444 },
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

/**
 * Hành trình leo cây: đi dọc trụ giữa từ đáy lên đỉnh.
 * Bước 0 = còn ở Malkuth. Mỗi mốc vượt qua tiến thêm một bậc.
 */
const JOURNEY = [10, 9, 6, 1];

const STEP_LABEL = [
  "Malkuth — Vương quốc",
  "Yesod — Nền móng",
  "Tiphareth — Vẻ đẹp",
  "Kether — Vương miện",
];

/** Mỗi bậc đổi được bằng một việc thật — xem journeyStep() trong lib/exam-trial.ts. */
const STEP_MEANING = [
  "Điểm khởi đầu",
  "Đã dám khai tội của mình",
  "Đã vượt qua chính tội mình khai",
  "Đạt cả kỳ thi",
];

const BRAND = "#f15b5c";

export function KabbalahTree({
  step,
  className,
}: {
  /** Đã tiến được mấy bậc trên trụ giữa (0 = còn ở đáy). */
  step: number;
  className?: string;
}) {
  const safeStep = Math.max(0, Math.min(step, JOURNEY.length - 1));
  const reached = new Set(JOURNEY.slice(0, safeStep + 1));
  const currentId = JOURNEY[safeStep];
  const byId = new Map(NODES.map((n) => [n.id, n]));

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox="0 0 300 480" className="h-auto w-full max-w-[280px]" role="img" aria-label="Cây Kaballah">
        {/* 22 đường nối — đường đã đi qua sáng lên */}
        {PATHS.map(([a, b]) => {
          const na = byId.get(a)!;
          const nb = byId.get(b)!;
          const walked = reached.has(a) && reached.has(b);
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
          const isReached = reached.has(n.id);
          const isCurrent = n.id === currentId;
          return (
            <g key={n.id}>
              {/* Vòng sáng quanh bậc đang đứng */}
              {isCurrent && (
                <circle cx={n.x} cy={n.y} r={22} fill="none" stroke={BRAND} strokeWidth={2} opacity={0.35}>
                  <animate attributeName="r" values="18;26;18" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={n.x} cy={n.y} r={13}
                fill={isReached ? BRAND : "#ffffff"}
                stroke={isReached ? BRAND : "#d1d5db"}
                strokeWidth={2}
              />
              <text
                x={n.x} y={n.y + 4}
                textAnchor="middle"
                className="select-none"
                fontSize="11"
                fontWeight="700"
                fill={isReached ? "#ffffff" : "#9ca3af"}
              >
                {n.id}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-2 text-sm font-extrabold" style={{ color: BRAND }}>
        {STEP_LABEL[safeStep]}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-gray-500">{STEP_MEANING[safeStep]}</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-400">
        Bậc {safeStep + 1}/{JOURNEY.length} trên trụ Cân bằng
      </p>
    </div>
  );
}
