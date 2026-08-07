"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, UserCircle, Settings, ClipboardList,
  Dumbbell, FileText, BarChart2, MessageSquareWarning, TrendingUp, CheckSquare, Wallet, DollarSign, X, BookOpen, Award, Trophy, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ─── Role helpers ─────────────────────────────────────────────────────────────

type Role = string | undefined;

const isAdmin  = (r: Role) => r === "ADMIN";
const isFM     = (r: Role) => r === "FM";
const isCEO    = (r: Role) => r === "CEO_FITPARTNER";
const isCOO    = (r: Role) => r === "COO";

const forAll        = () => true;
const forAdminFMCEO = (r: Role) => isAdmin(r) || isFM(r) || isCEO(r) || isCOO(r);
const forAdminFM    = (r: Role) => isAdmin(r) || isFM(r);
const forAdminOnly  = (r: Role) => isAdmin(r);
const forNotCEO     = (r: Role) => !isCEO(r) && !isCOO(r);
const forFMandPT    = (r: Role) => isFM(r) || r === "PT";
/** Nhân sự vận hành phòng tập — những vai trò có chấm ngày công. */
const forStaff      = (r: Role) => isAdmin(r) || isFM(r) || r === "PT";

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavItem = { href: string; icon: LucideIcon; label: string; show: (r: Role) => boolean };
type NavSection = { header?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    header: "THỐNG KÊ",
    items: [
      { href: "/dashboard",          icon: LayoutDashboard,      label: "Tổng quan",          show: forAll },
      { href: "/dashboard/ranking",  icon: Trophy,                label: "Xếp hạng",           show: forNotCEO },
      { href: "/dashboard/reports",  icon: BarChart2,             label: "Transform",          show: forAdminFMCEO },
      { href: "/dashboard/setup",    icon: TrendingUp,            label: "Setup Doanh số",     show: forAll },
    ],
  },
  {
    header: "DỮ LIỆU PHÒNG TẬP",
    items: [
      { href: "/dashboard/consultation", icon: ClipboardList, label: "Tư vấn",     show: forNotCEO },
      { href: "/dashboard/clients",      icon: Users,         label: "Khách hàng", show: forNotCEO },
      { href: "/dashboard/staff",        icon: UserCircle,    label: "Nhân sự",    show: forNotCEO },
    ],
  },
  {
    header: "DỮ LIỆU NHÂN SỰ",
    items: [
      { href: "/dashboard/checklist", icon: CheckSquare, label: "Check-list Nhân sự", show: forFMandPT },
      { href: "/dashboard/practical", icon: Award,       label: "Thăng hạng", show: forAdminFM },
    ],
  },
  {
    header: "LỊCH",
    items: [
      { href: "/dashboard/leave", icon: CalendarDays, label: "Lịch nghỉ", show: forStaff },
    ],
  },
  {
    header: "TÀI CHÍNH",
    items: [
      { href: "/dashboard/salary",  icon: Wallet,     label: "Quỹ lương", show: (r) => forFMandPT(r) || isCOO(r) },
      { href: "/dashboard/finance", icon: DollarSign, label: "Thu Chi",   show: (r) => isFM(r) || isCEO(r) || isCOO(r) },
    ],
  },
  {
    header: "DỮ LIỆU NỘI BỘ",
    items: [
      { href: "/dashboard/exercises", icon: Dumbbell,  label: "Danh sách bài tập", show: forAdminOnly },
      { href: "/dashboard/exam",      icon: FileText,   label: "Đề thi",            show: forAdminOnly },
      { href: "/dashboard/guides",    icon: BookOpen,   label: "Hướng dẫn",         show: forAll       },
    ],
  },
  {
    // standalone — no section header
    items: [
      { href: "/dashboard/complaints", icon: MessageSquareWarning, label: "Khiếu nại",        show: isFM },
      { href: "/dashboard/settings",   icon: Settings,             label: "Cài đặt",          show: forAdminOnly },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-100 z-50 flex flex-col",
        "transition-transform duration-300 ease-in-out",
        // Mobile: controlled by isOpen; desktop: always visible
        isOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0",
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100 flex-shrink-0">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="text-2xl font-extrabold text-[#f15b5c] tracking-tight flex-1 hover:opacity-80 transition-opacity"
        >
          Ladysfit
        </Link>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-4">
          {NAV_SECTIONS.map((section, si) => {
            const visible = section.items.filter((item) => item.show(role));
            if (visible.length === 0) return null;
            return (
              <div key={si}>
                {section.header && (
                  <p className="px-3 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {section.header}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visible.map(({ href, icon: Icon, label }) => {
                    const isActive =
                      href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                          isActive
                            ? "bg-[#f15b5c] text-white shadow-sm shadow-[#f15b5c]/25"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-300 font-medium">v10.0</p>
      </div>
    </aside>
  );
}
