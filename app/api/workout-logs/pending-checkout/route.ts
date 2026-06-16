import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/workout-logs/pending-checkout
// Sessions that were checked in (client signed in → package deducted) but have
// run more than 90 minutes WITHOUT a check-out signature — i.e. the PT hasn't
// confirmed teaching them yet, so they won't count toward the PT's salary.
// Surfaced on-demand to the PT who teaches the client and the FM of the branch.
const OVERDUE_MINUTES = 90;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const threshold = new Date(Date.now() - OVERDUE_MINUTES * 60_000);

  // Show which branch the client belongs to on Admin/CEO/FM dashboards so they
  // can tell clients apart. COO/PT don't need this extra column.
  const showBranch = role === "ADMIN" || role === "CEO_FITPARTNER" || role === "FM";

  // Scope: PT sees their own assigned clients; FM sees their managed branches;
  // ADMIN/COO/CEO_FITPARTNER see everything.
  let clientFilter: Record<string, unknown>;
  if (role === "FM") {
    const managedBranchIds: string[] = session.user.managedBranchIds ?? [];
    clientFilter = { branchId: { in: managedBranchIds } };
  } else if (role === "ADMIN" || role === "COO" || role === "CEO_FITPARTNER") {
    clientFilter = {};
  } else {
    // PT: only the clients assigned to them.
    clientFilter = { assignedPTId: session.user.id };
  }

  const logs = await prisma.workoutLog.findMany({
    where: {
      status: "IN_PROGRESS",
      checkInAt: { lt: threshold },
      client: clientFilter,
    },
    select: {
      id: true,
      checkInAt: true,
      client: {
        select: {
          id: true,
          fullName: true,
          assignedPT: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
      session: { select: { sessionName: true } },
    },
    orderBy: { checkInAt: "asc" },
  });

  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      clientId: l.client.id,
      clientName: l.client.fullName,
      ptName: l.client.assignedPT?.name ?? null,
      branchName: showBranch ? l.client.branch?.name ?? null : null,
      sessionName: l.session?.sessionName ?? "",
      checkInAt: l.checkInAt?.toISOString() ?? null,
    }))
  );
}
