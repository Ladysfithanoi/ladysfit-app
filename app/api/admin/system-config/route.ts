import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.systemConfig.findUnique({ where: { id: "main" } });
  return NextResponse.json(config ?? { id: "main", enableLevelSystem: true, minSessionMinutes: 30 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    enableLevelSystem?: boolean;
    minSessionMinutes?: number;
    practicalPassPercent?: number;
  };

  // Build a partial update so callers can change either field independently.
  const update: { enableLevelSystem?: boolean; minSessionMinutes?: number; practicalPassPercent?: number } = {};
  if (typeof body.enableLevelSystem === "boolean") update.enableLevelSystem = body.enableLevelSystem;
  if (typeof body.minSessionMinutes === "number" && body.minSessionMinutes > 0) {
    update.minSessionMinutes = Math.round(body.minSessionMinutes);
  }
  if (typeof body.practicalPassPercent === "number" && body.practicalPassPercent > 0 && body.practicalPassPercent <= 100) {
    update.practicalPassPercent = Math.round(body.practicalPassPercent);
  }

  const config = await prisma.systemConfig.upsert({
    where: { id: "main" },
    update,
    create: {
      id: "main",
      enableLevelSystem: update.enableLevelSystem ?? true,
      minSessionMinutes: update.minSessionMinutes ?? 30,
      practicalPassPercent: update.practicalPassPercent ?? 70,
    },
  });

  return NextResponse.json(config);
}
