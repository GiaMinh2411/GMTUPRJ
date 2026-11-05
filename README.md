# GM TỰ

Website chùa Việt 3D một người chơi, React + Vite + TypeScript + React Three Fiber. Toàn bộ tên hiển thị là **GM TỰ**, gồm tiêu đề, metadata, logo, bảng cổng, menu và hộp thoại. Không cần tài khoản/backend.

## Nhạc nền hiện tại

Đã thêm **Thiền Tịnh Tâm Remix** từ tệp MP3 người dùng cung cấp vào `public/audio/thien-tinh-tam-remix.mp3` (3.753.838 byte). Mỗi lần nhấn **Vào chùa** sẽ bật và phát nhạc ngay trong thao tác người dùng, kể cả trước đó đã tắt tiếng. Giữ âm lượng dương đã chọn; nếu lưu 0% thì khôi phục 50% khi vào chùa. Sau khi vào, vẫn có **Phát nhạc**, **Tạm dừng**, tắt toàn bộ và thanh **Âm lượng nhạc nền** riêng. Không tự phát khi chỉ mới tải trang. Nhạc tiếp tục khi mở/đóng tràng hạt hoặc đổi nhân vật rồi vào lại, không tạo thêm player.

`public/audio/chant.json` hiện có `kind: "music"`, `available: true`. Loại `chant` vẫn được hỗ trợ khi sau này có bản kinh Sanskrit phù hợp. Giữ tên cấu hình và khóa `chantVolume` nội bộ để tương thích dữ liệu cũ; giao diện hiển thị **Nhạc nền** theo loại bản ghi.

Nguồn: `Thiền Tịnh Tâm Remix Hưng Hack Nhạc Phật Tộn Kinh Remix Cực Hot Trend Tik Tok 2023.mp3`, do người dùng cung cấp từ máy của họ. Tên Hưng Hack chỉ lấy theo tên tệp. Chưa có thông tin giấy phép phân phối công khai hoặc xác minh ngôn ngữ; không gắn nhãn bản kinh Sanskrit hoặc giấy phép mở cho tệp này.

Kiểm tra tệp thật trong `tests/music.spec.ts`: **2/2 đạt** trên Edge desktop và viewport cảm ứng 390 × 844. HTTP 200/206 với Content-Type `audio/mpeg`, giải mã được, thời lượng hợp lệ và thời gian phát tăng; phát lặp, tạm dừng, bật/tắt, âm lượng 0/khôi phục và giữ một player khi mở tràng hạt đều đạt. Bản sao có SHA-256 giống tệp người dùng cung cấp. Đây là kiểm tra trình phát/giải mã, chưa phải đánh giá chất âm bằng nghe trực tiếp trên thiết bị vật lý.

Cập nhật font và tự phát khi vào chùa: **4/4 kiểm tra** trong `tests/music.spec.ts` và `tests/typography.spec.ts` đạt. Đã xác nhận player tự chạy từ lựa chọn cũ tắt tiếng/0%, giữ âm lượng dương, vào lại không phát chồng. Kiểm tra font qua Chromium DevTools Protocol xác nhận các glyph thực sự dùng Noto Serif cho tiêu đề thường/nghiêng và chú thích cảnh; các tệp WOFF2 tải cùng website. Ảnh đối chiếu trong `test-results/heading-*.png`, `test-results/caption-font.png`.

## Chạy tại máy

Node.js 20.19+ hoặc 22.12+ và npm:

```sh
npm install
npm run dev
npm run build
npm run preview
```

Mở địa chỉ Vite hiển thị, thường `http://localhost:5173`. `build` kiểm tra TypeScript rồi xuất `dist/`. Có thể host tĩnh toàn bộ thư mục này. Với đường dẫn con, đặt `base` tương ứng trong `vite.config.ts`; URL audio dùng `import.meta.env.BASE_URL`, không gắn cứng đường dẫn từ gốc domain. Điện thoại cùng mạng LAN dùng IP máy chạy Vite nếu tường lửa cho phép.

## Nguyên nhân loa không phát kinh và cách sửa

