"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop, Smartphone, Loader2 } from "lucide-react";

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
 * "Thiết bị đang đăng nhập" — xem các máy đã xác minh và đăng xuất từ xa.
 * Ẩn hẳn khi chưa bật xác minh thiết bị (LOGIN_OTP_ENABLED).
 */
export function TrustedDevicesCard({ endpoint, className }: { endpoint: string; className?: string }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setEnabled(!!data.enabled);
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
      <p className="text-xs text-gray-400 mb-3">
        Đăng nhập trên máy mới cần mã gửi về email. Thấy máy lạ? Đăng xuất nó và đổi mật khẩu.
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
    </div>
  );
}
