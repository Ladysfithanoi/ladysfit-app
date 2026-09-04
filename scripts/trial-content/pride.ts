import type { SortCardSeed } from "./types";

export const INTRO = "Mỗi thẻ là một tình huống chuyên môn trên sàn tập. Xếp nó vào một trong ba vùng:\n\n• Chấp nhận — bạn tự xử lý được ngay trong buổi tập, không cần hỏi ai.\n• Cần cẩn trọng — làm được, nhưng phải đổi bài, hạ tải, hoặc hỏi người có chuyên môn hơn trước.\n• Từ chối & báo FM — không tự làm. Dừng lại, đưa lên quản lý hoặc yêu cầu khách có ý kiến y tế.\n\nKhông ai đánh giá bạn vì hỏi. Người ta đánh giá bạn vì đã không hỏi.\n\nXếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.";

export const CARDS: SortCardSeed[] = [
  {
    text: "Khách squat tới rep thứ 8 thì gối đổ vào trong. Tải đang vừa sức, khách chưa kêu đau.",
    correctZone: "ACCEPT",
    explanation: "Lỗi form phổ biến nhất của người mới và nằm gọn trong phần việc của HLV: hạ tải, nhắc đẩy gối ra ngoài, kẹp band nếu cần. Dừng cả buổi vì chuyện này không phải cẩn thận mà là chưa nắm được việc của mình.",
  },
  {
    text: "Khách hỏi vì sao bạn cho tập bài này thay vì bài khác mà khách xem được trên TikTok.",
    correctZone: "ACCEPT",
    explanation: "Giải thích lý do là việc nên làm, và khách hiểu vì sao mình tập thì mới tập bền. Khó chịu vì bị hỏi mới đúng là kiêu ngạo — câu hỏi đó không đe doạ chuyên môn của ai cả.",
  },
  {
    text: "Khách mới tập buổi đầu, hôm sau nhắn là đau nhức cơ hai ngày liền, hỏi có bình thường không.",
    correctZone: "ACCEPT",
    explanation: "Đau cơ khởi phát muộn ở người mới là bình thường. Giải thích, dặn cách xử lý, và điều chỉnh khối lượng buổi kế cho vừa hơn. Đây là câu hỏi bạn phải trả lời được.",
  },
  {
    text: "Khách xin học một động tác cử tạ kỹ thuật cao mà bạn chưa từng được đào tạo.",
    correctZone: "CAUTION",
    explanation: "Không nhận bừa, cũng không giấu. Nói thật là động tác này cần chuyên môn riêng, đề xuất bài thay thế đạt cùng mục tiêu, và nếu muốn dạy thì đi học trước. Dạy một động tác mình chưa từng học chính là chỗ chấn thương bắt đầu.",
  },
  {
    text: "Khách 52 tuổi, huyết áp cao đang uống thuốc, muốn tập HIIT vì nghe nói giảm cân nhanh.",
    correctZone: "CAUTION",
    explanation: "Không cấm, nhưng phải hạ cường độ, theo dõi nhịp tim, tránh động tác đầu thấp hơn tim và những đoạn nín thở. Hỏi khách lần khám gần nhất là khi nào; chưa có ý kiến bác sĩ thì lùi lại và tập nền trước.",
  },
  {
    text: "Khách đau vai khi đẩy ngực. Bạn thấy form sai, nhưng khách bảo PT cũ dạy như vậy.",
    correctZone: "CAUTION",
    explanation: "Sửa bằng lý do kỹ thuật, đừng chê người trước — chê PT cũ trước mặt khách chỉ làm khách nghi ngờ cả nghề này. Hạ tải, đổi góc, xem lại tầm vận động vai. Im lặng để khách đau tiếp thì còn tệ hơn cả chê.",
  },
  {
    text: "Khách đưa đơn thuốc đang uống và hỏi bạn có nên dùng thêm thực phẩm bổ sung không.",
    correctZone: "CAUTION",
    explanation: "Ranh giới nằm ở chỗ có toa hay không: whey, creatine, vitamin thông thường thì tư vấn được trong phạm vi dinh dưỡng thể thao. Thuốc kê đơn và tương tác thuốc là việc của bác sĩ — nói thẳng là bạn không trả lời phần đó.",
  },
  {
    text: "Bạn quay video phân tích form cho khách, xem lại thì thấy chính mình làm mẫu sai trong video.",
    correctZone: "CAUTION",
    explanation: "Sửa và nói với khách, đừng lặng lẽ xoá video. Nhận một lỗi kỹ thuật trước mặt khách không làm mất uy tín; giấu đi rồi để khách bắt chước cái sai mới làm mất, và mất lâu hơn nhiều.",
  },
  {
    text: "Khách mới, có tiền sử thoát vị đĩa đệm, buổi đầu đòi tập deadlift nặng vì thấy bạn trai tập được.",
    correctZone: "REFUSE",
    explanation: "Dừng, không tập bài đó, báo FM và yêu cầu khách có ý kiến chuyên môn y tế trước. Chiều theo là đặt cột sống của khách vào tay một người không được đào tạo để xử lý ca đó — và khách sẽ không nhớ rằng chính họ đòi.",
  },
  {
    text: "Đang tập, khách choáng và tái mặt, phải ngồi xuống. Vài phút sau khách bảo đỡ rồi và muốn tập tiếp.",
    correctZone: "REFUSE",
    explanation: "Dừng buổi, cho khách nghỉ, báo FM và ghi lại sự việc. \"Đỡ rồi\" là cảm giác của khách chứ không phải chẩn đoán, và tình huống này có thể là tụt huyết áp, hạ đường huyết hoặc chuyện nặng hơn.",
  },
  {
    text: "Bạn thấy đồng nghiệp cho một khách đang đau vai gánh tạ sau gáy — sai rõ ràng và có nguy cơ.",
    correctZone: "REFUSE",
    explanation: "Không im lặng: báo FM. Nhảy vào giữa sàn dạy lại trước mặt khách của người khác thì không nên, nhưng để nguyên đấy vì ngại thì lần sau là một ca chấn thương, và bạn đã nhìn thấy trước.",
  },
  {
    text: "Khách đau nhói thắt lưng sau một rep. Còn 3 buổi là hết gói và khách muốn tập cho hết.",
    correctZone: "REFUSE",
    explanation: "Dừng, báo FM để xử lý bảo lưu hoặc gia hạn. Đổi sức khoẻ của khách lấy ba buổi đã dạy là phiên bản tệ nhất của tội kiêu ngạo: tin rằng mình biết cơn đau đó không sao, trong khi mình không có cách nào biết.",
  },
  {
    text: "Khách hỏi nên hít thở thế nào cho đúng khi đẩy tạ.",
    correctZone: "ACCEPT",
    explanation: "Câu hỏi nền tảng, nằm gọn trong chuyên môn của HLV. Trả lời và làm mẫu luôn trong buổi.",
  },
  {
    text: "Khách hôm nay không nâng nổi mức tạ đã làm được buổi trước.",
    correctZone: "ACCEPT",
    explanation: "Ngày khoẻ ngày yếu là bình thường. Hạ tải, giữ kỹ thuật, hỏi qua giấc ngủ và bữa ăn hôm trước — xử lý gọn trong buổi.",
  },
  {
    text: "Khách muốn tập thêm bụng vào cuối mỗi buổi.",
    correctZone: "ACCEPT",
    explanation: "Thêm được, chỉ cần giải thích rằng tập bụng không làm tan mỡ bụng. Nói thẳng điều đó thay vì chiều theo im lặng mới là làm đúng nghề.",
  },
  {
    text: "Khách hỏi có bắt buộc phải giãn cơ sau buổi tập không.",
    correctZone: "ACCEPT",
    explanation: "Trả lời theo đúng những gì mình được đào tạo, kể cả khi câu trả lời là \"không quan trọng như nhiều người nghĩ\". Đừng nói theo cái khách muốn nghe.",
  },
  {
    text: "Máy chạy bộ khách đang dùng phát ra tiếng kêu lạ.",
    correctZone: "ACCEPT",
    explanation: "Dừng máy, chuyển khách sang máy khác, báo kỹ thuật. Việc thường ngày trên sàn, không cần hỏi ai trước.",
  },
  {
    text: "Khách quên mang giày tập, tới phòng bằng dép.",
    correctZone: "ACCEPT",
    explanation: "Không tập bài tạ nặng đứng, đổi sang bài ngồi hoặc nằm cho buổi hôm nay. Xử lý được ngay, không cần biến thành chuyện lớn.",
  },
  {
    text: "Khách thắc mắc vì sao tuần này bạn giảm khối lượng của cả giáo án.",
    correctZone: "ACCEPT",
    explanation: "Giải thích tuần giảm tải là một phần của chương trình chứ không phải bạn lơ là. Khách hiểu chu kỳ thì mới không tự ý tăng tạ bù.",
  },
  {
    text: "Khách mới tập, nói không cảm nhận được nhóm cơ nào đang làm việc.",
    correctZone: "ACCEPT",
    explanation: "Rất phổ biến ở người mới. Giảm tải, chậm nhịp, chạm nhẹ vào nhóm cơ mục tiêu (có xin phép) để khách định vị — đúng phần việc của HLV.",
  },
  {
    text: "Khách hỏi hôm nay còn đau cơ từ buổi trước thì có nên tập tiếp không.",
    correctZone: "ACCEPT",
    explanation: "Phân biệt đau cơ thông thường với đau khớp hay đau nhói là chuyện HLV phải làm được. Hỏi rõ đau kiểu gì, ở đâu, rồi quyết định trong buổi.",
  },
  {
    text: "Khách vừa khỏi một đợt cúm nặng, muốn quay lại ngay cường độ cũ.",
    correctZone: "CAUTION",
    explanation: "Cơ thể vừa ốm dậy không chịu nổi mức trước khi ốm, và cố ép thường dẫn tới ốm lại. Giảm tải rõ rệt vài buổi, theo dõi nhịp tim, và nói trước với khách vì sao chậm lại.",
  },
  {
    text: "Khách có tiền sử chấn thương gối, muốn thêm phần chạy vào giáo án.",
    correctZone: "CAUTION",
    explanation: "Không cấm, nhưng phải biết chấn thương cũ là gì, đã phục hồi tới đâu, có ý kiến chuyên môn nào chưa. Bắt đầu bằng đi bộ dốc và bài tăng lực cho gối, không vào chạy ngay.",
  },
  {
    text: "Khách nhắc tới một phương pháp tập mà bạn chưa từng nghe tên bao giờ.",
    correctZone: "CAUTION",
    explanation: "Nói thật là mình chưa biết và sẽ tìm hiểu, đừng gật gù cho qua. Đoán bừa một câu về thứ mình không biết là cách mất uy tín nhanh nhất, vì khách đã đọc về nó rồi mới hỏi.",
  },
  {
    text: "Bác sĩ dặn khách không được cúi gập lưng, nhưng khách vẫn muốn tập deadlift.",
    correctZone: "CAUTION",
    explanation: "Lời dặn của bác sĩ đứng trên mong muốn của khách và trên chuyên môn của bạn. Có nhiều bài đạt cùng mục tiêu mà không gập lưng — dùng chúng, và ghi lại là khách đã được giải thích.",
  },
  {
    text: "Bạn quay đi một lúc, khách tự lên thêm hai mức tạ.",
    correctZone: "CAUTION",
    explanation: "Dừng set, hạ về mức cũ, và nói rõ vì sao mức tạ do bạn quyết định. Cười cho qua một lần là lần sau khách tự lên nữa, lúc bạn không ở đó.",
  },
  {
    text: "Khách hơi chóng mặt giữa buổi nhưng bảo chỉ do sáng nay chưa ăn.",
    correctZone: "CAUTION",
    explanation: "Có thể đúng là vậy. Nhưng dừng bài, cho ngồi, đo lại cảm giác sau vài phút, và ghi vào ghi chú khách — nếu lặp lại thì đó không còn là chuyện bỏ bữa.",
  },
  {
    text: "Khách đeo đai lưng suốt cả buổi vì \"đeo cho chắc\".",
    correctZone: "CAUTION",
    explanation: "Đai có chỗ dùng của nó, nhưng đeo liên tục thì cơ lõi không phải làm việc và về lâu dài yếu đi. Giải thích khi nào cần đeo, khi nào bỏ ra — và đừng giằng lấy đai của khách.",
  },
  {
    text: "Khách muốn tập buổi sáng khi hoàn toàn chưa ăn gì.",
    correctZone: "CAUTION",
    explanation: "Làm được với buổi nhẹ, không làm với buổi nặng, và tuyệt đối không làm nếu khách có vấn đề đường huyết. Hỏi kỹ trước, và luôn có sẵn đồ ngọt trong tầm tay.",
  },
  {
    text: "Khách trên 50 tuổi muốn tập nhảy hộp vì thấy trên mạng.",
    correctZone: "CAUTION",
    explanation: "Bài có lực dội mạnh lên cổ chân, gối và cột sống. Không cấm tuyệt đối, nhưng phải kiểm tra nền tảng trước và bắt đầu bằng bước lên hộp thấp — đừng để lần đầu tiên là nhảy.",
  },
  {
    text: "Bạn không chắc mình vừa chỉnh tư thế cho khách đã đúng hay chưa.",
    correctZone: "CAUTION",
    explanation: "Dừng lại, quay video, xem lại, hoặc gọi đồng nghiệp có kinh nghiệm hơn nhìn giúp. Đi tiếp trong trạng thái không chắc chắn chính là tội kiêu ngạo ở dạng thầm lặng nhất.",
  },
  {
    text: "Khách kể mình thỉnh thoảng bị hạ đường huyết.",
    correctZone: "CAUTION",
    explanation: "Ghi vào hồ sơ khách, hỏi dấu hiệu báo trước của họ là gì, chuẩn bị sẵn đồ ngọt, và tránh buổi nhịn ăn. Báo FM để cả ca trực cùng biết.",
  },
  {
    text: "Khách muốn lên mức tạ nhanh hơn lộ trình bạn đặt ra.",
    correctZone: "CAUTION",
    explanation: "Nghe lý do của khách — đôi khi họ đúng và giáo án của bạn quá dè dặt. Nhưng đổi thì đổi có căn cứ, kiểm tra bằng một set thử, chứ không đổi vì khách sốt ruột.",
  },
  {
    text: "Khách hỏi ý kiến bạn về một loại thuốc giảm cân đang quảng cáo trên mạng.",
    correctZone: "CAUTION",
    explanation: "Nói được phần nguyên tắc chung và cảnh báo về sản phẩm không rõ nguồn gốc, nhưng không đánh giá thuốc cụ thể — đó là việc của dược sĩ và bác sĩ. Chỗ này bạn khuyên sai là khách uống thật.",
  },
  {
    text: "Bạn nhận ra giáo án mình đã soạn có một bài không hợp với chấn thương cũ của khách.",
    correctZone: "CAUTION",
    explanation: "Sửa ngay và nói với khách là mình vừa điều chỉnh, không cần dựng thành chuyện lớn nhưng cũng đừng lặng lẽ bỏ bài đó đi. Ghi lại để lần soạn sau không lặp lại.",
  },
  {
    text: "Khách đi giày chạy bộ đế mềm nhưng hôm nay có bài squat nặng.",
    correctZone: "CAUTION",
    explanation: "Đế mềm làm mất ổn định khi gánh nặng. Đổi sang bài khác cho hôm nay hoặc cho tập chân trần trên thảm nếu quy định phòng cho phép, và dặn khách chuẩn bị giày cho buổi sau.",
  },
  {
    text: "Đang tập, khách ngất xỉu.",
    correctZone: "REFUSE",
    explanation: "Không tự xử lý một mình: gọi hỗ trợ ngay, sơ cứu theo quy trình, gọi cấp cứu nếu cần, và báo FM cùng người nhà. Sau đó ghi lại toàn bộ sự việc bằng văn bản.",
  },
  {
    text: "Khách nói đau tức ngực và khó thở khi đang tập.",
    correctZone: "REFUSE",
    explanation: "Dừng ngay, không \"thử nhẹ xem sao\". Đây là dấu hiệu phải để y tế xử lý, không phải HLV — gọi cấp cứu và báo FM.",
  },
  {
    text: "Khách vừa mổ cách đây hai tuần, muốn quay lại tập.",
    correctZone: "REFUSE",
    explanation: "Không nhận cho tới khi có giấy hoặc ý kiến rõ ràng của bác sĩ điều trị về những gì được phép làm. Báo FM và giữ lại bằng chứng đã trao đổi với khách.",
  },
  {
    text: "Khách tiểu đường đang tiêm insulin, nhờ bạn kê hẳn thực đơn theo bệnh.",
    correctZone: "REFUSE",
    explanation: "Thực đơn cho người đang dùng insulin phải khớp với phác đồ điều trị. Bạn tư vấn được nguyên tắc ăn uống chung, nhưng kê theo bệnh là việc của bác sĩ dinh dưỡng — báo FM và hướng khách tới đúng chỗ.",
  },
  {
    text: "Khách hỏi bạn nên dùng loại thuốc nào để tăng cơ nhanh.",
    correctZone: "REFUSE",
    explanation: "Không tư vấn, không giới thiệu nguồn, không \"chỉ nói cho biết\". Việc này vượt hẳn phạm vi nghề và có hậu quả pháp lý — nói rõ với khách và báo FM nếu khách vẫn nài.",
  },
  {
    text: "Khách đưa phim chụp cột sống, nhờ bạn đọc kết quả giúp.",
    correctZone: "REFUSE",
    explanation: "Đọc phim là chẩn đoán, và chẩn đoán sai ở đây dẫn thẳng tới một giáo án gây hại. Từ chối rõ ràng, đề nghị khách xin bác sĩ ghi ra những vận động cần tránh — cái đó thì bạn dùng được.",
  },
  {
    text: "Khách nói mình đang dùng steroid và hỏi bạn về liều.",
    correctZone: "REFUSE",
    explanation: "Không bàn về liều, không xác nhận, không im lặng cho qua. Báo FM ngay: đây là chuyện ảnh hưởng tới an toàn của chính khách và tới trách nhiệm của phòng tập.",
  },
  {
    text: "Bạn thấy một máy tập gãy chốt an toàn nhưng vẫn dùng tạm được.",
    correctZone: "REFUSE",
    explanation: "Không cho ai dùng nữa, dán cảnh báo, báo kỹ thuật và FM ngay. \"Vẫn dùng tạm được\" là câu người ta nói ngay trước một tai nạn.",
  },
  {
    text: "Khách lên cơn co giật trong lúc tập.",
    correctZone: "REFUSE",
    explanation: "Gọi cấp cứu ngay và làm theo quy trình an toàn, không tự xử lý. Sau đó báo FM và ghi lại đầy đủ để phòng tập có hồ sơ.",
  },
  {
    text: "Một đứa trẻ tự đi vào khu tạ nặng, không có người lớn đi cùng.",
    correctZone: "REFUSE",
    explanation: "Đưa ra khỏi khu vực ngay và báo lễ tân, FM. Đây là an toàn của một người chưa thành niên trong khu vực có thiết bị nặng — không phải chuyện để nhắc nhở qua loa.",
  },
  {
    text: "Khách nói mình đang mang thai nhưng vẫn muốn giữ bài bụng nặng.",
    correctZone: "REFUSE",
    explanation: "Bỏ hẳn nhóm bài đó và chuyển sang chương trình vận động dành cho thai kỳ, sau khi có ý kiến bác sĩ. Chiều theo mong muốn của khách ở đây là đặt hai người vào rủi ro.",
  },
  {
    text: "Đồng nghiệp nhờ bạn ký xác nhận đã kiểm tra thực hành cho họ, dù bạn chưa kiểm.",
    correctZone: "REFUSE",
    explanation: "Chữ ký đó là căn cứ để cho một người đứng lớp. Ký khống là bạn nhận trách nhiệm cho những gì họ làm sai sau này — từ chối và không cần làm to chuyện, nhưng cũng không nhân nhượng.",
  },
  {
    text: "Khách đòi tập tới lúc nôn mới chịu, bảo như thế mới hiệu quả.",
    correctZone: "REFUSE",
    explanation: "Không có mục tiêu tập luyện nào cần tới đó, và nó là dấu hiệu quá sức chứ không phải thành tích. Từ chối, giải thích, và nếu khách vẫn ép thì báo FM.",
  },
  {
    text: "Bạn được xếp dạy một lớp cần chứng chỉ mà bạn chưa có, khách đã đóng tiền rồi.",
    correctZone: "REFUSE",
    explanation: "Báo FM ngay chứ đừng đứng lớp \"cho xong buổi\". Việc khách đã trả tiền là vấn đề của công ty; việc một người không đủ điều kiện đứng lớp là vấn đề của tất cả mọi người trong phòng đó.",
  },
];
