import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await prisma.mealPlan.findMany({
    where: { clientId: params.id },
    include: { days: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    plans.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      days: p.days.map((d) => ({
        ...d,
        meals: JSON.parse(d.meals),
        createdAt: d.createdAt.toISOString(),
      })),
    }))
  );
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tdee, der, protein, fat, carbs, mealsPerDay, likes, dislikes, meals } = body;

  // Archive existing active plans
  await prisma.mealPlan.updateMany({
    where: { clientId: params.id, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });

  const plan = await prisma.mealPlan.create({
    data: {
      clientId: params.id,
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
}
