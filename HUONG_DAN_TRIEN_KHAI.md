# HƯỚNG DẪN KẾT NỐI DATABASE SUPABASE & DEPLOY LÊN VERCEL
**Website 3D Phật Giáo "GM TỰ"**

---

Tài liệu này hướng dẫn chi tiết từng bước từ A đến Z dành cho bạn để:
1. Tạo và cấu hình cơ sở dữ liệu **Supabase (Gói Free)**.
2. Bật tính năng xác thực khách ẩn danh (**Anonymous Auth**).
3. Chạy file SQL tạo bảng, chỉ mục và phân quyền bảo mật **Row Level Security (RLS)**.
4. Tạo tài khoản Quản trị viên (**Admin**) cho trang `/admin`.
5. Đẩy code lên **GitHub** và triển khai tự động lên **Vercel**.
6. Cấu hình các biến môi trường (**Environment Variables**) và kiểm tra sau khi website online.

---

## MỤC LỤC
1. [Chuẩn bị](#1-chuẩn-bị)
2. [Bước 1: Tạo Database Supabase](#bước-1-tạo-database-supabase)
3. [Bước 2: Bật tính năng Anonymous Sign-In (Bắt buộc)](#bước-2-bật-tính-năng-anonymous-sign-in-bắt-buộc)
4. [Bước 3: Chạy SQL Migration tạo Database](#bước-3-chạy-sql-migration-tạo-database)
5. [Bước 4: Tạo tài khoản Admin đầu tiên](#bước-4-tạo-tài-khoản-admin-đầu-tiên)
6. [Bước 5: Lấy các khóa kết nối (API Keys)](#bước-5-lấy-các-khóa-kết-nối-api-keys)
7. [Bước 6: Chạy thử trên máy tính (Local Test - Tùy chọn)](#bước-6-chạy-thử-trên-máy-tính-local-test---tùy-chọn)
8. [Bước 7: Đưa mã nguồn lên GitHub](#bước-7-đưa-mã-nguồn-lên-github)
9. [Bước 8: Deploy lên Vercel](#bước-8-deploy-lên-vercel)
10. [Bước 9: Kiểm tra sau khi Deploy thành công](#bước-9-kiểm-tra-sau-khi-deploy-thành-công)
11. [Xử lý các lỗi thường gặp (Troubleshooting)](#xử-lý-các-lỗi-thường-gặp-troubleshooting)

---

## 1. Chuẩn bị

Bạn cần chuẩn bị trước 3 tài khoản miễn phí sau:
- **Supabase**: Đăng ký tại [https://supabase.com](https://supabase.com) (có thể đăng nhập nhanh bằng GitHub).
- **GitHub**: Đăng ký tại [https://github.com](https://github.com).
- **Vercel**: Đăng ký tại [https://vercel.com](https://vercel.com) (nên đăng nhập bằng tài khoản GitHub để đồng bộ nhanh).

---

## Bước 1: Tạo Database Supabase

1. Truy cập [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Nhấn nút **New project** màu xanh ở góc phải.
3. Điền thông tin dự án:
   - **Name**: `gm-tu` (hoặc tên tùy bạn chọn).
   - **Database Password**: Nhập mật khẩu mạnh (ví dụ: `Gmtu@2026DbSecure!`) -> **Lưu lại mật khẩu này ra ghi chú**.
   - **Region**: Chọn `Southeast Asia (Singapore)` để người dùng tại Việt Nam truy cập với tốc độ nhanh nhất.
   - **Pricing Plan**: Chọn **Free** ($0/month).
4. Nhấn **Create new project**. Chờ khoảng 1–2 phút để Supabase chuẩn bị máy chủ PostgreSQL.

---

## Bước 2: Bật tính năng Anonymous Sign-In (Bắt buộc)

Website GM TỰ cho phép người chơi vào chùa như khách vãng lai mà không cần nhập email hay mật khẩu. Để Supabase cấp danh tính bảo mật phía sau:

1. Ở menu bên trái màn hình Supabase, chọn biểu tượng **Authentication** (hình chiếc khiên hoặc chìa khóa).
2. Nhấp vào mục **Providers** (Nhà cung cấp xác thực).
3. Cuộn xuống tìm mục **Anonymous Sign-In**.
4. Gạt công tắc **Enable Anonymous Sign-Ins** sang màu xanh (**ON**).
5. Nhấn **Save**.

---

## Bước 3: Chạy SQL Migration tạo Database

Dự án đã chuẩn bị sẵn toàn bộ cấu trúc bảng, chỉ mục, trigger, hàm RPC và bảo mật RLS trong file:
[`supabase/migrations/20261105000001_initial_schema.sql`](file:///d:/dichuaonlinePRJ/supabase/migrations/20261105000001_initial_schema.sql)

1. Ở menu bên trái Supabase, chọn mục **SQL Editor** (biểu tượng `>_`).
2. Nhấn nút **New query** (Tạo câu truy vấn mới).
3. Mở file [supabase/migrations/20261105000001_initial_schema.sql](file:///d:/dichuaonlinePRJ/supabase/migrations/20261105000001_initial_schema.sql) trên máy của bạn, nhấn `Ctrl + A` để copy toàn bộ nội dung.
4. Dán toàn bộ vào khung soạn thảo SQL của Supabase.
5. Nhấn nút **Run** màu xanh lá (hoặc bấm `Ctrl + Enter`).
6. Khi thấy thông báo `Success. No rows returned` xuất hiện ở góc dưới, các bảng sau đã sẵn sàng:
   - `profiles`: Lưu tên, giới tính, cấp độ hiển thị.
   - `appearances`: Lưu trang phục, màu áo lam, màu da, kiểu tóc, kính.
   - `player_progress`: Lưu danh sách trải nghiệm đã hoàn thành.
   - `rosary_progress`: Lưu tiến trình tràng hạt 108 hạt và số vòng niệm.
   - `player_stats`: Lưu số phút ghé chùa, số lần gặp trụ trì Gia Minh.
   - `player_settings`: Lưu âm lượng nhạc, mức đồ họa, cài đặt chuông.
   - `wishes`: Lưu hoa đăng và lời chúc.
   - `meditation_sessions`: Lưu lịch sử các buổi ngồi thiền.
   - `recovery_codes`: Lưu mã băm SHA-256 để phục vụ chuyển thiết bị.
   - `admin_users`: Danh sách tài khoản quản trị viên.

---

## Bước 4: Tạo tài khoản Admin đầu tiên

Trang `/admin` cho phép quản trị viên xem số lượng khách, thống kê niệm hạt và duyệt xóa hoa đăng.

### Cách 1: Tạo User và cấp quyền Admin qua SQL
Trong **SQL Editor** của Supabase, mở tab mới và chạy đoạn lệnh sau (thay thế email và mật khẩu của bạn):

```sql
-- 1. Tạo user trong hệ thống Auth của Supabase (nếu chưa có)
-- Lưu ý: Bạn có thể vào Authentication -> Users -> Add user -> Create user
-- Hoặc chạy lệnh cấp quyền sau khi đã đăng ký tài khoản admin@gmtu.vn:

INSERT INTO public.admin_users (user_id, role, note)
SELECT id, 'superadmin', 'Quản trị viên trưởng GM TỰ'
FROM auth.users
WHERE email = 'admin@gmtu.vn'
ON CONFLICT (user_id) DO NOTHING;
```

### Cách 2: Tạo thủ công qua giao diện
1. Vào menu **Authentication** -> chọn **Users**.
2. Bấm **Add user** -> chọn **Create user**.
3. Điền Email: `admin@gmtu.vn` (hoặc email của bạn) và Mật khẩu: `AdminPass@2026`.
4. Bấm **Create user**.
5. Copy cột **User UID** vừa tạo (chuỗi dạng `a1b2c3d4-....`).
6. Vào **SQL Editor**, chạy lệnh:
   ```sql
   INSERT INTO public.admin_users (user_id, role, note)
   VALUES ('<dán_user_uid_vào_đây>', 'superadmin', 'Quản trị viên');
   ```

---

## Bước 5: Lấy các khóa kết nối (API Keys)

1. Ở menu bên trái Supabase, nhấn vào biểu tượng bánh răng **Project Settings** (ở góc dưới cùng bên trái).
2. Chọn mục **API** (hoặc **Data API**).
3. Sao chép 3 giá trị sau và lưu tạm ra Notepad:

| Thông số trên Supabase | Tên biến tương ứng | Dùng cho |
| :--- | :--- | :--- |
| **Project URL** (dạng `https://xyz.supabase.co`) | `VITE_SUPABASE_URL` và `SUPABASE_URL` | Frontend & Serverless Function |
| **anon public** (chuỗi dài bắt đầu bằng `eyJ...`) | `VITE_SUPABASE_ANON_KEY` | Frontend Client (Vite) |
| **service_role secret** (chuỗi bắt đầu bằng `eyJ...`) | `SUPABASE_SERVICE_ROLE_KEY` | Backend Serverless (Bảo mật tuyệt đối) |

> [!CAUTION]
> Khóa **service_role** có quyền bỏ qua mọi chính sách RLS. Chỉ dùng để cấu hình trong biến môi trường của Vercel cho Serverless Function (`api/recovery/*`), **tuyệt đối không đưa vào code frontend client**!

---

## Bước 6: Chạy thử trên máy tính (Local Test - Tùy chọn)

Nếu bạn muốn chạy thử nghiệm trên máy trước khi deploy lên internet:

1. Tạo file `.env.local` ở thư mục gốc của dự án (`d:\dichuaonlinePRJ\.env.local`):
   ```env
   VITE_SUPABASE_URL=https://xyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_URL=https://xyz.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```
2. Mở terminal tại thư mục dự án và chạy:
   ```bash
   npm run dev
   ```
3. Mở trình duyệt vào `http://localhost:5173`. Bạn sẽ thấy biểu tượng trạng thái ở góc trên hiển thị: **"Đã đồng bộ"**.

---

## Bước 7: Đưa mã nguồn lên GitHub

1. Khởi tạo Git và commit toàn bộ code (file `.gitignore` đã được cấu hình tự động loại bỏ các file mật khẩu `.env*`):
   ```bash
   git init
   git add .
   git commit -m "feat: Tich hop Supabase va Onboarding GM TU"
   ```
2. Truy cập [https://github.com/new](https://github.com/new) để tạo một repository mới (ví dụ: `gm-tu`).
3. Đẩy code lên GitHub:
   ```bash
   git remote add origin https://github.com/<tai-khoan-cua-ban>/gm-tu.git
   git branch -M main
   git push -u origin main
   ```

---

## Bước 8: Deploy lên Vercel

### Cách triển khai qua giao diện Web Vercel (Khuyến nghị):

1. Truy cập [https://vercel.com/new](https://vercel.com/new).
2. Tìm repository `gm-tu` vừa đẩy lên và bấm **Import**.
3. Tại trang **Configure Project**:
   - **Project Name**: `gm-tu` (hoặc để mặc định).
   - **Framework Preset**: Chọn `Vite`.
   - **Root Directory**: `./` (để trống).
   - **Build Command**: `npm run build` (mặc định).
   - **Output Directory**: `dist` (mặc định).
4. Mở rộng phần **Environment Variables** (Biến môi trường) và thêm lần lượt 4 biến sau:

| Name (Tên biến) | Value (Giá trị từ Bước 5) |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://[mã-dự-án].supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (Khóa anon public) |
| `SUPABASE_URL` | `https://[mã-dự-án].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (Khóa service_role bí mật) |

5. Nhấn nút **Deploy**.
6. Vercel sẽ tự động:
   - Cài đặt thư viện (`npm install`).
   - Kiểm tra mã nguồn và biên dịch (`tsc -b && vite build`).
   - Thiết lập Serverless API routes theo file [vercel.json](file:///d:/dichuaonlinePRJ/vercel.json).
7. Khi thấy pháo hoa chúc mừng xuất hiện, website của bạn đã chính thức hoạt động tại đường dẫn: `https://gm-tu.vercel.app`!

---

## Bước 9: Kiểm tra sau khi Deploy thành công

### 1. Kiểm tra luồng người chơi mới (Onboarding)
- Mở đường dẫn Vercel trong **cửa sổ ẩn danh (Incognito)**.
- Kiểm tra nút "Vào chùa": nút bị mờ (`disabled`).
- Nhập tên (ví dụ: `An Nhiên`) và bấm chọn giới tính `Nữ` hoặc `Nam`.
- Thấy bản xem trước 3D cập nhật ngay lập tức và nút "Vào chùa" sáng lên.
- Bấm "Vào chùa" để vào sân chùa. Ở thanh tiêu đề, kiểm tra thấy badge hiển thị **"Đã đồng bộ"**.

### 2. Kiểm tra tính năng đồng bộ và hoạt động
- Thắp một nén hương hoặc dâng hoa.
- Thả một ngọn hoa đăng trên hồ sen với lời chúc.
- Vào Supabase Dashboard -> **Table Editor** -> kiểm tra bảng `wishes` và `player_progress`: dữ liệu của khách đã được lưu trữ tự động.

### 3. Kiểm tra tính năng Mã khôi phục (Zero-Knowledge)
- Bấm vào nút **Cài đặt** -> chọn **Lưu và khôi phục**.
- Bấm **Tạo mã khôi phục** -> copy mã dạng `GMTU1.xxx`.
- Mở một trình duyệt khác (hoặc trên điện thoại) -> tại màn hình chào, bấm **Khôi phục tiến trình từ mã** -> dán mã -> bấm **Xác nhận khôi phục**.
- Toàn bộ ngoại hình, số hạt tràng hạt và các hoạt động đã hoàn thành sẽ được tải sang thiết bị mới ngay lập tức.

### 4. Kiểm tra trang Quản trị (`/admin`)
- Truy cập `https://<ten-mien-vercel-cua-ban>.vercel.app/admin`.
- Nhập email và mật khẩu Admin đã tạo ở [Bước 4](#bước-4-tạo-tài-khoản-admin-đầu-tiên).
- Đăng nhập thành công và xem bảng thống kê số khách, duyệt xóa các lời chúc hoa đăng.

---

## Xử lý các lỗi thường gặp (Troubleshooting)

### 1. Badge báo "Lưu trên thiết bị" hoặc "Chưa đồng bộ"
- **Nguyên nhân**: Biến môi trường `VITE_SUPABASE_URL` hoặc `VITE_SUPABASE_ANON_KEY` nhập chưa đúng hoặc chưa Redeploy sau khi thêm biến.
- **Cách khắc phục**: Vào Vercel -> Settings -> Environment Variables kiểm tra lại. Sau khi sửa, vào tab **Deployments** -> bấm dấu 3 chấm ở bản deploy mới nhất -> chọn **Redeploy**.

### 2. Lỗi đăng nhập ẩn danh thất bại (`Anonymous sign-ins are disabled`)
- **Nguyên nhân**: Chưa bật tính năng này trong Supabase.
- **Cách khắc phục**: Vào Supabase Dashboard -> **Authentication** -> **Providers** -> gạt bật **Anonymous Sign-In** -> bấm **Save**.

### 3. Không tạo được mã khôi phục Cloud / Báo lỗi 500 tại `/api/recovery/create`
- **Nguyên nhân**: Thiếu biến môi trường `SUPABASE_SERVICE_ROLE_KEY` hoặc `SUPABASE_URL` trên Vercel.
- **Cách khắc phục**: Thêm biến `SUPABASE_SERVICE_ROLE_KEY` và redeploy lại Vercel.

### 4. Lỗi "CORS policy: No 'Access-Control-Allow-Origin' header"
- **Cách khắc phục**: Vào Supabase Dashboard -> **Authentication** -> **URL Configuration** -> Thêm domain Vercel của bạn (ví dụ `https://gm-tu.vercel.app`) vào danh sách **Redirect URLs**.

### 5. Supabase Free Tier bị tạm dừng (Paused) sau thời gian không hoạt động
- **Lưu ý của gói Free**: Nếu một project không có truy vấn nào trong vòng 7 ngày, Supabase sẽ tạm dừng máy chủ để tiết kiệm tài nguyên.
- **Cách khắc phục**: Khi bị dừng, bạn chỉ cần đăng nhập vào Supabase Dashboard và nhấn nút **Restore Project** là database sẽ hoạt động lại bình thường trong vòng 1 phút mà không mất bất kỳ dữ liệu nào.

