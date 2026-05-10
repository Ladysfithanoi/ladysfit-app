import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { foods } = (await req.json()) as { foods: string[] };
  if (!Array.isArray(foods) || foods.length === 0) return NextResponse.json([]);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const prompt = `Dịch các tên thực phẩm sau sang tiếng Việt ngắn gọn, tự nhiên.
Trả về JSON array với format: [{"en": "tên tiếng Anh", "vi": "tên tiếng Việt"}]
Chỉ trả về JSON, không giải thích.

Thực phẩm: ${foods.join(", ")}`;

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
