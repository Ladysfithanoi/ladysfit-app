import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // Vercel cron auth check
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.substituteRequest.updateMany({
    where: {
      status: "ACTIVE",
      type: "SHORT_TERM",
      endDate: { lt: new Date() },
    },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({ expired: result.count });
}
