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

// ── Vòng 2 · Sa ngã ──────────────────────────────────────────────────────────
// Ranh giới nghề nghiệp. Trộn ba nhóm cố ý: chuyện vô hại (để người thi không
// thành hoang tưởng thấy đâu cũng nguy hiểm), chuyện xám (phần lớn thẻ nằm ở
// đây — đó mới là chỗ phân loại được người), và chuyện phải từ chối thẳng.
const SORT_INTRO = `Mỗi thẻ là một tình huống có thật ở phòng tập. Xếp nó vào một trong ba vùng:

• Chấp nhận — làm bình thường, không cần báo ai.
• Cần cẩn trọng — làm được nhưng phải có giới hạn rõ ràng, hoặc phải nói trước với FM.
• Từ chối & báo FM — không làm, và quản lý phải biết.

Xếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc — như chấp nhận thẳng một việc
đáng phải từ chối — thì mất hết điểm của thẻ đó.`;

const SORT_CARDS: { text: string; correctZone: ExamSortZone; explanation: string }[] = [
  {
    text: "Khách hoàn thành gói L2 và rủ cả nhóm tập cùng đi ăn mừng, có mời bạn đi cùng.",
    correctZone: "ACCEPT",
    explanation:
      "Sinh hoạt nhóm, công khai, nhiều người. Không có gì phải cân nhắc — từ chối những việc như thế này chỉ làm khách thấy xa cách.",
  },
  {
    text: "Khách tặng bạn một bình nước và một chiếc khăn tập nhân dịp sinh nhật bạn.",
    correctZone: "ACCEPT",
    explanation:
      "Quà nhỏ, giá trị tượng trưng, tặng công khai. Nhận và cảm ơn là ứng xử bình thường.",
  },
  {
    text: "Khách nhờ bạn chụp giúp ảnh tiến độ để chính khách đăng lên trang cá nhân của họ.",
    correctZone: "ACCEPT",
    explanation:
      "Ảnh của khách, khách tự đăng, bạn chỉ bấm máy. Khác hẳn với việc phòng tập dùng ảnh đó.",
  },
  {
    text: "Khách nhắn tin lúc 11h đêm hỏi mai ăn gì trước buổi tập.",
    correctZone: "CAUTION",
    explanation:
      "Câu hỏi chính đáng, nhưng trả lời lúc 11h đêm một lần là mở ra kỳ vọng trả lời mọi lúc. Trả lời được, kèm một câu đặt giới hạn giờ nhắn tin — đặt sớm thì nhẹ nhàng, để lâu mới đặt thì thành ra bạn đang xa lánh khách.",
  },
  {
    text: "Khách kết bạn Facebook cá nhân của bạn.",
    correctZone: "CAUTION",
    explanation:
      "Không sai, nhưng trang cá nhân của bạn từ lúc đó là một phần hình ảnh nghề nghiệp. Cân nhắc trước khi đồng ý, và nếu đồng ý thì tự soát lại những gì mình đăng.",
  },
  {
    text: "Đang tập, khách kể chuyện mâu thuẫn với chồng rồi bật khóc.",
    correctZone: "CAUTION",
    explanation:
      "Lắng nghe là một phần của nghề — nhưng bạn là HLV, không phải chuyên gia tâm lý. Dừng vài phút, ghi nhận cảm xúc của khách, rồi đưa buổi tập trở lại. Ôm luôn vai trò tư vấn tâm lý là bước qua ranh giới chuyên môn của chính mình.",
  },
  {
    text: "Phòng tập muốn đăng ảnh before/after của khách lên fanpage. Khách đã đồng ý miệng với bạn.",
    correctZone: "CAUTION",
    explanation:
      "Đồng ý miệng là chưa đủ để dùng hình ảnh của một người lên kênh thương mại. Phải có xác nhận bằng văn bản, và khách phải biết ảnh sẽ đăng ở đâu. Báo FM trước khi gửi ảnh đi.",
  },
  {
    text: "Khách nhờ bạn giữ hộ chìa khoá tủ đồ trong hai tuần đi công tác.",
    correctZone: "CAUTION",
    explanation:
      "Việc nhỏ nhưng bạn đang cầm tài sản của khách mà không ai biết. Mất đồ là không có cách nào chứng minh. Gửi lễ tân giữ theo quy trình của phòng tập.",
  },
  {
    text: "Khách xin số tài khoản cá nhân của bạn để chuyển tiền gói tập cho nhanh, khỏi phải ra quầy.",
    correctZone: "REFUSE",
    explanation:
      "Tiền gói tập là doanh thu của công ty. Nhận vào tài khoản cá nhân — dù bạn có nộp lại đủ — là phá vỡ toàn bộ đường ghi nhận doanh số, và khi có tranh chấp thì không ai bảo vệ được bạn. Từ chối và hướng dẫn khách ra quầy.",
  },
  {
    text: "Khách đưa phong bì 5 triệu 'cảm ơn riêng' vì đã giúp giảm được 8kg, và dặn đừng nói với ai.",
    correctZone: "REFUSE",
    explanation:
      "Hai chữ 'đừng nói với ai' là dấu hiệu rõ nhất. Một khoản tiền lớn phải giấu quản lý sẽ đổi cách bạn đối xử với khách đó so với những khách khác. Từ chối và báo FM — báo không phải để tố khách, mà để bảo vệ chính bạn.",
  },
  {
    text: "Khách muốn bạn tới nhà kèm riêng ngoài giờ, trả tiền mặt trực tiếp cho bạn.",
    correctZone: "REFUSE",
    explanation:
      "Dạy riêng khách của phòng tập, thu tiền ngoài sổ. Vừa lấy khách của nơi trả lương cho mình, vừa tự đặt mình vào một buổi tập không ai giám sát, không có bảo hiểm, không ai làm chứng nếu xảy ra chuyện.",
  },
  {
    text: "Khách đến muộn 40 phút, xin bạn chấm công như bình thường để khỏi mất buổi.",
    correctZone: "REFUSE",
    explanation:
      "Đây là gian lận số buổi, và số buổi là căn cứ tính lương của chính bạn. Thông cảm cho khách một lần là lần sau không còn lý do nào để từ chối. Từ chối, và nếu khách có lý do chính đáng thì đưa FM quyết định — đó là việc của FM, không phải của bạn.",
  },
  {
    text: "Chồng của một khách hay đưa vợ tới tập, hôm nay xin số điện thoại riêng của bạn để 'tiện hỏi thăm tình hình tập của vợ'.",
    correctZone: "REFUSE",
    explanation:
      "Thông tin tập luyện của khách chỉ thuộc về khách, kể cả người nhà cũng không có quyền hỏi qua đường riêng. Hướng người đó về số của phòng tập và báo FM. Đây cũng là tình huống dễ đi xa hơn nhiều so với vẻ ngoài của nó.",
  },
];

