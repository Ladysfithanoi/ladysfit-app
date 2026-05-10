export type LocalFood = {
  nameVi: string;
  nameEn: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const VIETNAMESE_FOODS: LocalFood[] = [
  { nameVi: "Cơm trắng", nameEn: "White rice cooked", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { nameVi: "Phở bò", nameEn: "Pho beef noodle soup", calories: 215, protein: 14, carbs: 28, fat: 5 },
  { nameVi: "Bún bò Huế", nameEn: "Bun bo Hue", calories: 250, protein: 16, carbs: 30, fat: 7 },
  { nameVi: "Bánh mì thịt", nameEn: "Banh mi sandwich", calories: 320, protein: 15, carbs: 42, fat: 10 },
  { nameVi: "Rau muống xào", nameEn: "Stir-fried water spinach", calories: 45, protein: 3, carbs: 5, fat: 2 },
  { nameVi: "Thịt lợn ba chỉ", nameEn: "Pork belly", calories: 518, protein: 9, carbs: 0, fat: 53 },
  { nameVi: "Ức gà nướng", nameEn: "Grilled chicken breast", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { nameVi: "Cá hồi", nameEn: "Salmon", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { nameVi: "Trứng gà", nameEn: "Chicken egg", calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  { nameVi: "Đậu hũ", nameEn: "Tofu", calories: 76, protein: 8, carbs: 2, fat: 4 },
  { nameVi: "Khoai lang", nameEn: "Sweet potato", calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { nameVi: "Chuối", nameEn: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { nameVi: "Cơm gạo lứt", nameEn: "Brown rice cooked", calories: 216, protein: 5, carbs: 45, fat: 1.8 },
  { nameVi: "Bún tươi", nameEn: "Fresh rice vermicelli", calories: 109, protein: 2.6, carbs: 24, fat: 0.3 },
  { nameVi: "Bánh phở tươi", nameEn: "Fresh pho noodles", calories: 108, protein: 2.5, carbs: 23, fat: 0.2 },
  { nameVi: "Thịt gà ta", nameEn: "Free-range chicken", calories: 143, protein: 21, carbs: 0, fat: 6 },
  { nameVi: "Tôm sú", nameEn: "Black tiger shrimp", calories: 85, protein: 18, carbs: 1, fat: 1 },
  { nameVi: "Cá ngừ đóng hộp", nameEn: "Canned tuna in water", calories: 116, protein: 26, carbs: 0, fat: 1 },
  { nameVi: "Sữa chua không đường", nameEn: "Plain yogurt unsweetened", calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { nameVi: "Bơ (quả)", nameEn: "Avocado", calories: 160, protein: 2, carbs: 9, fat: 15 },
  { nameVi: "Ổi", nameEn: "Guava", calories: 68, protein: 2.6, carbs: 14, fat: 1 },
  { nameVi: "Xoài chín", nameEn: "Ripe mango", calories: 60, protein: 0.8, carbs: 15, fat: 0.4 },
  { nameVi: "Hạt điều rang", nameEn: "Roasted cashews", calories: 580, protein: 16, carbs: 30, fat: 46 },
  { nameVi: "Dầu ô liu", nameEn: "Olive oil", calories: 884, protein: 0, carbs: 0, fat: 100 },
  { nameVi: "Sữa bò tươi", nameEn: "Whole cow milk", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
];

export function searchLocalFoods(query: string): LocalFood[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return VIETNAMESE_FOODS.filter(
    (f) => f.nameVi.toLowerCase().includes(q) || f.nameEn.toLowerCase().includes(q)
  );
}
