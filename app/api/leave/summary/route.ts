import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageLeaveOf, countLeaveDaysByUser } from "@/lib/leave-days";

/**
 * Số ngày nghỉ trong tháng của nhiều nhân sự cùng lúc — modal tạo bảng lương
 * dùng để điền sẵn ngày công thực tế (chuẩn − nghỉ).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const ids   = (searchParams.get("userIds") ?? "").split(",").map(s => s.trim()).filter(Boolean);

  if (!(month >= 1 && month <= 12) || !(year >= 2020 && year <= 2100)) {
    return NextResponse.json({ error: "Tháng/năm không hợp lệ" }, { status: 400 });
  }
  if (ids.length === 0) return NextResponse.json({});

  // Chỉ trả về những người mà người gọi được xem lịch nghỉ.
  const allowedFlags = await Promise.all(ids.map(id => canManageLeaveOf(session.user, id)));
  const allowedIds   = ids.filter((_, i) => allowedFlags[i]);

  return NextResponse.json(await countLeaveDaysByUser(allowedIds, month, year));
}
