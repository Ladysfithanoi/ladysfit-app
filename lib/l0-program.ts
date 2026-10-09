// ── Lộ trình L0 (4 buổi trải nghiệm) — nội dung chuẩn + phép tính lỗi kỹ thuật ──
//
// Nguồn: "Quy trình hướng dẫn kỹ thuật & kịch bản triển khai" (TSDR, thư viện 10
// bài × 5 lỗi, kịch bản 4 buổi), "Hồ sơ khách hàng L0 (D1–D4)" và "Phiếu đánh giá
// FM". Mọi màn hình L0 — bảng nhắc của PT, app khách, thống kê FM/Admin — đọc nội
// dung và luật từ đây, không chép lại chỗ khác.
//
// Giáo án L0 không dựng riêng: đó là giáo án giai đoạn "Giai đoạn 0: Khởi động"
// Admin đã tạo ở Kho bài tập, mỗi buổi mang loại "Ngày 1" … "Ngày 4" (tên buổi
// dạng "Buổi 5 — Ngày 1"). Ngày N của buổi quyết định kịch bản áp dụng.
//
// Luật cốt lõi của tài liệu: Buổi 1–3 PT chỉ Tell → Show → Do, quan sát và tick
// lỗi nhưng KHÔNG nói lỗi với khách; toàn bộ Review dồn vào Buổi 4. Vì vậy app
// khách chỉ thấy lỗi kỹ thuật khi đã xong Buổi 4 (l0FaultsVisibleToClient).
//
// File này không import prisma để component client cũng dùng được.

export const L0_PHASE_PREFIX = "Giai đoạn 0";

export type L0Day = 1 | 2 | 3 | 4;

/** Giáo án thuộc lộ trình L0 (giai đoạn "Giai đoạn 0: …"). */
export function isL0Phase(phase: string | null | undefined): boolean {
  return !!phase && phase.trim().startsWith(L0_PHASE_PREFIX);
}

/** Ngày L0 của một buổi, đọc từ loại buổi trong tên ("Buổi 5 — Ngày 1" → 1). */
export function l0DayOf(phase: string | null | undefined, sessionName: string | null | undefined): L0Day | null {
  if (!isL0Phase(phase) || !sessionName) return null;
  const m = sessionName.match(/Ng[aà]y\s*([1-4])\b/i);
  return m ? (Number(m[1]) as L0Day) : null;
}

// ── Khung TSDR ───────────────────────────────────────────────────────────────

export const TSDR_STEPS: { key: "T" | "S" | "D" | "R"; name: string; goal: string; points: string[] }[] = [
  {
    key: "T",
    name: "Tell",
    goal: "Giúp khách hiểu TẠI SAO bài tập này quan trọng.",
    points: [
      "Nói rõ tên bài với thái độ vui vẻ, thân thiện, tươi cười.",
      "Nêu lợi ích cụ thể — gắn với giảm béo toàn thân, thon gọn vóc dáng.",
      "Khơi gợi cảm xúc, hình ảnh kết quả tích cực.",
      "Hướng dẫn setup theo thứ tự từ dưới lên trên.",
    ],
  },
  {
    key: "S",
    name: "Show",
    goal: "Giúp khách hình dung trực quan khi thực hiện.",
    points: [
      "Làm mẫu 5+ reps chậm rãi, đúng kỹ thuật, không nói nhiều khi làm mẫu.",
      "Dừng rõ ở điểm bắt đầu và kết thúc động tác.",
      "Tối đa 3 điểm CẦN LÀM — KHÔNG liệt kê lỗi / điều không nên làm.",
      "Hỏi khách còn thắc mắc gì sau khi làm mẫu.",
    ],
  },
  {
    key: "D",
    name: "Do",
    goal: "Khách tự thực hiện với sự đồng hành của PT.",
    points: [
      "Giúp khách thiết lập tư thế ban đầu (từ dưới lên).",
      "Giữ khoảng cách quan sát 1 – 1,2m, di chuyển vòng cung quanh khách.",
      "Quan sát theo trình tự setup, chú ý khớp chính và điểm dễ sai.",
      "Xin phép trước khi chạm, chỉ chạm vào vị trí khớp và thật nhanh.",
    ],
  },
  {
    key: "R",
    name: "Review",
    goal: "Phản hồi, chỉnh sửa mà vẫn giữ sự tự tin của khách.",
    points: [
      "Hỏi cảm nhận: \"Chị thấy thế nào sau khi thực hiện bài này?\"",
      "Khen điểm khách đã làm đúng.",
      "Góp ý ĐÚNG 1 lỗi cụ thể (nếu có) + gợi ý sửa ngắn gọn.",
      "Chốt bằng một câu động viên; hỏi khách có cần làm mẫu lại không.",
    ],
  },
];

// ── Thư viện bài tập & 5 lỗi thường gặp ─────────────────────────────────────

export type L0Fault = { title: string; fix: string };

export type L0Exercise = {
  key: string;
  name: string;
  /** Học ở buổi nào (Buổi 1 hay Buổi 2). */
  day: 1 | 2;
  joints: string;
  muscles: string;
  purpose: string;
  setup: string;
  cues: [string, string, string];
  faults: L0Fault[];
  /** Khớp tên bài trong giáo án (tên bài ở Kho bài tập rất đa dạng). */
  match: RegExp;
};

