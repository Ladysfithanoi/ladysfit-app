import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDaysISO, mondayOf, todayVN, weekLabel, VN_DAY_NAMES } from "@/lib/week";

// POST /api/checklist/weekly-summary  { weekStart }
// Đọc toàn bộ check-list 7 ngày của chính người đang đăng nhập rồi nhờ Gemini
// (dùng chung GEMINI_API_KEY/GEMINI_API_KEYS với phần dinh dưỡng) viết sẵn bản
// nháp báo cáo tuần. Kết quả trả về để nhân sự sửa lại trước khi lưu/gửi FM.

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function toUTC(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(keys: string[], payload: any): Promise<Response> {
  const startIdx = Math.floor(Math.random() * keys.length);
  let last: Response | null = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(startIdx + attempt) % keys.length];
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 503 && i < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      if (res.status === 429) { last = res; break; }
      return res;
    }
  }
  return last ?? new Response(null, { status: 429 });
}

const SECTION_LABELS: [string, string][] = [
  ["results",    "📈 Kết quả nổi bật trong tuần"],
  ["completed",  "✅ Việc đã hoàn thành"],
  ["incomplete", "⏳ Việc chưa hoàn thành"],
  ["nextPlan",   "➡️ Kế hoạch tuần tới"],
];

/**
 * Báo cáo tuần chỉ còn một ô nội dung, nên mong đợi model trả về {"content": …}.
 * Nếu nó vẫn trả về 4 mục rời (định dạng cũ) thì ghép lại kèm tiêu đề, để một
 * lần model "cứng đầu" không làm hỏng nút Tổng hợp.
 */
function parseContent(text: string): string {
  const stripped = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  const json = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
  const raw = JSON.parse(json) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (str(raw.content)) return str(raw.content);
  return SECTION_LABELS
    .filter(([k]) => str(raw[k]))
    .map(([k, label]) => `${label}:\n${str(raw[k])}`)
    .join("\n\n");
}

