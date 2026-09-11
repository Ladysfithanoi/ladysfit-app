import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callGemini, getGeminiKeys } from "@/lib/gemini";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { foods } = (await req.json()) as { foods: string[] };
  if (!Array.isArray(foods) || foods.length === 0) return NextResponse.json([]);

  const apiKeys = getGeminiKeys();
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY" }, { status: 500 });
  }

  const prompt = `Dịch các tên thực phẩm sau sang tiếng Việt ngắn gọn, tự nhiên.
Trả về JSON array với format: [{"en": "tên tiếng Anh", "vi": "tên tiếng Việt"}]
Chỉ trả về JSON, không giải thích.

Thực phẩm: ${foods.join(", ")}`;

  const res = await callGemini(
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    },
    apiKeys
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }

  const data = await res.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

  try {
    const translations = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    return NextResponse.json(Array.isArray(translations) ? translations : []);
  } catch {
    return NextResponse.json([]);
  }
}
