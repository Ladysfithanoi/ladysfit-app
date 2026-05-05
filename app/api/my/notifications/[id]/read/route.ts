import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function PUT(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.workoutNotification.updateMany({
    where: { id: params.id, clientId: session.user.id },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
