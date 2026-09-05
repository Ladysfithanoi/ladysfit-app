import type { ProgramCaseSeed } from "./types";

/**
 * Vòng Kiêu ngạo — DỰNG GIÁO ÁN. Case study về chuyên môn.
 *
 * Chuyển từ lối chơi phân loại thẻ sang case study ngày 05/09/2026: chuyên môn
 * kỹ thuật không đo được bằng cách bấm một trong ba vùng. Muốn biết một HLV có
 * dựng nổi buổi tập không thì phải bắt họ dựng thật.
 *
 * Cái mà mỗi hồ sơ đo:
 *   • Đọc chống chỉ định rồi có tránh không — đây là chỗ tội kiêu ngạo lộ ra rõ
 *     nhất: tin rằng mình xử lý được một ca mình chưa từng học.
 *   • Chia khối lượng có cân đối không, hay dồn hết vào nhóm mình thích dạy.
 *   • Có đủ mẫu vận động không — một buổi toàn Squat là một buổi bỏ trống cả
 *     chuỗi sau cơ thể.
 */

export const INTRO = `Mỗi hồ sơ là một khách thật với một buổi tập cần dựng.

Chọn bài trong danh mục và chia số set cho từng bài. Bảng số phía trên cho biết
giáo án của bạn đang có bao nhiêu set và chia thế nào; chỉ tiêu cùng sai số cho
phép ghi ngay bên dưới mỗi con số.

Hệ thống KHÔNG báo bạn đã đạt hay chưa — tự bạn phải tính. Bốn chỉ tiêu ràng
buộc lẫn nhau: kéo nhóm này lên là nhóm kia lệch.

Đọc kỹ phần CHỐNG CHỈ ĐỊNH. Một bài trong danh sách đó lọt vào giáo án thì hồ sơ
mất trắng, dù các con số có đẹp tới đâu — y như dị ứng ở vòng dinh dưỡng.`;

