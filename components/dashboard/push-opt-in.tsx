"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";

/**
 * Mời nhân sự bật THÔNG BÁO ĐẨY trên thiết bị đang dùng — để nhắc ký check-out
 * tới được cả khi app đang đóng hay điện thoại đang khoá màn hình
 * (máy chủ gửi: lib/checkout-push.ts, service worker hiện: public/sw.js).
 *
 *   • Đã cho phép → lặng lẽ đăng ký lại mỗi lần mở app, để máy chủ luôn giữ
 *     đúng thiết bị của người ĐANG đăng nhập (máy dùng chung đổi người).
 *   • Chưa hỏi → hiện một dòng mời bật. Bấm X thì 7 ngày sau mới mời lại.
 *   • Đã chặn / trình duyệt không hỗ trợ → không làm phiền.
 * iPhone chỉ nhận thông báo đẩy khi app đã được "Thêm vào MH chính" (iOS 16.4+);
 * mở bằng Safari thường thì PushManager không có, dòng mời tự ẩn.
 */
const DISMISS_KEY = "pushOptInDismissedAt";
const DISMISS_DAYS = 7;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
    && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

async function subscribe(): Promise<boolean> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
  }
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

export function PushOptIn() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported()) return;
    if (Notification.permission === "granted") {
      subscribe().catch(() => {});
      return;
    }
    if (Notification.permission !== "default") return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - at < DISMISS_DAYS * 86_400_000) return;
    } catch {}
    setShow(true);
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setShow(false);
        return;
      }
      if (await subscribe()) setShow(false);
      else setError("Không lưu được đăng ký, thử lại nhé");
    } catch {
      setError("Thiết bị này chưa bật được thông báo");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
      <BellRing className="w-4 h-4 flex-shrink-0 text-sky-600" />
      <p className="flex-1 min-w-0 text-xs font-semibold text-sky-800">
        Bật thông báo để được nhắc ký check-out kể cả khi khoá màn hình
        {error && <span className="ml-1 text-red-500">— {error}</span>}
      </p>
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="flex-shrink-0 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {busy ? "Đang bật..." : "Bật"}
      </button>
      <button type="button" onClick={dismiss} className="flex-shrink-0 text-sky-400 hover:text-sky-700" title="Để sau">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
