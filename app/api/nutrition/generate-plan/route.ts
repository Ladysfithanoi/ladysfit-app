import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function callGeminiOnce(
  apiKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
): Promise<Response> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status !== 503 || i === 2) return res;
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error("Retry loop exited unexpectedly");
}

async function callGeminiWithKeyRotation(
  keys: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
): Promise<Response> {
  const startIdx = Math.floor(Math.random() * keys.length);
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(startIdx + attempt) % keys.length];
    const res = await callGeminiOnce(key, payload);
    if (res.status !== 429) return res;
    if (attempt < keys.length - 1) continue;
  }
  throw new Error("All API keys exhausted");
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

  if (der == null || protein == null || fat == null || carbs == null || mealsPerDay == null) {
    return NextResponse.json({ error: "Thiếu thông tin dinh dưỡng" }, { status: 400 });
  }

  const derNum     = Number(der);
  const proteinNum = Number(protein);
  const fatNum     = Number(fat);
  const carbsNum   = Number(carbs);
  const mealsNum   = Number(mealsPerDay);

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

  const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const apiKeys = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
  if (apiKeys.length === 0) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  // Lấy toàn bộ database thực phẩm từ Supabase
  const dbFoods = await prisma.food.findMany({ orderBy: { name: "asc" } });

  // Nén dữ liệu dạng bảng nhỏ gọn để đưa vào prompt
  const foodTable = dbFoods
    .map((f) => {
      const parts = [f.name, f.calories, f.protein, f.carbs, f.fat, f.weight_g];
      if (f.meal_type) parts.push(`[${f.meal_type}]`);
      if (f.category) parts.push(`(${f.category})`);
      return parts.join("|");
    })
    .join("\n");

  const likesStr    = typeof likes    === "string" ? likes.trim()    : "";
  const dislikesStr = typeof dislikes === "string" ? dislikes.trim() : "";

  const likesContext = likesStr
    ? `Ưu tiên sử dụng các thực phẩm sau (không bắt buộc 100%): ${likesStr}`
    : "Không có yêu cầu đặc biệt — tự động chọn ngẫu nhiên từ database";

  const dislikesContext = dislikesStr
    ? `Tuyệt đối KHÔNG sử dụng các thực phẩm sau: ${dislikesStr}`
    : "Không có dị ứng — được sử dụng linh hoạt mọi thực phẩm trong database";

  const systemInstruction = `Cậu là thuật toán xếp hình thực đơn siêu tốc của hệ thống Ladysfit.
Hãy nhận mục tiêu Calo và tỷ lệ P-C-F từ user, sau đó LỰA CHỌN và KẾT HỢP các thực phẩm phù hợp TỪ MẢNG DỮ LIỆU THỰC PHẨM SUPABASE DƯỚI ĐÂY.

FORMAT DATABASE (Tên|Cal|P|C|F|g_định_lượng|[Loại bữa]|(Mục đích)):
${foodTable}

QUY TẮC BẮT BUỘC:
1. Tuyệt đối không tự chế món mới nằm ngoài database trên. Chỉ dùng đúng các tên thực phẩm có trong bảng.
2. ƯU TIÊN BỮA SÁNG VIỆT NAM: Nếu có từ 3 bữa trở lên, Bữa 1 (Bữa sáng) PHẢI ưu tiên cao nhất cho: phở, bún, xôi, bánh mì, bánh bao, cháo có trong database. Hạn chế cơm vào buổi sáng.
3. XOAY TUA KHÔNG TRÙNG LẶP: Mỗi lần tạo phải cho ra tổ hợp món ăn khác nhau. Hãy xác suất hóa lựa chọn để mỗi lần bấm tạo ra kết quả mới.
4. Tính toán macro CHính xác dựa trên định lượng gram và chỉ số dinh dưỡng per 100g từ database.
5. Đầu ra PHẢI là JSON thuần (không markdown, không giải thích).`;

  const prompt = `Tạo thực đơn ${mealsNum} bữa cho 1 ngày:
- Calories mục tiêu: ${Math.round(derNum)} kcal
- Protein: ${Math.round(proteinNum)}g | Fat: ${Math.round(fatNum)}g | Carbs: ${Math.round(carbsNum)}g
- Thực phẩm yêu thích: ${likesContext}
- Thực phẩm kiêng/dị ứng: ${dislikesContext}

BẮT BUỘC VỀ SỐ BỮA: Mảng JSON PHẢI có ĐÚNG ${mealsNum} phần tử (${mealsNum} bữa riêng biệt).
Không được gộp bữa, không được bỏ sót bữa cuối. Ưu tiên hoàn thành đủ ${mealsNum} bữa hơn là chi tiết quá kỹ từng bữa.
Chia đúng ${mealsNum} bữa, tổng macro sai số ≤10%.

QUY TẮC TRẢ VỀ JSON BẮT BUỘC:
Trả về DUY NHẤT một mảng JSON có ĐÚNG ${mealsNum} phần tử, mỗi phần tử có 6 trường:
- "mealName": tên bữa (string, ví dụ "Bữa 1 - Sáng")
- "name": mô tả món ăn và định lượng cụ thể (string)
- "calories": tổng calo của bữa (number)
- "protein": lượng đạm tính bằng gam (number)
- "fat": lượng chất béo tính bằng gam (number)
- "carbs": lượng tinh bột tính bằng gam (number)`;

  const geminiPayload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  const geminiRes = await callGeminiWithKeyRotation(apiKeys, geminiPayload);

  if (!geminiRes.ok) {
    if (geminiRes.status === 503 || geminiRes.status === 429) {
      return NextResponse.json({ error: "AI đang bận, vui lòng thử lại sau vài giây 🔄" }, { status: 503 });
    }
    const errText = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error ${geminiRes.status}: ${errText}` }, { status: 500 });
  }

  const data = await geminiRes.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const finishReason: string = data?.candidates?.[0]?.finishReason ?? "STOP";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function normalize(arr: any[]): any[] {
    return arr.map((item) => {
      const protein  = Number(item.protein  ?? item.proteins  ?? 0) || 0;
      const fat      = Number(item.fat      ?? item.fats      ?? item.lipid ?? 0) || 0;
      const carbs    = Number(item.carbs    ?? item.carb      ?? item.carbohydrate ?? item.carbohydrates ?? 0) || 0;
      const rawCal   = Number(item.calories ?? item.calorie   ?? item.kcal ?? item.energy ?? 0) || 0;
      const calories = rawCal > 0 ? rawCal : Math.round(protein * 4 + fat * 9 + carbs * 4);
      return {
        mealName: item.mealName || item.meal_name || item.meal || "Bữa",
        name:     item.name     || item.description || item.foods || item.food || "",
        calories, protein, fat, carbs,
      };
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseRaw(raw: string): any[] | null {
    let text = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    text = text.replace(/\\n/g, "\n");
    const trimmed = text.trim();
    if (!trimmed.endsWith("]")) {
      const lastBrace = trimmed.lastIndexOf("}");
      if (lastBrace !== -1) text = trimmed.substring(0, lastBrace + 1) + "]";
    }
    try {
      const direct = JSON.parse(text);
      if (Array.isArray(direct)) return normalize(direct);
    } catch {}
    const s = text.indexOf("[");
    const e = text.lastIndexOf("]");
    if (s !== -1 && e > s) {
      try { return normalize(JSON.parse(text.substring(s, e + 1))); } catch {}
    }
    return null;
  }

  let meals = parseRaw(rawText);

  // Retry once if Gemini truncated the response or returned fewer meals than requested
  if (!meals || meals.length < mealsNum || finishReason === "MAX_TOKENS") {
    const rescuePrompt = `Tạo thực đơn ${mealsNum} bữa dựa trên món ăn Việt Nam phổ thông.
Mục tiêu: ${Math.round(derNum)} kcal | P:${Math.round(proteinNum)}g F:${Math.round(fatNum)}g C:${Math.round(carbsNum)}g
Kiêng/dị ứng: ${dislikesStr || "không có"}
BẮT BUỘC: Mảng JSON phải có ĐÚNG ${mealsNum} phần tử (${mealsNum} objects). Không thiếu bữa. Chỉ trả về JSON thuần.`;
    const rescuePayload = {
      contents: [{ role: "user", parts: [{ text: rescuePrompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 2048, responseMimeType: "application/json" },
    };
    try {
      const rescueRes = await callGeminiWithKeyRotation(apiKeys, rescuePayload);
      if (rescueRes.ok) {
        const rescueData = await rescueRes.json();
        const rescueMeals = parseRaw(rescueData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
        if (rescueMeals && rescueMeals.length >= mealsNum) {
          meals = rescueMeals;
        } else if (rescueMeals && rescueMeals.length > (meals?.length ?? 0)) {
          meals = rescueMeals;
        }
      }
    } catch { /* ignore retry error, return best result we have */ }
  }

  if (!meals || meals.length === 0) {
    return NextResponse.json({ error: "Cannot parse AI response", rawText, rawTextLength: rawText.length }, { status: 500 });
  }

  return NextResponse.json(meals);
}
