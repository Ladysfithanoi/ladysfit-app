"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

const inputCls =
  "w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50";

export function SettingsTab() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEmpty = !current.trim() || !newPw.trim() || !confirm.trim();
  const mismatch = confirm.length > 0 && newPw !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEmpty || mismatch) return;
    if (newPw !== confirm) {
      setError("Mật khẩu xác nhận không trùng khớp!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/my/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
      setSuccess(true);
      setCurrent("");
      setNewPw("");
      setConfirm("");
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-[#f15b5c]" />
          <p className="text-sm font-extrabold text-gray-700">Đổi mật khẩu</p>
        </div>

        {success && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
            <p className="text-sm font-bold text-emerald-600 text-center">
              ✓ Đổi mật khẩu thành công!
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Mật khẩu hiện tại *</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              className={inputCls}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Mật khẩu mới *</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              className={inputCls}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Xác nhận mật khẩu mới *</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className={
                inputCls +
                (mismatch ? " border-red-400 focus:ring-red-300/30" : "")
              }
              autoComplete="new-password"
            />
            {mismatch && (
              <p className="text-xs font-bold text-red-500">
                Mật khẩu xác nhận không trùng khớp!
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm font-semibold text-[#f15b5c]">{error}</p>
          )}

          <button
            type="submit"
            disabled={isEmpty || mismatch || loading}
            className="w-full h-12 rounded-2xl text-white font-bold text-sm disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
          </button>
        </form>
      </div>
    </div>
  );
}
