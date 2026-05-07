import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConsultationWizard } from "@/components/consultation/consultation-wizard";

export const dynamic = "force-dynamic";

export default async function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const c = await prisma.consultation.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, branchId: true } },
      branch: { select: { id: true, name: true } },
      info: true,
      assessment: true,
      packages: { orderBy: { order: "asc" } },
    },
  });

  if (!c) notFound();

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  // Access check: ADMIN sees all; FM sees consultations in their managed branches;
  // FREE/RESTRICTED see only their own
  if (!isAdmin) {
    if (isFM) {
      if (!managedBranchIds.includes(c.branchId)) redirect("/dashboard/consultation");
    } else {
      if (c.createdById !== session.user.id) redirect("/dashboard/consultation");
    }
  }

  const [branches, staff] = await Promise.all([
    prisma.branch.findMany({
      where: isFM ? { id: { in: managedBranchIds } } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: isFM ? { branchId: { in: managedBranchIds } } : undefined,
      select: { id: true, name: true, email: true, branchId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const { workoutDesignJson, ...cRest } = c;
  const consultationData = {
    ...JSON.parse(JSON.stringify(cRest)),
    workoutDesign: workoutDesignJson ? JSON.parse(workoutDesignJson) : null,
  };

  return (
    <ConsultationWizard
      consultation={consultationData}
      branches={branches}
      staff={staff}
      isAdmin={isAdmin}
      isFM={isFM}
      currentUserId={session.user.id}
      userRole={role}
    />
  );
}
