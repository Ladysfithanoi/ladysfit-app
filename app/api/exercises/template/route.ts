import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Tên bài tập"],
      ["Squat tạ đơn"],
      ["Romanian Deadlift"],
      ["Push up"],
    ]);
    ws["!cols"] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Bài tập");

    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

    return new NextResponse(arr as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="bai-tap-mau.xlsx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi server";
    console.error("Template route error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
