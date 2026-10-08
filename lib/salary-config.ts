import { prisma } from "@/lib/prisma";

/**
 * Cấu hình lương mới nhất của một người TẠI MỘT CƠ SỞ — cho nhân sự làm nhiều
 * cơ sở (Lao công, Marketing… — lib/work-branches): mỗi cơ sở trả một mức lương
 * cơ bản riêng. Cơ sở đó chưa cấu hình thì rơi về cấu hình mới nhất bất kỳ (như
 * người một cơ sở).
 */
export async function latestSalaryConfig(userId: string, branchId: string | null | undefined) {
  if (branchId) {
    const here = await prisma.salaryConfig.findFirst({
      where:   { userId, branchId },
      orderBy: { effectiveFrom: "desc" },
    });
    if (here) return here;
  }
  return prisma.salaryConfig.findFirst({
    where:   { userId },
    orderBy: { effectiveFrom: "desc" },
  });
}
