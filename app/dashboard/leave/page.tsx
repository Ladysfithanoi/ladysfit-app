export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveCalendarPage } from "@/components/dashboard/leave/leave-calendar-page";

export default async function LeavePageRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role    = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM    = role === "FM";
  const isPT    = role === "PT";
  if (!isAdmin && !isFM && !isPT) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  // Nhân sự mà người đang đăng nhập được tích lịch — khớp canManageLeaveOf().
  let staffList: { id: string; name: string | null; email: string; role: string }[] = [];
  if (isAdmin) {
    staffList = await prisma.user.findMany({
      where:   { role: { in: ["PT", "FM", "ADMIN"] }, deletedAt: null },
      select:  { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  } else if (isFM) {
    const branchStaff = await prisma.user.findMany({
      where:   { branchId: { in: managedBranchIds }, role: { in: ["PT", "ADMIN"] }, deletedAt: null },
      select:  { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    const me = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { id: true, name: true, email: true, role: true },
    });
    staffList = me ? [me, ...branchStaff] : branchStaff;
  } else {
    const me = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { id: true, name: true, email: true, role: true },
    });
    if (me) staffList = [me];
  }

  return (
    <LeaveCalendarPage
      currentUserId={session.user.id}
      currentUserRole={role}
      staffList={staffList}
    />
  );
}
