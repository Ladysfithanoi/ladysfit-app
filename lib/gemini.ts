const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export type MealItem = {
  mealName: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type FoodScanResult = {
  name: string;
  qty: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

function apiUrl() {
  const key = process.env.GEMINI_API_KEY;
  console.log("Gemini API key exists:", !!key);
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return `${GEMINI_URL}?key=${key}`;
}

function parseJsonFromText(text: string, bracket: "[" | "{"): unknown {
  // Method 1: strip markdown code fences, then parse
  const stripped = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Method 2: find the first occurrence of the bracket and last close bracket
  const close = bracket === "[" ? "]" : "}";
  const start = stripped.indexOf(bracket);
  const end = stripped.lastIndexOf(close);

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  // Method 3: try to parse the entire stripped text
  try {
    return JSON.parse(stripped);
  } catch {
    // fall through
  }

  // Method 4: regex scan for the bracket pair
  const pattern = bracket === "[" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = text.match(pattern);
  if (match) {
    return JSON.parse(match[0]);
  }

  throw new Error(`No JSON found in AI response. Raw text: ${text.slice(0, 200)}`);
}

export async function generateMealPlan(params: {
  der: number;
  protein: number;
  fat: number;
  carbs: number;
  mealsPerDay: number;
  likes: string;
  dislikes: string;
}): Promise<MealItem[]> {
  const { der, protein, fat, carbs, mealsPerDay, likes, dislikes } = params;

  const prompt = `Tạo thực đơn ${mealsPerDay} bữa cho 1 ngày theo yêu cầu:
- Calories mục tiêu: ${Math.round(der)} kcal
- Protein: ${Math.round(protein)}g | Fat: ${Math.round(fat)}g | Carbs: ${Math.round(carbs)}g
- Thích: ${likes || "không có yêu cầu"}
- Không ăn: ${dislikes || "không có"}

Yêu cầu: thực đơn Việt Nam, dễ nấu, chia đúng ${mealsPerDay} bữa, tổng macro sai số ≤5%.

⛔ ANTI-DUPLICATE BẮT BUỘC:
- Mỗi bữa PHẢI dùng nguồn đạm chính KHÁC NHAU (thịt bò / gà / cá / heo / hải sản / trứng / đậu hũ — không lặp lại cùng loại quá 1 lần trong ngày).
- NGHIÊM CẤM 2 bữa có thực đơn trùng nhau trên 70%. Mỗi bữa là một tổ hợp thực phẩm độc lập.
- Tổng macro sau khi cộng tất cả bữa: sai số ≤5% so với mục tiêu. Tính lại gram nếu cần.

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

  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  console.log("Gemini raw response:", JSON.stringify(data).slice(0, 500));

  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Fast path: find first [ ... last ]
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  const jsonStr = start !== -1 && end > start ? text.substring(start, end + 1) : text;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (parseJsonFromText(jsonStr, "[") as any[]);

  // Normalize field names — Gemini may return name/foods or mealName/name
  return raw.map((item) => ({
    mealName: item.mealName || item.name || "Bữa",
    name:     item.name    || item.foods || item.description || "",
    calories: Number(item.calories || item.cal || 0),
    protein:  Number(item.protein  || item.pro || 0),
    fat:      Number(item.fat      || 0),
    carbs:    Number(item.carbs    || item.carb || 0),
  })) as MealItem[];
}

export async function analyzeFoodImage(
  base64Image: string,
  mimeType: string
): Promise<FoodScanResult> {
  const prompt = `Phân tích ảnh món ăn, ước tính dinh dưỡng.
TRẢ VỀ DUY NHẤT JSON sau, không thêm bất kỳ ký tự hay giải thích nào:
{"name":"tên món (tiếng Việt)","qty":"khẩu phần ước tính","calories":0,"protein":0,"fat":0,"carbs":0}`;

  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  console.log("Gemini scan response:", JSON.stringify(data).slice(0, 300));

  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseJsonFromText(text, "{") as FoodScanResult;
}
