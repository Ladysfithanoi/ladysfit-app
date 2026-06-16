import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_SESSION_MINUTES, voidOverCapSessions } from "@/lib/workout-session";

// GET /api/workout-logs/pending-checkout
// Sessions that were checked in (client signed in → package deducted) but have
// run more than 90 minutes WITHOUT a check-out signature — i.e. the PT hasn't
// confirmed teaching them yet, so they won't count toward the PT's salary.
// Surfaced on-demand to the PT who teaches the client and the FM of the branch.
//
// Window is [90', 2h cap]: once a session passes the 2-hour cap it's considered
// abandoned and auto-voided (it can no longer be legitimately checked out), so it
// drops off this list instead of lingering for hundreds of hours.
const OVERDUE_MINUTES = 90;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Self-heal: clear out sessions that ran past the 2-hour cap so they neither
  // show here nor keep counting. This endpoint is polled by every open dashboard,
  // so over-cap sessions get cleaned up promptly even between cron runs.
  await voidOverCapSessions();

  const role = session.user.role;
  const overdue = new Date(Date.now() - OVERDUE_MINUTES * 60_000);
  const capThreshold = new Date(Date.now() - MAX_SESSION_MINUTES * 60_000);

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
      // Checked in 90'+ ago but still within the 2-hour cap (older ones were just
      // voided above), so they're actionable nudges, not abandoned sessions.
      checkInAt: { lt: overdue, gte: capThreshold },
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
