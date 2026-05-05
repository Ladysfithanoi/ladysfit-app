import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = session.user.id;
  const now = new Date();

  console.log("Fetching notifications for client:", clientId);

  await prisma.workoutNotification.deleteMany({
    where: { clientId, expiresAt: { lt: now } },
  });

  const notifications = await prisma.workoutNotification.findMany({
    where: { clientId, isRead: false },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log("Notifications found:", notifications.length);

  return NextResponse.json(
    notifications.map((n) => ({
      id: n.id,
      message: n.message,
      nextSessionName: n.nextSessionName,
      nextSessionPhase: n.nextSessionPhase,
      expiresAt: n.expiresAt.toISOString(),
      createdAt: n.createdAt.toISOString(),
    }))
  );
}
