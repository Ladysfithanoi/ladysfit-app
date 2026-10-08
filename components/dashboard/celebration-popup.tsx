"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Celebration } from "@/lib/celebrations";

/**
 * Lời chúc ngày đặc biệt — sinh nhật (bánh gato) và các ngày của phụ nữ cho
 * nhân sự nữ (bó hoa), kèm pháo hoa. Dịp nào do lib/celebrations quyết định;
 * mỗi dịp chỉ tự bật một lần trên mỗi trình duyệt.
 */

const SEEN_PREFIX = "ldf-celebration-seen:";

function wasSeen(key: string): boolean {
  try { return localStorage.getItem(SEEN_PREFIX + key) === "1"; } catch { return false; }
}
function markSeen(key: string) {
  try { localStorage.setItem(SEEN_PREFIX + key, "1"); } catch { /* chế độ ẩn danh */ }
}

// ── Pháo hoa ────────────────────────────────────────────────────────────────

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Rocket   = { x: number; y: number; vy: number; targetY: number; color: string };

const BIRTHDAY_COLORS = ["#f15b5c", "#ffb703", "#fb8500", "#8ecae6", "#ff70a6", "#70d6ff", "#ffd670"];
const WOMEN_COLORS    = ["#ff70a6", "#ff9ebb", "#f15b5c", "#ffd6e0", "#c77dff", "#ffb3c6", "#ffe5ec"];

