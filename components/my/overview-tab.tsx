"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, TrendingDown, Plus, Flag } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";

const COMPLAINT_CATEGORIES = [
  "Chất lượng PT",
  "Chất lượng cơ sở vật chất",
  "Thái độ nhân viên",
  "Vấn đề hợp đồng/lộ trình",
  "Vấn đề thanh toán",
  "Khác",
];

type Props = {
  clientName: string;
  initialWeight: number;
  currentWeight: number;
  targetWeight: number;
  todaySteps: number | null;
  todayGymMinutes: number | null;
};

function motivation(pct: number) {
  if (pct < 25) return "Hành trình mới bắt đầu, cố lên! 🌟";
  if (pct < 50) return "Bạn đang tiến bộ tốt! 💪";
  if (pct < 75) return "Hơn nửa chặng đường rồi! 🔥";
  return "Gần đến đích rồi! Không dừng lại! 🎯";
}

export function OverviewTab({
  clientName,
  initialWeight,
  currentWeight,
  targetWeight,
  todaySteps,
  todayGymMinutes,
}: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Complaint state
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [cCategory, setCCategory] = useState("");
  const [cContent, setCContent] = useState("");
  const [cLoading, setCLoading] = useState(false);
  const [cError, setCError] = useState("");
  const [cSuccess, setCSuccess] = useState(false);

  const lostKg = Math.max(0, initialWeight - currentWeight);
  const remainingKg = Math.max(0, currentWeight - targetWeight);
  const totalToLose = initialWeight - targetWeight;
  const progressPct = totalToLose > 0 ? Math.min(100, Math.round((lostKg / totalToLose) * 100)) : 0;
  const isTransformed = lostKg >= 7;

  async function handleWeightSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/my/weight-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: fd.get("date"),
          weight: fd.get("weight"),
          note: fd.get("note") || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setSheetOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplaintSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cCategory) { setCError("Vui lòng chọn hạng mục"); return; }
    if (cContent.trim().length < 20) { setCError("Nội dung phải có ít nhất 20 ký tự"); return; }
    setCLoading(true);
    setCError("");
    try {
      const res = await fetch("/api/my/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cCategory, content: cContent }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Có lỗi xảy ra");
      setCSuccess(true);
      setTimeout(() => {
        setComplaintOpen(false);
        setCSuccess(false);
        setCCategory("");
        setCContent("");
      }, 2000);
    } catch (err) {
      setCError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setCLoading(false);
    }
  }

  return (
    <>
      {/* Welcome */}
      <div className="bg-gradient-to-br from-[#f15b5c] to-[#e04a4b] rounded-3xl p-5 text-white mb-4 shadow-md shadow-[#f15b5c]/20">
        <p className="text-lg font-extrabold">Xin chào, {clientName.split(" ").pop()}! 💪</p>
        <p className="text-sm opacity-80 mt-0.5">Hãy kiên trì — kết quả sẽ đến!</p>
        <p className="mt-3 text-xs font-bold opacity-70 uppercase tracking-wide">
          {motivation(progressPct)}
        </p>
      </div>

      {/* Progress card */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-extrabold text-gray-700">Tiến độ giảm cân</p>
          {isTransformed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#f15b5c]/10 text-[#f15b5c]">
              <Star className="w-3 h-3 fill-[#f15b5c]" /> Đã Transform
            </span>
          )}
        </div>

        <div className="flex items-end gap-3 mb-4">
          <div>
            <p className="text-3xl font-black text-[#f15b5c]">{currentWeight} kg</p>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Cân nặng hiện tại</p>
          </div>
          <div className="mb-1 flex items-center gap-1 text-emerald-500">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm font-bold">{lostKg.toFixed(1)} kg</span>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-gray-500">Đã giảm: {lostKg.toFixed(1)} kg</span>
            <span className="text-[#f15b5c]">{progressPct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: "#f15b5c" }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 font-semibold">
            <span>Ban đầu: {initialWeight} kg</span>
            <span>Mục tiêu: {targetWeight} kg</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl px-4 py-2 text-sm font-semibold text-gray-500">
          Còn lại:{" "}
          <span className="font-extrabold text-gray-800">{remainingKg.toFixed(1)} kg</span>
        </div>
      </div>

      {/* Quick update */}
      <button
        onClick={() => { setError(""); setSheetOpen(true); }}
        className="w-full h-13 py-3.5 rounded-2xl text-white font-bold text-sm shadow-sm mb-4 flex items-center justify-center gap-2"
        style={{ backgroundColor: "#f15b5c" }}
      >
        <Plus className="w-4 h-4" />
        Cập nhật cân nặng hôm nay
      </button>

      {/* Today activity */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
        <p className="text-sm font-extrabold text-gray-700 mb-3">Vận động hôm nay</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-blue-600">{todaySteps ?? "—"}</p>
            <p className="text-xs font-bold text-blue-400 mt-0.5">Bước chân</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-orange-500">{todayGymMinutes ?? "—"}</p>
            <p className="text-xs font-bold text-orange-400 mt-0.5">Phút tập gym</p>
          </div>
        </div>
      </div>

      {/* Complaint button */}
      <button
        onClick={() => { setCError(""); setComplaintOpen(true); }}
        className="w-full mt-2 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border-2 border-[#f15b5c] text-[#f15b5c] bg-white"
      >
        <Flag className="w-4 h-4" />
        Gửi phản hồi
      </button>

      {/* Weight bottom sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Cập nhật cân nặng">
        <form onSubmit={handleWeightSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Ngày *</label>
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Cân nặng (kg) *</label>
            <input
              name="weight"
              type="number"
              step="0.1"
              required
              placeholder="65.5"
              className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-gray-700">Ghi chú</label>
            <textarea
              name="note"
              rows={2}
              placeholder="Ghi chú thêm..."
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50 resize-none"
            />
          </div>
          {error && <p className="text-sm text-[#f15b5c] font-semibold">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl text-white font-bold text-sm disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </button>
        </form>
      </BottomSheet>
      {/* Complaint bottom sheet */}
      <BottomSheet open={complaintOpen} onClose={() => setComplaintOpen(false)} title="Gửi phản hồi">
        {cSuccess ? (
          <div className="py-8 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-bold text-gray-800">Phản hồi của bạn đã được gửi thành công!</p>
            <p className="text-sm text-gray-500 mt-1">Chúng tôi sẽ phản hồi sớm nhất có thể.</p>
          </div>
        ) : (
          <form onSubmit={handleComplaintSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Hạng mục *</label>
              <select
                value={cCategory}
                onChange={(e) => setCCategory(e.target.value)}
                className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50 appearance-none"
              >
                <option value="">Chọn hạng mục...</option>
                {COMPLAINT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-gray-700">Nội dung *</label>
              <textarea
                value={cContent}
                onChange={(e) => setCContent(e.target.value)}
                rows={4}
                placeholder="Mô tả chi tiết vấn đề bạn gặp phải (ít nhất 20 ký tự)..."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 bg-gray-50 resize-none"
              />
              <p className="text-xs text-gray-400 text-right">{cContent.length} ký tự</p>
            </div>
            {cError && <p className="text-sm text-[#f15b5c] font-semibold">{cError}</p>}
            <button
              type="submit"
              disabled={cLoading}
              className="w-full h-12 rounded-2xl text-white font-bold text-sm disabled:opacity-60"
              style={{ backgroundColor: "#f15b5c" }}
            >
              {cLoading ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </form>
        )}
      </BottomSheet>
    </>
  );
}
