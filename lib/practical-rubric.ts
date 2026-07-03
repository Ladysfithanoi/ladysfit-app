// ── Rubric bài kiểm tra thực hành PT (FM/Admin chấm) ─────────────────────────
// Mỗi tiêu chí chấm 1 / 3 / 5 điểm. Các mục "perExercise" được chấm cho từng bài
// tập trong buổi (mặc định 6 bài/buổi). Nội dung bám theo bảng chấm nội bộ.

export type RubricCriterion = {
  code: string;
  name: string;
  // Mô tả mốc 1, 3, 5 điểm (theo thứ tự)
  levels: [string, string, string];
};

export type RubricSection = {
  code: string;
  title: string;
  perExercise?: boolean; // true = chấm cho từng bài tập
  criteria: RubricCriterion[];
};

export const SCORE_OPTIONS = [1, 3, 5] as const;
export type ScoreValue = (typeof SCORE_OPTIONS)[number];

export const DEFAULT_EXERCISES_COUNT = 6;

export const PRACTICAL_RUBRIC: RubricSection[] = [
  {
    code: "TD",
    title: "Quy trình tiếp đón",
    criteria: [
      {
        code: "TD.1",
        name: "Mời nước & phá băng",
        levels: [
          "Không mời nước / không phá băng, vào việc luôn",
          "Có mời nước & phá băng nhưng qua loa, gượng gạo",
          "Đủ bước, tự nhiên, tạo thiện cảm — mời nước và phá băng khéo, đúng và hay",
        ],
      },
      {
        code: "TD.2",
        name: "Dẫn sale tour rồi mới vào CIF (đúng trình tự)",
        levels: [
          "Sai trình tự hoặc bỏ qua tour, vào CIF luôn",
          "Có dẫn tour nhưng chưa mạch lạc / chưa đúng trình tự",
          "Đủ bước, đúng trình tự (tour trước — CIF sau), dẫn dắt lưu loát, hay",
        ],
      },
    ],
  },
  {
    code: "3.1",
    title: "Lấy CIF",
    criteria: [
      {
        code: "3.1.1",
        name: "Xác định mục tiêu của khách hàng",
        levels: [
          "Không hỏi hoặc hỏi rất chung chung (“chị muốn giảm cân đúng không?”)",
          "Hỏi và ghi nhận mục tiêu cơ bản (giảm cân, săn chắc…)",
          "Xác định mục tiêu cụ thể, đo lường được, thời gian mong muốn; nắm được động lực và lý do đằng sau mục tiêu",
        ],
      },
      {
        code: "3.1.2",
        name: "Tiền sử tập luyện và dinh dưỡng",
        levels: [
          "Không hỏi hoặc chỉ hỏi qua loa, không ghi nhận thông tin cụ thể",
          "Có hỏi nhưng không cụ thể, rõ ràng theo trình tự phiếu CIF",
          "Hỏi sâu về thói quen vận động, lịch sử tập luyện, các xu hướng ăn kiêng từng thử, mức độ hiệu quả và cảm nhận",
        ],
      },
      {
        code: "3.1.3",
        name: "Đặc thù công việc & lối sống, sinh hoạt",
        levels: [
          "Không hỏi, bỏ qua hoặc hỏi rất hời hợt, không kết nối thông tin",
          "Hỏi chung chung về công việc & giờ giấc sinh hoạt",
          "Đào sâu tính chất công việc, giờ giấc ăn – ngủ – vận động cụ thể để thiết kế kế hoạch phù hợp",
        ],
      },
      {
        code: "3.1.4",
        name: "Tình trạng sức khỏe cần lưu ý",
        levels: [
          "Không hỏi về tình trạng sức khỏe cần lưu ý",
          "Có hỏi về bệnh lý cơ bản, tiền sử chấn thương",
          "Hỏi chi tiết bệnh lý nền, triệu chứng, tiền sử chấn thương, dùng thuốc; phân tích rủi ro và cảnh báo ban đầu (nếu có)",
        ],
      },
    ],
  },
  {
    code: "3.2",
    title: "Thuyết trình sản phẩm",
    criteria: [
      {
        code: "3.2.1",
        name: "Giới thiệu Ladysfit & “phương pháp giảm béo bền vững”",
        levels: [
          "Không giới thiệu hoặc nói qua loa, thiếu liên kết",
          "Nói được tên thương hiệu và mô tả phương pháp sơ lược",
          "Giới thiệu mạch lạc: sứ mệnh, triết lý “giảm béo bền vững”, lý do phù hợp phụ nữ Việt, gắn với mong muốn khách",
        ],
      },
      {
        code: "3.2.2",
        name: "Giới thiệu lộ trình 3 giai đoạn (tên, mục đích, ý nghĩa)",
        levels: [
          "Không trình bày hoặc liệt kê qua loa, sai trình tự",
          "Trình bày đầy đủ tên và mục đích của 3 giai đoạn",
          "Trình bày rõ ràng, lưu loát: tên, mục tiêu, ý nghĩa từng giai đoạn, giúp khách hình dung lộ trình và cam kết",
        ],
      },
      {
        code: "3.2.3",
        name: "Giới thiệu lộ trình sản phẩm trong từng giai đoạn",
        levels: [
          "Không nói hoặc nói rời rạc, không đầy đủ",
          "Trình bày cơ bản tên lộ trình, số buổi, thời gian và giá từng giai đoạn",
          "Trình bày chi tiết, tự tin, kèm lý do cấu trúc sản phẩm; lồng ghép ưu đãi / bảo hành kết quả (nếu có)",
        ],
      },
    ],
  },
  {
    code: "3.3",
    title: "Hướng dẫn bài tập theo TSDA",
    perExercise: true,
    criteria: [
      {
        code: "3.3.1",
        name: "Tên bài tập (Tell)",
        levels: [
          "Không nói hoặc nói sai tên bài tập, không rõ ràng",
          "Nói rõ tên bài tập một cách rõ ràng, đầy đủ",
          "Nói rõ tên bài tập, giọng dễ nghe, thân thiện, tươi cười",
        ],
      },
      {
        code: "3.3.2",
        name: "Tác dụng của bài tập (Tell)",
        levels: [
          "Không nói hoặc nói lan man, không đúng mục tiêu",
          "Nói đúng tác dụng cơ bản nhưng chưa gắn với mục tiêu khách",
          "Trình bày tác dụng rõ ràng, liên hệ mục tiêu giảm cân/giảm mỡ vùng liên quan, cho khách thấy lợi ích cụ thể",
        ],
      },
      {
        code: "3.3.3",
        name: "Quy trình thực hiện bài tập (Tell)",
        levels: [
          "Không nói hoặc nói rời rạc, không có trật tự",
          "Trình bày quy trình setup nhưng không theo thứ tự cụ thể",
          "Trình bày quy trình setup có thứ tự (từ dưới lên trên)",
        ],
      },
      {
        code: "3.3.4",
        name: "Thuyết minh & làm mẫu (Show)",
        levels: [
          "Làm mẫu qua loa, thiếu tự tin, không thuyết minh; thực hiện <3 reps",
          "Thực hiện 3–5 reps, có giải thích sơ qua",
          "Thực hiện 3–5+ reps chậm rãi, đúng kỹ thuật, có kiểm soát để khách quan sát",
        ],
      },
      {
        code: "3.3.5",
        name: "Tương tác với khách hàng (Show)",
        levels: [
          "Dừng lại nhưng không hỏi gì",
          "Có dừng lại hỏi nhưng chỉ qua loa",
          "Dừng đúng lúc để hỏi suy nghĩ / thắc mắc, tương tác thực sự, tạo sự kết nối",
        ],
      },
      {
        code: "3.3.6",
        name: "Trình bày phương pháp hít thở (Show)",
        levels: [
          "Không trình bày về cách hít thở",
          "Nói về hít thở nhưng không rõ khi nào hít, khi nào thở",
          "Trình bày rõ và hướng dẫn khách hít thở trong từng reps tập",
        ],
      },
      {
        code: "3.3.7",
        name: "Khoảng cách quan sát (Do)",
        levels: [
          "Không giữ khoảng cách phù hợp, đứng quá gần hoặc quá xa",
          "Giữ khoảng cách tạm ổn (0.8–1.5m) nhưng chưa ổn định / chủ động",
          "Duy trì khoảng cách hợp lý (1–1.2m), tạo cảm giác an toàn – kết nối",
        ],
      },
      {
        code: "3.3.8",
        name: "Di chuyển (Do)",
        levels: [
          "Không di chuyển, đứng im hoặc sai vị trí",
          "Có di chuyển qua lại nhưng không theo quy chuẩn",
          "Di chuyển quanh khách theo hình vòng cung, nhịp nhàng, hỗ trợ quan sát, đúng khoảng cách",
        ],
      },
      {
        code: "3.3.9",
        name: "Quan sát (Do)",
        levels: [
          "Gần như không chú ý đến khách hàng",
          "Có quan sát vài điểm nhưng bỏ sót các khớp quan trọng",
          "Quan sát theo đúng trình tự setup, tập trung khớp chuyển động chính và vùng nguy cơ sai kỹ thuật cao",
        ],
      },
      {
        code: "3.3.10",
        name: "Chạm (Do)",
        levels: [
          "Chạm khách mà không xin phép, chạm quá lâu / vị trí không phù hợp",
          "Có hỗ trợ nhưng chạm chưa đúng điểm hoặc thao tác còn thô",
          "Xin phép trước khi chạm, chỉ chạm vào vị trí khớp một cách nhanh gọn (hoặc không chạm)",
        ],
      },
      {
        code: "3.3.11",
        name: "Hỏi cảm nhận của khách hàng (Apply)",
        levels: [
          "Không hỏi lại",
          "Hỏi chung chung, sai trọng tâm, không khai thác sâu",
          "Hỏi cụ thể “chị cảm thấy thế nào sau bài tập”, thân thiện, tạo không gian để khách chia sẻ (kỹ thuật & cảm xúc)",
        ],
      },
      {
        code: "3.3.12",
        name: "Phân tích điểm tốt & điểm cần cải thiện (Apply)",
        levels: [
          "Không phản hồi rõ, hoặc chỉ nhắc lỗi mà không phân tích",
          "Nhận xét đúng lỗi nhưng chưa phân tích nguyên nhân / giải pháp cụ thể",
          "Chỉ ra điểm tốt, phân tích kỹ nguyên nhân lỗi (khớp/kỹ thuật sai) và gợi ý chỉnh sửa rõ ràng, dễ hiểu",
        ],
      },
      {
        code: "3.3.13",
        name: "Làm mẫu lại (Apply)",
        levels: [
          "Không làm mẫu lại",
          "Có làm lại nhưng chưa nhấn đúng điểm cần sửa",
          "Làm lại đúng trọng tâm, nhấn phần khách còn yếu, giúp khách hiểu rõ và cải thiện",
        ],
      },
    ],
  },
  {
    code: "3.4",
    title: "Kỹ thuật tập luyện",
    perExercise: true,
    criteria: [
      {
        code: "3.4.1",
        name: "Chuẩn bị động tác (setup)",
        levels: [
          "Không biết setup / setup sai tư thế, khớp chưa vào đúng vị trí, không ổn định",
          "Biết cách setup, tương đối đúng nhưng chưa ổn định, đồng đều giữa các lần",
          "Setup chắc chắn, đúng kỹ thuật, đúng thứ tự (chân–trục–core–tay–ánh mắt), ổn định qua nhiều lần",
        ],
      },
      {
        code: "3.4.2",
        name: "Thực hiện động tác",
        levels: [
          "Sai kỹ thuật hoặc không kiểm soát chuyển động, các khớp không liên kết",
          "Đúng kỹ thuật nhưng chưa kiểm soát nhịp độ, chưa ổn định / đồng đều giữa các reps",
          "Đủ biên độ (co – duỗi tối đa), kiểm soát nhịp độ & hít thở, các khớp liên kết nhịp nhàng — 10 reps như 1",
        ],
      },
      {
        code: "3.4.3",
        name: "Kết thúc động tác",
        levels: [
          "Kết thúc cẩu thả, thả lỏng đột ngột, thiếu kiểm soát, không an toàn (buông tạ rơi…)",
          "Biết cách kết thúc nhưng chưa ổn định, đồng đều giữa các lần",
          "Dừng đúng điểm, kiểm soát hạ xuống, đồng đều, gần như trở về setup — an toàn & sẵn sàng set kế tiếp",
        ],
      },
    ],
  },
];

