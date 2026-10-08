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
  // STAFF (lao công, marketing…) vào đây chỉ để xem lương của chính mình.
  const isStaff = role === "STAFF";
  if (!isFM && !isPT && !isCOO && !isStaff) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  let branches: { id: string; name: string }[] = [];
  let staffList: { id: string; name: string | null; email: string; branchId: string | null; role: string; positionName?: string | null; hourlyPay?: boolean }[] = [];

  // Nhân sự STAFF (lao công, marketing…) có lương cứng theo ngày công như mọi
  // người, nên phải nằm trong danh sách tạo bảng lương và cấu hình lương của cơ sở.
  const STAFF_ROLES = ["PT", "ADMIN", "STAFF"] as const;
  const STAFF_FIELDS = {
    id: true, name: true, email: true, branchId: true, role: true,
    jobPosition: { select: { name: true, hourlyPay: true } },
  } as const;
  // hourlyPay: Lao công tính lương theo giờ (Số tiền/giờ × Số giờ làm).
  const flat = (rows: { id: string; name: string | null; email: string; branchId: string | null; role: string; jobPosition: { name: string; hourlyPay: boolean } | null }[]) =>
    rows.map(({ jobPosition, ...u }) => ({
      ...u, positionName: jobPosition?.name ?? null, hourlyPay: u.role === "STAFF" && !!jobPosition?.hourlyPay,
    }));

  // FM cũng dạy khách nên phải có mặt trong danh sách tạo bảng lương như PT/Admin.
  // FM gắn với cơ sở qua FMBranchAssignment (một cơ sở có thể có nhiều FM), KHÔNG
  // qua User.branchId — nên phải đọc riêng rồi ghép vào staffList theo từng cơ sở.
  // Admin và Lao công / Marketing làm nhiều cơ sở cũng gắn qua bảng này
  // (lib/work-branches): hiện ở MỌI cơ sở được gán, mỗi cơ sở một bảng lương.
  async function assignedStaffFor(branchIds: string[]) {
    const rows = await prisma.fMBranchAssignment.findMany({
      where: {
        ...(branchIds.length > 0 ? { branchId: { in: branchIds } } : {}),
        user: { role: { in: ["FM", "ADMIN", "STAFF"] }, deletedAt: null },
      },
      select: {
        branchId: true,
        user: { select: { id: true, name: true, email: true, role: true, jobPosition: { select: { name: true, hourlyPay: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      branchId: r.branchId,
      role: r.user.role as string,
      positionName: r.user.jobPosition?.name ?? null,
      hourlyPay: r.user.role === "STAFF" && !!r.user.jobPosition?.hourlyPay,
    }));
  }
  // Người đã có danh sách cơ sở làm việc thì đọc qua assignedStaffFor; chỉ
  // người một cơ sở (hoặc chưa gán) mới đọc theo branchId.
  const NOT_ASSIGNED_ADMIN = {
    NOT: { role: { in: ["ADMIN", "STAFF"] as ("ADMIN" | "STAFF")[] }, managedBranches: { some: {} } },
  };

  if (isCOO) {
    const [branchRows, staffRows, fmRows] = await Promise.all([
      prisma.branch.findMany({
        where: { name: { not: { contains: "Fitpartner" } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: { in: [...STAFF_ROLES] }, deletedAt: null, ...NOT_ASSIGNED_ADMIN },
        select: STAFF_FIELDS,
        orderBy: { name: "asc" },
      }),
      assignedStaffFor([]),
    ]);
    branches = branchRows;
    staffList = [...flat(staffRows), ...fmRows];
  } else if (isFM) {
    const [branchRows, staffRows, fmRows] = await Promise.all([
      prisma.branch.findMany({
        where: { id: { in: managedBranchIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { branchId: { in: managedBranchIds }, role: { in: [...STAFF_ROLES] }, deletedAt: null, ...NOT_ASSIGNED_ADMIN },
        select: STAFF_FIELDS,
        orderBy: { name: "asc" },
      }),
      assignedStaffFor(managedBranchIds),
    ]);
    branches = branchRows;
    staffList = [...flat(staffRows), ...fmRows];
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