export const L0_EXERCISES: L0Exercise[] = [
  // Bước bục / split squat phải đứng TRƯỚC squat thường — cùng có chữ "squat".
  {
    key: "step-up",
    name: "Assisted Step Up / Split Squat",
    day: 2,
    joints: "Hông, gối, cổ chân (một bên)",
    muscles: "Mông và đùi trước chủ đạo (một bên — unilateral); đùi sau hỗ trợ.",
    purpose: "Cải thiện sức mạnh và cân bằng từng bên — phát hiện và giảm lệch trái-phải.",
    setup: "Đặt cả bàn chân lên bục, trọng tâm dồn đều lên chân trên bục, thân người thẳng, có thể vịn nhẹ để giữ thăng bằng.",
    cues: [
      "Đẩy người lên chủ yếu bằng chân trên bục.",
      "Giữ ngực hướng lên, thân người gần như thẳng đứng.",
      "Hạ xuống có kiểm soát trong 2-3 giây.",
    ],
    faults: [
      { title: "Dùng chân trụ dưới đất đẩy người lên", fix: "Cue \"chân trên bục làm hết việc\", chân dưới chỉ chạm nhẹ giữ thăng bằng." },
      { title: "Gối chân trước đổ vào trong khi đẩy lên", fix: "Nhắc đẩy gối theo hướng mũi chân, giống lỗi ở Box Squat." },
      { title: "Thân người ngả quá nhiều về trước", fix: "Cue giữ ngực hướng lên, thân người gần như thẳng đứng." },
      { title: "Bước xuống / hạ xuống buông rơi tự do", fix: "Yêu cầu hạ xuống có kiểm soát trong 2-3 giây." },
      { title: "(Split Squat) chân sau quá gần, gối trước vượt mũi chân nhiều", fix: "Đặt hai chân rộng hơn để gối trước giữ thẳng trục cẳng chân." },
    ],
    match: /step\s*-?\s*up|split\s*squat/i,
  },
  {
    key: "box-squat",
    name: "Bodyweight Box Squat",
    day: 1,
    joints: "Hông, gối, cổ chân",
    muscles: "Mông (gluteus maximus) và đùi trước (quadriceps) chủ đạo; đùi sau và dựng cột sống hỗ trợ ổn định.",
    purpose: "Xây nền squat pattern — nền tảng sức mạnh chi dưới và khả năng ngồi-đứng an toàn trong sinh hoạt.",
    setup: "Chân rộng bằng vai, mũi chân hơi xoay ra ngoài ~15°, hộp/ghế đặt sau, mắt nhìn thẳng.",
    cues: [
      "Đẩy hông ra sau trước khi ngồi xuống.",
      "Gót chân giữ chạm sàn suốt bài.",
      "Ngực hướng lên xuyên suốt động tác.",
    ],
    faults: [
      { title: "Gối đổ vào trong khi đứng lên", fix: "Nhắc khách chủ động \"đẩy gối ra ngoài theo hướng mũi chân\" khi đứng lên." },
      { title: "Nhấc gót, dồn trọng tâm lên mũi chân", fix: "Cho khách cảm nhận gót chân dính sàn suốt bài." },
      { title: "Lưng dưới cong tròn (butt wink) ở đáy", fix: "Giảm biên độ (chạm hộp cao hơn) đến khi khách giữ được cột sống trung tính." },
      { title: "Ngồi xuống quá nhanh, thả rơi vào ghế", fix: "Đếm nhịp 3 giây khi hạ xuống để khách chủ động kiểm soát pha âm." },
      { title: "Đứng lên kiểu \"cúi chào\" (hông nhô ra sau/lên trước)", fix: "Cue \"đẩy sàn xuống\" thay vì \"đứng lên\", hông và vai đi lên cùng lúc." },
    ],
    match: /squat/i,
  },
  {
    key: "row",
    name: "Seated Cable Row / Dumbbell Prone Row",
    day: 1,
    joints: "Vai, khuỷu tay",
    muscles: "Lưng giữa (rhomboids, trapezius giữa) chủ đạo; cơ xô và nhị đầu tay hỗ trợ.",
    purpose: "Cân bằng nhóm cơ kéo với nhóm cơ đẩy — cải thiện tư thế lưng trên, đặc biệt nếu khách ngồi/cúi nhiều.",
    setup: "Ngồi/nằm sấp ổn định, lưng giữ đường cong tự nhiên, vai hạ thấp xa tai trước khi kéo.",
    cues: [
      "Khuỷu tay dẫn hướng về phía sau.",
      "Giữ lưng thẳng, không dùng đà thân người.",
      "Siết xương bả vai ở cuối mỗi rep.",
    ],
    faults: [
      { title: "Dùng đà lắc thân người để kéo", fix: "Giảm tạ, giữ thân cố định, chỉ tay và vai di chuyển." },
      { title: "Nhún vai lên tai khi kéo", fix: "Cue \"hạ vai xuống trước, rồi mới kéo tay\" trước mỗi lần lặp." },
      { title: "Kéo bằng tay/nhị đầu, khuỷu tay không dẫn hướng", fix: "Tưởng tượng \"kéo khuỷu tay về phía sau túi quần\"." },
      { title: "Lưng cong tròn, gù vai trên khi kéo", fix: "Nhắc ngực mở, xương bả vai siết lại thay vì cuộn vai tới trước." },
      { title: "Buông tạ về nhanh, không kiểm soát pha thả", fix: "Đếm nhịp 2-3 giây khi duỗi tay về vị trí ban đầu." },
    ],
    match: /\brow\b/i,
  },
  {
    key: "lat-pulldown",
    name: "OVH/UDH Lat Pulldown",
    day: 2,
    joints: "Vai, khuỷu tay",
    muscles: "Cơ xô (latissimus dorsi) chủ đạo; nhị đầu tay hỗ trợ.",
    purpose: "Xây sức mạnh kéo thẳng đứng — hỗ trợ tư thế và làm nền cho các bài kéo nâng cao.",
    setup: "Ngồi cố định đùi dưới thanh chặn, tay nắm rộng hơn vai, hạ xương bả vai xuống trước khi kéo.",
    cues: [
      "Kéo về phía trước ngực, không ra sau gáy.",
      "Khuỷu tay dẫn hướng xuống - ra sau.",
      "Hạ vai xuống trước khi bắt đầu kéo.",
    ],
    faults: [
      { title: "Ngả người ra sau quá mức, dùng trọng lượng cơ thể để kéo", fix: "Giới hạn góc ngả khoảng 10-15°, giữ core ổn định." },
      { title: "Kéo thanh xuống sau gáy", fix: "Luôn kéo về phía trước ngực, không đưa thanh ra sau đầu." },
      { title: "Nhún vai lên khi bắt đầu kéo", fix: "Cue \"hạ vai xuống trước\" giống bài Row, tạo thói quen chung." },
      { title: "Kéo bằng tay thay vì khuỷu tay dẫn hướng", fix: "Cue \"khuỷu tay đi xuống túi quần sau\"." },
      { title: "Thả tạ về quá nhanh, mất kiểm soát", fix: "Đếm nhịp khi tay duỗi thẳng trở lại vị trí ban đầu." },
    ],
    match: /pull\s*-?\s*down/i,
  },
  {
    key: "hip-thrust",
    name: "Dumbbell/Barbell Hip Thrust",
    day: 1,
    joints: "Hông",
    muscles: "Mông (gluteus maximus) chủ đạo; gân kheo hỗ trợ.",
    purpose: "Phát triển sức mạnh duỗi hông — nền tảng của nâng, bật, chạy và cải thiện hình dáng vùng mông.",
    setup: "Vai trên tựa ghế, chân đặt để cẳng chân vuông góc sàn khi hông duỗi hết, cằm hơi cúi nhẹ.",
    cues: [
      "Siết mông trước khi đẩy hông lên.",
      "Đẩy lực đều qua gót chân.",
      "Duỗi hông hết tầm ở đỉnh, giữ 1 giây.",
    ],
    faults: [
      { title: "Ưỡn lưng dưới quá mức thay vì siết mông", fix: "Cue \"siết mông trước, để hông tự đẩy lên\" thay vì cong lưng để đẩy." },
      { title: "Đẩy bằng mũi chân thay vì gót", fix: "Cho khách nhấc nhẹ mũi chân khỏi sàn khi đẩy để cảm nhận lực dồn về gót." },
      { title: "Không duỗi hông hết tầm ở đỉnh", fix: "Giữ 1 giây ở đỉnh, kiểm tra đường thẳng vai - hông - gối." },
      { title: "Cằm ngửa lên trời gây căng cổ", fix: "Nhắc mắt nhìn về phía chân, cằm hơi cúi giữ cổ trung tính." },
      { title: "Vị trí chân đặt sai (quá xa / quá gần)", fix: "Chỉnh chân sao cho ở đỉnh cẳng chân vuông góc sàn." },
    ],
    match: /hip\s*thrust|glute\s*bridge/i,
  },
  {
    key: "hip-hinge",
    name: "Kneeling/Standing Hip Hinge",
    day: 2,
    joints: "Hông (bản lề hông)",
    muscles: "Gân kheo và mông chủ đạo; dựng cột sống giữ ổn định đẳng trường.",
    purpose: "Xây hinge pattern — nền tảng an toàn để nâng vật từ sàn, chuẩn bị cho Deadlift sau này.",
    setup: "Đứng/quỳ, lưng giữ đường cong tự nhiên, gối chùng nhẹ và giữ cố định độ chùng đó.",
    cues: [
      "Đẩy hông ra sau trước khi cúi người.",
      "Giữ đường cong tự nhiên của lưng suốt bài.",
      "Đứng dậy bằng cách đẩy hông tới, không kéo lưng.",
    ],
    faults: [
      { title: "Cong lưng dưới / gù lưng trên khi cúi", fix: "Cho khách đặt tay lên lưng dưới để tự cảm nhận và giữ thẳng khi hinge." },
      { title: "Gập gối nhiều, biến thành squat", fix: "Gối chỉ chùng cố định từ đầu, hông là khớp di chuyển chính." },
      { title: "Trọng tâm dồn mũi chân, mất thăng bằng ra trước", fix: "Cue \"đẩy mông ra sau như đóng cửa xe bằng mông\", trọng tâm giữa bàn chân." },
      { title: "Cúi quá sâu, vượt tầm vận động của hông", fix: "Giảm biên độ đến khi lưng vẫn giữ được đường cong tự nhiên." },
      { title: "Đứng dậy bằng cách kéo lưng lên trước", fix: "Cue đẩy hông về phía trước để đứng thẳng, không dùng lưng kéo người lên." },
    ],
    match: /hinge|romanian\s*deadlift|\brdl\b/i,
  },
  {
    key: "shoulder-press",
    name: "Seated Dumbbell Shoulder Press",
    day: 2,
    joints: "Vai, khuỷu tay",
    muscles: "Vai (deltoid, chủ yếu đầu trước/giữa) chủ đạo; tam đầu tay hỗ trợ.",
    purpose: "Xây sức mạnh đẩy trên đầu — cải thiện khả năng đẩy/nâng đồ lên cao trong sinh hoạt.",
    setup: "Ngồi lưng tựa, tạ giữ ngang vai, cổ tay - khuỷu tay - tạ thẳng trục.",
    cues: [
      "Đẩy tạ thẳng lên trên đầu.",
      "Giữ lưng tựa ghế, không ưỡn lưng dưới.",
      "Duỗi thẳng khuỷu tay ở đỉnh trước khi hạ.",
    ],
    faults: [
      { title: "Ưỡn lưng dưới quá mức khi đẩy lên", fix: "Giữ lưng tựa ghế, siết bụng nhẹ trước khi đẩy." },
      { title: "Đẩy tạ ra trước thay vì thẳng lên", fix: "Cue \"đẩy thẳng lên trần nhà\", quan sát từ bên hông để chỉnh đường đẩy." },
      { title: "Không đẩy hết tầm, khuỷu chưa duỗi ở đỉnh", fix: "Yêu cầu duỗi thẳng khuỷu tay ở đỉnh trước khi hạ." },
      { title: "Nhún vai lên tai khi bắt đầu đẩy", fix: "Cue hạ vai xuống trước mỗi lần lặp, giống các bài kéo." },
      { title: "Hạ tạ quá nhanh, mất kiểm soát", fix: "Đếm nhịp 2-3 giây ở pha hạ." },
    ],
    match: /shoulder\s*press/i,
  },
  {
    key: "floor-press",
    name: "Dumbbell Floor Press",
    day: 1,
    joints: "Vai, khuỷu tay",
    muscles: "Ngực (pectoralis major) chủ đạo; tam đầu tay và vai trước hỗ trợ.",
    purpose: "Xây sức mạnh đẩy ngang thân trên trong biên độ an toàn hơn bench press.",
    setup: "Nằm ngửa trên sàn, chân co, tạ giữ ở ngực, hai bả vai ép xuống sàn ổn định.",
    cues: [
      "Đẩy tạ thẳng lên trên vai.",
      "Khuỷu tay chạm sàn nhẹ nhàng, không đập mạnh.",
      "Thở ra khi đẩy lên.",
    ],
    faults: [
      { title: "Khuỷu tay đập mạnh xuống sàn", fix: "Giảm tốc độ pha hạ, khuỷu \"chạm nhẹ rồi bật lên\" thay vì rơi tự do." },
      { title: "Vai nhô khỏi sàn, core mất ổn định", fix: "Siết bụng nhẹ, hai bả vai dính sàn suốt bài." },
      { title: "Cổ tay bẻ gập ra sau", fix: "Chỉnh cách cầm tạ để cổ tay - khuỷu tay - tạ thẳng hàng." },
      { title: "Đẩy tạ lệch hướng (vào trong / ra ngoài)", fix: "Cue \"đẩy thẳng lên trần nhà\", quan sát từ phía đầu để chỉnh đường đẩy." },
      { title: "Nín thở hoặc thở sai nhịp", fix: "Thở ra khi đẩy lên, hít vào khi hạ xuống." },
    ],
    match: /floor\s*press|bench\s*press|dumbbell\s*press/i,
  },
  {
    key: "bear-plank",
    name: "Bear Plank",
    day: 1,
    joints: "Cột sống, vai, hông (giữ tĩnh — isometric)",
    muscles: "Cơ bụng sâu (core) và vai ổn định.",
    purpose: "Xây khả năng ổn định cột sống — nền tảng cho mọi bài đứng và di chuyển.",
    setup: "Tay và mũi chân chống sàn, đầu gối nhấc cách sàn vài cm, hông ngang bằng vai.",
    cues: [
      "Giữ hông ngang bằng vai suốt thời gian.",
      "Siết bụng, thở đều — không nín thở.",
      "Đẩy sàn ra xa để vai ổn định hơn.",
    ],
    faults: [
      { title: "Hông nhô quá cao (dáng chữ A)", fix: "Hạ hông ngang vai, tưởng tượng mặt bàn phẳng từ vai đến hông." },
      { title: "Hông võng xuống, lưng dưới quá tải", fix: "Siết bụng chủ động \"kéo rốn lên\" để nâng đỡ hông." },
      { title: "Nín thở toàn bộ thời gian giữ", fix: "Đếm nhịp thở cùng khách, thở đều thay vì gồng cứng." },
      { title: "Vai nhô lên gần tai, mất ổn định qua cánh tay", fix: "Cue \"đẩy sàn ra xa\" để vai hạ xuống và ổn định hơn." },
      { title: "Đầu gối quá cao hoặc chạm sàn", fix: "Chỉnh độ cao đầu gối chỉ vài cm — không chạm, không quá cao." },
    ],
    match: /bear\s*plank/i,
  },
  {
    key: "leg-raise",
    name: "Torso Elevated Lying Leg Raise",
    day: 2,
    joints: "Hông (gập hông)",
    muscles: "Bụng dưới (rectus abdominis phần dưới) chủ đạo; gập hông hỗ trợ.",
    purpose: "Tăng kiểm soát vùng bụng dưới và ổn định lưng dưới khi chân di chuyển.",
    setup: "Thân trên kê cao (ghế/bậc), lưng dưới ép sát mặt tựa, tay giữ cố định thân người.",
    cues: [
      "Nâng chân bằng lực bụng dưới, không giật.",
      "Giữ lưng dưới ép sát mặt tựa suốt bài.",
      "Hạ chân có kiểm soát, dừng trước khi lưng tách khỏi mặt tựa.",
    ],
    faults: [
      { title: "Lưng dưới cong lên khỏi mặt tựa khi hạ chân thấp", fix: "Giảm biên độ hạ chân đến khi khách giữ được lưng dưới ép sát." },
      { title: "Dùng đà hất chân lên thay vì kiểm soát bằng bụng", fix: "Nâng chân chậm, có kiểm soát, không giật." },
      { title: "Đầu gối khoá cứng thẳng hoàn toàn", fix: "Cho phép gối hơi mềm để giảm áp lực lên lưng dưới." },
      { title: "Nín thở toàn bộ hiệp", fix: "Thở ra khi nâng chân, hít vào khi hạ xuống." },
      { title: "Biên độ không phù hợp mức kiểm soát hiện tại", fix: "Điều chỉnh biên độ theo khả năng giữ lưng dưới ổn định của khách." },
    ],
    match: /leg\s*raise/i,
  },
];

