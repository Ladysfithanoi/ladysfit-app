"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, X, ChevronDown, ChevronUp, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Branch, StaffMember } from "./salary-page";
import { SessionImageModal } from "./session-image-modal";
import { SessionDetailTable } from "./session-detail-table";

// ── Types ──────────────────────────────────────────────────────────────────

type SalaryRecord = {
  id: string;
  user: { id: string; name: string | null; email: string; role: string };
  baseSalary: number;
  totalRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  seniorityBonus: number;
  showsL1L2Loyal: number;
  showsL3L4L5: number;
  showPay: number;
  goalBonus: number;
  googleBonus: number;
  renewBonus: number;
  fixedAllowances: number;
  kocCommission: number;
  kolCommission: number;
  totalSalary: number;
  advancePaid: number;
  remainingPayment: number;
  notes: string | null;
  sessionImages: string | null;
  status: "PENDING" | "CONFIRMED" | "PAID";
};

type GenEntry = {
  userId: string;
  name: string;
  userRole: "PT" | "FM" | "ADMIN";
  showsL1L2Loyal: number;
  showsL3L4L5: number;
  clientsAchievedGoal: number;
  googleReviews: number;
  renewContracts: number;
};

type SessionCounts = Record<string, { showsL1L2Loyal: number; showsL3L4L5: number }>;

type ImgModalState = {
  recordId: string;
  ptName: string;
  images: string[];
  mode: "view" | "upload";
  initialIndex?: number;
};

