/* ==========================================================================
   HUY HOÀNG Football Booking — script.js
   LÕI NGHIỆP VỤ DÙNG CHUNG cho index.html (khách hàng) và admin.html (quản trị).
   Mọi quy tắc đặt sân, kiểm tra xung đột sân 5 ↔ sân 7, tính tiền, lưu trữ
   localStorage và đồng bộ giữa các tab đều nằm ở file này (không sao chép ở nơi khác).

   Cấu trúc file:
     1. Tiện ích (định dạng tiền, ngày giờ, escape HTML…)
     2. Lưu trữ localStorage + thông báo thay đổi (đồng bộ tab)
     3. Sân & quy tắc liên kết sân 5 ↔ sân 7
     4. Giá, flash sale, khuyến mãi, dịch vụ
     5. Kiểm tra hợp lệ + xung đột + tạo đơn
     6. Xác nhận / hủy / thanh toán / khôi phục đơn
     7. Tìm đối (sân tím), ghép người, giải đấu
     8. Thành viên, điểm thưởng, điểm uy tín
     9. Thống kê cho Admin
    10. Khởi tạo, dữ liệu mẫu, sao lưu
   ========================================================================== */
(function (g) {
  'use strict';
  var HH = g.HH = g.HH || {};
  var K = HH.KEYS;

  /* ----------------------------------------------------------------------
     1. TIỆN ÍCH
     ---------------------------------------------------------------------- */
  HH.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  HH.clone = function (o) { return o == null ? o : JSON.parse(JSON.stringify(o)); };

  /** Chống chèn mã HTML: LUÔN dùng khi in dữ liệu người dùng nhập vào innerHTML. */
  HH.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /** 150000 -> "150.000đ" */
  HH.fmtMoney = function (n) {
    n = Math.round(Number(n) || 0);
    var neg = n < 0;
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + s + 'đ';
  };
  /** 120000 -> "120k" */
  HH.fmtK = function (n) { return Math.round((Number(n) || 0) / 1000) + 'k'; };

  HH.fmtHour = function (h) { return HH.pad2(h) + ':00'; };
  HH.fmtRange = function (s, e) { return HH.fmtHour(s) + ' - ' + HH.fmtHour(e); };

  /** Thời điểm "bây giờ" (có thể ghi đè khi kiểm thử bằng HH._now). */
  var demoOffset = null;
  HH.now = function () {
    if (HH._now) return new Date(HH._now);
    var real = new Date();
    if (!HH.DEMO_DATE || !/^\d{4}-\d{2}-\d{2}$/.test(HH.DEMO_DATE)) return real;
    if (demoOffset === null) { var p = HH.DEMO_DATE.split('-'), t0 = new Date(+p[0], +p[1] - 1, +p[2], real.getHours(), real.getMinutes(), real.getSeconds()); demoOffset = t0.getTime() - real.getTime(); }
    return new Date(real.getTime() + demoOffset); // đồng hồ chạy liên tục, chỉ lệch ngày
  };

  HH.toDateStr = function (d) { return d.getFullYear() + '-' + HH.pad2(d.getMonth() + 1) + '-' + HH.pad2(d.getDate()); };
  HH.todayStr = function (now) { return HH.toDateStr(now || HH.now()); };
  HH.isValidDateStr = function (s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.getFullYear() === +p[0] && d.getMonth() === +p[1] - 1 && d.getDate() === +p[2];
  };
  HH.parseDate = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  HH.addDays = function (s, n) { var d = HH.parseDate(s); d.setDate(d.getDate() + n); return HH.toDateStr(d); };
  HH.diffDays = function (a, b) { return Math.round((HH.parseDate(a) - HH.parseDate(b)) / 86400000); };
  HH.fmtDate = function (s) { if (!s) return ''; var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  HH.fmtDateDM = function (s) { var p = s.split('-'); return p[2] + '/' + p[1]; };
  var WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  HH.weekdayName = function (s) { return WEEKDAYS[HH.parseDate(s).getDay()]; };
  HH.weekdayShort = function (s) { var d = HH.parseDate(s).getDay(); return d === 0 ? 'CN' : 'T' + (d + 1); };
  HH.fmtDateLong = function (s) { return HH.weekdayName(s) + ', ' + HH.fmtDate(s); };
  HH.fmtDateTime = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return HH.pad2(d.getDate()) + '/' + HH.pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + HH.pad2(d.getHours()) + ':' + HH.pad2(d.getMinutes());
  };
  HH.fmtTimeOnly = function (iso) { var d = new Date(iso); return HH.pad2(d.getHours()) + ':' + HH.pad2(d.getMinutes()); };
  /** Số giờ từ "now" đến lúc bắt đầu (date + hour). Âm = đã qua. */
  HH.hoursUntil = function (date, hour, now) {
    var d = HH.parseDate(date); d.setHours(hour, 0, 0, 0);
    return (d - (now || HH.now())) / 3600000;
  };
  HH.dayOfWeek = function (s) { return HH.parseDate(s).getDay(); };

  /** Chuẩn hóa số điện thoại VN: "+84 901 234 567" -> "0901234567". Trả về '' nếu sai. */
  HH.normalizePhone = function (p) {
    var s = String(p || '').replace(/[\s.\-()]/g, '');
    if (/^\+84\d{9}$/.test(s)) s = '0' + s.slice(3);
    else if (/^84\d{9}$/.test(s)) s = '0' + s.slice(2);
    return /^0\d{9}$/.test(s) ? s : '';
  };
  HH.fmtPhone = function (p) { return p && p.length === 10 ? p.slice(0, 4) + ' ' + p.slice(4, 7) + ' ' + p.slice(7) : (p || ''); };

  HH.makeRng = function (seed) { // bộ sinh số ngẫu nhiên cố định (dữ liệu mẫu luôn giống nhau)
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  HH.debounce = function (fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  };

  /* ----------------------------------------------------------------------
     2. LƯU TRỮ localStorage + ĐỒNG BỘ TAB
        - Hai trang dùng chung các khóa trong HH.KEYS (xem data.js).
        - Tab đang thao tác: sau mỗi lần lưu ta tự phát sự kiện 'hh:datachange'.
        - Tab khác: sự kiện 'storage' của trình duyệt -> ta phát lại 'hh:datachange'.
     ---------------------------------------------------------------------- */
  var memStore = {}; // dự phòng khi trình duyệt chặn localStorage
  function rawGet(key) {
    try { return g.localStorage.getItem(key); } catch (e) { return memStore[key] == null ? null : memStore[key]; }
  }
  function rawSet(key, val) {
    try { g.localStorage.setItem(key, val); } catch (e) { memStore[key] = val; }
  }
  function rawRemove(key) {
    try { g.localStorage.removeItem(key); } catch (e) { delete memStore[key]; }
  }
  HH.storageAvailable = function () {
    try { var t = '__hh_test__'; g.localStorage.setItem(t, '1'); g.localStorage.removeItem(t); return true; } catch (e) { return false; }
  };

  HH.load = function (key, fallback) {
    var raw = rawGet(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  };
  HH.save = function (key, value) {
    rawSet(key, JSON.stringify(value));
    HH._emit(key, 'local');
  };
  HH._emit = function (key, source) {
    try { g.dispatchEvent(new CustomEvent('hh:datachange', { detail: { key: key, source: source } })); } catch (e) { /* bỏ qua */ }
  };
  HH.onChange = function (fn) { g.addEventListener('hh:datachange', function (e) { fn(e.detail); }); };
  if (typeof g.addEventListener === 'function') {
    g.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('hh_') === 0) HH._emit(e.key, 'remote');
    });
  }

  /* ẢNH THẬT: thư mục img/ + file img/anh-co-san.js (danh sách ảnh bạn đã bỏ vào). Có trong danh sách thì dùng ảnh thật,
     không thì dùng ảnh minh họa trong assets/images. Chỉ ảnh có trong danh sách mới được tải => không có lỗi 404 thừa. */
  function realList() { return Array.isArray(window.HH_REAL_IMAGES) ? window.HH_REAL_IMAGES : []; }
  function fbOf(s) { var i = String(s || '').indexOf('?fb='); return i >= 0 ? s.slice(i + 4) : s; }
  HH.realImg = function (rel, current) { var fb = fbOf(current); return realList().indexOf(rel) >= 0 ? 'img/' + rel + '?fb=' + fb : fb; };
  /* Ảnh sân thật theo "kho ảnh dùng chung" (không cần ghi tên vào anh-co-san.js, thiếu file thì tự dùng ảnh minh họa):
       img/san-thuc-te/luoi/luoi-1.jpg … luoi-6.jpg      -> ảnh thẻ sân (dạng lưới), chia vòng tròn cho 23 sân: sân thứ n dùng ảnh (n mod 6)+1
       img/san-thuc-te/chi-tiet/chi-tiet-1.jpg … -4.jpg  -> 4 ảnh ở trang chi tiết, dùng chung cho mọi sân
     Ảnh riêng từng sân (img/san/A1.jpg … khai báo trong anh-co-san.js) vẫn được ưu tiên hơn. */
  /* Ảnh đội tìm đối: img/tim-doi/doi/<tên-đội-viết-không-dấu-nối-gạch>.jpg (vd. "FC Đoàn Kết" -> fc-doan-ket.jpg) */
  HH.teamSlug = function (name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };
  HH.teamImg = function (name, fb) { return 'img/tim-doi/doi/' + HH.teamSlug(name) + '.jpg' + (fb ? '?fb=' + fb : ''); };
  var POOL_GRID = 6, POOL_DETAIL = 4, POOL_7 = 3;
  function withRealCourtImages(list) {
    var n7 = 0;
    list.forEach(function (c, idx) {
      var own = HH.hasReal('san/' + c.id + '.jpg');
      var is7 = c.type === 7, k7 = is7 ? n7++ : 0;
      /* Sân 7 dùng kho ảnh riêng img/san-thuc-te/san-7/san7-1..3.jpg (V1->1, V2->2, V3->3); sân 5 dùng luoi-1..6 */
      var poolMain = is7 ? 'san-thuc-te/san-7/san7-' + ((k7 % POOL_7) + 1) + '.jpg' : 'san-thuc-te/luoi/luoi-' + ((idx % POOL_GRID) + 1) + '.jpg';
      c.image = own ? HH.realImg('san/' + c.id + '.jpg', c.image) : 'img/' + poolMain + '?fb=' + fbOf(c.image);
      /* Trang chi tiết: 5 ảnh = 2 ảnh sân (ảnh 1 giống ảnh thẻ sân ở dạng lưới) + 3 ảnh tiện ích (máy bán nước, phòng tắm, tủ đồ) */
      if (c.gallery) {
        var fb = fbOf(c.gallery[0]), second;
        if (is7) second = 'img/san-thuc-te/san-7/san7-' + (((k7 + 1) % POOL_7) + 1) + '.jpg';
        else second = 'img/san-thuc-te/chi-tiet/chi-tiet-' + [2, 1, 3, 4, 2, 1][idx % POOL_GRID] + '.jpg';
        if (HH.hasReal('san/' + c.id + '-2.jpg')) second = 'img/san/' + c.id + '-2.jpg';
        c.gallery = [c.image, second + '?fb=' + fb, 'img/tien-ich/may-ban-nuoc.jpg?fb=' + fb, 'img/tien-ich/phong-tam.jpg?fb=' + fb, 'img/tien-ich/tu-do-1.jpg?fb=' + fb];
      }
    });
    return list;
  }
  HH.getCourts = function () { return withRealCourtImages(HH.load(K.courts, [])); };
  HH.getBookings = function () { return HH.load(K.bookings, []); };
  HH.getConfig = function () { return HH.load(K.config, HH.clone(HH.DEFAULT_CONFIG)); };
  HH.getPromos = function () { return HH.load(K.promos, []); };
  HH.getTournaments = function () {
    var l = HH.load(K.tournaments, []); if (realList().length) l.forEach(function (t) { t.image = HH.realImg('giai-dau/' + t.id + '.jpg', t.image); }); return l;
  };
  HH.getPosts = function () { return HH.load(K.posts, []); };
  HH.getMembers = function () { return HH.load(K.members, []); };
  HH.saveCourts = function (v) { HH.save(K.courts, v); };
  HH.saveBookings = function (v) { HH.save(K.bookings, v); };
  HH.saveConfig = function (v) { HH.save(K.config, v); };
  HH.savePromos = function (v) { HH.save(K.promos, v); };
  HH.saveTournaments = function (v) { HH.save(K.tournaments, v); };
  HH.savePosts = function (v) { HH.save(K.posts, v); };
  HH.saveMembers = function (v) { HH.save(K.members, v); };

  /* ----------------------------------------------------------------------
     3. SÂN & QUY TẮC LIÊN KẾT 5 ↔ 7
        Mỗi "sản phẩm đặt được" là một TẬP SÂN VẬT LÝ:
          sân A1 = {A1};  sân V1 = {A1, A2, A3}
        Hai đơn xung đột khi: cùng ngày + giờ giao nhau + hai tập sân giao nhau.
     ---------------------------------------------------------------------- */
  HH.getCourt = function (id, courts) {
    courts = courts || HH.getCourts();
    for (var i = 0; i < courts.length; i++) if (courts[i].id === id) return courts[i];
    return null;
  };
  HH.resourcesOf = function (court) {
    return court.type === 7 ? (court.components || []).slice() : [court.id];
  };
  /** Các sân bị ảnh hưởng khi đặt sân này (A1 -> [V1]; V1 -> [A1,A2,A3]; A10 -> []). */
  HH.relatedCourts = function (courtId, courts) {
    courts = courts || HH.getCourts();
    var me = HH.getCourt(courtId, courts); if (!me) return [];
    var mine = HH.resourcesOf(me), out = [];
    courts.forEach(function (c) {
      if (c.id === me.id) return;
      var theirs = HH.resourcesOf(c);
      if (theirs.some(function (r) { return mine.indexOf(r) >= 0; })) out.push(c.id);
    });
    return out;
  };
  /** Sân 5 thuộc sân 7 nào? (A2 -> V1, A10 -> null) */
  HH.parentOf = function (courtId, courts) {
    courts = courts || HH.getCourts();
    for (var i = 0; i < courts.length; i++) if (courts[i].type === 7 && courts[i].components.indexOf(courtId) >= 0) return courts[i].id;
    return null;
  };

  /** Đơn nào đang CHIẾM lịch sân? -> Chờ xác nhận (giữ chỗ) và Đã xác nhận. Đã hủy thì KHÔNG chiếm. */
  HH.isOccupying = function (b) { return b.status === 'pending' || b.status === 'confirmed'; };

  /** Kiểm tra trạng thái "tìm đối" chưa có đội nhận. */
  HH.isSeekingOpen = function (b) { return !!(b.seek && !b.seek.opponent); };

  /** Màu hiển thị của một đơn trên lưới lịch. */
  HH.visualState = function (b) {
    if (HH.isSeekingOpen(b)) return 'seeking';        // tím
    return b.status === 'confirmed' ? 'booked' : 'holding'; // đỏ / vàng (giữ chỗ)
  };

  /**
   * Tìm các đơn xung đột với (sân, ngày, khung giờ).
   * Trả về mảng { booking, relation } với relation: 'same' | 'component' | 'parent'
   */
  HH.findConflicts = function (courtId, date, startHour, endHour, opts) {
    opts = opts || {};
    var courts = opts.courts || HH.getCourts();
    var bookings = opts.bookings || HH.getBookings();
    var court = HH.getCourt(courtId, courts);
    if (!court) return [];
    var mine = HH.resourcesOf(court), out = [];
    bookings.forEach(function (b) {
      if (!HH.isOccupying(b) || b.date !== date || b.id === opts.excludeId) return;
      if (!(startHour < b.endHour && b.startHour < endHour)) return; // hai khoảng giờ không giao nhau
      var bc = HH.getCourt(b.courtId, courts); if (!bc) return;
      var theirs = HH.resourcesOf(bc);
      if (!theirs.some(function (r) { return mine.indexOf(r) >= 0; })) return;
      var rel = bc.id === court.id ? 'same' : (court.type === 7 ? 'component' : 'parent');
      out.push({ booking: b, relation: rel });
    });
    return out;
  };

  /** Chỉ mục nhanh: với 1 ngày -> tra (sân vật lý, giờ) ra đơn đang chiếm. Dùng để vẽ lưới lịch. */
  HH.buildDayIndex = function (date, bookings, courts) {
    bookings = bookings || HH.getBookings(); courts = courts || HH.getCourts();
    var idx = {};
    bookings.forEach(function (b) {
      if (b.date !== date || !HH.isOccupying(b)) return;
      var c = HH.getCourt(b.courtId, courts); if (!c) return;
      HH.resourcesOf(c).forEach(function (r) {
        for (var h = b.startHour; h < b.endHour; h++) idx[r + '|' + h] = b;
      });
    });
    return idx;
  };

  /**
   * Trạng thái một ô (sân, giờ) trong ngày:
   *  { state: 'free'|'booked'|'holding'|'seeking'|'maintenance'|'past', booking, linked }
   *  linked = true khi ô bị khóa vì đơn của sân LIÊN KẾT (vd A2 bị khóa bởi đơn V1).
   */
  HH.slotState = function (idx, court, date, hour, now, courts) {
    now = now || HH.now();
    var today = HH.todayStr(now);
    if (date < today || (date === today && hour <= now.getHours())) {
      // vẫn trả đơn (nếu có) để hiển thị lịch sử, nhưng đánh dấu đã qua
      var pb = idx[HH.resourcesOf(court)[0] + '|' + hour];
      return { state: 'past', booking: pb || null, linked: false };
    }
    if (!HH.courtIsBookable(court, courts)) return { state: 'maintenance', booking: null, linked: false };
    var res = HH.resourcesOf(court);
    for (var i = 0; i < res.length; i++) {
      var b = idx[res[i] + '|' + hour];
      if (b) return { state: HH.visualState(b), booking: b, linked: b.courtId !== court.id };
    }
    return { state: 'free', booking: null, linked: false };
  };

  /** Sân có đang hoạt động không? Sân 7 chỉ hoạt động khi chính nó VÀ cả 3 sân thành phần hoạt động. */
  HH.courtIsBookable = function (court, courts) {
    if (court.active === false) return false;
    if (court.type === 7) {
      courts = courts || HH.getCourts();
      return court.components.every(function (id) { var c = HH.getCourt(id, courts); return c && c.active !== false; });
    }
    return true;
  };
  HH.courtInactiveReason = function (court, courts) {
    if (court.active === false) return court.name + ' đang tạm ngừng hoạt động (bảo trì).';
    if (court.type === 7) {
      courts = courts || HH.getCourts();
      var bad = court.components.filter(function (id) { var c = HH.getCourt(id, courts); return !c || c.active === false; });
      if (bad.length) return court.name + ' tạm không khả dụng vì sân thành phần ' + bad.join(', ') + ' đang ngừng hoạt động.';
    }
    return '';
  };

  /* ----------------------------------------------------------------------
     4. GIÁ, FLASH SALE, KHUYẾN MÃI, DỊCH VỤ
     ---------------------------------------------------------------------- */
  HH.isPeakHour = function (h, cfg) { return h >= cfg.peakFrom && h < cfg.peakTo; };

  /** Hệ số giá theo ngày: lễ/tết > cuối tuần > ngày thường. */
  HH.dayFactor = function (date, cfg) {
    var hol = (cfg.holidays || []).filter(function (x) { return x.date === date; })[0];
    if (hol) return { factor: hol.factor, label: hol.name + ' (×' + hol.factor + ')', kind: 'holiday' };
    var dow = HH.dayOfWeek(date);
    if (dow === 0 || dow === 6) return { factor: cfg.weekendFactor, label: 'Cuối tuần (×' + cfg.weekendFactor + ')', kind: 'weekend' };
    return { factor: 1, label: 'Ngày thường', kind: 'normal' };
  };
  var round1000 = function (n) { return Math.round(n / 1000) * 1000; };

  /** Giá niêm yết 1 giờ (chưa flash sale). */
  HH.listPrice = function (court, date, hour, cfg) {
    var base = HH.isPeakHour(hour, cfg) ? court.pricePeak : court.priceOff;
    return round1000(base * HH.dayFactor(date, cfg).factor);
  };

  /**
   * Giá 1 giờ có tính flash sale ("giá giờ chót") — mô phỏng theo mục 4.5 của báo cáo:
   * còn ≤6 giờ giảm 10%, ≤3 giờ giảm 20%, ≤1 giờ giảm 30%, nhưng KHÔNG thấp hơn giá sàn (giá giờ thường).
   */
  HH.priceForHour = function (court, date, hour, cfg, now) {
    var list = HH.listPrice(court, date, hour, cfg);
    var res = { price: list, list: list, flash: false, percent: 0 };
    var fl = cfg.flash;
    if (!fl || !fl.enabled || !now) return res;
    if (date !== HH.todayStr(now)) return res;
    var left = HH.hoursUntil(date, hour, now);
    if (left <= 0) return res;
    var tiers = (fl.tiers || []).slice().sort(function (a, b) { return a.withinHours - b.withinHours; });
    var pct = 0;
    for (var i = 0; i < tiers.length; i++) { if (left <= tiers[i].withinHours) { pct = tiers[i].percent; break; } }
    if (!pct) return res;
    var floor = round1000(court.priceOff * HH.dayFactor(date, cfg).factor);
    var cut = Math.max(floor, round1000(list * (1 - pct / 100)));
    if (cut < list) { res.price = cut; res.flash = true; res.percent = Math.round((1 - cut / list) * 100); }
    return res;
  };

  /** Bảng tính tiền sân theo từng giờ. */
  HH.priceBreakdown = function (court, date, startHour, endHour, cfg, now) {
    var lines = [], total = 0, hasFlash = false, allOffPeak = true;
    for (var h = startHour; h < endHour; h++) {
      var p = HH.priceForHour(court, date, h, cfg, now);
      lines.push({ hour: h, price: p.price, list: p.list, flash: p.flash, percent: p.percent });
      total += p.price; if (p.flash) hasFlash = true;
      if (HH.isPeakHour(h, cfg)) allOffPeak = false;
    }
    return { lines: lines, total: total, hasFlash: hasFlash, allOffPeak: allOffPeak, hours: endHour - startHour };
  };

  /** Áp mã khuyến mãi. Trả về { ok, discount, promo, message }. */
  HH.applyPromo = function (code, ctx) {
    code = String(code || '').trim().toUpperCase();
    if (!code) return { ok: false, discount: 0, message: 'Vui lòng nhập mã khuyến mãi.' };
    var promo = HH.getPromos().filter(function (p) { return String(p.code).toUpperCase() === code; })[0];
    if (!promo) return { ok: false, discount: 0, message: 'Mã "' + code + '" không tồn tại.' };
    if (!promo.active) return { ok: false, discount: 0, message: 'Mã "' + code + '" hiện đang tạm ngưng.' };
    var today = HH.todayStr(ctx.now);
    if (promo.validFrom && today < promo.validFrom) return { ok: false, discount: 0, message: 'Mã chưa đến thời gian áp dụng (từ ' + HH.fmtDate(promo.validFrom) + ').' };
    if (promo.validTo && today > promo.validTo) return { ok: false, discount: 0, message: 'Mã đã hết hạn ngày ' + HH.fmtDate(promo.validTo) + '.' };
    if (ctx.hasFlash) return { ok: false, discount: 0, message: 'Mã không cộng dồn với giá giờ chót (flash sale).' };
    if (promo.minAmount && ctx.courtAmount < promo.minAmount) return { ok: false, discount: 0, message: 'Đơn tối thiểu ' + HH.fmtMoney(promo.minAmount) + ' mới được dùng mã này.' };
    if (promo.offPeakOnly && !ctx.allOffPeak) return { ok: false, discount: 0, message: 'Mã chỉ áp dụng cho khung giờ thấp điểm (ngoài 16:00–22:00).' };
    var d = promo.type === 'percent' ? round1000(ctx.courtAmount * promo.value / 100) : promo.value;
    if (promo.maxDiscount) d = Math.min(d, promo.maxDiscount);
    d = Math.min(d, ctx.courtAmount);
    return { ok: true, discount: d, promo: promo, message: 'Đã áp dụng mã ' + promo.code + ': giảm ' + HH.fmtMoney(d) + '.' };
  };

  /** Tính tiền dịch vụ đi kèm. selected = [{id, qty}] */
  HH.calcServices = function (selected, cfg, date, startHour, now) {
    var lines = [], total = 0, errors = [];
    (selected || []).forEach(function (s) {
      var def = (cfg.services || []).filter(function (x) { return x.id === s.id; })[0];
      var qty = Math.floor(Number(s.qty) || 0);
      if (!def || qty <= 0) return;
      if (qty > (def.max || 99)) { errors.push('Dịch vụ "' + def.name + '" tối đa ' + def.max + ' ' + def.unit + '.'); return; }
      if (def.minHoursAhead && HH.hoursUntil(date, startHour, now) < def.minHoursAhead) {
        errors.push('"' + def.name + '" cần đặt trước tối thiểu ' + def.minHoursAhead + ' giờ để đối tác sắp xếp.'); return;
      }
      lines.push({ id: def.id, name: def.name, qty: qty, unit: def.unit, unitPrice: def.price, amount: def.price * qty });
      total += def.price * qty;
    });
    return { lines: lines, total: total, errors: errors };
  };

  /** Phần trăm đặt cọc: mặc định theo cấu hình; điểm uy tín thấp thì cọc cao hơn (mục 4.8). */
  HH.depositPercentFor = function (phone, cfg) {
    var m = phone ? HH.findMember(phone) : null;
    if (m && HH.reputationOf(m) < cfg.reputationThreshold) return cfg.lowReputationDepositPercent;
    return cfg.depositPercent;
  };

  /* ----------------------------------------------------------------------
     5. KIỂM TRA HỢP LỆ + XUNG ĐỘT + TẠO ĐƠN
     ---------------------------------------------------------------------- */
  function err(code, message) { return { code: code, message: message }; }

  /**
   * Kiểm tra (sân, ngày, giờ) có đặt được không.
   * opts: { excludeId, now, allowCurrentHour (Admin đặt hộ tại quầy), courts, bookings }
   * Trả về { ok, errors:[{code,message}], conflicts:[...] }
   */
  HH.validateSlot = function (input, opts) {
    opts = opts || {};
    var cfg = opts.cfg || HH.getConfig();
    var courts = opts.courts || HH.getCourts();
    var now = opts.now || HH.now();
    var errors = [], conflicts = [];
    var court = HH.getCourt(input.courtId, courts);
    if (!court) return { ok: false, errors: [err('COURT', 'Không tìm thấy sân đã chọn.')], conflicts: [] };

    var sh = Number(input.startHour), eh = Number(input.endHour);
    if (!HH.isValidDateStr(input.date)) errors.push(err('DATE', 'Ngày đặt không hợp lệ.'));
    if (!Number.isInteger(sh) || !Number.isInteger(eh)) {
      errors.push(err('HOUR', 'Giờ bắt đầu/kết thúc không hợp lệ.'));
    } else {
      if (eh <= sh) errors.push(err('RANGE', 'Giờ kết thúc phải sau giờ bắt đầu.'));
      if (sh < HH.OPEN_HOUR || eh > HH.CLOSE_HOUR) errors.push(err('OPEN', 'Sân chỉ nhận đặt từ ' + HH.fmtHour(HH.OPEN_HOUR) + ' đến ' + HH.fmtHour(HH.CLOSE_HOUR) + '.'));
      if (eh > sh && eh - sh > cfg.maxHoursPerBooking) errors.push(err('MAX', 'Mỗi đơn đặt tối đa ' + cfg.maxHoursPerBooking + ' giờ liên tục.'));
    }
    if (HH.isValidDateStr(input.date)) {
      var today = HH.todayStr(now);
      if (input.date < today) errors.push(err('PAST', 'Không thể đặt sân cho ngày đã qua.'));
      else if (input.date === today && Number.isInteger(sh)) {
        var minH = opts.allowCurrentHour ? now.getHours() : now.getHours() + 1;
        if (sh < minH) errors.push(err('PAST', 'Khung giờ ' + HH.fmtHour(sh) + ' đã bắt đầu hoặc đã qua, vui lòng chọn giờ muộn hơn.'));
      }
      var maxAdv = opts.maxAdvanceDays || cfg.maxAdvanceDays;
      if (HH.diffDays(input.date, today) > maxAdv) errors.push(err('FAR', 'Chỉ nhận đặt trước tối đa ' + maxAdv + ' ngày.'));
    }
    var inactive = HH.courtInactiveReason(court, courts);
    if (inactive) errors.push(err('INACTIVE', inactive));

    if (!errors.length) {
      conflicts = HH.findConflicts(court.id, input.date, sh, eh, { excludeId: opts.excludeId, courts: courts, bookings: opts.bookings });
      conflicts.forEach(function (c) {
        var b = c.booking, when = HH.fmtRange(b.startHour, b.endHour);
        var msg;
        if (c.relation === 'same') msg = court.name + ' đã có người đặt khung ' + when + ' (đơn ' + b.id + ').';
        else if (c.relation === 'component') msg = court.name + ' gồm các sân ' + court.components.join(', ') + ' — sân ' + b.courtId + ' đang được đặt khung ' + when + ' (đơn ' + b.id + ') nên không thể đặt sân 7 người.';
        else msg = court.name + ' thuộc ' + b.courtId + ' (sân 7 người) — ' + b.courtId + ' đang được đặt khung ' + when + ' (đơn ' + b.id + ') nên không thể đặt sân này.';
        errors.push(err('CONFLICT', msg));
      });
    }
    return { ok: errors.length === 0, errors: errors, conflicts: conflicts, court: court };
  };

  HH.teamSize = function (court) { return court.type === 7 ? 7 : 5; };
  HH.SEEK_DEADLINE = function (date, cfg) { var d = HH.parseDate(date); d.setHours(cfg.seek.deadlineHour, 0, 0, 0); return d; };

  /** Kiểm tra điều kiện mở "sân tìm đối" (sân tím) theo quy tắc mô phỏng ở mục 4.9. */
  HH.validateSeek = function (input, court, opts) {
    var cfg = opts.cfg, now = opts.now, bookings = opts.bookings, e = [];
    var sk = input.seek || {};
    if (!cfg.seek.enabled) return [err('SEEK', 'Tính năng "Cần tìm đối" đang tắt.')];
    if (input.startHour < cfg.seek.minStartHour) e.push(err('SEEK', 'Chỉ được chọn "Cần tìm đối" cho các trận bắt đầu từ ' + HH.fmtHour(cfg.seek.minStartHour) + ' trở đi.'));
    if (now >= HH.SEEK_DEADLINE(input.date, cfg)) e.push(err('SEEK', 'Đã quá hạn chót ' + HH.fmtHour(cfg.seek.deadlineHour) + ' của ngày thi đấu nên không thể mở kèo tìm đối.'));
    var teamName = String(sk.teamName || '').trim();
    if (teamName.length < 2) e.push(err('SEEK', 'Vui lòng nhập tên đội của bạn.'));
    if (!HH.LEVELS.some(function (l) { return l.id === sk.level; })) e.push(err('SEEK', 'Vui lòng chọn trình độ của đội.'));
    var size = HH.teamSize(court), have = Math.floor(Number(sk.havePlayers));
    if (!(have >= 1 && have <= size)) e.push(err('SEEK', 'Số người đã có phải từ 1 đến ' + size + '.'));
    var openOnDay = bookings.filter(function (b) { return HH.isOccupying(b) && b.date === input.date && HH.isSeekingOpen(b); }).length;
    if (openOnDay >= cfg.seek.maxPerDay) e.push(err('SEEK', 'Ngày ' + HH.fmtDate(input.date) + ' đã có ' + cfg.seek.maxPerDay + ' sân đang tìm đối (tối đa). Vui lòng chọn "Đã đủ người".'));
    var phoneOpen = bookings.filter(function (b) { return HH.isOccupying(b) && HH.isSeekingOpen(b) && b.phone === input.phone; }).length;
    if (phoneOpen >= 1) e.push(err('SEEK', 'Mỗi khách chỉ được mở 1 sân tìm đối tại một thời điểm.'));
    var m = HH.findMember(input.phone);
    if (m && HH.reputationOf(m) < cfg.seek.minReputation) e.push(err('SEEK', 'Điểm uy tín của bạn (' + HH.reputationOf(m) + ') chưa đạt mức tối thiểu ' + cfg.seek.minReputation + ' để mở kèo tìm đối.'));
    return e;
  };

  HH.newBookingId = function (bookings) {
    var used = {}; bookings.forEach(function (b) { used[b.id] = 1; });
    var id;
    do { id = 'HH' + String(Math.floor(100000 + Math.random() * 900000)); } while (used[id]);
    return id;
  };

  /** Dựng đối tượng đơn từ dữ liệu ĐÃ hợp lệ (dùng cho cả đơn thật lẫn dữ liệu mẫu). */
  HH.composeBooking = function (input, ctx) {
    var cfg = ctx.cfg, court = HH.getCourt(input.courtId, ctx.courts);
    var pb = HH.priceBreakdown(court, input.date, input.startHour, input.endHour, cfg, ctx.noFlash ? null : ctx.now);
    var sv = HH.calcServices(input.services, cfg, input.date, input.startHour, ctx.now);
    var discount = 0, promoCode = '';
    if (input.promoCode) {
      var pr = HH.applyPromo(input.promoCode, { courtAmount: pb.total, hasFlash: pb.hasFlash, allOffPeak: pb.allOffPeak, now: ctx.now });
      if (pr.ok) { discount = pr.discount; promoCode = pr.promo.code; }
    }
    var total = Math.max(0, pb.total - discount + sv.total);
    var depPct = input.depositPercent != null ? input.depositPercent : HH.depositPercentFor(input.phone, cfg);
    var created = ctx.createdAt || ctx.now.toISOString();
    var b = {
      id: input.id || HH.newBookingId(ctx.bookings),
      createdAt: created,
      customerName: String(input.customerName || '').trim(),
      phone: input.phone,
      note: String(input.note || '').trim(),
      courtId: court.id,
      date: input.date, startHour: input.startHour, endHour: input.endHour,
      lines: pb.lines, courtAmount: pb.total,
      services: sv.lines, servicesAmount: sv.total,
      promoCode: promoCode, discountAmount: discount,
      totalAmount: total,
      // Kèo tìm đối: tiền sân chia đôi, mỗi đội cọc theo % phần của mình (ví dụ trong báo cáo mục 4.9)
      depositPercent: depPct, depositAmount: round1000((input.seek ? total / 2 : total) * depPct / 100),
      status: input.status || 'pending',
      paymentStatus: input.paymentStatus || 'unpaid',
      paymentMethod: 'qr',
      source: input.source || 'web',
      seek: null,
      recurring: input.recurring || null,
      holdUntil: input.holdUntil !== undefined ? input.holdUntil : null,
      history: []
    };
    if (input.seek) {
      b.seek = {
        teamName: String(input.seek.teamName).trim(), level: input.seek.level,
        havePlayers: Math.floor(Number(input.seek.havePlayers)), teamSize: HH.teamSize(court),
        note: String(input.seek.note || '').trim(),
        opponent: input.seek.opponent || null
      };
    }
    b.history.push({ at: created, by: input.actor || (b.source === 'web' ? 'Khách hàng' : 'Quản trị viên'), action: 'Tạo đơn', note: 'Nguồn: ' + HH.sourceLabel(b.source) });
    return b;
  };

  /**
   * TẠO ĐƠN ĐẶT SÂN (hàm chính). Mọi kiểm tra đều chạy ở đây, ngay trước khi ghi.
   * input: { courtId, date, startHour, endHour, customerName, phone, note, services, promoCode, seek, source }
   * opts : { now, initialStatus, initialPayment, actor, allowCurrentHour }
   * Trả về { ok:true, booking } hoặc { ok:false, errors:[{code,message}] }
   */
  HH.RECURRING_MAX_DAYS = 120; // đặt cố định hằng tuần được đặt trước tối đa 120 ngày (12 tuần + thời gian bắt đầu)
  HH.createBooking = function (input, opts) {
    opts = opts || {};
    var now = opts.now || HH.now(), cfg = HH.getConfig(), courts = HH.getCourts(), bookings = HH.getBookings();
    var errors = [];
    var name = String(input.customerName || '').trim();
    var phone = HH.normalizePhone(input.phone);
    if (name.length < 2 || name.length > 60) errors.push(err('NAME', 'Vui lòng nhập họ tên người đặt (2–60 ký tự).'));
    if (!phone) errors.push(err('PHONE', 'Số điện thoại không hợp lệ (ví dụ: 0901234567).'));

    var v = HH.validateSlot(input, { now: now, cfg: cfg, courts: courts, bookings: bookings, allowCurrentHour: opts.allowCurrentHour, maxAdvanceDays: input.recurring ? HH.RECURRING_MAX_DAYS : 0 });
    errors = errors.concat(v.errors);
    if (v.court && phone) {
      if (input.seek) errors = errors.concat(HH.validateSeek({ date: input.date, startHour: Number(input.startHour), phone: phone, seek: input.seek }, v.court, { cfg: cfg, now: now, bookings: bookings }));
      var svc = HH.calcServices(input.services, cfg, input.date, Number(input.startHour), now);
      errors = errors.concat(svc.errors.map(function (m) { return err('SERVICE', m); }));
    }
    if (errors.length) return { ok: false, errors: errors };

    var data = HH.clone(input);
    data.customerName = name; data.phone = phone; data.startHour = Number(input.startHour); data.endHour = Number(input.endHour);
    data.status = opts.initialStatus || 'pending';
    data.paymentStatus = opts.initialPayment || 'unpaid';
    data.actor = opts.actor;
    // Đơn thường chưa cọc sẽ bị nhả chỗ sau holdMinutes phút. Kèo tìm đối thì giữ chỗ đến hạn chót 15:00.
    if (data.status === 'pending' && data.paymentStatus === 'unpaid' && cfg.autoReleaseHold && (input.source || 'web') === 'web' && !input.seek && !input.recurring) {
      data.holdUntil = new Date(now.getTime() + cfg.holdMinutes * 60000).toISOString();
    }
    var b = HH.composeBooking(data, { cfg: cfg, courts: courts, bookings: bookings, now: now });
    if (b.status === 'confirmed') b.confirmedAt = now.toISOString();
    bookings.push(b);
    HH.saveBookings(bookings);
    return { ok: true, booking: b };
  };

  /* ----------------------------------------------------------------------
     6. XÁC NHẬN / HỦY / THANH TOÁN / KHÔI PHỤC ĐƠN
     ---------------------------------------------------------------------- */
  function findIdx(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; }
  function log(b, by, action, note, now) { b.history.push({ at: (now || HH.now()).toISOString(), by: by || 'Quản trị viên', action: action, note: note || '' }); }
  HH.getBooking = function (id) { var l = HH.getBookings(), i = findIdx(l, id); return i < 0 ? null : l[i]; };

  /** Cập nhật 1 đơn rồi lưu (đọc lại dữ liệu mới nhất trước khi sửa). */
  function mutate(id, fn) {
    var list = HH.getBookings(), i = findIdx(list, id);
    if (i < 0) return { ok: false, errors: [err('NOTFOUND', 'Không tìm thấy đơn ' + id + '.')] };
    var res = fn(list[i], list);
    if (res && res.ok === false) return res;
    HH.saveBookings(list);
    return { ok: true, booking: list[i] };
  }

  HH.confirmBooking = function (id, actor, now) {
    now = now || HH.now();
    return mutate(id, function (b, list) {
      if (b.status !== 'pending') return { ok: false, errors: [err('STATE', 'Chỉ xác nhận được đơn đang "Chờ xác nhận".')] };
      var c = HH.findConflicts(b.courtId, b.date, b.startHour, b.endHour, { excludeId: b.id, bookings: list });
      if (c.length) return { ok: false, errors: [err('CONFLICT', 'Đơn này đang xung đột với đơn ' + c[0].booking.id + ' nên không thể xác nhận.')] };
      b.status = 'confirmed'; b.confirmedAt = now.toISOString(); b.holdUntil = null;
      log(b, actor, 'Xác nhận đơn', '', now);
    });
  };

  /** Chính sách hoàn cọc (mô phỏng) — lấy từ cfg.refundPolicy: hủy sớm hơn X giờ -> hoàn Y%. */
  HH.refundPercentFor = function (b, now, cfg) {
    cfg = cfg || HH.getConfig();
    var left = HH.hoursUntil(b.date, b.startHour, now || HH.now());
    var pol = (cfg.refundPolicy || []).slice().sort(function (a, c) { return c.hoursBefore - a.hoursBefore; });
    for (var i = 0; i < pol.length; i++) if (left >= pol[i].hoursBefore) return pol[i].percent;
    return 0;
  };
  HH.paidAmount = function (b) { return b.paymentStatus === 'paid' ? b.totalAmount : (b.paymentStatus === 'deposit' ? b.depositAmount : 0); };

  /**
   * HỦY ĐƠN: đơn chuyển sang "Đã hủy" và KHÔNG còn chiếm lịch — các sân liên quan tự mở lại
   * (trừ khi vẫn còn đơn hợp lệ khác chiếm cùng khung giờ, vì lịch luôn được tính lại từ danh sách đơn).
   * opts: { by, reason, refundMode: 'policy' | 'full' | 'none', now }
   */
  HH.cancelBooking = function (id, opts) {
    opts = opts || {}; var now = opts.now || HH.now(), cfg = HH.getConfig();
    return mutate(id, function (b) {
      if (b.status === 'cancelled') return { ok: false, errors: [err('STATE', 'Đơn này đã được hủy trước đó.')] };
      var paid = HH.paidAmount(b), pct = 0;
      var mode = opts.refundMode || 'policy';
      if (paid > 0) pct = mode === 'full' ? 100 : (mode === 'none' ? 0 : HH.refundPercentFor(b, now, cfg));
      var refund = round1000(paid * pct / 100);
      b.status = 'cancelled'; b.cancelledAt = now.toISOString(); b.cancelledBy = opts.by || 'Khách hàng';
      b.cancelReason = opts.reason || 'Khách yêu cầu hủy';
      b.refundAmount = refund; b.refundPercent = pct; b.holdUntil = null;
      if (refund > 0) b.paymentStatus = 'refunded';
      log(b, opts.by, 'Hủy đơn', b.cancelReason + (paid > 0 ? ' · hoàn cọc mô phỏng ' + pct + '% = ' + HH.fmtMoney(refund) : ''), now);
    });
  };

  /** Đánh dấu thanh toán MÔ PHỎNG (không có giao dịch ngân hàng thật). kind: 'deposit' | 'paid' */
  HH.markPayment = function (id, kind, actor, now) {
    now = now || HH.now(); var cfg = HH.getConfig();
    return mutate(id, function (b) {
      if (b.status === 'cancelled') return { ok: false, errors: [err('STATE', 'Đơn đã hủy, không thể cập nhật thanh toán.')] };
      if (kind !== 'deposit' && kind !== 'paid') return { ok: false, errors: [err('KIND', 'Loại thanh toán không hợp lệ.')] };
      if (b.paymentStatus === 'paid') return { ok: false, errors: [err('STATE', 'Đơn đã thanh toán đủ (mô phỏng).')] };
      if (kind === 'deposit' && b.paymentStatus === 'deposit') return { ok: false, errors: [err('STATE', 'Đơn đã được ghi nhận đặt cọc.')] };
      b.paymentStatus = kind; b.paidAt = now.toISOString(); b.holdUntil = null;
      log(b, actor, kind === 'deposit' ? 'Ghi nhận đặt cọc (mô phỏng)' : 'Ghi nhận thanh toán đủ (mô phỏng)', kind === 'deposit' ? HH.fmtMoney(b.depositAmount) : HH.fmtMoney(b.totalAmount), now);
      if (kind === 'deposit' && b.status === 'pending' && cfg.autoConfirmAfterDeposit) {
        b.status = 'confirmed'; b.confirmedAt = now.toISOString();
        log(b, 'Hệ thống', 'Tự động xác nhận', 'Cấu hình: tự xác nhận sau khi cọc', now);
      }
    });
  };

  /** Khôi phục đơn đã hủy -> chuyển lại "Chờ xác nhận" NẾU lịch còn trống (kiểm tra lại toàn bộ quy tắc). */
  HH.reopenBooking = function (id, actor, now) {
    now = now || HH.now();
    return mutate(id, function (b, list) {
      if (b.status !== 'cancelled') return { ok: false, errors: [err('STATE', 'Chỉ khôi phục được đơn đã hủy.')] };
      if (b.paymentStatus === 'refunded') return { ok: false, errors: [err('STATE', 'Đơn đã hoàn cọc, vui lòng tạo đơn mới thay vì khôi phục.')] };
      var v = HH.validateSlot(b, { now: now, excludeId: b.id, bookings: list, allowCurrentHour: true });
      if (!v.ok) return { ok: false, errors: v.errors };
      b.status = 'pending'; delete b.cancelledAt; delete b.cancelledBy; delete b.cancelReason; delete b.refundAmount; delete b.refundPercent;
      log(b, actor, 'Khôi phục đơn', 'Lịch còn trống nên đơn được giữ chỗ lại', now);
    });
  };

  /**
   * BẢO TRÌ TỰ ĐỘNG (chạy khi mở trang và mỗi 30 giây):
   *  - Nhả chỗ đơn "chờ thanh toán" quá hạn giữ chỗ (mặc định 10 phút).
   *  - Hủy kèo tìm đối chưa có đội nhận khi quá hạn chót (mặc định 15:00 ngày thi đấu).
   */
  HH.maintenance = function (now) {
    now = now || HH.now();
    var cfg = HH.getConfig(), list = HH.getBookings(), changed = 0;
    list.forEach(function (b) {
      if (b.status !== 'pending') return;
      if (b.holdUntil && b.paymentStatus === 'unpaid' && new Date(b.holdUntil) <= now) {
        b.status = 'cancelled'; b.cancelledAt = now.toISOString(); b.cancelledBy = 'Hệ thống';
        b.cancelReason = 'Hết hạn giữ chỗ: chưa đặt cọc đúng hạn';
        b.refundAmount = 0; b.refundPercent = 0; b.holdUntil = null;
        log(b, 'Hệ thống', 'Tự động hủy', b.cancelReason, now); changed++;
      }
    });
    // Đội nhận kèo không cọc đúng hạn -> bị loại, kèo mở lại.
    list.forEach(function (b) {
      var o = b.status === 'pending' || b.status === 'confirmed' ? b.seek && b.seek.opponent : null;
      if (o && !o.paid && o.payUntil && new Date(o.payUntil) <= now) {
        log(b, 'Hệ thống', 'Loại đội nhận kèo', 'Đội ' + o.teamName + ' chưa cọc sau ' + HH.SEEK_PAY_MINUTES + ' phút — kèo mở lại', now);
        b.seek.opponent = null; changed++;
      }
    });
    list.forEach(function (b) {
      if (!HH.isOccupying(b) || !HH.isSeekingOpen(b)) return;
      if (now >= HH.SEEK_DEADLINE(b.date, cfg)) {
        var paid = HH.paidAmount(b);
        b.status = 'cancelled'; b.cancelledAt = now.toISOString(); b.cancelledBy = 'Hệ thống';
        b.cancelReason = 'Quá hạn ' + HH.fmtHour(cfg.seek.deadlineHour) + ' chưa ghép được đối — sân được mở lại';
        b.refundAmount = paid; b.refundPercent = paid ? 100 : 0; if (paid) b.paymentStatus = 'refunded';
        log(b, 'Hệ thống', 'Tự động hủy kèo', b.cancelReason, now); changed++;
      }
    });
    if (changed) HH.saveBookings(list);
    return changed;
  };

  /* ----------------------------------------------------------------------
     7. TÌM ĐỐI (SÂN TÍM), GHÉP NGƯỜI, GIẢI ĐẤU
     ---------------------------------------------------------------------- */
  /** Danh sách kèo đang chờ đội nhận (sắp xếp theo thời gian thi đấu). */
  HH.listOpenSeeks = function () {
    return HH.getBookings().filter(function (b) { return HH.isOccupying(b) && HH.isSeekingOpen(b); })
      .sort(function (a, b) { return (a.date + HH.pad2(a.startHour)).localeCompare(b.date + HH.pad2(b.startHour)); });
  };

  /** Đội khách nhận kèo. input: { teamName, phone, level, players } */
  HH.joinSeek = function (bookingId, input, now) {
    now = now || HH.now(); var cfg = HH.getConfig();
    return mutate(bookingId, function (b) {
      if (!HH.isOccupying(b) || !b.seek) return { ok: false, errors: [err('STATE', 'Kèo này không còn tồn tại.')] };
      if (b.seek.opponent) return { ok: false, errors: [err('STATE', 'Kèo này đã có đội nhận.')] };
      if (now >= HH.SEEK_DEADLINE(b.date, cfg)) return { ok: false, errors: [err('STATE', 'Kèo đã quá hạn chót ' + HH.fmtHour(cfg.seek.deadlineHour) + '.')] };
      var team = String(input.teamName || '').trim(), phone = HH.normalizePhone(input.phone), pl = Math.floor(Number(input.players));
      if (team.length < 2) return { ok: false, errors: [err('TEAM', 'Vui lòng nhập tên đội của bạn.')] };
      if (!phone) return { ok: false, errors: [err('PHONE', 'Số điện thoại không hợp lệ.')] };
      if (phone === b.phone) return { ok: false, errors: [err('SELF', 'Bạn không thể nhận kèo do chính mình đăng.')] };
      if (!HH.LEVELS.some(function (l) { return l.id === input.level; })) return { ok: false, errors: [err('LEVEL', 'Vui lòng chọn trình độ của đội.')] };
      if (!(pl >= 1 && pl <= b.seek.teamSize)) return { ok: false, errors: [err('PLAYERS', 'Số người phải từ 1 đến ' + b.seek.teamSize + '.')] };
      var m = HH.findMember(phone);
      if (m && HH.reputationOf(m) < cfg.seek.minReputation) return { ok: false, errors: [err('REP', 'Điểm uy tín (' + HH.reputationOf(m) + ') chưa đạt mức tối thiểu ' + cfg.seek.minReputation + '.')] };
      // Ghép xong: MỖI đội phải cọc phần của mình trong vòng 60 phút (mô phỏng), nếu không đội chưa cọc bị loại / đơn tự hủy.
      var share = Math.round(b.totalAmount / 2 / 1000) * 1000, dep = Math.round(share * cfg.depositPercent / 100 / 1000) * 1000;
      var until = new Date(now.getTime() + HH.SEEK_PAY_MINUTES * 60000).toISOString();
      b.seek.opponent = { teamName: team, phone: phone, level: input.level, players: pl, joinedAt: now.toISOString(), depositAmount: dep, payUntil: until, paid: false };
      if (b.paymentStatus === 'unpaid') b.holdUntil = until; // đội chủ cũng có 60 phút để cọc
      log(b, 'Đội ' + team, 'Nhận kèo', 'Ghép đối thành công — hai đội cọc trong ' + HH.SEEK_PAY_MINUTES + ' phút, sân chuyển sang "đã đủ người"', now);
    });
  };
  HH.SEEK_PAY_MINUTES = 60;
  /** Đội nhận kèo bấm "đã thanh toán" (mô phỏng). */
  HH.markOpponentPaid = function (id, now) {
    now = now || HH.now();
    return mutate(id, function (b) {
      var o = b.seek && b.seek.opponent;
      if (!o || b.status === 'cancelled') return { ok: false, errors: [err('STATE', 'Kèo không còn đội nhận hoặc đã hủy.')] };
      if (o.paid) return { ok: false, errors: [err('STATE', 'Đội của bạn đã cọc rồi.')] };
      o.paid = true; o.paidAt = now.toISOString(); o.payUntil = null;
      log(b, 'Đội ' + o.teamName, 'Đội nhận kèo đã cọc (mô phỏng)', HH.fmtMoney(o.depositAmount), now);
    });
  };
  /** Đội nhận kèo rút lui -> kèo mở lại để đội khác nhận. */
  HH.leaveSeek = function (id, reason, now) {
    now = now || HH.now();
    return mutate(id, function (b) {
      var o = b.seek && b.seek.opponent;
      if (!o || b.status === 'cancelled') return { ok: false, errors: [err('STATE', 'Không có đội nhận kèo để rút.')] };
      log(b, 'Đội ' + o.teamName, 'Rút khỏi kèo', reason || 'Đội nhận kèo rút lui — kèo mở lại', now);
      b.seek.opponent = null;
      if (b.paymentStatus === 'unpaid') b.holdUntil = null; // kèo tìm đối giữ chỗ tới hạn chót
    });
  };

  HH.addPost = function (post) {
    var list = HH.getPosts();
    post.id = 'PL' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 100);
    post.createdAt = HH.now().toISOString(); post.joined = []; list.unshift(post);
    HH.savePosts(list); return post;
  };
  /** Xin tham gia kèo ghép người. */
  HH.joinPost = function (id, who) {
    var list = HH.getPosts(), p = list.filter(function (x) { return x.id === id; })[0];
    if (!p) return { ok: false, errors: [err('NOTFOUND', 'Không tìm thấy bài đăng.')] };
    var phone = HH.normalizePhone(who.phone), name = String(who.name || '').trim();
    if (name.length < 2) return { ok: false, errors: [err('NAME', 'Vui lòng nhập họ tên.')] };
    if (!phone) return { ok: false, errors: [err('PHONE', 'Số điện thoại không hợp lệ.')] };
    if (p.type === 'need_players' && p.joined.length >= p.needed) return { ok: false, errors: [err('FULL', 'Kèo này đã đủ người.')] };
    if (p.joined.some(function (j) { return j.phone === phone; })) return { ok: false, errors: [err('DUP', 'Số điện thoại này đã đăng ký kèo này rồi.')] };
    p.joined.push({ name: name, phone: phone, at: HH.now().toISOString() });
    HH.savePosts(list); return { ok: true, post: p };
  };

  HH.registerTeam = function (tournamentId, team) {
    var list = HH.getTournaments(), t = list.filter(function (x) { return x.id === tournamentId; })[0];
    if (!t) return { ok: false, errors: [err('NOTFOUND', 'Không tìm thấy giải đấu.')] };
    if (!t.registrationOpen) return { ok: false, errors: [err('CLOSED', 'Giải đấu đã đóng đăng ký.')] };
    if (t.teams.length >= t.maxTeams) return { ok: false, errors: [err('FULL', 'Giải đấu đã đủ ' + t.maxTeams + ' đội.')] };
    var name = String(team.name || '').trim(), phone = HH.normalizePhone(team.phone), pl = Math.floor(Number(team.players));
    if (name.length < 2) return { ok: false, errors: [err('NAME', 'Vui lòng nhập tên đội.')] };
    if (!phone) return { ok: false, errors: [err('PHONE', 'Số điện thoại không hợp lệ.')] };
    if (!(pl >= 5 && pl <= 15)) return { ok: false, errors: [err('PLAYERS', 'Số cầu thủ đăng ký từ 5 đến 15 người.')] };
    if (t.teams.some(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })) return { ok: false, errors: [err('DUP', 'Tên đội này đã được đăng ký.')] };
    t.teams.push({ name: name, phone: phone, players: pl, at: HH.now().toISOString(), paid: false });
    HH.saveTournaments(list); return { ok: true, tournament: t };
  };

  /* ----------------------------------------------------------------------
     8. THÀNH VIÊN, ĐIỂM THƯỞNG, ĐIỂM UY TÍN (mô phỏng, không phải hệ thống tích điểm thật)
     ---------------------------------------------------------------------- */
  HH.findMember = function (phone) {
    var p = HH.normalizePhone(phone); if (!p) return null;
    var l = HH.getMembers(); for (var i = 0; i < l.length; i++) if (l[i].phone === p) return l[i];
    return null;
  };
  HH.reputationOf = function (m) { return Math.max(0, Math.min(100, Number(m.reputation) || 0)); };
  HH.getSession = function () { var s = HH.load(K.session, null); return s && s.phone ? HH.findMember(s.phone) : null; };
  HH.login = function (phone) {
    var m = HH.findMember(phone);
    if (!m) return { ok: false, errors: [err('NOTFOUND', 'Chưa có tài khoản với số điện thoại này. Hãy đăng ký thành viên mới.')] };
    HH.save(K.session, { phone: m.phone }); return { ok: true, member: m };
  };
  HH.register = function (info) {
    var name = String(info.name || '').trim(), phone = HH.normalizePhone(info.phone);
    if (name.length < 2) return { ok: false, errors: [err('NAME', 'Vui lòng nhập họ tên.')] };
    if (!phone) return { ok: false, errors: [err('PHONE', 'Số điện thoại không hợp lệ (ví dụ: 0901234567).')] };
    if (HH.findMember(phone)) return { ok: false, errors: [err('DUP', 'Số điện thoại này đã đăng ký. Hãy đăng nhập.')] };
    var l = HH.getMembers();
    var m = { phone: phone, name: name, email: String(info.email || '').trim(), joinedAt: HH.now().toISOString(), reputation: 100, reputationLog: [{ date: HH.todayStr(), delta: 0, reason: 'Khởi tạo tài khoản — mỗi khách bắt đầu với 100 điểm uy tín' }], bonusPoints: 0 };
    l.push(m); HH.saveMembers(l); HH.save(K.session, { phone: phone });
    return { ok: true, member: m };
  };
  HH.isAdmin = function () { try { return localStorage.getItem('hh_admin_session') === '1'; } catch (e) { return false; } };
  HH.adminLogin = function (u, p) {
    var a = HH.ADMIN_ACCOUNT;
    if (String(u || '').trim() === a.user && String(p || '') === a.pass) { try { localStorage.setItem('hh_admin_session', '1'); } catch (e) { } return { ok: true }; }
    return { ok: false, message: 'Sai tài khoản hoặc mật khẩu quản trị.' };
  };
  HH.adminLogout = function () { try { localStorage.removeItem('hh_admin_session'); } catch (e) { } };
  HH.logout = function () { rawRemove(K.session); HH._emit(K.session, 'local'); };

  /** Hạng thành viên theo số giờ chơi trong 90 ngày gần nhất (mục 4.7). */
  HH.tierFor = function (hours, cfg) {
    var t = cfg.tiers, out = t[0];
    t.forEach(function (x) { if (hours >= x.minHours) out = x; });
    return out;
  };
  HH.memberStats = function (phone, now) {
    now = now || HH.now(); var cfg = HH.getConfig(), today = HH.todayStr(now);
    var m = HH.findMember(phone);
    var mine = HH.getBookings().filter(function (b) { return b.phone === HH.normalizePhone(phone); });
    var played = mine.filter(function (b) { return b.status === 'confirmed' && b.date <= today && HH.diffDays(today, b.date) <= 90; });
    var hours = played.reduce(function (s, b) { return s + (b.endHour - b.startHour); }, 0);
    var earned = mine.filter(function (b) { return b.status === 'confirmed' && (b.paymentStatus === 'paid' || b.paymentStatus === 'deposit'); })
      .reduce(function (s, b) { return s + Math.floor(b.totalAmount / cfg.pointsPerVnd); }, 0);
    var tier = HH.tierFor(hours, cfg);
    var idx = cfg.tiers.indexOf(tier), next = cfg.tiers[idx + 1] || null;
    return {
      member: m, hours90: hours, tier: tier, nextTier: next,
      points: earned + (m ? (m.bonusPoints || 0) : 0),
      reputation: m ? HH.reputationOf(m) : 100,
      upcoming: mine.filter(function (b) { return HH.isOccupying(b) && (b.date > today || (b.date === today && b.endHour > now.getHours())); })
        .sort(function (a, b) { return (a.date + HH.pad2(a.startHour)).localeCompare(b.date + HH.pad2(b.startHour)); }),
      history: mine.slice().sort(function (a, b) { return (b.date + HH.pad2(b.startHour)).localeCompare(a.date + HH.pad2(a.startHour)); })
    };
  };

  /* ----------------------------------------------------------------------
     9. THỐNG KÊ CHO ADMIN — mọi số liệu đều TÍNH LẠI từ danh sách đơn thật,
        nên luôn khớp với bảng "Quản lý đơn".
     ---------------------------------------------------------------------- */
  HH.periodRange = function (period, now) {
    var today = HH.todayStr(now || HH.now());
    switch (period) {
      case 'today': return { from: today, to: today, label: 'Hôm nay' };
      case 'next7': return { from: today, to: HH.addDays(today, 6), label: '7 ngày tới' };
      case 'past7': return { from: HH.addDays(today, -6), to: today, label: '7 ngày qua' };
      default: return { from: null, to: null, label: 'Tất cả đơn' };
    }
  };
  HH.inRange = function (b, range) { return (!range.from || b.date >= range.from) && (!range.to || b.date <= range.to); };

  /** Số giờ-sân VẬT LÝ bị chiếm (sân 7 tính bằng 3 sân 5). */
  HH.physicalHours = function (b, courts) {
    var c = HH.getCourt(b.courtId, courts); if (!c) return 0;
    return HH.resourcesOf(c).length * (b.endHour - b.startHour);
  };

  HH.computeStats = function (range, now) {
    now = now || HH.now();
    var courts = HH.getCourts(), cfg = HH.getConfig();
    var all = HH.getBookings().filter(function (b) { return HH.inRange(b, range); });
    var s = {
      range: range, total: all.length, pending: 0, confirmed: 0, cancelled: 0,
      revenue: 0, collected: 0, refunded: 0, toCollect: 0,
      occHours: 0, occGolden: 0, capacity: 0, capacityGolden: 0, fillRate: 0, fillGolden: 0,
      hourCounts: {}, dayRevenue: {}, courtCounts: {}, days: 0
    };
    all.forEach(function (b) {
      if (b.status === 'pending') s.pending++; else if (b.status === 'confirmed') s.confirmed++; else s.cancelled++;
      if (b.status === 'confirmed') { s.revenue += b.totalAmount; s.dayRevenue[b.date] = (s.dayRevenue[b.date] || 0) + b.totalAmount; }
      if (b.paymentStatus === 'deposit') s.collected += b.depositAmount;
      else if (b.paymentStatus === 'paid') s.collected += b.totalAmount;
      else if (b.paymentStatus === 'refunded') { s.refunded += (b.refundAmount || 0); }
      if (b.status !== 'cancelled' && b.paymentStatus === 'unpaid') s.toCollect += b.depositAmount;
      if (HH.isOccupying(b)) {
        var ph = HH.physicalHours(b, courts), c = HH.getCourt(b.courtId, courts), n = c ? HH.resourcesOf(c).length : 1;
        s.occHours += ph;
        for (var h = b.startHour; h < b.endHour; h++) {
          s.hourCounts[h] = (s.hourCounts[h] || 0) + 1;
          if (HH.isPeakHour(h, cfg)) s.occGolden += n;
        }
        s.courtCounts[b.courtId] = (s.courtCounts[b.courtId] || 0) + (b.endHour - b.startHour);
      }
    });
    // Công suất: 20 sân vật lý × số giờ mở cửa × số ngày
    var from = range.from, to = range.to;
    if (!from) {
      var dates = HH.getBookings().map(function (b) { return b.date; }).sort();
      from = dates[0] || HH.todayStr(now); to = dates[dates.length - 1] || from;
    }
    s.days = HH.diffDays(to, from) + 1;
    var phys = courts.filter(function (c) { return c.type === 5; }).length;
    var goldenHours = cfg.peakTo - cfg.peakFrom, openHours = HH.CLOSE_HOUR - HH.OPEN_HOUR;
    s.capacity = phys * openHours * s.days; s.capacityGolden = phys * goldenHours * s.days;
    s.fillRate = s.capacity ? s.occHours / s.capacity : 0;
    s.fillGolden = s.capacityGolden ? s.occGolden / s.capacityGolden : 0;
    s.dateFrom = from; s.dateTo = to;
    return s;
  };

  /** Phân loại 23 "sản phẩm đặt được" tại 1 khung giờ để vẽ biểu đồ tình trạng sân. */
  HH.courtStatusAt = function (date, hour, now) {
    var courts = HH.getCourts(), idx = HH.buildDayIndex(date), out = { booked: 0, holding: 0, seeking: 0, free: 0, blocked: 0, maintenance: 0, total: courts.length };
    courts.forEach(function (c) {
      if (!HH.courtIsBookable(c, courts)) { out.maintenance++; return; }
      var res = HH.resourcesOf(c), own = null, linked = null;
      res.forEach(function (r) { var b = idx[r + '|' + hour]; if (b) { if (b.courtId === c.id) own = b; else linked = b; } });
      if (own) out[HH.visualState(own)]++;
      else if (linked) out.blocked++;
      else out.free++;
    });
    return out;
  };

  /* Ảnh nền do bạn thêm (qua biến CSS) — chỉ áp dụng khi tên file có trong img/anh-co-san.js */
  HH.REAL_CSS_VARS = { 'trang-chu/hero.jpg': ['--hero-user'], 'giai-dau/live.jpg': ['--live-user'], 'tim-doi/bia.jpg': ['--community-user'], 'thanh-vien/bia.jpg': ['--member-user'], 'thanh-vien/avatar.jpg': ['--avatar-user'] };
  HH.hasReal = function (rel) { return realList().indexOf(rel) >= 0; };
  if (typeof document !== 'undefined') (function () {
    var st = document.documentElement.style;
    Object.keys(HH.REAL_CSS_VARS).forEach(function (k) { if (HH.hasReal(k)) st.setProperty(HH.REAL_CSS_VARS[k][0], "url('img/" + k + "')"); });
  })();
  /** Ảnh thật trong thư mục img/: nếu file .jpg chưa có thì thử .jpeg, .png, .webp rồi dùng ảnh minh họa dự phòng (?fb=...). */
  if (typeof document !== 'undefined') document.addEventListener('error', function (e) {
    var t = e.target; if (!t || t.tagName !== 'IMG') return;
    var m = /^(img\/[^?]+)\.(jpg|jpeg|png|webp)(\?fb=(.+))?$/i.exec(t.getAttribute('src') || ''); if (!m) return;
    var exts = ['jpg', 'jpeg', 'png', 'webp'], i = exts.indexOf(m[2].toLowerCase()), fb = m[4];
    t.dataset.hhSkip = '1'; // báo cho trình xử lý ảnh lỗi chung (user.js) bỏ qua lần này
    if (i >= 0 && i < exts.length - 1) t.setAttribute('src', m[1] + '.' + exts[i + 1] + (fb ? '?fb=' + fb : ''));
    else if (fb) t.setAttribute('src', fb);
  }, true);

  /* ----------------------------------------------------------------------
     10. ĐỒNG BỘ, KHỞI TẠO, DỮ LIỆU MẪU, SAO LƯU
     ---------------------------------------------------------------------- */
  HH.sourceLabel = function (s) { return ({ web: 'Website', zalo: 'Zalo', hotline: 'Hotline', counter: 'Tại quầy', admin: 'Quản trị' })[s] || s; };

  function validCourts(c) {
    return Array.isArray(c) && c.length === 23 && c.every(function (x) { return x && x.id && (x.type === 5 || x.type === 7); });
  }

  /** Tạo dữ liệu mẫu lần đầu — KHÔNG ghi đè dữ liệu người dùng đã lưu. */
  HH.ensureSeed = function () {
    var need = {};
    var meta = HH.load(K.meta, null);
    if (meta && ((meta.version || 0) < HH.DATA_VERSION || (meta.demoDate || '') !== (HH.DEMO_DATE || ''))) { // dữ liệu mẫu bản cũ -> nạp lại bản mới (chỉ áp dụng cho dữ liệu mẫu cũ)
      Object.keys(K).forEach(function (k) { if (k !== 'session') rawRemove(K[k]); });
    }
    need.courts = !validCourts(HH.load(K.courts, null));
    ['bookings', 'promos', 'tournaments', 'posts', 'members'].forEach(function (k) { need[k] = !Array.isArray(HH.load(K[k], null)); });
    var cfg = HH.load(K.config, null);
    need.config = !cfg || typeof cfg !== 'object' || !cfg.services;
    var any = Object.keys(need).some(function (k) { return need[k]; });
    if (!any) return false;
    var seed = HH.buildSeed(HH.now());
    Object.keys(need).forEach(function (k) { if (need[k]) rawSet(K[k], JSON.stringify(seed[k])); });
    rawSet(K.meta, JSON.stringify({ seededAt: HH.now().toISOString(), version: HH.DATA_VERSION, demoDate: HH.DEMO_DATE || '' }));
    HH._emit('seed', 'local');
    return true;
  };

  /** Khôi phục toàn bộ dữ liệu mẫu (Admin gọi sau khi đã hỏi xác nhận). */
  HH.resetAll = function () {
    Object.keys(K).forEach(function (k) { if (k !== 'session') rawRemove(K[k]); });
    HH.ensureSeed();
    HH.save(K.meta, { seededAt: HH.now().toISOString(), version: HH.DATA_VERSION, demoDate: HH.DEMO_DATE || '', resetAt: HH.now().toISOString() });
  };

  HH.exportBackup = function () {
    var o = { app: 'HUYHOANG-Booking', version: HH.DATA_VERSION, exportedAt: HH.now().toISOString(), data: {} };
    ['courts', 'bookings', 'config', 'promos', 'tournaments', 'posts', 'members'].forEach(function (k) { o.data[k] = HH.load(K[k], null); });
    return JSON.stringify(o, null, 2);
  };
  HH.importBackup = function (text) {
    var o; try { o = JSON.parse(text); } catch (e) { return { ok: false, errors: [err('JSON', 'File sao lưu không đọc được (không phải JSON hợp lệ).')] }; }
    if (!o || o.app !== 'HUYHOANG-Booking' || !o.data) return { ok: false, errors: [err('FORMAT', 'File này không phải bản sao lưu của HUY HOÀNG Booking.')] };
    var d = o.data;
    if (!validCourts(d.courts) || !Array.isArray(d.bookings) || !d.config || !d.config.services) return { ok: false, errors: [err('FORMAT', 'Bản sao lưu thiếu dữ liệu sân/đơn/cấu hình.')] };
    ['courts', 'bookings', 'config', 'promos', 'tournaments', 'posts', 'members'].forEach(function (k) { if (d[k] != null) rawSet(K[k], JSON.stringify(d[k])); });
    HH._emit('import', 'local');
    return { ok: true };
  };

  /* ----------------------------------------------------------------------
     QUẢN LÝ SÂN (Admin): bật/tắt, đổi giá, xem lịch sử dụng.
     Không cho đổi cấu trúc sân (loại sân, liên kết 5 ↔ 7) để dữ liệu đặt sân luôn hợp lệ.
     ---------------------------------------------------------------------- */
  HH.setCourtActive = function (id, active) {
    var cs = HH.getCourts(), c = HH.getCourt(id, cs);
    if (!c) return { ok: false, errors: [err('NOTFOUND', 'Không tìm thấy sân.')] };
    c.active = !!active; HH.saveCourts(cs); return { ok: true, court: c };
  };
  HH.setCourtPrices = function (id, off, peak) {
    off = Number(off); peak = Number(peak);
    var e = [];
    if (!Number.isInteger(off) || off < 10000 || off > 5000000) e.push(err('PRICE', 'Giá giờ thường phải là số nguyên từ 10.000đ đến 5.000.000đ.'));
    if (!Number.isInteger(peak) || peak < 10000 || peak > 5000000) e.push(err('PRICE', 'Giá giờ vàng phải là số nguyên từ 10.000đ đến 5.000.000đ.'));
    if (!e.length && peak < off) e.push(err('PRICE', 'Giá giờ vàng không được thấp hơn giá giờ thường (giá sàn của flash sale).'));
    if (e.length) return { ok: false, errors: e };
    var cs = HH.getCourts(), c = HH.getCourt(id, cs);
    if (!c) return { ok: false, errors: [err('NOTFOUND', 'Không tìm thấy sân.')] };
    c.priceOff = off; c.pricePeak = peak; HH.saveCourts(cs); // đơn đã tạo giữ nguyên giá cũ (đã lưu theo từng giờ trong đơn)
    return { ok: true, court: c };
  };
  /** Mọi đơn (mọi trạng thái) dùng chung sân vật lý với sân này, kèm quan hệ same/component/parent. */
  HH.courtUsage = function (courtId) {
    var courts = HH.getCourts(), c = HH.getCourt(courtId, courts); if (!c) return [];
    var mine = HH.resourcesOf(c), out = [];
    HH.getBookings().forEach(function (b) {
      var bc = HH.getCourt(b.courtId, courts); if (!bc) return;
      if (!HH.resourcesOf(bc).some(function (r) { return mine.indexOf(r) >= 0; })) return;
      out.push({ booking: b, relation: bc.id === c.id ? 'same' : (c.type === 7 ? 'component' : 'parent') });
    });
    return out.sort(function (a, b) { return (b.booking.date + HH.pad2(b.booking.startHour)).localeCompare(a.booking.date + HH.pad2(a.booking.startHour)); });
  };
  HH.upcomingUsageCount = function (courtId, now) {
    now = now || HH.now(); var today = HH.todayStr(now);
    return HH.courtUsage(courtId).filter(function (u) { return HH.isOccupying(u.booking) && (u.booking.date > today || (u.booking.date === today && u.booking.endHour > now.getHours())); }).length;
  };
  HH.deletePost = function (id) { var l = HH.getPosts().filter(function (p) { return p.id !== id; }); HH.savePosts(l); };
  HH.adjustReputation = function (phone, delta, reason) {
    delta = Math.round(Number(delta));
    if (!delta || Math.abs(delta) > 100) return { ok: false, errors: [err('DELTA', 'Mức điều chỉnh phải khác 0 và không quá 100 điểm.')] };
    if (!String(reason || '').trim()) return { ok: false, errors: [err('REASON', 'Vui lòng ghi lý do điều chỉnh.')] };
    var l = HH.getMembers(), p = HH.normalizePhone(phone), m = l.filter(function (x) { return x.phone === p; })[0];
    if (!m) return { ok: false, errors: [err('NOTFOUND', 'Khách này chưa là thành viên nên chưa có điểm uy tín.')] };
    m.reputation = Math.max(0, Math.min(100, HH.reputationOf(m) + delta));
    m.reputationLog.push({ date: HH.todayStr(), delta: delta, reason: String(reason).trim() });
    HH.saveMembers(l); return { ok: true, member: m };
  };
  /** Danh sách khách hàng suy ra từ các đơn (+ thông tin thành viên nếu có). */
  HH.customers = function () {
    var map = {}, cfg = HH.getConfig(), today = HH.todayStr();
    HH.getBookings().forEach(function (b) {
      var c = map[b.phone] || (map[b.phone] = { phone: b.phone, name: b.customerName, orders: 0, cancelled: 0, hours: 0, spent: 0, last: '' });
      c.orders++; if (b.status === 'cancelled') c.cancelled++;
      if (b.status === 'confirmed') { c.spent += b.totalAmount; if (b.date <= today && HH.diffDays(today, b.date) <= 90) c.hours += b.endHour - b.startHour; }
      if (b.date > c.last) { c.last = b.date; c.name = b.customerName; }
    });
    HH.getMembers().forEach(function (m) { var c = map[m.phone] || (map[m.phone] = { phone: m.phone, name: m.name, orders: 0, cancelled: 0, hours: 0, spent: 0, last: '' }); c.member = m; c.reputation = HH.reputationOf(m); });
    return Object.keys(map).map(function (k) { var c = map[k]; c.tier = HH.tierFor(c.hours, cfg); return c; });
  };

  var maintTimer = null;
  /** Gọi 1 lần khi mở trang: tạo dữ liệu mẫu (nếu cần), chạy bảo trì, bật bộ đếm 30 giây. */
  HH.init = function () {
    HH.ensureSeed();
    HH.maintenance();
    if (!maintTimer) maintTimer = setInterval(function () { HH.maintenance(); }, 30000);
  };
})(window);
