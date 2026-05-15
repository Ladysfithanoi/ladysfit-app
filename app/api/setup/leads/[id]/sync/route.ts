import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncLeadToClient } from "@/lib/sync-lead-to-client";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (role !== "ADMIN" && role !== "CEO_FITPARTNER" && role !== "COO" && !isFM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lead = await prisma.salesLead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  if (isFM && !managedBranchIds.includes(lead.branchId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["PIF", "DE", "PB"].includes(lead.status)) {
    return NextResponse.json({ error: "Chỉ đồng bộ lead đã ký hợp đồng" }, { status: 400 });
  }

  const clientId = await syncLeadToClient({
    id: lead.id,
    phone: lead.phone,
    packageRegistered: lead.packageRegistered,
    actualRevenue: lead.actualRevenue,
    signDate: lead.signDate,
    assignedPTId: lead.assignedPTId,
  });

  if (!clientId) {
    return NextResponse.json({ synced: false, reason: "no_client" });
  }

  await prisma.salesLead.update({
    where: { id: params.id },
    data: { syncedClientId: clientId },
  });

  return NextResponse.json({ synced: true, clientId });
}
