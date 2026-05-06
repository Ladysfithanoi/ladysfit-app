"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, TrendingUp, TrendingDown, Percent, BarChart2, ArrowDownCircle, ArrowUpCircle, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverviewTab } from "./overview-tab";
import { IncomeTab } from "./income-tab";
import { ExpenseTab } from "./expense-tab";
import { CashflowTab } from "./cashflow-tab";

export type Branch = { id: string; name: string };

type Props = {
  branches: Branch[];
  currentUserId: string;
  currentUserRole: string;
  managedBranchIds: string[];
  isReadOnly: boolean;
};

type Summary = {
  totalIncome:  number;
  totalExpense: number;
  profit:       number;
  profitRate:   number;
  byCategory:   { type: string; category: string; total: number }[];
};

const vnd = (n: number) => {
  const abs = Math.abs(n);
  return (n < 0 ? "-" : "") + abs.toLocaleString("vi-VN") + "đ";
};

const TABS = [
  { key: "overview",  label: "Tổng quan",  icon: BarChart2        },
  { key: "income",    label: "Thu",         icon: ArrowDownCircle  },
  { key: "expense",   label: "Chi",         icon: ArrowUpCircle    },
  { key: "cashflow",  label: "Dòng tiền",   icon: Waves            },
] as const;
type TabKey = typeof TABS[number]["key"];

export function FinancePage({ branches, currentUserId, isReadOnly }: Props) {
  const now = new Date();
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id ?? "");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [tab,   setTab]   = useState<TabKey>("overview");
  const [summary, setSummary] = useState<Summary | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!selectedBranchId) return;
    const res = await fetch(`/api/finance/summary?branchId=${selectedBranchId}&month=${month}&year=${year}`);
    if (res.ok) setSummary(await res.json());
  }, [selectedBranchId, month, year]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const SUMMARY_CARDS = summary ? [
    {
      label:   "Tổng thu",
      value:   vnd(summary.totalIncome),
      sub:     `Tháng ${month}/${year}`,
      color:   "#10b981",
      bg:      "bg-emerald-50",
      icon:    TrendingUp,
    },
    {
      label:   "Tổng chi",
      value:   vnd(summary.totalExpense),
      sub:     `Tháng ${month}/${year}`,
      color:   "#ef4444",
      bg:      "bg-red-50",
      icon:    TrendingDown,
    },
    {
      label:   "Lợi nhuận",
      value:   (summary.profit >= 0 ? "+" : "") + vnd(summary.profit),
      sub:     "= Thu - Chi",
      color:   summary.profit >= 0 ? "#3b82f6" : "#ef4444",
      bg:      summary.profit >= 0 ? "bg-blue-50" : "bg-red-50",
      icon:    DollarSign,
    },
    {
      label:   "Tỉ suất LN",
      value:   summary.profitRate.toFixed(1) + "%",
      sub:     "Lợi nhuận / Doanh thu",
      color:   summary.profitRate >= 0 ? "#8b5cf6" : "#ef4444",
      bg:      "bg-violet-50",
      icon:    Percent,
    },
  ] : null;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-emerald-50">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Thu Chi</h1>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Quản lý dòng tiền</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {branches.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Chi nhánh:</label>
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">Tháng:</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">Năm:</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mt-4">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === key ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* Summary cards */}
        {SUMMARY_CARDS && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {SUMMARY_CARDS.map(({ label, value, sub, color, bg, icon: Icon }) => (
              <div key={label} className={cn("rounded-2xl p-5 border border-gray-100 bg-white shadow-sm")}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
                  <div className={cn("p-2 rounded-xl", bg)}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
                <p className="text-lg font-extrabold text-gray-900 leading-tight" style={{ color }}>{value}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab content */}
        {tab === "overview" && (
          <OverviewTab
            branchId={selectedBranchId}
            month={month}
            year={year}
            summary={summary}
          />
        )}
        {tab === "income" && (
          <IncomeTab
            branchId={selectedBranchId}
            month={month}
            year={year}
            isReadOnly={isReadOnly}
            currentUserId={currentUserId}
            onMutate={fetchSummary}
          />
        )}
        {tab === "expense" && (
          <ExpenseTab
            branchId={selectedBranchId}
            month={month}
            year={year}
            isReadOnly={isReadOnly}
            currentUserId={currentUserId}
            onMutate={fetchSummary}
          />
        )}
        {tab === "cashflow" && (
          <CashflowTab
            branchId={selectedBranchId}
            month={month}
            year={year}
          />
        )}
      </div>

    </div>
  );
}