// ── Vòng 3 · Tham lam ────────────────────────────────────────────────────────
// Đạo đức bán gói. Ba vùng vẫn là ba vùng cũ nhưng đọc theo nghĩa của việc bán:
// chốt bình thường / chốt được nhưng có điều kiện / không chốt.
//
// Tội "tham lam" của một HLV hiếm khi là lừa đảo trắng trợn — nó là chuỗi những
// lần chọn gói to hơn cái khách cần, ghi sổ sớm hơn cái khách đã trả, và im lặng
// về gói không sinh doanh số cho mình. Nên phần lớn thẻ nằm ở vùng giữa: chỗ mà
// bán vẫn đúng, miễn là nói thật và nói trước.
const GREED_INTRO = `Mỗi thẻ là một tình huống bán gói. Xếp nó vào một trong ba vùng:

• Chấp nhận — chốt bình thường, đúng quy trình, không cần hỏi thêm.
• Cần cẩn trọng — vẫn bán được, nhưng phải nói rõ điều kiện với khách hoặc hỏi FM trước.
• Từ chối & báo FM — không chốt theo cách đó, và quản lý phải biết.

Bán được nhiều gói không phải là điểm. Bán ĐÚNG cái khách cần mới là điểm: một
hợp đồng ký sai điều kiện sẽ quay lại thành khách bỏ tập, đòi hoàn tiền, hoặc
một cái tên xấu cho phòng — và tất cả đều đắt hơn phần hoa hồng bạn vừa nhận.

Xếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.`;

