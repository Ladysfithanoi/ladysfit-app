import type { SortCardSeed } from "./types";

export const INTRO = "Mỗi thẻ là một tình huống có thật ở phòng tập. Xếp nó vào một trong ba vùng:\n\n• Chấp nhận — làm bình thường, không cần báo ai.\n• Cần cẩn trọng — làm được nhưng phải có giới hạn rõ ràng, hoặc phải nói trước với FM.\n• Từ chối & báo FM — không làm, và quản lý phải biết.\n\nXếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc — như chấp nhận thẳng một việc\nđáng phải từ chối — thì mất hết điểm của thẻ đó.";

export const CARDS: SortCardSeed[] = [
  {
    text: "Khách hoàn thành gói L2 và rủ cả nhóm tập cùng đi ăn mừng, có mời bạn đi cùng.",
    correctZone: "ACCEPT",
    explanation: "Sinh hoạt nhóm, công khai, nhiều người. Không có gì phải cân nhắc — từ chối những việc như thế này chỉ làm khách thấy xa cách.",
  },
  {
    text: "Khách tặng bạn một bình nước và một chiếc khăn tập nhân dịp sinh nhật bạn.",
    correctZone: "ACCEPT",
    explanation: "Quà nhỏ, giá trị tượng trưng, tặng công khai. Nhận và cảm ơn là ứng xử bình thường.",
  },
  {
    text: "Khách nhờ bạn chụp giúp ảnh tiến độ để chính khách đăng lên trang cá nhân của họ.",
    correctZone: "ACCEPT",
    explanation: "Ảnh của khách, khách tự đăng, bạn chỉ bấm máy. Khác hẳn với việc phòng tập dùng ảnh đó.",
  },
  {
    text: "Khách nhắn tin lúc 11h đêm hỏi mai ăn gì trước buổi tập.",
    correctZone: "CAUTION",
    explanation: "Câu hỏi chính đáng, nhưng trả lời lúc 11h đêm một lần là mở ra kỳ vọng trả lời mọi lúc. Trả lời được, kèm một câu đặt giới hạn giờ nhắn tin — đặt sớm thì nhẹ nhàng, để lâu mới đặt thì thành ra bạn đang xa lánh khách.",
  },
  {
    text: "Khách kết bạn Facebook cá nhân của bạn.",
    correctZone: "CAUTION",
    explanation: "Không sai, nhưng trang cá nhân của bạn từ lúc đó là một phần hình ảnh nghề nghiệp. Cân nhắc trước khi đồng ý, và nếu đồng ý thì tự soát lại những gì mình đăng.",
  },
  {
    text: "Đang tập, khách kể chuyện mâu thuẫn với chồng rồi bật khóc.",
    correctZone: "CAUTION",
    explanation: "Lắng nghe là một phần của nghề — nhưng bạn là HLV, không phải chuyên gia tâm lý. Dừng vài phút, ghi nhận cảm xúc của khách, rồi đưa buổi tập trở lại. Ôm luôn vai trò tư vấn tâm lý là bước qua ranh giới chuyên môn của chính mình.",
  },
  {
    text: "Phòng tập muốn đăng ảnh before/after của khách lên fanpage. Khách đã đồng ý miệng với bạn.",
    correctZone: "CAUTION",
    explanation: "Đồng ý miệng là chưa đủ để dùng hình ảnh của một người lên kênh thương mại. Phải có xác nhận bằng văn bản, và khách phải biết ảnh sẽ đăng ở đâu. Báo FM trước khi gửi ảnh đi.",
  },
  {
    text: "Khách nhờ bạn giữ hộ chìa khoá tủ đồ trong hai tuần đi công tác.",
    correctZone: "CAUTION",
    explanation: "Việc nhỏ nhưng bạn đang cầm tài sản của khách mà không ai biết. Mất đồ là không có cách nào chứng minh. Gửi lễ tân giữ theo quy trình của phòng tập.",
  },
  {
    text: "Khách xin số tài khoản cá nhân của bạn để chuyển tiền gói tập cho nhanh, khỏi phải ra quầy.",
    correctZone: "REFUSE",
    explanation: "Tiền gói tập là doanh thu của công ty. Nhận vào tài khoản cá nhân — dù bạn có nộp lại đủ — là phá vỡ toàn bộ đường ghi nhận doanh số, và khi có tranh chấp thì không ai bảo vệ được bạn. Từ chối và hướng dẫn khách ra quầy.",
  },
  {
    text: "Khách đưa phong bì 5 triệu 'cảm ơn riêng' vì đã giúp giảm được 8kg, và dặn đừng nói với ai.",
    correctZone: "REFUSE",
    explanation: "Hai chữ 'đừng nói với ai' là dấu hiệu rõ nhất. Một khoản tiền lớn phải giấu quản lý sẽ đổi cách bạn đối xử với khách đó so với những khách khác. Từ chối và báo FM — báo không phải để tố khách, mà để bảo vệ chính bạn.",
  },
  {
    text: "Khách muốn bạn tới nhà kèm riêng ngoài giờ, trả tiền mặt trực tiếp cho bạn.",
    correctZone: "REFUSE",
    explanation: "Dạy riêng khách của phòng tập, thu tiền ngoài sổ. Vừa lấy khách của nơi trả lương cho mình, vừa tự đặt mình vào một buổi tập không ai giám sát, không có bảo hiểm, không ai làm chứng nếu xảy ra chuyện.",
  },
  {
    text: "Khách đến muộn 40 phút, xin bạn chấm công như bình thường để khỏi mất buổi.",
    correctZone: "REFUSE",
    explanation: "Đây là gian lận số buổi, và số buổi là căn cứ tính lương của chính bạn. Thông cảm cho khách một lần là lần sau không còn lý do nào để từ chối. Từ chối, và nếu khách có lý do chính đáng thì đưa FM quyết định — đó là việc của FM, không phải của bạn.",
  },
  {
    text: "Chồng của một khách hay đưa vợ tới tập, hôm nay xin số điện thoại riêng của bạn để 'tiện hỏi thăm tình hình tập của vợ'.",
    correctZone: "REFUSE",
    explanation: "Thông tin tập luyện của khách chỉ thuộc về khách, kể cả người nhà cũng không có quyền hỏi qua đường riêng. Hướng người đó về số của phòng tập và báo FM. Đây cũng là tình huống dễ đi xa hơn nhiều so với vẻ ngoài của nó.",
  },
  {
    text: "Khách xin số Zalo của bạn để báo trước những hôm đến muộn.",
    correctZone: "ACCEPT",
    explanation: "Liên lạc công việc, đúng mục đích. Không có gì phải cân nhắc — bắt khách gọi qua lễ tân mỗi lần kẹt xe chỉ làm khó cả hai.",
  },
  {
    text: "Buổi tập cuối của gói, khách rủ chụp một tấm ảnh chung ngay giữa sàn.",
    correctZone: "ACCEPT",
    explanation: "Công khai, giữa chỗ đông người, đánh dấu một chặng khách vừa hoàn thành. Từ chối chuyện này chỉ làm khách thấy mình bị giữ khoảng cách vô cớ.",
  },
  {
    text: "Khách hỏi bạn học nghề ở đâu, làm nghề này bao lâu rồi.",
    correctZone: "ACCEPT",
    explanation: "Khách có quyền biết người đang hướng dẫn mình là ai. Trả lời thật, kể cả phần mình còn đang học tiếp.",
  },
  {
    text: "Khách nhắn lời chúc Tết cho bạn cùng lúc với cả nhóm tập.",
    correctZone: "ACCEPT",
    explanation: "Xã giao bình thường. Trả lời lịch sự và ngắn là đủ.",
  },
  {
    text: "Khách mang bánh tới, để ở khu lễ tân cho mọi người cùng ăn.",
    correctZone: "ACCEPT",
    explanation: "Quà chung, đặt ở chỗ chung, không nhắm vào riêng ai. Nhận và cảm ơn thay cả phòng.",
  },
  {
    text: "Khách nhờ bạn giới thiệu một phòng tập uy tín gần nhà mẹ khách ở tỉnh.",
    correctZone: "ACCEPT",
    explanation: "Giúp được thì giúp, và nó không đụng gì tới quyền lợi của phòng — người nhà khách ở tỉnh vốn không phải khách tiềm năng của mình.",
  },
  {
    text: "Khách khen bạn trong bài đánh giá 5 sao trên fanpage của phòng tập.",
    correctZone: "ACCEPT",
    explanation: "Khách tự viết, trên kênh công khai của phòng. Cảm ơn là đủ; xin khách sửa lời hay nhờ viết thêm mới là chuyện khác.",
  },
  {
    text: "Khách rủ bạn cùng chạy một giải phong trào mà cả phòng đã đăng ký.",
    correctZone: "ACCEPT",
    explanation: "Hoạt động tập thể, có tổ chức, nhiều người biết. Đây đúng là loại việc gắn kết khách với phòng tập.",
  },
  {
    text: "Khách hỏi bạn hôm nay ăn gì trước khi tập, vì muốn bắt chước theo.",
    correctZone: "ACCEPT",
    explanation: "Câu hỏi chuyên môn trá hình thôi. Trả lời và nhân đó giải thích vì sao bữa của bạn không nhất thiết hợp với khách.",
  },
  {
    text: "Bạn nghỉ ốm, khách nhắn hỏi thăm rồi đề nghị mang thuốc đến tận nhà.",
    correctZone: "CAUTION",
    explanation: "Lòng tốt thật, nhưng nhận là mở cửa nhà mình cho quan hệ khách hàng bước vào. Cảm ơn, từ chối phần đến nhà, và nói rõ khi nào bạn đi làm lại.",
  },
  {
    text: "Khách xin một tấm ảnh cá nhân của bạn để \"khoe với bạn bè về PT của em\".",
    correctZone: "CAUTION",
    explanation: "Ảnh của bạn đi đâu sau đó thì bạn không kiểm soát được. Đưa ảnh chụp chung ở phòng tập thì được; ảnh riêng thì khéo léo từ chối.",
  },
  {
    text: "Khách khác giới xin đổi sang khung giờ vắng, lúc đó trong phòng chỉ có hai người.",
    correctZone: "CAUTION",
    explanation: "Không sai, nhưng một buổi tập không có người thứ ba là tình huống mà cả hai đều không có ai làm chứng nếu về sau có chuyện. Báo FM để xếp lịch có nhân sự khác cùng ca.",
  },
  {
    text: "Khách mời bạn đi ăn tối, chỉ hai người, để cảm ơn vì đã giúp giảm cân.",
    correctZone: "CAUTION",
    explanation: "Ý tốt nhưng đã ra khỏi khuôn khổ nghề. Đề nghị đổi thành bữa của cả nhóm tập, hoặc cảm ơn và từ chối — cách nào cũng được, miễn là không nhận riêng.",
  },
  {
    text: "Khách nhờ đo mỡ vùng bụng và đùi, yêu cầu đóng cửa phòng đo lại.",
    correctZone: "CAUTION",
    explanation: "Đo là việc chuyên môn và khách có quyền kín đáo. Nhưng cửa đóng kín thì phải có người thứ ba — nhờ đồng nghiệp cùng giới với khách đứng cùng, hoặc để cửa hé.",
  },
  {
    text: "Khách hay chủ động chạm vai, nắm tay bạn mỗi lúc nói chuyện.",
    correctZone: "CAUTION",
    explanation: "Có thể chỉ là thói quen của khách. Nhưng nếu bạn thấy không thoải mái thì phải nói ra sớm, nhẹ nhàng và rõ ràng — để lâu rồi mới phản ứng thì cả hai đều khó xử hơn nhiều.",
  },
  {
    text: "Khách kể chuyện đang ly hôn rồi hỏi bạn nghĩ gì về người chồng cũ của họ.",
    correctZone: "CAUTION",
    explanation: "Lắng nghe được, nhưng đừng phán xét người mình chưa từng gặp. Một câu ghi nhận cảm xúc rồi đưa buổi tập trở lại — bạn là HLV, không phải người phân xử chuyện gia đình khách.",
  },
  {
    text: "Khách xin bạn kèm thêm 15 phút mỗi buổi, miễn phí, vì \"chị quý em\".",
    correctZone: "CAUTION",
    explanation: "Cho một lần là thành lệ, và khách bên cạnh sẽ hỏi vì sao mình không có. Nói rõ buổi tập dài bao nhiêu, còn muốn thêm thì có gói phù hợp — nói sớm thì nhẹ, để lâu mới nói thì thành ra bạn đang rút lại đặc quyền.",
  },
  {
    text: "Mỗi tối khách gửi vài tin nhắn thoại dài kể chuyện trong ngày.",
    correctZone: "CAUTION",
    explanation: "Không có gì sai trong nội dung, nhưng nó đang biến bạn thành chỗ tâm sự ngoài giờ. Đặt một khung giờ trả lời tin nhắn và giữ đúng khung đó với mọi khách.",
  },
  {
    text: "Khách rủ đi cà phê ngoài giờ làm để bàn kỹ hơn về chế độ ăn.",
    correctZone: "CAUTION",
    explanation: "Nội dung chính đáng, bối cảnh thì không. Đề nghị làm việc đó ngay tại phòng tập vào đầu buổi sau — cùng một câu chuyện, khác hẳn về ranh giới.",
  },
  {
    text: "Khách tặng bạn một chiếc áo tập có in sẵn tên bạn.",
    correctZone: "CAUTION",
    explanation: "Món quà được đặt làm riêng thì không còn là quà nhỏ nữa, dù giá tiền không lớn. Cảm ơn, và báo FM biết là mình có nhận — minh bạch từ đầu thì về sau không ai nói được gì.",
  },
  {
    text: "Để chỉnh tư thế hông cho khách, bạn phải chạm vào vùng khá nhạy cảm.",
    correctZone: "CAUTION",
    explanation: "Đây là thao tác chuyên môn có thật, nhưng phải xin phép trước, nói rõ mình sẽ chạm vào đâu và vì sao, và chấp nhận nếu khách từ chối. Còn cách khác thì dùng gậy, dùng gương, hoặc mô tả bằng lời.",
  },
  {
    text: "Khách xin vào danh sách bạn thân trên trang cá nhân của bạn.",
    correctZone: "CAUTION",
    explanation: "Danh sách đó là phần riêng tư nhất của bạn. Không có nghĩa vụ đồng ý; nếu ngại từ chối thẳng thì cứ giữ nguyên tắc chung là không thêm khách vào, áp dụng cho tất cả.",
  },
  {
    text: "Khách hỏi xin số điện thoại của một khách khác tập cùng khung giờ.",
    correctZone: "CAUTION",
    explanation: "Thông tin của người thứ ba không phải của bạn để cho đi. Nói với khách rằng bạn sẽ hỏi ý người kia trước — chuyện đơn giản, nhưng làm sai một lần là mất niềm tin của cả hai.",
  },
  {
    text: "Khách đề nghị trả thêm tiền để bạn kèm riêng vào đúng ngày nghỉ của bạn.",
    correctZone: "CAUTION",
    explanation: "Không phải chuyện bạn tự quyết, kể cả khi bạn muốn làm. Phải qua FM để buổi đó nằm trong hệ thống, có ghi nhận, có bảo hiểm — thu tiền riêng ngoài sổ thì lại là chuyện khác hẳn.",
  },
  {
    text: "Khách nhờ bạn đi cùng tới buổi khám dinh dưỡng ở bệnh viện để nghe hộ.",
    correctZone: "CAUTION",
    explanation: "Việc chính đáng và có ích cho chương trình tập, nhưng nó nằm ngoài giờ và ngoài phạm vi. Báo FM, và nếu đi thì đi với tư cách phòng tập chứ không phải với tư cách cá nhân.",
  },
  {
    text: "Khách nhắn tin tỏ tình với bạn.",
    correctZone: "REFUSE",
    explanation: "Trả lời một lần, dứt khoát và tôn trọng, rồi báo FM ngay — không phải để tố khách mà để có người biết sự việc từ đầu. Xử lý im lặng một mình là cách chắc chắn nhất để nó lớn dần.",
  },
  {
    text: "Khách gửi ảnh hở hang qua tin nhắn, nói là \"để em xem tiến độ\".",
    correctZone: "REFUSE",
    explanation: "Ảnh tiến độ có quy cách riêng và chụp ở phòng tập theo quy trình. Không lưu, không trả lời qua loa, báo FM ngay và ghi lại thời điểm.",
  },
  {
    text: "Khách rủ bạn đi du lịch cùng, mọi chi phí khách trả.",
    correctZone: "REFUSE",
    explanation: "Một chuyến đi do khách chi trả đặt bạn vào thế mắc nợ, và từ đó không còn hướng dẫn khách một cách sòng phẳng được nữa. Từ chối và cho FM biết.",
  },
  {
    text: "Nửa đêm khách gọi điện trong tình trạng có hơi men.",
    correctZone: "REFUSE",
    explanation: "Không nghe, không nhắn lại lúc đó. Sáng hôm sau báo FM và để phòng tập liên hệ chính thức — mọi câu bạn nói trong cuộc gọi ấy đều có thể bị nhớ sai vào hôm sau.",
  },
  {
    text: "Khách đề nghị bạn nghỉ việc để làm HLV riêng cho họ, lương gấp đôi.",
    correctZone: "REFUSE",
    explanation: "Được mời thì không có lỗi, nhưng thương lượng riêng với khách của phòng khi đang ăn lương ở đây thì có. Từ chối tại chỗ và báo FM; muốn đổi việc thì đó là chuyện giữa bạn và công ty, không phải giữa bạn và khách.",
  },
  {
    text: "Khách nhờ bạn giữ hộ một khoản tiền lớn trong vài tuần.",
    correctZone: "REFUSE",
    explanation: "Không có phiên bản nào của việc này an toàn cho bạn. Từ chối thẳng và báo FM để không ai hiểu nhầm về sau.",
  },
  {
    text: "Khách hỏi mượn tiền bạn, hứa trả sau khi lĩnh lương.",
    correctZone: "REFUSE",
    explanation: "Cho mượn là chấm dứt quan hệ nghề nghiệp sòng phẳng: từ hôm đó bạn không dám nhắc khách đi tập đúng giờ nữa. Từ chối và báo FM.",
  },
  {
    text: "Khách gửi cho bạn những tấm ảnh chụp lén bạn trong lúc đang tập.",
    correctZone: "REFUSE",
    explanation: "Chụp lén là hành vi vượt ranh giới, dù người chụp nghĩ là vô hại. Nói rõ mình không đồng ý, yêu cầu xoá, và báo FM ngay để có ghi nhận.",
  },
  {
    text: "Khách yêu cầu bạn không được nhận thêm khách khác vào khung giờ của họ.",
    correctZone: "REFUSE",
    explanation: "Đây là đòi hỏi độc quyền với một nhân sự của công ty, và nó thường là bước đầu của những đòi hỏi lớn hơn. Chuyện lịch là của FM — chuyển thẳng lên, đừng tự thoả thuận.",
  },
  {
    text: "Khách rủ bạn cùng khai gian số buổi để khách được tập bù thêm.",
    correctZone: "REFUSE",
    explanation: "Gian lận số buổi ăn thẳng vào bảng lương và vào doanh thu của phòng. Từ chối và báo FM — đồng ý một lần là từ đó khách nắm được một chuyện của bạn.",
  },
  {
    text: "Khách gạ chia đôi tiền gói bằng cách dùng chung một tài khoản tập.",
    correctZone: "REFUSE",
    explanation: "Hai người tập trên một hợp đồng thì phòng mất một suất, và người không có tên trong hợp đồng thì không được bảo hiểm nếu xảy ra chấn thương. Từ chối và báo FM.",
  },
  {
    text: "Khách nói sẽ tố bạn quấy rối nếu bạn không xin giảm giá gói cho họ.",
    correctZone: "REFUSE",
    explanation: "Đây là đe doạ, không phải thương lượng. Không trả lời riêng, không xoá tin nhắn, chụp lại toàn bộ và báo FM ngay lập tức — càng giữ một mình thì bạn càng khó chứng minh về sau.",
  },
  {
    text: "Đồng nghiệp nhờ bạn nói với vợ họ rằng họ đang ở phòng tập, trong khi không phải.",
    correctZone: "REFUSE",
    explanation: "Không phải chuyện của bạn và cũng không phải chuyện nhỏ: bạn đang được nhờ nói dối một người thứ ba. Từ chối, và không cần phải rao chuyện đó cho ai khác.",
  },
];
