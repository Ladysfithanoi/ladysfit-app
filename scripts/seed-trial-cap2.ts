/**
 * Nạp bản nháp nội dung đủ 7 vòng của đề thử thách 7 đại tội cho một cấp độ.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-trial-cap2.ts "Cấp 2" [GREED ...]
 *
 * Chạy lại nhiều lần không nhân bản: vòng nhận diện theo ĐẠI TỘI trong cùng một
 * cấp (tên vòng người dùng sửa được nên không dùng làm mốc), có rồi thì ghi đè. Sau khi nạp, Admin vào Bài thi → Đề thử thách để
 * duyệt và sửa; sửa ở đó là nguồn sự thật, script này chỉ để mồi lần đầu.
 *
 * Script KHÔNG đổi dạng đề của cấp. Đổi sang "Thử thách nhiều vòng" là việc có
 * chủ ý ở Cài đặt → Cấp độ, vì nó đổi hẳn trang làm bài của mọi người ở cấp đó.
 */
import { PrismaClient, type ExamSortZone, type ExamSin } from "@prisma/client";
import * as GLUTTONY from "./trial-content/gluttony";
import * as LUST from "./trial-content/lust";
import * as GREED from "./trial-content/greed";
import * as PRIDE_PROGRAM from "./trial-content/pride-program";
import * as ENVY from "./trial-content/envy";
import * as WRATH from "./trial-content/wrath";
import * as SLOTH_PROGRAM from "./trial-content/sloth-program";

const prisma = new PrismaClient();

/**
 * Mọi vòng phân loại thẻ của đề, xếp theo thứ tự vòng.
 *
 * Nội dung nằm ở scripts/trial-content/<tội>.ts — mỗi đại tội một ngân hàng
 * khoảng 50 thẻ, và một lượt thi chỉ phát 13 trong số đó (TRIAL_CARDS_PER_ROUND
 * trong lib/exam-trial.ts). Thêm thẻ thì mở đúng file của tội đó, không đụng
 * vào script này.
 */
const SORT_ROUNDS: {
  sin: ExamSin;
  name: string;
  order: number;
  passPercent: number;
  failPenalty: number;
  intro: string;
  cards: { text: string; correctZone: ExamSortZone; explanation: string }[];
}[] = [
  { sin: "LUST",  name: "Dục vọng",   order: 1, passPercent: 70, failPenalty: 25, intro: LUST.INTRO,  cards: LUST.CARDS },
  { sin: "GREED", name: "Tham lam",   order: 2, passPercent: 65, failPenalty: 25, intro: GREED.INTRO, cards: GREED.CARDS },
  { sin: "ENVY",  name: "Ghen tị",    order: 4, passPercent: 65, failPenalty: 20, intro: ENVY.INTRO,  cards: ENVY.CARDS },
  { sin: "WRATH", name: "Phẫn nộ",    order: 5, passPercent: 65, failPenalty: 20, intro: WRATH.INTRO, cards: WRATH.CARDS },
];

