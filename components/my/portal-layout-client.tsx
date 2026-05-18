"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, Scale, Dumbbell, Salad, Ruler, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkoutNotificationPopup } from "./workout-notification-popup";

const NAV = [
  { href: "/my",              label: "Tổng quan",  Icon: Home  },
  { href: "/my/weight",       label: "Cân nặng",   Icon: Scale },
  { href: "/my/activity",     label: "Tập luyện",  Icon: Dumbbell },
  { href: "/my/measurements", label: "Số đo",      Icon: Ruler },
  { href: "/my/nutrition",    label: "Dinh dưỡng", Icon: Salad    },
  { href: "/my/settings",     label: "Cài đặt",    Icon: Settings },
] as const;

export function PortalLayoutClient({
  clientName,
  avatarUrl,
  children,
}: {
  clientName: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await signOut({ redirect: false, callbackUrl: "/my/login" });
    router.push("/my/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WorkoutNotificationPopup />
      {/* Outer centering wrapper */}
      <div className="mx-auto max-w-[430px] min-h-screen bg-white flex flex-col relative shadow-sm">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-8 h-8 rounded-xl object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[#f15b5c] flex items-center justify-center">
                <span className="text-sm font-black text-white">L</span>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold text-gray-400 leading-none">LADYSFIT</p>
              <p className="text-sm font-extrabold text-gray-900 leading-tight">
                Xin chào, {clientName.split(" ").pop()}! 👋
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-gray-400 hover:text-[#f15b5c] hover:bg-[#f15b5c]/5 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
          {children}
        </main>

        {/* Bottom navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-white border-t border-gray-100">
          <div className="grid grid-cols-6 w-full justify-items-center py-2">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-1 w-full transition-colors",
                    active ? "text-[#f15b5c]" : "text-gray-400"
                  )}
                >
                  <Icon className={cn("w-5 h-5", active && "fill-[#f15b5c]/15")} />
                  <span className={cn("whitespace-nowrap text-[9px] tracking-tight font-medium", active ? "text-[#f15b5c]" : "text-gray-400")}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
