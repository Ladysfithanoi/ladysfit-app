import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

type MealItemInput = {
  mealName?: unknown;
  name?: unknown;
  calories?: unknown;
  protein?: unknown;
  fat?: unknown;
  carbs?: unknown;
};

function serialize(plan: {
  createdAt: Date;
  updatedAt: Date;
  clientEditedAt: Date | null;
  days: { meals: string; createdAt: Date }[];
}) {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    clientEditedAt: plan.clientEditedAt?.toISOString() ?? null,
    days: plan.days.map((d) => ({
      ...d,
      meals: JSON.parse(d.meals),
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export async function GET() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await prisma.mealPlan.findFirst({
    where: { clientId: session.user.id, status: "ACTIVE" },
    include: { days: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  if (!plan) return NextResponse.json(null);
  return NextResponse.json(serialize(plan));
}

/**
 * PUT /api/my/meal-plan — khách tự soạn lại MÓN ĂN trong chế độ ăn của mình.
 *
 * Khách chủ động chọn món (tự tìm hoặc nhờ AI soạn), nhưng KHÔNG đụng được vào
 * phần tính toán: tdee / der / protein / fat / carbs là do PT tính và luôn lấy
 * từ bản ghi đang có, tuyệt đối không đọc từ body. Nhận vào body cũng vô ích —
 * đây là ranh giới quan trọng nhất của tính năng này.
 *
 * Body: { mealsPerDay?, likes?, dislikes?, meals: MealItem[] }
 */
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(clientAuthOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const plan = await prisma.mealPlan.findFirst({
      where: { clientId: session.user.id, status: "ACTIVE" },
      include: { days: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    if (!plan) {
      return NextResponse.json(
        { error: "Bạn chưa có chế độ ăn nào đang áp dụng. PT sẽ tạo giúp bạn." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as {
      mealsPerDay?: unknown;
      likes?: unknown;
      dislikes?: unknown;
      meals?: unknown;
    };

    if (!Array.isArray(body.meals)) {
      return NextResponse.json({ error: "Thiếu danh sách món ăn" }, { status: 400 });
    }

    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const text = (v: unknown, max: number) =>
      typeof v === "string" ? v.trim().slice(0, max) : "";

    // Chuẩn hoá từng món: chỉ giữ đúng các trường của thực đơn, số âm/không hợp lệ
    // đưa về 0. Món không có tên thì bỏ.
    const meals = (body.meals as MealItemInput[])
      .map((m) => ({
        mealName: text(m.mealName, 60) || "Bữa ăn",
        name: text(m.name, 1000),
        calories: num(m.calories),
        protein: num(m.protein),
        fat: num(m.fat),
        carbs: num(m.carbs),
      }))
      .filter((m) => m.name !== "")
      .slice(0, 30);

    if (meals.length === 0) {
      return NextResponse.json({ error: "Thực đơn cần có ít nhất một món" }, { status: 400 });
    }

    const mealsPerDayRaw = Number(body.mealsPerDay);
    const mealsPerDay =
      Number.isInteger(mealsPerDayRaw) && mealsPerDayRaw >= 1 && mealsPerDayRaw <= 6
        ? mealsPerDayRaw
        : plan.mealsPerDay;

    const dayData = {
      dayLabel: plan.days[0]?.dayLabel ?? "Thực đơn mẫu",
      meals: JSON.stringify(meals),
      totalCalories: meals.reduce((s, m) => s + m.calories, 0),
      totalProtein: meals.reduce((s, m) => s + m.protein, 0),
      totalFat: meals.reduce((s, m) => s + m.fat, 0),
      totalCarbs: meals.reduce((s, m) => s + m.carbs, 0),
    };

    // Ghi đè ngày đầu tiên nếu đã có, chưa có thì tạo. KHÔNG đụng tới tdee/der/
    // protein/fat/carbs — phần tính toán của PT giữ nguyên.
    if (plan.days[0]) {
      await prisma.mealPlanDay.update({ where: { id: plan.days[0].id }, data: dayData });
    } else {
      await prisma.mealPlanDay.create({ data: { ...dayData, mealPlanId: plan.id } });
    }

    const updated = await prisma.mealPlan.update({
      where: { id: plan.id },
      data: {
        mealsPerDay,
        likes: text(body.likes, 300) || null,
        dislikes: text(body.dislikes, 300) || null,
        clientEditedAt: new Date(),
      },
      include: { days: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(serialize(updated));
  } catch (error: unknown) {
    const e = error as { message?: string };
    console.error("[my/meal-plan PUT]", e.message);
    return NextResponse.json({ error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
