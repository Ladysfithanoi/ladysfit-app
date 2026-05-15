import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isPT = role === "FREE" || role === "RESTRICTED" || role === "PT";
  if (!isPT) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const [record, config] = await Promise.all([
    prisma.salaryRecord.findFirst({ where: { userId: session.user.id, month, year } }),
    prisma.salaryConfig.findFirst({
      where: { userId: session.user.id },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  return NextResponse.json({ record, config });
}
