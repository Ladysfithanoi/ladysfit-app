import type { SortCardSeed } from "./types";

export const INTRO = "Mỗi thẻ là một tình huống bán gói. Xếp nó vào một trong ba vùng:\n\n• Chấp nhận — chốt bình thường, đúng quy trình, không cần hỏi thêm.\n• Cần cẩn trọng — vẫn bán được, nhưng phải nói rõ điều kiện với khách hoặc hỏi FM trước.\n• Từ chối & báo FM — không chốt theo cách đó, và quản lý phải biết.\n\nBán được nhiều gói không phải là điểm. Bán ĐÚNG cái khách cần mới là điểm: một\nhợp đồng ký sai điều kiện sẽ quay lại thành khách bỏ tập, đòi hoàn tiền, hoặc\nmột cái tên xấu cho phòng — và tất cả đều đắt hơn phần hoa hồng bạn vừa nhận.\n\nXếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.";

export const CARDS: SortCardSeed[] = [
  {
    text: "Khách đang tập L1, còn 4 buổi là hết gói, đã giảm đúng 3kg như cam kết và tự hỏi bạn nên tập tiếp gói nào.",
    correctZone: "ACCEPT",
    explanation: "Khách chủ động hỏi, đang có kết quả thật, và gói cũ sắp hết. Đây đúng là lúc tư vấn lộ trình tiếp theo — im lặng để khách tự trôi mới là làm sai việc của mình.",
  },
  {
    text: "Khách vừa tập xong 4 buổi L0, muốn ký L1 ngay và hỏi 2 triệu đã đóng có được trừ không.",
    correctZone: "ACCEPT",
    explanation: "Đúng luật Hậu L0: gói ngay sau L0 được cấn trừ 2 triệu. Trả lời thẳng con số, chốt và ghi nguồn 'Hậu L0'. Lưu ý chỉ một gói duy nhất được cấn trừ — gói sau nữa là Renew.",
  },
  {
    text: "Khách đã học xong L4, vóc dáng đạt mục tiêu, muốn duy trì với chi phí thấp hơn. Bạn giới thiệu Loyalfit dù nó rẻ hơn L5 nhiều.",
    correctZone: "ACCEPT",
    explanation: "Loyalfit đúng nhóm khách đã mua sản phẩm tại LDF và đúng giai đoạn duy trì. Chọn gói nhỏ hơn khi nó khớp nhu cầu hơn là việc phải làm, không phải hy sinh — khách duy trì được sẽ còn tái ký nhiều lần nữa.",
  },
  {
    text: "Khách muốn mua L2 (cam kết giảm 5–9kg) nhưng cân nặng thực chỉ hơn chuẩn chiều cao khoảng 4kg.",
    correctZone: "CAUTION",
    explanation: "Điều kiện L2 là dư tối thiểu 6kg, và có lý do: không thể cam kết giảm 5–9kg cho người không có ngần ấy để giảm. Đề xuất L1 trước. Nếu khách vẫn muốn L2 vì số buổi, phải hỏi FM và ghi rõ là cam kết cân nặng không áp dụng — chứ không ký im rồi để buổi bàn giao vỡ.",
  },
  {
    text: "Khách than đang khó khăn tiền bạc, hỏi có gói nào rẻ hơn không. Bạn biết chị ấy là cư dân toà nhà.",
    correctZone: "CAUTION",
    explanation: "Gói Cư dân miễn phí và PT chỉ nhận 35k/buổi, không ghi nhận doanh số — nhưng giấu nó đi vì lý do đó là đặt túi tiền của mình lên trước khách. Phải nói cho khách biết gói này tồn tại. Cẩn trọng ở chỗ suất tài trợ do FM duyệt, nên giới thiệu thì được, hứa chắc thì không.",
  },
  {
    text: "Khách muốn ký L5 nhưng xin chia tiền làm 3 đợt trong 3 tháng.",
    correctZone: "CAUTION",
    explanation: "Chia đợt thanh toán là quyết định của FM, không phải của PT. Tự gật đầu rồi báo sau là biến khách thành người đang nợ phòng tập, và người phải đi đòi chính là bạn. Hỏi trước, chốt sau.",
  },
  {
    text: "Khách đang tập L3 kêu mệt và muốn nghỉ một tháng. Bạn định chào luôn L5 vì L5 có 2 lần bảo lưu miễn phí.",
    correctZone: "CAUTION",
    explanation: "Bảo lưu của L5 là thật, nhưng người đang muốn dừng thì việc đầu tiên là tìm ra vì sao họ mệt — lịch tập, công việc, hay chán bài. Chào một gói to hơn vào đúng lúc đó giải quyết vấn đề doanh số của bạn trước khi giải quyết vấn đề của khách. Xử lý chuyện nghỉ trước; nếu sau đó L5 vẫn hợp thì tư vấn, có FM cùng ngồi.",
  },
  {
    text: "Khách tái ký L4, thấy giá lần này khác lần trước nên hỏi vì sao.",
    correctZone: "CAUTION",
    explanation: "Tái ký L3/L4/L5 được trợ giá 10% — nói thẳng con số và ghi đúng nguồn Renew. Cẩn trọng vì đây là chỗ dễ trượt tay nhất: ghi nguồn khác để hợp đồng ra doanh số cao hơn là gian lận sổ sách, dù tiền khách trả không đổi.",
  },
  {
    text: "Cuối tháng còn thiếu một hợp đồng là đủ chỉ tiêu. Một khách đang phân vân, bạn định nói 'ưu đãi chỉ còn hôm nay' dù không có chương trình nào như vậy.",
    correctZone: "REFUSE",
    explanation: "Đây là nói dối để ép chốt, và nó không sống quá một tháng: khách sẽ thấy giá đó vẫn còn ở tháng sau. Cái mất không phải một hợp đồng mà là toàn bộ lòng tin vào mọi câu bạn từng nói về chế độ ăn, về tiến độ, về cam kết. Chỉ tiêu là việc của bạn với FM, không phải thứ để khách trả giá hộ.",
  },
  {
    text: "Khách đã mua L1 rồi (gói chỉ mua một lần) nhưng muốn mua thêm lần nữa cho rẻ. Bạn định ghi hợp đồng dưới tên người nhà của khách.",
    correctZone: "REFUSE",
    explanation: "Ghi sai tên người ký là làm giả hợp đồng, dù cả bạn lẫn khách đều thấy 'có hại gì đâu'. Khi khách cần bảo lưu, cần hoàn tiền, hay cần khiếu nại, hợp đồng đứng tên người khác sẽ không bảo vệ được ai. L1 giới hạn một lần vì nó là gói phá giá của giai đoạn đầu — khách đã qua giai đoạn đó thì gói đúng là L3.",
  },
  {
    text: "Khách mới đóng cọc một phần. Bạn ghi luôn tình trạng 'Đã thanh toán' cho kịp chốt doanh số tháng, định tháng sau khách đóng nốt.",
    correctZone: "REFUSE",
    explanation: "Doanh số ghi khống. Số của tháng này sai, số của tháng sau cũng sai, và bảng lương dựng trên đó sai theo. Đúng quy trình là để tình trạng Đặt cọc với số tiền thật; khi khách đóng nốt thì chuyển sang Thanh toán nốt. Hệ thống có sẵn đủ trạng thái cho việc này, không cần ai phải nói dối con số.",
  },
  {
    text: "Đồng nghiệp nghỉ thai sản. Khách của bạn ấy nhắn hỏi bạn về gói tiếp theo, bạn định chốt và ghi doanh số dưới tên mình.",
    correctZone: "REFUSE",
    explanation: "Chăm khách hộ đồng nghiệp là việc tốt và nên làm; lấy doanh số của người đang nghỉ sinh thì không. Trả lời khách bình thường, nhưng báo FM để phân công và ghi nhận cho đúng người. Ranh giới ở đây rất rõ: giúp là phần việc, doanh số là phần người khác đã gây dựng.",
  },
  {
    text: "Khách hỏi giá của tất cả các gói để về tự so sánh.",
    correctZone: "ACCEPT",
    explanation: "Đưa bảng giá đầy đủ, kể cả những gói rẻ hơn cái bạn muốn bán. Giấu bớt lựa chọn để khách buộc phải chọn gói to là bán bằng cách bịt mắt người mua.",
  },
  {
    text: "Khách vừa xong L1, muốn nghỉ một tháng rồi mới tính tiếp.",
    correctZone: "ACCEPT",
    explanation: "Ghi nhận, hẹn ngày liên lạc lại cụ thể, gửi vài bài tự tập cho tháng nghỉ. Ép ký ngay lúc khách vừa nói muốn nghỉ là cách nhanh nhất để mất luôn cả lần sau.",
  },
  {
    text: "Khách hỏi có gói nào không kèm cam kết cân nặng không.",
    correctZone: "ACCEPT",
    explanation: "Có thật — nhóm gói giai đoạn 2 và 3 hướng vào vóc dáng và duy trì chứ không cam kết số cân. Trả lời thẳng và giải thích khác nhau ở đâu.",
  },
  {
    text: "Khách muốn mua một gói để tặng người thân.",
    correctZone: "ACCEPT",
    explanation: "Giao dịch bình thường. Chỉ cần nói rõ hợp đồng đứng tên người tập chứ không phải người trả tiền, vì mọi quyền lợi sau này gắn với người tập.",
  },
  {
    text: "Khách hỏi phòng tập có xuất hoá đơn VAT không.",
    correctZone: "ACCEPT",
    explanation: "Trả lời đúng theo quy định của công ty và chuyển khách sang quầy. Không biết thì nói không biết rồi đi hỏi, đừng đoán cho xong.",
  },
  {
    text: "Khách đang phân vân, xin về bàn với chồng rồi hôm sau trả lời.",
    correctZone: "ACCEPT",
    explanation: "Để khách về, và chốt luôn ngày giờ mình sẽ liên lạc lại. Một quyết định vài chục triệu mà không cho người ta về bàn với gia đình thì chốt được cũng sẽ bị đòi huỷ.",
  },
  {
    text: "Khách hỏi L4 và L5 khác nhau chỗ nào.",
    correctZone: "ACCEPT",
    explanation: "Nói rõ số buổi, thời hạn, phần Connect Workout và quyền bảo lưu. Khách hiểu mình mua gì thì mới tập hết gói, và mới quay lại.",
  },
  {
    text: "Khách muốn thử trước khi cam kết dài hạn, bạn giới thiệu gói trải nghiệm 4 buổi.",
    correctZone: "ACCEPT",
    explanation: "Đúng việc, dù gói đó gần như không sinh doanh số cho bạn. Khách thử rồi ký gói lớn còn hơn khách ký gói lớn rồi đòi hoàn tiền ở buổi thứ ba.",
  },
  {
    text: "Khách hỏi nếu tập mà không đạt cam kết thì phòng xử lý thế nào.",
    correctZone: "ACCEPT",
    explanation: "Nói đúng điều kiện của gói, kể cả phần điều kiện ràng buộc khách (số buổi tối thiểu mỗi tuần). Nói thiếu vế đó là hứa suông, và người phải đứng ra giải thích lúc khách không đạt vẫn là bạn.",
  },
  {
    text: "Khách muốn ký gói dài hạn nhưng lịch làm việc chỉ cho phép tập 2 buổi/tuần.",
    correctZone: "CAUTION",
    explanation: "Gói dài hạn tính theo cả số buổi lẫn thời hạn — 2 buổi/tuần là gần như chắc chắn hết hạn mà còn thừa buổi. Nói thẳng phép tính đó, rồi đề xuất gói ngắn hơn hoặc bàn cách tăng tần suất.",
  },
  {
    text: "Khách 60 tuổi muốn ký gói giảm cân nhanh với yêu cầu 6 buổi/tuần.",
    correctZone: "CAUTION",
    explanation: "Không cấm theo tuổi, nhưng tần suất và tốc độ giảm của gói đó không thiết kế cho nhóm này. Hỏi tình trạng sức khoẻ, đề xuất lộ trình chậm hơn, và hỏi FM trước khi chốt.",
  },
  {
    text: "Khách hỏi giới thiệu bạn bè thì có được giảm giá không.",
    correctZone: "CAUTION",
    explanation: "Chính sách giới thiệu do công ty quy định từng thời điểm, không phải do PT hứa. Nói là có chương trình, rồi hỏi FM con số chính xác trước khi trả lời cụ thể.",
  },
  {
    text: "Khách muốn trả góp qua thẻ tín dụng của một bên thứ ba.",
    correctZone: "CAUTION",
    explanation: "Phòng tập có nhận hình thức đó hay không là việc của quầy và của FM. Đừng gật trước rồi mới đi hỏi — khách đã tính toán theo câu trả lời của bạn.",
  },
  {
    text: "Khách xin được giữ mức giá khuyến mãi của tháng trước.",
    correctZone: "CAUTION",
    explanation: "Không tự quyết. Trình FM kèm lý do; nếu không được thì nói thẳng là chương trình đã kết thúc, đừng hứa lấp lửng để giữ khách thêm vài ngày.",
  },
  {
    text: "Khách đang mang thai ba tháng, muốn ký gói giảm cân.",
    correctZone: "CAUTION",
    explanation: "Không bán gói giảm cân cho người đang mang thai. Nhưng cũng đừng đuổi khách về: đề xuất chương trình vận động phù hợp, yêu cầu ý kiến bác sĩ, và báo FM.",
  },
  {
    text: "Khách muốn chuyển nhượng phần gói còn lại cho bạn của họ.",
    correctZone: "CAUTION",
    explanation: "Hợp đồng đứng tên ai thì quyền lợi của người đó; chuyển nhượng hay không là quyết định của công ty. Chuyển FM, và trong lúc chờ thì đừng cho người kia vào tập.",
  },
  {
    text: "Khách hỏi thẳng: \"Nếu em là chị thì em mua gói nào?\"",
    correctZone: "CAUTION",
    explanation: "Trả lời được, nhưng phải trả lời theo mục tiêu và điều kiện của khách chứ không theo hoa hồng của mình. Nói rõ căn cứ mình chọn gói đó — có căn cứ thì khách kiểm chứng được, và bạn cũng tự kiểm chứng được động cơ của mình.",
  },
  {
    text: "Khách đang tập với PT ở một phòng khác, hỏi bạn có nhận thêm không.",
    correctZone: "CAUTION",
    explanation: "Nhận được, đây là khách của thị trường chứ không phải của đồng nghiệp cùng phòng. Nhưng đừng chê chương trình họ đang tập để giành khách — tư vấn dựa trên cái mình làm được, không dựa trên cái người khác làm sai.",
  },
  {
    text: "Khách muốn ký gói cho con mình 15 tuổi.",
    correctZone: "CAUTION",
    explanation: "Người chưa thành niên tập tạ cần điều kiện riêng và phải có người giám hộ ký. Hỏi FM về quy định trước khi bàn tới giá.",
  },
  {
    text: "Ngân sách khách chỉ 10 triệu, nhưng mục tiêu của khách cần một gói 25 triệu.",
    correctZone: "CAUTION",
    explanation: "Đừng ép gói to, cũng đừng bán gói nhỏ rồi im lặng về việc nó không đủ. Nói rõ với 10 triệu thì đi được tới đâu, và để khách chọn — khách bị hụt kỳ vọng sẽ bỏ giữa chừng và không bao giờ quay lại.",
  },
  {
    text: "Khách muốn ký hai gói cùng lúc để \"được giá tốt hơn\".",
    correctZone: "CAUTION",
    explanation: "Có gói mua được nhiều lần, có gói chỉ một lần, và cộng gộp không tự sinh ra chiết khấu. Kiểm tra điều kiện từng gói và hỏi FM trước khi báo một con số nào.",
  },
  {
    text: "Khách hỏi đi công tác dài ngày thì có được bảo lưu không.",
    correctZone: "CAUTION",
    explanation: "Mỗi gói một quy định bảo lưu khác nhau, và số lần cũng có hạn. Tra đúng gói của khách rồi trả lời, đừng nói chung chung là \"được\" — câu đó sẽ quay lại thành khiếu nại.",
  },
  {
    text: "Khách yêu cầu ghi vào hợp đồng cam kết giảm đúng 9kg, không hơn không kém.",
    correctZone: "CAUTION",
    explanation: "Cam kết của gói là một khoảng, và nó đi kèm điều kiện về số buổi tập. Không tự sửa câu chữ hợp đồng — trình FM, và giải thích cho khách vì sao không ai cam kết được một con số tuyệt đối.",
  },
  {
    text: "Cuối tháng FM giục chỉ tiêu, bạn định gọi lại toàn bộ khách cũ trong một tối.",
    correctZone: "CAUTION",
    explanation: "Gọi khách cũ là việc nên làm, nhưng gọi dồn vì áp lực chỉ tiêu thì giọng điệu sẽ khác và khách nhận ra ngay. Rà theo danh sách của FM, ưu tiên người thật sự tới lúc cần tập lại.",
  },
  {
    text: "Khách xin hoàn tiền giữa gói, bạn định trấn an: \"Chị yên tâm, em lo được.\"",
    correctZone: "REFUSE",
    explanation: "Hoàn tiền không thuộc thẩm quyền của PT, và một câu hứa như thế sẽ được nhắc lại nguyên văn khi công ty từ chối. Lắng nghe, ghi lại, chuyển FM trong ngày.",
  },
  {
    text: "Khách chưa tới ký được, bạn định ký hộ chữ ký khách cho kịp chốt tháng.",
    correctZone: "REFUSE",
    explanation: "Đây là giả mạo chữ ký, không phải thủ tục cho nhanh. Một hợp đồng như vậy không bảo vệ được ai, kể cả bạn — nhất là bạn.",
  },
  {
    text: "Khách hỏi gói nào giảm nhanh nhất, bạn định hứa 10kg trong một tháng.",
    correctZone: "REFUSE",
    explanation: "Không gói nào cam kết mức đó, và cơ thể cũng không làm được mức đó một cách an toàn. Hứa để chốt là mua một vụ khiếu nại chắc chắn xảy ra sau 30 ngày.",
  },
  {
    text: "Bạn định tách một hợp đồng thành hai để chia doanh số sang cả tháng sau.",
    correctZone: "REFUSE",
    explanation: "Số của cả hai tháng đều sai, và bảng lương dựng trên đó sai theo. Doanh số ghi đúng tháng phát sinh — muốn tháng sau đẹp thì bán tháng sau.",
  },
  {
    text: "Khách đưa tiền mặt, bạn định giữ vài hôm rồi mới nộp quầy.",
    correctZone: "REFUSE",
    explanation: "Từ lúc cầm tiền tới lúc nộp, mọi rủi ro là của bạn và không ai chứng minh hộ được. Đưa khách ra quầy ngay, hoặc gọi lễ tân ra nhận tại chỗ.",
  },
  {
    text: "Khách thiếu vài cân so với điều kiện chương trình tài trợ, bạn định khai tăng lên cho đủ.",
    correctZone: "REFUSE",
    explanation: "Cân đầu là căn cứ để tính kết quả cuối; khai sai là hỏng cả chương trình và đẩy người duyệt vào thế ký một hồ sơ giả. Ghi đúng số cân, rồi tìm chương trình khác cho khách.",
  },
  {
    text: "Bạn định nói giá sẽ tăng vào tuần sau, trong khi không có thông báo nào như vậy.",
    correctZone: "REFUSE",
    explanation: "Bịa ra một hạn chót để ép quyết định. Nó sống được đúng một tuần — tới lúc giá không tăng thì khách hiểu ngay mình vừa bị lừa, và mọi lời khuyên chuyên môn của bạn cũng mất giá theo.",
  },
  {
    text: "Bạn định lấy ảnh before/after của một khách cũ để chốt khách mới, chưa xin phép ai.",
    correctZone: "REFUSE",
    explanation: "Hình ảnh của khách chỉ được dùng khi họ đồng ý bằng văn bản và biết dùng ở đâu. Đưa cho một người lạ xem để bán hàng là dùng sai mục đích, dù chỉ đưa trên điện thoại của mình.",
  },
  {
    text: "Khách kể có bệnh nền, bạn định gạt đi \"không sao đâu chị\" để kịp chốt.",
    correctZone: "REFUSE",
    explanation: "Câu đó vừa là lời khuyên y tế bạn không có quyền đưa ra, vừa là điều kiện đầu vào bạn vừa cố tình bỏ qua. Ghi lại tình trạng, báo FM, và chỉ chốt khi đã rõ.",
  },
  {
    text: "Tháng này đã đủ chỉ tiêu, bạn định ghi hợp đồng vừa chốt sang tháng sau.",
    correctZone: "REFUSE",
    explanation: "Giấu doanh số cũng là làm sai số liệu, y như ghi khống — chỉ khác chiều. Nó làm hỏng cả kế hoạch của phòng lẫn cách công ty đánh giá thị trường.",
  },
  {
    text: "Bạn định mượn tên một khách cũ tạo hợp đồng ảo cho đủ chỉ tiêu, tháng sau huỷ.",
    correctZone: "REFUSE",
    explanation: "Hợp đồng ảo là gian lận, và \"tháng sau huỷ\" không làm nó bớt gian lận đi. Việc này để lại dấu vết trong hệ thống và sẽ tìm ra được.",
  },
  {
    text: "Khách muốn huỷ trong thời hạn được hoàn tiền, bạn định trì hoãn cho quá hạn.",
    correctZone: "REFUSE",
    explanation: "Cố tình kéo dài để khách mất quyền là lừa dối, và phòng tập sẽ là bên chịu trận khi khách hiểu ra. Chuyển yêu cầu lên FM ngay trong ngày.",
  },
  {
    text: "Để chốt cho nhanh, bạn định tự hứa tặng thêm 10 buổi tập.",
    correctZone: "REFUSE",
    explanation: "Buổi tặng là chi phí của công ty và là công dạy của chính bạn — không ai được tự phát. Muốn có quà thì xin FM trước, rồi mới nói với khách.",
  },
  {
    text: "Bạn định lấy tiền cọc của khách A để giữ chỗ suất khuyến mãi cho khách B.",
    correctZone: "REFUSE",
    explanation: "Tiền của khách A không phải khoản bạn được điều chuyển, dù bạn định bù lại ngay hôm sau. Đây là chỗ mà một việc \"linh động\" biến thành chiếm dụng.",
  },
];
