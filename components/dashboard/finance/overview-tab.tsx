"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
  type PieLabelRenderProps,
} from "recharts";

type Summary = {
  byCategory: { type: string; category: string; total: number }[];
} | null;

type Props = {
  branchId: string;
  month: number;
  year: number;
  summary: Summary;
};

type MonthRow = { month: number; income: number; expense: number; profit: number };

const vnd  = (n: number) => n.toLocaleString("vi-VN") + "đ";
const M    = 1_000_000;
const toM  = (n: number) => parseFloat((n / M).toFixed(2));

const MONTH_LABELS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

const INCOME_COLORS  = ["#10b981","#34d399","#6ee7b7","#a7f3d0","#d1fae5","#059669","#047857","#065f46"];
const EXPENSE_COLORS = ["#ef4444","#f87171","#fca5a5","#fecaca","#fee2e2","#dc2626","#b91c1c","#991b1b"];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {vnd(p.value * M)}
        </p>
      ))}
    </div>
  );
}

function PieLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, outerRadius, percent, name } = props;
  if (!cx || !cy || !midAngle || !outerRadius || !percent || percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = (outerRadius as number) + 24;
  const x = (cx as number) + r * Math.cos(-(midAngle as number) * RADIAN);
  const y = (cy as number) + r * Math.sin(-(midAngle as number) * RADIAN);
  return (
    <text x={x} y={y} textAnchor={x > (cx as number) ? "start" : "end"} dominantBaseline="central" fontSize={10} fill="#6b7280">
      {String(name)} ({((percent as number) * 100).toFixed(0)}%)
    </text>
  );
}

export function OverviewTab({ branchId, year, summary }: Props) {
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([]);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/finance/cashflow?branchId=${branchId}&year=${year}`)
      .then(r => r.ok ? r.json() : [])
      .then(setMonthlyData);
  }, [branchId, year]);

  const chartData = monthlyData.map(d => ({
    name:    MONTH_LABELS[d.month - 1],
    Thu:     toM(d.income),
    Chi:     toM(d.expense),
    "Lợi nhuận": toM(d.profit),
  }));

  const incomeByCategory  = summary?.byCategory.filter(b => b.type === "INCOME")  ?? [];
  const expenseByCategory = summary?.byCategory.filter(b => b.type === "EXPENSE") ?? [];

  return (
    <div className="space-y-5">
      {/* Monthly bar + line chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-sm font-extrabold text-gray-700 mb-5">Dòng tiền theo tháng — {year}</p>
        {chartData.every(d => d.Thu === 0 && d.Chi === 0) ? (
          <p className="text-center text-sm text-gray-400 italic py-8">Chưa có dữ liệu</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={v => `${v}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Thu"  fill="#10b981" radius={[4,4,0,0]} maxBarSize={32} />
              <Bar dataKey="Chi"  fill="#ef4444" radius={[4,4,0,0]} maxBarSize={32} />
              <Line type="monotone" dataKey="Lợi nhuận" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Income pie */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm font-extrabold text-gray-700 mb-4">Cơ cấu doanh thu</p>
          {incomeByCategory.length === 0 ? (
            <p className="text-center text-sm text-gray-400 italic py-6">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={incomeByCategory.map(c => ({ name: c.category, value: c.total }))}
                  cx="50%" cy="50%"
                  outerRadius={70}
                  labelLine={true}
                  label={PieLabel}
                >
                  {incomeByCategory.map((_, i) => (
                    <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => vnd(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense pie */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm font-extrabold text-gray-700 mb-4">Cơ cấu chi phí</p>
          {expenseByCategory.length === 0 ? (
            <p className="text-center text-sm text-gray-400 italic py-6">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={expenseByCategory.map(c => ({ name: c.category, value: c.total }))}
                  cx="50%" cy="50%"
                  outerRadius={70}
                  labelLine={true}
                  label={PieLabel}
                >
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => vnd(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
