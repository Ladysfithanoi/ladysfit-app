"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Users, TrendingUp, Package, AlertTriangle, CheckCircle, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

type SummaryData = {
  totalClients: number;
  activeClients: number;
  pausedClients: number;
  totalStaff: number;
  totalPackages: number;
  activePackages: number;
  monthlyNew: { month: string; count: number }[];
};

type PTRow = {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  activeClients: number;
  recentSessions: number;
  unreadAlerts: number;
};

const PT_PAGE_SIZE = 5;

type AlertRow = {
  id: string;
  alertType: "SLOW_PROGRESS" | "NO_WEIGH_IN";
  weekStart: string;
  expectedRate: number | null;
  actualRate: number | null;
  weeksAnalyzed: number | null;
  note: string | null;
  isRead: boolean;
  createdAt: string;
  client: { id: string; fullName: string };
  pt: { id: string; name: string | null };
};

const ALERT_LABEL: Record<string, string> = {
  SLOW_PROGRESS: "Tiến độ chậm",
  NO_WEIGH_IN: "Chưa cân",
};

const ALERT_COLOR: Record<string, string> = {
  SLOW_PROGRESS: "text-orange-600 bg-orange-50",
  NO_WEIGH_IN: "text-blue-600 bg-blue-50",
};

const PIE_COLORS = ["#f15b5c", "#d1d5db"];

