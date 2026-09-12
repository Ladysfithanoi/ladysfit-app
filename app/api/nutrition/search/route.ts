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

  // Khớp TỪNG CHỮ, không khớp nguyên cụm.
  //
  // Khớp nguyên cụm thì gõ "cơm lứt" ra rỗng, trong khi kho có "Cơm gạo lứt (chén)"
  // — người dùng gọi món theo cách nói của mình chứ không thuộc lòng tên trong kho.
  // Tách chữ rồi bắt buộc có đủ, nên thứ tự gõ thế nào cũng ra và gõ thêm chữ thì
  // kết quả hẹp lại chứ không mất sạch.
  const words = query.trim().split(/[ 	]+/).filter(Boolean).slice(0, 6);

  const foods = await prisma.food.findMany({
    where: { AND: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) },
    take: 30,
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
