import { NextResponse } from "next/server";
import { runAutoPromotion } from "@/lib/pt-promotion";

// Quét định kỳ toàn bộ PT và tự thăng hạng ai đủ 4 điều kiện.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutoPromotion();
  return NextResponse.json({ promotedCount: result.promoted.length, promoted: result.promoted });
}