export function ReportsPage({ userRole }: { userRole: string }) {
  const isAdmin = userRole === "ADMIN";

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [ptRows, setPtRows] = useState<PTRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ checked: number; created: number } | null>(null);

  // PT performance filters + pagination
  const [ptSearch, setPtSearch] = useState("");
  const [ptBranch, setPtBranch] = useState("");
  const [ptPage, setPtPage] = useState(1);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, a] = await Promise.all([
        fetch("/api/reports/summary").then((r) => r.json()),
        fetch("/api/reports/pt-performance").then((r) => r.json()),
        fetch("/api/reports/alerts").then((r) => r.json()),
      ]);
      setSummary(s);
      setPtRows(p);
      setAlerts(a);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setPtPage(1); }, [ptSearch, ptBranch]);

  async function runCheck() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/run-performance-check", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRunResult(data);
        await fetchAll();
      }
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-gray-400 font-semibold">Đang tải báo cáo...</p>
      </div>
    );
  }

  const pieData = [
    { name: "Đang hoạt động", value: summary?.activeClients ?? 0 },
    { name: "Tạm dừng", value: summary?.pausedClients ?? 0 },
  ];

  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const slowProgress = alerts.filter((a) => a.alertType === "SLOW_PROGRESS").length;
  const noWeighIn = alerts.filter((a) => a.alertType === "NO_WEIGH_IN").length;

  // PT performance: branch options + filtered + paginated
  const ptBranchOptions = useMemo(() => {
    const map = new Map<string, string>();
    ptRows.forEach((p) => { if (p.branchId) map.set(p.branchId, p.branchName); });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [ptRows]);

  const filteredPts = useMemo(() => {
    const q = ptSearch.trim().toLowerCase();
    return ptRows.filter(
      (p) =>
        (!ptBranch || p.branchId === ptBranch) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [ptRows, ptSearch, ptBranch]);

  const ptPageCount = Math.ceil(filteredPts.length / PT_PAGE_SIZE);
  const ptSafePage = Math.min(ptPage, ptPageCount || 1);
  const ptPageItems = filteredPts.slice((ptSafePage - 1) * PT_PAGE_SIZE, ptSafePage * PT_PAGE_SIZE);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Transform</h1>
          <p className="text-sm text-gray-400 mt-1">Tổng quan hoạt động và cảnh báo tiến độ</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            {runResult && (
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl">
                Đã kiểm tra {runResult.checked} KH · Tạo {runResult.created} cảnh báo
              </span>
            )}
            <button
              onClick={runCheck}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#f15b5c] disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              <RefreshCw className={cn("w-4 h-4", running && "animate-spin")} />
              {running ? "Đang kiểm tra..." : "Chạy kiểm tra tuần"}
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Tổng khách hàng", value: summary.totalClients, icon: Users, color: "text-[#f15b5c] bg-[#f15b5c]/10" },
            { label: "Đang hoạt động", value: summary.activeClients, icon: CheckCircle, color: "text-emerald-500 bg-emerald-50" },
            { label: "Gói tập active", value: summary.activePackages, icon: Package, color: "text-blue-500 bg-blue-50" },
            { label: "Cảnh báo chưa đọc", value: unreadAlerts.length, icon: AlertTriangle, color: "text-amber-500 bg-amber-50" },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", c.color)}>
                <c.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{c.value}</p>
                <p className="text-sm text-gray-400 font-semibold mt-0.5 truncate">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly new clients bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-extrabold text-gray-800 mb-4">Khách hàng mới theo tháng</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={summary?.monthlyNew ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af", fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs font-bold">
                      <p className="text-gray-400">{String(label)}</p>
                      <p className="text-gray-800">{payload[0].value} khách hàng mới</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="count" fill="#f15b5c" radius={[5, 5, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client status pie */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-extrabold text-gray-800 mb-4">Trạng thái khách hàng</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                  <p className="text-xs font-semibold text-gray-600">{d.name}</p>
                  <p className="text-xs font-extrabold text-gray-900 ml-auto pl-4">{d.value}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Alert type summary */}
          <div className="mt-4 pt-4 border-t border-gray-50 flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-xs text-gray-500">Tiến độ chậm: <strong>{slowProgress}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-gray-500">Chưa cân: <strong>{noWeighIn}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* PT performance table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-extrabold text-gray-800">Hiệu suất PT</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={ptSearch}
                onChange={(e) => setPtSearch(e.target.value)}
                placeholder="Tìm tên PT..."
                className="h-9 pl-9 pr-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 w-44"
              />
            </div>
            <select
              value={ptBranch}
              onChange={(e) => setPtBranch(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 cursor-pointer"
            >
              <option value="">Tất cả cơ sở</option>
              {ptBranchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        {ptRows.length === 0 ? (
          <div className="py-10 text-center">
            <TrendingUp className="w-6 h-6 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-300 font-semibold">Chưa có dữ liệu</p>
          </div>
        ) : filteredPts.length === 0 ? (
          <div className="py-10 text-center">
            <Search className="w-6 h-6 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-300 font-semibold">Không tìm thấy PT phù hợp</p>
          </div>
        ) : (
          <>
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {["PT", "Cơ sở", "KH đang hoạt động", "Buổi tập (30 ngày)", "Cảnh báo chưa đọc"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ptPageItems.map((pt) => (
                <tr key={pt.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-gray-800 whitespace-nowrap">{pt.name}</td>
                  <td className="px-5 py-3 text-gray-500 font-medium whitespace-nowrap">{pt.branchName}</td>
                  <td className="px-5 py-3 text-gray-600">{pt.activeClients}</td>
                  <td className="px-5 py-3 text-gray-600">{pt.recentSessions}</td>
                  <td className="px-5 py-3">
                    {pt.unreadAlerts > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        {pt.unreadAlerts}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 font-semibold">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <Pagination
            page={ptSafePage}
            pageCount={ptPageCount}
            total={filteredPts.length}
            pageSize={PT_PAGE_SIZE}
            onPageChange={setPtPage}
            itemLabel="PT"
          />
          </>
        )}
      </div>

      {/* Alerts table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-gray-800">Lịch sử cảnh báo tiến độ</h2>
          <span className="text-xs text-gray-400 font-semibold">{alerts.length} cảnh báo gần nhất</span>
        </div>
        {alerts.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle className="w-6 h-6 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-300 font-semibold">Chưa có cảnh báo</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {["Khách hàng", "Loại", "Chi tiết", "Tuần", "Nhân sự phụ trách", "Trạng thái"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {alerts.map((a) => (
                <tr key={a.id} className={cn("hover:bg-gray-50/50 transition-colors", !a.isRead && "bg-amber-50/30")}>
                  <td className="px-5 py-3 font-semibold text-gray-800">{a.client.fullName}</td>
                  <td className="px-5 py-3">
                    <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", ALERT_COLOR[a.alertType])}>
                      {ALERT_LABEL[a.alertType]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {a.alertType === "SLOW_PROGRESS" && a.actualRate != null && a.expectedRate != null ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-800">
                          TB: <span className="text-orange-600">{a.actualRate.toFixed(2)}%</span>/tuần
                          <span className="text-gray-400 font-normal"> · kỳ vọng ≥{a.expectedRate}%</span>
                        </p>
                        {a.weeksAnalyzed != null && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {a.weeksAnalyzed} tuần có đủ dữ liệu
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(a.weekStart).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{a.pt.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    {a.isRead ? (
                      <span className="text-xs text-gray-300 font-semibold">Đã đọc</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                        Chưa đọc
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