async function main() {
  const levelName = process.argv[2] ?? "Cấp 2";

  // Đối số sau tên cấp: chỉ nạp những đại tội được liệt kê. Không có thì nạp hết.
  //
  // Cần bộ lọc này vì script ghi ĐÈ: nạp lại cả ba vòng sẽ xoá sạch phần nội
  // dung Admin đã sửa trong giao diện. Thêm một vòng mới thì chỉ nên đụng vào
  // đúng vòng đó.
  const only = new Set(process.argv.slice(3).map((s) => s.toUpperCase()));
  const wanted = (sin: ExamSin) => only.size === 0 || only.has(sin);

  const level = await prisma.pTLevel.findFirst({ where: { name: levelName } });
  if (!level) {
    console.error(`Không tìm thấy cấp độ "${levelName}".`);
    process.exit(1);
  }

  console.log(`Nạp đề thử thách cho cấp "${level.name}" (dạng đề hiện tại: ${level.examFormat})`);

  // ── Vòng Phàm ăn ──────────────────────────────────────────────────────────
  if (wanted("GLUTTONY")) {
    const meal = await upsertRound(level.id, "Phàm ăn", "MEAL", "GLUTTONY", {
      intro: GLUTTONY.INTRO,
      order: 0,
      maxPoints: 100,
      passPercent: 60,
      failPenalty: 20,
    });
    await prisma.examMealBrief.deleteMany({ where: { roundId: meal.id } });
    await prisma.examMealBrief.createMany({
      data: GLUTTONY.BRIEFS.map((b, i) => ({
        roundId: meal.id,
        order: i,
        kind: b.kind,
        clientProfile: b.clientProfile,
        targetCalories: b.targetCalories,
        targetProtein: b.targetProtein,
        targetFat: b.targetFat,
        targetCarbs: b.targetCarbs,
        tolerancePercent: b.tolerancePercent,
        bannedFoods: b.bannedFoods.length ? JSON.stringify(b.bannedFoods) : null,
        explanation: b.explanation,
      })),
    });
    console.log(`  Phàm ăn: ${GLUTTONY.BRIEFS.length} hồ sơ`);
  }

  // ── Vòng dựng giáo án ─────────────────────────────────────────────────────
  // Chuyên môn kỹ thuật không đo được bằng cách bấm một trong ba vùng. Vòng này
  // đổi từ phân loại thẻ sang case study ngày 05/09/2026; 50 thẻ cũ vẫn nằm
  // nguyên trong cơ sở dữ liệu, đổi type là dùng lại được.
  if (wanted("PRIDE")) {
    const round = await upsertRound(level.id, "Kiêu ngạo", "PROGRAM", "PRIDE", {
      intro: PRIDE_PROGRAM.INTRO,
      order: 3,
      maxPoints: 100,
      passPercent: 70,
      failPenalty: 25,
    });
    await prisma.examProgramCase.deleteMany({ where: { roundId: round.id } });
    await prisma.examProgramCase.createMany({
      data: PRIDE_PROGRAM.CASES.map((c, i) => ({
        roundId: round.id,
        order: i,
        clientProfile: c.clientProfile,
        targetTotalSets: c.targetTotalSets,
        targetLowerSets: c.targetLowerSets,
        targetUpperSets: c.targetUpperSets,
        targetCoreSets: c.targetCoreSets,
        tolerancePercent: c.tolerancePercent,
        requiredPatterns: c.requiredPatterns.length ? JSON.stringify(c.requiredPatterns) : null,
        bannedExercises: c.bannedExercises.length ? JSON.stringify(c.bannedExercises) : null,
        explanation: c.explanation,
      })),
    });
    console.log(`  ${round.name}: ${PRIDE_PROGRAM.CASES.length} hồ sơ giáo án`);
  }

  if (wanted("SLOTH")) {
    const round = await upsertRound(level.id, "Lười biếng", "PROGRAM", "SLOTH", {
      intro: SLOTH_PROGRAM.INTRO,
      order: 6,
      maxPoints: 100,
      passPercent: 65,
      failPenalty: 20,
    });
    await prisma.examProgramCase.deleteMany({ where: { roundId: round.id } });
    await prisma.examProgramCase.createMany({
      data: SLOTH_PROGRAM.CASES.map((c, i) => ({
        roundId: round.id,
        order: i,
        clientProfile: c.clientProfile,
        targetTotalSets: c.targetTotalSets,
        targetLowerSets: c.targetLowerSets,
        targetUpperSets: c.targetUpperSets,
        targetCoreSets: c.targetCoreSets,
        tolerancePercent: c.tolerancePercent,
        requiredPatterns: c.requiredPatterns.length ? JSON.stringify(c.requiredPatterns) : null,
        bannedExercises: c.bannedExercises.length ? JSON.stringify(c.bannedExercises) : null,
        explanation: c.explanation,
      })),
    });
    console.log(`  ${round.name}: ${SLOTH_PROGRAM.CASES.length} hồ sơ giáo án`);
  }

  // ── Các vòng phân loại thẻ ────────────────────────────────────────────────
  for (const r of SORT_ROUNDS) {
    if (!wanted(r.sin)) continue;
    const round = await upsertRound(level.id, r.name, "SORT", r.sin, {
      intro: r.intro,
      order: r.order,
      maxPoints: 100,
      passPercent: r.passPercent,
      failPenalty: r.failPenalty,
    });
    await prisma.examSortCard.deleteMany({ where: { roundId: round.id } });
    await prisma.examSortCard.createMany({
      data: r.cards.map((c, i) => ({
        roundId: round.id,
        order: i,
        text: c.text,
        correctZone: c.correctZone,
        explanation: c.explanation,
      })),
    });
    console.log(`  ${round.name}: ${r.cards.length} thẻ`);
  }

  console.log("\nXong. Vào Bài thi → Đề thử thách để duyệt và sửa.");
  console.log(
    level.examFormat === "TRIAL"
      ? "Cấp này đã ở dạng đề thử thách — người ở cấp này sẽ thi đề này."
      : `Cấp này vẫn đang dùng đề trắc nghiệm phẳng. Đổi dạng đề ở Cài đặt → Cấp độ khi bạn duyệt xong.`
  );
}

/** Vòng nhận diện theo tên trong cùng một cấp — chạy lại là ghi đè, không nhân bản. */
async function upsertRound(
  levelId: string,
  name: string,
  type: "MEAL" | "SORT" | "PROGRAM",
  sin: ExamSin,
  data: { intro: string; order: number; maxPoints: number; passPercent: number; failPenalty: number }
) {
  // Nhận diện theo ĐẠI TỘI, không theo tên.
  //
  // Tên vòng là ô người dùng sửa tự do. Lần trước script này dò theo tên: Admin
  // đổi tên một vòng, script không tìm thấy tên cũ nên tạo mới — đề tự nhân đôi
  // thành hai vòng cùng nội dung. Đại tội là danh sách đóng, không ai gõ tay,
  // nên nó mới là mốc nhận diện đúng.
  const existing =
    (await prisma.examRound.findFirst({ where: { levelId, sin } })) ??
    (await prisma.examRound.findFirst({ where: { levelId, type, sin: null } }));
  if (existing) {
    // GIỮ NGUYÊN TÊN Admin đã đặt. Tên vòng là thứ người dùng sửa trong giao
    // diện; nạp lại nội dung mà đè luôn tên thì công đổi tên của họ mất trắng
    // và họ không hề được báo. Chỉ vòng tạo mới mới lấy tên mặc định ở đây.
    return prisma.examRound.update({ where: { id: existing.id }, data: { type, sin, ...data } });
  }
  // VÒNG NẠP MỚI LUÔN Ở TRẠNG THÁI TẮT. Script này chỉ mồi nội dung; bật một
  // vòng là đổi hẳn bài thi của mọi người ở cấp đó, và thời lượng làm bài trong
  // Lịch thi phải đủ cho số vòng đang bật. Quyết định đó là của Admin sau khi
  // duyệt nội dung, không phải của một lệnh chạy trong terminal.
  return prisma.examRound.create({ data: { levelId, name, type, sin, isActive: false, ...data } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
