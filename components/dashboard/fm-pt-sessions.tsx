"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { BarChart2, Users, Trophy, TrendingUp, Minus, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type PTSessionRow = {
  ptId:         string;
  ptName:       string;
  branchName:   string;
  sessionCount: number;
  clientCount:  number;
};

type DetailSession = {
  date:        string;
  sessionName: string;
  phase:       string;
  notes:       string | null;
};

type DetailClient = {
  clientId:    string;
  clientName:  string;
  packageName: string;
  sessions:    DetailSession[];
};

type DetailData = {
  ptName:  string;
  clients: DetailClient[];
};

type Branch = { id: string; name: string };

const MONTHS = [
  "Tháng 1","Tháng 2","Tháng 3","Tháng 4",
  "Tháng 5","Tháng 6","Tháng 7","Tháng 8",
  "Tháng 9","Tháng 10","Tháng 11","Tháng 12",
];
const YEARS = [2024, 2025, 2026];
const L1_L2_LOYAL = new Set(["L1", "L2", "Loyalfit"]);

function vnd(n: number) { return n.toLocaleString("vi-VN") + "đ"; }

// ── Chart tooltip ──────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: PTSessionRow }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs font-semibold">
      <p className="text-gray-700 font-bold mb-1">{row.ptName}</p>
      <p className="text-[#f15b5c]">{row.sessionCount} buổi dạy</p>
      <p className="text-gray-400">{row.clientCount} khách hàng</p>
    </div>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────

