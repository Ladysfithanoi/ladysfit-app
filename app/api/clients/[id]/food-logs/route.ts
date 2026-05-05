import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.foodScanLog.findMany({
    where: { clientId: params.id },
    orderBy: { scanDate: "desc" },
    select: {
      id: true,
      scanDate: true,
      foodName: true,
      quantity: true,
      calories: true,
      protein: true,
      fat: true,
      carbs: true,
    },
  });

  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      scanDate: l.scanDate.toISOString(),
      foodName: l.foodName,
      quantity: l.quantity,
      calories: l.calories,
      protein: l.protein,
      fat: l.fat,
      carbs: l.carbs,
    }))
  );
}
