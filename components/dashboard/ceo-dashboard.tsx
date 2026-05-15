"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type BranchSummary = {
  branchId: string;
  branchName: string;
  fm: string | null;
  revenueTarget: number;
  revenueActual: number;
  revenuePct: number;
  fitTarget: number;
  fitActual: number;
  transformTarget: number;
  transformActual: number;
  googleTarget: number;
  googleActual: number;
};

type StaffMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  branch: { id: string; name: string } | null;
};

function pctColor(pct: number) {
  if (pct >= 100) return "text-emerald-600 bg-emerald-50";
  if (pct >= 70) return "text-yellow-600 bg-yellow-50";
  return "text-red-500 bg-red-50";
}

const ROLE_LABEL: Record<string, string> = {
  FM: "FM (Fitness Manager)",
  PT: "Huấn luyện viên",
  ADMIN: "Admin",
  CEO_FITPARTNER: "CEO Fitpartner",
  COO: "COO",
};

export function CEODashboard({ month, year }: { month: number; year: number }) {
  const [summary, setSummary] = useState<BranchSummary[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [selMonth, setSelMonth] = useState(month);
  const [selYear, setSelYear] = useState(year);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [s, st] = await Promise.all([
        fetch(`/api/setup/ceo-summary?month=${selMonth}&year=${selYear}`).then((r) => r.json()),
        fetch("/api/staff").then((r) => r.json()),
      ]);
      setSummary(Array.isArray(s) ? s : []);
      setStaff(Array.isArray(st) ? st : []);
      setLoading(false);
    }
    load();
  }, [selMonth, selYear]);

  const chartData = summary.map((b) => ({
    name: b.branchName,
    "Mục tiêu": b.revenueTarget,
    "Thực đạt": b.revenueActual,
  }));

  const branches = Array.from(new Set(staff.map((s) => s.branch?.id).filter(Boolean)));
  const filteredStaff = branchFilter
    ? staff.filter((s) => s.branch?.id === branchFilter)
    : staff;
  const branchNames = Object.fromEntries(
    staff.map((s) => [s.branch?.id, s.branch?.name]).filter(([k]) => k)
  );

  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">CEO Fitpartner Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tổng quan doanh số và nhân sự toàn hệ thống</p>
        </div>
        <div className="flex gap-2">
          <select value={selMonth} onChange={(e) => setSelMonth(parseInt(e.target.value))}
            className="h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white">
            {months.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
          <select value={selYear} onChange={(e) => setSelYear(parseInt(e.target.value))}
            className="h-9 rounded-xl border border-gray-200 px-3 text-sm bg-white">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Đang tải...</div>
      ) : (
        <>
          {/* Revenue table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-extrabold text-gray-800">
                Setup Doanh số — Tổng hợp tháng {selMonth}/{selYear}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Cơ sở", "FM", "DS Mục tiêu (tr)", "DS Thực đạt (tr)", "%", "FIT Đạt", "Transform Đạt", "Google Đạt"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-bold text-gray-400 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-300">Chưa có dữ liệu</td></tr>
                  ) : summary.map((b) => (
                    <tr key={b.branchId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                      <td className="px-4 py-3 font-semibold text-gray-800">{b.branchName}</td>
                      <td className="px-4 py-3 text-gray-500">{b.fm ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{b.revenueTarget.toFixed(1)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{b.revenueActual.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", pctColor(b.revenuePct))}>
                          {b.revenuePct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{b.fitActual}/{b.fitTarget}</td>
                      <td className="px-4 py-3 text-gray-600">{b.transformActual}/{b.transformTarget}</td>
                      <td className="px-4 py-3 text-gray-600">{b.googleActual}/{b.googleTarget}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-extrabold text-gray-800 mb-4">Doanh số: Mục tiêu vs Thực đạt</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barGap={4}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => typeof v === "number" ? `${v.toFixed(1)} tr` : v} />
                  <Legend />
                  <Bar dataKey="Mục tiêu" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Thực đạt" fill="#f15b5c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Staff list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-sm font-extrabold text-gray-800">Nhân sự toàn hệ thống</p>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white"
              >
                <option value="">Tất cả cơ sở</option>
                {branches.map((bid) => (
                  <option key={bid} value={bid!}>{branchNames[bid!] ?? bid}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Họ tên", "Email", "Cấp độ", "Cơ sở"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-bold text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                      <td className="px-4 py-2.5 font-semibold text-gray-800">{s.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500">{s.email}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                          {ROLE_LABEL[s.role] ?? s.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{s.branch?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
