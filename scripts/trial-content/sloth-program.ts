import type { ProgramCaseSeed } from "./types";

/**
 * Vòng Lười biếng — THIẾT KẾ CHƯƠNG TRÌNH TẬP LUYỆN. Case study.
 *
 * Đổi từ lối chơi phân loại thẻ ngày 05/09/2026 theo yêu cầu của chủ phòng.
 *
 * Khác vòng Kiêu ngạo ở chỗ đo cái gì:
 *   • Kiêu ngạo hỏi "buổi này CÓ ĐƯỢC làm không" — chống chỉ định, an toàn.
 *   • Lười biếng hỏi "buổi này ĐÁNG làm cái gì" — khối lượng có đúng tần suất
 *     không, chia nhóm có ra chia nhóm không, giai đoạn nào thì tập gì.
 *
 * Nên phần lớn hồ sơ ở đây KHÔNG có bài cấm. Cái bẫy là khối lượng: cho quá
 * nhiều thì khách không hồi phục kịp và bỏ tập, cho quá ít thì gói trôi qua mà
 * không có kết quả nào. Đó chính là tội lười biếng của người soạn giáo án —
 * dùng một liều cho mọi khách vì nghĩ ít ai để ý.
 */

export const INTRO = `Mỗi hồ sơ là một buổi tập cần thiết kế cho một khách cụ thể.

Chọn bài trong danh mục và chia số set. Bảng số phía trên cho biết giáo án của
bạn đang có bao nhiêu set và chia thế nào; chỉ tiêu cùng sai số ghi ngay bên dưới.

Hệ thống KHÔNG báo bạn đã đạt hay chưa — tự bạn phải tính. Đọc kỹ số buổi mỗi
tuần và loại buổi: khối lượng đúng cho người tập 3 buổi/tuần là khối lượng sai
cho người tập 6 buổi, và buổi chia nhóm thì phải chia cho ra chia.`;