type Props = {
  branches: Branch[];
  managedBranchIds: string[];
  staffList: StaffMember[];
  currentFMId: string;
  currentFMName: string;
  currentUserRole?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function vnd(n: number) { return n.toLocaleString("vi-VN") + "đ"; }

const STATUS_LABELS = { PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PAID: "Đã thanh toán" };
const STATUS_COLORS = {
  PENDING:   "bg-gray-100 text-gray-500",
  CONFIRMED: "bg-blue-100 text-blue-600",
  PAID:      "bg-green-100 text-green-600",
};

const TH = "px-3 py-2.5 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap border-r border-gray-200 last:border-r-0";

// ── Component ─────────────────────────────────────────────────────────────

export function SalaryTableTab({ branches, staffList, currentFMId, currentFMName, currentUserRole }: Props) {
  const isCOO = currentUserRole === "COO";
  const now = new Date();
  const [selectedBranchId, setSelectedBranchId] = useState(isCOO ? "" : (branches[0]?.id ?? ""));
  const [month, setMonth]  = useState(now.getMonth() + 1);
  const [year, setYear]    = useState(now.getFullYear());
  const [records, setRecords]   = useState<SalaryRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState("");

  // Edit row state
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editAdvance, setEditAdvance] = useState("");
  const [editNotes, setEditNotes]     = useState("");
  const [saving, setSaving]           = useState(false);

  // Generate modal state
  const [showGenModal, setShowGenModal]       = useState(false);
  const [genEntries, setGenEntries]           = useState<GenEntry[]>([]);
  const [generating, setGenerating]           = useState(false);
  const [sessionCounts, setSessionCounts]     = useState<SessionCounts>({});
  const [overrideIds, setOverrideIds]         = useState<Set<string>>(new Set());
  const [fetchingCounts, setFetchingCounts]   = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Session image modal
  const [imgModal, setImgModal] = useState<ImgModalState | null>(null);

  // Expanded detail rows (by record id)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  function toggleDetail(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const fetchRecords = useCallback(async () => {
    if (!isCOO && !selectedBranchId) return;
    setLoading(true);
    try {
      const branchParam = selectedBranchId ? `&branchId=${selectedBranchId}` : "";
      const res = await fetch(`/api/salary/records?month=${month}&year=${year}${branchParam}`);
      if (res.ok) setRecords(await res.json());
    } finally { setLoading(false); }
  }, [selectedBranchId, month, year, isCOO]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  async function openGenModal() {
    const branchPTs    = staffList.filter(s => s.branchId === selectedBranchId && ["FREE", "RESTRICTED", "PT"].includes(s.role));
    const branchAdmins = staffList.filter(s => s.branchId === selectedBranchId && s.role === "ADMIN");
    const entries: GenEntry[] = [
      {
        userId: currentFMId, name: currentFMName, userRole: "FM",
        showsL1L2Loyal: 0, showsL3L4L5: 0,
        clientsAchievedGoal: 0, googleReviews: 0, renewContracts: 0,
      },
      ...branchPTs.map(pt => ({
        userId: pt.id, name: pt.name ?? pt.email, userRole: "PT" as const,
        showsL1L2Loyal: 0, showsL3L4L5: 0,
        clientsAchievedGoal: 0, googleReviews: 0, renewContracts: 0,
      })),
      ...branchAdmins.map(a => ({
        userId: a.id, name: a.name ?? a.email, userRole: "ADMIN" as const,
        showsL1L2Loyal: 0, showsL3L4L5: 0,
        clientsAchievedGoal: 0, googleReviews: 0, renewContracts: 0,
      })),
    ];
    setGenEntries(entries);
    setOverrideIds(new Set());
    setShowGenModal(true);
    setFetchingCounts(true);

    try {
      const userIds = entries.map(e => e.userId).join(",");
      const res = await fetch(
        `/api/salary/session-counts?branchId=${selectedBranchId}&month=${month}&year=${year}&userIds=${userIds}`,
      );
      if (res.ok) {
        const data = await res.json() as SessionCounts;
        setSessionCounts(data);
        setGenEntries(entries.map(e => ({
          ...e,
          showsL1L2Loyal: data[e.userId]?.showsL1L2Loyal ?? 0,
          showsL3L4L5:    data[e.userId]?.showsL3L4L5    ?? 0,
        })));
      }
    } finally {
      setFetchingCounts(false);
    }
  }

  function updateEntry(userId: string, field: keyof GenEntry, value: number) {
    setGenEntries(prev => prev.map(e => e.userId === userId ? { ...e, [field]: value } : e));
  }

  function toggleOverride(userId: string) {
    setOverrideIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        setGenEntries(es => es.map(e =>
          e.userId === userId
            ? {
                ...e,
                showsL1L2Loyal: sessionCounts[userId]?.showsL1L2Loyal ?? 0,
                showsL3L4L5:    sessionCounts[userId]?.showsL3L4L5    ?? 0,
              }
            : e
        ));
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/salary/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranchId, month, year, entries: genEntries }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast("Lỗi: " + (err.error ?? `HTTP ${res.status}`));
        return;
      }
      const { created, skipped } = await res.json() as { created: number; skipped: number };
      showToast(`Đã tạo ${created} bảng lương${skipped > 0 ? `, bỏ qua ${skipped} (đã có)` : ""}`);
      setShowGenModal(false);
      fetchRecords();
    } finally { setGenerating(false); }
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/salary/records/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json() as SalaryRecord;
      setRecords(prev => prev.map(r => r.id === id ? updated : r));
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/salary/records/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advancePaid: parseFloat(editAdvance) || 0, notes: editNotes }),
      });
      if (res.ok) {
        const updated = await res.json() as SalaryRecord;
        setRecords(prev => prev.map(r => r.id === editingId ? updated : r));
        setEditingId(null);
        showToast("Đã cập nhật ✓");
      }
    } finally { setSaving(false); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/salary/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranchId, month, year }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        showToast("Lỗi xuất Excel: " + (err.error ?? `HTTP ${res.status}`));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename\*=UTF-8''(.+)/);
      a.href = url;
      a.download = match ? decodeURIComponent(match[1]) : `bang-luong-thang-${month}-${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const ptRecords    = records.filter(r => ["FREE", "RESTRICTED", "PT"].includes(r.user.role));
  const adminRecords = records.filter(r => r.user.role === "ADMIN");
  const fmRecord     = records.find(r => r.user.role === "FM");
  const totalFund      = records.reduce((s, r) => s + r.totalSalary, 0);
  const totalPaid      = records.filter(r => r.status === "PAID").reduce((s, r) => s + r.totalSalary, 0);
  const totalRemaining = records.reduce((s, r) => s + r.remainingPayment, 0);

  const numInput = "h-8 w-20 rounded-lg border border-gray-200 bg-white px-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

  function sessionImgCell(r: SalaryRecord) {
    const imgs = r.sessionImages ? (JSON.parse(r.sessionImages) as string[]) : [];
    return (
      <td className="px-3 py-2.5 whitespace-nowrap">
        {imgs.length > 0 ? (
          <button
            onClick={() => setImgModal({ recordId: r.id, ptName: r.user.name ?? r.user.email, images: imgs, mode: "view" })}
            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors text-xs font-semibold"
          >
            🖼️ {imgs.length} ảnh
          </button>
        ) : (
          <button
            onClick={() => setImgModal({ recordId: r.id, ptName: r.user.name ?? r.user.email, images: [], mode: "upload" })}
            className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
          >
            📎 Thêm ảnh
          </button>
        )}
      </td>
    );
  }

  // ── Reusable session count info card for generate modal ──────────────────
  function SessionCountCard({ entry }: { entry: GenEntry }) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-blue-400 mb-1">L1/L2/Loyal</p>
            <p className="text-xl font-extrabold text-blue-700">
              {fetchingCounts ? "…" : entry.showsL1L2Loyal}
            </p>
            <p className="text-[10px] text-blue-400">buổi × 60,000đ</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-purple-400 mb-1">L3/L4/L5</p>
            <p className="text-xl font-extrabold text-purple-700">
              {fetchingCounts ? "…" : entry.showsL3L4L5}
            </p>
            <p className="text-[10px] text-purple-400">buổi × 100,000đ</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-semibold text-green-400 mb-1">Tiền buổi dạy</p>
            <p className="text-sm font-extrabold text-green-700">
              {fetchingCounts ? "…" : vnd(entry.showsL1L2Loyal * 60_000 + entry.showsL3L4L5 * 100_000)}
            </p>
            <p className="text-[10px] text-green-400">từ WorkoutLog</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleOverride(entry.userId)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold transition-colors",
            overrideIds.has(entry.userId) ? "text-orange-500 hover:text-orange-600" : "text-gray-400 hover:text-gray-600",
          )}
        >
          {overrideIds.has(entry.userId)
            ? <><ChevronUp className="w-3.5 h-3.5" /> Đang override — click để dùng lại auto</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Override thủ công</>
          }
        </button>

        {overrideIds.has(entry.userId) && (
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Show L1/L2/Loyal", field: "showsL1L2Loyal" as const },
              { label: "Show L3/L4/L5",    field: "showsL3L4L5"   as const },
            ] as const).map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">{label}</label>
                <input
                  type="number" min={0}
                  value={entry[field] as number}
                  onChange={e => updateEntry(entry.userId, field, parseInt(e.target.value) || 0)}
                  className={numInput + " w-full text-left"}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Chi nhánh:</label>
            <select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30">
              {isCOO && <option value="">Tất cả cơ sở</option>}
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {[
            { label: "Tháng:", value: month, set: setMonth, opts: Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: `Tháng ${i + 1}` })) },
            { label: "Năm:",   value: year,  set: setYear,  opts: [2024, 2025, 2026, 2027].map(y => ({ v: y, l: String(y) })) },
          ].map(({ label, value, set, opts }) => (
            <div key={label} className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">{label}</label>
              <select value={value} onChange={e => set(Number(e.target.value))}
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30">
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            {records.length > 0 && (
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-60 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </button>
            )}
            {!isCOO && (
              <button onClick={openGenModal} disabled={!selectedBranchId}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}>
                <RefreshCw className="w-4 h-4" />
                Tạo bảng lương tháng
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Tổng quỹ lương", value: vnd(totalFund),      color: "text-[#f15b5c]" },
            { label: "Đã thanh toán",  value: vnd(totalPaid),       color: "text-green-600" },
            { label: "Còn phải trả",   value: vnd(totalRemaining),  color: "text-yellow-600" },
            { label: "Số nhân sự",     value: `${records.length} người`, color: "text-gray-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
              <p className={cn("text-lg font-extrabold", color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Đang tải...</div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-10 text-center text-sm text-gray-400 italic">
          Chưa có bảng lương — nhấn &ldquo;Tạo bảng lương tháng&rdquo; để bắt đầu.
        </div>
      ) : (
        <>
          {/* PT table */}
          {ptRecords.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xs font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">PT</span>
                <p className="text-sm font-extrabold text-gray-700">Bảng lương PT — tháng {month}/{year}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f5] border-b border-gray-200">
                      {["Nhân viên","Lương CB","Thâm niên","Doanh số","% HH","Tiền HH","Thưởng MT","Tổng lương","Tạm ứng","Còn lại","Trạng thái","Ảnh","Hành động","Chi tiết"].map(h => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ptRecords.map(r => (
                      <React.Fragment key={r.id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50/50 divide-x divide-gray-100">
                          <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.user.name ?? r.user.email}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.baseSalary)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {r.seniorityBonus > 0 ? (
                              <span className="inline-flex flex-col gap-0.5">
                                <span className="font-semibold text-gray-700">{Math.round(r.seniorityBonus / 6_000_000)} năm</span>
                                <span className="text-[10px] text-gray-400">{vnd(r.seniorityBonus)}</span>
                              </span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.totalRevenue)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{r.commissionRate}%</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.commissionAmount)}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.goalBonus)}</td>
                          <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: "#f15b5c" }}>{vnd(r.totalSalary)}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.advancePaid)}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-700 whitespace-nowrap">{vnd(r.remainingPayment)}</td>
                          <td className="px-3 py-2.5">
                            <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap", STATUS_COLORS[r.status])}>
                              {STATUS_LABELS[r.status]}
                            </span>
                          </td>
                          {sessionImgCell(r)}
                          <ActionCell r={r} editingId={editingId}
                            onEdit={() => editingId === r.id ? setEditingId(null) : (setEditingId(r.id), setEditAdvance(String(r.advancePaid)), setEditNotes(r.notes ?? ""))}
                            onStatus={handleStatusChange} />
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button
                              onClick={() => toggleDetail(r.id)}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors",
                                expandedIds.has(r.id)
                                  ? "bg-[#f15b5c]/10 text-[#f15b5c]"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              )}
                            >
                              {expandedIds.has(r.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                        {editingId === r.id && (
                          <EditRow colSpan={14} editAdvance={editAdvance} editNotes={editNotes} saving={saving}
                            onAdvance={setEditAdvance} onNotes={setEditNotes} onSave={handleSaveEdit} />
                        )}
                        {expandedIds.has(r.id) && (
                          <tr>
                            <td colSpan={14} className="px-4 py-3 bg-[#fdf8f8] border-b border-gray-100">
                              <SessionDetailTable
                                ptId={r.user.id}
                                ptName={r.user.name ?? r.user.email}
                                month={month}
                                year={year}
                                canEdit
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-2 text-[10px] text-gray-400 italic border-t border-gray-50">
                * % doanh thu áp dụng theo bậc toàn bộ doanh số tháng
              </p>
            </div>
          )}

          {/* Admin table */}
          {adminRecords.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Admin</span>
                <p className="text-sm font-extrabold text-gray-700">Bảng lương Quản lý dạy thêm — tháng {month}/{year}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f5] border-b border-gray-200">
                      {["Nhân viên","Vai trò","Lương cứng","Doanh số","% HH","Hoa hồng","Buổi dạy","Tiền dạy","Tổng lương","Tạm ứng","Còn lại","Trạng thái","Ảnh","Hành động","Chi tiết"].map(h => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminRecords.map(r => (
                      <React.Fragment key={r.id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50/50 divide-x divide-gray-100">
                          <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{r.user.name ?? r.user.email}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600">Admin</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">—</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.totalRevenue)}</td>
                          <td className="px-3 py-2.5 text-gray-600">{r.commissionRate}%</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.commissionAmount)}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                            {r.showsL1L2Loyal}L1/L2 + {r.showsL3L4L5}L3+
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.showPay)}</td>
                          <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: "#f15b5c" }}>{vnd(r.totalSalary)}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(r.advancePaid)}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-700 whitespace-nowrap">{vnd(r.remainingPayment)}</td>
                          <td className="px-3 py-2.5">
                            <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap", STATUS_COLORS[r.status])}>
                              {STATUS_LABELS[r.status]}
                            </span>
                          </td>
                          {sessionImgCell(r)}
                          <ActionCell r={r} editingId={editingId}
                            onEdit={() => editingId === r.id ? setEditingId(null) : (setEditingId(r.id), setEditAdvance(String(r.advancePaid)), setEditNotes(r.notes ?? ""))}
                            onStatus={handleStatusChange} />
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button
                              onClick={() => toggleDetail(r.id)}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors",
                                expandedIds.has(r.id)
                                  ? "bg-[#f15b5c]/10 text-[#f15b5c]"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              )}
                            >
                              {expandedIds.has(r.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                        {editingId === r.id && (
                          <EditRow colSpan={15} editAdvance={editAdvance} editNotes={editNotes} saving={saving}
                            onAdvance={setEditAdvance} onNotes={setEditNotes} onSave={handleSaveEdit} />
                        )}
                        {expandedIds.has(r.id) && (
                          <tr>
                            <td colSpan={15} className="px-4 py-3 bg-[#fdf8f8] border-b border-gray-100">
                              <SessionDetailTable
                                ptId={r.user.id}
                                ptName={r.user.name ?? r.user.email}
                                month={month}
                                year={year}
                                canEdit
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FM edit row colSpan placeholder — FM table uses 15 cols */}

          {/* FM table */}
          {fmRecord && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">FM</span>
                <p className="text-sm font-extrabold text-gray-700">Bảng lương FM — tháng {month}/{year}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f5f5f5] border-b border-gray-200">
                      {["Nhân viên","Lương cố định","Thâm niên","DS phòng","% HH","Tiền HH","Google","Renew","Tổng lương","Tạm ứng","Còn lại","Trạng thái","Ảnh","Hành động"].map(h => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <React.Fragment key={fmRecord.id}>
                      <tr className="border-b border-gray-100 hover:bg-gray-50/50 divide-x divide-gray-100">
                        <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{fmRecord.user.name ?? fmRecord.user.email}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(fmRecord.baseSalary + fmRecord.fixedAllowances)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {fmRecord.seniorityBonus > 0 ? (
                            <span className="inline-flex flex-col gap-0.5">
                              <span className="font-semibold text-gray-700">{Math.round(fmRecord.seniorityBonus / 9_000_000)} năm</span>
                              <span className="text-[10px] text-gray-400">{vnd(fmRecord.seniorityBonus)}</span>
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(fmRecord.totalRevenue)}</td>
                        <td className="px-3 py-2.5 text-gray-600">{fmRecord.commissionRate}%</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(fmRecord.commissionAmount)}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(fmRecord.googleBonus)}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(fmRecord.renewBonus)}</td>
                        <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: "#f15b5c" }}>{vnd(fmRecord.totalSalary)}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{vnd(fmRecord.advancePaid)}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-700 whitespace-nowrap">{vnd(fmRecord.remainingPayment)}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap", STATUS_COLORS[fmRecord.status])}>
                            {STATUS_LABELS[fmRecord.status]}
                          </span>
                        </td>
                        {sessionImgCell(fmRecord)}
                        <ActionCell r={fmRecord} editingId={editingId}
                          onEdit={() => editingId === fmRecord.id ? setEditingId(null) : (setEditingId(fmRecord.id), setEditAdvance(String(fmRecord.advancePaid)), setEditNotes(fmRecord.notes ?? ""))}
                          onStatus={handleStatusChange} />
                      </tr>
                      {editingId === fmRecord.id && (
                        <EditRow colSpan={14} editAdvance={editAdvance} editNotes={editNotes} saving={saving}
                          onAdvance={setEditAdvance} onNotes={setEditNotes} onSave={handleSaveEdit} />
                      )}
                    </React.Fragment>
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-2 text-[10px] text-gray-400 italic border-t border-gray-50">
                * Giới hạn 60 show dạy/tháng | Thưởng Renew từ lần mua thứ 2 trở đi
              </p>
            </div>
          )}
        </>
      )}

      {/* Generate modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="text-base font-extrabold text-gray-800">Tạo bảng lương tháng {month}/{year}</p>
              <button onClick={() => setShowGenModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {genEntries.map(entry => (
                <div key={entry.userId} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      entry.userRole === "FM"    ? "bg-purple-100 text-purple-600" :
                      entry.userRole === "ADMIN" ? "bg-orange-100 text-orange-600" :
                                                   "bg-blue-100 text-blue-600",
                    )}>
                      {entry.userRole === "ADMIN" ? "Admin" : entry.userRole}
                    </span>
                    <p className="text-sm font-semibold text-gray-700">{entry.name}</p>
                  </div>

                  <SessionCountCard entry={entry} />

                  {/* FM-specific extra inputs */}
                  {entry.userRole === "FM" && (
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                      {([
                        { label: "Google Review",   field: "googleReviews"  as const },
                        { label: "Hợp đồng Renew",  field: "renewContracts" as const },
                      ] as const).map(({ label, field }) => (
                        <div key={field} className="space-y-1">
                          <label className="text-xs font-semibold text-gray-500">{label}</label>
                          <input
                            type="number" min={0}
                            value={entry[field] as number}
                            onChange={e => updateEntry(entry.userId, field, parseInt(e.target.value) || 0)}
                            className={numInput + " w-full text-left"}
                          />
                        </div>
                      ))}
                      <p className="col-span-2 text-[10px] text-gray-400">Tối đa 60 show dạy/tháng</p>
                    </div>
                  )}

                  {/* PT-specific extra input */}
                  {entry.userRole === "PT" && (
                    <div className="pt-1 border-t border-gray-100">
                      <div className="space-y-1 max-w-[180px]">
                        <label className="text-xs font-semibold text-gray-500">KH đạt mục tiêu</label>
                        <input
                          type="number" min={0}
                          value={entry.clientsAchievedGoal}
                          onChange={e => updateEntry(entry.userId, "clientsAchievedGoal", parseInt(e.target.value) || 0)}
                          className={numInput + " w-full text-left"}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowGenModal(false)}
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleGenerate} disabled={generating || fetchingCounts}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                style={{ backgroundColor: "#f15b5c" }}>
                <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
                {generating ? "Đang tạo..." : fetchingCounts ? "Đang tính buổi dạy..." : "Xác nhận tạo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session image modal */}
      {imgModal && (
        <SessionImageModal
          recordId={imgModal.recordId}
          ptName={imgModal.ptName}
          month={month}
          year={year}
          initialImages={imgModal.images}
          mode={imgModal.mode}
          initialIndex={imgModal.initialIndex}
          canEdit
          onClose={() => setImgModal(null)}
          onSaved={newImages => {
            setRecords(prev => prev.map(r =>
              r.id === imgModal.recordId
                ? { ...r, sessionImages: newImages.length > 0 ? JSON.stringify(newImages) : null }
                : r
            ));
            setImgModal(null);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionCell({ r, editingId, onEdit, onStatus }: {
  r: SalaryRecord;
  editingId: string | null;
  onEdit: () => void;
  onStatus: (id: string, s: string) => void;
}) {
  return (
    <td className="px-3 py-2.5 whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        {r.status === "PENDING" && (
          <button onClick={() => onStatus(r.id, "CONFIRMED")}
            className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100 transition-colors">
            Xác nhận
          </button>
        )}
        {r.status === "CONFIRMED" && (
          <button onClick={() => onStatus(r.id, "PAID")}
            className="px-2 py-1 rounded-lg bg-green-50 text-green-600 text-[10px] font-bold hover:bg-green-100 transition-colors">
            Đã trả
          </button>
        )}
        <button onClick={onEdit}
          className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold hover:bg-gray-200 transition-colors">
          {editingId === r.id ? "Đóng" : "Sửa"}
        </button>
      </div>
    </td>
  );
}

function EditRow({ colSpan, editAdvance, editNotes, saving, onAdvance, onNotes, onSave }: {
  colSpan: number; editAdvance: string; editNotes: string; saving: boolean;
  onAdvance: (v: string) => void; onNotes: (v: string) => void; onSave: () => void;
}) {
  return (
    <tr className="bg-amber-50/50 border-b border-gray-100">
      <td colSpan={colSpan} className="px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Tạm ứng (đ)</label>
            <input type="number" step="100000" value={editAdvance} onChange={e => onAdvance(e.target.value)}
              className="h-9 w-36 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30" />
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-500">Ghi chú</label>
            <input value={editNotes} onChange={e => onNotes(e.target.value)}
              className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30"
              placeholder="Ghi chú..." />
          </div>
          <button onClick={onSave} disabled={saving}
            className="h-9 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ backgroundColor: "#f15b5c" }}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </td>
    </tr>
  );
}
