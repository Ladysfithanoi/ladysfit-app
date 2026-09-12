/**
 * Thêm các món CƠM ĐÃ NẤU CHÍN vào kho thực phẩm.
 *
 * Kho dựng từ bảng VTN_FCT_2007, mà bảng đó ghi ngũ cốc ở dạng HẠT SỐNG — "Gạo tẻ
 * máy" 344 kcal/100g, "Gạo lứt" 345 kcal/100g. Người soạn thực đơn cân bát cơm
 * trên bàn ăn chứ không cân gạo trong thùng, nên gõ "cơm" vào ô tìm chỉ ra vài món
 * chế biến sẵn cộng đúng hai dòng cơm không. Danh sách bổ sung nằm ở
 * lib/foods-cooked-rice.ts, dùng chung với prisma/seed-foods.ts.
 *
 * CHỈ THÊM, không xoá, không sửa: món trùng tên đã có trong kho thì bỏ qua. Khác
 * hẳn prisma/seed-foods.ts — file đó XOÁ SẠCH bảng foods rồi nạp lại từ đầu, chạy
 * trên production là mất mọi món Admin tự thêm sau này.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/add-cooked-rice-foods.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/add-cooked-rice-foods.ts --apply   # thực thi
 *
 * Chạy lại lần hai thì không còn món nào để thêm.
 */
import { PrismaClient } from "@prisma/client";
import { COOKED_RICE_FOODS, MISSING_GRAIN_BASES } from "../lib/foods-cooked-rice";

const prisma = new PrismaClient({ log: ["error"] });
const apply = process.argv.includes("--apply");

async function main() {
  // Cơm nấu chín, kèm các nguyên liệu nền mà kho còn thiếu hẳn (quinoa, yến mạch).
  const wanted = [...COOKED_RICE_FOODS, ...MISSING_GRAIN_BASES];
  const names = wanted.map((f) => f.name);
  const existing = await prisma.food.findMany({
    where:  { name: { in: names } },
    select: { name: true },
  });
  const taken = existing.map((e) => e.name);

  const toAdd = wanted.filter((f) => !taken.includes(f.name));

  console.log(`Món trong danh sách              : ${wanted.length}`);
  console.log(`Đã có sẵn trong kho              : ${taken.length}`);
  console.log(`Sẽ thêm                          : ${toAdd.length}\n`);

  for (const f of toAdd) {
    console.log(
      `  ${f.name.padEnd(42)} ${String(f.calories).padStart(4)} kcal · ` +
      `P ${f.protein} · C ${f.carbs} · F ${f.fat}  / ${f.weight_g}g  (${f.category ?? "nguyên liệu"})`
    );
  }
  if (taken.length > 0) console.log(`\n  (bỏ qua vì đã có: ${taken.join(", ")})`);

  if (toAdd.length === 0) return;
  if (!apply) {
    console.log("\n(chỉ xem — thêm --apply để thực thi)");
    return;
  }

  const result = await prisma.food.createMany({
    data: toAdd.map((f) => ({
      name:      f.name,
      calories:  f.calories,
      protein:   f.protein,
      carbs:     f.carbs,
      fat:       f.fat,
      weight_g:  f.weight_g,
      category:  f.category,
      meal_type: f.meal_type,
    })),
  });

  console.log(`\nĐã thêm ${result.count} món. Tổng số món trong kho: ${await prisma.food.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
