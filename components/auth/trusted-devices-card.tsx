"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Laptop, Smartphone, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

interface Device {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

function describeDevice(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: "Thiết bị không rõ", mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const os =
    /iPhone|iPad/i.test(ua) ? "iPhone/iPad" :
    /Android/i.test(ua)     ? "Android" :
    /Windows/i.test(ua)     ? "Windows" :
    /Mac OS X/i.test(ua)    ? "Mac" :
    /Linux/i.test(ua)       ? "Linux" : "Thiết bị khác";
  const browser =
    /Edg\//.test(ua)                 ? "Edge" :
    /CriOS|Chrome\//.test(ua)        ? "Chrome" :
    /FxiOS|Firefox\//.test(ua)       ? "Firefox" :
    /Zalo/i.test(ua)                 ? "Zalo" :
    /FBAN|FBAV/.test(ua)             ? "Facebook" :
    /Safari\//.test(ua)              ? "Safari" : "Trình duyệt";
  return { label: `${browser} · ${os}`, mobile };
}

function fmt(d: string) {
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * "Thiết bị đang đăng nhập" — bật/tắt xác minh máy lạ bằng mã email, xem các
 * máy đã đăng nhập và đăng xuất từ xa.
 * Ẩn hẳn khi chưa bật xác minh thiết bị toàn hệ thống (LOGIN_OTP_ENABLED).
 */
export function TrustedDevicesCard({ endpoint, className }: { endpoint: string; className?: string }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [verifyNew, setVerifyNew] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  /** Hộp xác nhận đang mở: sắp TẮT hay sắp BẬT xác minh. null = đóng. */
  const [confirming, setConfirming] = useState<"off" | "on" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setEnabled(!!data.enabled);
      setVerifyNew(data.verifyNewDevices !== false);
      setDevices(data.devices ?? []);
    } catch {
      /* im lặng — thẻ này chỉ là tiện ích */
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  async function revoke(body: object, key: string) {
    setBusy(key);
    try {
      await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  // Cả hai chiều đều hỏi lại bằng hộp thoại của app (không dùng window.confirm
  // của trình duyệt): tắt là mở cửa cho ai biết mật khẩu, bật là đăng xuất mọi
  // máy khác — chiều nào cũng cần người dùng biết trước chuyện gì sẽ xảy ra.
  function toggleVerify() {
    setConfirming(verifyNew ? "off" : "on");
  }

  async function applyVerify(next: boolean) {
    setConfirming(null);
    setBusy("toggle");
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifyNewDevices: next }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  }

  if (!enabled || !devices) return null;
  const others = devices.filter((d) => !d.current);

  return (
    <div className={className ?? "bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-extrabold text-gray-700">Thiết bị đang đăng nhập</p>
        {others.length > 0 && (
          <button
            onClick={() => revoke({ others: true }, "all")}
            disabled={busy !== null}
            className="text-xs font-bold text-[#f15b5c] disabled:opacity-50"
          >
            {busy === "all" ? "Đang xử lý..." : "Đăng xuất máy khác"}
          </button>
        )}
      </div>
      <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">Xác nhận qua email khi có máy lạ</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {verifyNew
              ? "Đang bật: máy mới đăng nhập phải nhập mã gửi về email."
              : "Đang tắt: ai biết mật khẩu cũng vào được từ máy bất kỳ. Bật lại sẽ đăng xuất mọi máy khác."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={verifyNew}
          aria-label="Xác nhận qua email khi có máy lạ"
          onClick={toggleVerify}
          disabled={busy !== null}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
            verifyNew ? "bg-[#f15b5c]" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              verifyNew ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Thấy máy lạ? Đăng xuất nó và đổi mật khẩu.
      </p>
      <div className="divide-y divide-gray-50">
        {devices.map((d) => {
          const { label, mobile } = describeDevice(d.userAgent);
          const Icon = mobile ? Smartphone : Laptop;
          return (
            <div key={d.id} className="flex items-center gap-3 py-2.5">
              <Icon className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {label}
                  {d.current && <span className="ml-2 text-[11px] font-bold text-emerald-600">Máy này</span>}
                </p>
                <p className="text-[11px] text-gray-400">Lần cuối: {fmt(d.lastSeenAt)}</p>
              </div>
              {!d.current && (
                <button
                  onClick={() => revoke({ id: d.id }, d.id)}
                  disabled={busy !== null}
                  className="text-xs font-bold text-gray-400 hover:text-[#f15b5c] disabled:opacity-50"
                >
                  {busy === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Đăng xuất"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirming && typeof document !== "undefined" && createPortal(
        <VerifyConfirmDialog
          mode={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => applyVerify(confirming === "on")}
        />,
        document.body,
      )}
    </div>
  );
}

/**
 * Hộp xác nhận bật/tắt xác minh máy lạ.
 *
 * Gắn thẳng vào <body> qua portal: thẻ thiết bị nằm trong khung trượt "Mật khẩu &
 * bảo mật" vốn đang dùng transform, mà phần tử fixed nằm trong khung có transform
 * sẽ bị nhốt trong khung đó thay vì phủ cả màn hình.
 */
function VerifyConfirmDialog({ mode, onCancel, onConfirm }: {
  mode: "off" | "on";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const off = mode === "off";
  const Icon = off ? ShieldAlert : ShieldCheck;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center ${off ? "bg-amber-50" : "bg-emerald-50"}`}>
          <Icon className={`w-6 h-6 ${off ? "text-amber-500" : "text-emerald-500"}`} />
        </div>
        <h3 className="mt-4 text-center text-base font-extrabold text-gray-900">
          {off ? "Tắt xác minh máy lạ?" : "Bật xác minh máy lạ?"}
        </h3>
        <p className="mt-2 text-center text-sm text-gray-500 leading-relaxed">
          {off
            ? "Ai biết mật khẩu cũng đăng nhập được tài khoản của bạn từ bất kỳ máy nào, không cần mã gửi về email."
            : "Từ giờ máy mới đăng nhập phải nhập mã gửi về email. Mọi máy khác đang đăng nhập sẽ bị đăng xuất — chỉ giữ lại máy này."}
        </p>
        {off && (
          <p className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-semibold text-amber-700 leading-relaxed">
            Chỉ nên tắt khi bạn không nhận được email. Có thể bật lại bất cứ lúc nào.
          </p>
        )}
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {off ? "Giữ bật" : "Huỷ"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={`flex-1 h-11 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 ${off ? "bg-amber-500" : "bg-[#f15b5c]"}`}
          >
            {off ? "Vẫn tắt" : "Bật xác minh"}
          </button>
        </div>
      </div>
    </div>
  );
}
