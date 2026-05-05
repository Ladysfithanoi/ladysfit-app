import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD

  const dayStart = date ? new Date(`${date}T00:00:00`) : (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  })();
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);

  const logs = await prisma.foodScanLog.findMany({
    where: { clientId: session.user.id, scanDate: { gte: dayStart, lt: dayEnd } },
    orderBy: { scanDate: "asc" },
  });

  return NextResponse.json(
    logs.map((l) => ({ ...l, scanDate: l.scanDate.toISOString() }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { foodName, quantity, calories, protein, fat, carbs, imageUrl } = body;

  const log = await prisma.foodScanLog.create({
    data: {
      clientId: session.user.id,
      foodName,
      quantity: quantity ?? "",
      calories: Number(calories),
      protein: Number(protein),
      fat: Number(fat),
      carbs: Number(carbs),
      imageUrl: imageUrl ?? null,
    },
  });

  return NextResponse.json({ ...log, scanDate: log.scanDate.toISOString() });
}
