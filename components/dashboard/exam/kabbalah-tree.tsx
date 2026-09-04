"use client";

import { cn } from "@/lib/utils";
import {
  SEPHIROT, SEPHIRAH_BY_ID, sephirahFullName, SIN_DOMAIN, PILLAR_LABEL, type Pillar,
} from "@/lib/exam-trial";

/**
 * Cây Sự Sống (Kabbalah) — bản đồ những đại tội một người đã đối mặt.
 *
 * KHÔNG phải thanh tiến độ. Mọi dữ liệu về từng ô (tên, trụ, tội, vì sao ghép
 * như vậy) nằm ở SEPHIROT trong lib/exam-trial.ts; file này chỉ lo toạ độ và
 * cách vẽ. Muốn đổi cách ghép tội thì sửa ở đó, không sửa ở đây.
 *
 * Hai thứ vẽ ra:
 *   • <KabbalahTree>   — hình cây, nhãn ngắn cạnh mỗi ô.
 *   • <KabbalahLegend> — bảng chú giải đủ 10 ô: tên, trụ, đo gì, vì sao, và
 *                        trạng thái do nơi gọi truyền vào (đã qua / chưa có
 *                        vòng trong đề / ngoài phạm vi bài thi…).
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

/** Vực Thẳm — lằn ngăn bảy đại tội (bài thi) với ba điều kiện thăng cấp còn lại. */
const ABYSS_Y = 148;

const BRAND = "#f15b5c";
const DIM = "#c7cbd1";

export function KabbalahTree({
  lit,
  current,
  target,
  caption,
  detail = false,
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
  /** Hiện thêm tên ba trụ và số thứ tự trong từng ô — dùng ở chỗ có bảng chú giải. */
  detail?: boolean;
  className?: string;
}) {
  const litSet = new Set(lit);
  const byId = new Map(NODES.map((n) => [n.id, n]));
  const focusId = current ?? target ?? null;
  // Chừa chỗ phía trên cho hàng tên ba trụ khi bật detail.
  const viewBox = detail ? "0 -30 300 520" : "0 0 300 490";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox={viewBox} className="h-auto w-full max-w-[290px]" role="img" aria-label="Cây Kabbalah">
        {detail && (
          <g>
            {[
              { x: 70, label: PILLAR_LABEL.SEVERITY },
              { x: 150, label: PILLAR_LABEL.BALANCE },
              { x: 230, label: PILLAR_LABEL.MERCY },
            ].map((p) => (
              <text key={p.x} x={p.x} y={-14} textAnchor="middle" fontSize="9" fontWeight="800" fill="#b6bcc4">
                {p.label.toUpperCase()}
              </text>
            ))}
          </g>
        )}

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

        {/* Bài thi không vượt hộ ai qua vạch này. */}
        <line x1={20} y1={ABYSS_Y} x2={280} y2={ABYSS_Y} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="5 5" />
        <text x={286} y={ABYSS_Y - 4} textAnchor="end" fontSize="9" fontWeight="700" fill="#94a3b8">
          Vực Thẳm
        </text>

        {NODES.map((n) => {
          const info = SEPHIRAH_BY_ID[n.id];
          const isLit = litSet.has(n.id);
          const isFocus = n.id === focusId;
          const onLeft = n.x < 150;
          const onRight = n.x > 150;
          // Kether ở cột giữa trên cùng để nhãn phía trên cho khỏi đè đường nối;
          // các ô giữa còn lại để nhãn phía dưới như cũ.
          const labelY = onLeft || onRight ? n.y + 4 : info.aboveAbyss ? n.y - 24 : n.y + 30;
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
              {/* Số trong ô để đối chiếu với bảng chú giải bên dưới. */}
              {detail && (
                <text
                  x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800"
                  fill={isLit ? "#ffffff" : "#9ca3af"}
                >
                  {n.id}
                </text>
              )}
              <text
                x={onLeft ? n.x - 20 : onRight ? n.x + 20 : n.x}
                y={labelY}
                textAnchor={onLeft ? "end" : onRight ? "start" : "middle"}
                fontSize="10.5"
                fontWeight="700"
                fill={isLit || isFocus ? BRAND : DIM}
              >
                {info.short}
              </text>
            </g>
          );
        })}
      </svg>

      {focusId && (
        <p className="mt-2 text-sm font-extrabold" style={{ color: BRAND }}>
          {sephirahFullName(focusId)}
        </p>
      )}
      {caption && <p className="mt-1 max-w-xs text-xs font-semibold leading-snug text-gray-500">{caption}</p>}
    </div>
  );
}

// ── Bảng chú giải ────────────────────────────────────────────────────────────

export type SephirahStatus = {
  /** Một dòng nói ô này hiện ra sao — "Tham lam · 12 thẻ · đạt 65%". */
  text: string;
  /** ok: đã có/đã qua · warn: có nhưng chưa dùng được · off: chưa có gì. */
  tone?: "ok" | "warn" | "off";
};

const TONE_CLS: Record<"ok" | "warn" | "off", string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  off: "bg-gray-100 text-gray-500",
};

const PILLAR_CLS: Record<Pillar, string> = {
  SEVERITY: "bg-slate-100 text-slate-600",
  BALANCE: "bg-violet-50 text-violet-600",
  MERCY: "bg-sky-50 text-sky-700",
};

/**
 * Đủ 10 ô, đọc từ dưới lên — đúng chiều người ta trèo cây: Malkuth (thân xác)
 * lên tới Kether (thăng cấp). Trạng thái từng ô do nơi gọi truyền vào, vì cùng
 * một cây mà Admin soi độ phủ của đề còn thí sinh soi kết quả của mình.
 */
export function KabbalahLegend({
  lit,
  status,
  className,
}: {
  lit: number[];
  status?: Record<number, SephirahStatus>;
  className?: string;
}) {
  const litSet = new Set(lit);
  const rows = [...SEPHIROT].sort((a, b) => b.id - a.id);

  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((s) => {
        const isLit = litSet.has(s.id);
        const st = status?.[s.id];
        const tone = st?.tone ?? "off";
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-xl border px-3 py-2.5",
              isLit ? "border-[#f15b5c]/30 bg-[#f15b5c]/[0.04]" : "border-gray-100 bg-white",
              s.aboveAbyss && "border-dashed"
            )}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                  isLit ? "text-white" : "border border-gray-200 bg-white text-gray-400"
                )}
                style={isLit ? { backgroundColor: BRAND } : undefined}
              >
                {s.id}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-extrabold text-gray-800">
                    {s.name} <span className="font-bold text-gray-400">— {s.vi}</span>
                  </p>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", PILLAR_CLS[s.pillar])}>
                    {PILLAR_LABEL[s.pillar]}
                  </span>
                  {s.aboveAbyss && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                      trên Vực Thẳm
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs font-bold text-gray-600">
                  {s.sin ? SIN_DOMAIN[s.sin] : s.need}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-gray-400">{s.why}</p>

                {st && (
                  <span
                    className={cn(
                      "mt-1.5 inline-block rounded-md px-2 py-1 text-[11px] font-bold",
                      TONE_CLS[tone]
                    )}
                  >
                    {st.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
