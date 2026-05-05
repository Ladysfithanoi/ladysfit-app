import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { PortalLayoutClient } from "@/components/my/portal-layout-client";
import { NutritionTab } from "@/components/my/nutrition-tab";

export default async function NutritionPage() {
  const session = await getServerSession(clientAuthOptions);
  if (!session) redirect("/my/login");

  const clientId = session.user.id;

  const [client, mealPlan, todayLogs] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { fullName: true } }),
    prisma.mealPlan.findFirst({
      where: { clientId, status: "ACTIVE" },
      include: { days: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    (() => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      return prisma.foodScanLog.findMany({
        where: { clientId, scanDate: { gte: dayStart, lt: dayEnd } },
        orderBy: { scanDate: "asc" },
      });
    })(),
  ]);

  if (!client) redirect("/my/login");

  const serializedPlan = mealPlan
    ? {
        id: mealPlan.id,
        tdee: mealPlan.tdee,
        der: mealPlan.der,
        protein: mealPlan.protein,
        fat: mealPlan.fat,
        carbs: mealPlan.carbs,
        mealsPerDay: mealPlan.mealsPerDay,
        likes: mealPlan.likes,
        dislikes: mealPlan.dislikes,
        status: mealPlan.status as "ACTIVE" | "ARCHIVED",
        createdAt: mealPlan.createdAt.toISOString(),
        days: mealPlan.days.map((d) => ({
          id: d.id,
          dayLabel: d.dayLabel,
          meals: JSON.parse(d.meals),
          totalCalories: d.totalCalories,
          totalProtein: d.totalProtein,
          totalFat: d.totalFat,
          totalCarbs: d.totalCarbs,
        })),
      }
    : null;

  return (
    <PortalLayoutClient clientName={client.fullName}>
      <NutritionTab
        mealPlan={serializedPlan}
        initialLogs={todayLogs.map((l) => ({
          id: l.id,
          foodName: l.foodName,
          quantity: l.quantity,
          calories: l.calories,
          protein: l.protein,
          fat: l.fat,
          carbs: l.carbs,
          scanDate: l.scanDate.toISOString(),
        }))}
      />
    </PortalLayoutClient>
  );
}
