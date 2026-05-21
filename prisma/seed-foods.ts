import { PrismaClient } from "@prisma/client";
import { FOODS } from "../lib/foods-data";

const prisma = new PrismaClient();

// Các món ăn chế biến (thực đơn hoàn chỉnh) — có weight_g, meal_type, category
const PREPARED_MEALS = [
  { name: 'Phở bò (tô)', calories: 430, protein: 28, fat: 12, carbs: 52, weight_g: 500, meal_type: 'Bữa sáng', category: 'Giảm mỡ' },
  { name: 'Phở gà (tô)', calories: 380, protein: 26, fat: 8, carbs: 50, weight_g: 500, meal_type: 'Bữa sáng', category: 'Giảm mỡ' },
  { name: 'Bún bò Huế (tô)', calories: 480, protein: 30, fat: 14, carbs: 58, weight_g: 500, meal_type: 'Bữa sáng', category: 'Giữ cân' },
  { name: 'Bún riêu cua (tô)', calories: 390, protein: 22, fat: 10, carbs: 50, weight_g: 500, meal_type: 'Bữa sáng', category: 'Giảm mỡ' },
  { name: 'Bún chả cá (tô)', calories: 360, protein: 24, fat: 8, carbs: 48, weight_g: 500, meal_type: 'Bữa sáng', category: 'Giảm mỡ' },
  { name: 'Bánh mì thịt nguội', calories: 320, protein: 15, fat: 10, carbs: 42, weight_g: 160, meal_type: 'Bữa sáng', category: 'Giữ cân' },
  { name: 'Bánh mì ốp la', calories: 350, protein: 18, fat: 14, carbs: 40, weight_g: 160, meal_type: 'Bữa sáng', category: 'Tăng cơ' },
  { name: 'Bánh mì trứng', calories: 330, protein: 16, fat: 12, carbs: 41, weight_g: 150, meal_type: 'Bữa sáng', category: 'Giữ cân' },
  { name: 'Xôi gà', calories: 450, protein: 24, fat: 10, carbs: 68, weight_g: 300, meal_type: 'Bữa sáng', category: 'Tăng cơ' },
  { name: 'Xôi xéo (đậu xanh)', calories: 380, protein: 10, fat: 8, carbs: 70, weight_g: 250, meal_type: 'Bữa sáng', category: 'Giữ cân' },
  { name: 'Xôi lạp xưởng', calories: 420, protein: 14, fat: 12, carbs: 68, weight_g: 280, meal_type: 'Bữa sáng', category: 'Giữ cân' },
  { name: 'Bánh bao thịt (1 cái)', calories: 220, protein: 10, fat: 5, carbs: 35, weight_g: 120, meal_type: 'Bữa sáng', category: 'Giữ cân' },
  { name: 'Cháo gà trắng (bát)', calories: 280, protein: 20, fat: 6, carbs: 38, weight_g: 400, meal_type: 'Bữa sáng', category: 'Giảm mỡ' },
  { name: 'Cháo đậu xanh (bát)', calories: 240, protein: 10, fat: 3, carbs: 45, weight_g: 400, meal_type: 'Bữa sáng', category: 'Giảm mỡ' },
  { name: 'Cơm trắng (chén)', calories: 260, protein: 5.4, fat: 0.6, carbs: 56, weight_g: 200, meal_type: 'Bữa trưa', category: 'Giữ cân' },
  { name: 'Cơm gạo lứt (chén)', calories: 216, protein: 5, fat: 1.8, carbs: 45, weight_g: 200, meal_type: 'Bữa trưa', category: 'Giảm mỡ' },
  { name: 'Cơm tấm sườn nướng', calories: 520, protein: 30, fat: 16, carbs: 62, weight_g: 350, meal_type: 'Bữa trưa', category: 'Tăng cơ' },
  { name: 'Cơm gà xối mỡ', calories: 580, protein: 32, fat: 20, carbs: 64, weight_g: 400, meal_type: 'Bữa trưa', category: 'Tăng cơ' },
  { name: 'Cơm bò lúc lắc', calories: 540, protein: 34, fat: 18, carbs: 58, weight_g: 380, meal_type: 'Bữa trưa', category: 'Tăng cơ' },
  { name: 'Cơm rang dương châu', calories: 490, protein: 18, fat: 16, carbs: 68, weight_g: 350, meal_type: 'Bữa trưa', category: 'Giữ cân' },
  { name: 'Bún chả Hà Nội (phần)', calories: 460, protein: 28, fat: 14, carbs: 54, weight_g: 400, meal_type: 'Bữa trưa', category: 'Giữ cân' },
  { name: 'Bún thịt nướng', calories: 440, protein: 26, fat: 12, carbs: 58, weight_g: 380, meal_type: 'Bữa trưa', category: 'Giữ cân' },
  { name: 'Bánh mì kẹp chả cá', calories: 360, protein: 22, fat: 10, carbs: 46, weight_g: 200, meal_type: 'Bữa trưa', category: 'Giảm mỡ' },
  { name: 'Gà hấp muối (100g)', calories: 165, protein: 31, fat: 3.6, carbs: 0, weight_g: 100, meal_type: 'Bữa trưa', category: 'Giảm mỡ' },
  { name: 'Ức gà nướng sả (100g)', calories: 145, protein: 28, fat: 3, carbs: 2, weight_g: 100, meal_type: 'Bữa trưa', category: 'Giảm mỡ' },
  { name: 'Cá hồi áp chảo (100g)', calories: 180, protein: 22, fat: 9, carbs: 1, weight_g: 100, meal_type: 'Bữa trưa', category: 'Tăng cơ' },
  { name: 'Tôm hấp (100g)', calories: 85, protein: 18, fat: 1, carbs: 1, weight_g: 100, meal_type: 'Bữa trưa', category: 'Giảm mỡ' },
  { name: 'Trứng luộc (1 quả)', calories: 78, protein: 6, fat: 5, carbs: 0.6, weight_g: 50, meal_type: 'Bữa phụ', category: 'Tăng cơ' },
  { name: 'Chuối (1 quả vừa)', calories: 89, protein: 1.1, fat: 0.3, carbs: 23, weight_g: 100, meal_type: 'Bữa phụ', category: 'Tăng cơ' },
  { name: 'Táo (1 quả)', calories: 72, protein: 0.4, fat: 0.2, carbs: 19, weight_g: 150, meal_type: 'Bữa phụ', category: 'Giảm mỡ' },
  { name: 'Sữa chua Vinamilk không đường (1 hộp)', calories: 61, protein: 3.5, fat: 3.3, carbs: 4.7, weight_g: 100, meal_type: 'Bữa phụ', category: 'Giảm mỡ' },
  { name: 'Hạt điều rang (30g)', calories: 180, protein: 5, fat: 14, carbs: 9, weight_g: 30, meal_type: 'Bữa phụ', category: 'Tăng cơ' },
  { name: 'Bánh gạo lứt (1 cái)', calories: 35, protein: 0.7, fat: 0.3, carbs: 7.5, weight_g: 9, meal_type: 'Bữa phụ', category: 'Giảm mỡ' },
  { name: 'Khoai lang luộc (1 củ)', calories: 130, protein: 2, fat: 0.1, carbs: 30, weight_g: 150, meal_type: 'Bữa phụ', category: 'Giảm mỡ' },
  { name: 'Đậu phụ hấp rau cải', calories: 120, protein: 12, fat: 6, carbs: 6, weight_g: 200, meal_type: 'Bữa tối', category: 'Giảm mỡ' },
  { name: 'Canh rau muống nấu cua', calories: 80, protein: 8, fat: 2, carbs: 8, weight_g: 300, meal_type: 'Bữa tối', category: 'Giảm mỡ' },
  { name: 'Rau cải luộc chấm kho', calories: 45, protein: 3, fat: 0.5, carbs: 7, weight_g: 200, meal_type: 'Bữa tối', category: 'Giảm mỡ' },
  { name: 'Canh bí đao thịt băm', calories: 120, protein: 10, fat: 5, carbs: 10, weight_g: 300, meal_type: 'Bữa tối', category: 'Giữ cân' },
  { name: 'Thịt bò xào rau cải', calories: 220, protein: 22, fat: 10, carbs: 10, weight_g: 250, meal_type: 'Bữa tối', category: 'Tăng cơ' },
  { name: 'Cá kho tộ (100g)', calories: 160, protein: 22, fat: 7, carbs: 3, weight_g: 100, meal_type: 'Bữa tối', category: 'Giảm mỡ' },
  { name: 'Đùi gà kho gừng (1 đùi)', calories: 280, protein: 24, fat: 16, carbs: 8, weight_g: 200, meal_type: 'Bữa tối', category: 'Tăng cơ' },
  { name: 'Canh chua cá (tô)', calories: 180, protein: 18, fat: 5, carbs: 16, weight_g: 400, meal_type: 'Bữa tối', category: 'Giảm mỡ' },
  { name: 'Tôm rang muối (100g)', calories: 120, protein: 20, fat: 3, carbs: 4, weight_g: 100, meal_type: 'Bữa tối', category: 'Giảm mỡ' },
  { name: 'Thịt heo kho trứng (1 phần)', calories: 320, protein: 26, fat: 20, carbs: 8, weight_g: 250, meal_type: 'Bữa tối', category: 'Tăng cơ' },
  // Bổ sung thêm Cá ngừ đóng hộp
  { name: 'Cá ngừ đóng hộp', calories: 116, protein: 26, fat: 1, carbs: 0, weight_g: 100, meal_type: 'Bữa trưa', category: 'Giảm mỡ' },
];

