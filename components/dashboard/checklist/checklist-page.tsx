"use client";

import { useState, useRef, useEffect } from "react";
import { CheckSquare, FileBarChart, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { DailyTab } from "./daily-tab";
import { ReportTab } from "./report-tab";

export type StaffMember = { id: string; name: string | null; email: string; branchId: string | null; role: string };

type Props = {
  currentUserId:    string;
  currentUserName:  string;
  currentUserRole:  string;
  staffList:        StaffMember[];
  managedBranchIds: string[];
  isAdmin?:         boolean;
};

const TABS = [
  { key: "daily",  label: "Check-list ngày",    icon: CheckSquare },
  { key: "report", label: "Báo cáo tuần/tháng", icon: FileBarChart },
] as const;

type TabKey = typeof TABS[number]["key"];

export function ChecklistPage({ currentUserId, currentUserName, currentUserRole, staffList, isAdmin }: Props) {
  const [tab, setTab] = useState<TabKey>("daily");
  const isFM = currentUserRole === "FM";

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
        <div className="flex items-center justify-between gap-3 mb-4">
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

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === key ? "bg-white text-[#f15b5c] shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-3 sm:px-8 py-6">
        {tab === "daily" && (
          <DailyTab
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            staffList={staffList}
          />
        )}
        {tab === "report" && (
          <ReportTab
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