function Fireworks({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width  = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const rockets: Rocket[] = [];
    const particles: Particle[] = [];
    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const launch = () => {
      rockets.push({
        x: W() * (0.15 + Math.random() * 0.7),
        y: H(),
        vy: -(H() / 70 + Math.random() * 3),
        targetY: H() * (0.12 + Math.random() * 0.35),
        color: pick(),
      });
    };
    const explode = (r: Rocket) => {
      const n = 60 + Math.floor(Math.random() * 30);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        const speed = 2 + Math.random() * 3.5;
        particles.push({
          x: r.x, y: r.y,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          life: 0, max: 55 + Math.random() * 30,
          color: Math.random() < 0.7 ? r.color : pick(),
          size: 1.6 + Math.random() * 1.6,
        });
      }
    };

    const started = performance.now();
    let lastLaunch = 0;
    let raf = 0;
    const DURATION = 7000;

    const tick = (t: number) => {
      const elapsed = t - started;
      ctx.clearRect(0, 0, W(), H());

      if (elapsed < DURATION && t - lastLaunch > 380) {
        launch();
        if (Math.random() < 0.4) launch();
        lastLaunch = t;
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy *= 0.985;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (r.y <= r.targetY || r.vy > -1.5) {
          explode(r);
          rockets.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.vx *= 0.97;
        p.vy = p.vy * 0.97 + 0.06;
        p.x += p.vx;
        p.y += p.vy;
        const alpha = Math.max(0, 1 - p.life / p.max);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (p.life >= p.max) particles.splice(i, 1);
      }

      if (elapsed < DURATION || rockets.length > 0 || particles.length > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [colors]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 w-full h-full z-[61]" />;
}

// ── Hình minh hoạ ───────────────────────────────────────────────────────────

function BirthdayCake() {
  return (
    <svg viewBox="0 0 220 200" className="w-48 h-44" role="img" aria-label="Bánh gato sinh nhật">
      {/* đĩa */}
      <ellipse cx="110" cy="182" rx="92" ry="12" fill="#e5e7eb" />
      {/* tầng dưới */}
      <rect x="32" y="118" width="156" height="58" rx="12" fill="#f9c6cf" />
      <path d="M32 132 q13 14 26 0 q13 14 26 0 q13 14 26 0 q13 14 26 0 q13 14 26 0 q13 14 26 0 V124 a12 12 0 0 0 -12 -6 H44 a12 12 0 0 0 -12 6 Z" fill="#ffffff" />
      <rect x="32" y="152" width="156" height="6" fill="#f15b5c" opacity="0.85" />
      {/* tầng trên */}
      <rect x="58" y="76" width="104" height="46" rx="10" fill="#f15b5c" />
      <path d="M58 88 q10.4 12 20.8 0 q10.4 12 20.8 0 q10.4 12 20.8 0 q10.4 12 20.8 0 q10.4 12 20.8 0 V84 a10 10 0 0 0 -10 -8 H68 a10 10 0 0 0 -10 8 Z" fill="#ffffff" />
      {/* hạt trang trí */}
      {[[50, 142, "#ffb703"], [80, 168, "#8ecae6"], [112, 140, "#ffb703"], [146, 166, "#8ecae6"], [172, 144, "#ffb703"],
        [76, 104, "#ffd670"], [104, 112, "#ffffff"], [136, 102, "#ffd670"]].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r="3.2" fill={c as string} />
      ))}
      {/* nến */}
      {[84, 110, 136].map((x, i) => (
        <g key={x}>
          <rect x={x - 4} y="48" width="8" height="30" rx="2" fill={["#8ecae6", "#ffd670", "#ff70a6"][i]} />
          <path d={`M${x - 4} 56 l8 -4 M${x - 4} 66 l8 -4`} stroke="#ffffff" strokeWidth="2" opacity="0.7" />
          <path
            d={`M${x} 26 C ${x + 7} 36, ${x + 6} 46, ${x} 47 C ${x - 6} 46, ${x - 7} 36, ${x} 26 Z`}
            fill="#ffb703"
            className="origin-bottom animate-[flicker_0.9s_ease-in-out_infinite_alternate]"
            style={{ transformBox: "fill-box" }}
          />
          <path d={`M${x} 34 C ${x + 3} 40, ${x + 3} 45, ${x} 46 C ${x - 3} 45, ${x - 3} 40, ${x} 34 Z`} fill="#fff3c4" />
        </g>
      ))}
    </svg>
  );
}

function FlowerBouquet() {
  const flower = (cx: number, cy: number, petal: string, center: string, r = 13) => (
    <g>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 6;
        return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={r * 0.75} fill={petal} />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.6} fill={center} />
    </g>
  );
  return (
    <svg viewBox="0 0 220 200" className="w-48 h-44" role="img" aria-label="Bó hoa chúc mừng">
      {/* cành */}
      {[[70, 70], [110, 52], [150, 70], [88, 96], [132, 96]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} Q ${(x + 110) / 2} ${(y + 150) / 2} 110 150`} stroke="#4f9d69" strokeWidth="4" fill="none" />
      ))}
      <path d="M78 110 q-22 -6 -26 -24 q20 2 26 24 Z" fill="#6bbf84" />
      <path d="M142 110 q22 -6 26 -24 q-20 2 -26 24 Z" fill="#6bbf84" />
      {flower(70, 70, "#ff9ebb", "#ffd670")}
      {flower(110, 50, "#f15b5c", "#ffe5ec", 15)}
      {flower(150, 70, "#c77dff", "#ffd670")}
      {flower(88, 96, "#ffb3c6", "#f15b5c", 11)}
      {flower(132, 96, "#ff70a6", "#ffe5ec", 11)}
      {/* giấy gói */}
      <path d="M70 128 L150 128 L124 190 L96 190 Z" fill="#ffe5ec" />
      <path d="M70 128 L96 190 L110 128 Z" fill="#ffd6e0" />
      {/* nơ */}
      <path d="M110 150 q-24 -14 -26 2 q2 14 26 -2 Z M110 150 q24 -14 26 2 q-2 14 -26 -2 Z" fill="#f15b5c" />
      <circle cx="110" cy="150" r="5" fill="#d94546" />
    </svg>
  );
}

// ── Popup ───────────────────────────────────────────────────────────────────

export function CelebrationPopup() {
  const [queue, setQueue] = useState<Celebration[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/celebration")
      .then((r) => (r.ok ? r.json() : { celebrations: [] }))
      .then((d: { celebrations?: Celebration[] }) => {
        if (cancelled) return;
        setQueue((d.celebrations ?? []).filter((c) => !wasSeen(c.key)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  if (!current) return null;

  function dismiss() {
    if (!current) return;
    markSeen(current.key);
    setQueue((q) => q.slice(1));
  }

  const isBirthday = current.kind === "birthday";

  return (
    <>
      <style>{`
        @keyframes flicker { from { transform: scaleY(1) rotate(-3deg); } to { transform: scaleY(1.12) rotate(3deg); } }
        @keyframes celebrate-pop { from { opacity: 0; transform: translateY(16px) scale(.94); } to { opacity: 1; transform: none; } }
      `}</style>
      <div className="fixed inset-0 z-[60] bg-black/45" onClick={dismiss} aria-hidden />
      <Fireworks key={current.key} colors={isBirthday ? BIRTHDAY_COLORS : WOMEN_COLORS} />
      <div className="fixed inset-0 z-[62] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
          className="pointer-events-auto relative w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden animate-[celebrate-pop_.45s_ease-out]"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Đóng"
            className="absolute right-3 top-3 z-10 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            className={
              "flex justify-center pt-6 pb-2 " +
              (isBirthday ? "bg-gradient-to-b from-[#fff1e6] to-white" : "bg-gradient-to-b from-[#ffe5ec] to-white")
            }
          >
            {isBirthday ? <BirthdayCake /> : <FlowerBouquet />}
          </div>

          <div className="px-6 pb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-[#f15b5c]">
              {isBirthday ? "Happy Birthday" : "Gửi những người phụ nữ tuyệt vời"}
            </p>
            <h2 id="celebration-title" className="mt-1 text-xl font-extrabold text-gray-900">
              {current.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">{current.message}</p>
            <button
              type="button"
              onClick={dismiss}
              className="mt-5 w-full h-11 rounded-xl bg-[#f15b5c] text-white text-sm font-bold hover:bg-[#d94546] transition-colors"
            >
              {queue.length > 1 ? "Cảm ơn! Xem lời chúc tiếp" : "Cảm ơn Ladysfit ❤️"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
