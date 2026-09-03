// Danh sách nguồn lead DÙNG CHUNG cho cả 2 nơi:
//  - "Phân nguồn" khi Thêm lead ở Setup Doanh số (components/dashboard/setup)
//  - "Biết LDF qua đâu?" ở Tư vấn - CIF (components/consultation/steps/step1-info)
// Trước đây 2 nơi liệt kê khác nhau (Facebook vs Facebook Page, Outdoor vs Tờ rơi…)
// nên đã thống nhất về một danh sách duy nhất tại đây.
//
// Lưu ý: "Referral" vẫn là giá trị kích hoạt ô nhập "Referral đến từ đâu?" ở cả
// hai nơi — không đổi tên/logic của nhánh này.
export const LEAD_SOURCES = [
  "Facebook Page",
  "Tiktok",
  "Instagram",
  "Thread",
  "Zalo",
  "Website",
  "Referral",
  "Referral.PT",
  "Bạn bè",
  "Hội viên cũ",
  "Tờ rơi (Voucher)",
  "Biển hiệu",
  "Tivi",
  "Báo, tạp chí",
  "Walk-in",
  "Thương hiệu cá nhân",
  "Renew",
  // Khách vừa tập xong gói trải nghiệm L0 → gói ngay kế tiếp được cấn trừ 2 triệu
  // đã đóng, và KHÔNG tính trợ giá tái ký. Luật giá ở lib/lead-pricing.ts.
  "Hậu L0",
];