/** Bài finisher — không tính vào 10 chuyển động nền tảng, chỉ chuẩn hoá 2 lỗi. */
const L0_FINISHERS: { key: string; name: string; faults: L0Fault[]; match: RegExp }[] = [
  {
    key: "jumping-jack",
    name: "Jumping Jack",
    faults: [
      { title: "Tiếp đất bằng cả bàn chân/gót, dồn lực khớp gối", fix: "Tiếp đất nhẹ bằng nửa trước bàn chân, gối hơi chùng." },
      { title: "Nín thở", fix: "Giữ nhịp thở đều theo nhịp nhảy." },
    ],
    match: /jumping\s*jack/i,
  },
  {
    key: "mountain-climber",
    name: "Mountain Climber",
    faults: [
      { title: "Hông nhô cao, mất tư thế plank", fix: "Giữ hông ngang vai như tư thế plank." },
      { title: "Tốc độ quá nhanh, gối tiếp sàn cẩu thả", fix: "Giảm tốc độ, ưu tiên mỗi nhịp gối kéo lên có kiểm soát." },
    ],
    match: /mountain\s*climber/i,
  },
];

// ── Danh sách bài cố định của gói L0 ────────────────────────────────────────
//
// Gói L0 CHỈ được tập đúng 10 bài nền tảng + 2 finisher của tài liệu, cả 4 buổi
// (kể cả Buổi 3 khách tự soạn). `match` ở trên cố tình rộng để chọn bảng lỗi;
// còn đây là khớp CHẶT trên tên gốc ở Kho bài tập (đã bỏ phần dịch trong ngoặc),
// vd "Air Box Squat" được, "Dumbbell Goblet Squat" thì không.
// Mọi chỗ chọn/lưu bài của giáo án L0 — ô chọn bài, lịch mẫu, lưu giáo án, khách
// tự soạn Buổi 3 — đều lọc qua isL0AllowedExercise; giai đoạn khác không bị ảnh hưởng.
const L0_ALLOWED: Record<string, RegExp> = {
  "box-squat": /^(air|bodyweight)\s+box\s+squat$/i,
  "step-up": /\bassisted\b.*\b(step\s*-?\s*up|split\s+squat)$/i,
  row: /^(seated\s+cable|dumbbell\s+prone)\s+row$/i,
  "lat-pulldown": /^(ovh|udh)\s+lat\s+pull\s*-?\s*down$/i,
  "hip-thrust": /^(dumbbell|barbell)\s+hip\s+thrust$/i,
  "hip-hinge": /^(kneeling|standing)\s+hip\s+hinge$/i,
  "shoulder-press": /^seated\s+(db|dumbbell)\s+shoulder\s+press$/i,
  "floor-press": /^dumbbell\s+floor\s+press$/i,
  "bear-plank": /^bear\s+plank$/i,
  "leg-raise": /^torso\s+elevated\b.*\bleg\s+raise$/i,
  "jumping-jack": /^((slow|mid|full)\s+)?jumping\s+jack$/i,
  "mountain-climber": /^((slow|mid|high|full)\s+)?mountain\s+climber$/i,
};