Source trước đây **không có bản ghi kinh, không có HTMLAudioElement và không có đường dẫn kinh**. Loa chỉ điều khiển một AudioContext phát tiếng gió tổng hợp và các hiệu ứng. Vì thế không có bản kinh nào để nút loa phát; đây không phải lỗi đổi biểu tượng, âm lượng hay CORS của một tệp kinh có sẵn.

`src/audio-engine.ts` hiện duy trì một player duy nhất, độc lập với render và bảng tràng hạt. Player gọi `play()` trực tiếp trong thao tác người dùng; xử lý Promise từ chối; cập nhật trạng thái qua `playing`, `pause`, `waiting`, `stalled`, `error`. Chỉ báo **Đang phát** sau sự kiện `playing`. Khi lỗi, kiểm tra HTTP/Content-Type/HTML rơi vào đường dẫn media và hiển thị thông báo + Thử lại. Bản ghi phát lặp, có tạm dừng, âm lượng kinh riêng và tắt toàn bộ. Môi trường và hiệu ứng dùng hai GainNode riêng, không dừng hoặc thay nguồn của player kinh. Không tự phát khi mới tải trang chỉ vì lựa chọn bật đã lưu. Quay lại từ ứng dụng khác đối chiếu trạng thái thật; nếu cần sẽ yêu cầu nhấn phát tiếp.

Bản ghi được nối một lần qua `MediaElementAudioSourceNode → GainNode` khi Web Audio có sẵn để điều chỉnh âm lượng kinh, thay vì chỉ phụ thuộc `HTMLMediaElement.volume`. Cách này tính đến [giới hạn volume trên iOS trong hướng dẫn Safari của Apple](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html). Khi AudioContext bị khóa/gián đoạn, giao diện yêu cầu nhấn phát tiếp. Chưa xác nhận bằng thiết bị iPhone vật lý.

### Nguồn kinh hiện tại: chưa có

**Chưa cung cấp bản ghi kinh tiếng Phạn đã xác minh quyền phân phối và ngôn ngữ.** Bản đang hoạt động là nhạc remix nói trên, hiển thị **Nhạc nền**. Nếu cấu hình `kind: "chant"`, `available: false`, giao diện báo **Chưa có bản ghi kinh tiếng Phạn**. Không có file giả/rỗng hoặc âm thanh tổng hợp được gắn nhãn bản kinh.

Đã tìm nguồn công khai nhưng không đưa các bản Hindu/khác ngôn ngữ hoặc bản có thông tin quyền chưa đủ rõ vào một website chùa Việt. Giấy phép của một văn bản kinh cũng không tự cấp quyền đối với bản ghi âm của người biểu diễn.

Để bổ sung bản thật:

1. Đặt bản ghi Phật giáo Sanskrit có quyền sử dụng tại `public/audio/sanskrit-chant.mp3`.
2. Sửa `public/audio/chant.json`: `available: true`, `kind: "chant"`, `src: "sanskrit-chant.mp3"`, tên thật ở `title`, `language: "sa"`, tác giả/đơn vị ở `credit`, giấy phép ở `license`, trang nguồn ở `sourceUrl`.
3. Ghi tên bản, người đọc, nguồn, giấy phép, xác minh ngôn ngữ và thay đổi nếu có trong README; giữ giấy phép kèm theo khi được yêu cầu.
4. Build/deploy cả `dist/audio/`. Nhấn loa/Phát kinh; kiểm tra HTTP 200/206, Content-Type audio, thời lượng > 0, `currentTime` tăng và **nghe trực tiếp** để xác nhận nội dung và âm lượng.

Chi tiết ở [public/audio/README.md](public/audio/README.md). MP3 là lựa chọn thuận tiện giữa Chrome/Edge/Safari; không dùng một bản Pali, Hán, Hindi hoặc Tây Tạng rồi gọi là tiếng Phạn. Âm lượng kinh 0% và tắt toàn bộ được hiển thị rõ; không báo đang nghe được khi không có nguồn hoặc âm lượng 0.

## Tràng hạt 3D và cách đếm

