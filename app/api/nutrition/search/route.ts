import { NextResponse } from "next/server";
import { getNutritionActor } from "@/lib/nutrition-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // Dùng chung cho dashboard lẫn cổng khách — khách tự soạn thực đơn được.
  const actor = await getNutritionActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  if (!query.trim()) return NextResponse.json([]);

  const foods = await prisma.food.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    take: 20,
    orderBy: { name: "asc" },
  });

  const results = foods.map((f) => ({
    id: f.id,
    isLocal: true,
    nameEn: f.name,
    nameVi: f.name,
    brandOwner: "",
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    weight_g: f.weight_g,
    category: f.category,
    meal_type: f.meal_type,
  }));

  return NextResponse.json(results);
}