const GREED_CARDS: { text: string; correctZone: ExamSortZone; explanation: string }[] = [
  {
    text: "Khách đang tập L1, còn 4 buổi là hết gói, đã giảm đúng 3kg như cam kết và tự hỏi bạn nên tập tiếp gói nào.",
    correctZone: "ACCEPT",
    explanation:
      "Khách chủ động hỏi, đang có kết quả thật, và gói cũ sắp hết. Đây đúng là lúc tư vấn lộ trình tiếp theo — im lặng để khách tự trôi mới là làm sai việc của mình.",
  },
  {
    text: "Khách vừa tập xong 4 buổi L0, muốn ký L1 ngay và hỏi 2 triệu đã đóng có được trừ không.",
    correctZone: "ACCEPT",
    explanation:
      "Đúng luật Hậu L0: gói ngay sau L0 được cấn trừ 2 triệu. Trả lời thẳng con số, chốt và ghi nguồn 'Hậu L0'. Lưu ý chỉ một gói duy nhất được cấn trừ — gói sau nữa là Renew.",
  },
  {
    text: "Khách đã học xong L4, vóc dáng đạt mục tiêu, muốn duy trì với chi phí thấp hơn. Bạn giới thiệu Loyalfit dù nó rẻ hơn L5 nhiều.",
    correctZone: "ACCEPT",
    explanation:
      "Loyalfit đúng nhóm khách đã mua sản phẩm tại LDF và đúng giai đoạn duy trì. Chọn gói nhỏ hơn khi nó khớp nhu cầu hơn là việc phải làm, không phải hy sinh — khách duy trì được sẽ còn tái ký nhiều lần nữa.",
  },
  {
    text: "Khách muốn mua L2 (cam kết giảm 5–9kg) nhưng cân nặng thực chỉ hơn chuẩn chiều cao khoảng 4kg.",
    correctZone: "CAUTION",
    explanation:
      "Điều kiện L2 là dư tối thiểu 6kg, và có lý do: không thể cam kết giảm 5–9kg cho người không có ngần ấy để giảm. Đề xuất L1 trước. Nếu khách vẫn muốn L2 vì số buổi, phải hỏi FM và ghi rõ là cam kết cân nặng không áp dụng — chứ không ký im rồi để buổi bàn giao vỡ.",
  },
  {
    text: "Khách than đang khó khăn tiền bạc, hỏi có gói nào rẻ hơn không. Bạn biết chị ấy là cư dân toà nhà.",
    correctZone: "CAUTION",
    explanation:
      "Gói Cư dân miễn phí và PT chỉ nhận 35k/buổi, không ghi nhận doanh số — nhưng giấu nó đi vì lý do đó là đặt túi tiền của mình lên trước khách. Phải nói cho khách biết gói này tồn tại. Cẩn trọng ở chỗ suất tài trợ do FM duyệt, nên giới thiệu thì được, hứa chắc thì không.",
  },
  {
    text: "Khách muốn ký L5 nhưng xin chia tiền làm 3 đợt trong 3 tháng.",
    correctZone: "CAUTION",
    explanation:
      "Chia đợt thanh toán là quyết định của FM, không phải của PT. Tự gật đầu rồi báo sau là biến khách thành người đang nợ phòng tập, và người phải đi đòi chính là bạn. Hỏi trước, chốt sau.",
  },
  {
    text: "Khách đang tập L3 kêu mệt và muốn nghỉ một tháng. Bạn định chào luôn L5 vì L5 có 2 lần bảo lưu miễn phí.",
    correctZone: "CAUTION",
    explanation:
      "Bảo lưu của L5 là thật, nhưng người đang muốn dừng thì việc đầu tiên là tìm ra vì sao họ mệt — lịch tập, công việc, hay chán bài. Chào một gói to hơn vào đúng lúc đó giải quyết vấn đề doanh số của bạn trước khi giải quyết vấn đề của khách. Xử lý chuyện nghỉ trước; nếu sau đó L5 vẫn hợp thì tư vấn, có FM cùng ngồi.",
  },
  {
    text: "Khách tái ký L4, thấy giá lần này khác lần trước nên hỏi vì sao.",
    correctZone: "CAUTION",
    explanation:
      "Tái ký L3/L4/L5 được trợ giá 10% — nói thẳng con số và ghi đúng nguồn Renew. Cẩn trọng vì đây là chỗ dễ trượt tay nhất: ghi nguồn khác để hợp đồng ra doanh số cao hơn là gian lận sổ sách, dù tiền khách trả không đổi.",
  },
  {
    text: "Cuối tháng còn thiếu một hợp đồng là đủ chỉ tiêu. Một khách đang phân vân, bạn định nói 'ưu đãi chỉ còn hôm nay' dù không có chương trình nào như vậy.",
    correctZone: "REFUSE",
    explanation:
      "Đây là nói dối để ép chốt, và nó không sống quá một tháng: khách sẽ thấy giá đó vẫn còn ở tháng sau. Cái mất không phải một hợp đồng mà là toàn bộ lòng tin vào mọi câu bạn từng nói về chế độ ăn, về tiến độ, về cam kết. Chỉ tiêu là việc của bạn với FM, không phải thứ để khách trả giá hộ.",
  },
  {
    text: "Khách đã mua L1 rồi (gói chỉ mua một lần) nhưng muốn mua thêm lần nữa cho rẻ. Bạn định ghi hợp đồng dưới tên người nhà của khách.",
    correctZone: "REFUSE",
    explanation:
      "Ghi sai tên người ký là làm giả hợp đồng, dù cả bạn lẫn khách đều thấy 'có hại gì đâu'. Khi khách cần bảo lưu, cần hoàn tiền, hay cần khiếu nại, hợp đồng đứng tên người khác sẽ không bảo vệ được ai. L1 giới hạn một lần vì nó là gói phá giá của giai đoạn đầu — khách đã qua giai đoạn đó thì gói đúng là L3.",
  },
  {
    text: "Khách mới đóng cọc một phần. Bạn ghi luôn tình trạng 'Đã thanh toán' cho kịp chốt doanh số tháng, định tháng sau khách đóng nốt.",
    correctZone: "REFUSE",
    explanation:
      "Doanh số ghi khống. Số của tháng này sai, số của tháng sau cũng sai, và bảng lương dựng trên đó sai theo. Đúng quy trình là để tình trạng Đặt cọc với số tiền thật; khi khách đóng nốt thì chuyển sang Thanh toán nốt. Hệ thống có sẵn đủ trạng thái cho việc này, không cần ai phải nói dối con số.",
  },
  {
    text: "Đồng nghiệp nghỉ thai sản. Khách của bạn ấy nhắn hỏi bạn về gói tiếp theo, bạn định chốt và ghi doanh số dưới tên mình.",
    correctZone: "REFUSE",
    explanation:
      "Chăm khách hộ đồng nghiệp là việc tốt và nên làm; lấy doanh số của người đang nghỉ sinh thì không. Trả lời khách bình thường, nhưng báo FM để phân công và ghi nhận cho đúng người. Ranh giới ở đây rất rõ: giúp là phần việc, doanh số là phần người khác đã gây dựng.",
  },
];

// ── Vòng 4 · Kiêu ngạo ───────────────────────────────────────────────────────
// Chuyên môn kỹ thuật. Kiêu ngạo của một HLV không phải là khoe mẽ — nó là
// khoảnh khắc tin rằng mình xử lý được một ca mà mình chưa từng học. Nên vùng
// "từ chối" ở vòng này gần như luôn là chuyện an toàn thân thể của khách.
const PRIDE_INTRO = `Mỗi thẻ là một tình huống chuyên môn trên sàn tập. Xếp nó vào một trong ba vùng:

• Chấp nhận — bạn tự xử lý được ngay trong buổi tập, không cần hỏi ai.
• Cần cẩn trọng — làm được, nhưng phải đổi bài, hạ tải, hoặc hỏi người có chuyên môn hơn trước.
• Từ chối & báo FM — không tự làm. Dừng lại, đưa lên quản lý hoặc yêu cầu khách có ý kiến y tế.

Không ai đánh giá bạn vì hỏi. Người ta đánh giá bạn vì đã không hỏi.

Xếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.`;

