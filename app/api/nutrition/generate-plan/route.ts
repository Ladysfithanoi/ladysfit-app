import { NextResponse } from "next/server";
import { getNutritionActor } from "@/lib/nutrition-auth";
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

type Keyword = { text: string; accented: boolean };

// Chữ cái Latin có dấu: Latin-1 Supplement, Latin Extended-A/B và
// Latin Extended Additional (chứa toàn bộ nguyên âm tiếng Việt).
// Dùng dải mã thay cho \p{L} vì \p{L} cần cờ /u (target ES5 không hỗ trợ).
const LATIN_LETTERS = "a-z0-9\\u00c0-\\u024f\\u1e00-\\u1eff";

// Thường hoá + bỏ ký tự đặc biệt nhưng GIỮ dấu tiếng Việt
function normalizeKeepAccent(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(new RegExp(`[^${LATIN_LETTERS}\\s]`, "g"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Như trên nhưng BỎ dấu — dùng khi khách gõ không dấu
function normalizeVi(text: string): string {
  return normalizeKeepAccent(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tách chuỗi khách nhập ("thịt bò, cá hồi và trứng gà") thành các từ khoá riêng.
// Không dùng \b vì ranh giới từ của JS không nhận nguyên âm tiếng Việt có dấu.
function splitKeywords(raw: string): Keyword[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: Keyword[] = [];
  for (const part of raw.split(/[,;\/\n]|\s+(?:và|hoặc|với|cùng)\s+/gi)) {
    const strict = normalizeKeepAccent(part);
    const loose = normalizeVi(part);
    if (loose.length < 2 || seen.has(loose)) continue;
    seen.add(loose);
    // Khách gõ có dấu → so khớp có dấu, để "bò" không dính nhầm "bơ"
    const accented = strict !== loose;
    out.push({ text: accented ? strict : loose, accented });
  }
  return out;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let k = arr.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [arr[k], arr[r]] = [arr[r], arr[k]];
  }
  return arr;
}

// Khớp cụm từ theo ranh giới tiếng, không khớp giữa chừng một tiếng
// ("cá" không được khớp "cà ri", nhưng "thịt bò xào" vẫn khớp "Thịt bò nạc")
function matchPhrase(name: string, term: string): boolean {
  const nameTokens = name.split(" ").filter(Boolean);
  const termTokens = term.split(" ").filter(Boolean);
  if (termTokens.length === 0 || nameTokens.length === 0) return false;
  if (termTokens.length === 1) return nameTokens.includes(termTokens[0]);
  if (name.includes(term)) return true;
  if (` ${term} `.includes(` ${name} `)) return true;
  for (let k = 0; k + 1 < termTokens.length; k++) {
    if (name.includes(`${termTokens[k]} ${termTokens[k + 1]}`)) return true;
  }
  return false;
}

function matchesAny(foodName: string, keywords: Keyword[]): boolean {
  const strictName = normalizeKeepAccent(foodName);
  const looseName = normalizeVi(foodName);
  if (!looseName) return false;
  return keywords.some((kw) => matchPhrase(kw.accented ? strictName : looseName, kw.text));
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

  const likesStr    = typeof likes    === "string" ? likes.trim()    : "";
  const dislikesStr = typeof dislikes === "string" ? dislikes.trim() : "";

  const likeKeywords    = splitKeywords(likesStr);
  const dislikeKeywords = splitKeywords(dislikesStr);

  // Loại thẳng thực phẩm bị kiêng ra khỏi bảng gửi cho AI — AI không thấy thì không chọn được
  const allowedFoods = dislikeKeywords.length
    ? dbFoods.filter((f) => !matchesAny(f.name, dislikeKeywords))
    : dbFoods;

  // Nếu lọc quá tay (còn quá ít món) thì giữ nguyên bảng gốc, chỉ dựa vào prompt để né
  const usableFoods =
    allowedFoods.length >= 15 && allowedFoods.length >= dbFoods.length * 0.2
      ? allowedFoods
      : dbFoods;

  const likedMatches = likeKeywords.length
    ? usableFoods.filter((f) => matchesAny(f.name, likeKeywords))
    : [];

  // Một từ khoá rộng (vd "cá") có thể khớp hàng chục món — bốc ngẫu nhiên tối đa
  // MAX_FAVORITES để prompt không quá dài và mỗi lần tạo lại ra tổ hợp mới
  const MAX_FAVORITES = 12;
  const likedFoods = shuffle(likedMatches).slice(0, MAX_FAVORITES);
  const likedNames = new Set(likedFoods.map((f) => f.name));

  // Từ khoá khách thích nhưng database chưa có món nào khớp
  const unmatchedLikes = likeKeywords.filter(
    (kw) => !usableFoods.some((f) => matchesAny(f.name, [kw]))
  );

  // Nén dữ liệu dạng bảng nhỏ gọn để đưa vào prompt (⭐ = món khách thích)
  const foodTable = usableFoods
    .map((f) => {
      const parts = [f.name, f.calories, f.protein, f.carbs, f.fat, f.weight_g];
      if (f.meal_type) parts.push(`[${f.meal_type}]`);
      if (f.category) parts.push(`(${f.category})`);
      const row = parts.join("|");
      return likedNames.has(f.name) ? `⭐ ${row}` : row;
    })
    .join("\n");

  const favoriteTable = likedFoods
    .map((f) => `${f.name}|${f.calories}|${f.protein}|${f.carbs}|${f.fat}|${f.weight_g}`)
    .join("\n");

  const favoriteBlock = likedFoods.length
    ? `

⭐ DANH SÁCH MÓN KHÁCH YÊU THÍCH (Tên|Cal|P|C|F|g_định_lượng) — BẮT BUỘC PHẢI XUẤT HIỆN TRONG THỰC ĐƠN:
${favoriteTable}`
    : "";

  const likesContext = !likesStr
    ? "Không có yêu cầu đặc biệt — tự động chọn ngẫu nhiên từ database"
    : likedFoods.length > 0
      ? `BẮT BUỘC dùng các món khách thích (đã đánh dấu ⭐ trong database): ${likedFoods
          .map((f) => f.name)
          .join(", ")}${
          unmatchedLikes.length
            ? `. Khách còn ghi thêm "${unmatchedLikes.map((k) => k.text).join(", ")}" — hãy chọn món GẦN GIỐNG NHẤT trong database.`
            : ""
        }`
      : `Khách thích: ${likesStr}. Database chưa có món trùng tên — hãy chọn những món GẦN GIỐNG NHẤT (cùng nguyên liệu hoặc cùng cách chế biến) trong database.`;

  const dislikesContext = dislikesStr
    ? `Tuyệt đối KHÔNG dùng các thực phẩm sau và mọi món có chứa chúng: ${dislikesStr}`
    : "Không có dị ứng — được sử dụng linh hoạt mọi thực phẩm trong database";

  const systemInstruction = `Cậu là thuật toán xếp hình thực đơn siêu tốc của hệ thống Ladysfit.
Hãy nhận mục tiêu Calo và tỷ lệ P-C-F từ user, sau đó LỰA CHỌN và KẾT HỢP các thực phẩm phù hợp TỪ MẢNG DỮ LIỆU THỰC PHẨM SUPABASE DƯỚI ĐÂY.

FORMAT DATABASE (Tên|Cal|P|C|F|g_định_lượng|[Loại bữa]|(Mục đích)):
${foodTable}${favoriteBlock}

QUY TẮC BẮT BUỘC:
1. Tuyệt đối không tự chế món mới nằm ngoài database trên. Chỉ dùng đúng các tên thực phẩm có trong bảng.
2. ƯU TIÊN BỮA SÁNG VIỆT NAM: Nếu có từ 3 bữa trở lên, Bữa 1 (Bữa sáng) PHẢI ưu tiên cao nhất cho: phở, bún, xôi, bánh mì, bánh bao, cháo có trong database. Hạn chế cơm vào buổi sáng.
3. XOAY TUA KHÔNG TRÙNG LẶP: Mỗi lần tạo phải cho ra tổ hợp món ăn khác nhau. Hãy xác suất hóa lựa chọn để mỗi lần bấm tạo ra kết quả mới.
4. Tính toán macro CHính xác dựa trên định lượng gram và chỉ số dinh dưỡng per 100g từ database.
5. Đầu ra PHẢI là JSON thuần (không markdown, không giải thích).

⛔ QUY TẮC ĐA DẠNG BỮA ĂN — VI PHẠM = KẾT QUẢ SAI:
6. NGHIÊM CẤM TUYỆT ĐỐI: Các bữa trong cùng một ngày KHÔNG được trùng lặp trên 70% danh sách thực phẩm. Copy-paste thực đơn giữa các bữa là lỗi nghiêm trọng.
7. MỖI BỮA PHẢI DÙNG NGUỒN ĐẠM CHÍNH KHÁC NHAU (trừ khi đó là món khách yêu thích ⭐ — sở thích khách hàng luôn thắng quy tắc đa dạng):
   - Nếu Bữa 1 đã dùng thịt bò → Bữa 2, 3 PHẢI chọn: cá, ức gà, thịt heo nạc, hải sản, tôm, trứng (nếu chưa dùng), đậu hũ...
   - Không lặp lại cùng một loại đạm chủ lực quá 1 lần trong toàn bộ ngày.
8. NGUỒN TINH BỘT và CHẤT BÉO cũng phải đa dạng: không dùng cùng một loại tinh bột (vd: cơm trắng) cho tất cả các bữa — hãy xen kẽ khoai lang, bún, bánh mì, cháo yến mạch...
9. ƯU TIÊN SỞ THÍCH KHÁCH HÀNG — CAO HƠN MỌI QUY TẮC ĐA DẠNG:
   - MỖI BỮA PHẢI có ít nhất 1 món lấy từ danh sách ⭐ (nếu danh sách ⭐ không rỗng). Đây là yêu cầu bắt buộc, không phải gợi ý.
   - Nếu danh sách ⭐ có ít món hơn số bữa, được phép lặp lại món ⭐ ở nhiều bữa dù vi phạm quy tắc 7-8.
   - Nếu danh sách ⭐ nhiều món, hãy trải đều chúng ra các bữa thay vì dồn hết vào một bữa.
   - Thực phẩm khách kiêng/dị ứng đã bị loại khỏi database phía trên. Tuyệt đối không tự thêm lại chúng, kể cả dưới tên gọi khác hay làm nguyên liệu phụ.
10. KỶ LUẬT TOÁN HỌC KHÔNG ĐỔI: Dù đổi món đa dạng, tổng (Protein × 4 + Carbs × 4 + Fat × 9) của tất cả bữa cộng lại vẫn phải sai số ≤5% so với mục tiêu Calo. Tính lại gram từng thực phẩm để đảm bảo con số khớp.`;

  const prompt = `Tạo thực đơn ${mealsNum} bữa cho 1 ngày:
- Calories mục tiêu: ${Math.round(derNum)} kcal
- Protein: ${Math.round(proteinNum)}g | Fat: ${Math.round(fatNum)}g | Carbs: ${Math.round(carbsNum)}g
- Thực phẩm yêu thích: ${likesContext}
- Thực phẩm kiêng/dị ứng: ${dislikesContext}

BẮT BUỘC VỀ SỐ BỮA: Mảng JSON PHẢI có ĐÚNG ${mealsNum} phần tử (${mealsNum} bữa riêng biệt).
Không được gộp bữa, không được bỏ sót bữa cuối. Ưu tiên hoàn thành đủ ${mealsNum} bữa hơn là chi tiết quá kỹ từng bữa.
Chia đúng ${mealsNum} bữa, tổng macro sai số ≤5%.

⛔ NHẮC LẠI ANTI-DUPLICATE: Mỗi bữa PHẢI dùng nguồn đạm khác nhau (không lặp thịt bò/gà/cá/heo liên tiếp). Kiểm tra lại trước khi trả về — nếu 2 bữa có >70% thực phẩm giống nhau, hãy thay thế ngay.${
    likedFoods.length
      ? `

⭐ NHẮC LẠI SỞ THÍCH (ưu tiên số 1, cao hơn anti-duplicate): MỖI BỮA phải có ít nhất 1 món lấy từ danh sách khách thích: ${likedFoods
          .map((f) => f.name)
          .join(", ")}. Trước khi trả về, tự kiểm tra lại từng bữa — bữa nào chưa có món nào trong danh sách này thì sửa ngay.`
      : ""
  }${
    dislikesStr
      ? `

🚫 NHẮC LẠI KIÊNG KỊ: tuyệt đối không có ${dislikesStr} (và món chứa chúng) trong bất kỳ bữa nào.`
      : ""
  }

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
      temperature: 0.9,
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
Món yêu thích BẮT BUỘC có mặt: ${
      likedFoods.length ? likedFoods.map((f) => f.name).join(", ") : likesStr || "không có"
    }
Kiêng/dị ứng TUYỆT ĐỐI KHÔNG dùng: ${dislikesStr || "không có"}
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
