/**
 * Dọn các giáo án mang loại tập KHÔNG THUỘC giai đoạn của chính nó.
 *
 * "Loại hình tập" (WorkoutProgram.workoutType) là khoá cấu trúc: nó chọn tên buổi
 * và bộ chuyển động dựng ra. Ô nhập nó trong giao diện vốn là một ô GÕ TỰ DO, và
 * khi FM đổi giai đoạn của một giáo án thì loại tập cũ được giữ nguyên — nên trong
 * kho có những giáo án như "Giai đoạn 1" + "Skinny Fat" (Skinny Fat là loại tập
 * của Giai đoạn 2), hay "Giai đoạn 1" + "Giảm cân" (chữ PT tự gõ).
 *
 * Hậu quả là một giáo án LAI: buổi tập dựng theo cấu trúc của giai đoạn kia
 * ("Full 1 / Full 2 / Mông") trong khi ô chọn bài tập tra kho theo giai đoạn ghi
 * trên giáo án, và với những chuyển động chỉ có ở giai đoạn kia thì danh sách bài
 * tập rỗng — PT buộc phải gõ tay từng bài.
 *
 * LÀM GÌ: chỉ ghi lại đúng MỘT cột, workoutType, cho những giáo án mà cặp
 * (giai đoạn, loại tập) không hợp lệ — xem isValidWorkoutType. Giá trị mới lấy
 * theo chính giai đoạn của giáo án (templateKey của WorkoutPhase, hoặc loại tập
 * nằm sẵn trong tên giai đoạn, hoặc bỏ trống khi giai đoạn không chia loại).
 *
 * KHÔNG đụng tới tuần, buổi, chuyển động hay nhật ký tập: những buổi đã tập là
 * lịch sử có thật, và buổi sắp tới thì PT tự sửa trong giáo án. Script này chỉ gỡ
 * cái khoá sai để lần dựng buổi tiếp theo ra đúng giai đoạn.
 *
 * Chạy:
 *   npx tsx --env-file=.env scripts/fix-program-workout-type.ts           # chỉ xem
 *   npx tsx --env-file=.env scripts/fix-program-workout-type.ts --apply   # thực thi
 *
 * Chạy lại lần hai thì không còn giáo án nào khớp điều kiện.
 */
import { PrismaClient } from "@prisma/client";
import { isValidWorkoutType, workoutTypeForPhase } from "../lib/workout-structure";

const prisma = new PrismaClient({ log: ["error"] });
const apply = process.argv.includes("--apply");

async function main() {
  const programs = await prisma.workoutProgram.findMany({
    select: {
      id: true,
      phase: true,
      workoutType: true,
      status: true,
      workoutPhase: { select: { templateKey: true } },
      client: { select: { fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const broken = programs.filter((p) => !isValidWorkoutType(p.phase, p.workoutType));

  console.log(`Tổng số giáo án: ${programs.length}`);
  console.log(`Cặp (giai đoạn, loại tập) không hợp lệ: ${broken.length}\n`);
  if (broken.length === 0) return;

  // Gom theo cách sửa để đọc được bằng mắt, thay vì trôi hàng trăm dòng.
  const byChange: { key: string; n: number; sample: string[] }[] = [];
  const updates: { id: string; next: string | null }[] = [];

  for (const p of broken) {
    const next = workoutTypeForPhase(p.phase, p.workoutPhase?.templateKey);
    updates.push({ id: p.id, next });
    const key = `${p.phase}  |  "${p.workoutType ?? ""}"  →  "${next ?? ""}"`;
    let row = byChange.find((r) => r.key === key);
    if (!row) byChange.push((row = { key, n: 0, sample: [] }));
    row.n++;
    if (row.sample.length < 3) row.sample.push(`${p.client?.fullName ?? "—"} (${p.status})`);
  }

  for (const row of byChange.sort((a, b) => b.n - a.n)) {
    console.log(`${String(row.n).padStart(4)}  ${row.key}`);
    console.log(`      vd: ${row.sample.join(", ")}`);
  }

  if (!apply) {
    console.log("\n(chỉ xem — thêm --apply để thực thi)");
    return;
  }

  // Gom các giáo án cùng giá trị mới lại, ghi theo lô thay vì từng dòng một.
  const byValue: { value: string | null; ids: string[] }[] = [];
  for (const u of updates) {
    let row = byValue.find((r) => r.value === u.next);
    if (!row) byValue.push((row = { value: u.next, ids: [] }));
    row.ids.push(u.id);
  }
  for (const row of byValue) {
    await prisma.workoutProgram.updateMany({
      where: { id: { in: row.ids } },
      data: { workoutType: row.value },
    });
  }

  console.log(`\nĐã sửa ${updates.length} giáo án.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