/** Bài có nằm trong danh sách cố định của gói L0 không (theo tên ở Kho bài tập). */
export function isL0AllowedExercise(name: string | null | undefined): boolean {
  const base = (name ?? "").replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return false;
  return Object.values(L0_ALLOWED).some((re) => re.test(base));
}

/** Tên bài không thuộc danh sách L0 trong một giáo án (bỏ qua ô để trống). */
export function disallowedL0Exercises(names: (string | null | undefined)[]): string[] {
  return Array.from(new Set(names.map((n) => (n ?? "").trim()).filter((n) => n && !isL0AllowedExercise(n))));
}

/** Giáo án L0 thì bỏ trống bài ngoài danh sách; giai đoạn khác giữ nguyên. */
export function l0SafeExercise(phase: string | null | undefined, name: string): string {
  return isL0Phase(phase) && name.trim() && !isL0AllowedExercise(name) ? "" : name;
}

/**
 * 5 yếu tố kỹ thuật chung — PT quan sát bài CHƯA có trong thư viện (khách tự
 * chọn ở Buổi 3, hay PT thay bằng bài khác cùng chuyển động).
 */
export const GENERAL_FACTORS: L0Fault[] = [
  { title: "Tư thế", fix: "Tư thế chuẩn theo bài, trọng tâm cân bằng không nghiêng lệch, tránh tư thế gây đau/khó chịu." },
  { title: "Hít thở", fix: "Lấy hơi - thực hiện - trở về - thở ra; không nín hơi quá 5 giây, không thở ra quá nhanh làm mất lực." },
  { title: "Độ ổn định cơ thể", fix: "Toàn thân ổn định trước khi bắt đầu, không lung lay / di chuyển thừa trong lúc thực hiện." },
  { title: "Kiểm soát tốc độ", fix: "Phát lực 1-2 giây, hạ 2-3 giây; không giật, không buông thả, không đổi tốc độ đột ngột." },
  { title: "Góc khớp", fix: "Khớp đi trong phạm vi an toàn, không gập/duỗi/xoay quá mức, giữ góc tối ưu cho bài." },
];

