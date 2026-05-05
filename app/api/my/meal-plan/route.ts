import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await prisma.mealPlan.findFirst({
    where: { clientId: session.user.id, status: "ACTIVE" },
    include: { days: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  if (!plan) return NextResponse.json(null);

  return NextResponse.json({
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    days: plan.days.map((d) => ({ ...d, meals: JSON.parse(d.meals), createdAt: d.createdAt.toISOString() })),
  });
}