export const CASES: ProgramCaseSeed[] = [
  // ── Toàn thân, tần suất thấp ──────────────────────────────────────────────
  {
    clientProfile: `Chị Mai, 28 tuổi · 62kg · giáo viên, chỉ sắp xếp được 2 BUỔI/TUẦN.
Mục tiêu giảm cân. Đã tập 3 tháng, kỹ thuật ổn.
Buổi TOÀN THÂN. Không chấn thương.`,
    targetTotalSets: 20, targetLowerSets: 9, targetUpperSets: 7, targetCoreSets: 4,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Chỉ 2 buổi/tuần thì mỗi buổi phải gánh nhiều hơn — 20 set, cao hơn hẳn buổi toàn thân của người tập 5 buổi.
Cắt xuống 12 set như buổi thường là cả tuần khách chỉ tập 24 set, không đủ kích thích để giữ cơ trong lúc giảm cân.`,
  },
  {
    clientProfile: `Chị Vân, 35 tuổi · 75kg · kế toán mùa quyết toán, 2 BUỔI/TUẦN trong 6 tuần tới.
Mục tiêu giữ nguyên thành quả, không cần tiến thêm.
Buổi TOÀN THÂN. Đã tập 8 tháng.`,
    targetTotalSets: 16, targetLowerSets: 7, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Giai đoạn giữ khác giai đoạn tiến: khối lượng để duy trì thấp hơn khối lượng để tăng, khoảng hai phần ba là đủ.
Ép khách bận rộn tập như lúc rảnh là cách nhanh nhất khiến họ bỏ luôn cả hai buổi.`,
  },
  {
    clientProfile: `Chị Ngọc, 26 tuổi · 58kg · người mới, buổi thứ 2 kể từ khi bắt đầu.
3 BUỔI/TUẦN. Mục tiêu giảm 3kg và học kỹ thuật.
Buổi TOÀN THÂN.`,
    targetTotalSets: 12, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push"],
    bannedExercises: ["Barbell Back Squat", "Sumo Deadlift", "Box Jump", "Burpees"],
    explanation: `Buổi thứ hai thì mục tiêu là học động tác, không phải tạo mỏi. 12 set với bài cơ bản là vừa.
Bài tạ đòn nặng và bài bật nhảy để dành cho lúc kỹ thuật đã có nền — đưa vào bây giờ chỉ dạy khách sai từ đầu.`,
  },
  {
    clientProfile: `Chị Hà, 38 tuổi · 70kg · hai con nhỏ, 3 BUỔI/TUẦN cố định.
Đã tập 5 tháng, tiến bộ đều. Mục tiêu giảm 6kg.
Buổi TOÀN THÂN.`,
    targetTotalSets: 18, targetLowerSets: 8, targetUpperSets: 6, targetCoreSets: 4,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `3 buổi toàn thân là cấu trúc hiệu quả nhất cho người tập thưa: mỗi nhóm cơ được chạm 3 lần/tuần.
18 set cho người đã có 5 tháng nền là đúng tầm — người mới thì không, nhưng người này không còn mới.`,
  },
  {
    clientProfile: `Chị Loan, 30 tuổi · 66kg · 3 BUỔI/TUẦN, mỗi buổi chỉ có 45 PHÚT.
Mục tiêu giảm cân. Đã tập 4 tháng.
Buổi TOÀN THÂN, cần gọn.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `45 phút thì không nhét được 18–20 set nếu muốn nghỉ đủ giữa các set. Đáp án là ít bài hơn nhưng vẫn đủ bốn mẫu, dùng bài đa khớp.
Nhồi cho đủ số rồi bắt khách nghỉ 30 giây mỗi set là biến buổi tạ thành buổi cardio mà không ai gọi tên.`,
  },
  {
    clientProfile: `Chị Trâm, 45 tuổi · 68kg · 3 BUỔI/TUẦN, mới quay lại sau 4 THÁNG NGHỈ HẲN.
Trước đó tập được 1 năm, kỹ thuật vẫn nhớ.
Buổi TOÀN THÂN đầu tiên sau khi quay lại.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [],
    explanation: `Kỹ thuật còn nhớ nhưng sức chịu đựng thì không: nghỉ 4 tháng là mất phần lớn khả năng hồi phục.
Bắt đầu lại ở khoảng hai phần ba khối lượng cũ và tăng dần trong 3 tuần — chạy ngay mức trước khi nghỉ là đau ê ẩm cả tuần rồi nghỉ tiếp.`,
  },
  {
    clientProfile: `Chị Yến, 33 tuổi · 85kg · người mới, 3 BUỔI/TUẦN, tuần thứ 4.
Mục tiêu giảm 9kg. Đã quen với các bài cơ bản.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Tuần thứ 4 là lúc nâng khối lượng lần đầu: từ 12 lên 15 set, không nhảy thẳng lên 20.
Tăng khoảng 20% mỗi 3–4 tuần là nhịp mà cơ thể theo kịp; tăng gấp đôi vì thấy khách "đã quen" là đưa họ vào tuần đau nhức rồi nản.`,
  },
  {
    clientProfile: `Chị Linh, 24 tuổi · 64kg · 3 BUỔI/TUẦN, tuần thứ 9 — đây là TUẦN GIẢM TẢI.
Ba tuần trước tập nặng dần, tuần này chủ động lùi lại để hồi phục.
Buổi TOÀN THÂN.`,
    targetTotalSets: 10, targetLowerSets: 5, targetUpperSets: 3, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Hinge"],
    bannedExercises: [],
    explanation: `Tuần giảm tải là một phần của chương trình chứ không phải nghỉ tập: giữ động tác, hạ khoảng một nửa khối lượng.
Bỏ tuần giảm tải vì "khách vẫn khoẻ" là cách tích mệt mỏi cho tới lúc chững hẳn hoặc chấn thương.`,
  },

  // ── Toàn thân, tần suất cao ───────────────────────────────────────────────
  {
    clientProfile: `Chị Thu, 41 tuổi · 80kg · 6 BUỔI/TUẦN theo cam kết gói L2.
Đã tập 6 tuần. Mục tiêu giảm 9kg.
Buổi TOÀN THÂN — một trong sáu buổi của tuần.`,
    targetTotalSets: 12, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Tập 6 buổi/tuần thì MỖI buổi phải nhẹ đi, nếu không tổng tuần vọt lên mức không ai hồi phục nổi.
12 set × 6 buổi = 72 set/tuần, đã là nhiều. Kê 18 set như buổi của người tập 3 buổi là 108 set/tuần — đó là công thức chấn thương.`,
  },
  {
    clientProfile: `Chị Phương, 36 tuổi · 78kg · 5 BUỔI/TUẦN, đi công tác 2 tuần/tháng.
Tuần này ở nhà, tập đủ. Đã tập 7 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Tuần ở nhà thì tập đúng mức của người 5 buổi, không tranh thủ nhồi bù cho hai tuần đi vắng.
Nhồi bù là ý nghĩ dễ chịu với PT nhưng cơ thể không cộng dồn kiểu đó — nó chỉ mệt thêm.`,
  },
  {
    clientProfile: `Chị An, 43 tuổi · 76kg · 5 BUỔI/TUẦN, điều dưỡng làm ca đêm 3 đêm/tuần.
Hôm nay là buổi sau một đêm trực. Đã tập 5 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 11, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: ["Barbell Back Squat", "Sumo Deadlift", "Box Jump"],
    explanation: `Buổi sau ca đêm phải nhẹ hơn buổi ngày thường — thiếu ngủ làm giảm cả sức lẫn khả năng giữ kỹ thuật.
Giữ nhịp tập là mục tiêu của buổi này, không phải phá kỷ lục. Bài tạ đòn nặng để sang buổi khác.`,
  },
  {
    clientProfile: `Chị Nhung, 34 tuổi · 63kg · 4 BUỔI/TUẦN chia TRÊN/DƯỚI.
Hôm nay là buổi TOÀN THÂN thay thế vì phòng đang sửa khu tạ đòn.
Đã tập 1 năm.`,
    targetTotalSets: 16, targetLowerSets: 7, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell High Bar Back Squat (Squat thanh đòn)",
      "Barbell Bench Press", "Barbell Bent-Over Row", "Barbell Hip Thrust",
      "Barbell Romanian Deadlift (Gập hông với thanh đòn)", "Sumo Deadlift",
    ],
    explanation: `Ràng buộc ở đây là thiết bị, không phải cơ thể: mất khu tạ đòn thì vẫn phải đủ bốn mẫu vận động bằng tạ đơn, máy và dây cáp.
Đổi lịch thành buổi cardio cho xong là bỏ mất một buổi tạ của tuần — đó đúng là tội lười biếng của người soạn giáo án.`,
  },

  // ── Buổi chia nhóm: thân dưới ─────────────────────────────────────────────
  {
    clientProfile: `Chị Bích, 29 tuổi · 60kg · 5 BUỔI/TUẦN chia nhóm, đã tập 2 năm.
Buổi THÂN DƯỚI nặng. Mục tiêu giữ cơ trong giai đoạn giảm mỡ.
Không chấn thương.`,
    targetTotalSets: 18, targetLowerSets: 15, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Lower Isolate"],
    bannedExercises: [],
    explanation: `Buổi chia nhóm thì chỉ tiêu thân trên bằng 0 nghĩa là đừng nhét bài tay vai vào cho "đủ toàn thân".
15 set thân dưới cần cả bài đa khớp lẫn bài đơn khớp; chỉ squat và hinge thì đùi sau và mông thiếu khối lượng riêng.`,
  },
  {
    clientProfile: `Chị Hoa, 34 tuổi · 67kg · 4 BUỔI/TUẦN, mục tiêu chính là MÔNG VÀ ĐÙI.
Buổi MÔNG & CHÂN. Đã tập 10 tháng, kỹ thuật tốt.
Không chấn thương.`,
    targetTotalSets: 17, targetLowerSets: 14, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Glute Attack", "Lower Isolate"],
    bannedExercises: [],
    explanation: `Mông cần bài gập hông và bài mông riêng, không phải squat thêm cho nhiều.
Squat không nằm trong mẫu bắt buộc ở buổi này là có chủ ý: nó nghiêng về đùi trước, còn thứ khách muốn nằm ở chuỗi sau.`,
  },
  {
    clientProfile: `Chị Thảo, 25 tuổi · 71kg · nền vận động viên, 6 BUỔI/TUẦN.
Buổi THÂN DƯỚI thứ hai trong tuần — buổi đầu đã nặng về squat.
Không chấn thương.`,
    targetTotalSets: 16, targetLowerSets: 13, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Glute Attack"],
    bannedExercises: [],
    explanation: `Buổi thân dưới thứ hai trong tuần phải khác buổi đầu, nếu không là lặp lại đúng thứ vừa làm mỏi.
Buổi đầu nặng squat thì buổi này nghiêng về gập hông và mông — cùng nhóm, khác kiểu tải.`,
  },
  {
    clientProfile: `Chị Quyên, 27 tuổi · 55kg · 4 BUỔI/TUẦN, tỉ lệ mỡ cao dù cân nhẹ.
Buổi THÂN DƯỚI. Đã tập 6 tháng.
Không chấn thương.`,
    targetTotalSets: 15, targetLowerSets: 12, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Glute Attack"],
    bannedExercises: [],
    explanation: `Người nhẹ cân nhưng mỡ cao cần xây cơ chứ không cần đốt thêm — buổi tạ đủ khối lượng, không phải buổi cardio trá hình.
Đừng thay bài tạ bằng bài HIT cho "cháy mỡ": phần đốt mỡ nằm ở khay ăn, phần đổi dáng nằm ở khối lượng tạ.`,
  },
  {
    clientProfile: `Chị Nga, 52 tuổi · 73kg · 4 BUỔI/TUẦN, mục tiêu giữ sức và giảm cân.
Buổi THÂN DƯỚI. Đã tập 5 tháng, không chấn thương nhưng thăng bằng kém.
Không dùng được bài đứng một chân không có điểm tựa.`,
    targetTotalSets: 13, targetLowerSets: 10, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge"],
    bannedExercises: [
      "Bulgarian Split Squat (mông tập trung)", "Lunges đi bộ",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)", "Box Jump",
    ],
    explanation: `Thăng bằng kém thì bỏ bài một chân không tựa, nhưng vẫn tập chân nặng được bằng máy và bài hai chân.
Khối lượng 13 set thấp hơn người trẻ cùng buổi vì tuổi này hồi phục chậm hơn, không phải vì họ yếu.`,
  },

  // ── Buổi chia nhóm: thân trên ─────────────────────────────────────────────
  {
    clientProfile: `Chị Hằng, 35 tuổi · 55kg · 5 BUỔI/TUẦN chia nhóm, đã tập 1.5 năm.
Buổi THÂN TRÊN. Mục tiêu xây cơ vai lưng cho dáng cân đối.
Không chấn thương.`,
    targetTotalSets: 18, targetLowerSets: 0, targetUpperSets: 15, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Push", "Pull", "Upper Isolate"],
    bannedExercises: [],
    explanation: `Thân trên đủ khối lượng cần cả đẩy, kéo và bài đơn khớp — thiếu bài đơn khớp thì vai và tay không đủ kích thích.
Kéo nên nhiều hơn đẩy một chút với dân văn phòng: đó là nhóm đang yếu và là nhóm giữ tư thế.`,
  },
  {
    clientProfile: `Chị Oanh, 32 tuổi · 74kg · 4 BUỔI/TUẦN, dáng cao lớn, đã tập 8 tháng.
Buổi KÉO (lưng và tay trước). Không chấn thương.
Phòng hôm nay hết máy kéo xô, các thiết bị khác bình thường.`,
    targetTotalSets: 15, targetLowerSets: 0, targetUpperSets: 13, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Pull", "Upper Isolate"],
    bannedExercises: ["OVH Lat Pulldown (Kéo lưng dọc úp tay)", "UDH Lat Pulldown (Kéo lưng dọc ngửa tay)", "Pull-Up"],
    explanation: `Mất máy kéo xô thì vẫn còn kéo ngang, kéo cáp một tay và bài vớt tạ — buổi kéo không phụ thuộc một cái máy.
Đổi luôn sang buổi đẩy vì "hết máy" là xáo trộn cả tuần của khách chỉ vì một thiết bị bận.`,
  },
  {
    clientProfile: `Chị Ly, 29 tuổi · 72kg · 4 BUỔI/TUẦN, đã tập 6 tháng.
Buổi ĐẨY (ngực, vai, tay sau). Không chấn thương.
Mục tiêu giảm cân, giữ cơ.`,
    targetTotalSets: 15, targetLowerSets: 0, targetUpperSets: 13, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Push", "Upper Isolate"],
    bannedExercises: [],
    explanation: `Buổi đẩy cần bài đa khớp trước rồi mới tới đơn khớp — thứ tự đó quyết định khách nâng được bao nhiêu ở bài chính.
Đừng nhét bài kéo vào cho "cân đối": cân đối là chuyện của cả tuần, không phải của một buổi.`,
  },
  {
    clientProfile: `Chị Kim, 24 tuổi · 58kg · 5 BUỔI/TUẦN, đã tập 1 năm.
Buổi THÂN TRÊN nhẹ — hôm qua đã có buổi thân trên nặng.
Không chấn thương.`,
    targetTotalSets: 11, targetLowerSets: 0, targetUpperSets: 9, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Pull", "Upper Isolate"],
    bannedExercises: [],
    explanation: `Hai buổi thân trên liền nhau thì buổi sau phải nhẹ hẳn, nếu không nhóm cơ chưa kịp hồi phục đã bị đánh tiếp.
Nghiêng về bài đơn khớp và tải nhẹ là cách giữ khối lượng tuần mà không cộng thêm mỏi.`,
  },
  {
    clientProfile: `Chị Diệp, 30 tuổi · 64kg · 3 BUỔI/TUẦN, dân văn phòng gù lưng, cổ hay mỏi.
Buổi THÂN TRÊN. Đã tập 4 tháng, không chấn thương.
Mục tiêu phụ: cải thiện tư thế.`,
    targetTotalSets: 14, targetLowerSets: 0, targetUpperSets: 12, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Pull", "Upper Isolate"],
    bannedExercises: [],
    explanation: `Người gù lưng cần kéo nhiều hơn đẩy — Push không nằm trong mẫu bắt buộc ở buổi này là có chủ ý.
Thêm bài đẩy ngực cho "đủ bộ" ở người đã tròn vai là làm nặng thêm đúng cái đang lệch.`,
  },

  // ── Giai đoạn và tiến triển ───────────────────────────────────────────────
  {
    clientProfile: `Chị Ánh, 28 tuổi · 70kg · GIAI ĐOẠN 1 (giảm cân nhanh), tuần thứ 2.
6 BUỔI/TUẦN theo gói. Người mới, kỹ thuật đang học.
Buổi TOÀN THÂN.`,
    targetTotalSets: 11, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Push"],
    bannedExercises: ["Barbell Back Squat", "Sumo Deadlift", "Box Jump", "Burpees"],
    explanation: `Giai đoạn 1 với người mới tập 6 buổi/tuần: mỗi buổi phải rất nhẹ, mục tiêu là dựng thói quen và học động tác.
Số buổi cao đã là gánh nặng rồi; cộng thêm khối lượng cao nữa là khách nghỉ trước tuần thứ tư.`,
  },
  {
    clientProfile: `Chị Uyên, 37 tuổi · 77kg · GIAI ĐOẠN 2 (hoàn thiện vóc dáng), tháng thứ 4.
4 BUỔI/TUẦN. Đã giảm 7kg, giờ tập trung tạo đường nét.
Buổi MÔNG & CHÂN.`,
    targetTotalSets: 16, targetLowerSets: 13, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Glute Attack", "Lower Isolate"],
    bannedExercises: [],
    explanation: `Sang giai đoạn 2 thì mục tiêu đổi từ "đốt" sang "tạo hình": khối lượng tạ tăng, bài đơn khớp nhiều hơn, cardio lùi lại.
Giữ nguyên giáo án của giai đoạn 1 vì nó "đang hiệu quả" là lý do phần lớn khách chững ở tháng thứ tư.`,
  },
  {
    clientProfile: `Chị Sương, 50 tuổi · 72kg · GIAI ĐOẠN 3 (duy trì), đã đạt mục tiêu cân nặng.
4 BUỔI/TUẦN, muốn giữ dáng và khoẻ lâu dài.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Giai đoạn duy trì không có nghĩa là tập ít đi — vẫn đủ bốn mẫu và đủ khối lượng để giữ cơ, chỉ là không còn ép tiến.
Hạ xuống 8 set vì "khách xong rồi" là cách để mọi thứ họ xây trong một năm rơi lại trong ba tháng.`,
  },
  {
    clientProfile: `Chị Tú, 39 tuổi · 82kg · đã tập 12 tuần, CÂN CHỮNG 3 TUẦN dù ăn đúng.
5 BUỔI/TUẦN. Khối lượng tạ chưa đổi từ tuần thứ 5.
Buổi TOÀN THÂN.`,
    targetTotalSets: 17, targetLowerSets: 8, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Chững cân sau 12 tuần với khối lượng đứng yên từ tuần 5 thì vấn đề nằm ở giáo án, không nằm ở khách.
Nâng khối lượng lên một nấc là việc đáng lẽ phải làm từ tuần thứ 8 — đây đúng là chỗ tội lười biếng lộ ra.`,
  },
  {
    clientProfile: `Chị Nhàn, 26 tuổi · 63kg · tuần thứ 16, tiến bộ tốt, muốn thử tạ đòn.
4 BUỔI/TUẦN. Kỹ thuật tạ đơn đã vững.
Buổi THÂN DƯỚI — buổi đầu tiên có tạ đòn.`,
    targetTotalSets: 14, targetLowerSets: 11, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge"],
    bannedExercises: [],
    explanation: `Buổi đầu có tạ đòn thì tổng khối lượng phải GIẢM so với buổi thường, vì phần lớn sức lực đi vào việc học tư thế mới.
Giữ nguyên 18 set rồi thêm bài mới lên trên là cách khách rời phòng với cái lưng mỏi mà không hiểu vì sao.`,
  },
  {
    clientProfile: `Chị Trúc, 26 tuổi · 64kg · 5 BUỔI/TUẦN, tuần cuối trước ngày ĐO LẠI CHỈ SỐ.
Đã tập 3 tháng. Muốn có kết quả đo đẹp.
Buổi TOÀN THÂN.`,
    targetTotalSets: 12, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [],
    explanation: `Tuần trước ngày đo nên giảm tải chứ không nhồi thêm: cơ đang sưng và giữ nước vì tập nặng sẽ làm số đo xấu đi, không đẹp lên.
Đây là chỗ nhiều PT làm ngược vì muốn "cố nốt" — và rồi phải giải thích với khách vì sao vòng eo tăng.`,
  },
  {
    clientProfile: `Chị Vy, 32 tuổi · 56kg · 4 BUỔI/TUẦN, vừa hết một chu kỳ 12 tuần.
Chuẩn bị vào chu kỳ mới. Kỹ thuật tốt, không chấn thương.
Buổi TOÀN THÂN mở đầu chu kỳ.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Buổi mở chu kỳ mới bắt đầu ở mức thấp hơn đỉnh của chu kỳ trước, rồi tăng dần — đó là cách một chương trình có nhịp.
Nối thẳng đỉnh cũ sang chu kỳ mới thì không còn chỗ nào để tiến trong 12 tuần tới.`,
  },

  // ── Ràng buộc hoàn cảnh ───────────────────────────────────────────────────
  {
    clientProfile: `Chị Cẩm, 29 tuổi · 58kg · 3 BUỔI/TUẦN, hôm nay chỉ có 30 PHÚT vì đón con.
Đã tập 7 tháng. Buổi TOÀN THÂN theo lịch.
Không chấn thương.`,
    targetTotalSets: 9, targetLowerSets: 4, targetUpperSets: 3, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [],
    explanation: `30 phút thì chọn ít bài đa khớp và làm cho tử tế, còn hơn nhét 15 set rồi bài nào cũng qua loa.
Huỷ buổi vì "không đủ giờ" là mất một buổi của tuần — 9 set đúng kỹ thuật vẫn hơn hẳn số không.`,
  },
  {
    clientProfile: `Chị Xuân, 38 tuổi · 65kg · 4 BUỔI/TUẦN, hôm nay ĐANG TRONG KỲ KINH, ngày đầu, đau bụng.
Vẫn muốn tập. Đã tập 9 tháng.
Buổi TOÀN THÂN theo lịch.`,
    targetTotalSets: 9, targetLowerSets: 4, targetUpperSets: 4, targetCoreSets: 1,
    tolerancePercent: 20,
    requiredPatterns: ["Pull"],
    bannedExercises: ["Box Jump", "Burpees", "Crunches (Gập bụng)", "Russian Twist", "Jump Squat nặng"],
    explanation: `Ngày đầu kỳ kinh đau bụng thì hạ khối lượng, bỏ bài bật nhảy và bài gập bụng, giữ nhịp bằng bài nhẹ.
Bắt tập đúng giáo án vì "tập vào là hết đau" là áp một trải nghiệm cá nhân lên cơ thể người khác.`,
  },
  {
    clientProfile: `Chị Bảo, 33 tuổi · 66kg · 4 BUỔI/TUẦN, hôm qua đã đi bộ đường dài 15km.
Chân còn mỏi rõ. Đã tập 6 tháng.
Buổi theo lịch là THÂN DƯỚI.`,
    targetTotalSets: 13, targetLowerSets: 3, targetUpperSets: 8, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Push", "Pull"],
    bannedExercises: [],
    explanation: `Chân đã mỏi sẵn thì đảo lịch: làm buổi thân trên hôm nay, trả buổi chân về ngày sau.
Chạy đúng lịch vì "lịch là lịch" ở đây cho ra một buổi chân tệ và một tuần hồi phục kém — lịch phục vụ chương trình, không phải ngược lại.`,
  },
  {
    clientProfile: `Chị Đào, 36 tuổi · 74kg · 5 BUỔI/TUẦN, hôm nay tập ở CHI NHÁNH KHÁC ít thiết bị.
Chỉ có tạ đơn, dây cáp và ghế. Không có tạ đòn, không có máy chuyên dụng.
Buổi TOÀN THÂN. Đã tập 8 tháng.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell High Bar Back Squat (Squat thanh đòn)", "Barbell Bench Press",
      "Barbell Bent-Over Row", "Barbell Hip Thrust", "Sumo Deadlift", "Leg Press",
      "OVH Lat Pulldown (Kéo lưng dọc úp tay)", "UDH Lat Pulldown (Kéo lưng dọc ngửa tay)",
    ],
    explanation: `Thiếu thiết bị không phải lý do để giảm khối lượng — bốn mẫu vận động đều làm được bằng tạ đơn và dây cáp.
Buổi tập kém là do người soạn không chịu tìm bài thay thế, không phải do phòng thiếu máy.`,
  },
  {
    clientProfile: `Chị Mến, 44 tuổi · 70kg · 4 BUỔI/TUẦN, hôm nay tập cùng BẠN mới đi thử.
Khách muốn buổi tập vui, có không khí. Đã tập 1 năm.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Có khách lạ đi cùng thì giữ đúng khối lượng của buổi, chỉ chọn bài dễ làm mẫu và dễ theo.
Biến cả buổi thành trò chơi cho vui là lấy mất một buổi tập của người đang trả tiền.`,
  },
  {
    clientProfile: `Chị Kiều, 39 tuổi · 69kg · 3 BUỔI/TUẦN, đây là buổi CUỐI của gói L2.
Đã đạt mục tiêu giảm cân. Sắp ký tiếp gói giai đoạn 2.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Buổi cuối gói vẫn là một buổi tập đủ chất, không phải buổi chụp ảnh và chúc mừng.
Cách kết thúc một gói là thứ khách nhớ khi quyết định có ký tiếp hay không.`,
  },
  {
    clientProfile: `Chị Nguyệt, 35 tuổi · 67kg · 4 BUỔI/TUẦN, tuần này báo mệt mỏi kéo dài, ngủ kém 5 đêm liền.
Không ốm, không chấn thương. Đã tập 6 tháng.
Buổi TOÀN THÂN theo lịch.`,
    targetTotalSets: 10, targetLowerSets: 4, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: ["Barbell Back Squat", "Sumo Deadlift", "Burpees", "Box Jump"],
    explanation: `Mệt mỏi kéo dài 5 ngày là dấu hiệu hồi phục không theo kịp — giảm tải cả tuần chứ không riêng buổi này.
Ép tập nặng lúc này chỉ đào sâu thêm cái hố, và tuần sau khách sẽ nghỉ hẳn.`,
  },
  {
    clientProfile: `Chị Phượng, 28 tuổi · 59kg · 5 BUỔI/TUẦN, hôm nay là buổi sau NGÀY NGHỈ DÀI (nghỉ lễ 4 ngày).
Ăn uống thả lỏng mấy hôm, người ì. Đã tập 10 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Nghỉ 4 ngày không mất gì đáng kể — quay lại đúng mức bình thường, không cần "tập bù" cho những gì đã ăn.
Kê một buổi trừng phạt sau kỳ nghỉ là dạy khách rằng tập luyện là hình phạt cho việc ăn.`,
  },

  // ── Nhóm khách đặc thù của phòng ──────────────────────────────────────────
  {
    clientProfile: `Chị Thắm, 33 tuổi · 68kg · buồng trứng đa nang, kháng insulin.
4 BUỔI/TUẦN. Bác sĩ khuyến khích tập tạ. Đã tập 5 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 16, targetLowerSets: 7, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Nhóm khách này hưởng lợi rõ từ tạ nặng — khối cơ tăng thì độ nhạy insulin cải thiện, đó là điều trị chứ không chỉ là giảm cân.
Kê một buổi cardio nhẹ nhàng vì nghĩ "khách có bệnh" là bỏ mất đúng thứ có tác dụng nhất.`,
  },
  {
    clientProfile: `Chị Hường, 27 tuổi · 61kg · 5 BUỔI/TUẦN, sắp chụp ảnh cưới sau 3 tuần.
Muốn dáng gọn nhất có thể. Đã tập 1 năm, kỹ thuật tốt.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 6, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Ba tuần không đổi được cơ thể nhiều — giữ đúng chương trình và để phần khác biệt cho khay ăn và giấc ngủ.
Tăng vọt khối lượng vào phút chót là mệt mỏi và giữ nước, đúng cái làm ảnh xấu đi.`,
  },
  {
    clientProfile: `Chị Tâm, 41 tuổi · 66kg · 4 BUỔI/TUẦN, mục tiêu bác sĩ giao là TĂNG MẬT ĐỘ XƯƠNG.
Loãng xương nhẹ, được phép tập tạ có tải. Đã tập 4 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Box Jump", "Burpees", "Russian Twist", "Crunches (Gập bụng)"],
    explanation: `Muốn xương chắc thì phải có tải dọc trục thật sự — bài tạ có tải, không phải bài tay không và dây kháng lực.
Cái phải bỏ là va đập và gập xoay cột sống, còn khối lượng thì giữ đủ.`,
  },
  {
    clientProfile: `Chị Ánh Tuyết, 31 tuổi · 63kg · 3 BUỔI/TUẦN, làm việc tại nhà, ngồi 11 tiếng.
Đau lưng dưới âm ỉ cuối ngày, đã khám và không có tổn thương.
Buổi TOÀN THÂN. Đã tập 3 tháng.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Pull", "Core"],
    bannedExercises: [],
    explanation: `Đau lưng do ngồi lâu thì thứ cần là chuỗi sau khoẻ và core giữ được tư thế — Hinge, Pull và Core đều nằm trong mẫu bắt buộc.
Tránh hết mọi bài động tới lưng vì sợ đau là để cái lưng yếu mãi.`,
  },
  {
    clientProfile: `Chị Trang, 27 tuổi · 61kg · người mẫu ảnh, 5 BUỔI/TUẦN.
Cần giữ số đo eo, muốn thêm cơ vai và mông. Đã tập 2 năm.
Buổi TOÀN THÂN.`,
    targetTotalSets: 16, targetLowerSets: 8, targetUpperSets: 7, targetCoreSets: 1,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Glute Attack", "Push", "Upper Isolate"],
    bannedExercises: [],
    explanation: `Chỉ tiêu core rất thấp là có chủ ý: tập bụng nhiều với người muốn giữ eo nhỏ là làm dày thêm nhóm cơ đó.
Khối lượng dồn vào vai và mông — hai nhóm tạo ra tương phản làm eo trông nhỏ hơn.`,
  },
  {
    clientProfile: `Chị Chi, 22 tuổi · 60kg · sinh viên, 3 BUỔI/TUẦN, ngân sách thấp nên tự tập 2 buổi ở nhà.
Buổi này là buổi CÓ PT ở phòng. Đã tập 4 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 17, targetLowerSets: 8, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Buổi có PT phải dồn vào những gì khách KHÔNG tự làm được ở nhà: bài tạ nặng, bài cần chỉnh tư thế, bài cần người bảo hiểm.
Dạy plank và gập bụng trong buổi có PT là lãng phí đúng buổi khách trả tiền.`,
  },
  {
    clientProfile: `Chị Nhi, 30 tuổi · 65kg · 4 BUỔI/TUẦN, mới chuyển từ PT khác sang.
Giáo án cũ toàn máy, chưa từng tập tạ tự do. Kỹ thuật máy tốt.
Buổi TOÀN THÂN đầu tiên với bạn.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Barbell Back Squat", "Sumo Deadlift", "Barbell Bent-Over Row"],
    explanation: `Buổi đầu với PT mới thì giữ khối lượng quen thuộc và đưa tạ tự do vào từ từ bằng tạ đơn, chưa dùng tạ đòn.
Đổi sạch giáo án ngay buổi đầu để chứng minh mình giỏi hơn người trước là cách mất khách nhanh nhất.`,
  },
  {
    clientProfile: `Chị Hạnh, 47 tuổi · 71kg · 4 BUỔI/TUẦN, hai tuần nữa đi du lịch 10 ngày.
Muốn giữ được thành quả trong thời gian đi. Đã tập 8 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Hai tuần trước chuyến đi vẫn tập bình thường — 10 ngày nghỉ không mất cơ, và "tập bù trước" là chuyện không tồn tại.
Việc đáng làm là soạn sẵn một buổi không cần dụng cụ cho khách mang theo, chứ không phải nhồi thêm bây giờ.`,
  },
  {
    clientProfile: `Chị Lan, 45 tuổi · 72kg · 5 BUỔI/TUẦN, cao huyết áp ổn định với thuốc.
Bác sĩ cho tập bình thường, tránh nín thở gắng sức. Đã tập 7 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Sumo Deadlift", "Barbell Back Squat", "Burpees"],
    explanation: `Huyết áp ổn định với thuốc thì tập được đủ khối lượng — chỉ tránh bài kéo theo phản xạ nín hơi rặn.
Cho tập nửa vời vì thấy chữ "cao huyết áp" trong hồ sơ là lấy mất của khách phần lợi ích lớn nhất.`,
  },
  {
    clientProfile: `Chị Tuyết, 34 tuổi · 68kg · 3 BUỔI/TUẦN, con nhỏ 14 tháng, ngủ chập chờn.
Đã tập lại được 3 tháng sau sinh. Không còn hở cơ bụng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull", "Core"],
    bannedExercises: [],
    explanation: `Đã qua giai đoạn phục hồi thì tập như người bình thường, chỉ giữ khối lượng vừa vì giấc ngủ còn kém.
Core vẫn nằm trong mẫu bắt buộc — sau sinh thì đó là nhóm cần xây lại nhất, chỉ là bằng bài giữ tư thế chứ không phải gập bụng.`,
  },
  {
    clientProfile: `Chị Giang, 29 tuổi · 57kg · 6 BUỔI/TUẦN, đang chuẩn bị một giải chạy 10km sau 5 tuần.
Vẫn muốn giữ tập tạ. Đã tập 1.5 năm.
Buổi TẠ TOÀN THÂN — trong tuần còn 3 buổi chạy.`,
    targetTotalSets: 11, targetLowerSets: 4, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Push", "Pull", "Core"],
    bannedExercises: ["Box Jump", "Jump Squat nặng", "Burpees"],
    explanation: `Đang tích khối lượng chạy thì buổi tạ phải nhường chân lại: giảm set thân dưới, giữ thân trên và core.
Kê buổi chân nặng vào giữa chu kỳ chạy là làm hỏng cả hai mục tiêu cùng lúc.`,
  },
  {
    clientProfile: `Chị Yên, 45 tuổi · 52kg · 4 BUỔI/TUẦN, người gầy, mất cơ theo tuổi.
Không muốn giảm cân, muốn chắc người. Đã tập 5 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 6, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Burpees", "Box Jump", "Full Half Burpee (Burpee nhanh)"],
    explanation: `Mục tiêu là khối cơ nên buổi tập phải là buổi tạ thật, không xen bài đốt calo — khách này không cần đốt gì cả.
Bốn mẫu vận động với tải tăng dần là toàn bộ câu trả lời; thêm HIT vào đây chỉ lấy mất sức cho bài chính.`,
  },
  {
    clientProfile: `Chị Thuý, 31 tuổi · 64kg · 4 BUỔI/TUẦN, hay bỏ buổi cuối tuần suốt 6 tuần liền.
Bốn buổi trên giấy nhưng thực tế chỉ tập 3. Đã tập 6 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 18, targetLowerSets: 8, targetUpperSets: 6, targetCoreSets: 4,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Thiết kế theo số buổi THẬT chứ không theo số buổi trên giấy: khách tập 3 buổi thì mỗi buổi phải gánh như buổi của người tập 3.
Giữ nguyên giáo án 4 buổi rồi để một buổi rơi mỗi tuần là để tổng khối lượng tuần thiếu hụt suốt sáu tuần mà không ai tính lại.`,
  },
  {
    clientProfile: `Chị Hoà, 37 tuổi · 73kg · 5 BUỔI/TUẦN, tập rất đều nhưng luôn tự ý bỏ phần core.
Đã tập 9 tháng. Không chấn thương.
Buổi TOÀN THÂN.`,
    targetTotalSets: 16, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 4,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Core"],
    bannedExercises: [],
    explanation: `Khách bỏ phần nào thì phần đó phải được đưa lên ĐẦU buổi, không để cuối — cuối buổi là chỗ mọi thứ bị cắt.
Chỉ tiêu core cao hơn thường lệ ở hồ sơ này là cách sửa một thói quen bằng thiết kế, không phải bằng nhắc nhở.`,
  },
  {
    clientProfile: `Chị Ninh, 42 tuổi · 70kg · 2 BUỔI/TUẦN, ngân sách chỉ đủ gói ít buổi.
Rất nghiêm túc, tự tập thêm ở nhà theo hướng dẫn. Đã tập 5 tháng.
Buổi TOÀN THÂN ở phòng.`,
    targetTotalSets: 19, targetLowerSets: 9, targetUpperSets: 7, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Hai buổi ở phòng thì mỗi buổi phải dày, và ưu tiên những bài khách không tự làm ở nhà được.
Đây là khách dễ bị chăm hời hợt nhất vì gói nhỏ — mà thực ra họ cần thiết kế kỹ hơn cả khách gói lớn.`,
  },
  {
    clientProfile: `Chị Quế, 26 tuổi · 67kg · 5 BUỔI/TUẦN, tuần thứ 20, đã giảm 8kg.
Bắt đầu than chán vì "buổi nào cũng giống nhau". Kỹ thuật tốt.
Buổi TOÀN THÂN.`,
    targetTotalSets: 16, targetLowerSets: 7, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Chán là dấu hiệu giáo án đứng yên quá lâu — giữ nguyên khung bốn mẫu nhưng đổi bài cụ thể, đổi kiểu tải, đổi thứ tự.
Đổi vì chán chứ không đổi bừa: khung vẫn phải là khung, nếu không thì mất luôn cả tiến triển.`,
  },
  {
    clientProfile: `Chị Vân Anh, 35 tuổi · 62kg · 4 BUỔI/TUẦN, hôm nay khách xin tập NẶNG hơn bình thường vì "thấy khoẻ".
Tuần này đã có 2 buổi nặng. Đã tập 1 năm.
Buổi TOÀN THÂN thứ ba trong tuần.`,
    targetTotalSets: 12, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [],
    explanation: `Cảm giác khoẻ trong một ngày không đổi được việc tuần này đã có hai buổi nặng — khối lượng tính theo tuần, không theo cảm hứng.
Chiều theo là dễ, và đó chính là chỗ tội lười biếng núp dưới vỏ chiều khách.`,
  },
  {
    clientProfile: `Chị Bình, 48 tuổi · 74kg · 3 BUỔI/TUẦN, mới tập 3 tuần, tiến bộ chậm nhưng đều.
Hay so sánh mình với khách trẻ tập cùng khung giờ.
Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push"],
    bannedExercises: ["Box Jump", "Burpees", "Barbell Back Squat"],
    explanation: `Thiết kế theo tuổi và nền tảng của chính khách, đừng theo người bên cạnh — 48 tuổi mới tập 3 tuần thì 13 set là đúng.
Nâng khối lượng để khách "không thua kém" là đặt một người mới vào giáo án của người đã tập lâu.`,
  },
  {
    clientProfile: `Chị Duyên, 30 tuổi · 60kg · 4 BUỔI/TUẦN, hôm nay là buổi ĐẦU TIÊN sau khi khỏi cúm 5 ngày.
Đã hết sốt 2 ngày, còn hơi mệt. Đã tập 8 tháng.
Buổi TOÀN THÂN.`,
    targetTotalSets: 9, targetLowerSets: 4, targetUpperSets: 3, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: ["Burpees", "Box Jump", "Barbell Back Squat", "Sumo Deadlift"],
    explanation: `Buổi đầu sau ốm là buổi thăm dò: khoảng một nửa khối lượng thường, không bài nặng, kết thúc khi còn thấy khoẻ.
Chạy đủ giáo án vì khách "đã hết sốt rồi" là cách phổ biến nhất khiến người ta ốm lại ngay tuần sau.`,
  },
];
