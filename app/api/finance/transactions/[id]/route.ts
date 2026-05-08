import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tx.referenceId) return NextResponse.json({ error: "Auto-generated rows cannot be edited" }, { status: 403 });

  const managed: string[] = session.user.managedBranchIds ?? [];
  if (!managed.includes(tx.branchId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    category?: string;
    amount?: number;
    description?: string;
    transactionDate?: string;
    receiptImages?: string;
    invoiceImages?: string;
  };

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      category:        body.category        ?? tx.category,
      amount:          body.amount          ?? tx.amount,
      description:     body.description     ?? tx.description,
      transactionDate: body.transactionDate ? new Date(body.transactionDate) : tx.transactionDate,
      receiptImages:   "receiptImages"  in body ? (body.receiptImages  ?? null) : tx.receiptImages,
      invoiceImages:   "invoiceImages"  in body ? (body.invoiceImages  ?? null) : tx.invoiceImages,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "FM") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tx = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tx.referenceId) return NextResponse.json({ error: "Auto-generated rows cannot be deleted" }, { status: 403 });

  const managed: string[] = session.user.managedBranchIds ?? [];
  if (!managed.includes(tx.branchId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.transaction.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