const PRIDE_CARDS: { text: string; correctZone: ExamSortZone; explanation: string }[] = [
  {
    text: "Khách squat tới rep thứ 8 thì gối đổ vào trong. Tải đang vừa sức, khách chưa kêu đau.",
    correctZone: "ACCEPT",
    explanation:
      "Lỗi form phổ biến nhất của người mới và nằm gọn trong phần việc của HLV: hạ tải, nhắc đẩy gối ra ngoài, kẹp band nếu cần. Dừng cả buổi vì chuyện này không phải cẩn thận mà là chưa nắm được việc của mình.",
  },
  {
    text: "Khách hỏi vì sao bạn cho tập bài này thay vì bài khác mà khách xem được trên TikTok.",
    correctZone: "ACCEPT",
    explanation:
      "Giải thích lý do là việc nên làm, và khách hiểu vì sao mình tập thì mới tập bền. Khó chịu vì bị hỏi mới đúng là kiêu ngạo — câu hỏi đó không đe doạ chuyên môn của ai cả.",
  },
  {
    text: "Khách mới tập buổi đầu, hôm sau nhắn là đau nhức cơ hai ngày liền, hỏi có bình thường không.",
    correctZone: "ACCEPT",
    explanation:
      "Đau cơ khởi phát muộn ở người mới là bình thường. Giải thích, dặn cách xử lý, và điều chỉnh khối lượng buổi kế cho vừa hơn. Đây là câu hỏi bạn phải trả lời được.",
  },
  {
    text: "Khách xin học một động tác cử tạ kỹ thuật cao mà bạn chưa từng được đào tạo.",
    correctZone: "CAUTION",
    explanation:
      "Không nhận bừa, cũng không giấu. Nói thật là động tác này cần chuyên môn riêng, đề xuất bài thay thế đạt cùng mục tiêu, và nếu muốn dạy thì đi học trước. Dạy một động tác mình chưa từng học chính là chỗ chấn thương bắt đầu.",
  },
  {
    text: "Khách 52 tuổi, huyết áp cao đang uống thuốc, muốn tập HIIT vì nghe nói giảm cân nhanh.",
    correctZone: "CAUTION",
    explanation:
      "Không cấm, nhưng phải hạ cường độ, theo dõi nhịp tim, tránh động tác đầu thấp hơn tim và những đoạn nín thở. Hỏi khách lần khám gần nhất là khi nào; chưa có ý kiến bác sĩ thì lùi lại và tập nền trước.",
  },
  {
    text: "Khách đau vai khi đẩy ngực. Bạn thấy form sai, nhưng khách bảo PT cũ dạy như vậy.",
    correctZone: "CAUTION",
    explanation:
      "Sửa bằng lý do kỹ thuật, đừng chê người trước — chê PT cũ trước mặt khách chỉ làm khách nghi ngờ cả nghề này. Hạ tải, đổi góc, xem lại tầm vận động vai. Im lặng để khách đau tiếp thì còn tệ hơn cả chê.",
  },
  {
    text: "Khách đưa đơn thuốc đang uống và hỏi bạn có nên dùng thêm thực phẩm bổ sung không.",
    correctZone: "CAUTION",
    explanation:
      "Ranh giới nằm ở chỗ có toa hay không: whey, creatine, vitamin thông thường thì tư vấn được trong phạm vi dinh dưỡng thể thao. Thuốc kê đơn và tương tác thuốc là việc của bác sĩ — nói thẳng là bạn không trả lời phần đó.",
  },
  {
    text: "Bạn quay video phân tích form cho khách, xem lại thì thấy chính mình làm mẫu sai trong video.",
    correctZone: "CAUTION",
    explanation:
      "Sửa và nói với khách, đừng lặng lẽ xoá video. Nhận một lỗi kỹ thuật trước mặt khách không làm mất uy tín; giấu đi rồi để khách bắt chước cái sai mới làm mất, và mất lâu hơn nhiều.",
  },
  {
    text: "Khách mới, có tiền sử thoát vị đĩa đệm, buổi đầu đòi tập deadlift nặng vì thấy bạn trai tập được.",
    correctZone: "REFUSE",
    explanation:
      "Dừng, không tập bài đó, báo FM và yêu cầu khách có ý kiến chuyên môn y tế trước. Chiều theo là đặt cột sống của khách vào tay một người không được đào tạo để xử lý ca đó — và khách sẽ không nhớ rằng chính họ đòi.",
  },
  {
    text: "Đang tập, khách choáng và tái mặt, phải ngồi xuống. Vài phút sau khách bảo đỡ rồi và muốn tập tiếp.",
    correctZone: "REFUSE",
    explanation:
      "Dừng buổi, cho khách nghỉ, báo FM và ghi lại sự việc. \"Đỡ rồi\" là cảm giác của khách chứ không phải chẩn đoán, và tình huống này có thể là tụt huyết áp, hạ đường huyết hoặc chuyện nặng hơn.",
  },
  {
    text: "Bạn thấy đồng nghiệp cho một khách đang đau vai gánh tạ sau gáy — sai rõ ràng và có nguy cơ.",
    correctZone: "REFUSE",
    explanation:
      "Không im lặng: báo FM. Nhảy vào giữa sàn dạy lại trước mặt khách của người khác thì không nên, nhưng để nguyên đấy vì ngại thì lần sau là một ca chấn thương, và bạn đã nhìn thấy trước.",
  },
  {
    text: "Khách đau nhói thắt lưng sau một rep. Còn 3 buổi là hết gói và khách muốn tập cho hết.",
    correctZone: "REFUSE",
    explanation:
      "Dừng, báo FM để xử lý bảo lưu hoặc gia hạn. Đổi sức khoẻ của khách lấy ba buổi đã dạy là phiên bản tệ nhất của tội kiêu ngạo: tin rằng mình biết cơn đau đó không sao, trong khi mình không có cách nào biết.",
  },
];

