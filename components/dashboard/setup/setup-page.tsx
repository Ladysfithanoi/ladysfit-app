"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LeadsTab } from "./leads-tab";
import { TargetsTab } from "./targets-tab";
import { WeeklyReportTab } from "./weekly-report-tab";
import { ReportTab } from "./report-tab";
import { MonthlyStatsTab } from "./monthly-stats-tab";
import { PTUser, SOURCES, LEAD_STATUS_LABEL, LeadStatus } from "./types";

type Branch = { id: string; name: string };

type Props = {
  branches: Branch[];
  currentUserId: string;
  currentUserRole: string;
  userName: string;
  isReadOnly: boolean;
  ptBranchId: string | null;
  managedBranchIds: string[];
};

const TABS = [
  { key: "leads", label: "Bảng Setup" },
  { key: "targets", label: "Mục tiêu & KPI" },
  { key: "weeklyReport", label: "Báo cáo tuần" },
  { key: "report", label: "Báo cáo tháng" },
  { key: "stats", label: "Thống kê tháng" },
] as const;

type TabKey = "leads" | "targets" | "weeklyReport" | "report" | "stats";

const now = new Date();

export function SetupPage({ branches, currentUserId, currentUserRole, userName, isReadOnly, ptBranchId }: Props) {
  const [tab, setTab] = useState<TabKey>("leads");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [branchId, setBranchId] = useState(ptBranchId ?? branches[0]?.id ?? "");
  const [ptList, setPtList] = useState<PTUser[]>([]);
  const [selectedPTId, setSelectedPTId] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const isPT = currentUserRole === "PT";
  const isFM = currentUserRole === "FM";
  const isCEO = currentUserRole === "CEO_FITPARTNER";
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // Fetch PT list for filter dropdown (FM/CEO/ADMIN only)
  useEffect(() => {
    if (isPT || !branchId) return;
    setPtList([]);
    fetch(`/api/staff?branchId=${branchId}`)
      .then((r) => r.json())
      .then((data: (PTUser & { role: string })[]) =>
        setPtList(data.filter((u) => u.role === "FM" || u.role === "PT" || u.role === "ADMIN"))
      )
      .catch(() => {});
  }, [branchId, isPT]);

  // Reset lead filters when branch/month/year changes
  useEffect(() => {
    setSelectedPTId("");
    setSelectedSource("");
    setSelectedStatus("");
  }, [branchId, month, year]);

  const selectCls = "w-full h-9 rounded-xl border border-gray-200 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Setup Doanh số</h1>
          <p className="text-sm text-gray-400 mt-0.5">Quản lý lead, KPI và báo cáo doanh số</p>
        </div>
        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 w-full">
          {!isPT && branches.length > 1 && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectCls}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {/* Nhân sự filter — Tab 1 only, FM/CEO/ADMIN only */}
          {!isPT && tab === "leads" && ptList.some((u) => u.role === "PT" || u.role === "ADMIN") && (
            <select value={selectedPTId} onChange={(e) => setSelectedPTId(e.target.value)} className={selectCls}>
              <option value="">Tất cả nhân sự</option>
              {ptList.filter((u) => u.role === "PT" || u.role === "ADMIN").map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name ?? pt.email}</option>
              ))}
            </select>
          )}
          {/* Source filter — Tab 1 only */}
          {tab === "leads" && (
            <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} className={selectCls}>
              <option value="">Tất cả nguồn</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {/* Status filter — Tab 1 only */}
          {tab === "leads" && (
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className={selectCls}>
              <option value="">Tất cả tình trạng</option>
              {(["TAKECARE", "FAIL", "DE", "PIF", "PB"] as LeadStatus[]).map((s) => (
                <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
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
      <div className="flex flex-row items-center gap-2 overflow-x-auto pb-1 w-full bg-gray-100 p-1 rounded-xl mb-5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium flex-shrink-0 text-center whitespace-nowrap rounded-xl transition-all",
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
          currentUserName={userName}
          currentUserRole={currentUserRole}
          isReadOnly={isReadOnly}
          isPT={isPT}
          isFM={isFM}
          isCEO={isCEO}
          ptList={ptList}
          selectedPTId={selectedPTId}
          selectedSource={selectedSource}
          selectedStatus={selectedStatus}
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
          ptList={ptList}
        />
      )}
      {tab === "weeklyReport" && (
        <WeeklyReportTab
          branchId={branchId}
          branchName={branchName}
          month={month}
          year={year}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          userName={userName}
          isReadOnly={isReadOnly}
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
      {tab === "stats" && (
        <MonthlyStatsTab
          branchId={branchId}
          branchName={branchName}
          month={month}
          year={year}
        />
      )}
    </div>
  );
}
