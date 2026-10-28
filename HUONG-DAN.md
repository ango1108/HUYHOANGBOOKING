# HUY HOÀNG Football Booking — Hướng dẫn sử dụng (bản mô phỏng cho học phần)

> Đây là website **mô phỏng**, không kinh doanh thật, không có thanh toán thật. Dữ liệu lưu trong trình duyệt (localStorage).

## 1. Cấu trúc thư mục
```
HUYHOANG-Booking/
├─ index.html   → Trang KHÁCH HÀNG
├─ admin.html   → Trang QUẢN TRỊ (không cần đăng nhập, vì chỉ là bản mô phỏng)
├─ style.css, admin.css
├─ data.js      → dữ liệu mẫu + cấu hình + quy tắc liên kết sân 5↔7
├─ script.js    → toàn bộ logic dùng chung (đặt sân, chống trùng, giá, hủy, thống kê…)
├─ user.js      → giao diện khách hàng        admin.js → giao diện quản trị
├─ live3d.js    → trận đấu livestream 3D mô phỏng (trang Giải đấu)
├─ img/         → THƯ MỤC ẢNH THẬT CỦA BẠN (xem HUONG-DAN-ANH.txt và anh-co-san.js trong đó)
└─ assets/      → logo, hình minh họa (SVG), font Inter, icon
```
Muốn đổi hình sân: thay file trong `assets/images/` (giữ nguyên tên file) hoặc sửa đường dẫn ảnh trong `data.js`.

## 2. Cách chạy (không cần biết lập trình)
1. Giải nén cả thư mục `HUYHOANG-Booking` vào máy (vd. `D:\HUYHOANG-Booking`).
2. Cài **VS Code** → vào Extensions, cài **Live Server** (của Ritwick Dey).
3. VS Code: *File → Open Folder* → chọn thư mục `HUYHOANG-Booking`.
4. Chuột phải `index.html` → **Open with Live Server** (trang khách hàng).
5. Mở thêm tab mới, gõ cùng địa chỉ nhưng đổi cuối thành `admin.html` (vd. `http://127.0.0.1:5500/admin.html`) → trang quản trị.
6. Cũng có thể bấm đúp `index.html` để mở thẳng bằng Chrome (vẫn chạy được).

⚠ User và Admin phải mở **cùng một địa chỉ gốc** (cùng cổng) thì mới dùng chung dữ liệu.

## 3. Kiểm tra đồng bộ User ↔ Admin
1. Tab User: chọn sân → đặt → “Giữ chỗ & thanh toán”.
2. Tab Admin → *Đơn đặt sân*: đơn mới hiện ngay (không cần F5), chuông có số đơn chờ.
3. Admin bấm **Xác nhận** → quay lại tab User, mở “Tra cứu đơn” → trạng thái đã đổi.
4. Admin **Hủy** đơn → khung giờ trên lịch sân của User mở lại.

## 4. Tài khoản & dữ liệu mẫu
- Khách demo: số điện thoại **0901234567** (đăng nhập mô phỏng, không mật khẩu).
- Có sẵn 23 sân (20 sân 5 A1–A20 + 3 sân 7 V1–V3), ~250 đơn mẫu, 4 mã khuyến mãi, 4 giải đấu, 6 bài đăng.
- **Khôi phục dữ liệu mẫu**: Admin → *Cài đặt* → “Khôi phục dữ liệu mẫu” (có hộp xác nhận).
- **Sao lưu**: Admin → *Cài đặt* → “Sao lưu ra file JSON”; nhập lại bằng “Nhập file sao lưu”.

