import { NextResponse } from "next/server";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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
  const body = await req.json();
  const { base64Image, mimeType } = body;

  console.log("Image size:", base64Image?.length);
  console.log("MIME type:", mimeType);

  if (!base64Image || !mimeType) {
    return NextResponse.json({ error: "Missing image data" }, { status: 400 });
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
  console.log("Sending payload keys:", Object.keys(payload));

  const geminiRes = await callGeminiWithRetry(`${GEMINI_URL}?key=${apiKey}`, payload);

  if (!geminiRes.ok) {
    if (geminiRes.status === 503) {
      return NextResponse.json({ error: "AI đang bận, vui lòng thử lại sau vài giây 🔄" }, { status: 503 });
    }
    const errText = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error ${geminiRes.status}: ${errText}` }, { status: 500 });
  }

  const data = await geminiRes.json();
  console.log("SCAN FULL RESPONSE:", JSON.stringify(data).slice(0, 500));
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  console.log("SCAN RAW:", JSON.stringify(rawText));
  console.log("SCAN LENGTH:", rawText?.length);

  const text = (rawText || "").replace(/```json/gi, "").replace(/```/g, "").trim();

  // Try direct JSON parse first (works when response is complete)
  try {
    const parsed = JSON.parse(text);
    return NextResponse.json({
      name: parsed.name || "Không xác định",
      qty: parsed.qty || "",
      calories: Number(parsed.calories || 0),
      protein: Number(parsed.protein || 0),
      fat: Number(parsed.fat || 0),
      carbs: Number(parsed.carbs || 0),
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
        name: parsed.name || "Không xác định",
        qty: parsed.qty || "",
        calories: Number(parsed.calories || 0),
        protein: Number(parsed.protein || 0),
        fat: Number(parsed.fat || 0),
        carbs: Number(parsed.carbs || 0),
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
      name:     nameMatch?.[1] || "Món ăn",
      qty:      qtyMatch?.[1]  || "",
      calories: Number(calMatch?.[1]  || 0),
      protein:  Number(proMatch?.[1]  || 0),
      fat:      Number(fatMatch?.[1]  || 0),
      carbs:    Number(carbMatch?.[1] || 0),
    });
  }

  return NextResponse.json({ error: "Cannot parse", raw: rawText }, { status: 500 });
}