- Mở **Tràng hạt**: bảng có Canvas riêng hiển thị vòng 3D, 108 hạt gỗ có hình học lỗ xỏ, một hạt chủ, dây và tua. Hạt chủ không tham gia bộ đếm. Hạt đếm dùng instancing; dây nằm trên cùng đường cong với hạt.
- Chế độ **Lần hạt**: nhấn/chạm giữ trên vành chuỗi rồi kéo dọc vòng. Kéo một khoảng bằng một hạt tăng một lượt; kéo dài lần nhiều hạt; kéo ngược giảm tương ứng, không xuống dưới 0. Nhấn/chạm không kéo không cộng.
- Pointer capture giữ thao tác khi ngón tay ra khỏi vùng; `pointercancel`, mất focus hoặc đổi chế độ kết thúc kéo. Không lưu trạng thái kéo dở. Chỉ vùng cảnh/vòng chặn cuộn; các bảng dài vẫn cuộn nội bộ.
- Khi thả, phần chuyển động chưa hoàn tất trở về vị trí hạt đã qua điểm đếm; chuyển động khớp vị trí không sinh lượt mới. Đây là chuyển động được kiểm soát theo đường cong, không phải mô phỏng dây/vật rắn hoàn chỉnh. Ưu tiên không phát sinh lượt do quán tính.
- **Xoay góc nhìn** tách riêng: kéo để nhìn vòng, không cộng/trừ. Chuyển về Lần hạt đưa góc nhìn về mặt chuẩn.
- **Lần một hạt** hoặc **Space** chuyển đúng một hạt. Bỏ qua `repeat`, không đếm trong input/textarea/select/contenteditable và khi hộp thoại khác đang mở. Không dùng đồng thời touch/click để đếm hai lần.
- Dữ liệu gốc duy nhất là `beadTotal`. `0 → 107 → 108` hiển thị hoàn thành vòng 1 ở 108/108; lượt sau là 1/108, tổng 109. Kéo ngược 109 → 108 → 107 cập nhật vòng tương ứng. Vị trí chuỗi suy ra từ tổng, chủ động bỏ qua hạt chủ khi qua vòng.
- Đặt lại cần xác nhận. Lưu khi đếm và khi thao tác kết thúc; tải lại khôi phục tổng và vị trí, không khôi phục lực kéo. Tùy chọn tiếng hạt và rung nhẹ chỉ có tác dụng nếu trình duyệt hỗ trợ.

## Cảnh, nhân vật và điều khiển

Cảnh đã thay hình học/bố cục: cổng tam quan có bảng GM TỰ, chính điện hai mái cong, cửa/cột, bậc thềm, sân ghép đá, hành lang, tháp chuông, vườn thiền, hồ sen có cầu. Bề mặt gỗ, ngói, đá, đồng, vải, lá và tường có bản đồ màu/normal/roughness procedural gốc. Ánh sáng trung tính, bóng theo chất lượng và sương khoảng xa; không dùng ảnh chùa làm nền thay cảnh 3D.

### NPC Trụ trì Gia Minh
- Đứng bên cạnh tượng Phật tại chính điện (`x: 3.4, y: 0.5, z: -9.5`), đầu trọc, gương mặt hiền hòa, nụ cười an tịnh, mặc áo cà sa màu vàng đất/nâu vàng xếp nếp tự nhiên, đeo chuỗi hạt trước ngực và mang dép đơn giản.
- Animation tự nhiên: đứng thở nhẹ, chớp mắt, chắp tay và cử động miệng khi trò chuyện. Khi người chơi bước tới gần trong bán kính 3.2m, NPC xoay nhẹ người hướng về phía người chơi và chắp tay chào.
- Bảng tên Billboard 3D phía trên đầu hiển thị: **Gia Minh** và nhãn phụ **Trụ trì**, tự động xoay hướng camera, dễ đọc trên máy tính lẫn điện thoại, tự làm mờ/ẩn theo khoảng cách và bị che khi khuất tường (`occlude`).
- Vùng va chạm vật lý hình trụ riêng biệt (`radius = 0.45m`), ngăn người chơi đi xuyên qua NPC.
- Tương tác kịch bản 8 chủ đề: Giới thiệu GM TỰ, Hướng dẫn thắp hương & dâng hoa, Hướng dẫn lần tràng hạt, Hướng dẫn ngồi thiền, Cách gửi lời chúc & thả hoa đăng, Cách lưu và khôi phục tiến trình, Lời nhắn bình an, Tạm biệt.
- Hỗ trợ nút **Chỉ đường** đánh dấu waypoint và chỉ mục tiêu trên bản đồ/la bàn dẫn đường, không tự dịch chuyển người chơi.