// ── Vòng 5 · Ghen tị ─────────────────────────────────────────────────────────
// Sale. Ghen tị của người bán hàng hiếm khi là ghét ai; nó là những việc rất
// nhỏ làm để mình hơn người bên cạnh — giữ một lead lại, nói một câu về đồng
// nghiệp, nhận một khách vốn không phải của mình.
const ENVY_INTRO = `Mỗi thẻ là một tình huống giữa bạn và đồng nghiệp cùng phòng. Xếp nó vào một trong ba vùng:

• Chấp nhận — làm bình thường, không cần hỏi ai.
• Cần cẩn trọng — làm được nhưng phải minh bạch, hoặc phải qua FM trước.
• Từ chối & báo FM — không làm, và quản lý phải biết.

Doanh số của bạn là việc của bạn với FM. Nó không phải thứ để lấy từ tay người
ngồi cạnh — phòng tập mất một PT giỏi thì cả bạn cũng nghèo đi.

Xếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.`;

const ENVY_CARDS: { text: string; correctZone: ExamSortZone; explanation: string }[] = [
  {
    text: "Đồng nghiệp tháng này chốt gấp đôi bạn. Bạn sang hỏi bạn ấy tư vấn thế nào.",
    correctZone: "ACCEPT",
    explanation:
      "Hỏi là cách duy nhất biến ghen tị thành chuyên môn. Người giỏi hơn ngồi cách bạn ba mét mà bạn không hỏi thì tháng sau vẫn thế.",
  },
  {
    text: "Bạn thấy đồng nghiệp có một mẫu tin nhắn chốt sale rất tốt và xin dùng lại.",
    correctZone: "ACCEPT",
    explanation:
      "Học cách làm của nhau đúng là điều phòng tập cần. Xin đàng hoàng thì không có gì phải cân nhắc — khác hẳn với việc chụp trộm rồi nhận là của mình.",
  },
  {
    text: "Tháng này FM chia lead cho bạn ít hơn tháng trước. Bạn hỏi thẳng FM tiêu chí chia lead.",
    correctZone: "ACCEPT",
    explanation:
      "Hỏi đúng người, đúng chuyện. Ấm ức mà không hỏi mới là chỗ sinh ra những việc ở hai vùng sau — người ta bắt đầu tự bù đắp theo cách của riêng mình.",
  },
  {
    text: "Khách của đồng nghiệp khen bạn dạy hay và hỏi có chuyển sang tập với bạn được không.",
    correctZone: "CAUTION",
    explanation:
      "Không tự nhận, cũng đừng lảng. Đưa lên FM quyết và nói cho đồng nghiệp biết. Khách chủ động không làm việc này thành trong sạch — người ngoài nhìn vào vẫn thấy một PT lấy khách của PT khác.",
  },
  {
    text: "Một khách cũ đã hết gói 6 tháng, PT phụ trách trước đã nghỉ việc. Bạn muốn gọi lại mời tái ký.",
    correctZone: "CAUTION",
    explanation:
      "Khách không còn PT phụ trách thì gọi được, nhưng phải qua danh sách của FM. Không thì hai người cùng gọi một khách trong một ngày, và khách sẽ hiểu ngay rằng ở đây không ai nói chuyện với ai.",
  },
  {
    text: "Đang tập, khách hỏi bạn nghĩ gì về PT đang đứng bên cạnh.",
    correctZone: "CAUTION",
    explanation:
      "Không chê, cũng không nịnh cho xong. Một câu trung tính rồi quay lại buổi tập. Chê đồng nghiệp trước mặt khách hạ uy tín cả phòng, và khách sẽ hiểu rằng bạn cũng nói về họ như thế với người khác.",
  },
  {
    text: "Bạn và đồng nghiệp cùng tư vấn một khách walk-in. Khách chốt gói, cả hai đều muốn ghi doanh số.",
    correctZone: "CAUTION",
    explanation:
      "Để FM quyết theo quy trình, đừng tự thoả thuận miệng rồi ai nhanh tay ghi trước. Những vụ ghi trước tính sau là thứ sinh ra mâu thuẫn kéo dài cả năm giữa hai người vốn không có gì với nhau.",
  },
  {
    text: "Bạn được giao một lead mà bạn biết đồng nghiệp đã chăm hai tuần nhưng chưa chốt.",
    correctZone: "CAUTION",
    explanation:
      "Nhận thì nhận, nhưng hỏi FM vì sao đổi người và hỏi đồng nghiệp đã trao đổi những gì với khách. Không thì bạn tư vấn ngược lại điều người trước đã nói, và khách mất niềm tin vào cả hai.",
  },
  {
    text: "Bạn nhắn riêng cho khách của đồng nghiệp rằng tập với bạn sẽ được giá tốt hơn.",
    correctZone: "REFUSE",
    explanation:
      "Vừa lấy khách của người khác, vừa tự ý hứa giá không thuộc thẩm quyền của mình. Hai việc sai chồng lên nhau trong một tin nhắn, và tin nhắn thì luôn được chụp lại.",
  },
  {
    text: "Bạn nói với khách rằng PT đang dạy họ chưa có chứng chỉ, để khách chuyển sang tập với bạn.",
    correctZone: "REFUSE",
    explanation:
      "Kể cả khi câu đó có thật. Chuyện bằng cấp của nhân sự là việc của phòng tập với FM, không phải thứ để lấy làm đòn bẩy bán hàng. Nói ra như thế là hạ uy tín nơi trả lương cho chính mình.",
  },
  {
    text: "Một lead được phân cho đồng nghiệp nhưng đến tay bạn trước. Bạn giữ lại, cuối tháng tự chốt.",
    correctZone: "REFUSE",
    explanation:
      "Giữ thông tin của người khác là lấy cắp cơ hội chứ không phải nhanh chân. Chuyển ngay cho đúng người và báo FM — hệ thống phân lead chỉ chạy được khi không ai giữ riêng cái gì.",
  },
  {
    text: "Bạn báo với FM rằng đồng nghiệp hay bỏ buổi, trong khi thật ra bạn không chắc, để mình được nhận khách đó.",
    correctZone: "REFUSE",
    explanation:
      "Đây không còn là ghen tị mà là vu cho người khác để lấy khách. Nếu thật sự nghi có buổi bị bỏ thì nói đúng những gì mình thấy, không thêm — và không kèm theo lời đề nghị nhận khách.",
  },
];

