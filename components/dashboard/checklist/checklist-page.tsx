"use client";

import { useState, useRef, useEffect } from "react";
import { CheckSquare, Bell, ClipboardList, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyTab } from "./daily-tab";
import { WeeklyReportTab } from "./weekly-report";
import { ChecklistMonthlyStats } from "./monthly-stats";

export type StaffMember = { id: string; name: string | null; email: string; branchId: string | null; role: string };

type Props = {
  currentUserId:    string;
  currentUserName:  string;
  currentUserRole:  string;
  staffList:        StaffMember[];
  managedBranchIds: string[];
  isAdmin?:         boolean;
};

export function ChecklistPage({ currentUserId, currentUserName, currentUserRole, staffList, isAdmin }: Props) {
  const isFM = currentUserRole === "FM";
  // Monthly performance view is for managers (FM/Admin) only.
  const showMonthly = isFM || !!isAdmin;
  type View = "daily" | "weekly" | "monthly";
  const [view, setView] = useState<View>("daily");

  // Ai cũng có Check-list ngày + Báo cáo tuần; Thống kê tháng chỉ dành cho quản lý.
  const tabs: { key: View; label: string; icon: typeof ClipboardList }[] = [
    { key: "daily",  label: "Check-list ngày", icon: ClipboardList },
    { key: "weekly", label: "Báo cáo tuần",    icon: FileText },
    ...(showMonthly ? [{ key: "monthly" as const, label: "Thống kê tháng", icon: BarChart3 }] : []),
  ];

  // Admin test notifications
  const [testLoading, setTestLoading] = useState(false);
  const [testMsg, setTestMsg]         = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function handleTestNotifications() {
    setTestLoading(true);
    setTestMsg("");
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/notifications/checklist-reminder", { method: "POST" }),
        fetch("/api/notifications/checklist-report",   { method: "POST" }),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setTestMsg(`✅ Xong! Nhắc nhở: ${d1.created ?? 0} PT | Báo cáo FM: ${d2.created ?? 0} FM`);
    } catch {
      setTestMsg("❌ Có lỗi xảy ra");
    } finally {
      setTestLoading(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setTestMsg(""), 5000);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#f15b5c]/10">
              <CheckSquare className="w-5 h-5 text-[#f15b5c]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Check-list Nhân sự</h1>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">
                {isFM || isAdmin ? `Quản lý ${staffList.length} nhân sự` : currentUserName}
              </p>
            </div>
          </div>

          {/* Admin-only test button */}
          {isAdmin && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleTestNotifications}
                disabled={testLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:border-[#f15b5c] hover:text-[#f15b5c] transition-colors disabled:opacity-50"
              >
                <Bell className="w-3.5 h-3.5" />
                {testLoading ? "Đang gửi..." : "🔔 Test gửi thông báo ngay"}
              </button>
              {testMsg && (
                <p className="text-xs font-semibold text-gray-600">{testMsg}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top-level view switcher */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap",
                view === key
                  ? "border-[#f15b5c] text-[#f15b5c]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-8 py-6">
        {showMonthly && view === "monthly" ? (
          <ChecklistMonthlyStats />
        ) : view === "weekly" ? (
          <WeeklyReportTab
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            staffList={staffList}
          />
        ) : (
          <DailyTab
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            staffList={staffList}
          />
        )}
      </div>
    </div>
  );
}
