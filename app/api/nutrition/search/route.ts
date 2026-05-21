import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
