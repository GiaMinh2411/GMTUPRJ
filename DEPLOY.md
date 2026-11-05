# Hướng dẫn Triển khai GM TỰ trên Vercel và Supabase (Gói Free)

Tài liệu này hướng dẫn chi tiết từng bước thiết lập dự án Supabase, chạy migration cơ sở dữ liệu, kích hoạt Anonymous Auth và cấu hình triển khai website 3D "GM TỰ" trên nền tảng Vercel.

---

## 1. Chuẩn bị tài nguyên

1. **Tài khoản Supabase**: Đăng ký miễn phí tại [https://supabase.com](https://supabase.com).
2. **Tài khoản Vercel**: Đăng ký miễn phí tại [https://vercel.com](https://vercel.com).
3. **Mã nguồn dự án**: Đảm bảo repository đã có đầy đủ mã nguồn từ thư mục hiện tại.

---

## 2. Thiết lập dự án Supabase

### Bước 2.1: Tạo Project mới
1. Đăng nhập Supabase Dashboard -> nhấn **New project**.
2. Chọn Organization của bạn.
3. Nhập tên dự án: `gm-tu` (hoặc tên tùy chọn).
4. Nhập mật khẩu Database an toàn (lưu lại mật khẩu này).
5. Chọn vùng (Region): Khuyến nghị `Southeast Asia (Singapore)` để có độ trễ thấp nhất về Việt Nam.
6. Chọn gói dịch vụ: **Free Plan**.
7. Nhấn **Create new project** và đợi 1–2 phút cho cụm máy chủ khởi tạo.

### Bước 2.2: Lấy thông tin kết nối API
Vào **Project Settings** (biểu tượng bánh răng ở góc dưới bên trái) -> chọn **API**:
1. `Project URL`: dạng `https://[your-project-ref].supabase.co`
2. `Project API Keys`:
   - `anon` `public`: Khóa công khai dùng cho frontend (Vite).
   - `service_role` `secret`: Khóa đặc quyền dùng riêng cho Vercel Serverless Functions (`api/recovery/*`). **Tuyệt đối không để lộ khóa này ở client!**

### Bước 2.3: Bật Anonymous Sign-In (Xác thực khách ẩn danh)
1. Trong menu bên trái, vào **Authentication** -> **Providers**.
2. Tìm mục **Anonymous Sign-In**.
3. Bật công tắc **Enable Anonymous Sign-Ins** sang trạng thái **ON**.
4. Nhấn **Save**.
> Cơ chế này cho phép người chơi vào chùa với tư cách khách (guest) mà không cần nhập email hay mật khẩu, đồng thời vẫn có `auth.uid()` độc lập để áp dụng Row Level Security (RLS).

---

## 3. Khởi tạo Cơ sở Dữ liệu & RLS Policies (Migration)

1. Trong Supabase Dashboard, chọn mục **SQL Editor** ở thanh điều hướng bên trái.
2. Nhấn **New query**.
3. Mở file [supabase/migrations/20261105000001_initial_schema.sql](file:///d:/dichuaonlinePRJ/supabase/migrations/20261105000001_initial_schema.sql) trong dự án, sao chép toàn bộ nội dung và dán vào SQL Editor.
4. Nhấn nút **Run** (hoặc tổ hợp phím `Ctrl + Enter`).
5. Kết quả hiển thị `Success. No rows returned` nghĩa là tất cả các bảng, enum, chỉ mục, trigger, hàm RPC và chính sách RLS đã được tạo hoàn tất:
   - Các bảng chính: `profiles`, `appearances`, `player_progress`, `rosary_progress`, `player_stats`, `player_settings`, `wishes`, `meditation_sessions`, `recovery_codes`, `admin_users`.
   - RPC Functions: `sync_player_bundle()`, `fn_register_recovery_code()`, `fn_redeem_recovery_code()`, `is_admin()`.

---

## 4. Tạo tài khoản Quản trị viên (Admin) đầu tiên

Để đăng nhập vào trang `/admin`, bạn cần kích hoạt một người dùng làm Admin:

### Cách thực hiện qua SQL:
Trong **SQL Editor**, chạy đoạn mã sau (thay thế email của bạn):

```sql
-- Giả sử bạn đăng ký một tài khoản email qua Supabase Auth (Authentication -> Users -> Add User)
-- Sau khi tạo user trong Authentication, lấy ID hoặc email và cấp quyền admin:
INSERT INTO public.admin_users (user_id, role, note)
SELECT id, 'superadmin', 'Quản trị viên trưởng'
FROM auth.users
WHERE email = 'admin@gmtu.vn'
ON CONFLICT (user_id) DO NOTHING;
```

Nếu bạn dùng cơ chế đăng nhập email/mật khẩu trực tiếp cho admin, vào **Authentication** -> **Users** -> **Add user** -> nhập email `admin@gmtu.vn` và mật khẩu -> nhấn **Create user**. Sau đó chạy câu lệnh SQL trên.

---

## 5. Triển khai lên Vercel

### Bước 5.1: Import Project vào Vercel
1. Truy cập [https://vercel.com/new](https://vercel.com/new).
2. Kết nối Git Provider (GitHub/GitLab/Bitbucket) và chọn repo `dichuaonlinePRJ`.
3. Cấu hình Project:
   - **Framework Preset**: Chọn `Vite` (hoặc `Other`).
   - **Root Directory**: `./` (để trống hoặc giữ mặc định).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Bước 5.2: Khai báo Biến môi trường (Environment Variables)
Trong mục **Environment Variables** trên Vercel, thêm các biến sau:

| Tên biến | Giá trị mẫu | Phạm vi | Mô tả |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview, Dev | URL dự án Supabase cho Client |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Production, Preview, Dev | Anon Public Key cho Client |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview, Dev | URL dự án cho Vercel Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Production, Preview, Dev | Service Role Secret Key cho Serverless Functions |

> [!WARNING]
> Biến `SUPABASE_SERVICE_ROLE_KEY` KHÔNG có tiền tố `VITE_`. Vercel sẽ tự động bảo mật biến này và chỉ cung cấp cho các serverless functions trong thư mục `api/`. Client frontend sẽ không thể đọc được khóa này.

### Bước 5.3: Nhấn Deploy
1. Nhấn nút **Deploy**.
2. Vercel sẽ tự động cài đặt gói, chạy `tsc -b && vite build`, đóng gói các serverless function (`/api/recovery/create`, `/api/recovery/redeem`) và cấu hình routing theo [vercel.json](file:///d:/dichuaonlinePRJ/vercel.json).
3. Khi hoàn tất, Vercel sẽ cấp domain công khai dạng `https://gm-tu.vercel.app`.

---

## 6. Kiểm tra & Nghiệm thu sau triển khai

Sau khi trang web đã online:

1. **Khách mới (Onboarding)**:
   - Mở trình duyệt ẩn danh (Incognito).
   - Nút "Vào chùa" bị mờ (disabled).
   - Nhập tên hiển thị (từ 2 đến 30 ký tự tiếng Việt có dấu, ví dụ: "Bình An").
   - Chọn giới tính "Nam" hoặc "Nữ" -> bản xem trước 3D chuyển đổi mượt mà.
   - Nhấn "Vào chùa" -> người chơi vào cổng tam quan, badge góc trên hiển thị trạng thái đồng bộ ("Đã đồng bộ" hoặc "Lưu trên thiết bị").
2. **Khách quay lại**:
   - Tải lại trang (F5) -> hiển thị lời chào "Chào mừng trở lại, Bình An!", giới tính đã chọn và nút chuyển thành "Tiếp tục".
   - Bấm "Tiếp tục" vào chơi ngay lập tức không cần gõ lại.
3. **Chuyển thiết bị bằng Mã khôi phục bí mật (Zero-knowledge)**:
   - Vào Cài đặt -> Lưu và khôi phục -> nhấn "Tạo mã khôi phục".
   - Sao chép mã có tiền tố `GMTU1.xxxx`.
   - Mở thiết bị hoặc trình duyệt khác -> bấm "Khôi phục tiến trình" tại màn hình chào -> dán mã -> xác nhận khôi phục -> toàn bộ tiến trình, tràng hạt, lời chúc và ngoại hình được nạp chính xác.
4. **Bảng điều khiển Quản trị (`/admin`)**:
   - Truy cập `https://your-domain.vercel.app/admin`.
   - Đăng nhập bằng tài khoản admin đã tạo ở Bước 4.
   - Xem thống kê tổng quan (số người chơi, hoa đăng đã thả, tổng số chuỗi hạt, phiên thiền).
   - Duyệt và kiểm duyệt lời chúc hoa đăng; tìm kiếm người chơi theo ID/tên.

---

## 7. Xử lý sự cố thường gặp (Troubleshooting)

| Hiện tượng | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Badge báo "Lưu trên thiết bị" liên tục** | Chưa cấu hình biến môi trường hoặc Supabase URL sai. | Kiểm tra biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong Settings -> Environment Variables trên Vercel. Sau khi cập nhật, cần **Redeploy** lại project. |
| **Lỗi Anonymous Sign-In bị từ chối** | Chưa bật Anonymous Auth trong Supabase. | Vào Supabase Dashboard -> **Authentication** -> **Providers** -> bật **Anonymous Sign-In**. |
| **Vercel Build báo lỗi TypeScript** | Xung đột phiên bản type hoặc thiếu dependencies. | Chạy lệnh `npx tsc --noEmit` ở máy cục bộ để kiểm tra chi tiết. Đảm bảo file `package.json` có `@supabase/supabase-js` và `@vercel/node`. |
| **Khôi phục qua Cloud báo "Mã khôi phục không tồn tại"** | Thiếu biến `SUPABASE_SERVICE_ROLE_KEY` trên Vercel hoặc migration hàm RPC chưa chạy. | Kiểm tra `SUPABASE_SERVICE_ROLE_KEY` trong Vercel Environment Variables. Kiểm tra xem file migration SQL đã chạy thành công trong SQL Editor chưa. |
| **Không đăng nhập được trang `/admin`** | User chưa được thêm vào bảng `admin_users`. | Chạy câu lệnh SQL `INSERT INTO public.admin_users (user_id, role) VALUES ('<user-uuid>', 'superadmin');` trong Supabase SQL Editor. |
| **Lỗi CORS khi gọi Supabase** | Domain của Vercel bị chặn trong Supabase API Settings. | Vào Supabase Dashboard -> **Authentication** -> **URL Configuration** -> thêm domain Vercel của bạn vào **Redirect URLs**. |
| **RLS Policy chặn ghi (Error 42501)** | User khách chưa có session anonymous hợp lệ hoặc RLS policy bị thiếu. | Hàm `getOrCreateGuestSession()` tự động khởi tạo Anonymous session trước mỗi lần sync. Đảm bảo toàn bộ lệnh `CREATE POLICY` trong migration đã được thực thi. |

