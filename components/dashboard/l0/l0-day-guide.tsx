"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { L0_DAYS, TSDR_STEPS, type L0Day } from "@/lib/l0-program";

/**
 * Kịch bản một buổi L0 cho PT/FM — đọc nhanh trên điện thoại ngay trong hồ sơ
 * khách, khỏi cầm tài liệu giấy. Nội dung ở lib/l0-program (L0_DAYS).
 */
export function L0DayGuide({ day }: { day: L0Day }) {
  const plan = L0_DAYS[day];
  const [open, setOpen] = useState(false);
  const [showTsdr, setShowTsdr] = useState(false);

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-violet-700">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            L0 · {plan.title} — {plan.tagline}
          </span>
          <span className="block text-[11px] text-violet-600/80 mt-0.5 truncate">
            Mục tiêu: {plan.goal}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-violet-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-violet-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-violet-100 pt-3">
          <p className="text-xs text-gray-600 leading-relaxed">{plan.purpose}</p>

          <div className="rounded-lg bg-white border border-violet-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 mb-0.5">TSDR buổi này</p>
            <p className="text-xs text-gray-700 leading-relaxed">{plan.tsdr}</p>
            <button
              type="button"
              onClick={() => setShowTsdr((v) => !v)}
              className="mt-1 text-[11px] font-semibold text-violet-600 hover:underline"
            >
              {showTsdr ? "Ẩn khung TSDR" : "Xem lại khung TSDR"}
            </button>
            {showTsdr && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TSDR_STEPS.map((s) => (
                  <div key={s.key} className={cn("rounded-lg border px-2.5 py-2", s.key === "R" && day < 4 ? "border-gray-200 bg-gray-50 opacity-70" : "border-violet-100 bg-violet-50/50")}>
                    <p className="text-[11px] font-extrabold text-gray-800">
                      {s.key} — {s.name}
                      {s.key === "R" && day < 4 && <span className="ml-1 font-semibold text-gray-400">(dồn vào Buổi 4)</span>}
                    </p>
                    <p className="text-[10px] italic text-gray-500 mb-1">{s.goal}</p>
                    <ul className="space-y-0.5">
                      {s.points.map((p) => (
                        <li key={p} className="text-[11px] text-gray-600 leading-snug">• {p}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ol className="space-y-2">
            {plan.steps.map((step, i) => (
              <li key={i} className="text-xs text-gray-700">
                <div className="flex gap-2">
                  <span className="font-extrabold text-violet-600 shrink-0">{i + 1}.</span>
                  <span className="leading-relaxed">{step.text}</span>
                </div>
                {step.script && (
                  <div className="ml-5 mt-1 rounded-lg border border-violet-100 bg-white px-3 py-2">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-600 mb-1">
                      <MessageCircle className="w-3 h-3" />
                      Kịch bản {step.script.who}
                    </p>
                    {step.script.lines.map((line) => (
                      <p key={line} className="text-[11px] italic text-gray-600 leading-relaxed">{line}</p>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div>
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-600 mb-1">
              <Target className="w-3 h-3" />
              Chỉ tiêu
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plan.kpis.map((k) => (
                <span key={k.label} className="inline-flex items-center gap-1 rounded-full bg-white border border-violet-100 px-2.5 py-1 text-[11px] text-gray-600">
                  {k.label} <span className="font-extrabold text-violet-700">{k.target}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
