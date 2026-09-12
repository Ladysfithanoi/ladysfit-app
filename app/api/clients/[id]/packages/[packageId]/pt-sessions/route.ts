import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PUT /api/clients/[id]/packages/[packageId]/pt-sessions — ĐƯỜNG NÀY ĐÃ ĐÓNG.
//
// Nó từng ghi "Số buổi PT" bằng một con số trần cho (lộ trình · tháng):
// PTSessionAdjustment { enrollmentId, ptId, month, year, delta } — không ngày,
// không buổi, không người dạy cụ thể.
//
// Con số đó RA TIỀN nhưng không in được lên phiếu check-in, vì một dòng trên
// phiếu cần tối thiểu một NGÀY để in ra ô "Ngày" và để xếp thứ tự. Kết quả là
// bảng lương và phiếu check-in của cùng một khách không bao giờ khớp, và không
// chỗ nào giải thích nổi con số chênh — trong khi đường kia (dòng ghi tay trên
// phiếu) có đủ cả ngày lẫn tên HLV thì lại KHÔNG được tính lương. Cái ít thông
// tin hơn được trả tiền, cái nhiều thông tin hơn thì không.
//
// Nay thêm buổi bằng tay chỉ còn MỘT đường: dòng ghi tay trên phiếu check-in.
// Nó có ngày và có HLV nên đi được cả hai nơi — lên phiếu của khách và vào
// "Số buổi PT" của bảng lương (xem lib/manual-sheet-sessions).
//
// Giữ lại route để trả về câu chỉ đường: một tab mở từ trước vẫn bấm Lưu được,
// và im lặng 405 thì người dùng không hiểu chuyện gì. Các bản ghi delta cũ vẫn
// được cộng vào lương những tháng đã chốt, chỉ không sinh thêm bản mới.
export async function PUT() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(
    {
      error:
        "Số buổi PT nay ghi bằng buổi ghi tay trên phiếu check-in — mở Phiếu check-in của " +
        "lộ trình, bấm cây bút, rồi “Thêm buổi ghi tay” và chọn ngày cùng HLV. Buổi thêm ở " +
        "đó vào thẳng bảng lương và in luôn trên phiếu.",
    },
    { status: 410 }
  );
}
