import { destinations, type Destination } from './npc-data';
export type DialogueTopic={id:string;question:string;answer:string;destinations?:Destination[]};
export const dialogueTopics:DialogueTopic[]=[
 {id:'intro',question:'Giới thiệu về GM TỰ.',answer:'GM TỰ là không gian mô phỏng chùa Việt để thư giãn và trải nghiệm văn hóa. Tôi là Gia Minh, nhân vật trụ trì hư cấu. Bạn đang khám phá một mình; không cần đăng nhập.'},
 {id:'offerings',question:'Hướng dẫn thắp hương và dâng hoa.',answer:'Đến gần lư hương trước chính điện rồi nhấn E hoặc nút tương tác. Bàn dâng hoa nằm bên phải: chọn một loài hoa để đặt lên bàn. Các thao tác là trải nghiệm mô phỏng.',destinations:[destinations.incense,destinations.flowers]},
 {id:'beads',question:'Hướng dẫn lần tràng hạt.',answer:'Mở Tràng hạt ở thanh hoạt động. Kéo dọc vòng để lần, kéo ngược để lùi; hoặc dùng Lần một hạt/Space. Một vòng có 108 hạt đếm, hạt chủ không tính. Bảng lưu tổng hạt riêng trên trình duyệt.'},
 {id:'meditation',question:'Hướng dẫn ngồi thiền.',answer:'Đến vườn thiền, tương tác và chọn 1, 3 hoặc 5 phút. Thả lỏng vai, thở tự nhiên. Bạn có thể kết thúc bất cứ lúc nào; chỉ hoàn thành đủ thời lượng mới ghi nhận buổi thiền.',destinations:[destinations.meditate]},
 {id:'lantern',question:'Cách gửi lời chúc và thả hoa đăng.',answer:'Đến bờ hồ sen, nhập lời chúc tối đa 150 ký tự rồi Thả hoa đăng. Bạn có thể xem lại lời chúc trong bảng đó. Lời chúc lưu riêng trên trình duyệt và có trong mã khôi phục do bạn tạo.',destinations:[destinations.lantern]},
 {id:'progress',question:'Cách lưu và khôi phục tiến trình.',answer:'Tiến trình tự lưu trên trình duyệt này. Trong Cài đặt, mở Lưu và khôi phục để tạo mã; giữ mã riêng, rồi dán mã vào trình duyệt khác để khôi phục. Mã chứa hồ sơ và lời chúc, không phải mật khẩu. Hiện chưa có đồng bộ đám mây.'},
 {id:'peace',question:'Cho tôi một lời nhắn bình an.',answer:'Bạn có thể dừng lại một chút, thả lỏng đôi vai và dành cho mình một nhịp thở nhẹ nhàng. Không cần vội hoàn thành điều gì ở đây. Đây là lời nhắn của nhân vật Gia Minh, không phải trích dẫn kinh văn.'},
 {id:'bye',question:'Tạm biệt.',answer:'Chúc bạn một chuyến dạo bước nhẹ nhàng. Khi cần hướng dẫn, bạn có thể quay lại tìm tôi.'},
];