async function main() {
  console.log("=== WIPE & RESEED toàn bộ bảng foods ===");

  // 1. Xoá sạch toàn bộ
  const deleted = await prisma.food.deleteMany();
  console.log(`🗑️  Đã xoá ${deleted.count} bản ghi cũ`);

  // 2. Chuyển đổi FOODS (526 nguyên liệu từ VTN_FCT_2007) sang Food records
  const rawIngredients = FOODS.map((f) => ({
    name: f.name,
    calories: Number(f.calories) || 0,
    protein: Number(f.protein) || 0,
    carbs: Number(f.carbs) || 0,
    fat: Number(f.fat) || 0,
    weight_g: 100,
    category: null as string | null,
    meal_type: null as string | null,
  }));

  // 3. Kết hợp: nguyên liệu thô + món ăn chế biến
  const allFoods = [
    ...rawIngredients,
    ...PREPARED_MEALS.map((f) => ({
      name: f.name,
      calories: Number(f.calories) || 0,
      protein: Number(f.protein) || 0,
      carbs: Number(f.carbs) || 0,
      fat: Number(f.fat) || 0,
      weight_g: f.weight_g,
      category: f.category,
      meal_type: f.meal_type,
    })),
  ];

  console.log(`📋 Tổng số món cần seed: ${allFoods.length}`);
  console.log(`   → ${rawIngredients.length} nguyên liệu thô (VTN_FCT_2007)`);
  console.log(`   → ${PREPARED_MEALS.length} món ăn chế biến (có meal_type/category)`);

  // 4. Chunk 100 mỗi lần để tránh timeout
  const CHUNK_SIZE = 100;
  let totalInserted = 0;

  for (let i = 0; i < allFoods.length; i += CHUNK_SIZE) {
    const chunk = allFoods.slice(i, i + CHUNK_SIZE);
    const result = await prisma.food.createMany({
      data: chunk,
      skipDuplicates: false, // đã xoá sạch rồi nên không cần skip
    });
    totalInserted += result.count;
    console.log(`   ✓ Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: +${result.count} món (tổng: ${totalInserted})`);
  }

  console.log(`\n✅ SEED HOÀN TẤT: ${totalInserted}/${allFoods.length} món đã được nạp vào Supabase`);

  // 5. Nghiệm thu
  const finalCount = await prisma.food.count();
  console.log(`📊 SỐ MÓN THỰC TẾ TRONG DATABASE: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
