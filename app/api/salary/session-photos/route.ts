import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    ptId: string;
    clientId: string;
    packageEnrollmentId: string;
    month: number;
    year: number;
    checkinImages?: string[];
    transformImages?: string[];
    hasTransformed?: boolean;
  };

  const role = session.user.role;
  if (role !== "FM" && role !== "ADMIN" && session.user.id !== body.ptId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.checkinImages !== undefined) {
    updateData.checkinImages = body.checkinImages.length > 0
      ? JSON.stringify(body.checkinImages.slice(0, 2))
      : null;
  }
  if (body.transformImages !== undefined) {
    updateData.transformImages = body.transformImages.length > 0
      ? JSON.stringify(body.transformImages.slice(0, 3))
      : null;
  }
  if (body.hasTransformed !== undefined) {
    updateData.hasTransformed = body.hasTransformed;
  }

  const photo = await prisma.sessionPhoto.upsert({
    where: {
      ptId_packageEnrollmentId_month_year: {
        ptId: body.ptId,
        packageEnrollmentId: body.packageEnrollmentId,
        month: body.month,
        year: body.year,
      },
    },
    create: {
      ptId: body.ptId,
      clientId: body.clientId,
      packageEnrollmentId: body.packageEnrollmentId,
      month: body.month,
      year: body.year,
      ...updateData,
    },
    update: updateData,
  });

  return NextResponse.json({
    id: photo.id,
    checkinImages:   photo.checkinImages  ? JSON.parse(photo.checkinImages)  : [],
    transformImages: photo.transformImages ? JSON.parse(photo.transformImages) : [],
    hasTransformed:  photo.hasTransformed,
  });
}
