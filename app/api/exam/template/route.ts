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
      ["Câu hỏi", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng"],
      [
        "Squat đúng kỹ thuật cần chú ý điều gì?",
        "Giữ lưng thẳng",
        "Nhìn xuống",
        "Gối vượt mũi chân",
        "Thở vào khi đứng lên",
        "A",
      ],
      [
        "Cơ nào được kích hoạt chủ yếu khi thực hiện Romanian Deadlift?",
        "Cơ ngực",
        "Cơ lưng sau và cơ mông",
        "Cơ vai",
        "Cơ bắp tay",
        "B",
      ],
    ]);
    ws["!cols"] = [
      { wch: 50 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Câu hỏi");

    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;

    return new NextResponse(arr as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="cau-hoi-mau.xlsx"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi server";
    console.error("Exam template error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
