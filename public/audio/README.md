# Âm thanh nền GM TỰ

## Bản đang dùng

`thien-tinh-tam-remix.mp3` là bản sao nguyên vẹn của tệp người dùng cung cấp: `Thiền Tịnh Tâm Remix Hưng Hack Nhạc Phật Tộn Kinh Remix Cực Hot Trend Tik Tok 2023.mp3` (3.753.838 byte).

Tên hiển thị: **Thiền Tịnh Tâm Remix**. Loại: **Nhạc nền** (`kind: "music"`). Tên Hưng Hack lấy từ tên tệp, chưa được xác minh độc lập. Tệp không kèm thông tin giấy phép; không xác nhận đây là bản ghi Sanskrit hoặc tác phẩm thuộc giấy phép mở. Ghi rõ nguồn người dùng cung cấp trong manifest.

Nhấn Vào chùa sẽ tự bật và phát nhạc. Âm lượng dương đã lưu (`chantVolume`) được giữ; 0% sẽ được khôi phục 50% khi vào chùa. Sau đó có thể tắt, tạm dừng, lặp và điều chỉnh âm lượng Nhạc nền. Không phát chỉ vì mới tải trang. Nút vào chùa chờ tải xong cấu hình nhạc để lời gọi phát vẫn nằm trực tiếp trong thao tác người dùng; nếu tải cấu hình lỗi, vẫn cho vào cảnh và báo lỗi âm thanh.

## Thay bản nhạc

Đặt tệp trong `public/audio/`, cập nhật `chant.json` với `available: true`, `kind: "music"`, tên tệp ở `src`, tên bài ở `title` và thông tin nguồn/giấy phép đúng với bản ghi. Đường dẫn không chứa thư mục Downloads và hoạt động cả sau build. `language: "und"` có nghĩa chưa xác định ngôn ngữ.

## Nếu dùng bản kinh tiếng Phạn

Chưa có bản kinh đã được xác minh riêng; nhạc remix hiện tại được hiển thị đúng là nhạc nền.

1. Đặt bản ghi Phật giáo **tiếng Phạn (Sanskrit)** có quyền phân phối tại `public/audio/sanskrit-chant.mp3`. Ưu tiên MP3; AAC/M4A cũng được nếu trình duyệt hỗ trợ.
2. Trong `chant.json`, đặt `available: true`, `kind: "chant"`, `src: "sanskrit-chant.mp3"`, `title` là tên thật, `language: "sa"`, `credit` là nghệ sĩ/đơn vị, `license` là giấy phép, `sourceUrl` là trang nguồn. Không gắn nhãn Sanskrit cho bản tiếng Pali, Hán, Tây Tạng hoặc Hindi.
3. Ghi nguồn, giấy phép, ngôn ngữ và các thay đổi trong README; giữ giấy phép đi kèm nếu được yêu cầu.
4. Chạy/build lại. Bấm Phát kinh; kiểm tra HTTP 200/206, Content-Type audio, thời lượng, `currentTime` tăng và nghe kiểm chứng nội dung.

Đường dẫn dùng Vite `BASE_URL`, hỗ trợ deploy ở thư mục con. Deploy cả `dist/audio/`. Trình phát không tự phát lại chỉ vì trước đó đã lưu trạng thái bật. Với `available: false`, giao diện báo thiếu theo loại nhạc/bản kinh được cấu hình.