export type FaultGuide = {
  /** Khoá để so cùng một bài qua các buổi. */
  key: string;
  kind: "exercise" | "finisher" | "general";
  /** Tên hiển thị của bảng lỗi (tên chuẩn trong thư viện, hoặc tên bài thật). */
  title: string;
  faults: L0Fault[];
  exercise?: L0Exercise;
};

function normalizeName(name: string): string {
  return name.replace(/\(.*?\)/g, "").trim().toLowerCase();
}

/**
 * Bảng lỗi dùng cho một bài: theo TÊN BÀI (kho bài tập đặt tên rất đa dạng, vd
 * "Air Box Squat (Squat người không với bục)"). Ô HIT chỉ khớp finisher — tránh
 * "Deadlift & Row" ở ô HIT bị coi là bài Row. Không khớp gì → 5 yếu tố chung.
 */
export function faultGuideFor(exerciseName: string | null | undefined, movementName?: string | null): FaultGuide | null {
  const name = (exerciseName ?? "").trim();
  if (!name) return null;
  const isHit = !!movementName && /\bHIT\b/i.test(movementName);
  // Chỉ so phần tên gốc: phần dịch trong ngoặc làm khớp nhầm, vd "Wall Sit
  // (Squat dựa tường)" không phải bài squat.
  const base = name.replace(/\(.*?\)/g, " ");
  const finisher = L0_FINISHERS.find((f) => f.match.test(base));
  if (finisher) return { key: finisher.key, kind: "finisher", title: finisher.name, faults: finisher.faults };
  if (!isHit) {
    const ex = L0_EXERCISES.find((e) => e.match.test(base));
    if (ex) return { key: ex.key, kind: "exercise", title: ex.name, faults: ex.faults, exercise: ex };
  }
  return { key: `general:${normalizeName(name)}`, kind: "general", title: name.replace(/\s*\(.*$/, ""), faults: GENERAL_FACTORS };
}

/** "1,3" → [1, 3]. Số ngoài 1..5 bị bỏ. */
export function parseFaults(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 1 && n <= 5) out.add(n);
  }
  return Array.from(out).sort((a, b) => a - b);
}