function PTSessionDetailModal({
  ptId, ptName, month, year, onClose,
}: {
  ptId: string; ptName: string; month: number; year: number; onClose: () => void;
}) {
  const [data, setData]       = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/pt-session-detail?ptId=${ptId}&month=${month}&year=${year}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ptId, month, year]);

  // Keyboard close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalSessions = data?.clients.reduce((s, c) => s + c.sessions.length, 0) ?? 0;
  const estimatedPay  = data?.clients.reduce((s, c) => {
    const rate = L1_L2_LOYAL.has(c.packageName) ? 60_000 : 100_000;
    return s + c.sessions.length * rate;
  }, 0) ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-base font-extrabold text-gray-900">Chi tiết buổi dạy</p>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              {ptName} — Tháng {String(month).padStart(2, "0")}/{year}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400 animate-pulse">Đang tải...</div>
          ) : !data || data.clients.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400 italic">
              Không có buổi dạy nào trong tháng này
            </div>
          ) : (
            data.clients.map((client, ci) => (
              <div key={client.clientId}>
                {ci > 0 && <div className="border-t border-gray-100 mb-4" />}

                {/* Client header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-extrabold text-[#f15b5c]">
                      {client.clientName[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-gray-800">{client.clientName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {client.packageName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {client.packageName}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-gray-400">
                        Tổng buổi tháng này: {client.sessions.length} buổi
                      </span>
                    </div>
                  </div>
                </div>

                {/* Session table */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide w-10">STT</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">Ngày tập</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide">Buổi</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide">Giai đoạn</th>
                        <th className="px-3 py-2.5 text-left font-bold text-gray-400 uppercase tracking-wide">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.sessions.map((s, si) => (
                        <tr key={si} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                          <td className="px-3 py-2.5 text-gray-400 font-bold text-center">{si + 1}</td>
                          <td className="px-3 py-2.5 text-gray-600 font-semibold whitespace-nowrap">{s.date}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-semibold">{s.sessionName}</td>
                          <td className="px-3 py-2.5 text-gray-500">{s.phase}</td>
                          <td className="px-3 py-2.5 text-gray-400 max-w-[180px] truncate" title={s.notes ?? ""}>
                            {s.notes || <span className="text-gray-200">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary footer */}
        {!loading && data && data.clients.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 bg-gray-50/50 rounded-b-2xl">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xl font-extrabold text-gray-900">{data.clients.length}</p>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">Tổng số KH</p>
              </div>
              <div className="text-center border-x border-gray-200">
                <p className="text-xl font-extrabold text-gray-900">{totalSessions}</p>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">Tổng buổi dạy</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold" style={{ color: "#f15b5c" }}>{vnd(estimatedPay)}</p>
                <p className="text-xs font-semibold text-gray-400 mt-0.5">Tiền buổi dạy ước tính</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function FMPTSessions({ branches }: { branches: Branch[] }) {
  const now = new Date();
  const [branchId, setBranchId]   = useState("");
  const [selectedPT, setSelectedPT] = useState("");
  const [month, setMonth]  = useState(now.getMonth() + 1);
  const [year, setYear]    = useState(now.getFullYear());
  const [data, setData]    = useState<PTSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailModal, setDetailModal] = useState<{ ptId: string; ptName: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelectedPT("");
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    if (branchId) params.set("branchId", branchId);
    fetch(`/api/dashboard/pt-sessions?${params}`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [branchId, month, year]);

  const ptNames  = useMemo(() => Array.from(new Set(data.map(d => d.ptName))), [data]);
  const filtered = useMemo(
    () => (selectedPT ? data.filter(d => d.ptName === selectedPT) : data),
    [data, selectedPT]
  );

  const totalSessions = filtered.reduce((s, r) => s + r.sessionCount, 0);
  const top    = filtered[0] ?? null;
  const bottom = filtered.length > 1 ? filtered[filtered.length - 1] : null;
  const avg    = filtered.length > 0 ? Math.round(totalSessions / filtered.length) : 0;
  const chartHeight = Math.max(180, filtered.length * 48);

  const summaryCards = [
    { title: "Tổng buổi dạy",      value: totalSessions, unit: "buổi",    Icon: BarChart2,  iconBg: "bg-[#f15b5c]/10", iconColor: "text-[#f15b5c]" },
    { title: "PT dạy nhiều nhất",   value: top?.sessionCount ?? 0,    unit: "buổi", sub: top?.ptName ?? "—",    Icon: Trophy,     iconBg: "bg-amber-50",   iconColor: "text-amber-500" },
    { title: "PT dạy ít nhất",      value: bottom?.sessionCount ?? (top?.sessionCount ?? 0), unit: "buổi", sub: bottom?.ptName ?? top?.ptName ?? "—", Icon: Minus, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
    { title: "Trung bình",          value: avg,           unit: "buổi/PT", Icon: TrendingUp, iconBg: "bg-green-50",   iconColor: "text-green-500" },
  ];

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Users className="w-4 h-4 text-[#f15b5c]" />
          <h2 className="text-base font-extrabold text-gray-900">Thống kê buổi dạy theo tháng</h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3">
            {[
              { value: branchId, onChange: setBranchId, opts: [{ v: "", l: "Tất cả cơ sở" }, ...branches.map(b => ({ v: b.id, l: b.name }))] },
              { value: selectedPT, onChange: setSelectedPT, disabled: ptNames.length === 0,
                opts: [{ v: "", l: "Tất cả PT" }, ...ptNames.map(n => ({ v: n, l: n }))] },
              { value: month, onChange: (v: string) => setMonth(Number(v)),
                opts: MONTHS.map((l, i) => ({ v: String(i + 1), l })) },
              { value: year, onChange: (v: string) => setYear(Number(v)),
                opts: YEARS.map(y => ({ v: String(y), l: String(y) })) },
            ].map((sel, si) => (
              <select key={si} value={String(sel.value)}
                onChange={e => sel.onChange(e.target.value)}
                disabled={(sel as { disabled?: boolean }).disabled}
                className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer disabled:opacity-50"
              >
                {sel.opts.map(o => <option key={String(o.v)} value={String(o.v)}>{o.l}</option>)}
              </select>
            ))}
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <p className="text-sm text-gray-400 font-semibold animate-pulse">Đang tải...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 border-2 border-dashed border-gray-100 rounded-xl">
              <BarChart2 className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-300 font-semibold">Không có dữ liệu trong tháng này</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map(({ title, value, unit, sub, Icon, iconBg, iconColor }) => (
                  <div key={title} className="bg-gray-50/60 rounded-xl p-4 border border-gray-100">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", iconBg)}>
                      <Icon className={cn("w-4 h-4", iconColor)} />
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                      {value}<span className="text-sm font-semibold text-gray-400 ml-1">{unit}</span>
                    </p>
                    <p className="text-xs text-gray-400 font-semibold mt-0.5">{title}</p>
                    {sub && <p className="text-xs font-bold text-gray-600 mt-0.5 truncate" title={sub}>{sub}</p>}
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              <div className="bg-gray-50/40 rounded-xl p-4 border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Biểu đồ buổi dạy</p>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart layout="vertical" data={filtered} barSize={22}
                    margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 600 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="ptName" axisLine={false} tickLine={false}
                      tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }} width={110} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#fafafa" }} />
                    <Bar dataKey="sessionCount" radius={[0, 8, 8, 0]}>
                      {filtered.map((_, i) => <Cell key={i} fill="#f15b5c" fillOpacity={1 - i * 0.06} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {["STT","Tên PT","Cơ sở","Số buổi dạy","Số KH","TB buổi/KH","Chi tiết"].map((h, i) => (
                        <th key={h} className={cn(
                          "px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                          i <= 1 ? "text-left" : "text-center"
                        )}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => {
                      const avgPerClient = row.clientCount > 0
                        ? (row.sessionCount / row.clientCount).toFixed(1)
                        : "—";
                      return (
                        <tr key={row.ptId}
                          className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
                          <td className="px-4 py-3 text-sm font-bold text-gray-400 text-center w-10">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#f15b5c]/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-extrabold text-[#f15b5c]">
                                  {row.ptName[0]?.toUpperCase() ?? "?"}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-gray-800">{row.ptName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">{row.branchName}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-extrabold bg-[#f15b5c]/10 text-[#f15b5c] min-w-[2.5rem]">
                              {row.sessionCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-blue-50 text-blue-600 min-w-[2.5rem]">
                              {row.clientCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-bold text-gray-700">{avgPerClient}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setDetailModal({ ptId: row.ptId, ptName: row.ptName })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border"
                              style={{ color: "#f15b5c", borderColor: "#f15b5c" }}
                            >
                              <Search className="w-3 h-3" />
                              Xem thêm
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {detailModal && (
        <PTSessionDetailModal
          ptId={detailModal.ptId}
          ptName={detailModal.ptName}
          month={month}
          year={year}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
}
