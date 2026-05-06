import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; logId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as Role;
  if (role !== "ADMIN" && role !== "FM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.bodyMeasurementLog.delete({ where: { id: params.logId } });
  return NextResponse.json({ success: true });
}
