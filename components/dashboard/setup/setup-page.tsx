"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LeadsTab } from "./leads-tab";
import { TargetsTab } from "./targets-tab";
import { ReportTab } from "./report-tab";
import { PTUser } from "./types";

type Branch = { id: string; name: string };

type Props = {
  branches: Branch[];
  currentUserId: string;
  currentUserRole: string;
  isReadOnly: boolean;
  ptBranchId: string | null;
  managedBranchIds: string[];
};

const TABS = [
  { key: "leads", label: "Bảng Setup" },
  { key: "targets", label: "Mục tiêu & KPI" },
  { key: "report", label: "Báo cáo tháng" },
] as const;

type TabKey = "leads" | "targets" | "report";

const now = new Date();

export function SetupPage({ branches, currentUserId, currentUserRole, isReadOnly, ptBranchId }: Props) {
  const [tab, setTab] = useState<TabKey>("leads");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [branchId, setBranchId] = useState(ptBranchId ?? branches[0]?.id ?? "");
  const [ptList, setPtList] = useState<PTUser[]>([]);
  const [selectedPTId, setSelectedPTId] = useState("");

  const isPT = currentUserRole === "FREE" || currentUserRole === "RESTRICTED";
  const isFM = currentUserRole === "FM";
  const isCEO = currentUserRole === "CEO_FITPARTNER";
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // Fetch PT list for filter dropdown (FM/CEO/ADMIN only)
  useEffect(() => {
    if (isPT || !branchId) return;
    fetch(`/api/staff?branchId=${branchId}`)
      .then((r) => r.json())
      .then((data: (PTUser & { role: string })[]) =>
        setPtList(data.filter((u) => u.role === "FREE" || u.role === "RESTRICTED"))
      )
      .catch(() => {});
  }, [branchId, isPT]);

  // Reset PT filter when branch/month/year changes
  useEffect(() => {
    setSelectedPTId("");
  }, [branchId, month, year]);

  const selectCls = "h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Setup Doanh số</h1>
          <p className="text-sm text-gray-400 mt-0.5">Quản lý lead, KPI và báo cáo doanh số</p>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isPT && branches.length > 1 && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectCls}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {/* PT filter — Tab 1 only, FM/CEO/ADMIN only */}
          {!isPT && tab === "leads" && ptList.length > 0 && (
            <select value={selectedPTId} onChange={(e) => setSelectedPTId(e.target.value)} className={selectCls}>
              <option value="">Tất cả PT</option>
              {ptList.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name ?? pt.email}</option>
              ))}
            </select>
          )}
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={selectCls}>
            {months.map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={selectCls}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === key ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "leads" && (
        <LeadsTab
          branchId={branchId}
          branchName={branchName}
          month={month}
          year={year}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isReadOnly={isReadOnly}
          isPT={isPT}
          isFM={isFM}
          isCEO={isCEO}
          ptList={ptList}
          selectedPTId={selectedPTId}
        />
      )}
      {tab === "targets" && (
        <TargetsTab
          branchId={branchId}
          branchName={branchName}
          month={month}
          year={year}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          isReadOnly={isReadOnly}
          isPT={isPT}
          isFM={isFM}
        />
      )}
      {tab === "report" && (
        <ReportTab
          branchId={branchId}
          branchName={branchName}
          month={month}
          year={year}
          currentUserRole={currentUserRole}
          isPT={isPT}
        />
      )}
    </div>
  );
}