/** [3, 1] → "1,3"; rỗng → null. */
export function formatFaults(list: number[]): string | null {
  const clean = parseFaults(list.join(","));
  return clean.length > 0 ? clean.join(",") : null;
}

// ── Kịch bản từng buổi ──────────────────────────────────────────────────────

export type L0Script = { who: "PT" | "FM" | "PT/FM"; lines: string[] };
export type L0Step = { text: string; script?: L0Script };

export type L0DayPlan = {
  title: string;
  tagline: string;
  purpose: string;
  goal: string;
  /** Cách áp dụng TSDR trong buổi. */
  tsdr: string;
  steps: L0Step[];
  kpis: { label: string; target: string }[];
  /** Câu FM hỏi khách cuối buổi (Phiếu hỏi đáp FM). */
  fmQuestions: string[];
};

const GREET: L0Step = {
  text: "Đón khách và chào hỏi trong 5 giây.",
  script: { who: "PT", lines: ["\"Chào chị [tên KH]! Em là [tên PT], hôm nay em sẽ đồng hành cùng chị ạ.\""] },
};
const LOCKER: L0Step = { text: "Mời khách cất đồ và thay đồ tại locker." };
const WARMUP: L0Step = { text: "Hướng dẫn khách đi bộ trên máy và khởi động khớp." };