// GET — dữ liệu thô 7 ngày của chính mình, để nhân sự tự tổng hợp thủ công
// mà không phải mở lại từng ngày một.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("weekStart");
  const weekStart = mondayOf(raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayVN());

  const checklists = await prisma.dailyChecklist.findMany({
    where: {
      userId: session.user.id,
      reportDate: { gte: toUTC(weekStart), lt: toUTC(addDaysISO(weekStart, 7)) },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const byDate = new Map(
    checklists.map((c) => [c.reportDate.toISOString().slice(0, 10), c])
  );

  let tasksTotal = 0;
  let tasksDone = 0;
  let teachingDone = 0;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(weekStart, i);
    const cl = byDate.get(date);
    if (!cl) {
      return {
        date, dayName: VN_DAY_NAMES[i], filled: false,
        targetNote: "", reflection: "", tasks: [] as unknown[],
        tasksTotal: 0, tasksDone: 0,
      };
    }
    let dTotal = 0;
    let dDone = 0;
    const tasks = cl.items.map((it) => {
      const kpi = it.kpi ? parseFloat(it.kpi) : NaN;
      const hasKpi = !isNaN(kpi) && kpi > 0;
      const actual = it.actualResult ?? 0;
      const pct = hasKpi ? Math.round((actual / kpi) * 100) : null;
      dTotal += 1;
      if (pct !== null && pct >= 80) dDone += 1;
      if (it.isTeachingSession) teachingDone += actual;
      return {
        time: it.time ?? "", task: it.task, kpi: it.kpi ?? "",
        actual, pct, isTeaching: it.isTeachingSession, note: it.note ?? "",
      };
    });
    tasksTotal += dTotal;
    tasksDone += dDone;
    return {
      date, dayName: VN_DAY_NAMES[i], filled: true,
      targetNote: cl.targetNote ?? "",
      reflection:
        cl.dailyResults?.trim() ||
        [cl.dailyCompleted, cl.dailyIncomplete, cl.dailyNextPlan]
          .filter((s) => s?.trim())
          .join(" — "),
      tasks,
      tasksTotal: dTotal,
      tasksDone: dDone,
    };
  });

  return NextResponse.json({
    weekStart,
    days,
    stats: {
      daysFilled: checklists.length,
      tasksTotal,
      tasksDone,
      taskRate: tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0,
      teachingDone: Math.round(teachingDone * 10) / 10,
    },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["PT", "FM", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { weekStart?: string };
  const weekStart = mondayOf(
    body.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart) ? body.weekStart : todayVN()
  );
  const weekEnd = addDaysISO(weekStart, 7);

  const checklists = await prisma.dailyChecklist.findMany({
    where: {
      userId: session.user.id,
      reportDate: { gte: toUTC(weekStart), lt: toUTC(weekEnd) },
    },
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: { reportDate: "asc" },
  });

  if (checklists.length === 0) {
    return NextResponse.json(
      { error: "Tuần này chưa có check-list ngày nào để tổng hợp" },
      { status: 400 }
    );
  }

  // Dựng phần dữ liệu thô của tuần cho AI đọc.
  const dayBlocks: string[] = [];
  let weekTasks = 0;
  let weekDone = 0;
  let weekTeaching = 0;

  for (const cl of checklists) {
    const iso = cl.reportDate.toISOString().slice(0, 10);
    const dayIdx = (new Date(iso + "T00:00:00.000Z").getUTCDay() + 6) % 7;
    const lines: string[] = [`### ${VN_DAY_NAMES[dayIdx]} ${iso}`];
    if (cl.targetNote?.trim()) lines.push(`Mục tiêu ngày: ${cl.targetNote.trim()}`);

    for (const it of cl.items) {
      weekTasks += 1;
      const kpi = it.kpi ? parseFloat(it.kpi) : NaN;
      const actual = it.actualResult ?? 0;
      const hasKpi = !isNaN(kpi) && kpi > 0;
      const pct = hasKpi ? Math.round((actual / kpi) * 100) : null;
      if (pct !== null && pct >= 80) weekDone += 1;
      if (it.isTeachingSession) weekTeaching += actual;
      lines.push(
        `- ${it.time ? it.time + " " : ""}${it.task}` +
          (hasKpi ? ` | KPI ${it.kpi} → đạt ${actual} (${pct}%)` : "") +
          (it.isTeachingSession ? " | [buổi dạy]" : "") +
          (it.note?.trim() ? ` | ghi chú: ${it.note.trim()}` : "")
      );
    }

    const reflection =
      cl.dailyResults?.trim() ||
      [cl.dailyCompleted, cl.dailyIncomplete, cl.dailyNextPlan]
        .filter((s) => s?.trim())
        .join(" — ");
    if (reflection) lines.push(`Tự luận cuối ngày: ${reflection}`);
    dayBlocks.push(lines.join("\n"));
  }

  const taskRate = weekTasks > 0 ? Math.round((weekDone / weekTasks) * 100) : 0;
  const prompt = `Bạn là trợ lý viết báo cáo tuần cho nhân sự phòng gym (huấn luyện viên cá nhân / quản lý chi nhánh).
Dưới đây là toàn bộ check-list công việc theo ngày của một nhân sự trong ${weekLabel(weekStart)}.

Số liệu tổng: ${checklists.length}/7 ngày có check-list · ${weekDone}/${weekTasks} đầu việc đạt KPI (${taskRate}%) · ${Math.round(weekTeaching * 10) / 10} buổi dạy.

${dayBlocks.join("\n\n")}

Hãy viết báo cáo tuần bằng tiếng Việt, giọng văn ngắn gọn chuyên nghiệp, xưng "em" khi báo cáo cấp trên.
Bám sát dữ liệu thật ở trên, KHÔNG bịa thêm số liệu hay công việc không có trong check-list.

Báo cáo là MỘT đoạn văn bản liền mạch gồm 4 phần theo đúng thứ tự và đúng tiêu đề sau,
mỗi phần cách nhau một dòng trống, mỗi ý là một gạch đầu dòng "- ", tối đa 5 gạch mỗi phần:

📈 Kết quả nổi bật trong tuần:
- (có số liệu cụ thể)

✅ Việc đã hoàn thành:
-

⏳ Việc chưa hoàn thành:
- (kèm lý do)

➡️ Kế hoạch tuần tới:
- (giải pháp và mục tiêu)

TRẢ VỀ DUY NHẤT một object JSON đúng format sau, không thêm chữ nào khác:
{"content": "toàn bộ báo cáo, dùng \\n để xuống dòng"}`;

  const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  const apiKeys = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY" }, { status: 500 });
  }

  const res = await callGemini(apiKeys, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.status === 429 ? "AI đang quá tải, thử lại sau ít phút" : "Tổng hợp thất bại" },
      { status: 502 }
    );
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    return NextResponse.json({
      weekStart,
      content: parseContent(text),
      stats: { days: checklists.length, tasksTotal: weekTasks, tasksDone: weekDone, taskRate },
    });
  } catch {
    return NextResponse.json({ error: "Không đọc được kết quả từ AI" }, { status: 502 });
  }
}