## 4b. Tính năng mới trong bản này
- **Sân mở cửa 24/24**: đặt được cả giờ đêm (00:00–24:00), có bộ lọc "Đêm 00:00 – 06:00".
- **Nhận kèo tìm đối → trang thanh toán QR ngay** (`#/doi-thanh-toan/<mã>`): mỗi đội có **60 phút** để cọc (đồng hồ đếm ngược, QR mô phỏng). Quá 60 phút chưa cọc: đội nhận kèo bị loại và kèo mở lại; nếu đội chủ cũng chưa cọc thì cả đơn tự hủy.
- **Giải đấu**: mỗi giải có hình cúp riêng (4 cúp khác nhau, đội đang nâng cúp); nút xem demo mở **livestream 3D mô phỏng**: tỉ số, đồng hồ chạy trực tiếp, đội đang cầm bóng, cú sút nguy hiểm, thống kê, 3 góc camera (Khán đài / Trên cao / Sau gôn).
- **Hover ô giờ trống**: hiện hoạt cảnh 3D cầu thủ sút bóng vào góc cao, thủ môn không bắt được (tự tắt trên điện thoại).
- **Viền neon**: ô giờ thường viền xanh lá neon; ô flash sale viền neon chạy như dòng nước.
- Admin: lịch sân hôm nay tự ẩn giờ đã qua; dữ liệu mẫu dày hơn (~780 đơn).
- **Giá sân đã nâng +50.000đ/giờ ở mọi khung giờ** (sân 5: 150k–210k, sân 7: 330k–430k trước hệ số cuối tuần/lễ).
- **Giờ đêm**: nếu khung giờ đang xem của hôm nay đã qua hết thì có thông báo + nút "Xem ngày mai"; có thêm nhiều đơn đêm mẫu.
- **Rê chuột vào tên sân (lưới) hoặc ảnh thẻ sân**: mô hình sân 3D xoay quanh (khung thành, cột đèn; sân 7 có vạch chia 3 sân 5); thẻ sân nghiêng 3D theo con trỏ.
- **Thư mục img/**: bỏ ảnh thật của sân / giải đấu / trang chủ vào, ghi tên file vào `img/anh-co-san.js` là website tự dùng (chi tiết trong `img/HUONG-DAN-ANH.txt`).
- **Mô hình sân 3D xoay** nay nằm ngay trong ô tên sân (nửa mô hình, không che chữ), cột đèn đã dựng đúng chiều.
- **Video nền trang chủ** (tùy chọn): bỏ `hero.mp4` vào `img/video/` và ghi vào `img/anh-co-san.js`; thêm thư mục ảnh cho Tìm đối, Thành viên, Trang chủ.
- Responsive đã kiểm tra các cỡ 320, 390, 768, 1024, 1440, 1920 px: không tràn ngang.
- Lưu ý: nếu trình duyệt đã chạy bản cũ, trang sẽ tự nạp lại dữ liệu mẫu mới (xóa đơn thử cũ).

## 5. Quy tắc liên kết sân (cốt lõi)
V1 = A1+A2+A3 · V2 = A4+A5+A6 · V3 = A7+A8+A9. Đặt V1 ⇒ A1, A2, A3 bị khóa cùng giờ; đặt A2 ⇒ V1 bị khóa. Hủy đơn chỉ nhả khi không còn đơn nào khác giữ khung giờ đó. Logic nằm ở `HH.findConflicts` trong `script.js` (có chú thích).
Đơn **chiếm lịch**: chờ xác nhận (còn hạn giữ chỗ) và đã xác nhận. Đơn đã hủy / hết hạn giữ chỗ thì không chiếm.

## 6. Chụp ảnh cho báo cáo
Trang chủ, Đặt sân (lưới lịch), Chi tiết sân, Thanh toán QR (mô phỏng), Tìm đối, Giải đấu; Admin: Tổng quan, Đơn đặt sân, Lịch sân, Quản lý sân, Cài đặt. Dùng Windows+Shift+S (hoặc Cmd+Shift+4 trên Mac).

## 7. Bảng kiểm thử
Cột “Cách kiểm” — **Chạy thật** = đã chạy bằng trình duyệt Chromium tự động / bộ test Node (47 test) trong quá trình làm; **Nên tự kiểm** = nhóm nên thao tác lại bằng tay trước khi nộp.

| # | Tình huống | Kỳ vọng | Cách kiểm |
|---|---|---|---|
| 1 | Đặt sân 5 còn trống | Tạo đơn, lịch cập nhật | Chạy thật (test Node + trình duyệt) |
| 2 | Đặt sân 7 còn trống | Tạo đơn, 3 sân 5 thành phần bị khóa | Chạy thật (Node) |
| 3 | Đặt sân 5 khi sân 7 chứa nó đã đặt | Bị từ chối, nêu rõ lý do | Chạy thật (trình duyệt: V1 rồi A2) |
| 4 | Đặt sân 7 khi 1 sân 5 thành phần đã đặt | Bị từ chối | Chạy thật (Node) |
| 5 | Hai khung giờ giao nhau trên cùng sân | Bị từ chối | Chạy thật (Node) |
| 6 | Hai khung giờ liền kề (19–20 và 20–21) | Cho phép | Chạy thật (Node) |
| 7 | Hủy đơn sân 7 | Nhả 3 sân thành phần nếu không còn đơn khác | Chạy thật (Node) |
| 8 | Nhập sai tên/SĐT, giờ kết thúc ≤ bắt đầu, ngày quá khứ | Báo lỗi tiếng Việt | Chạy thật (Node) |
| 9 | Admin xác nhận đơn → User thấy | Đồng bộ | Chạy thật (2 trang cùng trình duyệt) |
| 10 | Admin hủy đơn → lịch mở lại | Đồng bộ | Chạy thật (admin hủy; lịch User: nên tự kiểm bằng mắt) |
| 11 | Admin tắt sân | User không đặt được; đơn cũ giữ nguyên | Chạy thật (tắt sân, đơn cũ còn); phía User: nên tự kiểm |
| 12 | Đổi giá sân | Chỉ đơn mới áp dụng giá mới | Chạy thật (Node + admin) |
| 13 | Khôi phục dữ liệu mẫu | Có hỏi xác nhận, dữ liệu về ban đầu | Chạy thật |
| 14 | F5 trang | Không mất dữ liệu | Chạy thật (Node) |
| 15 | Giao diện điện thoại (390px) | Không tràn ngang | Chạy thật cho các trang chính; nên xem bằng mắt |
| 16 | Nhận kèo tìm đối | Chuyển sang trang QR 60 phút; bấm đã thanh toán; quá 60 phút bị loại | Chạy thật (trình duyệt) |
| 17 | Đặt sân giờ đêm (02:00–04:00) | Tạo đơn bình thường | Chạy thật (trình duyệt) |
| 19 | Thêm ảnh thật qua thư mục img/ | Ảnh có trong danh sách hiện lên, ảnh thiếu dùng ảnh minh họa | Chạy thật (ảnh .png thử) |
| 20 | Responsive 320–1920px | Không tràn ngang, không lỗi console | Chạy thật (kiểm tự động); nên xem bằng mắt |
| 18 | Live 3D, hover sút bóng, viền neon | Hoạt động, không lỗi console | Chạy thật + xem ảnh chụp; nên tự xem chuyển động bằng mắt |

Chưa kiểm: trình duyệt Edge/Firefox/Safari, thiết bị thật, chữ đọc/độ giống mockup từng pixel (chỉ so bằng mắt qua ảnh chụp).

## 8. Giới hạn
- localStorage: chỉ trong 1 trình duyệt/1 máy, không đồng bộ giữa thiết bị; ai mở DevTools cũng sửa được; không chống đặt trùng tuyệt đối khi nhiều thiết bị cùng dùng.
- Không có đăng nhập thật cho admin, không cổng thanh toán thật (QR chỉ minh họa và ghi rõ “mô phỏng”), không gửi SMS/email.
- Hình ảnh là minh họa SVG vẽ sẵn, có thể thay bằng ảnh thật.
- Điểm khác mockup/PDF: tên sân, chính sách hoàn cọc theo **PDF** (A1–A20, V1–V3).

## 9. Hướng phát triển
Backend + CSDL thật (Node/PHP + MySQL), đăng nhập/phân quyền, cổng thanh toán (VNPay/MoMo), gửi SMS/Zalo nhắc lịch, app di động, thống kê nâng cao, đánh giá sân.

## Video nền trang chủ (kiểu swimply.com)
- Video nằm ở `img/video/hero.mp4` (+ `hero.webm` dự phòng), ảnh bìa `img/trang-chu/hero.jpg`; đã khai báo trong `img/anh-co-san.js`.
- Video chạy ngầm, lặp, **tắt tiếng mặc định** (trình duyệt chỉ cho tự phát khi tắt tiếng). Góc phải có 2 nút: **bật/tắt tiếng** và **tạm dừng/phát**. Trên điện thoại nút nằm góc phải phía trên để không bị ô tìm kiếm che.
- Video tự tạm dừng khi cuộn khỏi khu hero; tự bỏ qua nếu máy bật "giảm chuyển động"/tiết kiệm dữ liệu.
- Muốn đổi video: thay file `hero.mp4` (nên dưới 5MB, ~1280px). Muốn bỏ video: comment 2 dòng `video/...` trong `img/anh-co-san.js`.
- Lưu ý bản quyền: ghi nguồn/tác giả video trong báo cáo.

## Cập nhật: ngày báo cáo, âm lượng, nút quản trị, ảnh giải đấu
- **Ngày mô phỏng:** `HH.DEMO_DATE = '2026-10-29'` trong `data.js` → mở web là đang ở ngày 29/10 (đồng hồ giờ vẫn chạy thật). Dữ liệu đặt sân mẫu kéo dài đến 03/11; trang quản trị cũng dùng đúng ngày này và có đầy đủ dữ liệu. Muốn dùng ngày thật: đặt `HH.DEMO_DATE = ''`.
- **Video:** âm lượng cố định 30% khi bật tiếng.
- **Vào trang quản trị:** bấm "Đăng nhập" → nút tím nhỏ "Quản trị" ở góc trái dưới hộp thoại → trang `admin.html` yêu cầu đăng nhập: tài khoản `admin`, mật khẩu `admin123`, hoặc bấm nút "Dùng tài khoản demo". Có nút "Đăng xuất quản trị" ở menu bên trái.
- **Ảnh giải đấu:** `img/giai-dau/T1..T4.jpg` (T1 Huy Hoàng Cup, T2 Sinh viên Bình Thạnh, T3 Office League, T4 Night League). Nhớ ghi nguồn ảnh trong báo cáo.
- **Âm lượng video:** thanh trượt âm lượng hiện cạnh nút loa (mặc định 30%); kéo về 0 là tắt tiếng.

## Cập nhật: bỏ banner demo, ảnh sân thật, đặt cố định, lịch ưu tiên, live preview
- **Banner vàng "website mô phỏng" đầu trang đã bỏ**; thông báo mô phỏng nằm ở chân trang (footer).
- **Ảnh sân thật** – thư mục mới `img/san-thuc-te/`:
  - `luoi/luoi-1.jpg … luoi-6.jpg`: 6 ảnh thẻ sân (dạng lưới), tự chia vòng tròn cho 23 sân (sân thứ n dùng ảnh (n mod 6)+1).
  - `chi-tiet/chi-tiet-1.jpg … chi-tiet-4.jpg`: 4 ảnh ở trang chi tiết, dùng chung mọi sân.
  - Không cần sửa `anh-co-san.js`; thiếu file nào thì dùng ảnh minh họa. Ảnh riêng từng sân (`img/san/A1.jpg`) vẫn được ưu tiên nếu khai báo.
- **Đặt sân cố định** (Thành viên → ô "Sân cố định"): chọn sân, ngày buổi đầu, giờ, số giờ, lặp 4/8/12 tuần; xem trước từng tuần (trống/trùng lịch), có tùy chọn bỏ qua tuần trùng; tạo một loạt đơn (mỗi đơn kiểm tra trùng, kể cả quy tắc sân 5↔7) và có nút "Cọc tất cả (mô phỏng)". Đơn cố định không tự nhả chỗ sau 10 phút và được đặt trước tối đa 120 ngày.
- **Trang Đặt sân** luôn mở ở dạng **Lịch**; chỉ hiện Thẻ sân khi bấm nút "Thẻ sân".
- **Giải đấu**: khung "Xem trực tiếp" có hình mô phỏng (sân, cầu thủ, bảng tỉ số, số người xem); nếu có `img/giai-dau/live.jpg` thì dùng làm ảnh nền.
- **Ảnh đội tìm đối** – thư mục mới `img/tim-doi/doi/`: đặt ảnh theo tên đội viết không dấu nối gạch (vd. `fc-doan-ket.jpg`, `pho-nui-fc.jpg`); danh sách đủ 11 đội mẫu nằm trong `BO-ANH-VAO-DAY.txt`. Đội chưa có ảnh thì dùng ảnh sân / chữ viết tắt.

## Cập nhật: ảnh thật đã gắn vào web + trang Giới thiệu
- **Sân 5** (20 sân): thẻ sân dùng `img/san-thuc-te/luoi/luoi-1..6.jpg` (xoay vòng, có cả sân ngoài trời và trong nhà); trang chi tiết dùng `img/san-thuc-te/chi-tiet/chi-tiet-1..4.jpg`.
- **Sân 7** (V1–V3): có kho ảnh riêng `img/san-thuc-te/san-7/san7-1..3.jpg` (V1→1, V2→2, V3→3; ảnh phụ xoay vòng).
- **Trang Giới thiệu sân bóng** (menu "Giới thiệu", địa chỉ `#/gioi-thieu`): ảnh sân 5, sân 7 và ảnh tiện ích trong `img/tien-ich/` (máy bán nước, phòng tắm, tủ đồ 1–2).
- **Đội tìm đối**: 11 đội mẫu đã có ảnh trong `img/tim-doi/doi/` (5 ảnh gốc dùng lặp lại cho nhiều đội). Muốn đổi ảnh đội, thay file cùng tên.
- Ảnh lấy từ internet: nhớ ghi nguồn trong báo cáo.
- **Trang chi tiết sân** nay có 5 ảnh: 2 ảnh sân (ảnh đầu giống ảnh thẻ sân ở dạng lưới) + 3 ảnh tiện ích (máy bán nước, phòng tắm, tủ đồ), kèm mục "Ảnh sân & tiện ích" ở cuối trang.
- **Avatar tài khoản demo** (Nguyễn Văn A): `img/thanh-vien/avatar.jpg`, hiện ở menu góc phải và khung chào ở trang Thành viên (các tài khoản khác vẫn hiện chữ viết tắt).
- **Khung "CÙNG NHAU RA SÂN"** (trang Tìm đối): ảnh nền `img/tim-doi/bia.jpg`. Đã sửa lỗi CSS khiến ảnh nền không hiện.