export const L0_DAYS: Record<L0Day, L0DayPlan> = {
  1: {
    title: "Buổi 1",
    tagline: "Vui vẻ · An tâm · Đăng ký Buổi 2",
    purpose: "Khách hoàn thành trọn vẹn buổi học kỹ thuật nhẹ nhàng, thoải mái — từ đó đặt lịch Buổi 2 và chốt đăng ký khấu trừ.",
    goal: "Khách đăng ký khấu trừ (Hậu L0).",
    tsdr: "Chỉ Tell → Show → Do. Tick lỗi khi quan sát nhưng KHÔNG nói lỗi với khách. Xin phép quay một đoạn kỹ thuật ngắn để so sánh ở Buổi 4.",
    steps: [
      GREET,
      LOCKER,
      WARMUP,
      { text: "Dạy 5 bài theo TSDR: Box Squat, Row, Hip Thrust, Floor Press, Bear Plank (+ Jumping Jack finisher)." },
      { text: "Tick lỗi kỹ thuật quan sát được ở từng bài — không phản hồi kỹ thuật với khách." },
      {
        text: "[FM] Hỏi cảm nhận, mời đăng ký khấu trừ và hẹn Buổi 2.",
        script: {
          who: "FM",
          lines: [
            "\"Chị thấy buổi tập hôm nay thế nào ạ?\" (để khách chia sẻ trước, lắng nghe đầy đủ)",
            "\"Để chị duy trì được đà này và có PT đồng hành xuyên suốt, bên em có gói khấu trừ giúp chị chủ động lịch tập. Mình đăng ký khấu trừ để em xếp lịch Buổi 2 luôn cho chị nhé?\"",
            "(Còn phân vân) \"Dạ chị cứ yên tâm, đăng ký khấu trừ không ràng buộc gì thêm ngoài việc giúp chị giữ lịch tập đều đặn thôi ạ.\"",
            "\"Buổi 2 chị sẽ học thêm nhóm bài mới, cảm nhận cơ sẽ rõ hơn nữa đó ạ.\"",
          ],
        },
      },
    ],
    kpis: [
      { label: "Hoàn thành buổi tập", target: "100%" },
      { label: "Hài lòng", target: "90%" },
      { label: "Tập tiếp Buổi 2", target: "80%" },
      { label: "Đăng ký khấu trừ", target: "80%" },
    ],
    fmQuestions: ["Chị thấy buổi tập hôm nay thế nào ạ?"],
  },
  2: {
    title: "Buổi 2",
    tagline: "Học thêm kỹ thuật mới · Cảm nhận cơ · Đăng ký Buổi 3",
    purpose: "Khách hoàn thành trọn vẹn buổi học kỹ thuật nhẹ nhàng — từ đó đặt lịch Buổi 3.",
    goal: "Khách hài lòng và đăng ký Buổi 3.",
    tsdr: "Vẫn chỉ Tell → Show → Do. Tick lỗi, không nói lỗi với khách.",
    steps: [
      GREET,
      LOCKER,
      WARMUP,
      { text: "Dạy 5 bài mới theo TSDR: Step Up/Split Squat, Lat Pulldown, Hip Hinge, Shoulder Press, Leg Raise (+ Mountain Climber finisher)." },
      { text: "Tick lỗi kỹ thuật quan sát được — không phản hồi kỹ thuật với khách." },
      {
        text: "[FM] Hỏi cảm nhận thay đổi cơ thể, hẹn Buổi 3 (báo trước là buổi tự tập).",
        script: {
          who: "FM",
          lines: [
            "\"Qua 2 buổi rồi, chị thấy cơ thể mình có gì khác so với trước khi tập không?\"",
            "\"Buổi 3 sẽ hơi đặc biệt — chị tự thiết kế và tự tập một buổi, để xem mình đã tiếp thu được bao nhiêu. Chị có thể soạn trước trên app Ladysfit. Mình đặt lịch Buổi 3 cho chị nhé?\"",
          ],
        },
      },
    ],
    kpis: [
      { label: "Hoàn thành buổi tập", target: "100%" },
      { label: "Hài lòng", target: "90%" },
      { label: "Tập tiếp Buổi 3", target: "80%" },
    ],
    fmQuestions: ["Qua 2 buổi rồi, chị thấy cơ thể mình có gì khác so với trước khi tập không?"],
  },
  3: {
    title: "Buổi 3",
    tagline: "Tự tập · Cảm nhận khác biệt · Đăng ký Buổi 4",
    purpose: "Mô phỏng một buổi tự tập: khách tự thiết kế và tự triển khai, PT chỉ đứng quan sát, ghi nhận điểm mù.",
    goal: "Khách đăng ký trải nghiệm PT ở Buổi 4.",
    tsdr: "PT KHÔNG can thiệp (trừ rủi ro an toàn). Bài đã học → tick theo bảng 5 lỗi của bài; bài khách tự chọn mới → tick theo 5 yếu tố chung. Ghi đánh giá nội bộ 3 mặt.",
    steps: [
      GREET,
      LOCKER,
      {
        text: "Giới thiệu mục đích buổi \"Mô phỏng tự tập\".",
        script: {
          who: "PT",
          lines: [
            "\"Hôm nay sẽ khác 2 buổi trước — chị tự thiết kế và tự tập, em chỉ đứng quan sát thôi. Đây là cơ hội để chị thử sức sau 2 buổi vừa rồi, và để em hiểu chị cần hỗ trợ thêm ở đâu.\"",
          ],
        },
      },
      { text: "Khách tự thiết kế buổi tập (soạn trên app Ladysfit hoặc nói để PT ghi). Có buổi soạn sẵn thì bấm \"Cập nhật bài tập theo chương trình\" ở nhật ký." },
      { text: "Khách tự triển khai — PT không can thiệp trừ khi có rủi ro an toàn." },
      { text: "PT tick lỗi và ghi đánh giá nội bộ: (a) cấu trúc buổi, (b) set/rep, (c) lỗi kỹ thuật." },
      {
        text: "[FM/PT] Hỏi cảm nhận buổi tự tập, chia sẻ đánh giá theo cấu trúc Review, hẹn Buổi 4.",
        script: {
          who: "PT/FM",
          lines: [
            "\"Chị tự tập một mình hôm nay thấy sao?\" (để khách tự nói ra trước)",
            "Khen 1 điểm khách làm tốt → góp ý cụ thể về cấu trúc / set-rep / kỹ thuật (nếu có) → chốt bằng một câu khích lệ.",
            "\"Buổi 4 em sẽ đồng hành cùng chị trọn vẹn một buổi tập hoàn chỉnh — chị sẽ thấy rõ sự khác biệt khi có PT bên cạnh. Mình đặt lịch Buổi 4 nhé chị?\"",
          ],
        },
      },
    ],
    kpis: [
      { label: "Hoàn thành buổi tập", target: "100%" },
      { label: "Tập tiếp Buổi 4", target: "80%" },
    ],
    fmQuestions: ["Chị tự tập một mình hôm nay thấy sao?"],
  },
  4: {
    title: "Buổi 4",
    tagline: "Trải nghiệm huấn luyện · Cảm nhận khác biệt · Đăng ký lộ trình",
    purpose: "Khách trải nghiệm một buổi PT hoàn chỉnh, kỹ thuật thành thạo hơn, nghe tư vấn lộ trình và ra quyết định.",
    goal: "Khách đăng ký lộ trình mới.",
    tsdr: "Lần đầu áp dụng ĐỦ Tell → Show → Do → Review cho từng bài. Review dựa trên lỗi đã tick ở 3 buổi trước — chỉ góp ý ĐÚNG 1 lỗi mỗi bài, không liệt kê cả 5.",
    steps: [
      GREET,
      LOCKER,
      WARMUP,
      { text: "Huấn luyện một buổi hoàn chỉnh Giai đoạn 1 với đủ mức nỗ lực. Tick lại lỗi để đo lỗi cũ còn lặp lại." },
      {
        text: "Review từng bài theo cấu trúc Sandwich.",
        script: {
          who: "PT",
          lines: [
            "\"Chị thấy thế nào sau khi thực hiện bài này?\" (hỏi cảm nhận trước)",
            "\"Chị làm tốt hơn nhiều so với Buổi 1 rồi đó — [điểm đã cải thiện].\" (khen điểm tốt)",
            "(Nếu còn lỗi) \"Có một điểm chị để ý thêm: [1 lỗi cụ thể]. Chị thử sửa lại xem sao nhé.\"",
            "\"Chị tiến bộ rõ lắm, cứ giữ đà này nhé!\" (hỏi khách có cần làm mẫu lại không)",
          ],
        },
      },
      {
        text: "So sánh video kỹ thuật Buổi 1 với Buổi 4 — ưu tiên khen trước.",
        script: {
          who: "PT",
          lines: ["\"Để chị thấy rõ hơn, em có quay lại một đoạn ngắn kỹ thuật của chị hôm Buổi 1 và hôm nay, mình xem lại cùng nhau nhé.\""],
        },
      },
      {
        text: "[FM] Hỏi khác biệt so với buổi tự tập, mời ra bàn tư vấn lộ trình.",
        script: {
          who: "FM",
          lines: [
            "\"Qua 4 buổi vừa rồi, chị tự đánh giá bản thân mình thế nào?\"",
            "\"So với buổi chị tự tập hôm Buổi 3, hôm nay có PT đồng hành chị thấy khác biệt thế nào ạ?\"",
            "\"Dạ để em mời chị ra bàn tư vấn, bạn tư vấn sẽ chia sẻ chi tiết các lộ trình phù hợp với mục tiêu của chị nhé ạ.\"",
          ],
        },
      },
    ],
    kpis: [
      { label: "Hoàn thành buổi tập", target: "100%" },
      { label: "Lỗi cũ còn lặp lại", target: "≤ 20%" },
      { label: "Hài lòng", target: "90%" },
      { label: "Đăng ký lộ trình", target: "50%" },
    ],
    fmQuestions: [
      "Qua 4 buổi vừa rồi, chị tự đánh giá bản thân mình thế nào?",
      "So với buổi tự tập hôm Buổi 3, hôm nay có PT đồng hành chị thấy khác biệt thế nào ạ?",
    ],
  },
};

// ── Buổi 3: thuật ngữ cho khách tự thiết kế + đánh giá nội bộ của PT ─────────

