import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChecklistPage } from "@/components/dashboard/checklist/checklist-page";

/**
 * `?userId=…&date=YYYY-MM-DD` — chuông Check-out dẫn FM tới thẳng check-list
 * của đúng người, đúng ngày. Đọc ở đây (máy chủ) thay vì useSearchParams để
 * không phải bọc cả trang trong Suspense.
 */
export default async function ChecklistPageRoute({
  searchParams,
}: {
  searchParams?: { userId?: string; date?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isFM      = role === "FM";
  const isPT      = role === "PT";
  const isAdmin   = role === "ADMIN";
  if (!isFM && !isPT && !isAdmin) redirect("/dashboard");

  const managedBranchIds: string[] = session.user.managedBranchIds ?? [];

  // Staff visible to current user
  let staffList: { id: string; name: string | null; email: string; branchId: string | null; role: string }[] = [];
  if (isAdmin) {
    staffList = await prisma.user.findMany({
      where: { role: "PT", deletedAt: null },
      select: { id: true, name: true, email: true, branchId: true, role: true },
      orderBy: { name: "asc" },
    });
  } else if (isFM) {
    staffList = await prisma.user.findMany({
      where: { branchId: { in: managedBranchIds }, deletedAt: null },
      select: { id: true, name: true, email: true, branchId: true, role: true },
      orderBy: { name: "asc" },
    });
  } else {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, branchId: true, role: true },
    });
    if (me) staffList = [me];
  }

  // Chỉ nhận nhân sự nằm trong danh sách người này được xem, và ngày đúng
  // dạng — đường dẫn là thứ ai cũng gõ tay sửa được.
  const wantedId   = searchParams?.userId;
  const initialTeamUserId = wantedId && staffList.some((s) => s.id === wantedId) ? wantedId : undefined;
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.date ?? "") ? searchParams!.date : undefined;

  return (
    <ChecklistPage
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? session.user.email ?? ""}
      currentUserRole={role}
      staffList={staffList}
      managedBranchIds={managedBranchIds}
      isAdmin={isAdmin}
      initialTeamUserId={initialTeamUserId}
      initialDate={initialDate}
    />
  );
}
