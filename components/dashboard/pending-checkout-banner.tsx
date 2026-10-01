"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Volume2, VolumeX, X } from "lucide-react";

type PendingItem = {
  id: string;
  clientId: string;
  clientName: string;
  ptName: string | null;
  branchName: string | null;
  sessionName: string;
  checkInAt: string | null;
};

function sinceLabel(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} tiếng ${m} phút trước` : `${h} tiếng trước`;
}

/**
 * TIẾNG NHẮC — chữ vàng nằm im trên đầu trang thì nhân sự đang đứng sàn dễ bỏ
 * qua, mà cửa sổ để ký check-out chỉ còn 30' (90' → mốc huỷ 2 tiếng). Nên:
 *   • có buổi MỚI lọt vào danh sách → kêu ngay;
 *   • còn buổi chưa xử lý → cứ 10' kêu lại một lần.
 * Tiếng tự sinh bằng Web Audio, không cần file âm thanh. Trình duyệt chỉ cho
 * phát tiếng sau khi người dùng đã chạm/bấm vào trang một lần — trước đó thì
 * im, lần chạm đầu tiên sẽ mở khoá.
 * Tắt/bật bằng nút loa, nhớ theo từng máy.
 */
const SOUND_KEY = "pendingCheckoutSound";
const REPEAT_MS = 10 * 60_000;

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Hai tiếng "ting-ting" ngắn, đủ nghe ở phòng tập mà không chói. */
function playChime() {
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  [0, 0.35].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = i === 0 ? 880 : 1175;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.55);
  });
}

function readSoundPref(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

// On-demand alert: sessions checked in >90' ago with no check-out signature yet.
// The package was already deducted at check-in, but the PT hasn't been credited
// for teaching, so these need a check-out signature before they count for salary.
export function PendingCheckoutBanner() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const alertedIds = useRef<Set<string>>(new Set());
  const lastChimeAt = useRef(0);

  useEffect(() => { setSoundOn(readSoundPref()); }, []);

  // Trình duyệt khoá âm thanh tới khi có thao tác đầu tiên — mở khoá ở đó.
  useEffect(() => {
    const unlock = () => { getAudioCtx()?.resume().catch(() => {}); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!soundOn || dismissed || items.length === 0) return;
    const ring = () => {
      const ctx = getAudioCtx();
      if (!ctx || ctx.state !== "running") return false; // chưa mở khoá — để lần sau
      playChime();
      lastChimeAt.current = Date.now();
      items.forEach((it) => alertedIds.current.add(it.id));
      return true;
    };
    const hasNew = items.some((it) => !alertedIds.current.has(it.id));
    if (hasNew || Date.now() - lastChimeAt.current >= REPEAT_MS) ring();
    const t = setInterval(() => {
      if (Date.now() - lastChimeAt.current >= REPEAT_MS) ring();
    }, 30_000);
    return () => clearInterval(t);
  }, [items, soundOn, dismissed]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem(SOUND_KEY, next ? "on" : "off"); } catch {}
    if (next) {
      // Bấm nút cũng là một thao tác → mở khoá và kêu thử luôn cho biết.
      getAudioCtx()?.resume().then(playChime).catch(() => {});
    }
  }

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/workout-logs/pending-checkout");
        if (!res.ok) return;
        const data = (await res.json()) as PendingItem[];
        if (active) setItems(data);
      } catch {
        // best-effort
      }
    };
    load();
    // Refresh periodically while the dashboard stays open.
    const t = setInterval(load, 5 * 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  if (dismissed || items.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50">
      {/* Compact one-line summary; click to expand the list */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left text-xs font-bold text-amber-800 truncate"
          title="Xem chi tiết"
        >
          {items.length} buổi chưa ký check-out (&gt;90&apos;)
          <span className="ml-1 font-semibold text-amber-600">{expanded ? "Thu gọn" : "Xem"}</span>
        </button>
        <button
          type="button"
          onClick={toggleSound}
          className="flex-shrink-0 text-amber-500 hover:text-amber-700"
          title={soundOn ? "Tắt tiếng nhắc" : "Bật tiếng nhắc"}
        >
          {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-400 hover:text-amber-700"
          title="Ẩn cảnh báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <ul className="px-3 pb-2 pt-1.5 border-t border-amber-100 grid gap-x-4 gap-y-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.id} className="text-xs text-amber-900 truncate">
              <Link
                href={`/dashboard/clients/${it.clientId}`}
                className="font-bold underline decoration-amber-300 hover:decoration-amber-600"
              >
                {it.clientName}
              </Link>
              {it.branchName ? <span className="text-amber-700"> · {it.branchName}</span> : null}
              {it.ptName ? <span className="text-amber-600"> · {it.ptName}</span> : null}
              <span className="text-amber-500"> · {sinceLabel(it.checkInAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