export const L0_GLOSSARY: { term: string; meaning: string }[] = [
  { term: "Set (hiệp)", meaning: "Một lượt thực hiện liên tục nhiều lần lặp lại của 1 bài tập." },
  { term: "Rep (lần lặp)", meaning: "Một lần thực hiện trọn vẹn động tác trong 1 set." },
  { term: "Nghỉ (rest)", meaning: "Thời gian nghỉ giữa các set để cơ thể hồi phục." },
  { term: "Concentric / Eccentric", meaning: "Concentric là pha gắng sức — làm nhanh, thở ra. Eccentric là pha hạ có kiểm soát — làm chậm, hít vào." },
  { term: "Nhóm cơ đẩy / kéo", meaning: "Bài đẩy (press) dùng ngực - vai - tay sau. Bài kéo (pull/row) dùng lưng - tay trước. Nên có cả hai trong 1 buổi." },
  { term: "Compound (đa khớp)", meaning: "Bài dùng nhiều khớp/nhóm cơ cùng lúc (squat, deadlift, press) — ưu tiên làm đầu buổi." },
  { term: "Core", meaning: "Nhóm cơ bụng - lưng dưới - hông, giữ ổn định cột sống khi vận động." },
  { term: "Cardio / LISS", meaning: "Cardio tăng nhịp tim (đi bộ, đạp xe). LISS là cardio cường độ thấp, đều, kéo dài — dùng khởi động/thả lỏng." },
  { term: "Khởi động / Thả lỏng", meaning: "Warm-up làm nóng cơ thể trước buổi chính. Cool-down làm dịu cơ thể sau khi tập." },
  { term: "Mức gắng sức (RPE)", meaning: "Cảm nhận chủ quan về độ nặng/nhẹ — thường theo thang nhẹ / vừa / nặng." },
];

export type L0Assessment = { structure: string; setRep: string; technique: string };

export const L0_ASSESSMENT_FIELDS: { key: keyof L0Assessment; label: string; hint: string }[] = [
  { key: "structure", label: "(a) Cấu trúc buổi tập", hint: "Thứ tự bài, đủ đẩy/kéo/chân/core, có khởi động - thả lỏng…" },
  { key: "setRep", label: "(b) Set / rep", hint: "Số set, số rep, mức tạ, thời gian nghỉ khách tự chọn…" },
  { key: "technique", label: "(c) Lỗi kỹ thuật", hint: "Lỗi nổi bật cần Review ở Buổi 4…" },
];

export function parseAssessment(raw: string | null | undefined): L0Assessment {
  const empty: L0Assessment = { structure: "", setRep: "", technique: "" };
  if (!raw) return empty;
  try {
    const v = JSON.parse(raw) as Partial<L0Assessment>;
    return {
      structure: typeof v.structure === "string" ? v.structure : "",
      setRep: typeof v.setRep === "string" ? v.setRep : "",
      technique: typeof v.technique === "string" ? v.technique : "",
    };
  } catch {
    return empty;
  }
}

/** Ghi đánh giá Buổi 3 — cả 3 ô trống thì lưu null. */
export function serializeAssessment(a: Partial<L0Assessment> | null | undefined): string | null {
  if (!a) return null;
  const clean: L0Assessment = {
    structure: String(a.structure ?? "").trim().slice(0, 2000),
    setRep: String(a.setRep ?? "").trim().slice(0, 2000),
    technique: String(a.technique ?? "").trim().slice(0, 2000),
  };
  return clean.structure || clean.setRep || clean.technique ? JSON.stringify(clean) : null;
}

// ── Tổng hợp lỗi qua các buổi ───────────────────────────────────────────────

export type L0LogInput = {
  day: L0Day;
  date: string | Date;
  setLogs: { movementName: string; exerciseName: string; faults: string | null }[];
};

export type FaultHistory = {
  guide: FaultGuide;
  /** Tên bài thật lần gần nhất. */
  exerciseName: string;
  /** Lỗi theo từng buổi đã quan sát bài này (buổi muộn nhất của mỗi Ngày). */
  byDay: Partial<Record<L0Day, number[]>>;
};

/**
 * Gom lỗi đã tick theo BÀI (khoá faultGuideFor) qua mọi buổi L0 đã hoàn thành.
 * Một Ngày tập nhiều lần (buổi bù) thì lấy lần muộn nhất.
 */
export function buildFaultHistory(logs: L0LogInput[]): FaultHistory[] {
  const sorted = [...logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const map = new Map<string, FaultHistory>();
  for (const log of sorted) {
    for (const sl of log.setLogs) {
      const guide = faultGuideFor(sl.exerciseName, sl.movementName);
      if (!guide) continue;
      let h = map.get(guide.key);
      if (!h) {
        h = { guide, exerciseName: sl.exerciseName, byDay: {} };
        map.set(guide.key, h);
      }
      h.exerciseName = sl.exerciseName;
      h.byDay[log.day] = parseFaults(sl.faults);
    }
  }
  return Array.from(map.values());
}

/** Lỗi đã thấy ở các buổi TRƯỚC Ngày `day` (hợp các buổi). */
export function faultsBefore(h: FaultHistory, day: L0Day): number[] {
  const out = new Set<number>();
  for (const d of [1, 2, 3] as L0Day[]) {
    if (d >= day) continue;
    for (const f of h.byDay[d] ?? []) out.add(f);
  }
  return Array.from(out).sort((a, b) => a - b);
}

/**
 * Lỗi cũ còn lặp lại ở Buổi 4: trong các bài được quan sát cả trước và ở Buổi 4,
 * bao nhiêu lỗi đã tick trước đó vẫn bị tick lại. null = chưa đủ dữ liệu.
 */
export function oldFaultRecurrence(history: FaultHistory[]): { old: number; recurred: number } | null {
  let old = 0;
  let recurred = 0;
  for (const h of history) {
    const now = h.byDay[4];
    if (!now) continue;
    const before = faultsBefore(h, 4);
    old += before.length;
    recurred += before.filter((f) => now.includes(f)).length;
  }
  return old > 0 ? { old, recurred } : null;
}

/** Tổng số lỗi đã tick trong một buổi. */
export function faultCount(setLogs: { faults: string | null }[]): number {
  return setLogs.reduce((n, sl) => n + parseFaults(sl.faults).length, 0);
}

/** App khách chỉ thấy lỗi kỹ thuật khi đã xong Buổi 4 — Buổi 1–3 không nói lỗi. */
export function l0FaultsVisibleToClient(completedDays: L0Day[]): boolean {
  return completedDays.includes(4);
}
