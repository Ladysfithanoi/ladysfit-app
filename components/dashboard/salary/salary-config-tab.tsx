"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import type { Branch, StaffMember } from "./salary-page";

type Config = {
  baseSalary: string;
  seniorityYears: number;
  startDate: string;
  effectiveFrom: string;
  saving: boolean;
};

type Props = {
  branches: Branch[];
  staffList: StaffMember[];
  currentFMId: string;
  currentFMName: string;
};

const FM_BASE         = 5_500_000;
const FM_LUNCH        = 2_600_000;
const FM_PHONE        = 900_000;
const FM_TRANSPORT    = 500_000;
const FM_FIXED_TOTAL  = FM_BASE + FM_LUNCH + FM_PHONE + FM_TRANSPORT;
const PT_DEFAULT_BASE = 5_310_000;

const vnd = (n: number) => n.toLocaleString("vi-VN") + "đ";

const PT_TIERS = [
  { label: "Dưới 38M",    rate: "1%"   },
  { label: "38M – 59.9M", rate: "2.5%" },
  { label: "60M – 85.9M", rate: "3.5%" },
  { label: "86M trở lên", rate: "4%"   },
];

const FM_TIERS = [
  { label: "Dưới 100M",    rate: "0%"   },
  { label: "100M – 139.9M", rate: "1%"  },
  { label: "140M – 199.9M", rate: "1.5%" },
  { label: "200M trở lên",  rate: "2%"  },
];

function makeDefault(isFM: boolean): Config {
  return {
    baseSalary:     isFM ? String(FM_BASE) : String(PT_DEFAULT_BASE),
    seniorityYears: 0,
    startDate:      "",
    effectiveFrom:  new Date().toISOString().split("T")[0],
    saving:         false,
  };
}

const inputCls   = "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-full";
const roFieldCls = "h-9 flex items-center px-3 text-sm font-semibold text-gray-700 bg-gray-50 rounded-xl border border-gray-100";

