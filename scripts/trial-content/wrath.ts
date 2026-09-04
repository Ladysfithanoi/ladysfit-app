import type { SortCardSeed } from "./types";

export const INTRO = "Mỗi thẻ là một tình huống căng thẳng có thật. Xếp nó vào một trong ba vùng:\n\n• Chấp nhận — bạn xử lý ngay tại chỗ được, không cần ai.\n• Cần cẩn trọng — xử lý được, nhưng phải ghi lại và nói với FM trong ngày.\n• Từ chối & báo FM — không tự xử lý. Dừng lại và đưa lên quản lý ngay.\n\nThứ phân loại người ở vòng này không phải ai giỏi chịu đựng hơn, mà ai biết\nchuyện nào là của mình và chuyện nào phải chuyển đi.\n\nXếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.";

export const CARDS: SortCardSeed[] = [
  {
    text: "Khách trách bạn vì buổi trước bạn quên nhắc đổi mức tạ. Giọng hơi gắt nhưng khách nói đúng.",
    correctZone: "ACCEPT",
    explanation: "Nhận lỗi, sửa, đi tiếp. Đúng là lỗi của mình và nó nhỏ. Cãi lại một lời trách có căn cứ là cách nhanh nhất biến chuyện nhỏ thành chuyện phải nhờ FM.",
  },
  {
    text: "Khách đến muộn 20 phút rồi khó chịu vì buổi tập bị rút ngắn.",
    correctZone: "ACCEPT",
    explanation: "Nói lại quy định giờ một cách bình thản, rồi tập cho ra hồn phần thời gian còn lại. Không cần báo ai — nhưng cũng không kéo dài bù giờ, vì bù một lần là thành lệ.",
  },
  {
    text: "Hai khách tranh nhau một máy tập và cả hai cùng nhìn về phía bạn.",
    correctZone: "ACCEPT",
    explanation: "Điều phối cho tập xen kẽ, đổi thứ tự bài của khách mình. Việc thường ngày trên sàn, và cách bạn xử lý ba mươi giây này quyết định không khí cả buổi.",
  },
  {
    text: "Khách nói mình giảm chưa đủ như cam kết và muốn được hoàn tiền. Khách vẫn đang bình tĩnh.",
    correctZone: "CAUTION",
    explanation: "Nghe hết, không ngắt, và tuyệt đối không hứa gì về tiền — hoàn tiền không thuộc thẩm quyền của PT. Lấy lại số liệu cân đo, số buổi đã tập, nhật ký ăn, rồi báo FM ngay trong ngày kèm dữ liệu.",
  },
  {
    text: "Nửa đêm khách nhắn một tin dài trách bạn không quan tâm. Đọc xong bạn thấy rất ức.",
    correctZone: "CAUTION",
    explanation: "Đừng trả lời lúc đó. Sáng hôm sau nhắn một câu ngắn, hẹn nói trực tiếp, và báo FM là đang có chuyện. Tin nhắn viết lúc đang giận bao giờ cũng là tin nhắn bị chụp màn hình.",
  },
  {
    text: "Khách kể lại rằng một đồng nghiệp đã nói xấu bạn với họ.",
    correctZone: "CAUTION",
    explanation: "Không đối chất giữa sàn. Ghi lại chính xác lời khách kể — kể cả phần bạn không thích nghe — rồi đưa FM. Tự đi hỏi tội là biến chuyện của hai người thành chuyện cả phòng đứng nhìn.",
  },
  {
    text: "Suốt buổi tập, khách liên tục chê bài tập bạn thiết kế là vô dụng.",
    correctZone: "CAUTION",
    explanation: "Hỏi thẳng khách muốn gì và ghi nhận cho đàng hoàng. Nếu là khác biệt về phương pháp thì báo FM để tính chuyện đổi PT. Cắn răng chịu tới hết gói là chỗ phẫn nộ tích lại rồi bung ra vào lúc tệ nhất.",
  },
  {
    text: "Bạn phát hiện bảng lương tháng này tính thiếu mấy buổi dạy của mình.",
    correctZone: "CAUTION",
    explanation: "Gửi FM danh sách buổi kèm ảnh check-out, đúng quy trình và đúng người. Đăng lên nhóm chat chung thì không: nó không làm bạn được trả nhanh hơn, chỉ làm chuyện của bạn thành chuyện của tất cả.",
  },
  {
    text: "Khách quát bạn giữa sàn trước mặt nhiều người, dùng từ xúc phạm.",
    correctZone: "REFUSE",
    explanation: "Dừng buổi tập, không đáp trả một câu nào, mời khách sang chỗ riêng hoặc gọi FM ngay. Bạn không phải chịu đựng bị xúc phạm, nhưng cũng không phải người xử lý chuyện đó một mình giữa sàn.",
  },
  {
    text: "Khách nhắn tin doạ sẽ đăng bài bóc phốt lên mạng nếu không được hoàn tiền.",
    correctZone: "REFUSE",
    explanation: "Không thương lượng, không trả lời một mình, không xoá tin. Chụp lại toàn bộ và báo FM ngay. Đây đã là chuyện của công ty chứ không còn là chuyện giữa bạn và một khách hàng.",
  },
  {
    text: "Khách có mùi rượu, nói năng khó kiểm soát, vẫn đòi vào tập buổi hôm nay.",
    correctZone: "REFUSE",
    explanation: "Không cho tập, báo FM và lễ tân. Người say không giữ được thăng bằng lẫn phán đoán, và mọi thứ xảy ra sau đó sẽ được tính là lỗi của phòng tập vì đã cho vào.",
  },
  {
    text: "Trong lúc nóng giận, một đồng nghiệp đẩy vai bạn giữa sàn.",
    correctZone: "REFUSE",
    explanation: "Không đẩy lại, tách ra, báo FM ngay. Đụng tay chân ở nơi làm việc không có phiên bản nhẹ — bỏ qua lần này là mặc định cho phép nó xảy ra lần nữa, với bạn hoặc với người khác.",
  },
  {
    text: "Khách cáu vì phải chờ 5 phút do buổi trước của bạn kéo dài.",
    correctZone: "ACCEPT",
    explanation: "Xin lỗi ngắn gọn, bù đủ thời gian, và siết lại việc kết thúc buổi đúng giờ. Đây là lỗi vận hành của mình, không phải chuyện phải nhờ ai.",
  },
  {
    text: "Khách phàn nàn phòng đông quá, không có máy trống.",
    correctZone: "ACCEPT",
    explanation: "Đổi thứ tự bài, dùng bài thay thế, chia set xen kẽ. Xử lý ngay trong buổi là đúng việc — than cùng khách thì không giúp gì.",
  },
  {
    text: "Khách bực vì điều hoà khu tập hôm nay không đủ mát.",
    correctZone: "ACCEPT",
    explanation: "Ghi nhận, báo kỹ thuật, và trong lúc chờ thì giảm bớt phần cardio nặng. Chuyện nhỏ, nhưng phớt lờ thì thành chuyện lớn dần.",
  },
  {
    text: "Khách trách bạn đếm sai số rep của họ.",
    correctZone: "ACCEPT",
    explanation: "Nhận và đếm lại. Cãi để giữ thể diện trong một chuyện đếm số là mất nhiều hơn được rất nhiều.",
  },
  {
    text: "Khách khó chịu vì nhạc trong phòng quá to.",
    correctZone: "ACCEPT",
    explanation: "Hỏi lễ tân giảm bớt hoặc chuyển khách sang khu yên hơn. Việc thường ngày, xử lý xong trong hai phút.",
  },
  {
    text: "Khách nói hôm nay trông bạn lơ đãng — và đúng là bạn đang lơ đãng thật.",
    correctZone: "ACCEPT",
    explanation: "Nhận, kéo mình về buổi tập. Khách trả tiền cho sự tập trung của bạn, và họ nhận ra khi không có nó.",
  },
  {
    text: "Hai khách lời qua tiếng lại vì có người để tạ bừa không cất.",
    correctZone: "ACCEPT",
    explanation: "Bước vào giữa, tự cất tạ, nói một câu hạ nhiệt rồi đưa cả hai về buổi tập. Đây là việc của người đang có mặt trên sàn.",
  },
  {
    text: "Khách hỏi vì sao hôm nay đổi bài mà không nói trước.",
    correctZone: "ACCEPT",
    explanation: "Giải thích lý do chuyên môn. Đổi bài là quyền của HLV, nhưng nói trước một câu là phép lịch sự tối thiểu — lần sau nhớ nói.",
  },
  {
    text: "Khách trách bạn trả lời tin nhắn chậm trong giờ hành chính.",
    correctZone: "ACCEPT",
    explanation: "Nếu đúng là chậm thì nhận và nói rõ khung giờ mình trả lời được. Đặt kỳ vọng rõ ràng một lần còn hơn để khách tự đoán rồi thất vọng nhiều lần.",
  },
  {
    text: "Khách nói sẽ đánh giá 1 sao nếu không được đổi sang PT khác.",
    correctZone: "CAUTION",
    explanation: "Đừng thương lượng về bài đánh giá. Hỏi thật lý do muốn đổi, ghi lại, và chuyển FM — việc đổi người vốn không phải bạn quyết, nên đừng nhận về mình.",
  },
  {
    text: "Khách đòi bạn xin lỗi ngay trước mặt những người khác vì một lỗi nhỏ.",
    correctZone: "CAUTION",
    explanation: "Sai thì xin lỗi, nhưng đề nghị nói riêng — một lời xin lỗi có thật không cần khán giả. Nếu khách nhất định làm cho to chuyện thì đó là dấu hiệu phải báo FM.",
  },
  {
    text: "Khách phàn nàn với bạn về thái độ của lễ tân.",
    correctZone: "CAUTION",
    explanation: "Nghe, ghi lại nguyên văn, chuyển FM. Đừng hùa theo chê đồng nghiệp cho khách nguôi, cũng đừng gạt đi — cả hai đều làm hỏng chuyện theo hai cách khác nhau.",
  },
  {
    text: "Bạn thấy đồng nghiệp và một khách đang to tiếng ở góc phòng.",
    correctZone: "CAUTION",
    explanation: "Lại gần, tách hai bên bằng một lý do bình thường, và gọi FM. Đứng nhìn thì tình huống leo thang; xông vào bênh một phía thì thành hai người cãi một người.",
  },
  {
    text: "Khách gọi thẳng cho FM phàn nàn về bạn mà không nói gì với bạn trước.",
    correctZone: "CAUTION",
    explanation: "Đừng nhắn hỏi khách vì sao không nói với mình — nghe như trách móc. Làm việc với FM, xin nghe đầy đủ nội dung, và chuẩn bị dữ kiện của buổi tập đó.",
  },
  {
    text: "Khách nhắn tin chỉ trích bằng lời lẽ nặng nhưng chưa tới mức xúc phạm.",
    correctZone: "CAUTION",
    explanation: "Trả lời ngắn, không đáp lại giọng điệu, hẹn nói trực tiếp. Chụp lại tin nhắn và báo FM là đang có chuyện — không phải để tố, mà để có người thứ hai nắm được diễn biến.",
  },
  {
    text: "Bạn đang rất bực vì chuyện riêng, còn 10 phút nữa vào buổi dạy.",
    correctZone: "CAUTION",
    explanation: "Đây là lúc dễ phát cáu với khách nhất mà lý do lại chẳng liên quan gì tới họ. Ra ngoài vài phút, và nếu không tự kéo lại được thì báo FM đổi ca.",
  },
  {
    text: "Khách mất đồ trong tủ và yêu cầu được xem lại camera ngay.",
    correctZone: "CAUTION",
    explanation: "Ghi nhận nghiêm túc, đưa lên FM và lễ tân theo quy trình. Bạn không có quyền quyết định cho ai xem camera, và tự hứa là đặt người khác vào thế khó.",
  },
  {
    text: "Khách trách rằng bạn làm họ chấn thương, còn bạn thì không chắc có phải vậy không.",
    correctZone: "CAUTION",
    explanation: "Không cãi và cũng không nhận vội. Hỏi kỹ diễn biến, ghi lại giáo án và mức tạ hôm đó, khuyên khách đi khám, và báo FM ngay trong ngày.",
  },
  {
    text: "Người nhà khách gọi điện chất vấn bạn về chương trình tập của khách.",
    correctZone: "CAUTION",
    explanation: "Thông tin của khách chỉ trao đổi với chính khách. Lịch sự đề nghị người nhà làm việc qua khách hoặc qua FM — kể cả khi họ là người trả tiền.",
  },
  {
    text: "Khách yêu cầu bạn viết cam kết sẽ không tái diễn lỗi vừa rồi.",
    correctZone: "CAUTION",
    explanation: "Cam kết bằng văn bản là chuyện của công ty với khách, không phải của cá nhân bạn. Nhận lỗi bằng lời, và chuyển yêu cầu văn bản lên FM.",
  },
  {
    text: "Trong nhóm chat công ty, một đồng nghiệp nhắc tên bạn với giọng trách móc.",
    correctZone: "CAUTION",
    explanation: "Đừng trả lời trong nhóm. Nhắn riêng cho họ, và nếu là chuyện công việc thật thì đưa lên FM. Đối đáp trong nhóm chung chỉ cho mọi người xem, không giải quyết được gì.",
  },
  {
    text: "Khách liên tục so sánh bạn với PT cũ theo hướng chê bạn.",
    correctZone: "CAUTION",
    explanation: "Hỏi cụ thể họ thấy thiếu điều gì — thường là một chi tiết rất nhỏ mà mình sửa được. Nếu chỉ là so sánh chung chung kéo dài thì báo FM để tính chuyện phù hợp.",
  },
  {
    text: "Bạn nhận ra hôm qua mình đã to tiếng với khách.",
    correctZone: "CAUTION",
    explanation: "Chủ động xin lỗi trước khi khách phàn nàn, và tự báo FM. Người báo trước luôn ở vị thế khác hẳn người bị phát hiện sau.",
  },
  {
    text: "Khách khiếu nại về một buổi mà bạn dạy hộ cho đồng nghiệp.",
    correctZone: "CAUTION",
    explanation: "Nhận phần việc của mình trong buổi đó, không đẩy sang người kia và cũng không gánh thay. Kể lại đúng những gì mình đã làm cho FM.",
  },
  {
    text: "Khách xô đẩy bạn trong lúc tranh cãi.",
    correctZone: "REFUSE",
    explanation: "Dừng ngay, lùi lại, không đụng lại, gọi FM và bảo vệ. Đây đã qua ranh giới va chạm thân thể — không có phiên bản nhẹ để tự xử lý.",
  },
  {
    text: "Khách nói sẽ chờ bạn ở ngoài phòng tập sau ca làm.",
    correctZone: "REFUSE",
    explanation: "Đây là lời đe doạ, dù nói bằng giọng bình thản. Báo FM và bảo vệ ngay, không ra về một mình, và ghi lại nguyên văn câu nói cùng thời điểm.",
  },
  {
    text: "Khách chửi bới nhân viên lễ tân ngay trước mặt bạn.",
    correctZone: "REFUSE",
    explanation: "Không đứng nhìn. Tách hai bên, đưa đồng nghiệp ra khỏi tình huống, gọi FM. Người bị chửi hôm nay là lễ tân, nhưng cách phòng tập xử lý sẽ áp dụng cho tất cả.",
  },
  {
    text: "Hai khách xông vào đánh nhau trong khu tập.",
    correctZone: "REFUSE",
    explanation: "Gọi bảo vệ và FM ngay, tách người khác ra khỏi khu vực, không tự lao vào can bằng tay. An toàn của những người xung quanh là ưu tiên trước.",
  },
  {
    text: "Khách quay video bạn nói là để làm bằng chứng rồi đăng lên mạng.",
    correctZone: "REFUSE",
    explanation: "Không giằng điện thoại, không đôi co. Báo FM ngay để công ty làm việc chính thức — đây đã là chuyện hình ảnh và danh dự, vượt khỏi tầm một cuộc trao đổi giữa hai người.",
  },
  {
    text: "Khách yêu cầu bạn ký ngay một tờ giấy nhận lỗi tại chỗ.",
    correctZone: "REFUSE",
    explanation: "Không ký bất cứ văn bản nào dưới sức ép, kể cả khi bạn thấy mình có lỗi thật. Đề nghị làm việc với FM — chữ ký của bạn có hệ quả pháp lý cho cả công ty.",
  },
  {
    text: "Khách nhắn tin đe doạ tới gia đình bạn.",
    correctZone: "REFUSE",
    explanation: "Chụp lại toàn bộ, không trả lời, báo FM ngay lập tức và cân nhắc trình báo công an. Đây không còn là mâu thuẫn khách hàng.",
  },
  {
    text: "Đang giận, bạn định nhắn lại cho khách một câu thật nặng.",
    correctZone: "REFUSE",
    explanation: "Đừng gửi. Tin nhắn đó sẽ tồn tại lâu hơn cơn giận rất nhiều và sẽ được đọc lại trong một cuộc họp. Viết ra rồi xoá, đi rửa mặt, mai trả lời.",
  },
  {
    text: "Khách đòi gặp riêng bạn ở một nơi khác để \"nói chuyện cho ra nhẽ\".",
    correctZone: "REFUSE",
    explanation: "Không gặp riêng, không gặp ngoài phòng tập. Mọi trao đổi diễn ra tại phòng, trong giờ, có FM — đề nghị đúng như vậy và báo FM ngay.",
  },
  {
    text: "Đồng nghiệp rủ bạn cùng ra đối chất với một khách khó tính.",
    correctZone: "REFUSE",
    explanation: "Hai nhân viên đứng trước một khách là hình ảnh gây sức ép, dù ý định không phải vậy. Từ chối và cùng nhau đưa việc lên FM.",
  },
  {
    text: "Khách mang theo một vật có thể gây thương tích vào khu tập.",
    correctZone: "REFUSE",
    explanation: "Không tự xử lý, không tiếp cận gần. Báo bảo vệ và FM ngay, đưa những người xung quanh ra xa khu vực.",
  },
  {
    text: "Khách yêu cầu bạn cung cấp thông tin cá nhân của một khách khác để họ đi kiện.",
    correctZone: "REFUSE",
    explanation: "Thông tin khách hàng không được đưa cho bất kỳ ai, kể cả khi lý do nghe rất chính đáng. Từ chối và chuyển yêu cầu lên FM.",
  },
  {
    text: "Bạn định đăng chuyện khách lên mạng xã hội kèm ảnh chụp màn hình tin nhắn.",
    correctZone: "REFUSE",
    explanation: "Dù bạn đúng, việc này biến một mâu thuẫn riêng thành khủng hoảng của cả phòng tập, và công ty sẽ phải xử lý bạn trước khi xử lý khách. Đưa lên FM thay vì lên mạng.",
  },
  {
    text: "Khách có dấu hiệu dùng chất kích thích và đang gây rối trong phòng.",
    correctZone: "REFUSE",
    explanation: "Không tiếp cận một mình, không tranh luận. Gọi bảo vệ và FM ngay, đưa khách khác ra khỏi khu vực và ghi lại diễn biến.",
  },
];