// ── Vòng 6 · Phẫn nộ ─────────────────────────────────────────────────────────
// Xử lý khiếu nại và xung đột. Phẫn nộ không chỉ là quát khách: nó còn là nhắn
// tin lúc đang giận, là im lặng cho qua rồi để bụng, là một câu trả lời "cho bõ
// tức" trong nhóm chat mà sáng hôm sau đọc lại thì không nhận ra mình.
const WRATH_INTRO = `Mỗi thẻ là một tình huống căng thẳng có thật. Xếp nó vào một trong ba vùng:

• Chấp nhận — bạn xử lý ngay tại chỗ được, không cần ai.
• Cần cẩn trọng — xử lý được, nhưng phải ghi lại và nói với FM trong ngày.
• Từ chối & báo FM — không tự xử lý. Dừng lại và đưa lên quản lý ngay.

Thứ phân loại người ở vòng này không phải ai giỏi chịu đựng hơn, mà ai biết
chuyện nào là của mình và chuyện nào phải chuyển đi.

Xếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.`;

const WRATH_CARDS: { text: string; correctZone: ExamSortZone; explanation: string }[] = [
  {
    text: "Khách trách bạn vì buổi trước bạn quên nhắc đổi mức tạ. Giọng hơi gắt nhưng khách nói đúng.",
    correctZone: "ACCEPT",
    explanation:
      "Nhận lỗi, sửa, đi tiếp. Đúng là lỗi của mình và nó nhỏ. Cãi lại một lời trách có căn cứ là cách nhanh nhất biến chuyện nhỏ thành chuyện phải nhờ FM.",
  },
  {
    text: "Khách đến muộn 20 phút rồi khó chịu vì buổi tập bị rút ngắn.",
    correctZone: "ACCEPT",
    explanation:
      "Nói lại quy định giờ một cách bình thản, rồi tập cho ra hồn phần thời gian còn lại. Không cần báo ai — nhưng cũng không kéo dài bù giờ, vì bù một lần là thành lệ.",
  },
  {
    text: "Hai khách tranh nhau một máy tập và cả hai cùng nhìn về phía bạn.",
    correctZone: "ACCEPT",
    explanation:
      "Điều phối cho tập xen kẽ, đổi thứ tự bài của khách mình. Việc thường ngày trên sàn, và cách bạn xử lý ba mươi giây này quyết định không khí cả buổi.",
  },
  {
    text: "Khách nói mình giảm chưa đủ như cam kết và muốn được hoàn tiền. Khách vẫn đang bình tĩnh.",
    correctZone: "CAUTION",
    explanation:
      "Nghe hết, không ngắt, và tuyệt đối không hứa gì về tiền — hoàn tiền không thuộc thẩm quyền của PT. Lấy lại số liệu cân đo, số buổi đã tập, nhật ký ăn, rồi báo FM ngay trong ngày kèm dữ liệu.",
  },
  {
    text: "Nửa đêm khách nhắn một tin dài trách bạn không quan tâm. Đọc xong bạn thấy rất ức.",
    correctZone: "CAUTION",
    explanation:
      "Đừng trả lời lúc đó. Sáng hôm sau nhắn một câu ngắn, hẹn nói trực tiếp, và báo FM là đang có chuyện. Tin nhắn viết lúc đang giận bao giờ cũng là tin nhắn bị chụp màn hình.",
  },
  {
    text: "Khách kể lại rằng một đồng nghiệp đã nói xấu bạn với họ.",
    correctZone: "CAUTION",
    explanation:
      "Không đối chất giữa sàn. Ghi lại chính xác lời khách kể — kể cả phần bạn không thích nghe — rồi đưa FM. Tự đi hỏi tội là biến chuyện của hai người thành chuyện cả phòng đứng nhìn.",
  },
  {
    text: "Suốt buổi tập, khách liên tục chê bài tập bạn thiết kế là vô dụng.",
    correctZone: "CAUTION",
    explanation:
      "Hỏi thẳng khách muốn gì và ghi nhận cho đàng hoàng. Nếu là khác biệt về phương pháp thì báo FM để tính chuyện đổi PT. Cắn răng chịu tới hết gói là chỗ phẫn nộ tích lại rồi bung ra vào lúc tệ nhất.",
  },
  {
    text: "Bạn phát hiện bảng lương tháng này tính thiếu mấy buổi dạy của mình.",
    correctZone: "CAUTION",
    explanation:
      "Gửi FM danh sách buổi kèm ảnh check-out, đúng quy trình và đúng người. Đăng lên nhóm chat chung thì không: nó không làm bạn được trả nhanh hơn, chỉ làm chuyện của bạn thành chuyện của tất cả.",
  },
  {
    text: "Khách quát bạn giữa sàn trước mặt nhiều người, dùng từ xúc phạm.",
    correctZone: "REFUSE",
    explanation:
      "Dừng buổi tập, không đáp trả một câu nào, mời khách sang chỗ riêng hoặc gọi FM ngay. Bạn không phải chịu đựng bị xúc phạm, nhưng cũng không phải người xử lý chuyện đó một mình giữa sàn.",
  },
  {
    text: "Khách nhắn tin doạ sẽ đăng bài bóc phốt lên mạng nếu không được hoàn tiền.",
    correctZone: "REFUSE",
    explanation:
      "Không thương lượng, không trả lời một mình, không xoá tin. Chụp lại toàn bộ và báo FM ngay. Đây đã là chuyện của công ty chứ không còn là chuyện giữa bạn và một khách hàng.",
  },
  {
    text: "Khách có mùi rượu, nói năng khó kiểm soát, vẫn đòi vào tập buổi hôm nay.",
    correctZone: "REFUSE",
    explanation:
      "Không cho tập, báo FM và lễ tân. Người say không giữ được thăng bằng lẫn phán đoán, và mọi thứ xảy ra sau đó sẽ được tính là lỗi của phòng tập vì đã cho vào.",
  },
  {
    text: "Trong lúc nóng giận, một đồng nghiệp đẩy vai bạn giữa sàn.",
    correctZone: "REFUSE",
    explanation:
      "Không đẩy lại, tách ra, báo FM ngay. Đụng tay chân ở nơi làm việc không có phiên bản nhẹ — bỏ qua lần này là mặc định cho phép nó xảy ra lần nữa, với bạn hoặc với người khác.",
  },
];

