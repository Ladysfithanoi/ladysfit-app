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
  {
    clientProfile: `Chị Cẩm, 29 tuổi · 58kg · TRẬT KHỚP VAI PHẢI 2 lần trong quá khứ, lần gần nhất 8 tháng trước.
Bác sĩ dặn tránh tư thế vai dạng ngang kết hợp xoay ngoài. Gói L1, tập 5 buổi/tuần.
Buổi THÂN TRÊN.`,
    targetTotalSets: 15, targetLowerSets: 0, targetUpperSets: 12, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Pull", "Upper Isolate"],
    bannedExercises: [
      "Overhead Press", "Arnold Press", "Dumbbell Shoulder Press nặng",
      "Barbell Bench Press", "Pull-Up", "Overhead Tricep Extension",
    ],
    explanation: `Tư thế nguy hiểm nhất cho vai đã từng trật là dạng ngang kèm xoay ngoài — đúng vị trí của đẩy vai qua đầu và đẩy tạ đòn ngực.
Vẫn tập thân trên đủ 12 set bằng bài kéo, bài tạ đơn góc hẹp và bài đơn khớp có kiểm soát.`,
  },
  {
    clientProfile: `Chị Đào, 36 tuổi · 74kg · TIỂU ĐƯỜNG TYPE 2 dùng thuốc, có biến chứng TÊ BÌ BÀN CHÂN nhẹ.
Bác sĩ cho tập, dặn tránh bài đòi thăng bằng cao và kiểm tra chân sau buổi.
Gói L2, 5 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Bulgarian Split Squat (mông tập trung)", "Box Jump", "Skater Jumps",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)", "Burpees",
    ],
    explanation: `Tê bì bàn chân làm mất cảm giác tiếp đất — bài một chân và bài bật nhảy trở thành nguy cơ ngã.
Vẫn tập chân nặng bằng bài hai chân có điểm tựa, và nhắc khách kiểm tra bàn chân sau buổi vì họ có thể không cảm thấy vết trầy.`,
  },
  {
    clientProfile: `Chị Hường, 27 tuổi · 61kg · HỘI CHỨNG ỐNG CỔ TAY, đau khi chống tay chịu lực.
Không chấn thương khác. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Full Plank (Plank thường)", "Bear Plank (Plank gấu)", "Burpees",
      "Full Plank In & Out (Plank bật nhảy)", "Full Plank Shoulder Touch (Plank chạm vai nhanh)",
      "Half Burpee",
    ],
    explanation: `Cổ tay đau khi chống chịu lực thì mọi bài plank chống tay và burpee đều phải bỏ — đó là lý do Push không nằm trong mẫu bắt buộc.
Core vẫn tập được bằng bài chống trên khuỷu, dead bug, bird dog; kéo thì dùng dây đeo cổ tay.`,
  },
  {
    clientProfile: `Chị Kiều, 39 tuổi · 69kg · BỆNH GÚT, vừa qua đợt sưng đau ngón chân cái cách đây 10 ngày.
Hiện hết sưng nhưng còn ê. Bác sĩ cho vận động nhẹ trở lại.
Gói L2, 5 buổi/tuần. Buổi TOÀN THÂN đầu tiên sau đợt cấp.`,
    targetTotalSets: 10, targetLowerSets: 4, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Push", "Pull"],
    bannedExercises: [
      "Box Jump", "Burpees", "Skater Jumps", "Jump Squat nặng",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)", "Lunges đi bộ",
    ],
    explanation: `Khớp vừa qua đợt viêm cấp thì phải tránh mọi lực dội lên bàn chân, và khối lượng chung phải hạ hẳn.
Buổi này nghiêng về thân trên là hợp lý — Squat không nằm trong mẫu bắt buộc, đó là chủ ý chứ không phải bỏ sót.`,
  },
  {
    clientProfile: `Chị Loan, 30 tuổi · 55kg · MANG THAI 7 THÁNG, thai kỳ bình thường, bác sĩ cho tập nhẹ.
Bụng đã lớn, không nằm ngửa được, thăng bằng kém đi rõ.
Tập 2 buổi/tuần. Buổi TOÀN THÂN rất nhẹ.`,
    targetTotalSets: 8, targetLowerSets: 4, targetUpperSets: 3, targetCoreSets: 1,
    tolerancePercent: 25,
    requiredPatterns: ["Squat"],
    bannedExercises: [
      "Crunches (Gập bụng)", "Bicycle Crunch (Gập bụng đạp xe)", "Russian Twist",
      "Box Jump", "Burpees", "Jump Squat nặng", "Barbell Back Squat",
      "Dumbbell Bench Press (Đẩy ngực ghế thẳng)", "Barbell Bench Press",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
    ],
    explanation: `Tam cá nguyệt cuối thì bỏ hẳn tư thế nằm ngửa, bỏ gập xoay bụng, bỏ mọi bài dễ mất thăng bằng.
Khối lượng 8 set và mục tiêu chỉ là giữ vận động — so với hồ sơ thai 5 tháng thì phải nhẹ hơn nữa, đó là điểm phân biệt.`,
  },
  {
    clientProfile: `Chị Mến, 44 tuổi · 70kg · SUY THẬN ĐỘ 2, bác sĩ dặn tránh gắng sức tối đa và giữ đủ nước.
Được phép tập cường độ vừa. Gói L3, 4 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 12, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Push", "Pull"],
    bannedExercises: ["Burpees", "Box Jump", "Sumo Deadlift", "Barbell Back Squat"],
    explanation: `Gắng sức tối đa và mất nước là hai thứ làm nặng thêm gánh cho thận — bỏ bài nặng sát giới hạn và bài cardio cường độ cao.
Vẫn tập tạ đều đặn ở cường độ vừa, và nhắc uống nước trong buổi là một phần của giáo án chứ không phải lời khuyên thêm.`,
  },
  {
    clientProfile: `Chị Nguyệt, 35 tuổi · 67kg · ĐANG CHO CON BÚ, bé 6 tháng, ngực căng tức khi nằm sấp.
Không chấn thương. Tập 4 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Full Plank (Plank thường)", "Bear Plank (Plank gấu)", "Burpees",
      "Chest Supported Row", "Full Plank In & Out (Plank bật nhảy)",
    ],
    explanation: `Ràng buộc ở đây rất cụ thể và hay bị bỏ qua: tư thế nằm sấp gây đau cho người đang cho con bú.
Bỏ plank sấp và bài tựa ngực, thay bằng core đứng và kéo ngồi; phần còn lại tập bình thường.`,
  },
  {
    clientProfile: `Chị Phượng, 28 tuổi · 59kg · CONG VẸO CỘT SỐNG nhẹ bẩm sinh, không đau, có theo dõi định kỳ.
Bác sĩ cho tập tạ, dặn tránh tải lệch một bên và tránh gập xoay có tải.
Gói L1, 5 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [
      "Russian Twist", "Assisted 1 Arm DB Row (Kéo lưng ngang 1 tay có trợ lực)",
      "Bulgarian Split Squat (mông tập trung)", "Barbell Bent-Over Row",
      "BB Bent Row (Gập người kéo lưng ngang với thanh đòn)",
    ],
    explanation: `Cong vẹo nhẹ không cấm tập tạ — trái lại, cơ lưng khoẻ là thứ giúp giữ tư thế. Cái phải tránh là tải lệch một bên và gập xoay có tải.
Dùng bài hai bên cân đối và bài có tựa; đây là hồ sơ mà tránh hết mọi thứ vì thấy chữ "cột sống" là làm hại khách.`,
  },
  {
    clientProfile: `Chị Sương, 50 tuổi · 72kg · THAY KHỚP GỐI PHẢI cách đây 14 tháng, phục hồi tốt.
Bác sĩ dặn không gập gối quá 90 độ khi có tải, không va đập.
Gói L3, 4 buổi/tuần. Buổi THÂN DƯỚI.`,
    targetTotalSets: 12, targetLowerSets: 9, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Glute Attack"],
    bannedExercises: [
      "Barbell Back Squat", "Box Jump", "Jump Squat nặng", "Burpees",
      "Bulgarian Split Squat (mông tập trung)", "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
      "Skater Jumps",
    ],
    explanation: `Khớp nhân tạo chịu tải tốt nhưng không chịu được va đập và gập sâu có tải — đó là hai giới hạn phải giữ suốt đời.
Squat không nằm trong mẫu bắt buộc; gập hông và bài mông cho khối lượng chân mà không ép gối gập sâu.`,
  },
  {
    clientProfile: `Chị Thắm, 33 tuổi · 68kg · BUỒNG TRỨNG ĐA NANG, kháng insulin, bác sĩ khuyến khích tập tạ.
Không chấn thương. Gói L2, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 17, targetLowerSets: 8, targetUpperSets: 6, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [],
    explanation: `Hồ sơ này bẫy theo hướng ngược: thấy chữ "bệnh" là hạ khối lượng, trong khi tạ nặng chính là thứ bác sĩ khuyến khích.
Khối cơ tăng thì độ nhạy insulin cải thiện — 17 set đủ bốn mẫu là điều trị, không phải mạo hiểm.`,
  },
  {
    clientProfile: `Chị Trúc, 26 tuổi · 64kg · THOÁI HOÁ ĐỐT SỐNG CỔ, đau khi ngửa cổ và khi gánh nặng lên vai.
Bác sĩ cho tập, tránh tải lên cổ. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell High Bar Back Squat (Squat thanh đòn)",
      "Overhead Press", "Arnold Press", "Dumbbell Shoulder Press nặng",
      "Sand Bag Holy Combo (Bật Squat + Đẩy vai + Bước Lunge)",
    ],
    explanation: `Gánh thanh đòn lên vai truyền lực thẳng qua cột sống cổ, còn đẩy qua đầu bắt cổ ngửa — bỏ cả hai nhóm.
Squat vẫn tập được bằng goblet, hack squat và leg press; đó là điểm khác giữa "bỏ một bài" và "bỏ một mẫu vận động".`,
  },
  {
    clientProfile: `Chị Uyên, 37 tuổi · 77kg · THIẾU MÁU đang uống viên sắt, hay chóng mặt khi đứng dậy nhanh.
Không chấn thương. Gói L2, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: ["Burpees", "Box Jump", "Half Burpee", "Full Half Burpee (Burpee nhanh)"],
    explanation: `Chóng mặt khi đổi tư thế nhanh thì bỏ bài đứng lên nằm xuống liên tục và bài cardio cường độ cao.
Khối lượng hạ nhẹ so với người cùng cân nặng, và cho nghỉ dài hơn giữa các set — đó là điều chỉnh đúng chỗ.`,
  },
  {
    clientProfile: `Chị Vy, 32 tuổi · 56kg · VIÊM GÂN GÓT CHÂN bên trái, đau khi chạy và nhảy, đi bộ thì không.
Đang điều trị vật lý trị liệu. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Push", "Pull"],
    bannedExercises: [
      "Box Jump", "Jump Squat nặng", "Skater Jumps", "Burpees",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
      "Full High Knee (Chạy nâng cao gối)", "Full Butt Touch (Chạy gót chạm mông)",
    ],
    explanation: `Viêm gân gót chịu được tải chậm có kiểm soát nhưng không chịu được lực dội — bỏ mọi bài chạy và nhảy.
Đây là hồ sơ dễ sai vì khách nói "đi bộ không đau", và PT hiểu nhầm là chân đã ổn.`,
  },
  {
    clientProfile: `Chị Xoan, 42 tuổi · 68kg · CƯỜNG GIÁP đang điều trị, nhịp tim nghỉ 95, hay hồi hộp.
Bác sĩ cho tập nhẹ tới vừa, theo dõi nhịp tim. Gói L3, 4 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 11, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [
      "Burpees", "Box Jump", "Half Burpee", "Full Half Burpee (Burpee nhanh)",
      "Sumo Deadlift", "Barbell Back Squat",
    ],
    explanation: `Nhịp tim nghỉ 95 nghĩa là tim đã làm việc nhiều khi chưa tập gì — bỏ hẳn phần cường độ cao.
Tập tạ cường độ vừa vẫn được và vẫn nên, nhưng đây là hồ sơ phải theo dõi nhịp tim trong buổi chứ không tập theo cảm giác.`,
  },
  {
    clientProfile: `Chị Ánh, 28 tuổi · 70kg · TRÀO NGƯỢC DẠ DÀY nặng, đau khi nằm đầu thấp và khi ép bụng.
Vừa ăn cách đây 1 tiếng. Gói L2, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Push", "Pull"],
    bannedExercises: [
      "Crunches (Gập bụng)", "Bicycle Crunch (Gập bụng đạp xe)", "Russian Twist",
      "Burpees", "Cable Crunch", "Sumo Deadlift",
    ],
    explanation: `Trào ngược nặng thì bài ép bụng và tư thế đầu thấp gây khó chịu ngay trong buổi, nhất là khi vừa ăn.
Core chuyển sang bài đứng và bài chống; đây là ràng buộc về trải nghiệm chứ không phải an toàn, nhưng bỏ qua thì khách không tập nổi.`,
  },
  {
    clientProfile: `Chị Bảo, 33 tuổi · 66kg · MỔ RUỘT THỪA cách đây 6 TUẦN, vết mổ đã lành, bác sĩ cho tập lại.
Chưa tập gì từ khi mổ. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN đầu tiên sau mổ.`,
    targetTotalSets: 9, targetLowerSets: 4, targetUpperSets: 4, targetCoreSets: 1,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [
      "Crunches (Gập bụng)", "Bicycle Crunch (Gập bụng đạp xe)", "Russian Twist",
      "Full Plank (Plank thường)", "Burpees", "Sumo Deadlift", "Barbell Back Squat",
    ],
    explanation: `Sáu tuần sau mổ bụng thì thành bụng còn đang lành ở lớp sâu dù da đã liền — chưa tập core chống và chưa gánh nặng.
Bắt đầu ở 9 set và tăng dần trong 4 tuần; đây là hồ sơ mà "bác sĩ cho tập lại" không có nghĩa là tập như cũ.`,
  },
  {
    clientProfile: `Chị Chi, 22 tuổi · 60kg · ĐỘNG KINH kiểm soát tốt bằng thuốc, 2 năm chưa lên cơn.
Bác sĩ cho tập, dặn tránh tập một mình và tránh vị trí có nguy cơ ngã.
Gói L1, 4 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell Bench Press", "Box Jump",
      "Barbell High Bar Back Squat (Squat thanh đòn)",
    ],
    explanation: `Kiểm soát tốt thì tập gần như bình thường — điều phải tránh là tư thế mà một cơn co giật bất ngờ sẽ gây chấn thương: tạ đòn đè lên người, đứng trên bục cao.
Dùng máy và tạ đơn cho những vị trí đó; đừng hạ khối lượng chỉ vì thấy tên bệnh.`,
  },
  {
    clientProfile: `Chị Diệp, 30 tuổi · 64kg · ĐAU KHỚP HÁNG phải khi xoay ngoài, chưa có chẩn đoán, mới đau 1 tuần.
Chưa đi khám. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 12, targetLowerSets: 4, targetUpperSets: 6, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Push", "Pull"],
    bannedExercises: [
      "Sumo Deadlift", "Deadlift kiểu Sumo", "Sumo Squat rộng",
      "Bulgarian Split Squat (mông tập trung)", "Box Jump", "Skater Jumps",
      "Cable Hip Abduction (Mở hông với dây cáp)",
    ],
    explanation: `Đau mới một tuần và chưa có chẩn đoán thì nguyên tắc là không đụng vào tầm gây đau, và phải khuyên khách đi khám — ghi lại việc đã khuyên.
Buổi này dồn về thân trên; chân giữ ở mức tối thiểu với bài không xoay ngoài.`,
  },
  {
    clientProfile: `Chị Giang, 29 tuổi · 57kg · HUYẾT ÁP THẤP, hay xây xẩm khi đứng lên từ tư thế nằm.
Không bệnh khác. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Burpees", "Half Burpee", "Full Half Burpee (Burpee nhanh)"],
    explanation: `Huyết áp thấp thì vấn đề là đổi tư thế đột ngột, không phải khối lượng — giữ nguyên 14 set, chỉ bỏ bài nằm xuống đứng lên liên tục.
Sắp bài nằm và bài đứng thành cụm riêng để khách không phải đổi tư thế liên tục giữa các set.`,
  },
  {
    clientProfile: `Chị Hạnh, 47 tuổi · 71kg · THOÁI HOÁ KHỚP GỐI hai bên, hôm nay gối TRÁI sưng nhẹ và ấm.
Chưa đi khám lại. Gói L3, 4 buổi/tuần.
Buổi theo lịch là THÂN DƯỚI.`,
    targetTotalSets: 11, targetLowerSets: 2, targetUpperSets: 7, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Push", "Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Box Jump", "Bulgarian Split Squat (mông tập trung)",
      "Lunges đi bộ", "Jump Squat nặng", "Leg Press", "Single Leg Leg Press",
    ],
    explanation: `Khớp SƯNG VÀ ẤM là dấu hiệu viêm đang hoạt động — không phải lúc tập chân, dù lịch ghi là buổi thân dưới.
Đổi sang thân trên, khuyên khách đi khám, ghi lại. Chạy đúng lịch ở hồ sơ này là đẩy một khớp đang viêm vào đợt nặng hơn.`,
  },
  {
    clientProfile: `Chị Kim, 24 tuổi · 58kg · TIỀN SỬ RỐI LOẠN ĂN UỐNG, đang điều trị tâm lý, đã ổn định 1 năm.
Bác sĩ tâm lý dặn tránh nhấn mạnh cân nặng và tránh tập tới kiệt sức.
Gói L1, 4 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Burpees", "Box Jump", "Half Burpee"],
    explanation: `Ràng buộc ở đây không nằm ở khớp mà ở cách buổi tập được dẫn: không đếm calo trong buổi, không tập tới kiệt, không nói về cân nặng.
Khối lượng bình thường và mục tiêu đặt theo sức nâng chứ không theo con số cân — đây là hồ sơ đo sự tinh tế nhiều hơn đo kiến thức.`,
  },
  {
    clientProfile: `Chị Lan, 45 tuổi · 72kg · CAO HUYẾT ÁP dùng thuốc, hôm nay đo được 155/95 trước buổi tập.
Khách nói vẫn thấy bình thường. Gói L3, 5 buổi/tuần.
Buổi TOÀN THÂN theo lịch.`,
    targetTotalSets: 8, targetLowerSets: 3, targetUpperSets: 3, targetCoreSets: 2,
    tolerancePercent: 25,
    requiredPatterns: ["Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Sumo Deadlift", "Burpees", "Box Jump",
      "Overhead Press", "Barbell Bench Press", "Jump Squat nặng",
    ],
    explanation: `Chỉ số 155/95 ngay trước buổi tập là mốc phải hạ hẳn cường độ và báo FM, dù khách nói mình bình thường.
Buổi rất nhẹ, không bài nặng, không bài qua đầu; và nếu đo lại vẫn cao thì dừng hẳn buổi đó.`,
  },
  {
    clientProfile: `Chị Mai, 28 tuổi · 62kg · HEN PHẾ QUẢN, mang theo thuốc xịt, thời tiết hôm nay lạnh và khô.
Đã 6 tháng không lên cơn. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Burpees", "Full Half Burpee (Burpee nhanh)", "Box Jump", "Skater Jumps"],
    explanation: `Không khí lạnh khô là yếu tố kích hoạt hen thường gặp — giảm phần cường độ cao, khởi động dài hơn, và xác nhận khách có thuốc xịt trong túi.
Khối lượng tạ giữ nguyên; thứ phải cắt là phần thở gấp, không phải phần nâng.`,
  },
  {
    clientProfile: `Chị Ninh, 42 tuổi · 70kg · ĐAU VAI TRÁI đã khám, chẩn đoán viêm gân chóp xoay, đang tập phục hồi.
Bác sĩ cho tập, giới hạn tầm dưới vai và không mang nặng qua đầu.
Gói L2, 4 buổi/tuần. Buổi THÂN TRÊN.`,
    targetTotalSets: 13, targetLowerSets: 0, targetUpperSets: 11, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Pull", "Upper Isolate"],
    bannedExercises: [
      "Overhead Press", "Arnold Press", "Dumbbell Shoulder Press nặng",
      "Overhead Tricep Extension", "Pull-Up", "Dumbbell Lateral Raise nặng",
      "OVH Lat Pulldown (Kéo lưng dọc úp tay)",
    ],
    explanation: `Khác hồ sơ "đau vai chưa khám": ở đây đã có chẩn đoán và có giới hạn cụ thể, nên tập được nhiều hơn — chỉ giữ dưới tầm vai.
Kéo ngang, bài đơn khớp góc thấp và bài xoay ngoài nhẹ đều nằm trong phần phục hồi, không phải phần cấm.`,
  },
  {
    clientProfile: `Chị Oanh, 32 tuổi · 74kg · GIÃN TĨNH MẠCH CHÂN, đau nặng chân khi đứng lâu.
Bác sĩ khuyến khích vận động, tránh đứng yên lâu và tránh nín thở gắng sức.
Gói L2, 4 buổi/tuần. Buổi THÂN DƯỚI.`,
    targetTotalSets: 14, targetLowerSets: 11, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Lower Isolate"],
    bannedExercises: [
      "Wall Sit (Squat dựa tường)", "Sumo Deadlift", "Barbell Back Squat", "Farmer Walk (Xách tạ đi bộ)",
    ],
    explanation: `Giãn tĩnh mạch cần cơ chân co bóp để đẩy máu về — tập chân là điều trị, không phải điều cấm.
Cái phải bỏ là bài giữ tư thế tĩnh lâu và bài nặng gây nín thở rặn; nên Wall Sit và Farmer Walk bị loại còn squat động thì không.`,
  },
  {
    clientProfile: `Chị Quyên, 27 tuổi · 55kg · MỚI XĂM LƯNG cách đây 5 ngày, vùng xăm còn đang lành.
Không vấn đề sức khoẻ khác. Gói L1, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 7, targetUpperSets: 4, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell High Bar Back Squat (Squat thanh đòn)",
      "Chest Supported Row", "T-Bar Row", "Full Plank (Plank thường)",
    ],
    explanation: `Ràng buộc rất đời thường mà hay bị bỏ qua: vùng da đang lành không được cọ xát hay tì đè, và mồ hôi nhiều làm tăng nguy cơ nhiễm trùng.
Bỏ bài tì lưng và gánh đòn trong 2 tuần, phần còn lại tập bình thường — không cần nghỉ tập cả tháng.`,
  },
  {
    clientProfile: `Chị Thu, 41 tuổi · 80kg · BÉO PHÌ ĐỘ 1, đau lưng dưới khi đứng quá 20 phút.
Đã khám, không tổn thương cấu trúc. Gói L2, 6 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Hinge", "Pull", "Core"],
    bannedExercises: ["Barbell Back Squat", "Sumo Deadlift", "Box Jump", "Burpees"],
    explanation: `Đau lưng không do tổn thương thì thứ cần là chuỗi sau khoẻ và core giữ được tư thế — cả ba đều nằm trong mẫu bắt buộc.
Chọn bài ngồi và bài có tựa để khách không phải đứng lâu trong buổi; đó là điều chỉnh nhỏ nhưng quyết định khách có tập hết buổi hay không.`,
  },
  {
    clientProfile: `Chị Trang, 27 tuổi · 61kg · MỚI TIÊM PHÒNG cánh tay trái sáng nay, tay đau nhức.
Không vấn đề khác. Gói L1, 5 buổi/tuần.
Buổi THÂN TRÊN theo lịch.`,
    targetTotalSets: 12, targetLowerSets: 8, targetUpperSets: 2, targetCoreSets: 2,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Hinge"],
    bannedExercises: [],
    explanation: `Việc nhỏ nhưng đúng: đổi buổi thân trên sang buổi chân, trả buổi thân trên về ngày sau khi tay hết đau.
Chạy đúng lịch với một cánh tay vừa tiêm là buổi tập tệ và không cần thiết — đổi lịch ở đây không phải nhân nhượng mà là biết đọc tình huống.`,
  },
  {
    clientProfile: `Chị Vân, 35 tuổi · 75kg · THOÁT VỊ ĐĨA ĐỆM L4-L5, đã tập với bạn 4 tháng, kỹ thuật rất tốt.
Không đau suốt 3 tháng qua. Bác sĩ cho tăng dần tải có kiểm soát.
Gói L2, 5 buổi/tuần. Buổi THÂN DƯỚI.`,
    targetTotalSets: 16, targetLowerSets: 13, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Glute Attack"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell Romanian Deadlift (Gập hông với thanh đòn)",
      "Sumo Deadlift", "Barbell Bent-Over Row", "Box Jump",
    ],
    explanation: `Cùng một chẩn đoán nhưng khác giai đoạn: sau 4 tháng không đau và kỹ thuật tốt thì khối lượng phải TĂNG, kể cả Hinge có kiểm soát.
Giữ mãi mức dè dặt của buổi đầu vì thấy chữ "thoát vị" là để khách không bao giờ khoẻ lên — đó cũng là một dạng kiêu ngạo, dạng không dám sửa đánh giá cũ.`,
  },
  {
    clientProfile: `Chị Yến, 33 tuổi · 85kg · buổi tập đầu tiên sau khi báo BỊ NGÃ CẦU THANG hôm qua, đau hông trái.
Chưa đi khám, đi lại được nhưng khập khiễng.
Gói L2, 6 buổi/tuần. Buổi TOÀN THÂN theo lịch.`,
    targetTotalSets: 6, targetLowerSets: 0, targetUpperSets: 5, targetCoreSets: 1,
    tolerancePercent: 25,
    requiredPatterns: ["Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Sumo Deadlift", "Box Jump", "Burpees", "Leg Press",
      "Bulgarian Split Squat (mông tập trung)", "Lunges đi bộ", "Barbell Hip Thrust",
    ],
    explanation: `Chấn thương cấp chưa khám và còn khập khiễng thì việc đúng nhất là KHÔNG tập chân và khuyên đi khám ngay hôm nay.
Buổi 6 set ngồi tập thân trên là để giữ liên hệ với khách, không phải để hoàn thành chỉ tiêu buổi dạy.`,
  },
  {
    clientProfile: `Chị Hoà, 37 tuổi · 73kg · SỎI THẬN đã tán, bác sĩ dặn uống nhiều nước và tránh mất nước.
Không giới hạn vận động. Gói L2, 5 buổi/tuần.
Buổi TOÀN THÂN, phòng hôm nay nóng.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Burpees", "Box Jump", "Full Half Burpee (Burpee nhanh)"],
    explanation: `Không có giới hạn vận động nên khối lượng giữ nguyên — cái phải điều chỉnh là phần đổ mồ hôi nhiều trong phòng nóng.
Bỏ phần cường độ cao, cho nghỉ dài hơn, nhắc uống nước theo mốc chứ không theo cảm giác khát.`,
  },
  {
    clientProfile: `Chị Nhi, 30 tuổi · 65kg · ĐEO KÍNH ÁP TRÒNG, bác sĩ mắt dặn tránh tăng áp lực nội nhãn đột ngột.
Cận nặng 8 độ, có thoái hoá võng mạc. Gói L1, 4 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 4, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Sumo Deadlift", "Barbell Back Squat", "Deadlift kiểu Sumo",
      "Burpees", "Box Jump", "Barbell Hip Thrust nặng",
    ],
    explanation: `Cận nặng kèm thoái hoá võng mạc là nhóm phải tránh gắng sức tối đa và nín thở rặn — hai thứ làm tăng áp lực nội nhãn.
Tập tạ vẫn được ở cường độ vừa với nhịp thở đều; đây là ràng buộc ít PT nghĩ tới nhưng có trong hồ sơ thì phải đọc.`,
  },
  {
    clientProfile: `Chị Tuyết, 34 tuổi · 68kg · HỞ CƠ THẲNG BỤNG sau sinh, đã tập phục hồi 4 tháng, khe hở còn 1 đốt ngón tay.
Chuyên gia sàn chậu cho phép tăng dần bài core. Gói L1, 4 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull", "Core"],
    bannedExercises: ["Crunches (Gập bụng)", "Bicycle Crunch (Gập bụng đạp xe)", "Russian Twist"],
    explanation: `So với hồ sơ hở cơ 2 đốt: khe hở đã thu lại và có người chuyên môn cho phép tiến, nên core tăng lên 3 set với bài chống và bài kháng xoay.
Gập bụng và xoay vặn vẫn bỏ — tiến từng bước không có nghĩa là mở hết cùng lúc.`,
  },
  {
    clientProfile: `Chị Duyên, 30 tuổi · 60kg · vừa hiến máu SÁNG NAY, đã nghỉ 4 tiếng, thấy hơi mệt.
Không vấn đề sức khoẻ khác. Gói L1, 4 buổi/tuần.
Buổi TOÀN THÂN theo lịch.`,
    targetTotalSets: 7, targetLowerSets: 3, targetUpperSets: 3, targetCoreSets: 1,
    tolerancePercent: 25,
    requiredPatterns: ["Squat"],
    bannedExercises: [
      "Burpees", "Box Jump", "Barbell Back Squat", "Sumo Deadlift",
      "Full Half Burpee (Burpee nhanh)", "Jump Squat nặng",
    ],
    explanation: `Sau hiến máu thì thể tích tuần hoàn giảm — trong 24 giờ đầu không tập nặng, không cardio cường độ cao.
Buổi 7 set rất nhẹ hoặc hoãn hẳn đều là đáp án đúng; chạy giáo án bình thường là cách khách xây xẩm ngay giữa sàn.`,
  },
  {
    clientProfile: `Chị Quế, 26 tuổi · 67kg · dùng THUỐC TRÁNH THAI liều cao, bác sĩ cảnh báo nguy cơ huyết khối.
Không triệu chứng. Gói L2, 5 buổi/tuần.
Buổi TOÀN THÂN.`,
    targetTotalSets: 14, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Wall Sit (Squat dựa tường)", "Farmer Walk (Xách tạ đi bộ)"],
    explanation: `Nguy cơ huyết khối thì tránh giữ tư thế tĩnh lâu và ngồi bất động giữa các set — vận động đều lại là điều tốt.
Khối lượng bình thường, chỉ bỏ bài giữ tĩnh kéo dài và nhắc khách đi lại nhẹ trong lúc nghỉ giữa set.`,
  },
  {
    clientProfile: `Chị Thuý, 31 tuổi · 64kg · SAU MỔ NỘI SOI ĐẦU GỐI 10 tuần, đã hết giai đoạn vật lý trị liệu.
Bác sĩ cho tập tạ trở lại, tránh xoay gối chịu tải. Gói L2, 4 buổi/tuần.
Buổi THÂN DƯỚI đầu tiên.`,
    targetTotalSets: 11, targetLowerSets: 8, targetUpperSets: 0, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge"],
    bannedExercises: [
      "Box Jump", "Skater Jumps", "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
      "Bulgarian Split Squat (mông tập trung)", "Lunges đi bộ", "Jump Squat nặng",
    ],
    explanation: `Hết vật lý trị liệu không có nghĩa là gối đã như cũ — buổi thân dưới đầu tiên phải nhẹ và tuyệt đối không có bài xoay hay va đập.
11 set với bài hai chân trên mặt phẳng dọc, tăng dần trong 6 tuần tiếp theo.`,
  },
  {
    clientProfile: `Chị Vân Anh, 35 tuổi · 62kg · MẤT NGỦ KÉO DÀI 3 tuần, đang dùng thuốc an thần theo đơn.
Bác sĩ dặn thuốc gây buồn ngủ và giảm phản xạ. Gói L1, 4 buổi/tuần.
Buổi TOÀN THÂN, khách tập buổi sáng sau khi uống thuốc tối qua.`,
    targetTotalSets: 10, targetLowerSets: 5, targetUpperSets: 4, targetCoreSets: 1,
    tolerancePercent: 20,
    requiredPatterns: ["Squat", "Pull"],
    bannedExercises: [
      "Barbell Back Squat", "Barbell Bench Press", "Sumo Deadlift", "Box Jump",
      "Barbell High Bar Back Squat (Squat thanh đòn)",
    ],
    explanation: `Thuốc an thần còn tác dụng vào sáng hôm sau làm chậm phản xạ — bỏ mọi bài mà mất kiểm soát một giây là tai nạn.
Dùng máy và tạ đơn nhẹ; đây là ràng buộc đến từ ĐƠN THUỐC chứ không từ khớp, và nó chỉ lộ ra nếu PT chịu hỏi.`,
  },
  {
    clientProfile: `Chị Bình, 48 tuổi · 74kg · LOÃNG XƯƠNG kèm TIỀN SỬ GÃY CỔ TAY 2 năm trước.
Bác sĩ khuyên tập tạ, tránh chống tay chịu lực và tránh ngã.
Gói L3, 4 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 13, targetLowerSets: 6, targetUpperSets: 5, targetCoreSets: 2,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Pull"],
    bannedExercises: [
      "Full Plank (Plank thường)", "Bear Plank (Plank gấu)", "Burpees", "Box Jump",
      "Full Plank In & Out (Plank bật nhảy)", "Skater Jumps",
      "Bodyweight Jumping Lunge (Nhảy đổi chân trước, chân sau không tạ)",
    ],
    explanation: `Hai ràng buộc chồng nhau: xương yếu cần tải để chắc lên, nhưng cổ tay từng gãy không chịu được chống tay và mọi cú ngã đều nguy hiểm.
Dùng máy và tạ đơn có tay cầm, core bằng bài nằm; đừng vì cổ tay mà bỏ luôn phần tải dọc trục vốn là mục tiêu điều trị.`,
  },
  {
    clientProfile: `Chị Xuân, 38 tuổi · 65kg · khách nói "hôm nay muốn tập thật nặng cho bõ" sau khi cãi nhau với chồng.
Không chấn thương, sức khoẻ bình thường. Đã tập 9 tháng.
Gói L1, 4 buổi/tuần. Buổi TOÀN THÂN.`,
    targetTotalSets: 15, targetLowerSets: 7, targetUpperSets: 5, targetCoreSets: 3,
    tolerancePercent: 15,
    requiredPatterns: ["Squat", "Hinge", "Push", "Pull"],
    bannedExercises: ["Barbell Back Squat", "Sumo Deadlift", "Box Jump"],
    explanation: `Tập là cách xả căng thẳng tốt, nên giữ nguyên khối lượng của buổi — không cắt giảm chỉ vì khách đang xúc động.
Nhưng bỏ bài tạ đòn nặng: người đang bực dễ bỏ qua kỹ thuật để đẩy cho bõ, và đó là lúc chấn thương xảy ra.`,
  },
];
