"use client";

import { useState } from "react";
import { Wallet, BarChart2, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SalaryTableTab } from "./salary-table-tab";
import { SalaryConfigTab } from "./salary-config-tab";
import { PtSalaryView } from "./pt-salary-view";
import { KOCFMPanel } from "./koc-fm-panel";

export type Branch = { id: string; name: string };
export type StaffMember = { id: string; name: string | null; email: string; branchId: string | null; role: string };

type Props = {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  managedBranchIds: string[];
  branches: Branch[];
  staffList: StaffMember[];
};

const FM_TABS = [
  { key: "table",  label: "Bảng lương tháng", icon: BarChart2 },
  { key: "koc",    label: "Hợp đồng KOC",      icon: Star },
  { key: "config", label: "Cấu hình lương",    icon: Settings },
] as const;
type FMTab = typeof FM_TABS[number]["key"];

export function SalaryPage({ currentUserId, currentUserName, currentUserRole, managedBranchIds, branches, staffList }: Props) {
  const isFM = currentUserRole === "FM";
  const [tab, setTab] = useState<FMTab>("table");

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-[#f15b5c]/10">
            <Wallet className="w-5 h-5 text-[#f15b5c]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Quỹ lương</h1>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              {isFM ? "Quản lý lương nhân sự" : currentUserName}
            </p>
          </div>
        </div>

        {isFM && (
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {FM_TABS.map(({ key, label, icon: Icon }) => (
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
        )}
      </div>

      <div className="px-8 py-6">
        {isFM ? (
          <>
            {tab === "table"  && (
              <SalaryTableTab
                branches={branches}
                managedBranchIds={managedBranchIds}
                staffList={staffList}
                currentFMId={currentUserId}
                currentFMName={currentUserName}
              />
            )}
            {tab === "koc" && <KOCFMPanel />}
            {tab === "config" && (
              <SalaryConfigTab
                branches={branches}
                staffList={staffList}
                currentFMId={currentUserId}
                currentFMName={currentUserName}
              />
            )}
          </>
        ) : (
          <PtSalaryView currentUserId={currentUserId} currentUserName={currentUserName} />
        )}
      </div>
    </div>
  );
}