export const CASES: ProgramCaseSeed[] = [
  {
    clientProfile: `Chị Hương, 32 tuổi · 68kg · cao 158cm · nhân viên văn phòng, ngồi 9 tiếng/ngày.
Gói L1, mục tiêu giảm cân. Tập 5 buổi/tuần, đây là buổi TOÀN THÂN thứ hai trong tuần.
Đã tập 6 tuần, kỹ thuật cơ bản ổn. Không chấn thương, không chống chỉ định.`,
    targetTotalSets: 18, targetLowerSets: 9, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Hồ sơ nền: không có ràng buộc nào, chỉ đo bạn có dựng nổi một buổi toàn thân cân đối không.
18 set là khối lượng vừa cho người tập 5 buổi/tuần — nhiều hơn thì tuần đó không hồi phục kịp.
Bốn mẫu vận động bắt buộc là bộ khung tối thiểu: đẩy và kéo phải đi cùng nhau, gập gối và gập hông phải đi cùng nhau.
Thiếu Hinge là bỏ trống toàn bộ chuỗi sau cơ thể — đúng cái mà dân văn phòng ngồi 9 tiếng cần nhất.`,
  },
  {
    clientProfile: `Chị Vân, 35 tuổi · 75kg · cao 162cm · THOÁT VỊ ĐĨA ĐỆM L4-L5, có giấy bác sĩ.
Bác sĩ dặn: không gánh tải lên cột sống, không gập người có tải, không bật nhảy.
Gói L2, mục tiêu giảm cân. Tập 5 buổi/tuần, buổi này là THÂN DƯỚI.`,
    targetTotalSets: 16, targetLowerSets: 11, targetUpperSets: 2, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Glute Attack"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell High Bar Back Squat (Squat thanh đòn)",
      "Barbell Romanian Deadlift (Gập hông với thanh đòn)", "Romanian Deadlift (tạ đòn)",
      "Sumo Deadlift", "Deadlift kiểu Sumo", "Barbell Bent-Over Row",
      "BB Bent Row (Gập người kéo lưng ngang với thanh đòn)", "Box Jump", "Jump Squat nặng",
    ],
    explanation: `Hồ sơ đo đúng một thứ: bạn có đọc chống chỉ định trước khi chọn bài không.
Mọi bài gánh thanh đòn lên vai, mọi bài gập người có tải và mọi bài bật nhảy đều bị loại — không phải vì chúng xấu, mà vì bác sĩ đã dặn.
Vẫn tập chân được và tập nặng được: Leg Press, Hip Thrust, Bulgarian Split Squat, các bài máy có tựa lưng.
Chọn Hip Thrust thay Deadlift ở đây không phải nhân nhượng, đó là chuyên môn.`,
  },
  {
    clientProfile: `Chị Thu, 41 tuổi · 80kg · cao 158cm · người mới hoàn toàn, chưa từng tập tạ.
Buổi thứ 3 kể từ khi bắt đầu. Khớp gối kêu lục cục khi ngồi xổm sâu nhưng không đau.
Gói L2, mục tiêu giảm cân. Tập 6 buổi/tuần. Buổi TOÀN THÂN, cường độ nhẹ.`,
    targetTotalSets: 12, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Box Jump", "Jump Squat nặng", "Burpees", "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
      "Barbell Back Squat", "Sumo Deadlift",
    ],
    explanation: `Cái bẫy ở đây là khối lượng, không phải bài tập. Người mới hoàn toàn ở buổi thứ ba mà cho 18–20 set là ba ngày sau không đi nổi cầu thang, và tuần sau họ nghỉ.
12 set là đủ để học kỹ thuật và vẫn thấy mình có tập.
Bài bật nhảy và bài gánh nặng bị loại vì khớp gối chưa có nền và kỹ thuật chưa có: hai thứ đó cộng lại là công thức của chấn thương ở buổi thứ ba.`,
  },
  {
    clientProfile: `Chị Bích, 29 tuổi · 60kg · cao 168cm · đã tập 2 năm, nâng khá nặng, kỹ thuật tốt.
Mục tiêu giảm mỡ giữ cơ. Tập 5 buổi/tuần theo lịch chia nhóm.
Buổi này là THÂN TRÊN. Không chấn thương.`,
    targetTotalSets: 18, targetLowerSets: 0, targetUpperSets: 15, targetCoreSets: 3,
    tolerancePercent: 20,
    requiredPatterns: ["Push", "Pull", "Upper Isolate"],
    bannedExercises: [],
    explanation: `Buổi chia nhóm thì phải chia cho ra chia: chỉ tiêu thân dưới bằng 0 nghĩa là đừng nhét squat vào cho "đủ toàn thân".
Người tập hai năm chịu được 15 set thân trên, và phải có cả đẩy lẫn kéo lẫn bài đơn khớp — thiếu bài đơn khớp thì vai và tay không đủ khối lượng để giữ cơ trong giai đoạn giảm mỡ.
Hồ sơ này đo bạn có dám để trống một nhóm không, hay lúc nào cũng phải làm toàn thân cho an tâm.`,
  },
  {
    clientProfile: `Chị Nga, 52 tuổi · 73kg · cao 156cm · LOÃNG XƯƠNG NHẸ, bác sĩ khuyên tập tạ nhưng tránh va đập.
Không bật nhảy, không gập cột sống có tải, không xoay vặn thân mạnh.
Gói L3, tập 4 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [
      "Box Jump", "Burpees", "Half Burpee", "Full Half Burpee (Burpee nhanh)",
      "Russian Twist", "Crunches (Gập bụng)", "Bicycle Crunch (Gập bụng đạp xe)",
      "Skater Jumps", "Jump Squat nặng",
    ],
    explanation: `Loãng xương KHÔNG có nghĩa là tập nhẹ đi — tập tạ có tải là thứ làm tăng mật độ xương, và bốn mẫu vận động vẫn phải đủ.
Cái phải bỏ là va đập và gập xoay cột sống: gập bụng, xoay Nga, bật nhảy đều tạo lực nén lên đốt sống đã yếu.
Thay bằng bài core giữ tư thế (plank, dead bug, pallof) và bài chân có tựa.
Hồ sơ này bẫy theo hướng ngược: người sợ quá thì cho tập như đi dạo, mà như thế là bỏ mất đúng thứ bác sĩ dặn phải làm.`,
  },
  {
    clientProfile: `Chị Dung, 31 tuổi · 69kg · cao 161cm · sinh con 8 tháng trước, sinh mổ.
Bác sĩ cho tập lại. Còn HỞ CƠ THẲNG BỤNG (diastasis) khoảng 2 đốt ngón tay.
Gói L1, mục tiêu giảm cân. Tập 5 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 8, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Crunches (Gập bụng)", "Bicycle Crunch (Gập bụng đạp xe)", "Bicycle Crunch",
      "Cable Crunch", "Russian Twist", "Burpees", "Half Burpee",
    ],
    explanation: `Hở cơ thẳng bụng thì mọi bài gập bụng và xoay vặn đều làm rộng thêm khe hở — đúng cái khách đang muốn khép lại.
Vẫn tập core được và phải tập: bài giữ tư thế và bài chống xoay, chỉ 2 set thôi nhưng đúng loại.
Phần còn lại của buổi tập bình thường, vì đây là người khoẻ mạnh chứ không phải người bệnh.
Chỗ dễ sai nhất là nhét gập bụng vào cho khách "về dáng bụng nhanh" — chiều theo mong muốn của khách ở đây là làm hỏng đúng thứ họ mong.`,
  },
  {
    clientProfile: `Chị Hạnh, 47 tuổi · 71kg · cao 154cm · THOÁI HOÁ KHỚP GỐI, đau khi lên xuống cầu thang.
Bác sĩ dặn tránh gập gối sâu và tránh va đập. Được phép tập tạ có kiểm soát.
Gói L3, mục tiêu giảm cân để đỡ gánh nặng lên gối. Tập 4 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 6, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Push", "Pull"],
    bannedExercises: [
      "Box Jump", "Jump Squat nặng", "Skater Jumps", "Burpees",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
      "Bulgarian Split Squat (mông tập trung)", "Lunges đi bộ",
    ],
    explanation: `Chú ý chỉ tiêu: thân dưới chỉ 6 set, thân trên 6 — với người đau gối thì phần lớn khối lượng chuyển lên thân trên và vào bài gập hông.
Squat không nằm trong mẫu bắt buộc, còn Hinge thì có: gập hông tải vào chuỗi sau mà không ép gối gập sâu.
Lunge và bài bật nhảy bị loại vì cả hai đều dồn lực lên một gối.
Giảm cân vẫn là mục tiêu, nhưng phần thâm hụt phải đến từ khay ăn chứ không từ việc bắt cái gối đau chạy nhiều hơn.`,
  },
  {
    clientProfile: `Chị Yến, 33 tuổi · 85kg · cao 163cm · béo phì độ 1, cao huyết áp đang uống thuốc.
Bác sĩ dặn tránh bài đưa đầu thấp hơn tim và tránh nín thở gắng sức.
Gói L2, mục tiêu giảm cân. Tập 6 buổi/tuần. Buổi TOÀN THÂN, cường độ trung bình.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push"],
    bannedExercises: [
      "Burpees", "Half Burpee", "Full Half Burpee (Burpee nhanh)", "Box Jump",
      "Barbell Back Squat", "Sumo Deadlift", "Deadlift kiểu Sumo",
    ],
    explanation: `Cao huyết áp đang dùng thuốc thì hai thứ phải tránh: tư thế đầu thấp hơn tim (burpee, một số bài plank động) và bài nặng khiến khách nín hơi rặn.
Tạ đòn nặng bị loại không phải vì bài xấu mà vì nó kéo theo phản xạ nín thở ở người mới.
Vẫn giữ đủ ba mẫu vận động chính và 15 set — đây là khách đi tập 6 buổi/tuần, cho tập quá nhẹ là phí cả gói.`,
  },
  {
    clientProfile: `Chị Thảo, 25 tuổi · 71kg · cao 170cm · từng là vận động viên bóng chuyền, khối cơ lớn.
Kỹ thuật rất tốt, chịu được khối lượng cao. Muốn giảm mỡ giữ sức.
Tập 6 buổi/tuần. Buổi này là THÂN DƯỚI nặng. Không chấn thương.`,
    targetTotalSets: 20, targetLowerSets: 15, targetUpperSets: 2, targetCoreSets: 3,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Hinge", "Lower Isolate", "Glute Attack"],
    bannedExercises: [],
    explanation: `Ngược với hồ sơ người mới: ở đây cho quá ít mới là sai. Người có nền vận động viên mà cho 12 set thân dưới thì buổi tập không tạo được kích thích nào.
20 set với 15 set dồn vào thân dưới là đúng tầm, và phải có đủ bốn mẫu — cả bài đa khớp lẫn bài đơn khớp lẫn bài mông riêng.
Hồ sơ này đo bạn có dám kê nặng cho người chịu được không, hay lúc nào cũng dùng một liều cho mọi khách.`,
  },
  {
    clientProfile: `Chị Loan, 30 tuổi · 55kg · cao 160cm · ĐANG MANG THAI 5 THÁNG, thai kỳ bình thường.
Bác sĩ đồng ý cho tập. Không nằm ngửa lâu, không gập bụng, không bài có nguy cơ mất thăng bằng.
Tập 3 buổi/tuần. Buổi TOÀN THÂN nhẹ.`,
    targetTotalSets: 11, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [
      "Crunches (Gập bụng)", "Bicycle Crunch (Gập bụng đạp xe)", "Russian Twist",
      "Box Jump", "Burpees", "Jump Squat nặng", "Barbell Back Squat",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
    ],
    explanation: `Thai kỳ giữa vẫn tập được và nên tập — nhưng đổi mục tiêu: giữ sức và giữ tư thế, không phải tăng thành tích.
Bỏ hẳn gập bụng, xoay vặn, bật nhảy và bài dễ mất thăng bằng. Không nằm ngửa lâu nên bài nằm ghế phẳng cũng phải cân nhắc.
Khối lượng 11 set là ít so với mọi hồ sơ khác, và đó là chủ ý.
Chỗ sai nặng nhất ở hồ sơ này là kê một buổi giảm cân bình thường vì "khách vẫn khoẻ mà".`,
  },
  {
    clientProfile: `Chị Trâm, 45 tuổi · 68kg · cao 160cm · ĐAU VAI phải khi giơ tay quá đầu, chưa đi khám.
Các động tác dưới tầm vai thì không đau. Gói L2, mục tiêu giảm cân.
Tập 5 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 16, targetLowerSets: 9, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Overhead Press", "Overhead Tricep Extension", "Squat & Press (Squat & Đẩy vai)",
      "Dumbbell Squat & Press (Squat & đẩy vai)", "Sand Bag Push Press (Bật đẩy vai với bao cát)",
      "Sand Bag Holy Combo (Bật Squat + Đẩy vai + Bước Lunge)", "Pull-Up",
    ],
    explanation: `Chưa đi khám thì chưa biết là gì, nên nguyên tắc là không đụng vào tầm vận động gây đau: bỏ hết bài đẩy qua đầu và kéo xà.
Vẫn tập thân trên được bằng bài ngang tầm ngực và bài kéo ngang — đó là lý do Pull nằm trong mẫu bắt buộc còn Push thì không.
Song song, việc phải làm ngoài giáo án là khuyên khách đi khám và ghi lại vào hồ sơ.
Cho tập tiếp qua đầu vì "khách bảo chịu được" chính là tội kiêu ngạo ở dạng nguy hiểm nhất.`,
  },
  {
    clientProfile: `Chị Linh, 24 tuổi · 64kg · cao 159cm · khoẻ mạnh, tập được 4 tháng.
Hôm nay khách báo đêm qua chỉ ngủ 3 tiếng vì deadline, người rã rời nhưng vẫn muốn tập.
Gói L1, tập 6 buổi/tuần. Buổi TOÀN THÂN theo lịch.`,
    targetTotalSets: 10, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 1,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Sumo Deadlift", "Deadlift kiểu Sumo", "Box Jump",
      "Jump Squat nặng", "Burpees",
    ],
    explanation: `Không có chấn thương nào ở hồ sơ này — ràng buộc là trạng thái của khách hôm đó.
Ngủ 3 tiếng thì phản xạ chậm, kỹ thuật xuống, và bài nặng có thanh đòn là chỗ chấn thương xảy ra.
Đáp án là một buổi ngắn, nhẹ, đủ để giữ thói quen: 10 set, không tạ đòn nặng, không bật nhảy.
Chạy đúng giáo án đã soạn từ đầu tuần vì "lịch là lịch" chính là không đọc được người đang đứng trước mặt mình.`,
  },
];
