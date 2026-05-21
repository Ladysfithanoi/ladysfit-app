"use client";

import { useState } from "react";
import { Building2, Images, ShieldCheck, BookOpen, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsPageClient } from "./settings-page-client";
import { TransformPhotosTab } from "./transform-photos-tab";
import { PTLevelsTab } from "./pt-levels-tab";
import { UserGuidesTab } from "./user-guides-tab";
import { FoodManagementTab } from "./food-management-tab";

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  _count: { users: number; clients: number };
};

const TABS = [
  { key: "branches",  label: "Cơ sở",              icon: Building2   },
  { key: "foods",     label: "Quản lý Thực phẩm",  icon: Utensils    },
  { key: "transform", label: "Ảnh Transform",       icon: Images      },
  { key: "ptlevels",  label: "Cấp độ PT",           icon: ShieldCheck },
  { key: "guides",    label: "Hướng dẫn",           icon: BookOpen    },
] as const;

type TabKey = typeof TABS[number]["key"];

export function SettingsWithTabs({ initialBranches }: { initialBranches: BranchRow[] }) {
  const [tab, setTab] = useState<TabKey>("branches");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-row items-center gap-2 overflow-x-auto whitespace-nowrap pb-2 w-full bg-gray-100 p-1 rounded-xl mb-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
              tab === key ? "bg-white text-[#f15b5c] shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "branches"  && <SettingsPageClient initialBranches={initialBranches} />}
      {tab === "foods"     && <FoodManagementTab />}
      {tab === "transform" && <TransformPhotosTab />}
      {tab === "ptlevels"  && <PTLevelsTab />}
      {tab === "guides"    && <UserGuidesTab />}
    </div>
  );
}