// ── Vòng 7 · Lười biếng ──────────────────────────────────────────────────────
// Giữ khách, chống bỏ tập. Lười biếng của HLV không phải là ngủ quên: nó là để
// một khách vắng ba buổi mà không nhắn lấy một tin, là "chắc bạn ấy bận", là
// gói sắp hết hạn mà không ai nói với khách cho tới ngày cuối.
const SLOTH_INTRO = `Mỗi thẻ là một dấu hiệu từ phía khách. Ba vùng ở vòng này đọc theo mức phải can thiệp:

• Chấp nhận — chuyện bình thường, xử lý gọn trong buổi tập.
• Cần cẩn trọng — phải chủ động làm gì đó và ghi lại, đừng ngồi chờ khách quay lại.
• Từ chối & báo FM — không được để im và không tự ôm. Đẩy lên FM ngay.

Khách hiếm khi bỏ tập vì bận. Họ bỏ vì thấy vô ích, hoặc vì thấy không ai để ý
là mình đã vắng.

Xếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.`;

const SLOTH_CARDS: { text: string; correctZone: ExamSortZone; explanation: string }[] = [
  {
    text: "Khách báo trước hai ngày là tuần này đi công tác, xin nghỉ 3 buổi.",
    correctZone: "ACCEPT",
    explanation:
      "Có báo trước, có lý do rõ ràng. Xếp lại lịch bù và gửi vài bài tập tự làm nếu khách muốn. Khách chủ động báo là dấu hiệu tốt, đừng biến nó thành chuyện phải xử lý.",
  },
  {
    text: "Khách vẫn tập đủ 6 buổi/tuần, tuần này xin đổi giờ từ sáng sang tối.",
    correctZone: "ACCEPT",
    explanation:
      "Đổi giờ mà vẫn giữ tần suất thì không phải dấu hiệu gì cả. Chốt lịch mới ngay trong lúc nhắn, đừng để trôi thành \"khi nào rảnh em báo\".",
  },
  {
    text: "Khách hỏi tuần sau nghỉ lễ phòng có mở cửa không.",
    correctZone: "ACCEPT",
    explanation:
      "Trả lời, và chốt luôn lịch bù trong chính câu trả lời đó. Kỳ nghỉ là chỗ nhiều khách rơi ra khỏi thói quen nhất — một tin nhắn có ngày giờ cụ thể giữ được cả tháng sau.",
  },
  {
    text: "Khách vắng 2 buổi liên tiếp không báo. Tin nhắn của bạn đã xem nhưng chưa trả lời.",
    correctZone: "CAUTION",
    explanation:
      "Gọi điện, đừng chỉ nhắn thêm tin thứ ba. Ghi vào ghi chú khách. Hai buổi im lặng là mốc sớm nhất mà mọi thứ còn kéo lại được — đến buổi thứ năm thì câu trả lời thường đã là lời từ chối lịch sự.",
  },
  {
    text: "Khách đi đều nhưng cân không đổi suốt 3 tuần và bắt đầu ít nói hẳn trong buổi tập.",
    correctZone: "CAUTION",
    explanation:
      "Đặt lại buổi đo, xem lại nhật ký ăn, và nói thẳng về con số thay vì động viên chung chung. Khách im lặng khi kết quả đứng yên là bước ngay trước khi họ nghỉ, không phải sau.",
  },
  {
    text: "Gói L2 của khách còn 20 buổi nhưng chỉ còn 18 ngày là hết hạn.",
    correctZone: "CAUTION",
    explanation:
      "Nói với khách ngay hôm nay, đưa phương án tăng tần suất hoặc xin FM về bảo lưu, gia hạn. Để tới ngày cuối mới báo thì chắc chắn thành khiếu nại, và khiếu nại đó bạn không cãi được câu nào.",
  },
  {
    text: "Khách nhắn: \"Chị bận quá, để tháng sau chị tập lại nhé.\"",
    correctZone: "CAUTION",
    explanation:
      "Đừng gật cho qua. Hẹn một buổi có ngày giờ cụ thể, dù chỉ 30 phút nhẹ. \"Tháng sau\" không kèm ngày là một lời tạm biệt lịch sự, và cả hai bên đều biết điều đó.",
  },
  {
    text: "Bạn đang có 12 khách, trong đó 3 người bạn đã không nhắn gì suốt 10 ngày.",
    correctZone: "CAUTION",
    explanation:
      "Đặt một khung giờ cố định trong tuần để rà lại toàn bộ danh sách, và báo FM nếu thật sự quá tải. Chăm tốt 9 người là đáng khen, nhưng mất 3 người thì vẫn là mất 3 người.",
  },
  {
    text: "Khách vắng 3 tuần, gọi không nghe, nhắn không trả lời. Gói vẫn còn 30 buổi.",
    correctZone: "REFUSE",
    explanation:
      "Không tự ôm thêm nữa: báo FM để phòng tập liên hệ qua kênh khác. Ba tuần im lặng nghĩa là khách đã đi rồi, và 30 buổi còn lại là một khoản trách nhiệm của công ty chứ không phải chuyện riêng của bạn.",
  },
  {
    text: "Khách nói muốn dừng hẳn vì \"không hợp\" nhưng không nói rõ không hợp chỗ nào.",
    correctZone: "REFUSE",
    explanation:
      "Không xử lý một mình. Báo FM và xin một buổi có FM ngồi cùng. \"Không hợp\" gần như luôn là cách nói giảm cho một chuyện cụ thể — có thể là bạn, có thể không — và người trong cuộc thường là người khó hỏi ra nhất.",
  },
  {
    text: "Khách xin bảo lưu vô thời hạn vì lý do cá nhân.",
    correctZone: "REFUSE",
    explanation:
      "PT không quyết được bảo lưu: mỗi gói có quy định riêng, L5 có 2 lần miễn phí tối đa 30 ngày mỗi lần. Gật đầu cho khách yên lòng rồi để FM từ chối sau là đẩy đồng nghiệp vào thế khó và làm khách mất niềm tin hai lần.",
  },
  {
    text: "Bạn nhận ra mình đã quên không check-out cho khách suốt 5 buổi liền.",
    correctZone: "REFUSE",
    explanation:
      "Báo FM ngay kèm bằng chứng buổi tập, đừng lặng lẽ bấm bù cho đủ. Buổi dạy không có check-out là buổi không có bằng chứng — bấm bù sau lưng quản lý biến một chuyện đãng trí thành một chuyện gian lận bảng lương.",
  },
];

