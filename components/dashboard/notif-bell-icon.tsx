"use client";

import { Bell, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Chuông đặc kiểu điện thoại cho mọi nút thông báo trên navbar. Loại thông báo
// (khiếu nại, số đo, check-list…) hiện thành ký hiệu nhỏ ở góc dưới để vẫn
// phân biệt được khi có nhiều chuông cạnh nhau.
export function NotifBellIcon({
  badge: BadgeIcon,
  ringing,
  className,
}: {
  badge?: LucideIcon;
  ringing?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex w-5 h-5", className)}>
      <Bell
        className={cn("w-5 h-5", ringing && "animate-bell-ring")}
        fill="currentColor"
        strokeWidth={1.75}
      />
      {BadgeIcon && (
        <span className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-white ring-1 ring-gray-200 flex items-center justify-center">
          <BadgeIcon className="w-2 h-2 text-gray-600" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}
