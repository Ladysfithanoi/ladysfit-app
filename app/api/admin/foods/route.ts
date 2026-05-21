import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const foods = await prisma.food.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(foods);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, calories, protein, carbs, fat, weight_g, category, meal_type } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Tên món ăn là bắt buộc" }, { status: 400 });
  }

  const food = await prisma.food.create({
    data: {
      name: name.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      weight_g: Number(weight_g) || 100,
      category: category?.trim() || null,
      meal_type: meal_type?.trim() || null,
    },
  });
  return NextResponse.json(food, { status: 201 });
}
