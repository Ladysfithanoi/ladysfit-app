/**
 * Nạp bản nháp nội dung 3 vòng đầu của đề thử thách 7 đại tội cho một cấp độ.
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

  // ── Vòng Sa ngã ───────────────────────────────────────────────────────────
  if (wanted("LUST")) {
    // "Sa ngã" không nằm trong thất đại tội — tên kinh điển là Dục vọng.
    const sort = await upsertRound(level.id, "Dục vọng", "SORT", "LUST", {
      intro: SORT_INTRO,
      order: 1,
      maxPoints: 100,
      passPercent: 70,
      failPenalty: 25,
    });
    await prisma.examSortCard.deleteMany({ where: { roundId: sort.id } });
    await prisma.examSortCard.createMany({
      data: SORT_CARDS.map((c, i) => ({
        roundId: sort.id,
        order: i,
        text: c.text,
        correctZone: c.correctZone,
        explanation: c.explanation,
      })),
    });
    console.log(`  Dục vọng: ${SORT_CARDS.length} thẻ`);
  }

  // ── Vòng Tham lam ─────────────────────────────────────────────────────────
  if (wanted("GREED")) {
    const greed = await upsertRound(level.id, "Tham lam", "SORT", "GREED", {
      intro: GREED_INTRO,
      order: 2,
      maxPoints: 100,
      passPercent: 65,
      failPenalty: 25,
    });
    await prisma.examSortCard.deleteMany({ where: { roundId: greed.id } });
    await prisma.examSortCard.createMany({
      data: GREED_CARDS.map((c, i) => ({
        roundId: greed.id,
        order: i,
        text: c.text,
        correctZone: c.correctZone,
        explanation: c.explanation,
      })),
    });
    console.log(`  Tham lam: ${GREED_CARDS.length} thẻ`);
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
    return prisma.examRound.update({ where: { id: existing.id }, data: { name, type, sin, ...data } });
  }
  return prisma.examRound.create({ data: { levelId, name, type, sin, ...data } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
