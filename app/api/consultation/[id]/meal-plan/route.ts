import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.consultation.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { tdee, der, protein, fat, carbs, mealsPerDay, likes, dislikes, meals } = body;

  // Remove any unlinked meal plan for this consultation
  await prisma.mealPlan.deleteMany({ where: { consultationId: params.id, clientId: null } });

  const plan = await prisma.mealPlan.create({
    data: {
      consultationId: params.id,
      clientId: null,
      tdee,
      der,
      protein,
      fat,
      carbs,
      mealsPerDay,
      likes: likes || null,
      dislikes: dislikes || null,
      createdById: session.user.id,
      days: {
        create: {
          dayLabel: "Thực đơn mẫu",
          meals: JSON.stringify(meals),
          totalCalories: meals.reduce((s: number, m: { calories: number }) => s + m.calories, 0),
          totalProtein:  meals.reduce((s: number, m: { protein: number }) => s + m.protein, 0),
          totalFat:      meals.reduce((s: number, m: { fat: number }) => s + m.fat, 0),
          totalCarbs:    meals.reduce((s: number, m: { carbs: number }) => s + m.carbs, 0),
        },
      },
    },
    include: { days: true },
  });

  return NextResponse.json({
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    days: plan.days.map((d) => ({ ...d, meals: JSON.parse(d.meals), createdAt: d.createdAt.toISOString() })),
  });
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string };
    console.error("[consultation/meal-plan POST]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await prisma.mealPlan.findFirst({
    where: { consultationId: params.id },
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
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string };
    console.error("[consultation/meal-plan GET]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
