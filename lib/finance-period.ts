/**
 * NGÀY GHI VÀO BẢNG THU — luôn nằm trong KỲ GHI NHẬN của hợp đồng.
 *
 * Setup doanh số cộng doanh thu theo month/year của lead; Bảng thu lại nhóm
 * theo transactionDate. Hai bên phải chỉ về cùng một tháng, nếu không thì tiền
 * ghi ở kỳ này lại hiện ra ở bảng thu của kỳ khác — nhìn từ Bảng thu thì y như
 * mất tiền, mà chẳng có gì báo cho ai biết.
 *
 * Đã xảy ra thật (rà ngày 05/09/2026): 94/326 hợp đồng có doanh thu nằm sai kỳ,
 * tổng 1.164,8 triệu không hiện đúng tháng. Hai đường vào:
 *
 *   • Lead KHÔNG có Ngày ký → dòng cũ lấy `new Date()`, tức là ngày mà lần đồng
 *     bộ đầu tiên tình cờ chạy. Hợp đồng tháng 3 mà đồng bộ chạy tháng 6 thì
 *     tiền rơi vào bảng thu tháng 6.
 *   • Ngày ký SAI (nhập từ Excel bị đảo ngày/tháng, hoặc sai năm) → dòng đi
 *     theo cái sai đó, có trường hợp rơi sang tận năm 2006.
 *
 * Thứ tự ưu tiên, dừng ở cái đầu tiên nằm trong kỳ:
 *
 *   1. Ngày ký — nếu nó thật sự thuộc kỳ.
 *   2. Ngày tạo hợp đồng — với hợp đồng nhập bình thường thì nó luôn nằm trong
 *      kỳ, nên hàm này TRẢ VỀ CÙNG MỘT GIÁ TRỊ ở mọi lần đồng bộ. Không có vế
 *      này thì mỗi lần sửa lead là ngày trên bảng thu lại nhảy, dù tháng vẫn
 *      đúng — người xem sổ không hiểu vì sao ngày cứ đổi.
 *   3. Ngày trong tháng của ngày ký, kẹp lại cho khỏi tràn tháng ngắn (ngày ký
 *      31/xx mà kỳ là tháng 2 thì lấy 28 hoặc 29).
 *   4. Cuối kỳ — và nếu kỳ đó là tháng đang chạy thì không vượt quá hôm nay.
 */
export function transactionDateFor(lead: {
  signDate: Date | null;
  month: number;
  year: number;
  createdAt?: Date | null;
}): Date {
  const { month, year } = lead;
  // Tháng/năm hỏng (dữ liệu cũ) thì không suy diễn gì, giữ nguyên lối cũ.
  if (!month || month < 1 || month > 12 || !year) return lead.signDate ?? new Date();

  const inPeriod = (d: Date | null | undefined) =>
    !!d && d.getFullYear() === year && d.getMonth() + 1 === month;

  if (inPeriod(lead.signDate)) return lead.signDate!;
  if (inPeriod(lead.createdAt)) return lead.createdAt!;

  const lastDay = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrentPeriod = now.getFullYear() === year && now.getMonth() + 1 === month;

  const day = lead.signDate
    ? Math.min(lead.signDate.getDate(), lastDay)
    : isCurrentPeriod
      ? Math.min(now.getDate(), lastDay)
      : lastDay;

  // 12h trưa: giờ nào trong ngày cũng ra đúng ngày đó ở cả giờ máy chủ lẫn UTC.
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
