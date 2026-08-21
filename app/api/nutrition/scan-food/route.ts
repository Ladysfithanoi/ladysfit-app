import { NextResponse } from "next/server";
import { getNutritionActor } from "@/lib/nutrition-auth";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// ~5 MB base64 ceiling (base64 is ~4/3 the raw size, so 5 MB raw ≈ 6.7 MB base64)
const MAX_BASE64_LENGTH = 7_000_000;

async function callGeminiWithRetry(
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status !== 503 || i === maxRetries - 1) return res;
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  // unreachable but satisfies TypeScript
  throw new Error("Retry loop exited unexpectedly");
}

export async function POST(req: Request) {
  // Dùng chung cho dashboard lẫn cổng khách — khách tự soạn thực đơn được.
  const actor = await getNutritionActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { base64Image, mimeType } = body as Record<string, unknown>;

  if (!base64Image || typeof base64Image !== "string") {
    return NextResponse.json({ error: "Missing image data" }, { status: 400 });
  }
  if (!mimeType || typeof mimeType !== "string") {
    return NextResponse.json({ error: "Missing MIME type" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (base64Image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Image too large (max 5 MB)" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const prompt = `Phân tích ảnh món ăn, ước tính dinh dưỡng.
TRẢ VỀ DUY NHẤT một JSON object với format:
{"name": "Tên món", "qty": "Khối lượng", "calories": số, "protein": số, "fat": số, "carbs": số}
Không thêm bất kỳ text nào khác.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.1,
    },
  };

  const geminiRes = await callGeminiWithRetry(`${GEMINI_URL}?key=${apiKey}`, payload);

  if (!geminiRes.ok) {
    if (geminiRes.status === 503) {
      return NextResponse.json({ error: "AI đang bận, vui lòng thử lại sau vài giây 🔄" }, { status: 503 });
    }
    const errText = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error ${geminiRes.status}: ${errText}` }, { status: 500 });
  }

  const data = await geminiRes.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const text = (rawText || "").replace(/```json/gi, "").replace(/```/g, "").trim();

  // Try direct JSON parse first (works when response is complete)
  try {
    const parsed = JSON.parse(text);
    return NextResponse.json({
      name:     parsed.name     || "Không xác định",
      qty:      parsed.qty      || "",
      calories: Number(parsed.calories || 0),
      protein:  Number(parsed.protein  || 0),
      fat:      Number(parsed.fat      || 0),
      carbs:    Number(parsed.carbs    || 0),
    });
  } catch {
    // fall through to brace extraction
  }

  // Try closing a truncated object
  const start = text.indexOf("{");
  if (start !== -1) {
    const closed = text.endsWith("}") ? text.substring(start) : text.substring(start) + "}";
    try {
      const parsed = JSON.parse(closed);
      return NextResponse.json({
        name:     parsed.name     || "Không xác định",
        qty:      parsed.qty      || "",
        calories: Number(parsed.calories || 0),
        protein:  Number(parsed.protein  || 0),
        fat:      Number(parsed.fat      || 0),
        carbs:    Number(parsed.carbs    || 0),
      });
    } catch {
      // fall through to regex
    }
  }

  // Regex extraction — works even on heavily truncated text
  const nameMatch = text.match(/"name":\s*"([^"]*)"/);
  const qtyMatch  = text.match(/"qty":\s*"([^"]*)"/);
  const calMatch  = text.match(/"calories":\s*(\d+)/);
  const proMatch  = text.match(/"protein":\s*(\d+)/);
  const fatMatch  = text.match(/"fat":\s*(\d+)/);
  const carbMatch = text.match(/"carbs":\s*(\d+)/);

  if (nameMatch || calMatch) {
    return NextResponse.json({
      name:     nameMatch?.[1]  || "Món ăn",
      qty:      qtyMatch?.[1]   || "",
      calories: Number(calMatch?.[1]  || 0),
      protein:  Number(proMatch?.[1]  || 0),
      fat:      Number(fatMatch?.[1]  || 0),
      carbs:    Number(carbMatch?.[1] || 0),
    });
  }

  return NextResponse.json({ error: "Cannot parse", raw: rawText }, { status: 500 });
}
