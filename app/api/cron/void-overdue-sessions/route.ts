import { NextResponse } from "next/server";
import { voidOverCapSessions } from "@/lib/workout-session";

// Hourly sweep: void any session that was checked in but never checked out and
// has now run past the 2-hour cap. Backstop for sessions nobody opens a
// dashboard for — the pending-checkout endpoint self-heals the rest on demand.
// Voided sessions don't count for the PT's salary and the buổi is not refunded
// (client already signed the check-in). See voidOverCapSessions for details.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const voided = await voidOverCapSessions();
  return NextResponse.json({ voided });
}
