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
  return NextResponse.json(config ?? { id: "main", enableLevelSystem: true });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { enableLevelSystem } = (await req.json()) as { enableLevelSystem: boolean };

  const config = await prisma.systemConfig.upsert({
    where: { id: "main" },
    update: { enableLevelSystem },
    create: { id: "main", enableLevelSystem },
  });

  return NextResponse.json(config);
}
