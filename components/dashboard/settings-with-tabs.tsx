"use client";

import { useState } from "react";
import { Building2, Images, Layers, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsPageClient } from "./settings-page-client";
import { TransformPhotosTab } from "./transform-photos-tab";
import { PhasesTab } from "./phases-tab";
import { PTLevelsTab } from "./pt-levels-tab";

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  _count: { users: number; clients: number };
};

const TABS = [
  { key: "branches",  label: "Cơ sở",        icon: Building2   },
  { key: "phases",    label: "Giai đoạn",     icon: Layers      },
  { key: "transform", label: "Ảnh Transform", icon: Images      },
  { key: "ptlevels",  label: "Cấp độ PT",     icon: ShieldCheck },
] as const;

type TabKey = typeof TABS[number]["key"];

export function SettingsWithTabs({ initialBranches }: { initialBranches: BranchRow[] }) {
  const [tab, setTab] = useState<TabKey>("branches");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
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

      {tab === "branches" && (
        <SettingsPageClient initialBranches={initialBranches} />
      )}
      {tab === "phases" && (
        <PhasesTab />
      )}
      {tab === "transform" && (
        <TransformPhotosTab />
      )}
      {tab === "ptlevels" && (
        <PTLevelsTab />
      )}
    </div>
  );
}