function TierTable({ tiers, note }: { tiers: { label: string; rate: string }[]; note: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
        Chính sách hoa hồng (toàn công ty)
      </p>
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#f5f5f5] border-b border-gray-200">
              <th className="px-3 py-2 text-left font-bold text-gray-400 border-r border-gray-200">Doanh số</th>
              <th className="px-3 py-2 text-left font-bold text-gray-400">% Hoa hồng</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0 divide-x divide-gray-100">
                <td className="px-3 py-2 text-gray-600">{t.label}</td>
                <td className="px-3 py-2 font-semibold text-gray-700">{t.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 italic mt-1.5">{note}</p>
    </div>
  );
}

export function SalaryConfigTab({ branches, staffList, currentFMId, currentFMName }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id ?? "");
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [toast, setToast] = useState("");

  const branchPTs = staffList.filter(s => s.branchId === selectedBranchId && s.id !== currentFMId && s.role !== "ADMIN");

  useEffect(() => {
    async function loadOne(userId: string, isFM: boolean) {
      try {
        const res = await fetch(`/api/salary/config?userId=${userId}`);
        if (!res.ok) { setConfigs(prev => ({ ...prev, [userId]: makeDefault(isFM) })); return; }
        const data = await res.json() as {
          baseSalary: number; seniorityYears: number;
          startDate: string | null; effectiveFrom: string;
        } | null;
        setConfigs(prev => ({
          ...prev,
          [userId]: {
            baseSalary:     data ? String(data.baseSalary) : (isFM ? String(FM_BASE) : String(PT_DEFAULT_BASE)),
            seniorityYears: data?.seniorityYears ?? 0,
            startDate:      data?.startDate ? new Date(data.startDate).toISOString().split("T")[0] : "",
            effectiveFrom:  data?.effectiveFrom
              ? new Date(data.effectiveFrom).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            saving: false,
          },
        }));
      } catch { /* ignore */ }
    }

    loadOne(currentFMId, true);
    staffList
      .filter(s => s.branchId === selectedBranchId && s.id !== currentFMId && s.role !== "ADMIN")
      .forEach(s => loadOne(s.id, false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  function getCfg(userId: string, isFM = false): Config {
    return configs[userId] ?? makeDefault(isFM);
  }

  function patch(userId: string, update: Partial<Config>) {
    setConfigs(prev => ({ ...prev, [userId]: { ...(prev[userId] ?? makeDefault(false)), ...update } }));
  }

  async function handleSave(userId: string, isFM: boolean) {
    const cfg = getCfg(userId, isFM);
    const branchId = isFM
      ? selectedBranchId
      : (staffList.find(s => s.id === userId)?.branchId ?? selectedBranchId);
    patch(userId, { saving: true });
    try {
      const body: Record<string, unknown> = {
        userId,
        branchId,
        baseSalary:     isFM ? FM_BASE : (parseFloat(cfg.baseSalary) || PT_DEFAULT_BASE),
        seniorityYears: cfg.seniorityYears,
        startDate:      cfg.startDate || null,
        effectiveFrom:  cfg.effectiveFrom,
        ...(isFM ? { lunchAllowance: FM_LUNCH, phoneAllowance: FM_PHONE, transportAllowance: FM_TRANSPORT } : {}),
      };
      const res = await fetch("/api/salary/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setToast("Đã lưu cấu hình ✓");
        setTimeout(() => setToast(""), 3000);
      }
    } finally {
      patch(userId, { saving: false });
    }
  }

  const fmCfg = getCfg(currentFMId, true);

  return (
    <div className="space-y-5 max-w-3xl">
      {branches.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Chi nhánh:</label>
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
          >
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* ── FM own config ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-extrabold text-gray-700">{currentFMName}</p>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#f15b5c]/10 text-[#f15b5c]">FM</span>
        </div>
        <div className="p-5 space-y-5">

          {/* Fixed allowances (read-only) */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Lương & phụ cấp cố định</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Lương cơ bản",          val: FM_BASE      },
                { label: "Phụ cấp ăn trưa",        val: FM_LUNCH     },
                { label: "Phụ cấp điện thoại",     val: FM_PHONE     },
                { label: "Phụ cấp xăng xe",        val: FM_TRANSPORT },
              ].map(({ label, val }) => (
                <div key={label} className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">{label}</label>
                  <div className={roFieldCls}>{vnd(val)}</div>
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Tổng cố định</label>
                <div className={roFieldCls} style={{ color: "#f15b5c", fontWeight: 800 }}>{vnd(FM_FIXED_TOTAL)}</div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Thưởng thâm niên</label>
                <div className={roFieldCls}>
                  {fmCfg.seniorityYears > 0 ? vnd(Math.min(fmCfg.seniorityYears, 4) * 9_000_000) : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Editable: seniority + startDate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Năm thâm niên (0–4)</label>
              <select
                value={fmCfg.seniorityYears}
                onChange={e => patch(currentFMId, { seniorityYears: Number(e.target.value) })}
                className={inputCls}
              >
                {[0, 1, 2, 3, 4].map(y => (
                  <option key={y} value={y}>
                    {y} năm{y > 0 ? ` (+${vnd(y * 9_000_000)})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Ngày nhận việc (BHXH)</label>
              <input
                type="date"
                value={fmCfg.startDate}
                onChange={e => patch(currentFMId, { startDate: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <TierTable tiers={FM_TIERS} note="* Tính trên tổng doanh thu chi nhánh trong tháng" />

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={() => handleSave(currentFMId, true)}
              disabled={fmCfg.saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: "#f15b5c" }}
            >
              <Save className="w-4 h-4" />
              {fmCfg.saving ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          </div>
        </div>
      </div>

      {/* ── PT config cards ── */}
      {branchPTs.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400 italic">
          Không có nhân sự PT trong chi nhánh này
        </div>
      ) : (
        branchPTs.map(staff => {
          const cfg = getCfg(staff.id);
          return (
            <div key={staff.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-extrabold text-gray-700">{staff.name ?? staff.email}</p>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-500">PT</span>
              </div>
              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Lương cơ bản</label>
                    <input
                      type="number"
                      step="10000"
                      value={cfg.baseSalary}
                      onFocus={(e) => e.target.select()}
                      onChange={e => patch(staff.id, { baseSalary: e.target.value })}
                      className={inputCls}
                    />
                    <p className="text-[10px] text-gray-400">{vnd(parseFloat(cfg.baseSalary) || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Năm thâm niên (0–4)</label>
                    <select
                      value={cfg.seniorityYears}
                      onChange={e => patch(staff.id, { seniorityYears: Number(e.target.value) })}
                      className={inputCls}
                    >
                      {[0, 1, 2, 3, 4].map(y => (
                        <option key={y} value={y}>
                          {y} năm{y > 0 ? ` (+${vnd(y * 6_000_000)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Ngày nhận việc (BHXH)</label>
                    <input
                      type="date"
                      value={cfg.startDate}
                      onChange={e => patch(staff.id, { startDate: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Thưởng thâm niên</label>
                    <div className={roFieldCls}>
                      {cfg.seniorityYears > 0 ? vnd(Math.min(cfg.seniorityYears, 4) * 6_000_000) : "—"}
                    </div>
                  </div>
                </div>

                <TierTable tiers={PT_TIERS} note="* % áp dụng theo bậc toàn bộ doanh số tháng" />

                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleSave(staff.id, false)}
                    disabled={cfg.saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    <Save className="w-4 h-4" />
                    {cfg.saving ? "Đang lưu..." : "Lưu cấu hình"}
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
