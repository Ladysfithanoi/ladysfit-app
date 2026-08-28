import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generatePackageProgressNotifications } from "@/lib/package-progress";

// Quét hằng ngày các lộ trình đang chạy và bắn thông báo cho FM ở những mốc vừa
// đạt. Mốc theo NGÀY TẬP chỉ đổi theo thời gian nên bắt buộc phải có cron; mốc
// theo SỐ BUỔI đã được bắn ngay lúc check-in, cron chỉ là lưới hứng cho những
// lần check-in lỗi hoặc số buổi được sửa tay.
//
// Chạy tay được bằng tài khoản Admin (mở thẳng URL) để kiểm tra.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await generatePackageProgressNotifications();
  return NextResponse.json(result);
}
