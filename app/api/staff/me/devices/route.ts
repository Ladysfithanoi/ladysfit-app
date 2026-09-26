import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { handleDevicesRequest } from "@/lib/login-device";

// Thiết bị đang đăng nhập tài khoản nhân sự — xem & đăng xuất từ xa.
async function handler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handleDevicesRequest(req, "STAFF", session.user.id, session.user.deviceId);
}

export { handler as GET, handler as DELETE };
