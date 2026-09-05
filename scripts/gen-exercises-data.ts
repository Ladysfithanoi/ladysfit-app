import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
const prisma = new PrismaClient();

const GROUP_OF: Record<string, string> = {
  Squat: "LOWER", Hinge: "LOWER", "Lower Isolate": "LOWER", "Glute Attack": "LOWER",
  "Plyo Lower": "LOWER", quad: "LOWER", hamstring: "LOWER", glute: "LOWER", calf: "LOWER", inner_thigh: "LOWER",
  Push: "UPPER", Pull: "UPPER", "Upper Isolate": "UPPER", "Plyo Upper": "UPPER",
  arm: "UPPER", shoulder: "UPPER", back: "UPPER",
  Core: "CORE", core: "CORE",
  HIT: "CARDIO", MIT: "CARDIO", cardio: "CARDIO",
  warmup: "OTHER", cooldown: "OTHER",
};

async function main() {
  const rows = await prisma.workoutExercise.findMany({ select: { name: true, movement: true } });
  const tally = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    const pattern = r.movement.replace(/^[A-Z]\d*\.\s*/, "").trim();
    if (!pattern) continue;
    const m = tally.get(name) ?? new Map<string, number>();
    m.set(pattern, (m.get(pattern) ?? 0) + 1);
    tally.set(name, m);
  }
  const out: { name: string; pattern: string; group: string }[] = [];
  for (const [name, m] of Array.from(tally.entries())) {
    const counts: [string, number][] = Array.from(m.entries());
    const pattern = counts.sort((a, b) => b[1] - a[1])[0][0];
    const group = GROUP_OF[pattern];
    if (!group) { console.log("BO QUA (khong biet nhom):", name, "->", pattern); continue; }
    out.push({ name, pattern, group });
  }
  out.sort((a, b) => a.group.localeCompare(b.group) || a.pattern.localeCompare(b.pattern) || a.name.localeCompare(b.name));

  const body = out.map((e) => `  { name: ${JSON.stringify(e.name)}, pattern: ${JSON.stringify(e.pattern)}, group: "${e.group}" },`).join("\n");
  const header = `// Danh mục bài tập của ĐỀ THI — sinh từ Kho bài tập bằng scripts/gen-exercises-data.ts
//
// Vì sao chép ra file tĩnh thay vì đọc thẳng bảng workout_exercises: đề thi phải
// đứng yên. Admin sửa Kho bài tập giữa kỳ mà đề đổi theo thì bài đã chấm không
// tái lập được, và người thi hôm sau gặp một danh mục khác người thi hôm trước.
// Cùng lý do khiến lib/foods-data.ts là file tĩnh.
//
// Chạy lại script khi muốn danh mục đề bắt kịp Kho bài tập.

export type ExamExercise = {
  name: string;
  /** Mẫu vận động — Squat, Hinge, Push, Pull, Core… */
  pattern: string;
  /** Nhóm dùng để chấm khối lượng buổi tập. */
  group: "LOWER" | "UPPER" | "CORE" | "CARDIO" | "OTHER";
};

export const EXAM_EXERCISES: ExamExercise[] = [
${body}
];

/** Tra nhanh theo tên. */
export const EXERCISE_BY_NAME = new Map(EXAM_EXERCISES.map((e) => [e.name, e]));
`;
  fs.writeFileSync("lib/exercises-data.ts", header, "utf8");
  const byGroup = out.reduce<Record<string, number>>((a, e) => { a[e.group] = (a[e.group] ?? 0) + 1; return a; }, {});
  console.log(`Da sinh lib/exercises-data.ts: ${out.length} bai tap`);
  console.log(Object.entries(byGroup).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
}
main().finally(() => prisma.$disconnect());
