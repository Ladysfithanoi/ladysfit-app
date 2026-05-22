import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; planId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await prisma.mealPlan.findUnique({ where: { id: params.planId } });
  if (!plan || plan.clientId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { tdee, der, protein, fat, carbs } = await req.json();

  const updated = await prisma.mealPlan.update({
    where: { id: params.planId },
    data: { tdee, der, protein, fat, carbs },
    include: { days: true },
  });

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    days: updated.days.map((d) => ({
      ...d,
      meals: JSON.parse(d.meals as string),
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; planId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await prisma.mealPlan.findUnique({ where: { id: params.planId } });
  if (!plan || plan.clientId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.mealPlan.update({
    where: { id: params.planId },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ ok: true });
}