### Nhân vật nữ cho người chơi
- Lựa chọn giới tính **Nam** và **Nữ** ngay tại màn hình chào và trong mục *Cài đặt → Chỉnh sửa ngoại hình*.
- Tỷ lệ cơ thể nữ tự nhiên: chiều cao 1.67m, vai thon 0.91, hông 1.04, colliderRadius 0.27m, cameraHeight 1.29m.
- Trang phục đi chùa trang nghiêm: Áo lam hoặc Áo dài tay kết hợp quần dài lịch sự với 4 màu nhã nhặn (Nâu, Xám, Be, Xanh nhạt) và 3 tông da.
- 5 kiểu tóc thanh lịch: Tóc ngắn, Tóc rẽ ngôi, Tóc ngang vai, Tóc dài buộc thấp, Búi gọn cùng 4 màu tóc và tùy chọn kính mắt.
- Khung xem trước 3D xoay tự do (drag rotation), cập nhật trực tiếp theo lựa chọn.
- Hỗ trợ đổi ngoại hình an toàn trong lúc chơi tại vị trí hợp lệ (`nearbySafePosition`), tự động hủy an toàn các thao tác đang thực hiện trước khi đổi model.

- Máy tính: WASD/mũi tên, kéo cảnh để xoay, con lăn zoom, E tương tác.
- Điện thoại: joystick bên trái, tương tác bên phải, kéo cảnh để xoay và chụm hai ngón để zoom. Các vùng điều khiển dùng pointer riêng; có thể vừa di chuyển vừa xoay.
- Khi mở tràng hạt hoặc trò chuyện NPC, khóa di chuyển/camera cảnh sau. Đóng bảng giữ tiến trình và khôi phục tư thế hiện hành.
- Camera kiểm tra giao cắt với mái/tường/biển cổng, rút gần khi bị chắn. Nhân vật có vùng chặn vật lớn; chiều cao mặt đất theo nền, bậc thềm và cầu.
- Năm hoạt động: thắp hương, thỉnh chuông (chờ 4 giây), dâng hoa, thiền 1/3/5 phút, hoa đăng với lời chúc tối đa 150 ký tự. Nút chào, tùy chọn ngoại hình và xem trước vẫn có.

## Đồ họa và lưu dữ liệu

| Mức | Bề mặt | Bóng | DPR tối đa | Tán gần |
|---|---|---|---|---|
| Thấp | 128px | Tắt | 1 | 100 lá/cây |
| Vừa | 256px | 1024px | 1.25 | 180 lá/cây |
| Cao | 512px | 2048px | 1.75 | 300 lá/cây |

Mọi chức năng vẫn có ở mức thấp. Dùng instancing cho 108 hạt, ngói, lá và đá sân. Hạn chế khói/đèn; bộ nhớ vật liệu và hình học được dọn khi thay mức hoặc bỏ component. Không có bộ lọc hậu kỳ nặng hoặc texture 4K tải ngoài.

Mức thấp cũng tắt bản đồ phản chiếu môi trường để tiết kiệm GPU; mức vừa/cao dùng ánh sáng môi trường PBR tạo cục bộ. Mặt nước có biến dạng đỉnh và pháp tuyến nhẹ theo thời gian.

Giữ nguyên khóa `an-nhien-v1` để bảo toàn dữ liệu: tên, ngoại hình, hương, hoa, lời chúc, trải nghiệm, tổng hạt và tùy chọn. Thêm ba âm lượng, mức đồ họa và rung; mặc định đọc từ lựa chọn cũ khi có. `localStorage` chỉ lưu **trên cùng trình duyệt**, không đồng bộ giữa máy tính/điện thoại. Xóa dữ liệu trình duyệt sẽ mất tiến trình. Không gửi lời chúc lên máy chủ. Khi không lưu được, có thông báo và phiên vẫn tiếp tục.

