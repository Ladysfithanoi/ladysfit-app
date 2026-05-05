"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// ─── BF% levels ───────────────────────────────────────────────────────────────

const BF_LEVELS = [
  { val: 50, label: "Obese",      color: "text-red-600",     bg: "bg-red-50"     },
  { val: 40, label: "Overweight", color: "text-orange-500",  bg: "bg-orange-50"  },
  { val: 30, label: "Normal",     color: "text-yellow-600",  bg: "bg-yellow-50"  },
  { val: 25, label: "Lean",       color: "text-blue-600",    bg: "bg-blue-50"    },
  { val: 20, label: "Slim",       color: "text-emerald-600", bg: "bg-emerald-50" },
] as const;

type BFLevel = (typeof BF_LEVELS)[number];

function getCat(bf: number): BFLevel {
  for (const lvl of BF_LEVELS) {
    if (bf >= lvl.val) return lvl;
  }
  return BF_LEVELS[BF_LEVELS.length - 1];
}

function bmiToDefaultBF(bmi: number | null): number {
  if (!bmi || bmi <= 0) return 33;
  if (bmi < 18.5) return 22;
  if (bmi < 23)   return 27;
  if (bmi < 25)   return 30;
  if (bmi < 28)   return 34;
  if (bmi < 30)   return 38;
  if (bmi < 35)   return 43;
  return 47;
}

// ─── Image map ────────────────────────────────────────────────────────────────

const BODY_IMAGES: Record<number, string> = {
  50: "/images/body-50.jpg",
  40: "/images/body-40.jpg",
  30: "/images/body-30.jpg",
  25: "/images/body-25.jpg",
  20: "/images/body-20.jpg",
};

const IMAGE_KEYS = [50, 40, 30, 25, 20] as const;

function getImageKey(bf: number): number {
  if (bf >= 45) return 50;
  if (bf >= 35) return 40;
  if (bf >= 27) return 30;
  if (bf >= 22) return 25;
  return 20;
}

// ─── Body image with crossfade ────────────────────────────────────────────────

function BodyImage({ bf }: { bf: number }) {
  const activeKey = getImageKey(bf);

  return (
    <div style={{ position: "relative", width: 110, height: 220, flexShrink: 0 }}>
      {IMAGE_KEYS.map((key) => (
        <Image
          key={key}
          src={BODY_IMAGES[key]}
          alt={`Body fat ${key}%`}
          fill
          sizes="110px"
          style={{
            objectFit: "contain",
            objectPosition: "center bottom",
            position: "absolute",
            opacity: activeKey === key ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Standalone card ─────────────────────────────────────────────────────────

export function BodyFatCard({ info }: { info: Record<string, unknown> }) {
  const weight = Number(info.currentWeight) || 0;
  const height = Number(info.height) || 0;
  const bmi = weight > 0 && height > 0 ? weight / (height / 100) ** 2 : null;

  // Inverted slider: raw 0 → bf 50% (obese / left), raw 30 → bf 20% (slim / right)
  const [sliderRaw, setSliderRaw] = useState(() =>
    Math.max(0, Math.min(30, 50 - bmiToDefaultBF(bmi)))
  );
  const bf  = 50 - sliderRaw;
  const cat = getCat(bf);

  return (
    <div className="p-5">
      <p className="text-sm font-extrabold text-gray-800 mb-4">Body Shape Goal</p>

      <div className="flex gap-5 items-center">
        {/* Figure */}
        <BodyImage bf={bf} />

        {/* Controls */}
        <div className="flex-1 min-w-0">
          {/* Current BF display */}
          <div className="mb-3">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-3xl font-extrabold text-gray-900">{bf}%</span>
              <span className="text-xs text-gray-400 font-semibold">body fat</span>
            </div>
            <span className={cn(
              "inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold",
              cat.bg, cat.color
            )}>
              {cat.label}
            </span>
          </div>

          {/* Slider — left = 50% obese, right = 20% slim */}
          <div className="mb-3">
            <input
              type="range" min={0} max={30} step={1}
              value={sliderRaw}
              onChange={(e) => setSliderRaw(Number(e.target.value))}
              className="w-full cursor-pointer h-2 rounded-full"
              style={{ accentColor: "#f15b5c" }}
            />
            <div className="flex justify-between text-[10px] text-gray-400 font-semibold mt-1">
              <span>50% Obese</span>
              <span>20% Slim</span>
            </div>
          </div>

          {/* Preset quick-select */}
          <div className="space-y-1">
            {BF_LEVELS.map(({ val, label, color, bg }) => {
              const active = bf === val;
              return (
                <button
                  key={val}
                  onClick={() => setSliderRaw(50 - val)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    active ? "bg-[#f15b5c] text-white" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-extrabold w-8 text-center py-0.5 rounded-full flex-shrink-0",
                    active ? "bg-white/25 text-white" : cn(bg, color)
                  )}>
                    {val}%
                  </span>
                  <span className="flex-1 text-left">{label}</span>
                  {active && <span className="text-white opacity-60 text-[10px]">◀</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
