import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsWithTabs } from "@/components/dashboard/settings-with-tabs";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";

  // FM has no settings they can manage (staff management not yet in this page)
  if (isFM) redirect("/dashboard");

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-base font-extrabold text-gray-300">Không có quyền truy cập</p>
        <p className="text-sm text-gray-400">Trang này chỉ dành cho tài khoản Admin.</p>
      </div>
    );
  }

  const branches = await prisma.branch.findMany({
    include: { _count: { select: { users: true, clients: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <SettingsWithTabs
      initialBranches={branches}
    />
  );
}
