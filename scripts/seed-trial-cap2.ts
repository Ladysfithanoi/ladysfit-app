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
import * as LUST from "./trial-content/lust";
import * as GREED from "./trial-content/greed";
import * as PRIDE from "./trial-content/pride";
import * as ENVY from "./trial-content/envy";
import * as WRATH from "./trial-content/wrath";
import * as SLOTH from "./trial-content/sloth";

const prisma = new PrismaClient();

// ── Vòng 1 · Phàm ăn ─────────────────────────────────────────────────────────
// Ba hồ sơ cố ý xếp theo một cung bậc: hai hồ sơ đầu thử sự tiết chế, hồ sơ
// cuối thử điều ngược lại. Tội "phàm ăn" của một HLV không chỉ là để khách ăn
// quá tay, mà còn là phản xạ cắt calo của bất kỳ ai bước vào phòng tập.
const MEAL_INTRO = `Mỗi hồ sơ là một khách thật với một mục tiêu thật.

Dựng khay ăn MỘT NGÀY cho họ bằng cách tìm món và điền số gam. Bảng số phía trên
cho biết khay của bạn đang có bao nhiêu calo và đạm; chỉ tiêu và sai số cho phép
ghi ngay bên dưới mỗi con số.

Hệ thống KHÔNG báo bạn đã đạt hay chưa — tự bạn phải tính. Món khách không được
ăn mà lọt vào khay thì hồ sơ đó mất trắng, dù các con số có đẹp tới đâu.`;

const MEAL_BRIEFS = [
  {
    clientProfile: `Chị Hương, 32 tuổi · 68kg · cao 158cm · nhân viên văn phòng, ngồi 9 tiếng/ngày.
Đăng ký gói L1, mục tiêu giảm 5kg trong 2 tháng. Tập 6 buổi/tuần.
Ăn trưa ở căng tin công ty, tối tự nấu. Không dị ứng gì.`,
    targetCalories: 1500,
    targetProtein: 110,
    targetFat: null,
    targetCarbs: null,
    tolerancePercent: 10,
    bannedFoods: [] as string[],
    explanation: `Thâm hụt vừa phải và đạm cao là xương sống của giai đoạn giảm cân:
cắt calo mà bỏ đạm thì khách sụt cân bằng cơ chứ không phải bằng mỡ, và cân sẽ
dội lại ngay khi ngừng. Đạm 110g ≈ 1.6g cho mỗi kg cân nặng — mức tối thiểu để
giữ cơ trong lúc thâm hụt. Muốn vừa đủ calo mà vẫn đủ đạm thì phải chọn nguồn
đạm nạc (ức gà, cá, đậu phụ) chứ không thể lấy thịt mỡ cho nhanh.`,
  },
  {
    clientProfile: `Cô Lan, 45 tuổi · 72kg · cao 155cm · nội trợ, huyết áp cao đang uống thuốc.
DỊ ỨNG HẢI SẢN — từng phải đi cấp cứu vì ăn nhầm tôm.
Đăng ký gói L2, mục tiêu giảm 7kg trong 3 tháng. Tập 5 buổi/tuần.`,
    targetCalories: 1600,
    targetProtein: 100,
    targetFat: null,
    targetCarbs: null,
    tolerancePercent: 10,
    bannedFoods: ["Tôm biển", "Tôm đồng", "Tôm khô", "Cua bể", "Cua đồng", "Mực tươi", "Mực khô"],
    explanation: `Hồ sơ này không khó về con số — nó khó ở chỗ bạn có đọc kỹ hay không.
Khách dị ứng hải sản tới mức từng phải cấp cứu. Một khay ăn đúng chằn chặn calo
và đạm mà có tôm trong đó là một khay ăn có thể đưa khách vào bệnh viện, nên nó
được 0 điểm chứ không phải "gần đúng". Dị ứng không phải chuyện thương lượng.`,
  },
  {
    clientProfile: `Em Trang, 25 tuổi · 48kg · cao 162cm · sinh viên năm cuối, hay bỏ bữa sáng.
KHÔNG muốn giảm cân — muốn TĂNG 3kg và có đường nét cơ. Tập 4 buổi/tuần.
Than "tập mãi không lên được cân nào".`,
    targetCalories: 2200,
    targetProtein: 95,
    targetFat: null,
    targetCarbs: null,
    tolerancePercent: 10,
    bannedFoods: [] as string[],
    explanation: `Đây là hồ sơ bẫy. Phần lớn khách tới phòng tập là để giảm, nên phản xạ
của HLV là cắt calo cho mọi người — và đó chính là tội phàm ăn phiên bản ngược:
ăn theo thói quen của chính mình chứ không theo nhu cầu của khách. Em này gầy,
hay bỏ bữa, muốn tăng cân: khay ăn phải THẶNG DƯ calo mới có chỗ cho cơ mọc.
Đạm 95g ≈ 2g/kg là đủ; nhồi thêm đạm mà thiếu calo thì vẫn không lên được cân.`,
  },
];

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
  // Kiêu ngạo gắt hơn phần còn lại vì gần như mọi thẻ vùng đỏ của nó là an toàn
  // thân thể của khách — qua loa ở đây thì hậu quả không nằm trong bảng điểm.
  { sin: "PRIDE", name: "Kiêu ngạo",  order: 3, passPercent: 70, failPenalty: 25, intro: PRIDE.INTRO, cards: PRIDE.CARDS },
  { sin: "ENVY",  name: "Ghen tị",    order: 4, passPercent: 65, failPenalty: 20, intro: ENVY.INTRO,  cards: ENVY.CARDS },
  { sin: "WRATH", name: "Phẫn nộ",    order: 5, passPercent: 65, failPenalty: 20, intro: WRATH.INTRO, cards: WRATH.CARDS },
  { sin: "SLOTH", name: "Lười biếng", order: 6, passPercent: 60, failPenalty: 20, intro: SLOTH.INTRO, cards: SLOTH.CARDS },
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
      intro: MEAL_INTRO,
      order: 0,
      maxPoints: 100,
      passPercent: 60,
      failPenalty: 20,
    });
    await prisma.examMealBrief.deleteMany({ where: { roundId: meal.id } });
    await prisma.examMealBrief.createMany({
      data: MEAL_BRIEFS.map((b, i) => ({
        roundId: meal.id,
        order: i,
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
    console.log(`  Phàm ăn: ${MEAL_BRIEFS.length} hồ sơ`);
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
  type: "MEAL" | "SORT",
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
