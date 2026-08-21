export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalaryPage } from "@/components/dashboard/salary/salary-page";

export default async function SalaryPageRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isFM = role === "FM";
  const isCOO = role === "COO";
  const isPT = role === "PT";
  if (!isFM && !isPT && !isCOO) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  let branches: { id: string; name: string }[] = [];
  let staffList: { id: string; name: string | null; email: string; branchId: string | null; role: string }[] = [];

  // FM cũng dạy khách nên phải có mặt trong danh sách tạo bảng lương như PT/Admin.
  // FM gắn với cơ sở qua FMBranchAssignment (một cơ sở có thể có nhiều FM), KHÔNG
  // qua User.branchId — nên phải đọc riêng rồi ghép vào staffList theo từng cơ sở.
  async function fmStaffFor(branchIds: string[]) {
    const rows = await prisma.fMBranchAssignment.findMany({
      where: {
        ...(branchIds.length > 0 ? { branchId: { in: branchIds } } : {}),
        user: { role: "FM", deletedAt: null },
      },
      select: {
        branchId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      branchId: r.branchId,
      role: "FM",
    }));
  }

  if (isCOO) {
    const [branchRows, staffRows, fmRows] = await Promise.all([
      prisma.branch.findMany({
        where: { name: { not: { contains: "Fitpartner" } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: { in: ["PT", "ADMIN"] }, deletedAt: null },
        select: { id: true, name: true, email: true, branchId: true, role: true },
        orderBy: { name: "asc" },
      }),
      fmStaffFor([]),
    ]);
    branches = branchRows;
    staffList = [...staffRows, ...fmRows];
  } else if (isFM) {
    const [branchRows, staffRows, fmRows] = await Promise.all([
      prisma.branch.findMany({
        where: { id: { in: managedBranchIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { branchId: { in: managedBranchIds }, role: { in: ["PT", "ADMIN"] }, deletedAt: null },
        select: { id: true, name: true, email: true, branchId: true, role: true },
        orderBy: { name: "asc" },
      }),
      fmStaffFor(managedBranchIds),
    ]);
    branches = branchRows;
    staffList = [...staffRows, ...fmRows];
  }

  return (
    <SalaryPage
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? session.user.email ?? ""}
      currentUserRole={role}
      managedBranchIds={managedBranchIds}
      branches={branches}
      staffList={staffList}
    />
  );
}