## Tài nguyên và giấy phép

- Hình học, texture procedural, logo, bảng cổng, nhân vật, nhịp chuyển động, gió, tiếng chuông và tiếng hạt do mã nguồn dự án tạo; không dùng model/texture/audio từ website khác. Các hiệu ứng tổng hợp là hiệu ứng, không được giới thiệu là kinh.
- Nhạc nền MP3 hiện tại do người dùng cung cấp, thông tin nguồn và tình trạng giấy phép được ghi ở đầu README và trong `public/audio/README.md`. Các tệp WAV giả lập chỉ tạo trong bộ nhớ để kiểm thử, không đưa vào public/dist.
- Font **Noto Serif Variable** (tiêu đề, chữ nghiêng và bảng cổng) và **Noto Sans Variable** (giao diện), qua Fontsource; đóng gói WOFF2 Latin/Vietnamese trong bản build, không tải font từ Google/CDN lúc chạy. Noto Project Authors, giấy phép SIL OFL 1.1; văn bản giấy phép kèm trong `public/fonts/`. Các ký tự tiếng Việt và chữ Latin dùng cùng bộ font, hạn chế lỗi trộn font và cắt dấu. `src/typography.css` khai báo các mặt chữ/Unicode; `src/temple-sign.tsx` vẽ lại texture cổng sau khi font thực sự tải xong.
- Lucide: [ISC](https://github.com/lucide-icons/lucide/blob/main/LICENSE). React, Three.js, React Three Fiber và Vite: MIT; TypeScript và Playwright: Apache-2.0. Phiên bản khóa trong `package-lock.json`.

## Kiểm tra

Chạy Vite ở terminal riêng, sau đó:

```sh
npx playwright test --workers=1
npm run build
```

`playwright.config.ts` dùng Edge có sẵn ở đường dẫn Windows thông dụng và WebGL phần mềm. Đổi `executablePath` hoặc dùng Chromium do Playwright cài trên môi trường khác.

- `tests/companions.spec.ts`: kiểm tra toàn diện NPC Gia Minh (nam/nữ gặp Gia Minh, 8 nhánh hội thoại, chỉ đường, giữ nhạc nền, không bị che tường khi đứng gần, che đúng khi đứng xa/qua tường) và nhân vật nữ (đổi ngoại hình tại chỗ nhiều lần, khôi phục hồ sơ trên trình duyệt khác, joystick và cảm ứng).
- `tests/experience.spec.ts`: vào chùa, di chuyển/va chạm, toàn bộ năm hoạt động cả nam máy tính và nữ cảm ứng (đủ 1 phút thiền thực), giữ tư thế thiền khi mở tràng hạt, lưu dữ liệu, joystick, mức đồ họa và thông báo không hỗ trợ WebGL.
- `tests/realism.spec.ts`: ranh giới và kéo tràng hạt thật qua Pointer Events, quay ngược/0, chạm không kéo, nhiều hạt, thả chưa đủ một hạt, Space/giữ phím, đặt lại, bảo toàn dữ liệu, resize và native touch qua Chromium DevTools Protocol; kiểm tra player chạy tệp WAV thử nghiệm, thời gian tăng, một player xuyên suốt, âm lượng 0, HTTP 404, HTML sai đường dẫn, trình duyệt từ chối phát và thiếu file.
- `tests/music.spec.ts`: kiểm tra MP3 người dùng phát thật và giữ player trên máy tính và điện thoại.
- `tests/typography.spec.ts`: kiểm tra font tiếng Việt Noto Serif / Noto Sans trên máy tính và điện thoại.
- Ảnh QA trong `test-results/`. Kích thước đại diện: 360, 390, 430, 768, 1024, 1440 và ngang 844 × 390. Viewport giả lập và WebGL phần mềm không thay thế điện thoại vật lý.

Kết quả xác minh toàn diện (24/24 kiểm tra đạt):

- TypeScript và `npm run build`: đạt. Bundle chính khoảng 344 kB gzip; không có lỗi build.
- `tests/companions.spec.ts`: **6/6 đạt** (Gia Minh, 8 nhánh hội thoại, chỉ đường, giữ nhạc, đổi ngoại hình an toàn nhiều lần, khôi phục profile).
- `tests/experience.spec.ts`: **4/4 đạt** (nam máy tính & nữ cảm ứng hoàn thành 5 hoạt động, WebGL unsupported check, mobile controls).
- `tests/realism.spec.ts`: **10/10 đạt** (shader/ba mức đồ họa, tràng hạt 3D, âm thanh qua bộ trộn, cảm ứng hai tay, pinch, pointercancel).
- `tests/music.spec.ts`: **2/2 đạt** (phát thật MP3 trên desktop & mobile).
- `tests/typography.spec.ts`: **2/2 đạt** (font Noto thực tế trên desktop & mobile).
- Môi trường: Microsoft Edge headless trên Windows, WebGL ANGLE/SwiftShader; cảm ứng qua CDP. Đã xem ảnh tổng thể, nhân vật và tràng hạt trên máy tính/điện thoại giả lập.

## Các tệp chính được thay đổi

| Tệp | Nội dung |
|---|---|
| `src/gia-minh.tsx`, `src/npc-data.ts`, `src/npc-range.ts` | NPC trụ trì Gia Minh: mesh 3D, animation chắp tay chào/thở/chớp mắt/nói, billboard nametag, va chạm |
| `src/dialogue.tsx`, `src/dialogue-data.ts`, `src/navigation.tsx` | Hệ thống kịch bản hội thoại 8 chủ đề, HUD chỉ đường mục tiêu, lưu trạng thái xem hướng dẫn |
| `src/human.tsx`, `src/appearance.tsx`, `src/appearance-config.ts` | Nhân vật 3D nam/nữ, tỷ lệ cơ thể nữ, 5 kiểu tóc, áo lam/dài tay, xem trước xoay 3D |
| `src/profile.ts`, `src/profile-transfer.tsx` | Khôi phục & di trú hồ sơ, mã Unicode chia sẻ không cần mạng, tương thích ngược hồ sơ cũ |
| `src/main.tsx`, `src/world-data.ts` | Tích hợp NPC, chuyển đổi nhân vật tại chỗ an toàn, joystick mượt, collider cột/hồ tối ưu |
| `src/environment.tsx`, `src/materials.ts`, `src/sky-lighting.tsx`, `src/temple-sign.tsx` | Kiến trúc mới, cây/cầu/hồ, PBR procedural, ánh sáng, nước và bảng cổng chờ font |
| `src/rosary-panel.tsx`, `src/rosary-object.tsx`, `src/bead-geometry.ts`, `src/rosary-gesture.ts`, `src/rosary-progress.ts` | Vòng 3D, lỗ xỏ, chủ/tua, kéo xuôi/ngược, đếm/lưu |
| `src/audio-engine.ts`, `src/audio-panel.tsx`, `public/audio/` | Player duy nhất, ba GainNode, trạng thái/lỗi và cấu hình bản kinh |
| `src/realism.css`, `src/typography.css`, `src/companions.css` | Giao diện hội thoại NPC, bộ chọn nhân vật nam/nữ, font tiếng Việt, responsive/safe area |
| `tests/`, `README.md` | Bộ 24 bài kiểm tra tự động bao phủ toàn diện tính năng, tài liệu và giới hạn |

Các component cảnh/nhân vật chibi và bảng hạt SVG cũ đã được thay thế; khóa lưu dữ liệu cũ vẫn giữ nguyên.

Chưa nghe kiểm chứng một bản kinh thực; chưa nghiệm thu Safari/iPhone, Chrome/Android vật lý, cuộc gọi/khóa màn hình hoặc hiệu năng GPU thực. Hình học tự dựng và chuyển động được kiểm soát còn giới hạn so với asset quét ảnh, rig chuyên nghiệp và mô phỏng dây đầy đủ. Build có thể cảnh báo bundle Three.js > 500 kB; đó không phải lỗi TypeScript.

Không gian mô phỏng để thư giãn và trải nghiệm văn hóa chùa Việt. Không quy đổi số hạt thành công đức hoặc cam kết kết quả tâm linh.
