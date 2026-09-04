import type { SortCardSeed } from "./types";

export const INTRO = "Mỗi thẻ là một dấu hiệu từ phía khách. Ba vùng ở vòng này đọc theo mức phải can thiệp:\n\n• Chấp nhận — chuyện bình thường, xử lý gọn trong buổi tập.\n• Cần cẩn trọng — phải chủ động làm gì đó và ghi lại, đừng ngồi chờ khách quay lại.\n• Từ chối & báo FM — không được để im và không tự ôm. Đẩy lên FM ngay.\n\nKhách hiếm khi bỏ tập vì bận. Họ bỏ vì thấy vô ích, hoặc vì thấy không ai để ý\nlà mình đã vắng.\n\nXếp lệch một bậc còn nửa điểm. Xếp lệch hai bậc thì mất hết điểm của thẻ đó.";

export const CARDS: SortCardSeed[] = [
  {
    text: "Khách báo trước hai ngày là tuần này đi công tác, xin nghỉ 3 buổi.",
    correctZone: "ACCEPT",
    explanation: "Có báo trước, có lý do rõ ràng. Xếp lại lịch bù và gửi vài bài tập tự làm nếu khách muốn. Khách chủ động báo là dấu hiệu tốt, đừng biến nó thành chuyện phải xử lý.",
  },
  {
    text: "Khách vẫn tập đủ 6 buổi/tuần, tuần này xin đổi giờ từ sáng sang tối.",
    correctZone: "ACCEPT",
    explanation: "Đổi giờ mà vẫn giữ tần suất thì không phải dấu hiệu gì cả. Chốt lịch mới ngay trong lúc nhắn, đừng để trôi thành \"khi nào rảnh em báo\".",
  },
  {
    text: "Khách hỏi tuần sau nghỉ lễ phòng có mở cửa không.",
    correctZone: "ACCEPT",
    explanation: "Trả lời, và chốt luôn lịch bù trong chính câu trả lời đó. Kỳ nghỉ là chỗ nhiều khách rơi ra khỏi thói quen nhất — một tin nhắn có ngày giờ cụ thể giữ được cả tháng sau.",
  },
  {
    text: "Khách vắng 2 buổi liên tiếp không báo. Tin nhắn của bạn đã xem nhưng chưa trả lời.",
    correctZone: "CAUTION",
    explanation: "Gọi điện, đừng chỉ nhắn thêm tin thứ ba. Ghi vào ghi chú khách. Hai buổi im lặng là mốc sớm nhất mà mọi thứ còn kéo lại được — đến buổi thứ năm thì câu trả lời thường đã là lời từ chối lịch sự.",
  },
  {
    text: "Khách đi đều nhưng cân không đổi suốt 3 tuần và bắt đầu ít nói hẳn trong buổi tập.",
    correctZone: "CAUTION",
    explanation: "Đặt lại buổi đo, xem lại nhật ký ăn, và nói thẳng về con số thay vì động viên chung chung. Khách im lặng khi kết quả đứng yên là bước ngay trước khi họ nghỉ, không phải sau.",
  },
  {
    text: "Gói L2 của khách còn 20 buổi nhưng chỉ còn 18 ngày là hết hạn.",
    correctZone: "CAUTION",
    explanation: "Nói với khách ngay hôm nay, đưa phương án tăng tần suất hoặc xin FM về bảo lưu, gia hạn. Để tới ngày cuối mới báo thì chắc chắn thành khiếu nại, và khiếu nại đó bạn không cãi được câu nào.",
  },
  {
    text: "Khách nhắn: \"Chị bận quá, để tháng sau chị tập lại nhé.\"",
    correctZone: "CAUTION",
    explanation: "Đừng gật cho qua. Hẹn một buổi có ngày giờ cụ thể, dù chỉ 30 phút nhẹ. \"Tháng sau\" không kèm ngày là một lời tạm biệt lịch sự, và cả hai bên đều biết điều đó.",
  },
  {
    text: "Bạn đang có 12 khách, trong đó 3 người bạn đã không nhắn gì suốt 10 ngày.",
    correctZone: "CAUTION",
    explanation: "Đặt một khung giờ cố định trong tuần để rà lại toàn bộ danh sách, và báo FM nếu thật sự quá tải. Chăm tốt 9 người là đáng khen, nhưng mất 3 người thì vẫn là mất 3 người.",
  },
  {
    text: "Khách vắng 3 tuần, gọi không nghe, nhắn không trả lời. Gói vẫn còn 30 buổi.",
    correctZone: "REFUSE",
    explanation: "Không tự ôm thêm nữa: báo FM để phòng tập liên hệ qua kênh khác. Ba tuần im lặng nghĩa là khách đã đi rồi, và 30 buổi còn lại là một khoản trách nhiệm của công ty chứ không phải chuyện riêng của bạn.",
  },
  {
    text: "Khách nói muốn dừng hẳn vì \"không hợp\" nhưng không nói rõ không hợp chỗ nào.",
    correctZone: "REFUSE",
    explanation: "Không xử lý một mình. Báo FM và xin một buổi có FM ngồi cùng. \"Không hợp\" gần như luôn là cách nói giảm cho một chuyện cụ thể — có thể là bạn, có thể không — và người trong cuộc thường là người khó hỏi ra nhất.",
  },
  {
    text: "Khách xin bảo lưu vô thời hạn vì lý do cá nhân.",
    correctZone: "REFUSE",
    explanation: "PT không quyết được bảo lưu: mỗi gói có quy định riêng, L5 có 2 lần miễn phí tối đa 30 ngày mỗi lần. Gật đầu cho khách yên lòng rồi để FM từ chối sau là đẩy đồng nghiệp vào thế khó và làm khách mất niềm tin hai lần.",
  },
  {
    text: "Bạn nhận ra mình đã quên không check-out cho khách suốt 5 buổi liền.",
    correctZone: "REFUSE",
    explanation: "Báo FM ngay kèm bằng chứng buổi tập, đừng lặng lẽ bấm bù cho đủ. Buổi dạy không có check-out là buổi không có bằng chứng — bấm bù sau lưng quản lý biến một chuyện đãng trí thành một chuyện gian lận bảng lương.",
  },
  {
    text: "Khách nhắn xin đổi buổi vì con ốm, và đề nghị luôn ngày bù cụ thể.",
    correctZone: "ACCEPT",
    explanation: "Có lý do, có phương án, có ngày. Chốt lịch bù và đi tiếp — đây là khách đang giữ cam kết của họ.",
  },
  {
    text: "Khách hỏi xin vài bài tự tập cho chuyến du lịch một tuần.",
    correctZone: "ACCEPT",
    explanation: "Gửi bài không cần dụng cụ và hẹn ngày về tập lại. Khách hỏi trước khi đi là dấu hiệu tốt nhất mà bạn có thể mong.",
  },
  {
    text: "Khách tập đều và hỏi khi nào tới lịch đo lại chỉ số.",
    correctZone: "ACCEPT",
    explanation: "Xếp lịch đo ngay trong lúc trả lời. Khách chủ động hỏi số liệu là khách đang gắn bó với chương trình.",
  },
  {
    text: "Khách xin một bảng theo dõi cân nặng để tự ghi ở nhà.",
    correctZone: "ACCEPT",
    explanation: "Gửi và hướng dẫn cách ghi cho nhất quán. Khách tự theo dõi được thì tỉ lệ bỏ giữa chừng giảm hẳn.",
  },
  {
    text: "Khách báo tuần sau chuyển sang ca đêm, muốn cố định một khung giờ mới.",
    correctZone: "ACCEPT",
    explanation: "Báo trước và muốn cố định là hai dấu hiệu tốt. Xếp lịch mới ngay, đừng để trống chờ khách nhắn lại.",
  },
  {
    text: "Khách hỏi phòng có nhóm chat của lớp không để rủ bạn bè tập cùng.",
    correctZone: "ACCEPT",
    explanation: "Trả lời và kết nối khách vào. Người có bạn tập cùng bỏ tập ít hơn hẳn người tập một mình.",
  },
  {
    text: "Khách nhắn khoe hôm nay đi bộ được 10.000 bước.",
    correctZone: "ACCEPT",
    explanation: "Phản hồi ngay, dù chỉ một câu. Đây chính là lúc rẻ nhất để củng cố thói quen — im lặng thì lần sau khách không khoe nữa.",
  },
  {
    text: "Khách hỏi tối về muộn thì nên ăn gì cho hợp chế độ.",
    correctZone: "ACCEPT",
    explanation: "Câu hỏi chuyên môn thẳng thắn, trả lời trong khung giờ nhắn tin bình thường. Nó cũng cho bạn biết lịch sinh hoạt thật của khách để chỉnh giáo án.",
  },
  {
    text: "Khách hoàn thành 100% số buổi của tháng này.",
    correctZone: "ACCEPT",
    explanation: "Ghi nhận rõ ràng với khách và với FM. Việc đi đủ buổi vốn là chuyện khó, và người làm được cần biết là có ai đó đếm.",
  },
  {
    text: "Khách bắt đầu đi muộn 15–20 phút mỗi buổi, tuần thứ hai liên tiếp.",
    correctZone: "CAUTION",
    explanation: "Muộn đều là dấu hiệu lịch tập không còn khớp với đời sống của khách, chứ hiếm khi là chuyện kỷ luật. Hỏi thẳng và xếp lại giờ trước khi nó thành nghỉ hẳn.",
  },
  {
    text: "Khách huỷ buổi ngay sát giờ, hai lần trong cùng một tuần.",
    correctZone: "CAUTION",
    explanation: "Gọi điện chứ đừng nhắn. Hỏi thật lý do và ghi lại — hai lần huỷ sát giờ trong một tuần là mốc mà can thiệp còn dễ.",
  },
  {
    text: "Khách buột miệng: \"Dạo này chị chán tập quá.\"",
    correctZone: "CAUTION",
    explanation: "Đừng bỏ qua như một câu than vãn. Hỏi chán phần nào — bài tập, kết quả, hay giờ giấc — rồi đổi đúng phần đó ngay trong buổi sau.",
  },
  {
    text: "Khách bỏ hẳn việc ghi nhật ký ăn dù trước đó ghi rất đều.",
    correctZone: "CAUTION",
    explanation: "Thường là dấu hiệu khách đang ăn lệch và ngại ghi ra. Hỏi nhẹ, giảm yêu cầu xuống mức làm được (chụp ảnh bữa thay vì ghi số), và ghi vào ghi chú khách.",
  },
  {
    text: "Khách chỉ tới tập vào những hôm bạn nhắc, không hôm nào tự tới.",
    correctZone: "CAUTION",
    explanation: "Nhắc thì vẫn nhắc, nhưng phải bắt đầu chuyển dần sang thói quen của chính khách: chốt khung giờ cố định, đặt mốc nhỏ, cho khách tự báo. Nhắc mãi mà không chuyển giao là bạn đang giữ khách bằng sức của mình.",
  },
  {
    text: "Khách xin đổi sang PT khác nhưng chưa nói lý do.",
    correctZone: "CAUTION",
    explanation: "Đừng níu và cũng đừng tự ái. Hỏi một câu chân thành để hiểu, rồi chuyển FM xử lý. Lý do khách nói ra ở phút đó thường là thứ giá trị nhất bạn học được trong tháng.",
  },
  {
    text: "Gói của khách còn 3 buổi và khách chưa hề nhắc gì tới gói tiếp theo.",
    correctZone: "CAUTION",
    explanation: "Chủ động nói trước, kèm nhìn lại kết quả đã đạt. Để tới buổi cuối mới mở lời là vừa mất khách vừa làm khách thấy mình chỉ được quan tâm khi sắp phải trả tiền.",
  },
  {
    text: "Khách chuyển nhà, giờ đi tới phòng mất 45 phút mỗi chiều.",
    correctZone: "CAUTION",
    explanation: "Đây là lý do bỏ tập phổ biến nhất và nó có thật. Xếp lại giờ cho tránh cao điểm, gộp buổi, hoặc bàn phương án phù hợp — và báo FM sớm.",
  },
  {
    text: "Bạn quên chúc mừng sinh nhật một khách đã tập với mình hai năm.",
    correctZone: "CAUTION",
    explanation: "Nhắn muộn còn hơn không, và tự lập một danh sách nhắc cho lần sau. Những chi tiết nhỏ như thế chính là thứ giữ người ta ở lại qua các gói.",
  },
  {
    text: "Khách vắng đúng vào tuần phòng có sự kiện mà cả nhóm tham gia.",
    correctZone: "CAUTION",
    explanation: "Hỏi han riêng, gửi ảnh sự kiện, giữ khách trong mạch chung của nhóm. Bỏ lỡ dịp tập thể là lúc người ta dễ thấy mình đứng ngoài nhất.",
  },
  {
    text: "Khách nhắn hỏi có cách nào rút ngắn gói lại không.",
    correctZone: "CAUTION",
    explanation: "Câu hỏi này gần như luôn có nghĩa là khách đang muốn dừng. Hỏi lý do thật trước khi trả lời về thủ tục, và báo FM.",
  },
  {
    text: "Bạn vừa nhận thêm mấy khách mới và thấy mình ít thời gian cho khách cũ hẳn.",
    correctZone: "CAUTION",
    explanation: "Nhận ra sớm là tốt. Đặt lại lịch chăm sóc cố định trong tuần, và nếu thật sự quá tải thì báo FM trước khi mất người — khách cũ ra đi rất lặng lẽ.",
  },
  {
    text: "Khách tập rất đều nhưng không bao giờ trả lời tin nhắn giữa các buổi.",
    correctZone: "CAUTION",
    explanation: "Không phải ai cũng thích nhắn tin, và tập đều mới là thước đo quan trọng hơn. Nhưng hãy hỏi khách muốn liên lạc kiểu gì, rồi theo đúng cách đó — đừng cứ nhắn vào chỗ không ai đọc.",
  },
  {
    text: "Khách kể rằng người nhà không ủng hộ việc đi tập.",
    correctZone: "CAUTION",
    explanation: "Đây là lý do bỏ tập rất mạnh mà PT hay bỏ qua. Không bình luận về gia đình khách; thay vào đó giúp khách có kết quả nhìn thấy được và giờ tập ít ảnh hưởng tới nhà.",
  },
  {
    text: "Bạn thấy một khách của mình đang tự tập ở khu tự do vào ngày không có lịch.",
    correctZone: "CAUTION",
    explanation: "Ghé qua chào và xem qua kỹ thuật — vừa giữ quan hệ, vừa tránh chấn thương do tập sai lúc không có ai kèm. Nhưng đừng biến nó thành một buổi dạy miễn phí.",
  },
  {
    text: "Khách nhắn: \"Chị bỏ cuộc rồi, em xoá tên chị đi.\"",
    correctZone: "REFUSE",
    explanation: "Không xoá, không trả lời cụt lủn, và không tự xử lý một mình. Báo FM ngay và xin một cuộc gọi — câu này gần như luôn được nhắn ra trong một lúc rất tệ, chứ không phải một quyết định đã cân nhắc.",
  },
  {
    text: "Khách vắng 5 buổi liên tiếp trong khi gói sắp hết hạn.",
    correctZone: "REFUSE",
    explanation: "Vượt xa mốc tự xử lý. Báo FM để tính chuyện bảo lưu hoặc gia hạn trước khi hết hạn — im lặng tới ngày cuối là biến một khách đang khó khăn thành một vụ khiếu nại.",
  },
  {
    text: "Bạn định tự đánh dấu khách là đã nghỉ để khỏi phải theo dõi nữa.",
    correctZone: "REFUSE",
    explanation: "Đây là xoá một người khỏi trách nhiệm của mình bằng thao tác trên hệ thống. Trạng thái khách là dữ liệu công ty dùng để ra quyết định — báo FM để họ quyết, đừng tự dọn.",
  },
  {
    text: "Khách nói sẽ khiếu nại vì gói hết hạn mà vẫn còn rất nhiều buổi chưa tập.",
    correctZone: "REFUSE",
    explanation: "Không hứa gì về gia hạn hay hoàn buổi. Ghi lại toàn bộ lịch sử buổi tập và những lần đã nhắc, rồi chuyển FM ngay trong ngày.",
  },
  {
    text: "Khách bị chấn thương ở ngoài phòng tập và từ đó không đi tập nữa.",
    correctZone: "REFUSE",
    explanation: "Báo FM để xử lý bảo lưu và giữ quyền lợi cho khách. Đây không phải chuyện chăm sóc thông thường nữa mà là chuyện hợp đồng — và cũng đừng tự tư vấn phục hồi chấn thương.",
  },
  {
    text: "Một khách đã ngừng tập cả tháng, bạn định không báo FM vì ngại bị hỏi.",
    correctZone: "REFUSE",
    explanation: "Giấu một khách đang rơi là để nó thành mất hẳn, và lúc lộ ra thì vừa mất khách vừa mất tin tưởng. Báo sớm thì còn là một ca cần hỗ trợ; báo muộn thì thành lỗi của bạn.",
  },
  {
    text: "Khách nhắn đòi lại tiền vì \"đăng ký xong chẳng có ai quan tâm\".",
    correctZone: "REFUSE",
    explanation: "Không thương lượng về tiền và cũng đừng biện minh dài dòng. Ghi lại nguyên văn, tập hợp lịch sử liên lạc của mình, và chuyển FM ngay.",
  },
  {
    text: "Bạn định nhờ đồng nghiệp nhắn tin chăm khách của mình suốt cả tháng.",
    correctZone: "REFUSE",
    explanation: "Nhờ một hôm thì được, nhờ cả tháng là giao phần việc của mình cho người khác mà không ai đồng ý. Quá tải thì nói với FM để chia lại khách cho đúng.",
  },
  {
    text: "Khách kể mình đang trầm cảm và không muốn ra khỏi nhà.",
    correctZone: "REFUSE",
    explanation: "Vượt hẳn phạm vi của HLV. Giữ liên lạc một cách tử tế, không ép đi tập, không tư vấn tâm lý, và báo FM ngay để công ty xử lý cho đúng mực.",
  },
  {
    text: "Bạn quên hẳn một khách suốt ba tuần và bây giờ mới nhớ ra.",
    correctZone: "REFUSE",
    explanation: "Đừng lặng lẽ nhắn một câu bình thường như chưa có gì. Nhận thiếu sót với khách, và báo FM — ba tuần bỏ trống là chuyện phòng tập cần biết, kể cả khi khách quay lại.",
  },
  {
    text: "Khách đã chuyển tiền gia hạn nhưng bạn quên báo quầy suốt một tuần.",
    correctZone: "REFUSE",
    explanation: "Tiền của khách nằm ngoài sổ suốt một tuần là chuyện phải báo ngay, không phải chuyện lặng lẽ sửa cho khớp. Báo FM và lễ tân, kèm mốc thời gian thật.",
  },
  {
    text: "Bạn định ghi khống vài buổi tập cho một khách đã nghỉ để số liệu đỡ xấu.",
    correctZone: "REFUSE",
    explanation: "Ghi khống buổi dạy ăn thẳng vào bảng lương và làm hỏng chính con số dùng để phát hiện khách sắp rơi. Đây không còn là lười biếng nữa.",
  },
  {
    text: "Khách nhắn báo sẽ chuyển sang một phòng tập gần nhà hơn.",
    correctZone: "REFUSE",
    explanation: "Không giữ bằng cách nói xấu chỗ kia, và cũng không im lặng cho qua. Báo FM để công ty có cơ hội đưa phương án, rồi dù khách vẫn đi thì chia tay tử tế — họ sẽ giới thiệu người khác.",
  },
  {
    text: "Bạn định để một khách khó tính hết hạn gói mà không nhắc trước.",
    correctZone: "REFUSE",
    explanation: "Cố ý im lặng để khỏi phải nói chuyện với một người mình ngại. Hậu quả rơi vào phòng tập chứ không rơi vào bạn — và đó chính là chỗ tệ nhất của việc này.",
  },
];
