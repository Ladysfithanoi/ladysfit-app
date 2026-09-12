// ── Cơm ĐÃ NẤU CHÍN ─────────────────────────────────────────────────────────
//
// Kho thực phẩm dựng từ bảng thành phần VTN_FCT_2007, mà bảng đó ghi ngũ cốc ở
// dạng HẠT SỐNG: "Gạo tẻ máy" 344 kcal/100g, "Gạo lứt" 345 kcal/100g. Người soạn
// thực đơn thì cân bát cơm trên bàn ăn chứ không cân gạo trong thùng, nên gõ "cơm"
// vào ô tìm chỉ ra vài món đã chế biến sẵn (cơm tấm sườn, cơm gà xối mỡ) cộng đúng
// hai dòng cơm không: "Cơm trắng (chén)" và "Cơm gạo lứt (chén)".
//
// Lấy nhầm số gạo sống cho một bát cơm là sai gấp gần ba lần — 100g gạo nở thành
// khoảng 250g cơm — nên đây không phải chuyện tiện tay mà là chuyện tính sai khẩu
// phần.
//
// SỐ LIỆU theo 100g cơm đã chín, quy ra từng khẩu phần ở dưới:
//   trắng / Nhật / tấm     130 kcal · P 2.7 · C 28.2 · F 0.3
//   lứt, lứt đỏ            111 kcal · P 2.6 · C 23.0 · F 0.9
//   lứt đen (huyết rồng)   120 kcal · P 3.5 · C 25.0 · F 1.0
//   gạo mầm (GABA)         115 kcal · P 2.8 · C 24.0 · F 0.9
//   trộn lứt + trắng 1:1   120 kcal · P 2.7 · C 25.6 · F 0.6
//   nếp (xôi trắng)        185 kcal · P 3.5 · C 39.0 · F 0.5
//   quinoa                 120 kcal · P 4.4 · C 21.3 · F 1.9
//   yến mạch nấu như cơm   105 kcal · P 4.6 · C 17.9 · F 1.9
//   hạt sen luộc            89 kcal · P 4.1 · C 17.3 · F 0.5
//
// Món TRỘN quy ra theo tỉ lệ nấu thường gặp: cơm trộn hai loại hạt là 1:1, còn
// cơm hạt sen là 3 phần cơm 1 phần sen. Ai nấu khác tỉ lệ thì cân từng thứ bằng
// mốc 100g ở trên, đó là lý do mỗi loại đều có dòng 100g.
//
// KHẨU PHẦN đi theo đúng quy ước sẵn có của phiếu: "chén" = 200g. Thêm mốc 100g
// để cân thẳng, chén nhỏ 150g và bát đầy 300g cho hai loại hay dùng nhất.
//
// meal_type để TRỐNG có chủ đích: cơm là tinh bột nền, ăn bữa nào cũng được. Gắn
// "[Bữa trưa]" vào là mách nước sai cho AI dựng thực đơn — nó chỉ xếp cơm vào bữa
// trưa và bữa tối thành ra không có gì ăn (xem cách dựng bảng ở
// app/api/nutrition/generate-plan).

export type CookedRiceFood = {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  weight_g: number;
  category: string | null;
  meal_type: string | null;
};

