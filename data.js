/* ==========================================================================
   HUY HOÀNG Football Booking — data.js
   DỮ LIỆU MẪU + CẤU HÌNH + QUY TẮC LIÊN KẾT SÂN.
   Đây là file bạn sẽ sửa nhiều nhất khi muốn đổi giá, tên sân, giờ mở cửa…
   (Sau khi sửa, vào Admin → Cài đặt → "Khôi phục dữ liệu mẫu" để dữ liệu mới có hiệu lực.)
   ========================================================================== */
(function (g) {
  'use strict';
  var HH = g.HH = g.HH || {};

  /* ---- 1. TÊN CÁC KHÓA localStorage (index.html và admin.html dùng CHUNG) ---- */
  HH.KEYS = {
    courts: 'hh_courts_v1',           // danh sách 23 sân + giá + trạng thái hoạt động
    bookings: 'hh_bookings_v1',       // danh sách đơn đặt sân
    config: 'hh_config_v1',           // cấu hình quy tắc (cọc, giữ chỗ, flash sale, dịch vụ…)
    promos: 'hh_promos_v1',           // mã khuyến mãi
    tournaments: 'hh_tournaments_v1', // giải đấu
    posts: 'hh_posts_v1',             // bài đăng tìm người / cầu thủ tự do
    members: 'hh_members_v1',         // thành viên + điểm uy tín
    session: 'hh_session_v1',         // "đăng nhập" mô phỏng của trình duyệt này
    meta: 'hh_meta_v1'                // thông tin phiên bản dữ liệu
  };

  /* ---- 2. GIỜ MỞ CỬA ---- */
  HH.OPEN_HOUR = 0;    // 00:00 — sân hoạt động 24/24
  HH.CLOSE_HOUR = 24;  // 24:00 (khung giờ cuối là 23:00 - 24:00)
  /* Ngày "hôm nay" của website mô phỏng (để báo cáo 29/10 mở lên là đúng ngày 29/10). Đặt '' để dùng ngày thật của máy. */
  HH.DEMO_DATE = '2026-10-29';
  HH.DATA_VERSION = 5; // tăng số này khi đổi cấu trúc dữ liệu mẫu -> trình duyệt cũ tự nạp lại dữ liệu mẫu

  /* ---- 3. QUY TẮC LIÊN KẾT SÂN 7 ↔ SÂN 5 (sửa tại đây nếu muốn đổi sơ đồ) ----
     Mỗi sân 7 người được ghép từ đúng 3 sân 5 người.
     9 sân 5 (A1–A9) tham gia ghép thành 3 sân 7; 11 sân 5 còn lại (A10–A20) hoạt động độc lập.
     Quy tắc: đặt V1 => A1, A2, A3 bị khóa cùng khung giờ; đặt A2 => V1 bị khóa. */
  HH.COURT_LINKS = {
    V1: ['A1', 'A2', 'A3'],
    V2: ['A4', 'A5', 'A6'],
    V3: ['A7', 'A8', 'A9']
  };

  /* ---- 4. NHÃN HIỂN THỊ ---- */
  HH.STATUS = {
    pending: { label: 'Chờ xác nhận', cls: 'warn' },
    confirmed: { label: 'Đã xác nhận', cls: 'ok' },
    cancelled: { label: 'Đã hủy', cls: 'bad' }
  };
  HH.PAYMENT = {
    unpaid: { label: 'Chờ thanh toán mô phỏng', short: 'Chờ thanh toán', cls: 'warn' },
    deposit: { label: 'Đã cọc (mô phỏng)', short: 'Đã cọc', cls: 'info' },
    paid: { label: 'Đã thanh toán (mô phỏng)', short: 'Đã thanh toán', cls: 'ok' },
    refunded: { label: 'Đã hoàn cọc (mô phỏng)', short: 'Đã hoàn cọc', cls: 'muted' }
  };
  HH.LEVELS = [
    { id: 'new', label: 'Mới chơi', color: '#3b82f6' },
    { id: 'club', label: 'Phong trào', color: '#22c55e' },
    { id: 'good', label: 'Khá', color: '#f59e0b' },
    { id: 'pro', label: 'Giỏi', color: '#ef4444' }
  ];
  HH.levelOf = function (id) { return HH.LEVELS.filter(function (l) { return l.id === id; })[0] || HH.LEVELS[1]; };
  HH.AMENITIES = {
    led: { label: 'Đèn LED', icon: 'lightbulb' },
    wc: { label: 'Nhà vệ sinh', icon: 'building-2' },
    locker: { label: 'Tủ đồ', icon: 'lock' },
    water: { label: 'Nước uống', icon: 'droplets' },
    shower: { label: 'Phòng tắm', icon: 'shower-head' },
    ball: { label: 'Thuê bóng', icon: 'circle-dot' },
    bib: { label: 'Áo bib', icon: 'shirt' },
    roof: { label: 'Có mái che', icon: 'house' },
    stand: { label: 'Khán đài', icon: 'armchair' },
    parking: { label: 'Bãi giữ xe', icon: 'car' },
    camera: { label: 'Camera livestream', icon: 'video' }
  };
  /* Các khung giờ để lọc lịch */
  HH.TIME_WINDOWS = [
    { id: 'golden', label: 'Giờ vàng 16:00 - 22:00', from: 16, to: 22 },
    { id: 'all', label: 'Cả ngày 24/24', from: 0, to: 24 },
    { id: 'night', label: 'Đêm 00:00 - 06:00', from: 0, to: 6 },
    { id: 'morning', label: 'Sáng 06:00 - 12:00', from: 6, to: 12 },
    { id: 'afternoon', label: 'Trưa - chiều 12:00 - 17:00', from: 12, to: 17 },
    { id: 'evening', label: 'Tối 18:00 - 24:00', from: 18, to: 24 }
  ];
  HH.PRICE_RANGES = [
    { id: 'all', label: 'Tất cả mức giá', min: 0, max: Infinity },
    { id: 'lt170', label: 'Dưới 170.000đ', min: 0, max: 169999 },
    { id: '170-200', label: '170.000đ - 200.000đ', min: 170000, max: 200000 },
    { id: 'gt200', label: '200.000đ - 350.000đ', min: 200001, max: 350000 },
    { id: 'gt350', label: 'Trên 350.000đ', min: 350001, max: Infinity }
  ];

  /* ---- 5. CẤU HÌNH QUY TẮC MÔ PHỎNG (Admin → Cài đặt có thể chỉnh) ---- */
  HH.DEFAULT_CONFIG = {
    peakFrom: 16, peakTo: 22,              // giờ vàng 16:00–22:00 (mục 1.1 báo cáo)
    weekendFactor: 1.1,                    // hệ số giá thứ Bảy, Chủ nhật
    holidays: [                            // ngày lễ: hệ số tăng giá, hiển thị rõ cho khách trước khi đặt
      { date: '2026-11-20', name: 'Ngày Nhà giáo Việt Nam', factor: 1.1 },
      { date: '2026-12-25', name: 'Giáng sinh', factor: 1.2 },
      { date: '2027-01-01', name: 'Tết Dương lịch', factor: 1.2 },
      { date: '2027-02-06', name: 'Tết Nguyên đán', factor: 1.5 }
    ],
    depositPercent: 30,                    // % tiền cọc mặc định
    lowReputationDepositPercent: 50,       // cọc cao hơn khi điểm uy tín thấp
    reputationThreshold: 80,               // dưới mức này bị coi là "uy tín thấp"
    holdMinutes: 10,                       // giữ chỗ tạm 10 phút khi chưa cọc (mục 4.2)
    autoReleaseHold: true,                 // tự nhả chỗ khi hết hạn giữ chỗ
    autoConfirmAfterDeposit: false,        // true = tự xác nhận ngay khi khách bấm "Đã thanh toán"
    maxHoursPerBooking: 4,                 // tối đa số giờ liên tục mỗi đơn
    maxAdvanceDays: 60,                    // đặt trước tối đa bao nhiêu ngày
    pointsPerVnd: 10000,                   // 1 điểm thưởng cho mỗi 10.000đ
    tiers: [
      { id: 'member', name: 'Thành viên', minHours: 0, perk: 'Tích 1 điểm cho mỗi 10.000đ, nhận mã ưu đãi sinh nhật' },
      { id: 'silver', name: 'Bạc', minHours: 10, perk: 'Ưu tiên danh sách chờ, đổi lịch miễn phí 2 lần/tháng' },
      { id: 'gold', name: 'Vàng', minHours: 30, perk: 'Giảm giá nhẹ giờ thấp điểm, đặt trước xa hơn, quà sinh nhật' }
    ],
    seek: {                                // quy tắc "tìm đối ngay khi đặt sân" (mục 4.9) — mô phỏng, có thể cấu hình
      enabled: true,
      minStartHour: 16,                    // chỉ áp dụng cho các trận từ 16h trở đi
      deadlineHour: 15,                    // hạn chót 15:00 ngày thi đấu: chưa ghép được thì tự hủy
      maxPerDay: 6,                        // tối đa 6 sân tìm đối cùng lúc trong một ngày
      minReputation: 50                    // điểm uy tín tối thiểu để mở/nhận kèo
    },
    flash: {                               // giá giờ chót (mục 4.5): càng sát giờ càng giảm, không thấp hơn giá sàn
      enabled: true,
      tiers: [{ withinHours: 6, percent: 10 }, { withinHours: 3, percent: 20 }, { withinHours: 1, percent: 30 }]
    },
    refundPolicy: [                        // chính sách hoàn cọc (mục 4.3)
      { hoursBefore: 24, percent: 100 },
      { hoursBefore: 6, percent: 50 },
      { hoursBefore: 0, percent: 0 }
    ],
    services: [
      { id: 'ball', name: 'Thuê bóng', unit: 'quả', price: 20000, max: 3, icon: 'circle-dot' },
      { id: 'bib', name: 'Áo bib', unit: 'bộ', price: 10000, max: 4, icon: 'shirt' },
      { id: 'water', name: 'Nước suối', unit: 'chai', price: 10000, max: 30, icon: 'droplets' },
      { id: 'shower', name: 'Phòng tắm', unit: 'lượt', price: 15000, max: 20, icon: 'shower-head' },
      { id: 'live-basic', name: 'Livestream cơ bản', unit: 'gói', price: 200000, max: 1, icon: 'video', minHoursAhead: 24 },
      { id: 'live-commentary', name: 'Livestream + bình luận viên', unit: 'gói', price: 500000, max: 1, icon: 'mic', minHoursAhead: 48 },
      { id: 'highlight', name: 'Highlight sau trận', unit: 'gói', price: 150000, max: 1, icon: 'circle-play', minHoursAhead: 24 }
    ],
    contact: {
      phone: '0900 123 456', zalo: '0900 123 456', email: 'datsan@huyhoang.example',
      address: 'Cụm sân Huy Hoàng, quận Bình Thạnh, TP. Hồ Chí Minh (địa chỉ minh họa)',
      hours: 'Mở cửa 24/24 hằng ngày'
    }
  };

  /* ---- 6. DANH SÁCH SÂN (20 sân 5 + 3 sân 7 = 23 lựa chọn đặt) ---- */
  /** Ảnh thật do bạn tự thêm: trả về đường dẫn trong thư mục img/ kèm ảnh minh họa dự phòng (?fb=...).
      Nếu file ảnh thật chưa có, trình duyệt tự dùng ảnh dự phòng (xem trình xử lý lỗi ảnh trong script.js). */
  var PRICE_RAISE = 50000; // nâng giá mọi khung giờ thêm 50.000đ/giờ cho sát thực tế
  function buildCourts() {
    var courts = [];
    var imgs = ['pitch-1', 'pitch-2', 'pitch-3', 'pitch-4', 'pitch-5', 'pitch-6'];
    for (var i = 1; i <= 20; i++) {
      var zone = i <= 9 ? 'Khu A (gần sân 7)' : (i <= 15 ? 'Khu B' : 'Khu C (có mái che)');
      var roof = i >= 16;
      var priceOff = (i <= 9 ? 110000 : (i <= 15 ? 100000 : 120000)) + PRICE_RAISE;
      var pricePeak = (i <= 9 ? 140000 : (i <= 15 ? 130000 : 160000)) + PRICE_RAISE;
      var am = ['led', 'wc', 'locker', 'water', 'ball', 'bib'];
      if (i % 3 === 0 || roof) am.push('shower');
      if (roof) am.push('roof');
      if (i <= 9) am.push('parking');
      var img = imgs[(i - 1) % imgs.length];
      courts.push({
        id: 'A' + i, code: 'A' + i, name: 'Sân A' + i, type: 5, zone: zone,
        description: roof
          ? 'Sân 5 người có mái che, đá được cả khi trời mưa. Cỏ nhân tạo 3 lớp, đèn LED chống chói, lưới cao 4m.'
          : (i <= 9 ? 'Sân 5 người cỏ nhân tạo 3 lớp, đèn LED 4 trụ, nằm gần khu quầy nước và nhà vệ sinh. Có thể ghép với 2 sân bên cạnh thành sân 7.'
            : 'Sân 5 người ngoài trời, mặt cỏ nhân tạo mới, đèn LED sáng đều, lưới bao quanh an toàn.'),
        surface: 'Cỏ nhân tạo 3 lớp', lighting: 'Đèn LED 4 trụ', roof: roof,
        amenities: am,
        image: 'assets/images/' + img + '.svg',
        gallery: ['assets/images/' + img + '.svg', 'assets/images/' + imgs[i % imgs.length] + '.svg', 'assets/images/drinks.svg', 'assets/images/locker.svg'],
        priceOff: priceOff, pricePeak: pricePeak, active: true,
        rating: Math.round((4.5 + ((i * 7) % 5) / 10) * 10) / 10, reviews: 40 + ((i * 37) % 150)
      });
    }
    var v = [
      { id: 'V1', img: 'pitch-v7', off: 280000, peak: 340000, desc: 'Sân 7 người tiêu chuẩn, ghép từ 3 sân 5 người A1 + A2 + A3. Mặt cỏ rộng, hai khung thành lớn.', am: ['led', 'wc', 'locker', 'water', 'shower', 'ball', 'bib', 'parking'] },
      { id: 'V2', img: 'stand', off: 300000, peak: 380000, desc: 'Sân 7 người có khán đài, ghép từ A4 + A5 + A6. Dùng tổ chức giải đấu và sự kiện, hỗ trợ livestream.', am: ['led', 'wc', 'locker', 'water', 'shower', 'ball', 'bib', 'stand', 'camera', 'parking'] },
      { id: 'V3', img: 'pitch-6', off: 280000, peak: 350000, desc: 'Sân 7 người ghép từ A7 + A8 + A9. Phù hợp nhóm 12–14 người đá giao hữu.', am: ['led', 'wc', 'locker', 'water', 'shower', 'ball', 'bib', 'parking'] }
    ];
    v.forEach(function (x) {
      courts.push({
        id: x.id, code: x.id, name: 'Sân ' + x.id, type: 7, zone: 'Sân 7 người', components: HH.COURT_LINKS[x.id].slice(),
        description: x.desc, surface: 'Cỏ nhân tạo 3 lớp', lighting: 'Đèn LED 6 trụ', roof: false,
        amenities: x.am, image: 'assets/images/' + x.img + '.svg',
        gallery: ['assets/images/' + x.img + '.svg', 'assets/images/pitch-v7.svg', 'assets/images/drinks.svg', 'assets/images/locker.svg'],
        priceOff: x.off + PRICE_RAISE, pricePeak: x.peak + PRICE_RAISE, active: true,
        rating: x.id === 'V2' ? 4.9 : 4.7, reviews: x.id === 'V2' ? 86 : 58
      });
    });
    return courts;
  }
  HH.buildCourts = buildCourts;

  /* ---- 7. DỮ LIỆU MẪU KHÁC ---- */
  var CUSTOMERS = ['Nguyễn Minh Khang', 'Trần Quốc Bảo', 'Lê Hoàng Nam', 'Phạm Gia Huy', 'Võ Thanh Tùng', 'Đặng Anh Khoa', 'Bùi Đức Thịnh', 'Hoàng Văn Long',
    'Phan Trọng Nghĩa', 'Vũ Tuấn Kiệt', 'Đỗ Mạnh Hùng', 'Ngô Thế Vinh', 'Dương Hải Đăng', 'Lý Quang Vinh', 'Trương Công Danh', 'Huỳnh Bảo Long',
    'Mai Xuân Trường', 'Đinh Hữu Phước', 'Tạ Duy Khánh', 'Lâm Gia Bảo', 'Châu Nhật Minh', 'Cao Thái Sơn', 'Hồ Đình Tuấn', 'Tô Minh Quân'];
  var TEAMS = ['FC Đoàn Kết', 'FC Thủ Đức Xanh', 'Team Văn Phòng Số 9', 'FC Sinh Viên Tự Do', 'Phố Núi FC', 'Bình Thạnh Stars', 'Đêm Sài Gòn FC', 'FC Cuối Tuần', 'Gà Rán FC', 'Mãnh Hổ FC'];
  HH.DEMO_PHONE = '0901234567';
  HH.ADMIN_ACCOUNT = { user: 'admin', pass: 'admin123' }; // tài khoản quản trị mô phỏng (hiển thị công khai vì chỉ là demo)

  function buildPromos(today) {
    return [
      { id: 'P1', code: 'HUYHOANG10', title: 'Giảm 10% cho mọi đơn từ 100.000đ', desc: 'Áp dụng tối đa 50.000đ mỗi đơn. Không cộng dồn với giá giờ chót.', type: 'percent', value: 10, maxDiscount: 50000, minAmount: 100000, offPeakOnly: false, active: true, validFrom: null, validTo: HH.addDays(today, 90) },
      { id: 'P2', code: 'SINHVIEN20', title: 'Ưu đãi sinh viên giảm 20.000đ', desc: 'Dành cho đơn từ 200.000đ (đặt từ 2 giờ trở lên). Cần xác minh thẻ sinh viên khi check-in.', type: 'amount', value: 20000, maxDiscount: 20000, minAmount: 200000, offPeakOnly: false, active: true, validFrom: null, validTo: HH.addDays(today, 90) },
      { id: 'P3', code: 'GIOTHAP15', title: 'Giờ thấp điểm giảm 15%', desc: 'Chỉ áp dụng khi toàn bộ khung giờ nằm ngoài 16:00–22:00. Tối đa 40.000đ.', type: 'percent', value: 15, maxDiscount: 40000, minAmount: 0, offPeakOnly: true, active: true, validFrom: null, validTo: HH.addDays(today, 90) },
      { id: 'P4', code: 'CUOITUAN5', title: 'Cuối tuần giảm 5%', desc: 'Mã thử nghiệm đang tạm ngưng để minh họa trạng thái "tắt" trong trang Admin.', type: 'percent', value: 5, maxDiscount: 30000, minAmount: 0, offPeakOnly: false, active: false, validFrom: null, validTo: HH.addDays(today, 30) }
    ];
  }

  function buildTournaments(today) {
    return [
      { id: 'T1', name: 'Huy Hoàng Cup – Mùa Thu 2026', format: 'Sân 7 người', venue: 'Sân V2 (có khán đài)', startDate: HH.addDays(today, 16), endDate: HH.addDays(today, 17), fee: 1500000, maxTeams: 16, prize: 'Cúp + 10.000.000đ', livestream: true, registrationOpen: true, image: 'assets/images/cup-1.svg',
        desc: 'Giải 7 người thi đấu loại trực tiếp trên sân khán đài V2, có livestream và bình luận viên. Mỗi đội đăng ký 8–12 cầu thủ.',
        teams: [{ name: 'FC Đoàn Kết', phone: '0911000001', players: 10, paid: true }, { name: 'Bình Thạnh Stars', phone: '0911000002', players: 9, paid: true }, { name: 'Mãnh Hổ FC', phone: '0911000003', players: 11, paid: false }, { name: 'Phố Núi FC', phone: '0911000004', players: 8, paid: true }, { name: 'Gà Rán FC', phone: '0911000005', players: 10, paid: true }, { name: 'Đêm Sài Gòn FC', phone: '0911000006', players: 12, paid: false }, { name: 'FC Thủ Đức Xanh', phone: '0911000007', players: 9, paid: true }, { name: 'FC Cuối Tuần', phone: '0911000008', players: 10, paid: true }, { name: 'Team Văn Phòng Số 9', phone: '0911000009', players: 11, paid: true }, { name: 'FC Sinh Viên Tự Do', phone: '0911000010', players: 9, paid: false }, { name: 'Sài Gòn Old Boys', phone: '0911000011', players: 12, paid: true }] },
      { id: 'T2', name: 'Giải Sinh viên Bình Thạnh 5 người', format: 'Sân 5 người', venue: 'Sân A10 – A15', startDate: HH.addDays(today, 24), endDate: HH.addDays(today, 38), fee: 600000, maxTeams: 8, prize: 'Cúp + 4.000.000đ', livestream: false, registrationOpen: true, image: 'assets/images/cup-2.svg',
        desc: 'Giải phong trào dành cho sinh viên, thi đấu vòng bảng rồi đấu loại trực tiếp vào các tối cuối tuần.',
        teams: ['Khoa Kinh Tế FC', 'CLB Công Nghệ', 'Kiến Trúc United', 'Ngoại Ngữ Stars', 'Luật Sài Gòn', 'Y Dược Xanh', 'Sư Phạm FC', 'Mỹ Thuật FC'].map(function (n, i) { return { name: n, phone: '0922000' + (100 + i), players: 7, paid: i % 3 !== 0 }; }) },
      { id: 'T3', name: 'Office League – Giải Doanh nghiệp', format: 'Sân 7 người', venue: 'Sân V1, V3', startDate: HH.addDays(today, 45), endDate: HH.addDays(today, 59), fee: 2000000, maxTeams: 12, prize: 'Cúp + hiện vật tài trợ', livestream: true, registrationOpen: true, image: 'assets/images/cup-3.svg',
        desc: 'Giải giao hữu cho các đội văn phòng, đá sau giờ làm (18:00–21:00). Có xuất hóa đơn điện tử theo yêu cầu (mô phỏng).',
        teams: [{ name: 'Team Văn Phòng Số 9', phone: '0933000001', players: 10, paid: true }, { name: 'Khối Kế Toán FC', phone: '0933000002', players: 9, paid: false }, { name: 'IT Night FC', phone: '0933000003', players: 12, paid: true }] },
      { id: 'T4', name: 'Giao hữu Night League (hằng tuần)', format: 'Sân 5 người', venue: 'Các sân Khu C', startDate: HH.addDays(today, 3), endDate: HH.addDays(today, 3), fee: 300000, maxTeams: 6, prize: 'Quà tặng từ nhà tài trợ', livestream: false, registrationOpen: false, image: 'assets/images/cup-4.svg',
        desc: 'Buổi giao hữu hằng tuần. Đợt này đã đóng đăng ký, hẹn bạn ở đợt tiếp theo.',
        teams: ['A', 'B', 'C', 'D', 'E', 'F'].map(function (x, i) { return { name: 'Đội ' + x + ' Night', phone: '0944000' + (100 + i), players: 6, paid: true }; }) }
    ];
  }

  function buildPosts(today) {
    return [
      { id: 'PL1', type: 'need_players', title: 'Đội thiếu 2 người đá giao hữu', name: 'Anh Tuấn', teamName: 'FC Cầu Giấy Xanh', phone: '0955000001', date: HH.addDays(today, 1), hour: 19, courtType: 5, level: 'club', needed: 2, fee: 40000, position: 'Hậu vệ / Thủ môn', note: 'Đá vui, không cay cú. Có áo bib.', joined: [], createdAt: new Date().toISOString() },
      { id: 'PL2', type: 'need_players', title: 'Tìm 1 thủ môn', name: 'Chị Lan', teamName: 'Team Văn Phòng Số 9', phone: '0955000002', date: HH.addDays(today, 2), hour: 20, courtType: 5, level: 'good', needed: 1, fee: 50000, position: 'Thủ môn', note: 'Đội thiếu thủ môn cố định, đá 20h.', joined: [], createdAt: new Date().toISOString() },
      { id: 'PL3', type: 'need_players', title: 'Sân 7 thiếu 3 người', name: 'Bạn Hải', teamName: 'Bình Thạnh Stars', phone: '0955000003', date: HH.addDays(today, 3), hour: 18, courtType: 7, level: 'pro', needed: 3, fee: 60000, position: 'Tiền vệ / Tiền đạo', note: 'Trình độ khá, đá nhanh.', joined: [{ name: 'Minh Tâm', phone: '0966000001', at: new Date().toISOString() }], createdAt: new Date().toISOString() },
      { id: 'PL4', type: 'free_player', title: 'Cầu thủ tự do tìm kèo', name: 'Nguyễn Quang Huy', phone: '0955000004', position: 'Tiền đạo', level: 'good', area: 'Bình Thạnh, Phú Nhuận', availability: 'Tối thứ 3, thứ 5, cuối tuần', note: 'Có thể đá vị trí cánh, sẵn sàng chia tiền sân.', needed: 0, joined: [], createdAt: new Date().toISOString() },
      { id: 'PL5', type: 'free_player', title: 'Sinh viên muốn ghép đội', name: 'Phạm Đức Anh', phone: '0955000005', position: 'Hậu vệ', level: 'new', area: 'Thủ Đức, Gò Vấp', availability: 'Chiều thứ 7, Chủ nhật', note: 'Mới chơi, mong được ghép đội phong trào.', needed: 0, joined: [], createdAt: new Date().toISOString() },
      { id: 'PL6', type: 'need_players', title: 'Thiếu 1 người đá sớm', name: 'Anh Dũng', teamName: 'FC Cuối Tuần', phone: '0955000006', date: HH.addDays(today, 4), hour: 17, courtType: 5, level: 'club', needed: 1, fee: 35000, position: 'Bất kỳ', note: 'Sân A12 lúc 17h, nước uống đội lo.', joined: [], createdAt: new Date().toISOString() }
    ];
  }

  function buildMembers(today) {
    var log = function (d, delta, reason) { return { date: HH.addDays(today, -d), delta: delta, reason: reason }; };
    return [
      { phone: HH.DEMO_PHONE, name: 'Nguyễn Văn A', email: 'nguyenvana@example.com', joinedAt: new Date(HH.parseDate(HH.addDays(today, -210))).toISOString(), reputation: 92, bonusPoints: 120, student: true,
        reputationLog: [log(120, 0, 'Khởi tạo tài khoản — 100 điểm uy tín'), log(100, -10, 'Hủy sân dưới 6 giờ'), log(80, 2, 'Đến đúng giờ và hoàn tất trận'), log(75, 2, 'Đến đúng giờ và hoàn tất trận'), log(60, -5, 'Hủy từ 24 giờ đến 6 giờ'), log(50, 2, 'Đến đúng giờ và hoàn tất trận'), log(40, 2, 'Đến đúng giờ và hoàn tất trận'), log(25, -5, 'Hủy từ 24 giờ đến 6 giờ'), log(14, 2, 'Đến đúng giờ và hoàn tất trận'), log(7, 2, 'Đến đúng giờ và hoàn tất trận')] },
      { phone: '0912345678', name: 'Trần Thị B', email: '', joinedAt: new Date().toISOString(), reputation: 74, bonusPoints: 30, reputationLog: [log(30, -20, 'Bùng sân không báo'), log(10, -6, 'Hủy sát giờ'), log(5, 0, 'Khởi tạo tài khoản')] },
      { phone: '0923456789', name: 'Lê Văn C', email: '', joinedAt: new Date().toISOString(), reputation: 100, bonusPoints: 0, reputationLog: [log(3, 0, 'Khởi tạo tài khoản — 100 điểm uy tín')] },
      { phone: '0934567890', name: 'Phạm Minh D', email: '', joinedAt: new Date().toISOString(), reputation: 45, bonusPoints: 0, reputationLog: [log(40, -20, 'Bùng sân không báo'), log(20, -20, 'Bùng sân không báo'), log(10, -15, 'Vi phạm nội quy')] }
    ];
  }

  /* ---- 8. TẠO BỘ ĐƠN ĐẶT SÂN MẪU (cố định, luôn tính theo ngày hôm nay) ---- */
  HH.buildSeed = function (now) {
    var R = HH.makeRng(20261022);
    var today = HH.todayStr(now);
    var cfg = HH.clone(HH.DEFAULT_CONFIG);
    var courts = buildCourts();
    var bookings = [], usedIds = {};
    var pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var phoneFor = {};
    function phoneOf(name) {
      if (!phoneFor[name]) phoneFor[name] = '09' + String(Math.floor(10000000 + R() * 89999999)).slice(0, 8);
      return phoneFor[name];
    }
    function newId() { var id; do { id = 'HH' + (100000 + Math.floor(R() * 900000)); } while (usedIds[id]); usedIds[id] = 1; return id; }

    /** Thêm 1 đơn mẫu. Trả về null nếu bị xung đột (dữ liệu mẫu cũng phải tuân thủ quy tắc!). */
    function add(s) {
      var date = HH.addDays(today, s.day), status = s.status || 'confirmed';
      if (status !== 'cancelled' && HH.findConflicts(s.court, date, s.start, s.end, { courts: courts, bookings: bookings }).length) return null;
      var name = s.name || pick(CUSTOMERS), phone = s.phone || phoneOf(name);
      var created = new Date(HH.parseDate(date).getTime() - (s.before != null ? s.before : 1 + Math.floor(R() * 3)) * 86400000);
      created.setHours(8 + Math.floor(R() * 13), Math.floor(R() * 60), 0, 0);
      if (created > now) created = new Date(now.getTime() - (15 + Math.floor(R() * 90)) * 60000);
      var pay = s.pay || 'deposit';
      var b = HH.composeBooking({
        id: newId(), customerName: name, phone: phone, note: s.note || '', courtId: s.court, date: date, startHour: s.start, endHour: s.end,
        services: s.services || [], promoCode: s.promo || '', status: status, paymentStatus: pay, source: s.source || 'web', seek: s.seek || null, holdUntil: null,
        actor: s.source && s.source !== 'web' ? 'Nhân viên trực' : 'Khách hàng'
      }, { cfg: cfg, courts: courts, bookings: bookings, now: created, noFlash: true, createdAt: created.toISOString() });
      var t = created.getTime();
      if (pay === 'deposit' || pay === 'paid') { b.paidAt = new Date(t + 3 * 60000).toISOString(); b.history.push({ at: b.paidAt, by: 'Hệ thống', action: pay === 'paid' ? 'Ghi nhận thanh toán đủ (mô phỏng)' : 'Ghi nhận đặt cọc (mô phỏng)', note: '' }); }
      if (status === 'confirmed') { b.confirmedAt = new Date(t + 8 * 60000).toISOString(); b.history.push({ at: b.confirmedAt, by: 'Quản trị viên', action: 'Xác nhận đơn', note: '' }); }
      if (status === 'cancelled') {
        b.cancelledAt = new Date(t + 3600000).toISOString(); b.cancelledBy = 'Khách hàng'; b.cancelReason = s.reason || 'Khách đổi lịch';
        b.refundAmount = 0; b.refundPercent = 0;
        if (pay === 'deposit' && s.refund) { b.refundAmount = b.depositAmount; b.refundPercent = 100; b.paymentStatus = 'refunded'; }
        b.history.push({ at: b.cancelledAt, by: 'Khách hàng', action: 'Hủy đơn', note: b.cancelReason });
      }
      bookings.push(b); return b;
    }

    // --- Kịch bản có sẵn để bạn thử ngay khi demo ---
    var demo = { name: 'Nguyễn Văn A', phone: HH.DEMO_PHONE };
    add({ day: 1, court: 'V1', start: 19, end: 20, name: 'Hoàng Minh Quân', pay: 'paid' });                       // V1 bị đặt -> A1, A2, A3 bị khóa 19–20h ngày mai
    add({ day: 1, court: 'A5', start: 18, end: 19, name: 'Trần Quốc Bảo', pay: 'deposit' });                      // A5 bị đặt -> V2 bị khóa 18–19h ngày mai
    add({ day: 1, court: 'A8', start: 20, end: 21, name: 'Lê Hoàng Nam', status: 'pending', pay: 'deposit' });    // đơn chờ xác nhận vẫn giữ chỗ -> V3 bị khóa
    add({ day: 0, court: 'V3', start: 20, end: 22, name: 'Bùi Đức Thịnh', pay: 'paid' });
    add({ day: 0, court: 'A2', start: 19, end: 20, name: 'Phạm Gia Huy', pay: 'deposit' });
    // Đơn đá đêm (24/24) để lịch giờ khuya nhìn thực tế
    add({ day: 0, court: 'A13', start: 23, end: 24, name: 'Cao Thái Sơn', pay: 'paid' });
    add({ day: 1, court: 'V1', start: 22, end: 24, name: 'Tô Minh Quân', pay: 'deposit' });
    add({ day: 1, court: 'A10', start: 0, end: 2, name: 'Châu Nhật Minh', pay: 'deposit' });
    add({ day: 1, court: 'A17', start: 1, end: 3, name: 'Đinh Hữu Phước', pay: 'paid' });
    add({ day: 1, court: 'A19', start: 23, end: 24, name: 'Lâm Gia Bảo', pay: 'deposit', status: 'pending' });
    add({ day: 2, court: 'V3', start: 0, end: 2, name: 'Mai Xuân Trường', pay: 'paid' });
    add({ day: 2, court: 'A5', start: 5, end: 6, name: 'Hồ Đình Tuấn', pay: 'deposit' });
    add({ day: 2, court: 'A14', start: 22, end: 24, name: 'Tạ Duy Khánh', pay: 'deposit' });
    add({ day: 3, court: 'A16', start: 2, end: 4, name: 'Huỳnh Bảo Long', pay: 'paid' });
    add({ day: 3, court: 'A12', start: 23, end: 24, name: 'Trương Công Danh', pay: 'deposit', status: 'pending' });
    // Kèo tìm đối (sân tím)
    add({ day: 1, court: 'A12', start: 19, end: 20, name: 'Đặng Anh Khoa', status: 'pending', pay: 'unpaid', seek: { teamName: 'FC Đoàn Kết', level: 'good', havePlayers: 5, note: 'Cần đội khá, đá fair-play.' } });
    add({ day: 1, court: 'A14', start: 20, end: 21, name: 'Vũ Tuấn Kiệt', status: 'pending', pay: 'unpaid', seek: { teamName: 'Team Văn Phòng Số 9', level: 'club', havePlayers: 5, note: 'Đá giao lưu sau giờ làm.' } });
    add({ day: 2, court: 'A18', start: 19, end: 20, name: 'Ngô Thế Vinh', status: 'pending', pay: 'unpaid', seek: { teamName: 'FC Cuối Tuần', level: 'new', havePlayers: 4, note: 'Đội mới lập, cần đối thủ cùng trình độ.' } });
    add({ day: 3, court: 'V2', start: 20, end: 21, name: 'Dương Hải Đăng', status: 'pending', pay: 'unpaid', seek: { teamName: 'Bình Thạnh Stars', level: 'pro', havePlayers: 7, note: 'Sân 7 có khán đài, cần đối mạnh.' } });
    add({ day: 2, court: 'A16', start: 18, end: 19, name: 'Lý Quang Vinh', status: 'confirmed', pay: 'deposit',
      seek: { teamName: 'Gà Rán FC', level: 'club', havePlayers: 5, note: 'Đã ghép xong.', opponent: { teamName: 'Phố Núi FC', phone: '0977000001', level: 'club', players: 5, joinedAt: now.toISOString() } } });
    // Đơn của khách mẫu "Nguyễn Văn A" (dùng cho trang Thành viên)
    add({ day: 1, court: 'A1', start: 18, end: 19, name: demo.name, phone: demo.phone, pay: 'deposit', status: 'confirmed', before: 2 });
    add({ day: 2, court: 'A3', start: 20, end: 21, name: demo.name, phone: demo.phone, pay: 'unpaid', status: 'pending', before: 0 });
    add({ day: 4, court: 'V1', start: 17, end: 18, name: demo.name, phone: demo.phone, pay: 'deposit', status: 'confirmed', before: 3 });
    [-3, -6, -9, -14, -20, -27, -35].forEach(function (d, i) { add({ day: d, court: ['A1', 'A2', 'A6', 'A1', 'A3', 'A2', 'A9'][i], start: 18 + (i % 3), end: 20 + (i % 3), name: demo.name, phone: demo.phone, pay: 'paid', before: 3 }); });
    add({ day: -12, court: 'A7', start: 19, end: 20, name: demo.name, phone: demo.phone, pay: 'deposit', status: 'cancelled', reason: 'Khách hủy sát giờ', before: 1 });

    // --- Đơn sinh ngẫu nhiên (cố định theo "hạt giống", không trùng lịch) ---
    var hourWeights = { 0: 7, 1: 4, 2: 3, 3: 3, 4: 3, 5: 5, 6: 4, 7: 3, 8: 3, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 4, 15: 5, 16: 9, 17: 14, 18: 17, 19: 17, 20: 15, 21: 11, 22: 9, 23: 8 };
    var hours = [], wsum = 0; Object.keys(hourWeights).forEach(function (h) { hours.push([+h, hourWeights[h]]); wsum += hourWeights[h]; });
    function randHour() { var r = R() * wsum; for (var i = 0; i < hours.length; i++) { r -= hours[i][1]; if (r <= 0) return hours[i][0]; } return 19; }
    var perDay = { '-6': 60, '-5': 62, '-4': 66, '-3': 60, '-2': 70, '-1': 78, '0': 120, '1': 110, '2': 95, '3': 80, '4': 60, '5': 50 };
    var sources = ['web', 'web', 'web', 'web', 'web', 'web', 'zalo', 'hotline', 'counter'];
    Object.keys(perDay).forEach(function (k) {
      var day = +k, n = perDay[k];
      for (var i = 0; i < n; i++) {
        var court = R() < 0.12 ? pick(['V1', 'V2', 'V3']) : 'A' + (1 + Math.floor(R() * 20));
        var st = randHour(), len = R() < 0.72 ? 1 : 2;
        if (st + len > HH.CLOSE_HOUR) len = 1;
        var roll = R(), status, pay;
        if (day < 0) { status = roll < 0.9 ? 'confirmed' : 'cancelled'; pay = R() < 0.7 ? 'paid' : 'deposit'; }
        else { status = roll < 0.62 ? 'confirmed' : (roll < 0.9 ? 'pending' : 'cancelled'); pay = status === 'pending' ? (R() < 0.7 ? 'deposit' : 'unpaid') : (R() < 0.6 ? 'deposit' : 'paid'); }
        if (status === 'cancelled') pay = R() < 0.5 ? 'unpaid' : 'deposit';
        var services = R() < 0.18 ? [{ id: 'water', qty: 2 + Math.floor(R() * 8) }] : (R() < 0.1 ? [{ id: 'ball', qty: 1 }] : []);
        add({ day: day, court: court, start: st, end: st + len, status: status, pay: pay, source: pick(sources), services: services, reason: status === 'cancelled' ? pick(['Khách đổi lịch', 'Trời mưa', 'Thiếu người']) : '', refund: R() < 0.5 });
      }
    });
    bookings.sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });

    return { courts: courts, bookings: bookings, config: cfg, promos: buildPromos(today), tournaments: buildTournaments(today), posts: buildPosts(today), members: buildMembers(today) };
  };
})(window);
