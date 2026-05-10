import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchFoods } from "@/lib/usda";
import { searchLocalFoods } from "@/lib/vietnamese-foods";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function translateNames(
  names: string[],
  apiKey: string
): Promise<{ en: string; vi: string }[]> {
  if (names.length === 0) return [];

  const prompt = `Dịch các tên thực phẩm sau sang tiếng Việt ngắn gọn, tự nhiên.
Trả về JSON array với format: [{"en": "tên tiếng Anh", "vi": "tên tiếng Việt"}]
Chỉ trả về JSON, không giải thích.

Thực phẩm: ${names.join(", ")}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) return names.map((en) => ({ en, vi: en }));
    const data = await res.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    return Array.isArray(parsed) ? parsed : names.map((en) => ({ en, vi: en }));
  } catch {
    return names.map((en) => ({ en, vi: en }));
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  if (!query.trim()) return NextResponse.json([]);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  // Local Vietnamese foods (no translation needed)
  const localMatches = searchLocalFoods(query).map((f) => ({
    isLocal: true,
    nameEn: f.nameEn,
    nameVi: f.nameVi,
    brandOwner: "",
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
  }));

  // USDA search
  let usdaFoods: {
    isLocal: boolean;
    fdcId: number;
    nameEn: string;
    nameVi: string;
    brandOwner: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[] = [];

  try {
    const usdaResult = await searchFoods(query, 8);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foods: any[] = usdaResult.foods || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simplified = foods.map((f: any) => ({
      isLocal: false,
      fdcId: f.fdcId as number,
      nameEn: f.description as string,
      nameVi: f.description as string,
      brandOwner: (f.brandOwner as string) || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      calories: f.foodNutrients?.find((n: any) => n.nutrientName === "Energy")?.value || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      protein: f.foodNutrients?.find((n: any) => n.nutrientName === "Protein")?.value || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      carbs: f.foodNutrients?.find((n: any) => n.nutrientName?.includes("Carbohydrate"))?.value || 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fat: f.foodNutrients?.find((n: any) => n.nutrientName?.includes("Total lipid"))?.value || 0,
    }));

    if (simplified.length > 0) {
      const names = simplified.map((f) => f.nameEn);
      const translations = await translateNames(names, apiKey);
      simplified.forEach((food, i) => {
        food.nameVi = translations[i]?.vi || food.nameEn;
      });
    }

    usdaFoods = simplified;
  } catch {
    // USDA unavailable — return local results only
  }

  // Local results first, then USDA (dedupe by nameEn)
  const localNames = new Set(localMatches.map((f) => f.nameEn.toLowerCase()));
  const filteredUsda = usdaFoods.filter(
    (f) => !localNames.has(f.nameEn.toLowerCase())
  );

  return NextResponse.json([...localMatches, ...filteredUsda]);
}