/**
 * Mọi vòng phân loại thẻ của đề, xếp theo thứ tự vòng. Thêm một đại tội mới thì
 * thêm một dòng ở đây, không phải chép thêm một khối lệnh trong main().
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
  { sin: "LUST",  name: "Dục vọng",   order: 1, passPercent: 70, failPenalty: 25, intro: SORT_INTRO,  cards: SORT_CARDS },
  { sin: "GREED", name: "Tham lam",   order: 2, passPercent: 65, failPenalty: 25, intro: GREED_INTRO, cards: GREED_CARDS },
  // Kiêu ngạo gắt hơn phần còn lại vì gần như mọi thẻ vùng đỏ của nó là an toàn
  // thân thể của khách — qua loa ở đây thì hậu quả không nằm trong bảng điểm.
  { sin: "PRIDE", name: "Kiêu ngạo",  order: 3, passPercent: 70, failPenalty: 25, intro: PRIDE_INTRO, cards: PRIDE_CARDS },
  { sin: "ENVY",  name: "Ghen tị",    order: 4, passPercent: 65, failPenalty: 20, intro: ENVY_INTRO,  cards: ENVY_CARDS },
  { sin: "WRATH", name: "Phẫn nộ",    order: 5, passPercent: 65, failPenalty: 20, intro: WRATH_INTRO, cards: WRATH_CARDS },
  { sin: "SLOTH", name: "Lười biếng", order: 6, passPercent: 60, failPenalty: 20, intro: SLOTH_INTRO, cards: SLOTH_CARDS },
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
