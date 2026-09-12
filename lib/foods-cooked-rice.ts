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
  category: string;
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
];
