"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

type KOCContract = {
  id: string;
  enrollmentId: string;
  contractCode: string | null;
  clientId: string;
  clientName: string;
  ptId: string;
  ptName: string | null;
  startWeight: number;
  endWeight: number | null;
  startWeightConfirmed: boolean;
  endWeightConfirmed: boolean;
  contractDate: string;
  endDate: string;
  status: string;
  totalSessions: number;
  notes: string | null;
};

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

function calculateKOCCommission(startWeight: number, endWeight: number | null, sessions: number): number {
  if (endWeight == null) return 0;
  const weightLost = startWeight - endWeight;
  const maxSessions = Math.min(sessions, 60);
  if (startWeight < 70) return 0;
  if (weightLost >= 8 && weightLost <= 9.9) return maxSessions * 35_000;
  if (weightLost >= 5 && weightLost <= 7.9) return maxSessions * 25_000;
  if (weightLost >= 3 && weightLost <= 4.9) return maxSessions * 20_000;
  return 0;
}

export function KOCFMPanel() {
  const [contracts, setContracts] = useState<KOCContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [endWeightInputs, setEndWeightInputs] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/koc-contracts");
      if (res.ok) setContracts(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function confirmStartWeight(id: string) {
    setSaving(id + "_start");
    try {
      const res = await fetch(`/api/koc-contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startWeightConfirmed: true }),
      });
      if (res.ok) {
        const updated = await res.json() as KOCContract;
        setContracts(prev => prev.map(c => c.id === id ? { ...c, startWeightConfirmed: updated.startWeightConfirmed } : c));
        showToast("Đã xác nhận cân nặng đầu ✓");
      }
    } finally { setSaving(null); }
  }

  async function confirmEndWeight(id: string) {
    const raw = endWeightInputs[id];
    const endWeight = parseFloat(raw);
    if (!raw || isNaN(endWeight) || endWeight <= 0) return;
    setSaving(id + "_end");
    try {
      const res = await fetch(`/api/koc-contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endWeight, endWeightConfirmed: true }),
      });
      if (res.ok) {
        const updated = await res.json() as KOCContract;
        setContracts(prev => prev.map(c => c.id === id ? {
          ...c,
          endWeight: updated.endWeight,
          endWeightConfirmed: updated.endWeightConfirmed,
          status: updated.status,
        } : c));
        setEndWeightInputs(prev => { const n = { ...prev }; delete n[id]; return n; });
        showToast("Đã xác nhận kết quả — hoa hồng tự động tính ✓");
      }
    } finally { setSaving(null); }
  }

  const active    = contracts.filter(c => c.status === "ACTIVE");
  const completed = contracts.filter(c => c.status === "COMPLETED");

  function ContractCard({ c }: { c: KOCContract }) {
    const endDate = new Date(c.endDate);
    const now = new Date();
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const canConfirmEnd = daysLeft <= 0 || c.endWeightConfirmed;
    const commission = calculateKOCCommission(c.startWeight, c.endWeight, c.totalSessions);
    const weightLost = c.endWeight != null ? c.startWeight - c.endWeight : null;

    return (
      <div className={cn(
        "border rounded-xl p-4 space-y-3",
        c.status === "COMPLETED" ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/30"
      )}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-800 text-sm">{c.clientName}</span>
              {c.contractCode && (
                <span className="text-[10px] font-mono text-gray-400">{c.contractCode}</span>
              )}
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                c.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              )}>
                {c.status === "COMPLETED" ? "Hoàn thành" : "Đang thực hiện"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">PT: {c.ptName ?? "—"} • {c.totalSessions} buổi đã dạy</p>
          </div>
          {c.status === "COMPLETED" && commission > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] text-gray-400">Hoa hồng</p>
              <p className="text-sm font-extrabold text-amber-700">{vnd(commission)}</p>
            </div>
          )}
        </div>

        {/* Weight info */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg px-3 py-2 text-center border border-gray-100">
            <p className="text-[10px] text-gray-400">Cân đầu</p>
            <p className="text-sm font-bold text-gray-700">{c.startWeight}kg</p>
            {c.startWeightConfirmed
              ? <p className="text-[10px] text-green-600 font-semibold">✓ FM xác nhận</p>
              : <p className="text-[10px] text-amber-500">Chờ xác nhận</p>}
          </div>
          <div className="bg-white rounded-lg px-3 py-2 text-center border border-gray-100">
            <p className="text-[10px] text-gray-400">Cân cuối</p>
            <p className="text-sm font-bold text-gray-700">{c.endWeight != null ? `${c.endWeight}kg` : "—"}</p>
            {c.endWeightConfirmed
              ? <p className="text-[10px] text-green-600 font-semibold">✓ FM xác nhận</p>
              : <p className="text-[10px] text-gray-400">Chờ kết quả</p>}
          </div>
          <div className="bg-white rounded-lg px-3 py-2 text-center border border-gray-100">
            <p className="text-[10px] text-gray-400">Giảm được</p>
            <p className="text-sm font-bold text-green-700">
              {weightLost != null && weightLost > 0 ? `-${weightLost.toFixed(1)}kg` : "—"}
            </p>
            {weightLost != null && weightLost >= 3 && (
              <p className="text-[10px] text-green-600 font-semibold">Đủ điều kiện</p>
            )}
          </div>
        </div>

        {/* Actions */}
        {c.status === "ACTIVE" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!c.startWeightConfirmed && (
              <button
                onClick={() => confirmStartWeight(c.id)}
                disabled={saving === c.id + "_start"}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {saving === c.id + "_start" ? "Đang lưu..." : "Xác nhận cân nặng đầu"}
              </button>
            )}
            {c.startWeightConfirmed && !c.endWeightConfirmed && (
              <div className="flex items-center gap-2 flex-wrap">
                {!canConfirmEnd && (
                  <p className="text-[10px] text-gray-400 italic">
                    Còn {daysLeft} ngày đến {endDate.toLocaleDateString("vi-VN")} mới xác nhận kết quả
                  </p>
                )}
                {(canConfirmEnd || true) && (
                  <>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Cân nặng cuối (kg)"
                      value={endWeightInputs[c.id] ?? ""}
                      onChange={e => setEndWeightInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                      className="h-8 w-36 rounded-lg border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <button
                      onClick={() => confirmEndWeight(c.id)}
                      disabled={saving === c.id + "_end" || !endWeightInputs[c.id]}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      {saving === c.id + "_end" ? "Đang lưu..." : "Xác nhận kết quả"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">KOC</span>
          <p className="text-sm font-extrabold text-gray-700">Danh sách hợp đồng KOC cần xác nhận</p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Đang tải...</div>
        ) : (
          <div className="p-5 space-y-3">
            {active.length === 0 && completed.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">Chưa có hợp đồng KOC nào</p>
            ) : (
              <>
                {active.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Đang thực hiện ({active.length})</p>
                    {active.map(c => <ContractCard key={c.id} c={c} />)}
                  </>
                )}
                {completed.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wide mt-4">Đã hoàn thành ({completed.length})</p>
                    {completed.map(c => <ContractCard key={c.id} c={c} />)}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
