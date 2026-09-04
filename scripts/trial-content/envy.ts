import type { SortCardSeed } from "./types";

export const INTRO = "Mỗi thẻ là một tình huống giữa bạn và đồng nghiệp cùng phòng. Xếp nó vào một trong ba vùng:\n\n• Chấp nhận — làm bình thường, không cần hỏi ai.\n• Cần cẩn trọng — làm được nhưng phải minh bạch, hoặc phải qua FM trước.\n• Từ chối & báo FM — không làm, và quản lý phải biết.\n\nDoanh số của bạn là việc của bạn với FM. Nó không phải thứ để lấy từ tay người\nngồi cạnh — phòng tập mất một PT giỏi thì cả bạn cũng nghèo đi.\n\nXếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.";

export const CARDS: SortCardSeed[] = [
  {
    text: "Đồng nghiệp tháng này chốt gấp đôi bạn. Bạn sang hỏi bạn ấy tư vấn thế nào.",
    correctZone: "ACCEPT",
    explanation: "Hỏi là cách duy nhất biến ghen tị thành chuyên môn. Người giỏi hơn ngồi cách bạn ba mét mà bạn không hỏi thì tháng sau vẫn thế.",
  },
  {
    text: "Bạn thấy đồng nghiệp có một mẫu tin nhắn chốt sale rất tốt và xin dùng lại.",
    correctZone: "ACCEPT",
    explanation: "Học cách làm của nhau đúng là điều phòng tập cần. Xin đàng hoàng thì không có gì phải cân nhắc — khác hẳn với việc chụp trộm rồi nhận là của mình.",
  },
  {
    text: "Tháng này FM chia lead cho bạn ít hơn tháng trước. Bạn hỏi thẳng FM tiêu chí chia lead.",
    correctZone: "ACCEPT",
    explanation: "Hỏi đúng người, đúng chuyện. Ấm ức mà không hỏi mới là chỗ sinh ra những việc ở hai vùng sau — người ta bắt đầu tự bù đắp theo cách của riêng mình.",
  },
  {
    text: "Khách của đồng nghiệp khen bạn dạy hay và hỏi có chuyển sang tập với bạn được không.",
    correctZone: "CAUTION",
    explanation: "Không tự nhận, cũng đừng lảng. Đưa lên FM quyết và nói cho đồng nghiệp biết. Khách chủ động không làm việc này thành trong sạch — người ngoài nhìn vào vẫn thấy một PT lấy khách của PT khác.",
  },
  {
    text: "Một khách cũ đã hết gói 6 tháng, PT phụ trách trước đã nghỉ việc. Bạn muốn gọi lại mời tái ký.",
    correctZone: "CAUTION",
    explanation: "Khách không còn PT phụ trách thì gọi được, nhưng phải qua danh sách của FM. Không thì hai người cùng gọi một khách trong một ngày, và khách sẽ hiểu ngay rằng ở đây không ai nói chuyện với ai.",
  },
  {
    text: "Đang tập, khách hỏi bạn nghĩ gì về PT đang đứng bên cạnh.",
    correctZone: "CAUTION",
    explanation: "Không chê, cũng không nịnh cho xong. Một câu trung tính rồi quay lại buổi tập. Chê đồng nghiệp trước mặt khách hạ uy tín cả phòng, và khách sẽ hiểu rằng bạn cũng nói về họ như thế với người khác.",
  },
  {
    text: "Bạn và đồng nghiệp cùng tư vấn một khách walk-in. Khách chốt gói, cả hai đều muốn ghi doanh số.",
    correctZone: "CAUTION",
    explanation: "Để FM quyết theo quy trình, đừng tự thoả thuận miệng rồi ai nhanh tay ghi trước. Những vụ ghi trước tính sau là thứ sinh ra mâu thuẫn kéo dài cả năm giữa hai người vốn không có gì với nhau.",
  },
  {
    text: "Bạn được giao một lead mà bạn biết đồng nghiệp đã chăm hai tuần nhưng chưa chốt.",
    correctZone: "CAUTION",
    explanation: "Nhận thì nhận, nhưng hỏi FM vì sao đổi người và hỏi đồng nghiệp đã trao đổi những gì với khách. Không thì bạn tư vấn ngược lại điều người trước đã nói, và khách mất niềm tin vào cả hai.",
  },
  {
    text: "Bạn nhắn riêng cho khách của đồng nghiệp rằng tập với bạn sẽ được giá tốt hơn.",
    correctZone: "REFUSE",
    explanation: "Vừa lấy khách của người khác, vừa tự ý hứa giá không thuộc thẩm quyền của mình. Hai việc sai chồng lên nhau trong một tin nhắn, và tin nhắn thì luôn được chụp lại.",
  },
  {
    text: "Bạn nói với khách rằng PT đang dạy họ chưa có chứng chỉ, để khách chuyển sang tập với bạn.",
    correctZone: "REFUSE",
    explanation: "Kể cả khi câu đó có thật. Chuyện bằng cấp của nhân sự là việc của phòng tập với FM, không phải thứ để lấy làm đòn bẩy bán hàng. Nói ra như thế là hạ uy tín nơi trả lương cho chính mình.",
  },
  {
    text: "Một lead được phân cho đồng nghiệp nhưng đến tay bạn trước. Bạn giữ lại, cuối tháng tự chốt.",
    correctZone: "REFUSE",
    explanation: "Giữ thông tin của người khác là lấy cắp cơ hội chứ không phải nhanh chân. Chuyển ngay cho đúng người và báo FM — hệ thống phân lead chỉ chạy được khi không ai giữ riêng cái gì.",
  },
  {
    text: "Bạn báo với FM rằng đồng nghiệp hay bỏ buổi, trong khi thật ra bạn không chắc, để mình được nhận khách đó.",
    correctZone: "REFUSE",
    explanation: "Đây không còn là ghen tị mà là vu cho người khác để lấy khách. Nếu thật sự nghi có buổi bị bỏ thì nói đúng những gì mình thấy, không thêm — và không kèm theo lời đề nghị nhận khách.",
  },
  {
    text: "Đồng nghiệp được khen trong buổi họp về kết quả tháng, bạn chúc mừng công khai.",
    correctZone: "ACCEPT",
    explanation: "Không có gì phải cân nhắc. Một phòng mà người giỏi bị im lặng đón nhận thì lần sau không ai muốn chia sẻ cách làm nữa.",
  },
  {
    text: "Bạn xin FM cho ngồi cùng một buổi tư vấn của người chốt tốt nhất phòng để học.",
    correctZone: "ACCEPT",
    explanation: "Xin đúng người, đúng cách. Đây là cách biến sự thua kém thành kỹ năng thay vì thành ấm ức.",
  },
  {
    text: "Khách của bạn giới thiệu một người bạn tới tập, bạn nhận và ghi đúng nguồn giới thiệu.",
    correctZone: "ACCEPT",
    explanation: "Khách do chính mình chăm mà ra thì nhận là đúng. Ghi đúng nguồn để chính sách giới thiệu chạy được cho người đã giới thiệu.",
  },
  {
    text: "Đồng nghiệp viết bài quảng bá rất tốt, bạn đọc kỹ để học cách viết.",
    correctZone: "ACCEPT",
    explanation: "Học cách người khác làm là chuyện bình thường. Khác hẳn với chép nguyên rồi nhận là của mình.",
  },
  {
    text: "Bạn đề xuất FM tổ chức một buổi chia sẻ nội bộ về cách tư vấn.",
    correctZone: "ACCEPT",
    explanation: "Biến cạnh tranh ngầm thành chuyện công khai và có ích cho tất cả. Người giỏi vẫn giỏi, nhưng cả phòng cùng lên.",
  },
  {
    text: "Đồng nghiệp hỏi mượn dụng cụ tập cá nhân của bạn cho một buổi.",
    correctZone: "ACCEPT",
    explanation: "Cho mượn hay không tuỳ bạn, nhưng đây không phải chuyện phải cân nhắc về nghề. Đừng biến một lời từ chối bình thường thành thông điệp gì khác.",
  },
  {
    text: "Tháng này bạn bị xếp ca trực ít khách hơn, bạn hỏi FM lịch của tháng tới.",
    correctZone: "ACCEPT",
    explanation: "Hỏi thẳng, hỏi sớm, hỏi đúng người. Ngồi im rồi tự lý giải rằng người ta thiên vị là con đường ngắn nhất tới những việc ở hai vùng sau.",
  },
  {
    text: "Một khách cũ của bạn tự quay lại phòng sau một năm và tìm đúng bạn.",
    correctZone: "ACCEPT",
    explanation: "Khách tự tìm về đúng người từng dạy mình thì không có gì phải hỏi ai. Chỉ cần báo FM để xếp lịch và làm hợp đồng cho đúng.",
  },
  {
    text: "Mất một khách vào tay người khác, bạn ngồi ghi lại mình đã hụt ở chỗ nào.",
    correctZone: "ACCEPT",
    explanation: "Đây đúng là việc nên làm sau mỗi lần thua. Ghi ra thì lần sau sửa được; để trong đầu thì nó chỉ hoá thành ác cảm với người thắng.",
  },
  {
    text: "Đồng nghiệp nghỉ đột xuất, khách của họ nhờ bạn dạy hộ buổi hôm nay.",
    correctZone: "CAUTION",
    explanation: "Dạy hộ được và nên làm, nhưng phải báo FM để buổi đó ghi nhận đúng người và đúng công. Dạy xong im lặng là chỗ dễ sinh hiểu lầm nhất, cho cả hai phía.",
  },
  {
    text: "Bạn nghe thấy đồng nghiệp tư vấn sai một điểm chuyên môn cho khách của họ.",
    correctZone: "CAUTION",
    explanation: "Không sửa lưng giữa sàn trước mặt khách. Nói riêng với họ sau buổi; nếu là chuyện an toàn thì báo FM. Im lặng để họ sai tiếp cũng không phải cách giữ hoà khí.",
  },
  {
    text: "Một khách đang tập với người khác hỏi bạn có nhận thêm giờ không.",
    correctZone: "CAUTION",
    explanation: "Đừng trả lời có hay không ngay. Nói rằng chuyện đổi người do FM sắp xếp và bạn sẽ báo lại — như thế vừa không mất lịch sự với khách, vừa không thành người giành khách.",
  },
  {
    text: "Khách nhắn vào fanpage chung, cả bạn và đồng nghiệp đều nhìn thấy.",
    correctZone: "CAUTION",
    explanation: "Kênh chung thì phải có quy tắc chung: ai trực ca đó trả lời, hoặc theo phân công của FM. Tranh nhau trả lời trước sẽ hiện ra ngay trước mắt khách.",
  },
  {
    text: "FM khen đồng nghiệp về một việc mà bạn cũng đã làm nhưng không ai biết.",
    correctZone: "CAUTION",
    explanation: "Nói ra được, miễn là nói với FM và nói về phần việc của mình, không phải nói để hạ phần việc của người kia. Nuốt vào rồi để bụng mới là chỗ ghen tị bắt đầu.",
  },
  {
    text: "Bạn muốn xin chuyển sang khung giờ đông khách mà đồng nghiệp đang giữ.",
    correctZone: "CAUTION",
    explanation: "Xin thì cứ xin, nhưng xin với FM và bằng lý do công việc. Đi vận động sau lưng hoặc kể xấu người đang giữ ca đó là cách chắc chắn hỏng cả hai thứ.",
  },
  {
    text: "Đồng nghiệp hay tới muộn, bạn phải trông máy và trông khách hộ họ.",
    correctZone: "CAUTION",
    explanation: "Nói thẳng với họ một lần trước đã. Vẫn tiếp diễn thì báo FM bằng dữ kiện cụ thể — ngày nào, muộn bao lâu — chứ không phải bằng nhận xét chung về con người họ.",
  },
  {
    text: "Bạn thấy tên mình bị thiếu trong phần chia hoa hồng của một hợp đồng làm chung.",
    correctZone: "CAUTION",
    explanation: "Gửi FM phần việc mình đã làm kèm mốc thời gian, hỏi lại cho rõ. Đây là quyền lợi chính đáng, nhưng đòi qua nhóm chat chung hoặc đòi với đồng nghiệp thì thành chuyện khác.",
  },
  {
    text: "Khách của đồng nghiệp hỏi bạn một câu chuyên môn ngay giữa sàn.",
    correctZone: "CAUTION",
    explanation: "Trả lời ngắn gọn thì được, nhưng đừng đi vào giáo án của họ và tuyệt đối đừng nhận xét về người đang dạy. Nói xong thì chủ động kể lại với đồng nghiệp.",
  },
  {
    text: "Bạn nghe đồng nghiệp hứa với khách một điều trái chính sách của công ty.",
    correctZone: "CAUTION",
    explanation: "Không xen vào lúc đó, nhưng cũng không để nguyên — vì người phải giải thích với khách sau này có thể là bạn. Nói riêng với họ, và nếu họ vẫn giữ lời hứa đó thì báo FM.",
  },
  {
    text: "Bạn muốn đăng ảnh khách của mình lên trang cá nhân cho bằng đồng nghiệp.",
    correctZone: "CAUTION",
    explanation: "Đăng được nếu khách đồng ý bằng văn bản và biết đăng ở đâu. Nhưng nếu động cơ là để không thua kém ai thì hãy hỏi lại: khách được gì trong việc đó.",
  },
  {
    text: "Phòng có một suất đi đào tạo, chỉ một người được đi.",
    correctZone: "CAUTION",
    explanation: "Ứng cử đàng hoàng với lý do của mình. Đừng vận động để loại người khác — suất năm nay mất thì năm sau còn, nhưng tiếng thì không lấy lại được.",
  },
  {
    text: "Bạn phát hiện một khách tiềm năng đang được cả bạn và đồng nghiệp cùng chăm.",
    correctZone: "CAUTION",
    explanation: "Dừng lại và đưa lên FM để phân một người. Cả hai cùng nhắn tin cho khách là khách thấy ngay phòng này không có quy trình, và thường thì họ bỏ cả hai.",
  },
  {
    text: "Đồng nghiệp mới vào hỏi bạn liên tục, chiếm khá nhiều thời gian của bạn.",
    correctZone: "CAUTION",
    explanation: "Giúp là việc nên làm, nhưng đặt khung giờ cho nó — ví dụ trước ca hoặc sau ca. Từ chối thẳng thừng vì sợ họ giỏi lên là kiểu ghen tị lặng lẽ và dễ nhận ra nhất.",
  },
  {
    text: "Bạn định nhắn hỏi thăm một khách cũ nay đã chuyển sang tập với đồng nghiệp.",
    correctZone: "CAUTION",
    explanation: "Hỏi thăm thì không sai, nhưng ranh giới rất mảnh và người ngoài nhìn vào sẽ không phân biệt được. Nếu thật sự quý khách đó thì một câu chúc là đủ; đừng hỏi về chương trình họ đang tập.",
  },
  {
    text: "Bạn định đăng một dòng ẩn ý chê đồng nghiệp lên mạng xã hội.",
    correctZone: "REFUSE",
    explanation: "Không ai trong phòng đọc mà không hiểu đó là ai, kể cả khách. Chuyện nội bộ giải quyết bên trong; đưa lên mạng là kéo cả phòng tập vào.",
  },
  {
    text: "Bạn định xoá ghi chú khách mà đồng nghiệp đã nhập trong hệ thống.",
    correctZone: "REFUSE",
    explanation: "Đó là dữ liệu công việc của công ty, không phải của riêng ai. Xoá là phá hoại hồ sơ khách, và hệ thống có lưu lại ai vừa làm gì.",
  },
  {
    text: "Bạn định sửa số điện thoại trong hồ sơ một lead để đồng nghiệp không liên lạc được.",
    correctZone: "REFUSE",
    explanation: "Làm sai dữ liệu để chặn người khác làm việc. Khách mất cơ hội được tư vấn, công ty mất một lead, và bạn thì mất chỗ đứng khi việc này lộ ra.",
  },
  {
    text: "Bạn định nói với FM rằng khách phàn nàn về đồng nghiệp, dù khách chưa hề nói thế.",
    correctZone: "REFUSE",
    explanation: "Bịa lời khách để hạ người khác. Chỉ cần FM hỏi lại khách một câu là mọi thứ sụp, và thứ sụp không phải chỉ là câu chuyện đó.",
  },
  {
    text: "Bạn định chụp màn hình tin nhắn riêng của đồng nghiệp cho người khác xem.",
    correctZone: "REFUSE",
    explanation: "Tin nhắn riêng là chuyện riêng, kể cả khi bạn thấy nó đáng bị phê phán. Có vấn đề thật thì báo FM bằng lời của mình, không phát tán nội dung của người khác.",
  },
  {
    text: "Bạn định rủ vài người cùng phòng không hợp tác với một đồng nghiệp mới.",
    correctZone: "REFUSE",
    explanation: "Đây là cô lập người khác ở nơi làm việc. Ngoài chuyện sai với người đó, nó còn làm ca trực có lỗ hổng và khách là người lãnh hậu quả.",
  },
  {
    text: "Bạn định vào tài khoản chung xem doanh số của đồng nghiệp rồi kể ra ngoài.",
    correctZone: "REFUSE",
    explanation: "Xem vì công việc là một chuyện, mang đi kể là chuyện khác hẳn. Thu nhập của người khác không phải thông tin để bạn dùng.",
  },
  {
    text: "Bạn định báo giá thấp hơn bảng giá để giành một khách đang do đồng nghiệp tư vấn.",
    correctZone: "REFUSE",
    explanation: "Vừa phá giá của công ty, vừa giành khách của người cùng phòng. Khách chốt được lần này sẽ mặc định lần sau cũng mặc cả được như vậy.",
  },
  {
    text: "Bạn định nói với khách rằng đồng nghiệp sắp nghỉ việc, để khách chuyển sang mình.",
    correctZone: "REFUSE",
    explanation: "Dùng một thông tin nhân sự — đúng hay sai đều vậy — làm công cụ giành khách. Nếu tin đó sai thì là bịa đặt; nếu đúng thì đó cũng không phải chuyện bạn được đem ra nói.",
  },
  {
    text: "Bạn định xoá lịch hẹn của đồng nghiệp trên hệ thống để nhận khách đó vào giờ mình.",
    correctZone: "REFUSE",
    explanation: "Khách tới không có ai đón, đồng nghiệp mất buổi dạy, và hệ thống ghi lại người vừa xoá. Không có phần nào của việc này gỡ lại được bằng một lời xin lỗi.",
  },
  {
    text: "Bạn định lấy ảnh transform của khách đồng nghiệp làm ví dụ cho khách mình.",
    correctZone: "REFUSE",
    explanation: "Vừa dùng hình ảnh khách không xin phép, vừa nhận kết quả của người khác làm của mình. Khách mới ký vì tin vào một điều không có thật.",
  },
  {
    text: "Bạn định nói với khách rằng giáo án họ đang tập là do bạn soạn, thật ra không phải.",
    correctZone: "REFUSE",
    explanation: "Nhận công của người khác trước mặt khách. Chuyện này luôn lộ, vì chỉ cần khách hỏi một câu kỹ thuật mà bạn không trả lời được là xong.",
  },
  {
    text: "Đồng nghiệp nhờ bạn giữ kín việc họ nhận tiền dạy riêng ngoài sổ.",
    correctZone: "REFUSE",
    explanation: "Giữ kín là trở thành người cùng biết mà không nói — về sau chuyện vỡ ra thì bạn cũng ở trong đó. Từ chối và báo FM, không phải để hại họ mà để mình không mắc kẹt.",
  },
  {
    text: "Bạn định gửi tin nhắn nặc danh cho quản lý phản ánh sai sự thật về đồng nghiệp.",
    correctZone: "REFUSE",
    explanation: "Nặc danh và sai sự thật, hai thứ đó cộng lại thì không còn là phản ánh nữa. Có chuyện thật thì nói bằng tên mình và bằng dữ kiện cụ thể.",
  },
];
