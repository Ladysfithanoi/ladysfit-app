export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveCalendarPage } from "@/components/dashboard/leave/leave-calendar-page";

/** Cơ sở của một nhân sự: PT/Admin theo branchId, FM theo các cơ sở phụ trách. */
type StaffRow = {
  id:              string;
  name:            string | null;
  email:           string;
  role:            string;
  branchId:        string | null;
  managedBranches: { branchId: string }[];
  jobPosition:     { name: string } | null;
};

function toStaff(u: StaffRow) {
  return {
    id:    u.id,
    name:  u.name,
    email: u.email,
    role:  u.role,
    // Nhân sự STAFF (lao công, marketing…) hiện theo tên chức vụ thay vì "STAFF".
    positionName: u.jobPosition?.name ?? null,
    branchIds: u.role === "FM"
      ? u.managedBranches.map(b => b.branchId)
      : (u.branchId ? [u.branchId] : []),
  };
}

const STAFF_SELECT = {
  id: true, name: true, email: true, role: true, branchId: true,
  managedBranches: { select: { branchId: true } },
  jobPosition:     { select: { name: true } },
} as const;

export default async function LeavePageRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role    = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM    = role === "FM";
  const isPT    = role === "PT";
  // STAFF (lao công, marketing…) cũng chấm ngày công nên được xem lịch nghỉ của chính mình.
  const isStaff = role === "STAFF";
  if (!isAdmin && !isFM && !isPT && !isStaff) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  // Nhân sự mà người đang đăng nhập được xem lịch — khớp canViewLeaveOf().
  // Riêng quyền TÍCH lịch chỉ Admin/FM mới có, xem canEditLeaveOf().
  // Cơ sở kèm theo để lọc theo cơ sở trước rồi mới chọn tên.
  let staffRows: StaffRow[] = [];
  let branches: { id: string; name: string }[] = [];

  if (isAdmin) {
    [staffRows, branches] = await Promise.all([
      prisma.user.findMany({
        where:   { role: { in: ["PT", "FM", "ADMIN", "STAFF"] }, deletedAt: null },
        select:  STAFF_SELECT,
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.branch.findMany({
        where:   { name: { not: { contains: "Fitpartner" } } },
        select:  { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
  } else if (isFM) {
    const [branchStaff, me, fmBranches] = await Promise.all([
      prisma.user.findMany({
        where:   { branchId: { in: managedBranchIds }, role: { in: ["PT", "ADMIN", "STAFF"] }, deletedAt: null },
        select:  STAFF_SELECT,
        orderBy: { name: "asc" },
      }),
      prisma.user.findUnique({ where: { id: session.user.id }, select: STAFF_SELECT }),
      prisma.branch.findMany({
        where:   { id: { in: managedBranchIds } },
        select:  { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    staffRows = me ? [me, ...branchStaff] : branchStaff;
    branches  = fmBranches;
  } else {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: STAFF_SELECT });
    if (me) staffRows = [me];
  }

  return (
    <LeaveCalendarPage
      currentUserId={session.user.id}
      currentUserRole={role}
      staffList={staffRows.map(toStaff)}
      branches={branches}
    />
  );
}