export const FIXED_SECTIONS = PRACTICAL_RUBRIC.filter((s) => !s.perExercise);
export const PER_EXERCISE_SECTIONS = PRACTICAL_RUBRIC.filter((s) => s.perExercise);

const fixedCriteriaCount = FIXED_SECTIONS.reduce((n, s) => n + s.criteria.length, 0);
const perExerciseCriteriaCount = PER_EXERCISE_SECTIONS.reduce((n, s) => n + s.criteria.length, 0);
const MAX_PER_CRITERION = 5;

/** Điểm tối đa của buổi chấm với `exercisesCount` bài tập. */
export function maxScoreFor(exercisesCount: number): number {
  return (fixedCriteriaCount + perExerciseCriteriaCount * exercisesCount) * MAX_PER_CRITERION;
}

export type PracticalScores = Record<string, number>;
export type PracticalExercise = { name: string; scores: PracticalScores };

/** Tổng điểm đã chấm (bỏ qua tiêu chí chưa chấm). */
export function totalScoreOf(scores: PracticalScores, exercises: PracticalExercise[]): number {
  const sumMap = (m: PracticalScores) =>
    Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0);
  return sumMap(scores) + exercises.reduce((s, ex) => s + sumMap(ex.scores), 0);
}

/** Kiểm tra đã chấm đủ mọi tiêu chí (cố định + từng bài tập) chưa. */
export function isComplete(
  scores: PracticalScores,
  exercises: PracticalExercise[]
): boolean {
  const fixedOk = FIXED_SECTIONS.every((s) =>
    s.criteria.every((c) => SCORE_OPTIONS.includes(scores[c.code] as ScoreValue))
  );
  if (!fixedOk) return false;
  if (exercises.length === 0) return false;
  return exercises.every((ex) =>
    PER_EXERCISE_SECTIONS.every((s) =>
      s.criteria.every((c) => SCORE_OPTIONS.includes(ex.scores[c.code] as ScoreValue))
    )
  );
}
