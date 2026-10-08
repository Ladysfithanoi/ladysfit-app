"use client";

import { createContext, useContext } from "react";
import { useSession } from "next-auth/react";

export type DashboardUser = { role: string; name: string | null; email: string | null };

const ServerUserContext = createContext<DashboardUser | null>(null);

/** Người đang đăng nhập, đọc từ phiên phía server lúc dựng layout /dashboard. */
export const ServerUserProvider = ServerUserContext.Provider;

/**
 * Vai trò / tên của người đang đăng nhập cho thanh bên và navbar.
 *
 * Chỉ dựa vào useSession() thì lúc phiên phía trình duyệt chưa tải xong (mạng
 * chậm, app vừa mở lại trên điện thoại) hoặc tải hụt — kể cả khi phiên bị lẫn
 * sang cổng khách /my — vai trò trống, và mọi mục chỉ dành cho Admin/FM/PT biến
 * mất khỏi thanh bên tới khi tải lại trang. Phiên server đã có sẵn ngay từ đầu,
 * nên lấy nó làm nền; phiên trình duyệt (khi có) vẫn được ưu tiên vì mới hơn.
 */
export function useDashboardUser(): DashboardUser | null {
  const server = useContext(ServerUserContext);
  const { data } = useSession();
  const live = data?.user;
  if (live?.role) {
    return { role: live.role, name: live.name ?? null, email: live.email ?? null };
  }
  return server;
}