export const COOKED_RICE_FOODS: CookedRiceFood[] = [
  // ── Cơm trắng ───────────────────────────────────────────────────────────
  { name: 'Cơm trắng (100g)',            calories: 130, protein: 2.7, fat: 0.3, carbs: 28.2, weight_g: 100, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm trắng (chén nhỏ 150g)',   calories: 195, protein: 4.1, fat: 0.5, carbs: 42.3, weight_g: 150, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm trắng (bát đầy 300g)',    calories: 390, protein: 8.1, fat: 0.9, carbs: 84.6, weight_g: 300, category: 'Giữ cân', meal_type: null },

  // ── Cơm gạo lứt ─────────────────────────────────────────────────────────
  { name: 'Cơm gạo lứt (100g)',          calories: 111, protein: 2.6, fat: 0.9, carbs: 23.0, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo lứt (chén nhỏ 150g)', calories: 167, protein: 3.9, fat: 1.4, carbs: 34.5, weight_g: 150, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo lứt (bát đầy 300g)',  calories: 333, protein: 7.8, fat: 2.7, carbs: 69.0, weight_g: 300, category: 'Giảm mỡ', meal_type: null },

  // ── Cơm gạo lứt đỏ ──────────────────────────────────────────────────────
  { name: 'Cơm gạo lứt đỏ (100g)',       calories: 111, protein: 2.5, fat: 0.9, carbs: 23.0, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo lứt đỏ (chén)',       calories: 222, protein: 5.0, fat: 1.8, carbs: 46.0, weight_g: 200, category: 'Giảm mỡ', meal_type: null },

  // ── Cơm gạo lứt đen / huyết rồng ────────────────────────────────────────
  { name: 'Cơm gạo lứt đen (100g)',      calories: 120, protein: 3.5, fat: 1.0, carbs: 25.0, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo lứt đen (chén)',      calories: 240, protein: 7.0, fat: 2.0, carbs: 50.0, weight_g: 200, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo huyết rồng (100g)',   calories: 120, protein: 3.5, fat: 1.0, carbs: 25.0, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo huyết rồng (chén)',   calories: 240, protein: 7.0, fat: 2.0, carbs: 50.0, weight_g: 200, category: 'Giảm mỡ', meal_type: null },

  // ── Cơm gạo mầm (GABA) ──────────────────────────────────────────────────
  { name: 'Cơm gạo mầm (100g)',          calories: 115, protein: 2.8, fat: 0.9, carbs: 24.0, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo mầm (chén)',          calories: 230, protein: 5.6, fat: 1.8, carbs: 48.0, weight_g: 200, category: 'Giảm mỡ', meal_type: null },

  // ── Cơm trộn lứt + trắng (1:1) — bước đệm khi khách chưa quen ăn lứt ────
  { name: 'Cơm trộn gạo lứt và gạo trắng (100g)', calories: 120, protein: 2.7, fat: 0.6, carbs: 25.6, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm trộn gạo lứt và gạo trắng (chén)', calories: 240, protein: 5.4, fat: 1.2, carbs: 51.2, weight_g: 200, category: 'Giảm mỡ', meal_type: null },

  // ── Cơm gạo Nhật (japonica) ─────────────────────────────────────────────
  { name: 'Cơm gạo Nhật (100g)',         calories: 130, protein: 2.7, fat: 0.3, carbs: 28.0, weight_g: 100, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm gạo Nhật (chén)',         calories: 260, protein: 5.4, fat: 0.6, carbs: 56.0, weight_g: 200, category: 'Giữ cân', meal_type: null },

  // ── Cơm tấm không (chỉ phần cơm, chưa tính sườn/bì/chả) ─────────────────
  { name: 'Cơm tấm không (100g)',        calories: 130, protein: 2.7, fat: 0.3, carbs: 28.2, weight_g: 100, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm tấm không (chén)',        calories: 260, protein: 5.4, fat: 0.6, carbs: 56.4, weight_g: 200, category: 'Giữ cân', meal_type: null },

  // ── Cơm nếp / xôi trắng — đặc hơn cơm tẻ nhiều, dễ ước nhầm ─────────────
  { name: 'Xôi trắng (100g)',            calories: 185, protein: 3.5, fat: 0.5, carbs: 39.0, weight_g: 100, category: 'Tăng cơ', meal_type: null },
  { name: 'Xôi trắng (gói 150g)',        calories: 278, protein: 5.3, fat: 0.8, carbs: 58.5, weight_g: 150, category: 'Tăng cơ', meal_type: null },

  // ── Cơm quinoa ──────────────────────────────────────────────────────────
  { name: 'Cơm quinoa (100g)',           calories: 120, protein: 4.4, fat: 1.9, carbs: 21.3, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm quinoa (chén)',           calories: 240, protein: 8.8, fat: 3.8, carbs: 42.6, weight_g: 200, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm trộn quinoa và gạo trắng (100g)', calories: 125, protein: 3.6, fat: 1.1, carbs: 24.8, weight_g: 100, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm trộn quinoa và gạo trắng (chén)', calories: 250, protein: 7.2, fat: 2.2, carbs: 49.6, weight_g: 200, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm trộn quinoa và gạo lứt (100g)',   calories: 116, protein: 3.5, fat: 1.4, carbs: 22.2, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm trộn quinoa và gạo lứt (chén)',   calories: 232, protein: 7.0, fat: 2.8, carbs: 44.4, weight_g: 200, category: 'Giảm mỡ', meal_type: null },

  // ── Cơm hạt sen (3 phần cơm : 1 phần hạt sen luộc) ──────────────────────
  { name: 'Cơm hạt sen (100g)',          calories: 120, protein: 3.1, fat: 0.4, carbs: 25.5, weight_g: 100, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm hạt sen (chén)',          calories: 240, protein: 6.2, fat: 0.8, carbs: 51.0, weight_g: 200, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm gạo lứt hạt sen (100g)',  calories: 106, protein: 3.0, fat: 0.8, carbs: 21.6, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm gạo lứt hạt sen (chén)',  calories: 212, protein: 6.0, fat: 1.6, carbs: 43.2, weight_g: 200, category: 'Giảm mỡ', meal_type: null },

  // ── Cơm yến mạch (yến mạch nấu ráo như cơm, không phải cháo) ────────────
  { name: 'Cơm yến mạch (100g)',         calories: 105, protein: 4.6, fat: 1.9, carbs: 17.9, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm yến mạch (chén)',         calories: 210, protein: 9.2, fat: 3.8, carbs: 35.8, weight_g: 200, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm trộn yến mạch và gạo lứt (100g)',  calories: 108, protein: 3.6, fat: 1.4, carbs: 20.5, weight_g: 100, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm trộn yến mạch và gạo lứt (chén)',  calories: 216, protein: 7.2, fat: 2.8, carbs: 41.0, weight_g: 200, category: 'Giảm mỡ', meal_type: null },
  { name: 'Cơm trộn yến mạch và gạo trắng (100g)', calories: 118, protein: 3.7, fat: 1.1, carbs: 23.1, weight_g: 100, category: 'Giữ cân', meal_type: null },
  { name: 'Cơm trộn yến mạch và gạo trắng (chén)', calories: 236, protein: 7.4, fat: 2.2, carbs: 46.2, weight_g: 200, category: 'Giữ cân', meal_type: null },
];

// ── Nguyên liệu nền còn THIẾU HẲN trong kho ─────────────────────────────────
//
// Bảng VTN_FCT_2007 là bảng thực phẩm Việt Nam năm 2007, nên không có quinoa lẫn
// yến mạch — kho hiện không có ĐÚNG MỘT DÒNG NÀO cho hai thứ này, kể cả dạng hạt
// khô. Thiếu chúng thì không chỉ cơm quinoa/yến mạch không ghi được, mà cả yến
// mạch ăn sáng cũng không có gì để chọn.
//
// Hạt sen thì kho đã có dạng khô và tươi, chỉ thiếu dạng ĐÃ LUỘC — mà ăn thì ăn
// hạt luộc chứ không ăn hạt khô.
//
// Để category/meal_type trống như mọi nguyên liệu thô khác trong kho.
export const MISSING_GRAIN_BASES: CookedRiceFood[] = [
  { name: 'Quinoa (hạt khô)',            calories: 368, protein: 14.1, fat: 6.1, carbs: 64.2, weight_g: 100, category: null, meal_type: null },
  { name: 'Yến mạch cán dẹt (khô)',      calories: 389, protein: 16.9, fat: 6.9, carbs: 66.3, weight_g: 100, category: null, meal_type: null },
  { name: 'Hạt sen luộc',                calories: 89,  protein: 4.1,  fat: 0.5, carbs: 17.3, weight_g: 100, category: null, meal_type: null },
];
