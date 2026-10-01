import { NextResponse } from "next/server";
import { sendCheckoutReminders } from "@/lib/checkout-push";

// Mỗi 5 phút: đẩy thông báo nhắc ký check-out tới điện thoại PT/FM, kể cả khi
// app đang đóng. Xem lib/checkout-push.ts.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendCheckoutReminders());
}
