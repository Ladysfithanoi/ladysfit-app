"use client";

import { useState, useEffect, useCallback } from "react";

type Notification = {
  id: string;
  message: string;
  nextSessionName: string | null;
  nextSessionPhase: string | null;
  expiresAt: string;
  createdAt: string;
};

const STORAGE_KEY = "ldf_notif_shown";
const AUTO_CLOSE_SECS = 10;

export function WorkoutNotificationPopup() {
  const [notif, setNotif] = useState<Notification | null>(null);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECS);

  const dismiss = useCallback(async (id: string) => {
    setVisible(false);
    try {
      await fetch(`/api/my/notifications/${id}/read`, { method: "PUT" });
      sessionStorage.setItem(STORAGE_KEY, id);
    } catch { /* non-critical */ }
    setTimeout(() => setNotif(null), 350); // wait for fade-out
  }, []);

  // Fetch notification on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/my/notifications");
        if (!res.ok) return;
        const data: Notification[] = await res.json();
        if (!data.length) return;

        const latest = data[0];
        const alreadyShown = sessionStorage.getItem(STORAGE_KEY) === latest.id;
        if (alreadyShown) return;

        setNotif(latest);
        setTimeout(() => setVisible(true), 80); // tiny delay for fade-in
      } catch { /* non-critical */ }
    }
    load();
  }, []);

  // Countdown + auto-close
  useEffect(() => {
    if (!visible || !notif) return;
    setCountdown(AUTO_CLOSE_SECS);

    const tick = setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          clearInterval(tick);
          dismiss(notif.id);
          return 0;
        }
        return v - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [visible, notif, dismiss]);

  if (!notif) return null;

  // Parse "currentLabel - phase" from message to show in body
  // message format: "Chúc mừng chị X đã hoàn thành [Buổi A] - [Phase]. Buổi tiếp theo..."
  const currentMatch = notif.message.match(/hoàn thành (.+?) - (.+?)\./);
  const currentSessionLabel = currentMatch ? `${currentMatch[1]} - ${currentMatch[2]}` : "";

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
        onClick={() => dismiss(notif.id)}
      />

      {/* Modal */}
      <div
        className="fixed z-50 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[320px]
          bg-white rounded-3xl shadow-2xl px-6 py-6 flex flex-col items-center
          transition-all duration-300"
        style={{
          top: "50%",
          transform: `translateX(-50%) translateY(${visible ? "-50%" : "-42%"})`,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-2xl bg-[#f15b5c] flex items-center justify-center mb-3">
          <span className="text-lg font-black text-white">L</span>
        </div>

        {/* Emoji + title */}
        <p className="text-3xl mb-1">🎉</p>
        <h2 className="text-lg font-extrabold text-[#f15b5c] mb-1">Hoàn thành buổi tập!</h2>

        {/* Current session done */}
        <p className="text-sm font-semibold text-gray-700 text-center leading-relaxed mb-4">
          Chúc mừng chị đã hoàn thành
          <br />
          <span className="font-extrabold text-gray-900">{currentSessionLabel}</span>
        </p>

        {/* Next session box */}
        {notif.nextSessionName && (
          <div className="w-full rounded-2xl border-2 border-[#f15b5c]/30 bg-[#fff5f5] px-4 py-3 mb-5 text-center">
            <p className="text-[10px] font-bold text-[#f15b5c]/60 uppercase tracking-widest mb-1">
              Buổi tập tiếp theo
            </p>
            <p className="text-base font-extrabold text-gray-900">
              {notif.nextSessionName}
              {notif.nextSessionPhase ? ` — ${notif.nextSessionPhase}` : ""}
            </p>
          </div>
        )}

        {/* CTA button */}
        <button
          onClick={() => dismiss(notif.id)}
          className="w-full h-12 rounded-2xl text-white font-extrabold text-sm
            transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: "#f15b5c" }}
        >
          Tuyệt vời! 💪
        </button>

        {/* Countdown */}
        <p className="text-[10px] text-gray-300 font-semibold mt-3">
          Tự đóng sau {countdown}s · Thông báo sẽ tự xóa sau 24 giờ
        </p>
      </div>
    </>
  );
}
