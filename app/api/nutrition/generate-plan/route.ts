import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
  throw new Error("Retry loop exited unexpectedly");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { der, protein, fat, carbs, mealsPerDay, likes, dislikes } = body as Record<string, unknown>;

  if (!der || !protein || !fat || !carbs || !mealsPerDay) {
    return NextResponse.json({ error: "Thiếu thông tin dinh dưỡng" }, { status: 400 });
  }

  const derNum      = Number(der);
  const proteinNum  = Number(protein);
  const fatNum      = Number(fat);
  const carbsNum    = Number(carbs);
  const mealsNum    = Number(mealsPerDay);

  if (derNum <= 0 || proteinNum < 0 || fatNum < 0 || carbsNum < 0) {
    return NextResponse.json({ error: "Giá trị dinh dưỡng không hợp lệ" }, { status: 400 });
  }
  if (!Number.isInteger(mealsNum) || mealsNum < 1 || mealsNum > 6) {
    return NextResponse.json({ error: "Số bữa không hợp lệ (1-6)" }, { status: 400 });
  }
  if (typeof likes === "string" && likes.length > 500) {
    return NextResponse.json({ error: "Thông tin quá dài" }, { status: 400 });
  }
  if (typeof dislikes === "string" && dislikes.length > 500) {
    return NextResponse.json({ error: "Thông tin quá dài" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const likesStr    = typeof likes    === "string" ? likes.trim()    : "";
  const dislikesStr = typeof dislikes === "string" ? dislikes.trim() : "";

  const likesContext = likesStr
    ? `Ưu tiên sử dụng các thực phẩm sau (không bắt buộc 100%): ${likesStr}`
    : "Không có yêu cầu đặc biệt — hãy TỰ ĐỘNG chọn ngẫu nhiên các thực phẩm lành mạnh, đa dạng, phổ biến trong ẩm thực Việt Nam";

  const dislikesContext = dislikesStr
    ? `Tuyệt đối KHÔNG sử dụng các thực phẩm sau: ${dislikesStr}`
    : "Không có dị ứng hoặc kiêng kị — được sử dụng linh hoạt mọi loại thực phẩm lành mạnh";

  const randomNote = !likesStr && !dislikesStr
    ? "Vì không có yêu cầu cụ thể, hãy tự thiết kế thực đơn ngẫu nhiên đa dạng, cân bằng dinh dưỡng theo phong cách ẩm thực Việt Nam.\n"
    : "";

  const prompt = `Tạo thực đơn ${mealsNum} bữa cho 1 ngày theo yêu cầu:
- Calories mục tiêu: ${Math.round(derNum)} kcal
- Protein: ${Math.round(proteinNum)}g | Fat: ${Math.round(fatNum)}g | Carbs: ${Math.round(carbsNum)}g
- Thực phẩm yêu thích: ${likesContext}
- Thực phẩm kiêng/dị ứng: ${dislikesContext}

${randomNote}Yêu cầu: thực đơn Việt Nam, dễ nấu, chia đúng ${mealsNum} bữa, tổng macro sai số ≤10%.

TRẢ VỀ DUY NHẤT một mảng JSON với format CHÍNH XÁC sau, không thêm text nào khác:
[
  {
    "mealName": "Bữa 1 - Sáng",
    "name": "Mô tả chi tiết món ăn + định lượng",
    "calories": 400,
    "protein": 30,
    "fat": 15,
    "carbs": 45
  }
]`;

  const geminiRes = await callGeminiWithRetry(`${GEMINI_URL}?key=${apiKey}`, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  if (!geminiRes.ok) {
    if (geminiRes.status === 503) {
      return NextResponse.json({ error: "AI đang bận, vui lòng thử lại sau vài giây 🔄" }, { status: 503 });
    }
    const errText = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error ${geminiRes.status}: ${errText}` }, { status: 500 });
  }

  const data = await geminiRes.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("FULL RAW TEXT:", JSON.stringify(rawText));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function normalize(parsed: any[]): any[] {
    return parsed.map((item) => ({
      mealName: item.mealName || item.name || "Bữa",
      name: item.name || item.foods || "",
      calories: Number(item.calories || 0),
      protein: Number(item.protein || 0),
      fat: Number(item.fat || 0),
      carbs: Number(item.carbs || item.carb || 0),
    }));
  }

  let text = rawText || "";
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  // Convert literal \n sequences to real newlines
  text = text.replace(/\\n/g, "\n");

  // If the response was truncated mid-JSON, attempt to close it
  const trimmed = text.trim();
  if (!trimmed.endsWith("]")) {
    const lastBrace = trimmed.lastIndexOf("}");
    if (lastBrace !== -1) {
      text = trimmed.substring(0, lastBrace + 1) + "]";
    }
  }

  // Direct parse attempt first
  try {
    const direct = JSON.parse(text);
    if (Array.isArray(direct)) {
      return NextResponse.json(normalize(direct));
    }
  } catch {
    // fall through to extraction
  }

  // Fallback: extract array substring
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.substring(start, end + 1));
      return NextResponse.json(normalize(parsed));
    } catch (e) {
      console.error("JSON parse error:", e, "Substring:", text.substring(start, end + 1).slice(0, 200));
    }
  }

  return NextResponse.json({
    error: "Cannot parse JSON",
    rawText: rawText,
    rawTextLength: rawText?.length,
    firstCharCode: rawText?.charCodeAt(0),
    typeof: typeof rawText,
  }, { status: 500 });
}
