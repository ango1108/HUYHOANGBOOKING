/* ==========================================================================
   HUY HOÀNG Football Booking — user.js
   Giao diện KHÁCH HÀNG (index.html). Trang đơn (single page) chuyển trang bằng địa chỉ #/...
     #/                 Trang chủ
     #/dat-san          Đặt sân (lưới lịch + danh sách thẻ + bộ lọc)
     #/san/A1           Chi tiết sân
     #/dat/A1?date=&start=&end=   Xác nhận thông tin đặt sân
     #/don/HH123456     Thanh toán mô phỏng / kết quả đơn
     #/tim-doi          Tìm đối thủ & ghép người
     #/giai-dau         Giải đấu, dịch vụ bổ sung, livestream minh họa
     #/thanh-vien       Thành viên, điểm, khuyến mãi
   Mọi quy tắc nghiệp vụ nằm trong script.js (HH.*) — file này chỉ hiển thị và gọi hàm.
   ========================================================================== */
(function () {
  'use strict';
  var HH = window.HH, ic = HH.icon, esc = HH.esc, money = HH.fmtMoney;
  HH.init();

  var $app = document.getElementById('app');
  var page = null;          // trang đang hiển thị: { onData(), destroy() }
  var timers = [];          // bộ đếm cần dọn khi đổi trang

  /* ======================================================================
     TIỆN ÍCH GIAO DIỆN
     ====================================================================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(root, event, selector, fn) {
    root.addEventListener(event, function (e) {
      var t = e.target.closest(selector);
      if (t && root.contains(t)) fn(e, t);
    });
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

  function toast(type, title, msgs) {
    var box = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    var icon = type === 'ok' ? 'circle-check' : (type === 'bad' ? 'circle-x' : (type === 'warn' ? 'triangle-alert' : 'info'));
    var list = msgs && msgs.length ? '<ul>' + msgs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '';
    el.innerHTML = ic(icon, 20) + '<div><b>' + esc(title) + '</b>' + list + '</div>';
    box.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(function () { el.remove(); }, 300); }, type === 'bad' ? 7000 : 4200);
  }
  function toastErrors(res, title) { toast('bad', title || 'Không thực hiện được', (res.errors || []).map(function (e) { return e.message; })); }

  var modalStack = [];
  function openModal(o) {
    var root = document.getElementById('modal-root');
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true"><div class="modal-head"><h3>' + o.title + '</h3><button class="icon-btn" style="color:#111" data-close aria-label="Đóng">' + ic('x', 20) + '</button></div><div class="modal-body">' + o.body + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div>';
    root.appendChild(ov);
    var api = { el: ov, close: function () { ov.remove(); modalStack = modalStack.filter(function (m) { return m !== api; }); } };
    modalStack.push(api);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) api.close(); });
    on(ov, 'click', '[data-close]', function () { api.close(); });
    if (o.onMount) o.onMount(ov, api);
    var first = $('input,select,textarea', ov); if (first && !o.noFocus) setTimeout(function () { first.focus(); }, 30);
    return api;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close(); });
  function confirmBox(title, msg, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false;
      var m = openModal({ title: title, size: 'sm', noFocus: true, body: '<p style="margin:0">' + msg + '</p>',
        foot: '<button class="btn btn-outline" data-close>Quay lại</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" id="cf-ok">' + esc(okLabel || 'Đồng ý') + '</button>',
        onMount: function (el, api) { $('#cf-ok', el).onclick = function () { done = true; api.close(); resolve(true); }; } });
      var origClose = m.close; m.close = function () { origClose(); if (!done) resolve(false); };
    });
  }

  // Ảnh lỗi (mất mạng, sai đường dẫn…) -> thay bằng nền xanh dự phòng, không để khung trống
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset.hhSkip) { delete t.dataset.hhSkip; return; }
    if (t && t.tagName === 'IMG' && !t.dataset.failed) {
      t.dataset.failed = '1';
      t.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14702f"/><stop offset="1" stop-color="#04210f"/></linearGradient></defs><rect width="160" height="100" fill="url(#g)"/><circle cx="80" cy="50" r="18" fill="none" stroke="#7cdc2e" stroke-width="3" opacity=".7"/><path d="M0 50h160" stroke="#7cdc2e" stroke-width="2" opacity=".4"/></svg>');
    }
  }, true);

  function levelBadge(id) { var l = HH.levelOf(id); return '<span class="lvl" style="background:' + l.color + '">' + esc(l.label) + '</span>'; }
  function statusChip(b) { var s = HH.STATUS[b.status]; return '<span class="chip ' + s.cls + '">' + s.label + '</span>'; }
  function payChip(b, short) { var p = HH.PAYMENT[b.paymentStatus]; return '<span class="chip ' + p.cls + '">' + (short ? p.short : p.label) + '</span>'; }
  function initials(name) { var p = String(name || '?').trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase(); }
  function empty(icon, title, msg, action) { return '<div class="empty">' + ic(icon, 44) + '<b>' + title + '</b>' + (msg || '') + (action ? '<div class="mt16">' + action + '</div>' : '') + '</div>'; }
  function windowOf(id) { return HH.TIME_WINDOWS.filter(function (w) { return w.id === id; })[0] || HH.TIME_WINDOWS[0]; }
  function dateChips(sel, cur) {
    var t = HH.todayStr();
    var arr = [[t, 'Hôm nay'], [HH.addDays(t, 1), 'Ngày mai'], [HH.addDays(t, 2), HH.fmtDateDM(HH.addDays(t, 2))]];
    return arr.map(function (a) { return '<button type="button" class="dchip ' + (cur === a[0] ? 'on' : '') + '" data-date="' + a[0] + '">' + a[1] + '</button>'; }).join('');
  }
  function courtMinPrice(c) { return Math.min(c.priceOff, c.pricePeak); }
  function courtPriceText(c) { return c.priceOff === c.pricePeak ? money(c.priceOff) : 'từ ' + money(courtMinPrice(c)); }
  function parseQuery(s) { var q = {}; (s || '').split('&').forEach(function (p) { if (!p) return; var kv = p.split('='); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }); return q; }
  function cleanup() { timers.forEach(clearInterval); timers = []; if (page && page.destroy) page.destroy(); page = null; var sb = $('#sel-bar'); if (sb) sb.remove(); }
  function amenIcons(c, max) { return c.amenities.slice(0, max || 4).map(function (a) { var m = HH.AMENITIES[a]; return '<span title="' + m.label + '">' + ic(m.icon, 13) + m.label + '</span>'; }).join(''); }

  /* ======================================================================
     HEADER / FOOTER / ĐĂNG NHẬP MÔ PHỎNG
     ====================================================================== */
  function renderHeader() {
    var m = HH.getSession(), box = document.getElementById('header-actions');
    var user = m
      ? '<div style="position:relative"><button class="user-pill" id="user-btn"><span class="avatar' + (m.phone === HH.DEMO_PHONE ? ' me' : '') + '">' + esc(initials(m.name)) + '</span><span class="hide-sm">' + esc(m.name) + '</span>' + ic('chevron-down', 14) + '</button><div class="menu-pop hide" id="user-menu"><a href="#/thanh-vien">' + ic('user-round', 16) + 'Tài khoản thành viên</a><button id="logout-btn">' + ic('log-out', 16) + 'Đăng xuất</button></div></div>'
      : '<button class="btn btn-ghost btn-sm hide-sm" data-auth="login">Đăng nhập</button><button class="btn btn-primary btn-sm" data-auth="register">Đăng ký</button>';
    box.innerHTML = '<button class="icon-btn" id="lookup-btn" title="Tra cứu đơn đặt sân" aria-label="Tra cứu đơn">' + ic('search', 20) + '</button>' + user;
    $('#menu-btn').innerHTML = ic('menu', 22);
  }
  function setNav(key) { $$('#nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === key); }); $('#nav').classList.remove('open'); }
  document.getElementById('menu-btn').onclick = function () { $('#nav').classList.toggle('open'); };
  on(document, 'click', '[data-auth]', function (e, t) { authModal(t.dataset.auth); });
  on(document, 'click', '#lookup-btn', function () { lookupModal(); });
  on(document, 'click', '#user-btn', function () { $('#user-menu').classList.toggle('hide'); });
  on(document, 'click', '#logout-btn', function () { HH.logout(); renderHeader(); toast('ok', 'Đã đăng xuất'); route(); });
  document.addEventListener('click', function (e) { var m = $('#user-menu'); if (m && !e.target.closest('#user-btn') && !e.target.closest('#user-menu')) m.classList.add('hide'); });

  function renderFooter() {
    var c = HH.getConfig().contact;
    document.getElementById('footer').innerHTML = '<div class="container"><div class="footer-grid">' +
      '<div><div class="brand" style="color:#fff"><img src="assets/images/logo.svg" alt=""><span class="brand-name">HUY HOÀNG<small>FOOTBALL BOOKING</small></span></div><p style="margin-top:14px;max-width:300px">Cụm 20 sân 5 người và 3 sân 7 người tại Bình Thạnh, TP. Hồ Chí Minh. Sân đẹp – Giá tốt – Đặt nhanh.</p></div>' +
      '<div><h4>Khám phá</h4><a href="#/gioi-thieu">Giới thiệu sân bóng</a><a href="#/dat-san">Đặt sân</a><a href="#/tim-doi">Tìm đối &amp; ghép người</a><a href="#/giai-dau">Giải đấu</a><a href="#/thanh-vien">Thành viên &amp; ưu đãi</a></div>' +
      '<div><h4>Hỗ trợ</h4><a href="#/dat-san">Hướng dẫn đặt sân</a><a href="#/san/A1">Chính sách cọc &amp; hủy</a><a href="admin.html">Trang quản trị (demo)</a></div>' +
      '<div><h4>Liên hệ</h4><div class="li">' + ic('map-pin', 15) + '<span>' + esc(c.address) + '</span></div><div class="li">' + ic('phone', 15) + '<span>' + esc(c.phone) + ' (Hotline/Zalo minh họa)</span></div><div class="li">' + ic('mail', 15) + '<span>' + esc(c.email) + '</span></div><div class="li">' + ic('clock', 15) + '<span>' + esc(c.hours) + '</span></div></div>' +
      '</div><div class="footer-note">© 2026 HUY HOÀNG Football Booking – Website <b>mô phỏng</b> phục vụ học phần Thiết kế và xây dựng website thương mại điện tử (sản phẩm của nhóm 4 sinh viên) – không có giao dịch, thanh toán hay đặt sân thật. Dữ liệu lưu trên trình duyệt (localStorage).</div></div>';
  }

  function authModal(tab) {
    var body = '<div class="seg" style="margin-bottom:14px"><button data-tab="login" class="' + (tab === 'login' ? 'on' : '') + '">Đăng nhập</button><button data-tab="register" class="' + (tab === 'register' ? 'on' : '') + '">Đăng ký</button></div>' +
      '<div class="notice warn" style="margin-bottom:12px">' + ic('info', 16) + '<span>Đăng nhập <b>mô phỏng</b>: chỉ cần số điện thoại, không có mật khẩu và không bảo mật thật.</span></div>' +
      '<div class="form-grid"><div class="field full ' + (tab === 'login' ? 'hide' : '') + '" id="au-name-f"><label>Họ và tên</label><input class="input" id="au-name" placeholder="Nguyễn Văn A"></div>' +
      '<div class="field full"><label>Số điện thoại</label><input class="input" id="au-phone" inputmode="tel" placeholder="0901234567"></div>' +
      '<div class="field full ' + (tab === 'login' ? 'hide' : '') + '" id="au-mail-f"><label>Email (không bắt buộc)</label><input class="input" id="au-mail" placeholder="ban@example.com"></div></div>' +
      '<div id="au-err" class="field-err mt8"></div><button class="btn btn-soft btn-block mt8" id="au-demo">' + ic('sparkles', 16) + ' Dùng tài khoản demo (Nguyễn Văn A – ' + HH.DEMO_PHONE + ')</button>';
    var cur = tab;
    openModal({ title: 'Tài khoản thành viên', body: body, foot: '<a class="btn-admin-login" id="au-admin" href="admin.html" title="Đăng nhập tài khoản quản trị (demo)">' + ic('settings', 14) + ' Quản trị</a><span class="grow"></span><button class="btn btn-outline" data-close>Đóng</button><button class="btn btn-primary" id="au-ok">Tiếp tục</button>', onMount: function (el, api) {
      function setTab(t) { cur = t; $$('.seg button', el).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); $('#au-name-f', el).classList.toggle('hide', t === 'login'); $('#au-mail-f', el).classList.toggle('hide', t === 'login'); $('#au-ok', el).textContent = t === 'login' ? 'Đăng nhập' : 'Đăng ký'; }
      setTab(tab);
      on(el, 'click', '.seg button', function (e, b) { setTab(b.dataset.tab); });
      function done(res) { if (!res.ok) { $('#au-err', el).textContent = res.errors[0].message; return; } api.close(); renderHeader(); toast('ok', 'Xin chào ' + res.member.name + '!'); route(); }
      $('#au-ok', el).onclick = function () { done(cur === 'login' ? HH.login($('#au-phone', el).value) : HH.register({ name: $('#au-name', el).value, phone: $('#au-phone', el).value, email: $('#au-mail', el).value })); };
      $('#au-demo', el).onclick = function () { done(HH.login(HH.DEMO_PHONE)); };
    } });
  }
  function lookupModal() {
    openModal({ title: 'Tra cứu đơn đặt sân', body: '<div class="form-grid"><div class="field full"><label>Mã đơn</label><input class="input" id="lk-id" placeholder="HH123456" style="text-transform:uppercase"></div><div class="field full"><label>Số điện thoại đã đặt</label><input class="input" id="lk-phone" placeholder="0901234567"></div></div><div id="lk-err" class="field-err mt8"></div>',
      foot: '<button class="btn btn-outline" data-close>Đóng</button><button class="btn btn-primary" id="lk-ok">Tra cứu</button>', onMount: function (el, api) {
        $('#lk-ok', el).onclick = function () {
          var id = $('#lk-id', el).value.trim().toUpperCase(), ph = HH.normalizePhone($('#lk-phone', el).value), b = HH.getBooking(id);
          if (!b || !ph || b.phone !== ph) { $('#lk-err', el).textContent = 'Không tìm thấy đơn khớp mã và số điện thoại.'; return; }
          api.close(); go('#/don/' + b.id);
        };
      } });
  }

  /* ======================================================================
     TRANG CHỦ
     ====================================================================== */
  function pageHome() {
    var cfg = HH.getConfig(), courts = HH.getCourts(), today = HH.todayStr();
    var featured = ['A1', 'A12', 'V1', 'A18'].map(function (id) { return HH.getCourt(id, courts); }).filter(Boolean);
    var open = HH.listOpenSeeks().length;
    var maxFlash = Math.max.apply(null, cfg.flash.tiers.map(function (t) { return t.percent; }));
    var promos = HH.getPromos().filter(function (p) { return p.active; });
    var tours = HH.getTournaments().filter(function (t) { return t.registrationOpen; }).slice(0, 3);
    setNav('home');
    $app.innerHTML = '<div class="page-enter">' +
      '<section class="hero"><div class="container"><h1>HUY HOÀNG</h1><h2>Đặt sân bóng trực tuyến</h2><p>Sân đẹp - Giá tốt - Đặt nhanh</p><div class="cta"><a class="btn btn-primary btn-lg" href="#/dat-san">Đặt sân ngay ' + ic('arrow-right', 18) + '</a><a class="btn btn-ghost btn-lg" href="#/tim-doi">' + ic('swords', 18) + ' Tìm đối thủ</a></div></div></section>' +
      '<div class="container"><form class="search-card" id="home-search">' +
      '<div class="sc-field">' + ic('calendar', 22) + '<div><small>Ngày đá</small><input type="date" class="input" id="hs-date" value="' + today + '" min="' + today + '" max="' + HH.addDays(today, cfg.maxAdvanceDays) + '"></div></div>' +
      '<div class="sc-field">' + ic('clock', 22) + '<div><small>Khung giờ</small><select class="select" id="hs-win">' + HH.TIME_WINDOWS.map(function (w) { return '<option value="' + w.id + '">' + w.label + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="sc-field">' + ic('users', 22) + '<div><small>Loại sân</small><select class="select" id="hs-type"><option value="5">Sân 5 người</option><option value="7">Sân 7 người</option><option value="all">Sân 5 hoặc sân 7</option></select></div></div>' +
      '<button class="btn btn-primary btn-lg" type="submit">Tìm sân trống ' + ic('arrow-right', 18) + '</button></form>' +
      '<section class="section"><div class="section-head"><h2>Sân nổi bật</h2><a class="link-more" href="#/dat-san?view=grid">Xem tất cả ' + ic('arrow-right', 14) + '</a></div><div class="court-grid" id="home-featured"></div></section>' +
      '<section class="section"><div class="promo-row">' +
      '<div class="promo-card flash">' + '<div class="ic-big">' + ic('clock', 30) + '</div><div><h3>Giờ vàng &amp; Flash Sale</h3><p>Giá giờ chót giảm đến ' + maxFlash + '% khi sân còn trống sát giờ đá.</p><a class="btn btn-primary btn-sm" href="#/dat-san?type=5&win=all">Xem ưu đãi ' + ic('zap', 14) + '</a></div></div>' +
      '<div class="promo-card seek"><div class="ic-big">' + ic('swords', 30) + '</div><div><h3>Kèo đang tìm đối</h3><p>' + (open ? 'Hiện có ' + open + ' kèo đang chờ đối thủ.' : 'Chưa có kèo nào, hãy là người đăng đầu tiên.') + '</p><a class="btn btn-sm" style="background:#fff;color:#5b30c8" href="#/tim-doi">Xem kèo ' + ic('arrow-right', 14) + '</a></div></div>' +
      '<div class="card explore"><h3>Khám phá thêm</h3><div class="items"><a href="#/tim-doi"><span class="ic-wrap">' + ic('users', 20) + '</span>Tìm đối</a><a href="#/dat-san?type=5&win=morning"><span class="ic-wrap">' + ic('tag', 20) + '</span>Giờ giá tốt</a><a href="#/giai-dau"><span class="ic-wrap">' + ic('trophy', 20) + '</span>Giải đấu</a></div></div></div></section>' +
      '<section class="section"><div class="section-head"><h2>Mã khuyến mãi</h2><a class="link-more" href="#/thanh-vien">Ưu đãi thành viên ' + ic('arrow-right', 14) + '</a></div><div class="feature-grid" id="home-promos">' +
      promos.map(function (p) { return voucherHtml(p); }).join('') + '</div></section>' +
      '<section class="section"><div class="section-head"><h2>Dịch vụ &amp; tiện ích</h2></div><div class="feature-grid">' +
      [['calendar-check', 'Lịch trống minh bạch', 'Xem giá và tình trạng từng khung giờ của cả 23 lựa chọn sân.'], ['shield-check', 'Ghép sân 5 ↔ 7 chính xác', 'Đặt sân 7 thì 3 sân 5 tự khóa, không bao giờ trùng lịch.'], ['swords', 'Tìm đối ngay khi đặt', 'Chưa có đối? Mở kèo tìm đối, hệ thống tự hủy nếu quá 15:00 chưa ghép được.'], ['video', 'Livestream & highlight', 'Quay, bình luận và xem lại trận đấu của bạn (dịch vụ cộng thêm).'], ['droplets', 'Nước, bóng, tủ đồ', 'Thuê bóng, áo bib, nước uống và phòng tắm ngay khi đặt sân.'], ['medal', 'Thành viên & điểm uy tín', 'Tích điểm, lên hạng Bạc – Vàng, cọc thấp khi uy tín cao.']].map(function (f) { return '<div class="card feature"><span class="ic-wrap">' + ic(f[0], 22) + '</span><h4>' + f[1] + '</h4><p>' + f[2] + '</p></div>'; }).join('') + '</div></section>' +
      (tours.length ? '<section class="section"><div class="section-head"><h2>Giải đấu sắp diễn ra</h2><a class="link-more" href="#/giai-dau">Xem tất cả ' + ic('arrow-right', 14) + '</a></div><div class="tour-grid">' + tours.map(tourCard).join('') + '</div></section>' : '') +
      '<section class="section"><div class="card card-pad row wrap" style="gap:20px"><span class="ic-wrap" style="width:54px;height:54px">' + ic('map-pin', 26) + '</span><div class="grow"><h3 style="font-size:18px">Địa chỉ &amp; liên hệ</h3><p class="muted" style="margin:4px 0 0">' + esc(cfg.contact.address) + ' · Hotline/Zalo ' + esc(cfg.contact.phone) + ' · Mở cửa ' + esc(cfg.contact.hours) + '</p></div><a class="btn btn-dark" href="#/dat-san">Đặt sân ngay</a></div></section>' +
      '</div></div>';
    $('#home-featured').innerHTML = featured.map(function (c) { return courtCardHtml(c, today); }).join('');
    $('#home-search').onsubmit = function (e) {
      e.preventDefault();
      var d = $('#hs-date').value; if (!HH.isValidDateStr(d) || d < today) { toast('bad', 'Ngày đá không hợp lệ', ['Vui lòng chọn ngày từ hôm nay trở đi.']); return; }
      go('#/dat-san?type=' + $('#hs-type').value + '&date=' + d + '&win=' + $('#hs-win').value + '&view=grid');
    };
    wireCommon($app);
    /* VIDEO NỀN (kiểu swimply.com): img/video/hero.mp4 / hero.webm (ghi trong img/anh-co-san.js) chạy ngầm, lặp vô hạn, nằm DƯỚI chữ.
       Mặc định TẮT TIẾNG (trình duyệt chỉ cho tự phát khi tắt tiếng). Góc phải dưới có 2 nút: bật/tắt tiếng và tạm dừng/phát.
       Tự bỏ qua khi người dùng bật "giảm chuyển động" hoặc tiết kiệm dữ liệu; video lỗi thì vẫn còn ảnh bìa. */
    (function heroVideo() {
      var hero = $('.hero'), mp4 = HH.hasReal('video/hero.mp4'), webm = HH.hasReal('video/hero.webm');
      if (!hero || !(mp4 || webm)) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (navigator.connection && navigator.connection.saveData) return;
      var svg = function (inner) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; };
      var SPK = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>';
      var ICON = { muted: svg(SPK + '<line x1="22" x2="16" y1="9" y2="15"></line><line x1="16" x2="22" y1="9" y2="15"></line>'), sound: svg(SPK + '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>'),
        pause: svg('<rect x="14" y="4" width="4" height="16" rx="1"></rect><rect x="6" y="4" width="4" height="16" rx="1"></rect>'), play: svg('<polygon points="6 3 20 12 6 21 6 3"></polygon>') };
      var v = document.createElement('video'); v.className = 'hero-video'; v.muted = true; v.defaultMuted = true; v.volume = 0.3; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
      if (HH.hasReal('trang-chu/hero.jpg')) v.poster = 'img/trang-chu/hero.jpg';
      [['video/hero.mp4', 'video/mp4', mp4], ['video/hero.webm', 'video/webm', webm]].forEach(function (x) { if (x[2]) { var s = document.createElement('source'); s.src = 'img/' + x[0]; s.type = x[1]; v.appendChild(s); } });
      var userPaused = false; try { userPaused = sessionStorage.getItem('hh_hero_paused') === '1'; } catch (e) { /* không lưu được cũng không sao */ }
      var ctl = document.createElement('div'); ctl.className = 'hero-ctl'; ctl.innerHTML = '<div class="hv-volbox"><input type="range" id="hv-vol" min="0" max="100" step="1" value="30" aria-label="Âm lượng video" title="Âm lượng"></div><button type="button" id="hv-sound" class="hv-btn"></button><button type="button" id="hv-play" class="hv-btn"></button>'; ctl.style.display = 'none';
      var vol = ctl.querySelector('#hv-vol'), bs = ctl.querySelector('#hv-sound'), bp = ctl.querySelector('#hv-play');
      function paint() {
        bs.innerHTML = v.muted ? ICON.muted : ICON.sound; bs.setAttribute('aria-label', v.muted ? 'Bật tiếng video' : 'Tắt tiếng video'); bs.title = v.muted ? 'Bật tiếng' : 'Tắt tiếng'; bs.classList.toggle('on', !v.muted); ctl.classList.toggle('snd', !v.muted); vol.value = v.muted ? 0 : Math.round(v.volume * 100); vol.style.setProperty('--p', vol.value + '%');
        bp.innerHTML = userPaused ? ICON.play : ICON.pause; bp.setAttribute('aria-label', userPaused ? 'Phát video' : 'Tạm dừng video'); bp.title = userPaused ? 'Phát video' : 'Tạm dừng video';
      }
      vol.oninput = function () { var x = +vol.value / 100; v.volume = x; v.muted = x === 0; if (!v.muted && v.paused && !userPaused) v.play().catch(function () { }); paint(); };
      bs.onclick = function () { v.muted = !v.muted; if (!v.muted && v.volume < .05) v.volume = 0.3; /* mặc định 30% */ if (!v.muted && v.paused && !userPaused) v.play().catch(function () { }); paint(); };
      bp.onclick = function () { userPaused = !userPaused; try { sessionStorage.setItem('hh_hero_paused', userPaused ? '1' : '0'); } catch (e) { } if (userPaused) v.pause(); else v.play().catch(function () { }); paint(); };
      v.addEventListener('canplay', function () {
        v.classList.add('ready'); hero.classList.add('has-video'); ctl.style.display = ''; paint();
        if (!userPaused) { var p = v.play(); if (p && p.catch) p.catch(function () { /* trình duyệt chặn tự phát: giữ ảnh bìa */ }); }
      });
      v.lastChild.addEventListener('error', function () { v.remove(); ctl.remove(); hero.classList.remove('has-video'); });
      hero.insertBefore(v, hero.firstChild); hero.appendChild(ctl);
      // tiết kiệm máy: cuộn khỏi khu vực hero thì tạm dừng, quay lại thì phát tiếp (trừ khi khách đã tự bấm tạm dừng)
      if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (en) { if (!document.body.contains(hero)) { io.disconnect(); return; } if (en[0].isIntersecting) { if (!userPaused && v.readyState > 2) v.play().catch(function () { }); } else v.pause(); }, { threshold: .05 }); io.observe(hero); }
    })();
    page = { onData: function () { var c = $('#home-featured'); if (c) c.innerHTML = featured.map(function (x) { return courtCardHtml(HH.getCourt(x.id), today); }).join(''); } };
  }

  function voucherHtml(p) {
    var val = p.type === 'percent' ? '-' + p.value + '%' : '-' + HH.fmtK(p.value);
    return '<div class="voucher"><div class="left"><div>' + val + '<small>' + (p.offPeakOnly ? 'giờ thấp điểm' : 'mọi khung giờ') + '</small></div></div><div class="right"><b>' + esc(p.title) + '</b><p class="muted" style="margin:4px 0 8px;font-size:12.5px">' + esc(p.desc) + '</p><span class="code" data-copy="' + esc(p.code) + '" title="Bấm để sao chép">' + esc(p.code) + '</span> <span class="hint">HSD ' + (p.validTo ? HH.fmtDate(p.validTo) : 'không giới hạn') + '</span></div></div>';
  }
  function wireCommon(root) {
    on(root, 'click', '[data-copy]', function (e, t) {
      var txt = t.dataset.copy;
      try { navigator.clipboard.writeText(txt).then(function () { toast('ok', 'Đã sao chép mã ' + txt); }, function () { toast('info', 'Mã khuyến mãi: ' + txt); }); } catch (x) { toast('info', 'Mã khuyến mãi: ' + txt); }
    });
  }

  /* ---------- thẻ sân dùng chung ---------- */
  /** Mô hình sân 3D mini (xoay quanh) đặt NGAY TRONG ô tên sân / ảnh thẻ sân, chỉ hiện khi rê chuột. */
  function mini3d(c) {
    var is7 = c.type === 7;
    return '<span class="rh3d' + (is7 ? ' s7' : '') + '" aria-hidden="true"><span class="c3d-orbit"><span class="c3d-pitch">' + (is7 ? '<i class="c3d-seg" style="left:33.3%"></i><i class="c3d-seg" style="left:66.6%"></i>' : '') +
      '<span class="c3d-goal l"></span><span class="c3d-goal r"></span><i class="c3d-ball"></i>' +
      ['0,0', '100%,0', '0,100%', '100%,100%'].map(function (p) { var xy = p.split(','); return '<i class="c3d-pole" style="left:calc(' + xy[0] + ' - 2px);top:' + xy[1] + '"></i>'; }).join('') + '</span></span></span>';
  }
  function courtAvail(c, date, win, idx, now, courts, cfg) {
    var free = [], flash = false, minP = Infinity;
    for (var h = win.from; h < win.to; h++) {
      var st = HH.slotState(idx, c, date, h, now, courts);
      if (st.state === 'free') { free.push(h); var p = HH.priceForHour(c, date, h, cfg, now); if (p.price < minP) minP = p.price; if (p.flash) flash = true; }
    }
    return { free: free, flash: flash, minPrice: minP === Infinity ? null : minP, active: HH.courtIsBookable(c, courts) };
  }
  function courtCardHtml(c, date, win) {
    var courts = HH.getCourts(), cfg = HH.getConfig(), now = HH.now(), idx = HH.buildDayIndex(date);
    var av = courtAvail(c, date, win || windowOf('golden'), idx, now, courts, cfg);
    var chip;
    if (!av.active) chip = '<span class="chip muted">' + ic('ban', 12) + 'Tạm ngừng</span>';
    else if (av.free.length) chip = '<span class="chip ok">Còn trống · ' + av.free.length + ' giờ</span>';
    else chip = '<span class="chip bad">Đã kín</span>';
    var sub = c.type === 7 ? 'Sân 7 người · ghép ' + c.components.join('+') : 'Sân 5 người' + (c.roof ? ' · Có mái che' : '');
    var q = '?date=' + date;
    var book = av.free.length ? '#/dat/' + c.id + '?date=' + date + '&start=' + av.free[0] + '&end=' + (av.free[0] + 1) : '#/san/' + c.id + q;
    return '<article class="court-card ' + (av.active ? '' : 'off') + '"><div class="thumb"><img src="' + c.image + '" alt="' + esc(c.name) + '" loading="lazy">' + mini3d(c) + '<span class="chip type-tag">' + (c.type === 7 ? 'Sân 7' : 'Sân 5') + '</span>' + chip + '</div>' +
      '<div class="body"><h3>' + esc(c.name) + '</h3><div class="sub">' + esc(sub) + '</div><div class="price">' + (av.minPrice ? money(av.minPrice) : courtPriceText(c)) + '<small>/giờ</small> ' + (av.flash ? '<span class="chip flash">' + ic('zap', 11) + 'Giá giờ chót</span>' : '') + '</div>' +
      '<div class="amen">' + amenIcons(c, 3) + '</div><div class="acts"><a class="btn btn-outline btn-sm" href="#/san/' + c.id + q + '">Xem chi tiết</a><a class="btn btn-primary btn-sm ' + (av.free.length ? '' : 'disabled') + '" href="' + (av.free.length ? book : 'javascript:void(0)') + '">Đặt sân</a></div></div></article>';
  }

  /* ======================================================================
     TRANG ĐẶT SÂN: LƯỚI LỊCH + DANH SÁCH THẺ
     ====================================================================== */
  var bk = { type: '5', date: null, win: 'golden', price: 'all', view: 'grid', onlyFree: false, onlyFlash: false, hideOff: false, adv: false, sel: null };

  function pageBook(q) {
    var cfg = HH.getConfig(), today = HH.todayStr();
    if (q.type && ['5', '7', 'all'].indexOf(q.type) >= 0) bk.type = q.type;
    if (q.date && HH.isValidDateStr(q.date) && q.date >= today) bk.date = q.date;
    if (!bk.date || bk.date < today) bk.date = today;
    if (q.win && windowOf(q.win).id === q.win) bk.win = q.win;
    bk.view = (q.view === 'cards') ? 'cards' : 'grid'; // luôn ưu tiên dạng lịch, chỉ hiện thẻ sân khi link yêu cầu rõ
    if (bk.view === 'grid' && bk.type === 'all') bk.type = '5';
    bk.sel = null;
    setNav('dat-san');
    $app.innerHTML = '<div class="page-enter container"><div class="page-head"><div><h1 class="page-title">Đặt sân</h1><div class="page-sub">Chọn ngày, loại sân và xem lịch trống theo thời gian thực</div></div><div class="seg" id="bk-type"></div></div>' +
      '<div class="book-layout"><div><div class="card filter-bar" id="bk-filters"></div>' +
      '<div class="row wrap" style="justify-content:space-between;margin-top:10px"><div class="legend" id="bk-legend"></div><div class="seg" id="bk-view"><button data-view="grid">' + ic('grid-3x3', 15) + ' Lịch</button><button data-view="cards">' + ic('layout-grid', 15) + ' Thẻ sân</button></div></div>' +
      '<div id="bk-main"></div></div><aside class="side-stack" id="bk-side"></aside></div></div>';
    renderBookFilters(); refreshBook(); renderBookSide();
    var root = $app;
    on(root, 'click', '#bk-type button', function (e, b) { bk.type = b.dataset.type; if (bk.view === 'grid' && bk.type === 'all') bk.type = '5'; bk.sel = null; renderBookFilters(); refreshBook(); });
    on(root, 'click', '#bk-view button', function (e, b) { bk.view = b.dataset.view; if (bk.view === 'grid' && bk.type === 'all') bk.type = '5'; bk.sel = null; renderBookFilters(); refreshBook(); });
    on(root, 'click', '.dchip', function (e, b) { bk.date = b.dataset.date; bk.sel = null; renderBookFilters(); refreshBook(); });
    on(root, 'change', '#f-date', function (e, el) { var v = el.value; if (!HH.isValidDateStr(v) || v < HH.todayStr()) { toast('bad', 'Ngày không hợp lệ', ['Vui lòng chọn ngày từ hôm nay trở đi.']); el.value = bk.date; return; } bk.date = v; bk.sel = null; renderBookFilters(); refreshBook(); });
    on(root, 'change', '#f-win', function (e, el) { bk.win = el.value; bk.sel = null; refreshBook(); });
    on(root, 'change', '#f-price', function (e, el) { bk.price = el.value; refreshBook(); });
    on(root, 'click', '#f-adv', function () { bk.adv = !bk.adv; renderBookFilters(); });
    on(root, 'change', '#adv-panel input', function (e, el) { bk[el.dataset.k] = el.checked; refreshBook(); });
    on(root, 'click', '#f-reset', function () { bk.price = 'all'; bk.win = 'golden'; bk.onlyFree = bk.onlyFlash = bk.hideOff = false; bk.date = HH.todayStr(); renderBookFilters(); refreshBook(); });
    on(root, 'click', '.slot[data-act="pick"]', function (e, el) { pickSlot(el.dataset.c, +el.dataset.h); });
    on(root, 'click', '.slot[data-act="seek"]', function (e, el) { seekModal(el.dataset.id); });
    page = { onData: function () { refreshBook(); renderBookSide(); }, destroy: function () {} };
  }

  function renderBookFilters() {
    var cfg = HH.getConfig(), today = HH.todayStr();
    var types = bk.view === 'cards' ? [['all', 'Tất cả'], ['5', 'Sân 5'], ['7', 'Sân 7']] : [['5', 'Sân 5'], ['7', 'Sân 7']];
    $('#bk-type').innerHTML = types.map(function (t) { return '<button data-type="' + t[0] + '" class="' + (bk.type === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
    $$('#bk-view button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === bk.view); });
    $('#bk-filters').innerHTML =
      '<div class="field"><label>Ngày đá</label><input type="date" class="input" id="f-date" value="' + bk.date + '" min="' + today + '" max="' + HH.addDays(today, cfg.maxAdvanceDays) + '"></div>' +
      '<div class="date-chips">' + dateChips(null, bk.date) + '</div>' +
      '<div class="field"><label>Khung giờ</label><select class="select" id="f-win">' + HH.TIME_WINDOWS.map(function (w) { return '<option value="' + w.id + '" ' + (w.id === bk.win ? 'selected' : '') + '>' + w.label + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Mức giá / giờ</label><select class="select" id="f-price">' + HH.PRICE_RANGES.map(function (p) { return '<option value="' + p.id + '" ' + (p.id === bk.price ? 'selected' : '') + '>' + p.label + '</option>'; }).join('') + '</select></div>' +
      '<button class="btn btn-outline" id="f-adv">' + ic('sliders-horizontal', 16) + ' Lọc nâng cao</button><button class="btn btn-outline" id="f-reset" title="Đặt lại bộ lọc">' + ic('rotate-ccw', 16) + '</button>' +
      (bk.adv ? '<div id="adv-panel" class="row wrap" style="width:100%;border-top:1px dashed var(--line2);padding-top:12px;gap:18px"><label class="check"><input type="checkbox" data-k="onlyFree" ' + (bk.onlyFree ? 'checked' : '') + '>Chỉ hiện sân còn giờ trống</label><label class="check"><input type="checkbox" data-k="onlyFlash" ' + (bk.onlyFlash ? 'checked' : '') + '>Chỉ sân có giá giờ chót</label><label class="check"><input type="checkbox" data-k="hideOff" ' + (bk.hideOff ? 'checked' : '') + '>Ẩn sân đang bảo trì</label></div>' : '');
    $('#bk-legend').innerHTML = '<span><i class="lg-free"></i>Còn trống</span><span><i class="lg-hold"></i>Đang giữ chỗ</span><span><i class="lg-booked"></i>Đã đặt</span><span><i class="lg-seek"></i>Đang tìm đối</span><span><i class="lg-off"></i>Bảo trì / đã qua</span>';
  }

  function filteredCourts() {
    var pr = HH.PRICE_RANGES.filter(function (p) { return p.id === bk.price; })[0];
    return HH.getCourts().filter(function (c) {
      if (bk.type !== 'all' && String(c.type) !== bk.type) return false;
      var p = c.pricePeak; if (!(p >= pr.min && p <= pr.max) && !(c.priceOff >= pr.min && c.priceOff <= pr.max)) return false;
      return true;
    });
  }

  function slotCell(c, h, idx, now, courts, cfg) {
    var st = HH.slotState(idx, c, bk.date, h, now, courts), b = st.booking, sel = bk.sel && bk.sel.courtId === c.id && h >= bk.sel.start && h < bk.sel.end;
    var via = st.linked && b ? ' linked" title="Bị khóa do sân liên kết ' + b.courtId : '';
    switch (st.state) {
      case 'free':
        var p = HH.priceForHour(c, bk.date, h, cfg, now);
        return '<button class="slot free ' + (p.flash ? 'flash' : '') + (sel ? ' sel' : '') + '" data-act="pick" data-c="' + c.id + '" data-h="' + h + '" title="' + esc(c.name) + ' · ' + HH.fmtRange(h, h + 1) + ' · ' + money(p.price) + '">' + (p.flash ? ic('zap', 11) : '') + '<span>' + HH.fmtK(p.price) + (p.flash ? '<small>-' + p.percent + '%</small>' : '') + '</span></button>';
      case 'booked': return '<div class="slot booked' + via + '">Đã đặt' + (st.linked ? '<small>(' + b.courtId + ')</small>' : '') + '</div>';
      case 'holding': return '<div class="slot holding' + via + '">Giữ chỗ' + (st.linked ? '<small>(' + b.courtId + ')</small>' : '') + '</div>';
      case 'seeking': return '<button class="slot seeking' + via + '" data-act="seek" data-id="' + b.id + '">Tìm đối<small>(' + b.seek.havePlayers + '/' + (b.seek.teamSize * 2) + ')' + (st.linked ? ' ' + b.courtId : '') + '</small></button>';
      case 'maintenance': return '<div class="slot maintenance" title="' + esc(HH.courtInactiveReason(c, courts)) + '">Bảo trì</div>';
      default: return '<div class="slot past">—</div>';
    }
  }

  function refreshBook() {
    var main = $('#bk-main'); if (!main) return;
    var cfg = HH.getConfig(), courts = HH.getCourts(), now = HH.now(), win = windowOf(bk.win), idx = HH.buildDayIndex(bk.date);
    var list = filteredCourts();
    if (bk.hideOff) list = list.filter(function (c) { return HH.courtIsBookable(c, courts); });
    var info = HH.dayFactor(bk.date, cfg), html = '';
    var banner = info.kind !== 'normal' ? '<div class="notice warn mt8">' + ic('triangle-alert', 16) + '<span><b>' + HH.fmtDateLong(bk.date) + ':</b> ' + esc(info.label) + ' — giá đã được nhân hệ số này, hiển thị rõ trước khi bạn đặt.</span></div>' : '';
    var allPast = bk.date === HH.todayStr(now) && win.to <= now.getHours() + 1;   // cả khung giờ này hôm nay đã qua
    if (allPast) banner += '<div class="notice warn mt8">' + ic('clock', 16) + '<span class="grow"><b>Khung giờ ' + esc(win.label) + ' của hôm nay đã qua.</b> Hãy chọn ngày khác để đặt sân.</span><button class="btn btn-primary btn-sm" data-nextday="1">Xem ngày mai</button></div>';
    if (bk.view === 'grid') {
      var hours = []; for (var h = win.from; h < win.to; h++) hours.push(h);
      var showAvail = list.map(function (c) { return { c: c, av: courtAvail(c, bk.date, win, idx, now, courts, cfg) }; });
      if (bk.onlyFree) showAvail = showAvail.filter(function (x) { return x.av.free.length; });
      if (bk.onlyFlash) showAvail = showAvail.filter(function (x) { return x.av.flash; });
      if (!showAvail.length) { main.innerHTML = banner + '<div class="card mt8">' + empty('search', 'Không tìm thấy sân phù hợp', '<span>Hãy thử đổi ngày, khung giờ hoặc bỏ bớt bộ lọc.</span>', '<button class="btn btn-primary" id="empty-reset">Đặt lại bộ lọc</button>') + '</div>'; var rb = $('#empty-reset'); if (rb) rb.onclick = function () { $('#f-reset').click(); }; updateSelBar(); return; }
      html = banner + '<div class="sched-wrap mt8"><table class="sched"><thead><tr><th class="rowhead">Sân / Giờ</th>' + hours.map(function (h) { return '<th class="' + (HH.isPeakHour(h, cfg) ? 'golden' : '') + '">' + HH.fmtRange(h, h + 1).replace(' - ', '–') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        showAvail.map(function (x) { var c = x.c; return '<tr><td class="rowhead">' + mini3d(c) + '<a href="#/san/' + c.id + '?date=' + bk.date + '">' + esc(c.code) + '</a><small>' + (c.type === 7 ? c.components.join('+') : (c.roof ? 'Mái che' : 'Ngoài trời')) + '</small></td>' + hours.map(function (h) { return '<td>' + slotCell(c, h, idx, now, courts, cfg) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="hint mt8">' + ic('info', 13) + ' Bấm vào ô xanh để chọn giờ (chọn liền nhau nhiều ô để đá nhiều giờ, tối đa ' + cfg.maxHoursPerBooking + ' giờ). Ô có vạch chéo là sân bị khóa do sân liên kết 5 ↔ 7.</p>';
    } else {
      var cards = list.map(function (c) { return { c: c, av: courtAvail(c, bk.date, win, idx, now, courts, cfg) }; });
      if (bk.onlyFree) cards = cards.filter(function (x) { return x.av.free.length; });
      if (bk.onlyFlash) cards = cards.filter(function (x) { return x.av.flash; });
      html = banner + (cards.length ? '<div class="court-grid mt16">' + cards.map(function (x) { return courtCardHtml(x.c, bk.date, win); }).join('') + '</div>' : '<div class="card mt16">' + empty('search', 'Không tìm thấy sân phù hợp', '<span>Hãy thử đổi ngày, khung giờ hoặc bỏ bớt bộ lọc.</span>', '<button class="btn btn-primary" id="empty-reset">Đặt lại bộ lọc</button>') + '</div>');
    }
    main.innerHTML = html;
    var rb2 = $('#empty-reset'); if (rb2) rb2.onclick = function () { $('#f-reset').click(); };
    var nd = $('[data-nextday]'); if (nd) nd.onclick = function () { var c = $('.dchip[data-date="' + HH.addDays(HH.todayStr(), 1) + '"]'); if (c) c.click(); };
    updateSelBar();
  }

  function pickSlot(courtId, h) {
    var cfg = HH.getConfig(), s = bk.sel;
    if (!s || s.courtId !== courtId) bk.sel = { courtId: courtId, start: h, end: h + 1 };
    else if (h >= s.start && h < s.end) {
      if (s.end - s.start === 1) bk.sel = null;
      else if (h === s.start) s.start++; else if (h === s.end - 1) s.end--; else bk.sel = { courtId: courtId, start: h, end: h + 1 };
    } else if (h === s.end && s.end - s.start < cfg.maxHoursPerBooking) s.end++;
    else if (h === s.start - 1 && s.end - s.start < cfg.maxHoursPerBooking) s.start--;
    else {
      if (h === s.end || h === s.start - 1) toast('warn', 'Tối đa ' + cfg.maxHoursPerBooking + ' giờ mỗi đơn');
      bk.sel = { courtId: courtId, start: h, end: h + 1 };
    }
    refreshBook();
  }
  function updateSelBar() {
    var bar = $('#sel-bar');
    if (!bk.sel) { if (bar) bar.classList.remove('show'); return; }
    var c = HH.getCourt(bk.sel.courtId), cfg = HH.getConfig(), pb = HH.priceBreakdown(c, bk.date, bk.sel.start, bk.sel.end, cfg, HH.now());
    if (!bar) { bar = document.createElement('div'); bar.id = 'sel-bar'; bar.className = 'sel-bar'; document.body.appendChild(bar); }
    bar.innerHTML = '<div class="grow"><small>' + HH.fmtDateLong(bk.date) + '</small><b>' + esc(c.name) + ' · ' + HH.fmtRange(bk.sel.start, bk.sel.end) + ' (' + pb.hours + ' giờ)</b></div><div style="text-align:right"><small>Tạm tính</small><b style="color:var(--neon)">' + money(pb.total) + '</b></div><button class="btn btn-ghost btn-sm" id="sel-clear" title="Bỏ chọn">' + ic('x', 16) + '</button><button class="btn btn-primary" id="sel-go">Tiếp tục đặt sân ' + ic('arrow-right', 16) + '</button>';
    requestAnimationFrame(function () { bar.classList.add('show'); });
    $('#sel-clear').onclick = function () { bk.sel = null; refreshBook(); };
    $('#sel-go').onclick = function () { var s = bk.sel; go('#/dat/' + s.courtId + '?date=' + bk.date + '&start=' + s.start + '&end=' + s.end); };
  }

  function renderBookSide() {
    var side = $('#bk-side'); if (!side) return;
    var courts = HH.getCourts(), cfg = HH.getConfig();
    function range(t) { var l = courts.filter(function (c) { return c.type === t; }); return { n: l.length, min: Math.min.apply(null, l.map(courtMinPrice)), max: Math.max.apply(null, l.map(function (c) { return Math.max(c.priceOff, c.pricePeak); })) }; }
    var r5 = range(5), r7 = range(7), maxFlash = Math.max.apply(null, cfg.flash.tiers.map(function (t) { return t.percent; }));
    side.innerHTML = '<div class="card side-card"><h3>Thông tin nhanh</h3>' +
      '<div class="qi"><span class="ic-wrap">' + ic('users', 20) + '</span><div><b>' + r5.n + ' sân 5 người</b><small>' + HH.fmtK(r5.min) + ' - ' + HH.fmtK(r5.max) + '/giờ</small></div></div>' +
      '<div class="qi"><span class="ic-wrap">' + ic('layers', 20) + '</span><div><b>' + r7.n + ' sân 7 người</b><small>' + HH.fmtK(r7.min) + ' - ' + HH.fmtK(r7.max) + '/giờ · ghép từ 3 sân 5</small></div></div></div>' +
      '<div class="card side-card"><h3>Tiện ích</h3><div class="amen-list">' + ['led', 'wc', 'locker', 'water', 'shower', 'ball'].map(function (a) { return '<div>' + ic(HH.AMENITIES[a].icon, 16) + HH.AMENITIES[a].label + '</div>'; }).join('') + '</div></div>' +
      (cfg.flash.enabled ? '<div class="flash-box">' + ic('zap', 34) + '<h3>Flash Sale hôm nay</h3><p>Giá giờ chót giảm đến ' + maxFlash + '% cho các khung giờ sắp đá (không thấp hơn giá sàn).</p></div>' : '') +
      '<div class="card side-card"><h3>Cách hiểu lịch 5 ↔ 7</h3><p class="muted" style="margin:0;font-size:12.5px">Sân 7 gồm 3 sân 5. Khi một sân 5 thuộc nhóm được đặt, sân 7 tương ứng sẽ khóa (và ngược lại) trong cùng khung giờ — các sân độc lập khác vẫn đặt bình thường.</p></div>';
  }

  /* ---------- Nhận kèo (modal dùng ở lịch + trang Tìm đối) ---------- */
  function seekModal(id) {
    var b = HH.getBooking(id), c = b && HH.getCourt(b.courtId), cfg = HH.getConfig(), m = HH.getSession();
    if (!b || !b.seek) { toast('bad', 'Kèo không còn tồn tại'); return; }
    var share = Math.round(b.totalAmount / 2 / 1000) * 1000, dep = Math.round(share * cfg.depositPercent / 100 / 1000) * 1000;
    var matched = !!b.seek.opponent;
    openModal({ title: matched ? 'Kèo đã có đội nhận' : 'Nhận kèo: ' + esc(b.seek.teamName), body:
      '<div class="notice mb"><span>' + ic('info', 16) + '</span><span>' + esc(c.name) + ' · ' + HH.fmtDateLong(b.date) + ' · ' + HH.fmtRange(b.startHour, b.endHour) + '</span></div>' +
      '<div class="kv"><span>Đội chủ</span><b>' + esc(b.seek.teamName) + '</b></div><div class="kv"><span>Trình độ</span><b>' + levelBadge(b.seek.level) + '</b></div><div class="kv"><span>Đã có</span><b>' + b.seek.havePlayers + '/' + b.seek.teamSize + ' người</b></div>' +
      '<div class="kv"><span>Chi phí dự kiến mỗi đội</span><b>' + money(share) + '</b></div><div class="kv"><span>Cọc mỗi đội (' + cfg.depositPercent + '%)</span><b>' + money(dep) + '</b></div>' +
      (b.seek.note ? '<div class="kv"><span>Ghi chú</span><b>' + esc(b.seek.note) + '</b></div>' : '') +
      '<div class="kv"><span>Hạn chót ghép</span><b>' + HH.fmtHour(cfg.seek.deadlineHour) + ' ngày ' + HH.fmtDate(b.date) + '</b></div>' +
      (matched ? '<div class="notice ok mt16">' + ic('circle-check', 16) + '<span>Đã ghép với đội <b>' + esc(b.seek.opponent.teamName) + '</b>.</span></div>' :
        '<hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><div class="form-grid"><div class="field full"><label>Tên đội của bạn</label><input class="input" id="sk-team" value="' + (m ? '' : '') + '" placeholder="VD: FC Bình Thạnh"></div><div class="field"><label>Số điện thoại</label><input class="input" id="sk-phone" value="' + (m ? m.phone : '') + '" placeholder="0901234567"></div><div class="field"><label>Số người của đội (tối đa ' + b.seek.teamSize + ')</label><input class="input" type="number" id="sk-pl" min="1" max="' + b.seek.teamSize + '" value="' + b.seek.teamSize + '"></div><div class="field full"><label>Trình độ của đội</label><select class="select" id="sk-lv">' + HH.LEVELS.map(function (l) { return '<option value="' + l.id + '" ' + (l.id === b.seek.level ? 'selected' : '') + '>' + l.label + '</option>'; }).join('') + '</select></div></div><div id="sk-err" class="field-err mt8"></div><p class="hint">Quy tắc ghép đội là <b>mô phỏng, có thể cấu hình</b>: ghép thành công thì mỗi đội cọc ' + cfg.depositPercent + '% phần của mình trong vòng 1 giờ.</p>'),
      foot: '<button class="btn btn-outline" data-close>Đóng</button>' + (matched ? '' : '<button class="btn btn-purple" id="sk-ok">' + ic('swords', 16) + ' Nhận kèo</button>'),
      onMount: function (el, api) {
        var ok = $('#sk-ok', el); if (!ok) return;
        ok.onclick = function () {
          var res = HH.joinSeek(id, { teamName: $('#sk-team', el).value, phone: $('#sk-phone', el).value, level: $('#sk-lv', el).value, players: $('#sk-pl', el).value });
          if (!res.ok) { $('#sk-err', el).textContent = res.errors[0].message; return; }
          api.close(); toast('ok', 'Nhận kèo thành công!', ['Hãy thanh toán cọc trong 60 phút để giữ kèo (mô phỏng).']);
          go('#/doi-thanh-toan/' + id);
        };
      } });
  }

  /* ======================================================================
     CHI TIẾT SÂN
     ====================================================================== */
  var dt = { courtId: null, date: null, sel: null, img: 0 };
  function pageCourt(id, q) {
    var c = HH.getCourt(id), cfg = HH.getConfig(), today = HH.todayStr();
    setNav('dat-san');
    if (!c) { $app.innerHTML = '<div class="container mt24 card">' + empty('search', 'Không tìm thấy sân "' + esc(id) + '"', '', '<a class="btn btn-primary" href="#/dat-san">Về trang đặt sân</a>') + '</div>'; return; }
    if (dt.courtId !== id) { dt = { courtId: id, date: null, sel: null, img: 0 }; }
    dt.date = (q.date && HH.isValidDateStr(q.date) && q.date >= today) ? q.date : (dt.date && dt.date >= today ? dt.date : today); dt.sel = null;
    var parent = c.type === 5 ? HH.parentOf(c.id) : null;
    var link = c.type === 7 ? '<div class="notice mt16">' + ic('layers', 18) + '<span>Sân này được ghép từ 3 sân 5 người <b>' + c.components.join(' + ') + '</b>. Khi có người đặt ' + c.id + ', ba sân này bị khóa cùng khung giờ — và ngược lại.</span></div>' : (parent ? '<div class="notice mt16">' + ic('layers', 18) + '<span>' + c.id + ' là một phần của sân 7 người <b>' + parent + '</b>. Khi ' + parent + ' được đặt thì sân này tạm khóa cùng khung giờ.</span></div>' : '<div class="notice mt16">' + ic('shield-check', 18) + '<span>' + c.id + ' là sân độc lập, không liên kết với sân 7 người.</span></div>');
    var dep = cfg.depositPercent;
    $app.innerHTML = '<div class="page-enter container"><div style="padding-top:18px"><a class="link-more" href="javascript:history.back()">' + ic('arrow-left', 15) + ' Quay lại</a></div>' +
      '<div class="detail-layout"><div><div class="gallery"><div class="main"><img id="g-main" src="' + c.gallery[0] + '" alt="' + esc(c.name) + '"></div><div class="thumbs">' + c.gallery.map(function (g, i) { return '<button data-g="' + i + '" class="' + (i === 0 ? 'on' : '') + '"><img src="' + g + '" alt=""></button>'; }).join('') + '</div></div>' +
      link +
      '<div class="card card-pad mt16"><div class="card-title">Tiện ích</div><div class="amen-icons">' + c.amenities.map(function (a) { var m = HH.AMENITIES[a]; return '<div><span class="ic-wrap">' + ic(m.icon, 22) + '</span>' + m.label + '</div>'; }).join('') + '</div><p class="muted" style="margin:14px 0 0">' + esc(c.description) + '</p></div>' +
      '<div class="card card-pad mt16"><div class="card-title">Giá theo khung giờ</div><table class="price-table"><tr><th>Khung giờ</th><th>Giá / giờ</th></tr>' +
      '<tr><td>' + HH.fmtHour(HH.OPEN_HOUR) + ' - ' + HH.fmtHour(cfg.peakFrom) + ' (giờ thường)</td><td>' + money(c.priceOff) + '</td></tr><tr><td>' + HH.fmtHour(cfg.peakFrom) + ' - ' + HH.fmtHour(cfg.peakTo) + ' (giờ vàng)</td><td>' + money(c.pricePeak) + '</td></tr><tr><td>' + HH.fmtHour(cfg.peakTo) + ' - ' + HH.fmtHour(HH.CLOSE_HOUR) + ' (giờ thường)</td><td>' + money(c.priceOff) + '</td></tr></table>' +
      '<p class="hint mt8">Thứ Bảy, Chủ nhật nhân hệ số ×' + cfg.weekendFactor + '. Ngày lễ: ' + cfg.holidays.map(function (h) { return esc(h.name) + ' ×' + h.factor; }).join(', ') + '. Giá giờ chót (flash sale) chỉ áp dụng trong ngày, không thấp hơn giá sàn.</p></div>' +
      '<div class="card card-pad mt16"><div class="card-title">Chính sách đặt sân</div><ul class="policy">' +
      '<li>' + ic('wallet', 17) + '<span>Đặt cọc <b>' + dep + '%</b> (' + cfg.lowReputationDepositPercent + '% nếu điểm uy tín dưới ' + cfg.reputationThreshold + '). Giữ chỗ tạm ' + cfg.holdMinutes + ' phút trong lúc thanh toán.</span></li>' +
      '<li>' + ic('circle-check', 17) + '<span>Hủy trước <b>24 giờ</b>: hoàn cọc 100%.</span></li><li>' + ic('clock', 17) + '<span>Hủy từ 24 giờ đến 6 giờ trước giờ đá: hoàn 50%.</span></li><li>' + ic('circle-x', 17) + '<span>Hủy dưới 6 giờ hoặc không đến: không hoàn cọc.</span></li><li>' + ic('shield-check', 17) + '<span>Sân gặp sự cố hoặc mưa lớn (sân ngoài trời): hoàn 100% hoặc đổi lịch miễn phí.</span></li></ul><p class="hint">Mọi khoản tiền ở website này là <b>mô phỏng</b>.</p></div>' +
      '<div class="card card-pad mt16"><div class="card-title">Ảnh sân &amp; tiện ích</div><div class="about-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:12px">' + c.gallery.slice(0, 2).map(function (g, i) { return '<figure class="about-fig"><img src="' + g + '" alt="" loading="lazy"><figcaption>' + (i ? 'Góc sân khác' : 'Sân ' + esc(c.id)) + '</figcaption></figure>'; }).join('') + '</div><div class="about-grid three">' + c.gallery.slice(2).map(function (g, i) { return '<figure class="about-fig"><img src="' + g + '" alt="" loading="lazy"><figcaption>' + ['Máy bán nước tự động', 'Phòng tắm', 'Tủ đồ cá nhân'][i] + '</figcaption></figure>'; }).join('') + '</div></div></div>' +
      '<aside class="side-stack"><div class="card card-pad" id="dt-head"></div><div class="card card-pad" id="dt-sched"></div></aside></div></div>';
    renderCourtSide(); wireCourt(c);
    page = { onData: function () { renderCourtSide(); } };
  }
  function wireCourt(c) {
    on($app, 'click', '.thumbs button[data-g]', function (e, b) { $('#g-main').src = c.gallery[+b.dataset.g]; $$('.thumbs button[data-g]').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    on($app, 'click', '.dchip', function (e, b) { dt.date = b.dataset.date; dt.sel = null; renderCourtSide(); });
    on($app, 'change', '#dt-date', function (e, el) { if (!HH.isValidDateStr(el.value) || el.value < HH.todayStr()) { toast('bad', 'Ngày không hợp lệ'); el.value = dt.date; return; } dt.date = el.value; dt.sel = null; renderCourtSide(); });
    on($app, 'click', '.tchip[data-h]', function (e, el) {
      var h = +el.dataset.h, cfg = HH.getConfig(), s = dt.sel;
      if (el.classList.contains('seeking')) { seekModal(el.dataset.id); return; }
      if (!el.classList.contains('free')) return;
      if (!s) dt.sel = { start: h, end: h + 1 };
      else if (h >= s.start && h < s.end) { if (s.end - s.start === 1) dt.sel = null; else if (h === s.start) s.start++; else if (h === s.end - 1) s.end--; else dt.sel = { start: h, end: h + 1 }; }
      else if (h === s.end && s.end - s.start < cfg.maxHoursPerBooking) s.end++;
      else if (h === s.start - 1 && s.end - s.start < cfg.maxHoursPerBooking) s.start--;
      else dt.sel = { start: h, end: h + 1 };
      renderCourtSide();
    });
    on($app, 'click', '#dt-go', function () { if (!dt.sel) { toast('warn', 'Hãy chọn giờ trước', ['Bấm vào các ô giờ màu xanh để chọn khung giờ muốn đá.']); return; } go('#/dat/' + c.id + '?date=' + dt.date + '&start=' + dt.sel.start + '&end=' + dt.sel.end); });
  }
  function renderCourtSide() {
    var head = $('#dt-head'); if (!head) return;
    var c = HH.getCourt(dt.courtId), cfg = HH.getConfig(), courts = HH.getCourts(), now = HH.now(), idx = HH.buildDayIndex(dt.date), today = HH.todayStr();
    var cheapest = null, flash = null, anyFree = false;
    var cells = [];
    for (var h = HH.OPEN_HOUR; h < HH.CLOSE_HOUR; h++) {
      var st = HH.slotState(idx, c, dt.date, h, now, courts), p = HH.priceForHour(c, dt.date, h, cfg, now);
      var inSel = dt.sel && h >= dt.sel.start && h < dt.sel.end;
      if (st.state === 'free') { anyFree = true; if (cheapest === null || p.price < cheapest) cheapest = p.price; if (p.flash && (!flash || p.price < flash.price)) flash = p; }
      var cls = st.state + (inSel ? ' sel' : '') + (p.flash && st.state === 'free' ? ' flash' : '');
      var sub = st.state === 'free' ? HH.fmtK(p.price) + (p.flash ? ' · -' + p.percent + '%' : '') : ({ booked: 'Đã đặt', holding: 'Giữ chỗ', seeking: 'Tìm đối', maintenance: 'Bảo trì', past: '—' })[st.state];
      cells.push('<div class="tchip ' + cls + '" data-h="' + h + '"' + (st.state === 'seeking' ? ' data-id="' + st.booking.id + '"' : '') + '>' + String(h).padStart(2, '0') + '-' + String(h + 1).padStart(2, '0') + '<small>' + sub + '</small></div>');
    }
    var active = HH.courtIsBookable(c, courts);
    var status = !active ? '<span class="chip muted">Tạm ngừng</span>' : (anyFree ? '<span class="chip ok">Còn trống</span>' : '<span class="chip bad">Đã kín</span>');
    var listP = cheapest != null ? cheapest : c.pricePeak;
    head.innerHTML = '<div class="row" style="justify-content:space-between;align-items:flex-start"><div><h1 style="font-size:26px;font-weight:800">' + esc(c.name) + '</h1><div class="muted mt8">' + (c.type === 7 ? 'Sân 7 người' : 'Sân 5 người') + ' · ' + esc(c.zone) + '</div></div>' + status + '</div>' +
      '<div class="row mt8" style="gap:6px;color:#f5b301">' + ic('star', 16) + '<b style="color:var(--ink)">' + c.rating.toFixed(1) + '</b><span class="muted">(' + c.reviews + ' đánh giá minh họa)</span></div>' +
      '<div class="row mt8" style="gap:6px" class="muted">' + ic('map-pin', 15) + '<span class="muted">Cụm sân Huy Hoàng · Bình Thạnh, TP.HCM</span></div>' +
      '<div class="mt16"><span class="price-big">' + money(listP) + '<small>/giờ</small></span>' + (flash ? ' <span class="old-price">' + money(flash.list) + '</span> <span class="chip bad">-' + flash.percent + '%</span>' : '') + '</div>' +
      (HH.dayFactor(dt.date, cfg).kind !== 'normal' ? '<div class="hint mt8">' + esc(HH.dayFactor(dt.date, cfg).label) + '</div>' : '');
    var pb = dt.sel ? HH.priceBreakdown(c, dt.date, dt.sel.start, dt.sel.end, cfg, now) : null;
    $('#dt-sched').innerHTML = '<div class="card-title">Lịch ' + (dt.date === today ? 'hôm nay' : HH.fmtDateLong(dt.date)) + '</div>' +
      '<div class="date-chips" style="margin-bottom:10px">' + dateChips(null, dt.date) + '</div><div class="field" style="margin-bottom:12px"><input type="date" class="input" id="dt-date" value="' + dt.date + '" min="' + today + '" max="' + HH.addDays(today, cfg.maxAdvanceDays) + '"></div>' +
      '<div class="time-chips">' + cells.join('') + '</div>' +
      '<div class="row mt16" style="justify-content:space-between"><span class="muted">Tổng tiền dự kiến</span><b style="font-size:19px;color:var(--g700)">' + (pb ? money(pb.total) : '—') + '</b></div>' +
      (pb ? '<div class="hint">' + HH.fmtRange(dt.sel.start, dt.sel.end) + ' · ' + pb.hours + ' giờ</div>' : '') +
      '<button class="btn btn-primary btn-block btn-lg mt16" id="dt-go" ' + (active ? '' : 'disabled') + '>Chọn giờ &amp; đặt sân</button>';
  }

  /* ======================================================================
     XÁC NHẬN THÔNG TIN ĐẶT SÂN (bước 2)
     ====================================================================== */
  var co = null;
  function stepsHtml(cur) {
    var s = ['Chọn sân & giờ', 'Xác nhận thông tin', 'Thanh toán', 'Hoàn tất'];
    return '<div class="steps">' + s.map(function (t, i) { return '<div class="step ' + (i + 1 < cur ? 'done' : (i + 1 === cur ? 'cur' : '')) + '"><i>' + (i + 1 < cur ? ic('check', 16) : (i + 1)) + '</i>' + t + '</div>'; }).join('') + '</div>';
  }

  function pageCheckout(id, q) {
    var c = HH.getCourt(id), cfg = HH.getConfig(), m = HH.getSession();
    setNav('dat-san');
    var start = parseInt(q.start, 10), end = parseInt(q.end, 10);
    if (!c || !HH.isValidDateStr(q.date) || isNaN(start) || isNaN(end)) {
      $app.innerHTML = '<div class="container mt24 card">' + empty('circle-alert', 'Thông tin đặt sân không hợp lệ', '<span>Đường dẫn thiếu sân, ngày hoặc giờ.</span>', '<a class="btn btn-primary" href="#/dat-san">Chọn lại sân</a>') + '</div>'; return;
    }
    co = { courtId: id, date: q.date, start: start, end: end, svc: {}, promo: null, promoMsg: '', mode: 'full' };
    var types = c.type === 7 ? 'Sân 7 người' : 'Sân 5 người';
    var canSeek = cfg.seek.enabled && start >= cfg.seek.minStartHour;
    $app.innerHTML = '<div class="page-enter container">' + stepsHtml(2) +
      '<div id="co-warn"></div><div class="checkout-layout"><div>' +
      '<div class="card card-pad"><div class="sum-court"><img src="' + c.image + '" alt=""><div class="grow"><h2 style="font-size:20px">' + esc(c.name) + ' <span class="chip">' + types + '</span></h2><div class="muted mt8">' + HH.fmtDateLong(co.date) + '</div><div class="row mt8 wrap"><div class="field" style="width:130px"><label>Giờ bắt đầu</label><select class="select" id="co-start"></select></div><div class="field" style="width:130px"><label>Giờ kết thúc</label><select class="select" id="co-end"></select></div><a class="btn btn-outline btn-sm" style="margin-top:18px" href="#/dat-san?date=' + co.date + '&type=' + c.type + '">Đổi sân / ngày</a></div></div></div><div id="co-daynote"></div></div>' +
      '<div class="card card-pad mt16"><div class="card-title">Thông tin người đặt</div><div class="form-grid"><div class="field"><label for="co-name">Họ và tên *</label><input class="input" id="co-name" value="' + esc(m ? m.name : '') + '" placeholder="Nguyễn Văn A" maxlength="60" autocomplete="name"><div class="field-err" id="e-name"></div></div><div class="field"><label for="co-phone">Số điện thoại *</label><input class="input" id="co-phone" value="' + esc(m ? m.phone : '') + '" placeholder="0901234567" inputmode="tel" autocomplete="tel"><div class="field-err" id="e-phone"></div></div><div class="field full"><label for="co-note">Ghi chú (không bắt buộc)</label><textarea class="textarea" id="co-note" placeholder="VD: Đá giao hữu, cần thêm 2 áo bib…" maxlength="200"></textarea></div></div></div>' +
      (canSeek ? '<div class="card card-pad mt16"><div class="card-title">' + ic('swords', 18) + ' Bạn đã có đối thủ chưa?</div><div class="row wrap"><label class="check"><input type="radio" name="mode" value="full" checked> Đã đủ người (đặt sân thường)</label><label class="check"><input type="radio" name="mode" value="seeking"> Cần tìm đối (sân chuyển màu tím)</label></div><div id="seek-box" class="hide mt16"><div class="notice mb" style="margin-bottom:12px">' + ic('info', 16) + '<span>Quy tắc mô phỏng: chỉ cho trận từ ' + HH.fmtHour(cfg.seek.minStartHour) + ', hạn chót ghép ' + HH.fmtHour(cfg.seek.deadlineHour) + ' ngày đá (chưa có đối sẽ tự hủy), tối đa ' + cfg.seek.maxPerDay + ' sân tìm đối/ngày, tiền sân chia đôi.</span></div><div class="form-grid"><div class="field"><label>Tên đội *</label><input class="input" id="sk-team" placeholder="VD: FC Bình Thạnh"></div><div class="field"><label>Trình độ *</label><select class="select" id="sk-lv">' + HH.LEVELS.map(function (l) { return '<option value="' + l.id + '" ' + (l.id === 'club' ? 'selected' : '') + '>' + l.label + '</option>'; }).join('') + '</select></div><div class="field"><label>Số người đã có (1–' + HH.teamSize(c) + ')</label><input class="input" type="number" id="sk-have" min="1" max="' + HH.teamSize(c) + '" value="' + HH.teamSize(c) + '"></div><div class="field"><label>Ghi chú cho đội đối thủ</label><input class="input" id="sk-note" maxlength="120" placeholder="Đá fair-play, có áo bib…"></div></div></div></div>' : '') +
      '<div class="card card-pad mt16"><div class="card-title">Dịch vụ thêm</div><div id="co-svc"></div></div></div>' +
      '<div class="side-stack"><div class="card card-pad" id="co-sum"></div></div></div></div>';
    // đổ giờ
    var ss = $('#co-start'), se = $('#co-end');
    for (var h = HH.OPEN_HOUR; h < HH.CLOSE_HOUR; h++) ss.insertAdjacentHTML('beforeend', '<option value="' + h + '">' + HH.fmtHour(h) + '</option>');
    for (var h2 = HH.OPEN_HOUR + 1; h2 <= HH.CLOSE_HOUR; h2++) se.insertAdjacentHTML('beforeend', '<option value="' + h2 + '">' + HH.fmtHour(h2) + '</option>');
    ss.value = co.start; se.value = co.end;
    $('#co-svc').innerHTML = cfg.services.map(function (s) {
      return '<div class="svc-row"><span class="ic-wrap">' + ic(s.icon || 'tag', 18) + '</span><div class="grow"><b>' + esc(s.name) + '</b><small>' + money(s.price) + '/' + esc(s.unit) + (s.minHoursAhead ? ' · đặt trước ≥ ' + s.minHoursAhead + ' giờ' : '') + '</small></div><div class="stepper" data-svc="' + s.id + '" data-max="' + s.max + '"><button type="button" data-d="-1" aria-label="Giảm">−</button><span>0</span><button type="button" data-d="1" aria-label="Tăng">+</button></div></div>';
    }).join('');
    var root = $app;
    ss.onchange = function () { co.start = +ss.value; updateCheckout(); };
    se.onchange = function () { co.end = +se.value; updateCheckout(); };
    on(root, 'click', '.stepper button', function (e, b) { var st = b.closest('.stepper'), id2 = st.dataset.svc, v = Math.max(0, Math.min(+st.dataset.max, (co.svc[id2] || 0) + (+b.dataset.d))); co.svc[id2] = v; $('span', st).textContent = v; updateCheckout(); });
    on(root, 'change', 'input[name="mode"]', function (e, el) { co.mode = el.value; $('#seek-box').classList.toggle('hide', co.mode !== 'seeking'); updateCheckout(); });
    on(root, 'click', '#co-promo-apply', function () { co.promoCode = $('#co-promo').value.trim(); co.promo = co.promoCode || null; updateCheckout(true); });
    on(root, 'click', '#co-submit', submitCheckout);
    $('#co-phone').oninput = $('#co-name').oninput = function () { this.classList.remove('invalid'); };
    updateCheckout();
    page = { onData: function () { updateCheckout(); } };
  }

  function checkoutInput() {
    var svc = Object.keys(co.svc).filter(function (k) { return co.svc[k] > 0; }).map(function (k) { return { id: k, qty: co.svc[k] }; });
    var input = { courtId: co.courtId, date: co.date, startHour: co.start, endHour: co.end, customerName: ($('#co-name') || {}).value, phone: ($('#co-phone') || {}).value, note: ($('#co-note') || {}).value, services: svc, promoCode: co.promo || '', source: 'web' };
    if (co.mode === 'seeking') input.seek = { teamName: ($('#sk-team') || {}).value, level: ($('#sk-lv') || {}).value, havePlayers: ($('#sk-have') || {}).value, note: ($('#sk-note') || {}).value };
    return input;
  }

  function updateCheckout(showPromoMsg) {
    if (!$('#co-sum')) return;
    var cfg = HH.getConfig(), c = HH.getCourt(co.courtId), now = HH.now();
    var v = HH.validateSlot({ courtId: co.courtId, date: co.date, startHour: co.start, endHour: co.end }, { now: now });
    $('#co-warn').innerHTML = v.ok ? '' : '<div class="notice bad mt16">' + ic('circle-alert', 18) + '<div><b>Khung giờ này chưa đặt được</b><ul style="margin:4px 0 0;padding-left:16px">' + v.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul></div></div>';
    var f = HH.dayFactor(co.date, cfg);
    $('#co-daynote').innerHTML = f.kind !== 'normal' ? '<div class="notice warn mt16">' + ic('triangle-alert', 16) + '<span>Ngày đá là <b>' + esc(f.label) + '</b> — đơn giá đã được nhân hệ số này.</span></div>' : '';
    var valid = co.end > co.start && co.end - co.start <= cfg.maxHoursPerBooking;
    var pb = valid ? HH.priceBreakdown(c, co.date, co.start, co.end, cfg, now) : { lines: [], total: 0, hasFlash: false, allOffPeak: true, hours: 0 };
    var svc = HH.calcServices(Object.keys(co.svc).filter(function (k) { return co.svc[k] > 0; }).map(function (k) { return { id: k, qty: co.svc[k] }; }), cfg, co.date, co.start, now);
    var disc = 0, promoLine = '', promoNote = '';
    if (co.promo) { var pr = HH.applyPromo(co.promo, { courtAmount: pb.total, hasFlash: pb.hasFlash, allOffPeak: pb.allOffPeak, now: now }); if (pr.ok) { disc = pr.discount; promoLine = '<div class="kv"><span>Mã ' + esc(pr.promo.code) + '</span><b style="color:var(--ok)">-' + money(disc) + '</b></div>'; } else if (showPromoMsg || co.promoShown) { co.promo = null; } promoNote = '<div class="hint mt8" style="color:' + (pr.ok ? 'var(--ok)' : 'var(--bad)') + '">' + esc(pr.message) + '</div>'; co.promoMsg = promoNote; }
    else promoNote = co.promoMsg || '';
    var total = Math.max(0, pb.total - disc + svc.total);
    var seeking = co.mode === 'seeking';
    var depPct = HH.depositPercentFor(($('#co-phone') || {}).value, cfg);
    var dep = Math.round((seeking ? total / 2 : total) * depPct / 100 / 1000) * 1000;
    var svcErr = svc.errors.length ? '<div class="notice warn mt8">' + ic('triangle-alert', 16) + '<span>' + esc(svc.errors.join(' ')) + '</span></div>' : '';
    $('#co-sum').innerHTML = '<div class="card-title">Tóm tắt thanh toán</div>' +
      pb.lines.map(function (l) { return '<div class="kv"><span>' + HH.fmtRange(l.hour, l.hour + 1) + (l.flash ? ' <span class="chip flash">' + ic('zap', 10) + '-' + l.percent + '%</span>' : '') + '</span><b>' + (l.flash ? '<s class="muted" style="font-weight:500">' + HH.fmtK(l.list) + '</s> ' : '') + money(l.price) + '</b></div>'; }).join('') +
      (valid ? '<div class="kv" style="border-top:1px solid var(--line)"><span>Tiền sân (' + pb.hours + ' giờ)</span><b>' + money(pb.total) + '</b></div>' : '<div class="hint">Giờ kết thúc phải sau giờ bắt đầu (tối đa ' + cfg.maxHoursPerBooking + ' giờ).</div>') +
      svc.lines.map(function (l) { return '<div class="kv"><span>' + esc(l.name) + ' × ' + l.qty + '</span><b>' + money(l.amount) + '</b></div>'; }).join('') + promoLine +
      '<div class="kv total"><span>Tổng tiền</span><b>' + money(total) + '</b></div>' +
      '<div class="kv"><span>' + (seeking ? 'Cọc phần của đội bạn' : 'Đặt cọc') + ' (' + depPct + '%)</span><b>' + money(dep) + '</b></div>' +
      (seeking ? '<div class="kv"><span>Chi phí mỗi đội (chia đôi)</span><b>' + money(Math.round(total / 2 / 1000) * 1000) + '</b></div>' : '<div class="kv"><span>Còn lại trả tại sân</span><b>' + money(total - dep) + '</b></div>') +
      '<div class="field mt16"><label>Mã khuyến mãi</label><div class="row"><input class="input" id="co-promo" placeholder="VD: HUYHOANG10" value="' + esc(co.promo || '') + '" style="text-transform:uppercase"><button class="btn btn-outline" type="button" id="co-promo-apply">Áp dụng</button></div>' + promoNote + '</div>' + svcErr +
      '<div class="notice mt16">' + ic('shield-check', 16) + '<span>' + (seeking ? 'Kèo tìm đối: sân giữ chỗ (màu tím) đến ' + HH.fmtHour(cfg.seek.deadlineHour) + ' ngày đá. Cọc sau khi ghép đội thành công.' : 'Sân được giữ ' + cfg.holdMinutes + ' phút để bạn thanh toán cọc (mô phỏng).') + '</span></div>' +
      '<button class="btn btn-primary btn-lg btn-block mt16" id="co-submit" ' + (v.ok && valid ? '' : 'disabled') + '>' + (seeking ? 'Mở kèo tìm đối' : 'Giữ chỗ &amp; thanh toán') + ' ' + ic('arrow-right', 18) + '</button>';
  }

  function submitCheckout() {
    var input = checkoutInput(), cfg = HH.getConfig();
    var nameEl = $('#co-name'), phoneEl = $('#co-phone');
    ['#e-name', '#e-phone'].forEach(function (s) { $(s).textContent = ''; });
    var bad = false;
    if (String(input.customerName || '').trim().length < 2) { nameEl.classList.add('invalid'); $('#e-name').textContent = 'Vui lòng nhập họ tên.'; bad = true; }
    if (!HH.normalizePhone(input.phone)) { phoneEl.classList.add('invalid'); $('#e-phone').textContent = 'Số điện thoại không hợp lệ (VD: 0901234567).'; bad = true; }
    if (bad) { toast('warn', 'Vui lòng kiểm tra lại thông tin', []); (nameEl.classList.contains('invalid') ? nameEl : phoneEl).focus(); return; }
    var btn = $('#co-submit'); btn.disabled = true; btn.innerHTML = '<span class="skeleton" style="display:inline-block;width:90px;height:14px"></span> Đang giữ chỗ…';
    setTimeout(function () { // giả lập độ trễ xử lý ngắn
      var res = HH.createBooking(input, { actor: 'Khách hàng' });
      if (!res.ok) { toastErrors(res, 'Không thể đặt sân'); updateCheckout(); return; }
      toast('ok', 'Đã giữ chỗ thành công', ['Mã đơn ' + res.booking.id + ' – hãy hoàn tất thanh toán cọc (mô phỏng).']);
      go('#/don/' + res.booking.id);
    }, 450);
  }

  /* ======================================================================
     ĐƠN: THANH TOÁN MÔ PHỎNG / KẾT QUẢ
     ====================================================================== */
  function pageOrder(id) {
    setNav('dat-san');
    var render = function () {
      var b = HH.getBooking(id);
      if (!b) { $app.innerHTML = '<div class="container mt24 card">' + empty('search', 'Không tìm thấy đơn ' + esc(id), '<span>Có thể đơn đã bị xóa khi khôi phục dữ liệu mẫu.</span>', '<a class="btn btn-primary" href="#/dat-san">Đặt sân mới</a>') + '</div>'; return; }
      var cfg = HH.getConfig(), c = HH.getCourt(b.courtId), seekOpen = HH.isSeekingOpen(b);
      var needPay = b.status !== 'cancelled' && b.paymentStatus === 'unpaid' && !seekOpen;
      var cur = b.status === 'cancelled' ? 4 : (needPay ? 3 : 4);
      var left = '<div class="card card-pad"><div class="sum-court"><img src="' + c.image + '" alt=""><div class="grow"><h3 style="font-size:18px">' + esc(c.name) + ' <span class="chip">' + (c.type === 7 ? 'Sân 7 người' : 'Sân 5 người') + '</span></h3><div class="muted mt8">' + HH.fmtDateLong(b.date) + ' · ' + HH.fmtRange(b.startHour, b.endHour) + '</div><div class="row wrap mt8">' + statusChip(b) + payChip(b) + (b.seek ? '<span class="chip purple">' + (b.seek.opponent ? 'Đã ghép đối' : 'Đang tìm đối') + '</span>' : '') + '</div></div></div>' +
        '<div class="mt16"><div class="kv"><span>Mã đơn</span><b class="order-code">' + b.id + '</b></div><div class="kv"><span>Người đặt</span><b>' + esc(b.customerName) + '</b></div><div class="kv"><span>Số điện thoại</span><b>' + HH.fmtPhone(b.phone) + '</b></div>' + (b.note ? '<div class="kv"><span>Ghi chú</span><b>' + esc(b.note) + '</b></div>' : '') +
        '<div class="kv"><span>Tiền sân (' + (b.endHour - b.startHour) + ' giờ)</span><b>' + money(b.courtAmount) + '</b></div>' + b.services.map(function (s) { return '<div class="kv"><span>' + esc(s.name) + ' × ' + s.qty + '</span><b>' + money(s.amount) + '</b></div>'; }).join('') + (b.discountAmount ? '<div class="kv"><span>Mã ' + esc(b.promoCode) + '</span><b style="color:var(--ok)">-' + money(b.discountAmount) + '</b></div>' : '') +
        '<div class="kv total"><span>Tổng tiền</span><b>' + money(b.totalAmount) + '</b></div><div class="kv"><span>Tiền đặt cọc (' + b.depositPercent + '%)' + (b.seek ? ' – phần đội bạn' : '') + '</span><b>' + money(b.depositAmount) + '</b></div><div class="kv"><span>Số tiền còn lại</span><b>' + money(Math.max(0, b.totalAmount - (b.paymentStatus === 'paid' ? b.totalAmount : (b.paymentStatus === 'deposit' ? b.depositAmount : 0)))) + '</b></div><div class="kv"><span>Trạng thái thanh toán</span><b>' + payChip(b) + '</b></div></div></div>';
      var right = '';
      if (b.status === 'cancelled') {
        right = '<div class="card card-pad"><div class="notice bad">' + ic('circle-x', 18) + '<div><b>Đơn đã hủy</b><br>' + esc(b.cancelReason || '') + (b.cancelledBy ? ' (bởi ' + esc(b.cancelledBy) + ')' : '') + '</div></div>' + (b.refundAmount ? '<div class="kv mt16"><span>Hoàn cọc mô phỏng (' + b.refundPercent + '%)</span><b>' + money(b.refundAmount) + '</b></div>' : '') + '<p class="hint mt8">Sân đã được nhả lại cho khách khác.</p><a class="btn btn-primary btn-block mt16" href="#/dat-san">Đặt sân khác</a></div>';
      } else if (seekOpen) {
        right = '<div class="card card-pad"><div class="notice" style="background:var(--purple-bg);color:#4c2aa8">' + ic('swords', 18) + '<div><b>Kèo đang chờ đối thủ</b><br>Sân đang giữ chỗ (màu tím). Hạn chót ' + HH.fmtHour(cfg.seek.deadlineHour) + ' ngày ' + HH.fmtDate(b.date) + ' — chưa có đội nhận kèo thì đơn tự hủy và sân được mở lại.</div></div><div class="kv mt16"><span>Đội của bạn</span><b>' + esc(b.seek.teamName) + '</b></div><div class="kv"><span>Trình độ</span><b>' + levelBadge(b.seek.level) + '</b></div><div class="kv"><span>Chi phí mỗi đội</span><b>' + money(Math.round(b.totalAmount / 2 / 1000) * 1000) + '</b></div><a class="btn btn-purple btn-block mt16" href="#/tim-doi">Xem trong bảng kèo</a><button class="btn btn-outline btn-block mt8" id="o-cancel">Hủy kèo</button></div>';
      } else if (needPay) {
        var qr = HH.qrSvg('HUYHOANG-DEMO|' + b.id + '|' + b.depositAmount, { size: 190, margin: 1 });
        right = '<div class="card card-pad"><div class="card-title">Thanh toán đặt cọc ' + money(b.depositAmount) + '</div><div class="qr-box"><div class="qr">' + qr + '</div></div>' +
          '<div class="kv"><span>Ngân hàng</span><b>Ngân hàng minh họa</b></div><div class="kv"><span>Chủ tài khoản</span><b>HUY HOANG DEMO</b></div><div class="kv"><span>Số tài khoản</span><b>0000 1234 5678</b></div><div class="kv"><span>Nội dung CK</span><b class="order-code">' + b.id + '</b></div>' +
          (b.holdUntil ? '<div class="mt16 center muted">Thời gian giữ chỗ còn lại</div><div class="countdown" id="cd">--:--</div>' : '') +
          '<div class="notice warn mt16">' + ic('triangle-alert', 16) + '<span><b>Thanh toán mô phỏng.</b> Mã QR chỉ để minh họa, không chuyển tiền thật và website không đối soát ngân hàng. Bấm nút bên dưới để giả lập đã chuyển khoản.</span></div>' +
          '<button class="btn btn-primary btn-lg btn-block mt16" id="o-pay">' + ic('circle-check', 18) + ' Đã thanh toán (mô phỏng)</button><button class="btn btn-outline btn-block mt8" id="o-cancel">Hủy đơn</button></div>';
      } else {
        right = '<div class="card"><div class="success-hero"><div class="tick">' + ic('circle-check', 40) + '</div><h2 style="font-size:22px">' + (b.status === 'confirmed' ? 'Đặt sân thành công!' : 'Đã ghi nhận đặt cọc') + '</h2><p class="muted">' + (b.status === 'confirmed' ? 'Đơn của bạn đã được xác nhận. Hẹn gặp bạn tại sân!' : 'Đơn đang chờ nhân viên xác nhận. Trang này tự cập nhật khi Admin xác nhận.') + '</p></div><div class="card-pad"><div class="notice ok">' + ic('qr-code', 18) + '<span>Mã check-in minh họa: <b class="order-code">' + b.id + '</b>. Đưa mã này cho nhân viên khi đến sân.</span></div><div class="row wrap mt16"><a class="btn btn-primary" style="flex:1" href="#/dat-san">Đặt thêm sân</a><button class="btn btn-outline" id="o-cancel" style="flex:1">Hủy đơn</button></div><button class="btn btn-soft btn-block mt8" onclick="window.print()">' + ic('printer', 16) + ' In / lưu phiếu đặt sân</button></div></div>';
      }
      $app.innerHTML = '<div class="page-enter container">' + stepsHtml(cur) + '<div class="checkout-layout"><div>' + left + '</div><div class="side-stack">' + right + '</div></div></div>';
      var pay = $('#o-pay'); if (pay) pay.onclick = function () {
        pay.disabled = true;
        setTimeout(function () { var r = HH.markPayment(id, 'deposit', 'Khách hàng'); if (!r.ok) { toastErrors(r); } else toast('ok', 'Đã ghi nhận đặt cọc (mô phỏng)', ['Đơn chuyển sang chờ nhân viên xác nhận.']); }, 500);
      };
      var cn = $('#o-cancel'); if (cn) cn.onclick = function () { cancelDialog(id); };
      var cd = $('#cd'); if (cd && b.holdUntil) {
        var tick = function () { var s = Math.max(0, Math.floor((new Date(b.holdUntil) - HH.now()) / 1000)); cd.textContent = HH.pad2(Math.floor(s / 60)) + ':' + HH.pad2(s % 60); cd.classList.toggle('low', s < 60); if (s <= 0) HH.maintenance(); };
        tick(); timers.push(setInterval(tick, 1000));
      }
    };
    timers.forEach(clearInterval); timers = [];
    render();
    page = { onData: function () { timers.forEach(clearInterval); timers = []; render(); } };
  }


  /* ======================================================================
     THANH TOÁN CỌC CỦA ĐỘI NHẬN KÈO (60 phút, có mã QR mô phỏng)
     ====================================================================== */
  function pageSeekPay(id) {
    setNav('tim-doi');
    var render = function () {
      var b = HH.getBooking(id), o = b && b.seek && b.seek.opponent;
      if (!b || !b.seek) { $app.innerHTML = '<div class="container mt24 card">' + empty('search', 'Không tìm thấy kèo ' + esc(id), '', '<a class="btn btn-primary" href="#/tim-doi">Về trang tìm đối</a>') + '</div>'; return; }
      if (!o || b.status === 'cancelled') { $app.innerHTML = '<div class="container mt24 card">' + empty('swords', b.status === 'cancelled' ? 'Kèo đã bị hủy' : 'Đội của bạn không còn trong kèo này', '<span>Có thể đã quá 60 phút chưa cọc nên kèo được mở lại cho đội khác.</span>', '<a class="btn btn-primary" href="#/tim-doi">Tìm kèo khác</a>') + '</div>'; return; }
      var c = HH.getCourt(b.courtId), cfg = HH.getConfig(), share = Math.round(b.totalAmount / 2 / 1000) * 1000;
      var steps = '<div class="steps">' + ['Nhận kèo', 'Ghép đối thành công', 'Thanh toán cọc', 'Hoàn tất'].map(function (t, i) { var cur = o.paid ? 4 : 3; return '<div class="step ' + (i + 1 < cur ? 'done' : (i + 1 === cur ? 'cur' : '')) + '"><i>' + (i + 1 < cur ? ic('check', 16) : (i + 1)) + '</i>' + t + '</div>'; }).join('') + '</div>';
      var left = '<div class="card card-pad"><div class="sum-court"><img src="' + c.image + '" alt=""><div class="grow"><h3 style="font-size:18px">' + esc(c.name) + ' <span class="chip">' + (c.type === 7 ? 'Sân 7 người' : 'Sân 5 người') + '</span></h3><div class="muted mt8">' + HH.fmtDateLong(b.date) + ' · ' + HH.fmtRange(b.startHour, b.endHour) + '</div><div class="row wrap mt8"><span class="chip purple">Đã ghép đối</span></div></div></div>' +
        '<div class="versus mt16"><div><small>Đội chủ</small><b>' + esc(b.seek.teamName) + '</b>' + levelBadge(b.seek.level) + '</div><span>VS</span><div><small>Đội của bạn</small><b>' + esc(o.teamName) + '</b>' + levelBadge(o.level) + '</div></div>' +
        '<div class="mt16"><div class="kv"><span>Mã kèo</span><b class="order-code">' + b.id + '</b></div><div class="kv"><span>Số điện thoại đội bạn</span><b>' + HH.fmtPhone(o.phone) + '</b></div><div class="kv"><span>Chi phí mỗi đội (chia đôi)</span><b>' + money(share) + '</b></div><div class="kv total"><span>Tiền cọc của đội bạn (' + cfg.depositPercent + '%)</span><b>' + money(o.depositAmount) + '</b></div><div class="kv"><span>Còn lại thanh toán tại sân</span><b>' + money(share - (o.paid ? o.depositAmount : 0)) + '</b></div></div></div>';
      var right;
      if (o.paid) {
        right = '<div class="card"><div class="success-hero"><div class="tick">' + ic('circle-check', 40) + '</div><h2 style="font-size:22px">Đã cọc — giữ kèo thành công!</h2><p class="muted">Hai đội hẹn gặp nhau tại ' + esc(c.name) + '. Nhớ đến trước giờ đá 15 phút.</p></div><div class="card-pad"><a class="btn btn-primary btn-block" href="#/tim-doi">Về trang tìm đối</a><button class="btn btn-soft btn-block mt8" onclick="window.print()">' + ic('printer', 16) + ' In / lưu phiếu</button></div></div>';
      } else {
        right = '<div class="card card-pad"><div class="card-title">Thanh toán cọc ' + money(o.depositAmount) + '</div><div class="qr-box"><div class="qr">' + HH.qrSvg('HUYHOANG-DEMO|SEEK|' + b.id + '|' + o.phone + '|' + o.depositAmount, { size: 190, margin: 1 }) + '</div></div>' +
          '<div class="kv"><span>Ngân hàng</span><b>Ngân hàng minh họa</b></div><div class="kv"><span>Chủ tài khoản</span><b>HUY HOANG DEMO</b></div><div class="kv"><span>Số tài khoản</span><b>0000 1234 5678</b></div><div class="kv"><span>Nội dung CK</span><b class="order-code">' + b.id + ' DOI</b></div>' +
          '<div class="mt16 center muted">Thời gian giữ kèo còn lại (1 giờ)</div><div class="countdown" id="cd">--:--</div>' +
          '<div class="notice warn mt16">' + ic('triangle-alert', 16) + '<span><b>Thanh toán mô phỏng.</b> Mã QR chỉ minh họa, không chuyển tiền thật. Quá 60 phút chưa cọc, đội bạn bị loại và kèo mở lại cho đội khác.</span></div>' +
          '<button class="btn btn-primary btn-lg btn-block mt16" id="sp-pay">' + ic('circle-check', 18) + ' Đã thanh toán (mô phỏng)</button><button class="btn btn-outline btn-block mt8" id="sp-leave">Rút khỏi kèo</button></div>';
      }
      $app.innerHTML = '<div class="page-enter container">' + steps + '<div class="checkout-layout"><div>' + left + '</div><div class="side-stack">' + right + '</div></div></div>';
      var pay = $('#sp-pay'); if (pay) pay.onclick = function () { pay.disabled = true; setTimeout(function () { var r = HH.markOpponentPaid(id); if (!r.ok) toastErrors(r); else toast('ok', 'Đã ghi nhận đặt cọc (mô phỏng)', ['Kèo của bạn đã được giữ.']); }, 500); };
      var lv = $('#sp-leave'); if (lv) lv.onclick = function () { confirmBox('Rút khỏi kèo?', 'Kèo sẽ mở lại để đội khác nhận. Bạn có thể nhận lại kèo khác sau.', 'Rút khỏi kèo', true).then(function (ok) { if (!ok) return; var r = HH.leaveSeek(id, 'Đội nhận kèo tự rút lui'); if (r.ok) { toast('ok', 'Đã rút khỏi kèo'); go('#/tim-doi'); } else toastErrors(r); }); };
      var cd = $('#cd'); if (cd && o.payUntil) {
        var tick = function () { var sec = Math.max(0, Math.floor((new Date(o.payUntil) - HH.now()) / 1000)); cd.textContent = HH.pad2(Math.floor(sec / 60)) + ':' + HH.pad2(sec % 60); cd.classList.toggle('low', sec < 300); if (sec <= 0) HH.maintenance(); };
        tick(); timers.push(setInterval(tick, 1000));
      }
    };
    timers.forEach(clearInterval); timers = [];
    render();
    page = { onData: function () { timers.forEach(clearInterval); timers = []; render(); } };
  }

  function cancelDialog(id) {
    var b = HH.getBooking(id); if (!b) return;
    var pct = HH.refundPercentFor(b), paid = HH.paidAmount(b), refund = Math.round(paid * pct / 100 / 1000) * 1000;
    var msg = '<p style="margin:0 0 10px">Bạn chắc chắn muốn hủy đơn <b>' + b.id + '</b> (' + esc(HH.getCourt(b.courtId).name) + ', ' + HH.fmtDate(b.date) + ' ' + HH.fmtRange(b.startHour, b.endHour) + ')?</p>' +
      (paid > 0 ? '<div class="notice ' + (pct ? 'ok' : 'bad') + '">' + ic('wallet', 16) + '<span>Theo chính sách, bạn được hoàn <b>' + pct + '%</b> tiền đã cọc = <b>' + money(refund) + '</b> (mô phỏng).</span></div>' : '<div class="notice">' + ic('info', 16) + '<span>Đơn chưa thanh toán nên không phát sinh hoàn tiền.</span></div>');
    confirmBox('Hủy đơn đặt sân', msg, 'Xác nhận hủy', true).then(function (ok) {
      if (!ok) return;
      var r = HH.cancelBooking(id, { by: 'Khách hàng', reason: 'Khách hàng yêu cầu hủy' });
      if (r.ok) toast('ok', 'Đã hủy đơn ' + id, [r.booking.refundAmount ? 'Hoàn cọc mô phỏng ' + money(r.booking.refundAmount) : 'Sân đã được mở lại']); else toastErrors(r);
    });
  }

  /* ======================================================================
     TÌM ĐỐI & GHÉP NGƯỜI
     ====================================================================== */
  var sk = { tab: 'opp', type: 'all', when: 'all', level: 'all', ptype: 'all' };
  function pageSeek() {
    setNav('tim-doi');
    $app.innerHTML = '<div class="page-enter container"><div class="page-head"><div><h1 class="page-title">Tìm đối &amp; Ghép người</h1><div class="page-sub">Kết nối những người có cùng đam mê</div></div></div>' +
      '<div class="book-layout"><div><div class="tabs-big" id="sk-tabs"></div><div class="card filter-bar" id="sk-filters"></div><h3 style="margin:18px 0 10px;font-size:17px" id="sk-title"></h3><div class="feed" id="sk-feed"></div></div><aside class="side-stack" id="sk-side"></aside></div></div>';
    renderSeek();
    on($app, 'click', '#sk-tabs button', function (e, b) { sk.tab = b.dataset.tab; renderSeek(); });
    on($app, 'change', '#sk-filters select', function (e, el) { sk[el.dataset.k] = el.value; renderSeek(); });
    on($app, 'click', '[data-join-seek]', function (e, b) { seekModal(b.dataset.joinSeek); });
    on($app, 'click', '[data-join-post]', function (e, b) { postJoinModal(b.dataset.joinPost); });
    on($app, 'click', '#sk-post', function () { if (sk.tab === 'opp') { toast('info', 'Đăng kèo tìm đối', ['Chọn sân và giờ, rồi chọn "Cần tìm đối" ở bước xác nhận.']); go('#/dat-san?type=5&win=evening'); } else postCreateModal(); });
    page = { onData: renderSeek };
  }
  function renderSeek() {
    if (!$('#sk-feed')) return;
    $('#sk-tabs').innerHTML = '<button data-tab="opp" class="' + (sk.tab === 'opp' ? 'on' : '') + '">' + ic('swords', 18) + ' Tìm đối thủ</button><button data-tab="ppl" class="green ' + (sk.tab === 'ppl' ? 'on' : '') + '">' + ic('users', 18) + ' Tìm người chơi</button>';
    var cfg = HH.getConfig(), today = HH.todayStr();
    if (sk.tab === 'opp') {
      $('#sk-filters').innerHTML = '<div class="field"><label>Loại sân</label><select class="select" data-k="type"><option value="all">Tất cả loại sân</option><option value="5" ' + (sk.type === '5' ? 'selected' : '') + '>Sân 5 người</option><option value="7" ' + (sk.type === '7' ? 'selected' : '') + '>Sân 7 người</option></select></div>' +
        '<div class="field"><label>Thời gian</label><select class="select" data-k="when"><option value="all">Tất cả thời gian</option><option value="today" ' + (sk.when === 'today' ? 'selected' : '') + '>Hôm nay</option><option value="tomorrow" ' + (sk.when === 'tomorrow' ? 'selected' : '') + '>Ngày mai</option><option value="week" ' + (sk.when === 'week' ? 'selected' : '') + '>7 ngày tới</option></select></div>' +
        '<div class="field"><label>Trình độ</label><select class="select" data-k="level"><option value="all">Mọi trình độ</option>' + HH.LEVELS.map(function (l) { return '<option value="' + l.id + '" ' + (sk.level === l.id ? 'selected' : '') + '>' + l.label + '</option>'; }).join('') + '</select></div><button class="btn btn-primary" id="sk-post" style="margin-left:auto">' + ic('plus', 16) + ' Đăng kèo</button>';
      var list = HH.listOpenSeeks().filter(function (b) {
        var c = HH.getCourt(b.courtId);
        if (sk.type !== 'all' && String(c.type) !== sk.type) return false;
        if (sk.level !== 'all' && b.seek.level !== sk.level) return false;
        if (sk.when === 'today' && b.date !== today) return false;
        if (sk.when === 'tomorrow' && b.date !== HH.addDays(today, 1)) return false;
        if (sk.when === 'week' && b.date > HH.addDays(today, 6)) return false;
        return true;
      });
      $('#sk-title').textContent = 'Các kèo đang đăng (' + list.length + ')';
      $('#sk-feed').innerHTML = list.length ? list.map(function (b) {
        var c = HH.getCourt(b.courtId), share = Math.round(b.totalAmount / 2 / 1000) * 1000, total = b.seek.teamSize * 2, hrs = HH.hoursUntil(b.date, cfg.seek.deadlineHour, HH.now());
        return '<div class="card feed-item"><div class="ph"><img src="' + HH.teamImg(b.seek.teamName, c.image) + '" alt="' + esc(b.seek.teamName) + '"></div><div class="info"><h4>' + esc(b.seek.teamName) + ' <span class="muted" style="font-weight:500">đang tìm đối</span></h4><div class="meta"><span>' + ic('calendar', 13) + HH.fmtDateLong(b.date) + ', ' + HH.fmtRange(b.startHour, b.endHour) + '</span><span>' + ic('map-pin', 13) + esc(c.name) + ' · ' + (c.type === 7 ? '7' : '5') + ' người</span><span>' + ic('wallet', 13) + money(share) + '/đội</span></div><div class="row wrap">' + levelBadge(b.seek.level) + '<span class="chip warn">' + ic('timer', 11) + 'Hạn chót ' + HH.fmtHour(cfg.seek.deadlineHour) + (hrs > 0 && hrs < 24 ? ' · còn ' + Math.floor(hrs) + 'h' : '') + '</span><span class="chip">Đã có ' + b.seek.havePlayers + '/' + total + '</span></div><div class="progress mt8"><i style="width:' + Math.round(b.seek.havePlayers / total * 100) + '%"></i></div>' + (b.seek.note ? '<div class="hint mt8">“' + esc(b.seek.note) + '”</div>' : '') + '</div><button class="btn btn-primary" data-join-seek="' + b.id + '">Nhận kèo</button></div>';
      }).join('') : '<div class="card">' + empty('swords', 'Chưa có kèo phù hợp', '<span>Hãy thử bỏ bớt bộ lọc hoặc đăng kèo mới khi đặt sân.</span>', '<a class="btn btn-primary" href="#/dat-san?type=5&win=evening">Đặt sân &amp; mở kèo</a>') + '</div>';
    } else {
      $('#sk-filters').innerHTML = '<div class="field"><label>Loại bài đăng</label><select class="select" data-k="ptype"><option value="all">Tất cả</option><option value="need_players" ' + (sk.ptype === 'need_players' ? 'selected' : '') + '>Đội cần thêm người</option><option value="free_player" ' + (sk.ptype === 'free_player' ? 'selected' : '') + '>Cầu thủ tự do</option></select></div><div class="field"><label>Trình độ</label><select class="select" data-k="level"><option value="all">Mọi trình độ</option>' + HH.LEVELS.map(function (l) { return '<option value="' + l.id + '" ' + (sk.level === l.id ? 'selected' : '') + '>' + l.label + '</option>'; }).join('') + '</select></div><button class="btn btn-primary" id="sk-post" style="margin-left:auto">' + ic('plus', 16) + ' Đăng bài</button>';
      var posts = HH.getPosts().filter(function (p) { return (sk.ptype === 'all' || p.type === sk.ptype) && (sk.level === 'all' || p.level === sk.level); });
      $('#sk-title').textContent = 'Bài đăng ghép người (' + posts.length + ')';
      $('#sk-feed').innerHTML = posts.length ? posts.map(function (p) {
        var need = p.type === 'need_players', left = need ? p.needed - p.joined.length : 0;
        return '<div class="card feed-item">' + (need ? teamLogoHtml(p.teamName) : '<div class="avatar lg" style="flex:none;color:#04210f">' + esc(initials(p.name)) + '</div>') + '<div class="info"><h4>' + esc(p.title) + '</h4><div class="meta">' +
          (need ? '<span>' + ic('users', 13) + esc(p.teamName) + ' · ' + esc(p.name) + '</span><span>' + ic('calendar', 13) + HH.fmtDateLong(p.date) + ', ' + HH.fmtHour(p.hour) + '</span><span>' + ic('circle-dot', 13) + 'Sân ' + p.courtType + ' người · ' + money(p.fee) + '/người</span><span>' + ic('target', 13) + esc(p.position) + '</span>' : '<span>' + ic('user', 13) + esc(p.name) + '</span><span>' + ic('target', 13) + esc(p.position) + '</span><span>' + ic('map-pin', 13) + esc(p.area) + '</span><span>' + ic('clock', 13) + esc(p.availability) + '</span>') + '</div><div class="row wrap">' + levelBadge(p.level) + (need ? '<span class="chip ' + (left ? 'ok' : 'bad') + '">' + (left ? 'Còn ' + left + ' chỗ' : 'Đã đủ người') + '</span>' : '<span class="chip info">' + p.joined.length + ' đội đã liên hệ</span>') + '</div>' + (p.note ? '<div class="hint mt8">“' + esc(p.note) + '”</div>' : '') + '</div><button class="btn btn-primary" data-join-post="' + p.id + '" ' + (need && !left ? 'disabled' : '') + '>' + (need ? 'Xin tham gia' : 'Liên hệ') + '</button></div>';
      }).join('') : '<div class="card">' + empty('users', 'Chưa có bài đăng phù hợp', '', '<button class="btn btn-primary" id="sk-post2">Đăng bài đầu tiên</button>') + '</div>';
      var b2 = $('#sk-post2'); if (b2) b2.onclick = postCreateModal;
    }
    $('#sk-side').innerHTML = '<div class="card side-card"><h3>Lợi ích</h3><div class="amen-list"><div>' + ic('zap', 16) + 'Tìm đối nhanh ngay khi đặt sân</div><div>' + ic('handshake', 16) + 'Ghép đội, ghép người dễ dàng</div><div>' + ic('users', 16) + 'Cộng đồng bóng đá văn minh</div></div></div>' +
      '<div class="card side-card"><h3>Trình độ</h3><div class="legend-lv">' + HH.LEVELS.map(function (l) { return '<div><i style="background:' + l.color + '"></i>' + l.label + '</div>'; }).join('') + '</div></div>' +
      '<div class="card side-card"><h3>Quy tắc (mô phỏng)</h3><ul class="policy" style="font-size:12.5px"><li>' + ic('timer', 15) + '<span>Hạn chót ghép <b>' + HH.fmtHour(cfg.seek.deadlineHour) + '</b> ngày đá, quá hạn sân tự mở lại.</span></li><li>' + ic('layers', 15) + '<span>Tối đa <b>' + cfg.seek.maxPerDay + '</b> sân tìm đối mỗi ngày.</span></li><li>' + ic('wallet', 15) + '<span>Ghép xong, mỗi đội cọc ' + cfg.depositPercent + '% trong 1 giờ.</span></li><li>' + ic('medal', 15) + '<span>Cần điểm uy tín từ ' + cfg.seek.minReputation + '.</span></li></ul><p class="hint">Các quy tắc có thể cấu hình trong Admin → Cài đặt.</p></div>' +
      '<div class="community"><div>CÙNG NHAU RA SÂN<em>KẾT NỐI ĐAM MÊ</em></div></div>';
  }
  function postJoinModal(id) {
    var p = HH.getPosts().filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var m = HH.getSession(), need = p.type === 'need_players';
    openModal({ title: need ? 'Xin tham gia: ' + esc(p.title) : 'Liên hệ cầu thủ ' + esc(p.name), body: '<div class="notice" style="margin-bottom:12px">' + ic('info', 16) + '<span>Chức năng <b>mô phỏng</b>: thông tin được lưu trên trình duyệt, không có chat hay thông báo thật.</span></div><div class="form-grid"><div class="field full"><label>Họ và tên</label><input class="input" id="pj-name" value="' + esc(m ? m.name : '') + '"></div><div class="field full"><label>Số điện thoại</label><input class="input" id="pj-phone" value="' + esc(m ? m.phone : '') + '" placeholder="0901234567"></div></div><div id="pj-err" class="field-err mt8"></div>',
      foot: '<button class="btn btn-outline" data-close>Đóng</button><button class="btn btn-primary" id="pj-ok">Gửi yêu cầu</button>', onMount: function (el, api) {
        $('#pj-ok', el).onclick = function () { var r = HH.joinPost(id, { name: $('#pj-name', el).value, phone: $('#pj-phone', el).value }); if (!r.ok) { $('#pj-err', el).textContent = r.errors[0].message; return; } api.close(); toast('ok', 'Đã gửi yêu cầu', ['Chủ bài đăng sẽ liên hệ lại (mô phỏng).']); };
      } });
  }
  function postCreateModal() {
    var m = HH.getSession(), t = HH.todayStr();
    openModal({ title: 'Đăng bài ghép người', body: '<div class="form-grid"><div class="field full"><label>Loại bài đăng</label><select class="select" id="pc-type"><option value="need_players">Đội mình cần thêm người</option><option value="free_player">Mình là cầu thủ tự do</option></select></div><div class="field"><label>Họ và tên *</label><input class="input" id="pc-name" value="' + esc(m ? m.name : '') + '"></div><div class="field"><label>Số điện thoại *</label><input class="input" id="pc-phone" value="' + esc(m ? m.phone : '') + '"></div><div class="field"><label>Trình độ</label><select class="select" id="pc-lv">' + HH.LEVELS.map(function (l) { return '<option value="' + l.id + '">' + l.label + '</option>'; }).join('') + '</select></div><div class="field"><label>Vị trí</label><input class="input" id="pc-pos" placeholder="VD: Thủ môn"></div>' +
      '<div class="field need"><label>Tên đội</label><input class="input" id="pc-team"></div><div class="field need"><label>Số người cần thêm</label><input class="input" type="number" id="pc-needed" min="1" max="6" value="2"></div><div class="field need"><label>Ngày đá</label><input class="input" type="date" id="pc-date" min="' + t + '" value="' + HH.addDays(t, 1) + '"></div><div class="field need"><label>Giờ đá</label><select class="select" id="pc-hour">' + [16, 17, 18, 19, 20, 21].map(function (h) { return '<option value="' + h + '" ' + (h === 19 ? 'selected' : '') + '>' + HH.fmtHour(h) + '</option>'; }).join('') + '</select></div><div class="field need"><label>Phí mỗi người (đ)</label><input class="input" type="number" id="pc-fee" min="0" step="5000" value="40000"></div><div class="field free hide"><label>Khu vực</label><input class="input" id="pc-area" placeholder="Bình Thạnh, Phú Nhuận"></div><div class="field free hide full"><label>Thời gian rảnh</label><input class="input" id="pc-avail" placeholder="Tối thứ 3, thứ 5, cuối tuần"></div><div class="field full"><label>Ghi chú</label><input class="input" id="pc-note" maxlength="120"></div></div><div id="pc-err" class="field-err mt8"></div>',
      foot: '<button class="btn btn-outline" data-close>Đóng</button><button class="btn btn-primary" id="pc-ok">Đăng bài</button>', onMount: function (el, api) {
        var sync = function () { var need = $('#pc-type', el).value === 'need_players'; $$('.need', el).forEach(function (x) { x.classList.toggle('hide', !need); }); $$('.free', el).forEach(function (x) { x.classList.toggle('hide', need); }); };
        $('#pc-type', el).onchange = sync;
        $('#pc-ok', el).onclick = function () {
          var need = $('#pc-type', el).value === 'need_players', name = $('#pc-name', el).value.trim(), phone = HH.normalizePhone($('#pc-phone', el).value), err = $('#pc-err', el);
          if (name.length < 2) { err.textContent = 'Vui lòng nhập họ tên.'; return; } if (!phone) { err.textContent = 'Số điện thoại không hợp lệ.'; return; }
          var post = { type: need ? 'need_players' : 'free_player', name: name, phone: phone, level: $('#pc-lv', el).value, position: $('#pc-pos', el).value.trim() || 'Bất kỳ', note: $('#pc-note', el).value.trim() };
          if (need) {
            var d = $('#pc-date', el).value, team = $('#pc-team', el).value.trim(), n = parseInt($('#pc-needed', el).value, 10);
            if (team.length < 2) { err.textContent = 'Vui lòng nhập tên đội.'; return; } if (!HH.isValidDateStr(d) || d < HH.todayStr()) { err.textContent = 'Ngày đá không hợp lệ.'; return; } if (!(n >= 1 && n <= 6)) { err.textContent = 'Số người cần thêm từ 1 đến 6.'; return; }
            Object.assign(post, { title: 'Đội ' + team + ' cần thêm ' + n + ' người', teamName: team, date: d, hour: +$('#pc-hour', el).value, courtType: 5, needed: n, fee: Math.max(0, parseInt($('#pc-fee', el).value, 10) || 0) });
          } else Object.assign(post, { title: 'Cầu thủ tự do tìm kèo', area: $('#pc-area', el).value.trim() || 'TP.HCM', availability: $('#pc-avail', el).value.trim() || 'Linh hoạt', needed: 0 });
          HH.addPost(post); api.close(); toast('ok', 'Đã đăng bài', ['Bài của bạn xuất hiện ở đầu danh sách.']);
        };
        sync();
      } });
  }

  /* ======================================================================
     GIẢI ĐẤU, DỊCH VỤ, LIVESTREAM MINH HỌA
     ====================================================================== */
  function tourCard(t) {
    var full = t.teams.length >= t.maxTeams, st = !t.registrationOpen ? '<span class="chip muted">Đã đóng đăng ký</span>' : (full ? '<span class="chip bad">Đã đủ đội</span>' : '<span class="chip ok">Đang mở đăng ký</span>');
    return '<article class="card tour-card"><div class="ph"><img src="' + t.image + '" alt="' + esc(t.name) + '">' + st + '</div><div class="body"><h3>' + esc(t.name) + '</h3><div class="muted" style="font-size:12.5px">' + ic('calendar', 13) + ' ' + HH.fmtDate(t.startDate) + (t.endDate !== t.startDate ? ' – ' + HH.fmtDate(t.endDate) : '') + ' · ' + esc(t.format) + '</div><div class="muted" style="font-size:12.5px">' + ic('map-pin', 13) + ' ' + esc(t.venue) + '</div><div class="row" style="justify-content:space-between"><span>Lệ phí <b>' + money(t.fee) + '</b>/đội</span><span class="muted">' + t.teams.length + '/' + t.maxTeams + ' đội</span></div><div class="progress"><i style="width:' + Math.round(t.teams.length / t.maxTeams * 100) + '%"></i></div><div class="row wrap">' + (t.livestream ? '<span class="chip purple">' + ic('video', 11) + 'Có livestream</span>' : '') + '<span class="chip">' + ic('trophy', 11) + esc(t.prize) + '</span></div><button class="btn btn-primary btn-block" style="margin-top:auto" data-tour="' + t.id + '">Xem chi tiết</button></div></article>';
  }
  function pageTournaments() {
    setNav('giai-dau');
    var render = function () {
      var tours = HH.getTournaments(), cfg = HH.getConfig();
      var extras = cfg.services.filter(function (s) { return s.minHoursAhead || s.id === 'ball'; });
      $app.innerHTML = '<div class="page-enter container"><div class="page-head"><div><h1 class="page-title">Giải đấu &amp; Sự kiện</h1><div class="page-sub">Sân 7 có khán đài – nơi tổ chức giải đấu hằng quý (nội dung minh họa)</div></div></div>' +
        '<div class="live-panel"><div class="live-screen"><svg class="mock-field" viewBox="0 0 640 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5"><rect x="40" y="50" width="560" height="280" rx="4"/><line x1="320" y1="50" x2="320" y2="330"/><circle cx="320" cy="190" r="42"/><rect x="40" y="125" width="70" height="130"/><rect x="530" y="125" width="70" height="130"/></g><g stroke="#fff" stroke-width="1.5"><circle cx="150" cy="120" r="9" fill="#ef3b2d"/><circle cx="210" cy="200" r="9" fill="#ef3b2d"/><circle cx="270" cy="150" r="9" fill="#ef3b2d"/><circle cx="330" cy="240" r="9" fill="#ef3b2d"/><circle cx="90" cy="190" r="9" fill="#ef3b2d"/><circle cx="400" cy="130" r="9" fill="#2f8cff"/><circle cx="450" cy="210" r="9" fill="#2f8cff"/><circle cx="380" cy="190" r="9" fill="#2f8cff"/><circle cx="500" cy="160" r="9" fill="#2f8cff"/><circle cx="560" cy="190" r="9" fill="#2f8cff"/></g><circle cx="345" cy="205" r="6" fill="#fff"/></svg><span class="badge">● LIVE (MINH HỌA)</span><div class="sb"><span>ĐOÀN KẾT</span><span class="sc">2 - 1</span><span>PHỐ NÚI</span><span class="tm">54\'</span></div><span class="viewers">' + ic('eye', 13) + ' 1.248 đang xem</span><span class="cam">KHÁN ĐÀI</span><button class="play" id="live-play" aria-label="Xem livestream minh họa">' + ic('circle-play', 34) + '</button></div><div class="live-info"><span class="chip purple" style="align-self:flex-start">' + ic('video', 12) + 'Livestream &amp; bình luận</span><h2 style="font-size:22px">Xem trực tiếp trận đấu trên sân V2</h2><p style="margin:0;opacity:.85">Website chỉ nhúng liên kết phát (YouTube/Facebook) do đối tác quay dựng cung cấp. Đây là khung <b>minh họa</b>, không phát video thật.</p><div class="row wrap"><button class="btn btn-primary" id="live-play2">Xem demo giao diện</button><a class="btn btn-ghost" href="#/dat-san?type=7">Đặt sân 7 khán đài</a></div></div></div>' +
        '<section class="section"><div class="section-head"><h2>Giải đấu</h2></div><div class="tour-grid">' + tours.map(tourCard).join('') + '</div></section>' +
        '<section class="section"><div class="section-head"><h2>Dịch vụ bổ sung khi đặt sân</h2></div><div class="feature-grid">' + extras.map(function (s) { return '<div class="card feature"><span class="ic-wrap">' + ic(s.icon || 'tag', 22) + '</span><h4>' + esc(s.name) + '</h4><p>' + money(s.price) + '/' + esc(s.unit) + (s.minHoursAhead ? '<br>Đặt trước tối thiểu ' + s.minHoursAhead + ' giờ để đối tác sắp xếp nhân sự và thiết bị.' : '<br>Chọn ngay ở bước xác nhận đặt sân.') + '</p></div>'; }).join('') + '</div></section></div>';
    };
    render();
    on($app, 'click', '[data-tour]', function (e, b) { tourModal(b.dataset.tour); });
    on($app, 'click', '#live-play, #live-play2', function () {
      var ts = HH.getTournaments().filter(function (x) { return x.livestream; })[0] || HH.getTournaments()[0], tm = ts && ts.teams || [];
      var a = tm[0] ? tm[0].name : 'Đoàn Kết FC', b = tm[1] ? tm[1].name : 'Phố Núi FC', live = null;
      openModal({ title: 'Livestream 3D (mô phỏng) – ' + esc(ts ? ts.name : 'Huy Hoàng Cup'), size: 'wide', body: '<div id="live3d-host"></div>', foot: '<button class="btn btn-outline" data-close>Đóng</button>',
        onMount: function (el) { live = HH.live3D($('#live3d-host', el), { teamA: a, teamB: b }); }, onClose: function () { if (live) live.stop(); } });
    });
    page = { onData: render };
  }
  function tourModal(id) {
    var t = HH.getTournaments().filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var full = t.teams.length >= t.maxTeams, can = t.registrationOpen && !full, m = HH.getSession();
    openModal({ title: esc(t.name), size: 'wide', body: '<img class="tour-hero" src="' + t.image + '" alt="Cúp ' + esc(t.name) + '">' + '<div class="form-grid" style="grid-template-columns:1.1fr 1fr;align-items:start"><div><p style="margin-top:0">' + esc(t.desc) + '</p><div class="kv"><span>Thời gian</span><b>' + HH.fmtDate(t.startDate) + (t.endDate !== t.startDate ? ' – ' + HH.fmtDate(t.endDate) : '') + '</b></div><div class="kv"><span>Thể thức</span><b>' + esc(t.format) + '</b></div><div class="kv"><span>Địa điểm</span><b>' + esc(t.venue) + '</b></div><div class="kv"><span>Lệ phí</span><b>' + money(t.fee) + '/đội</b></div><div class="kv"><span>Giải thưởng</span><b>' + esc(t.prize) + '</b></div><div class="kv"><span>Số đội</span><b>' + t.teams.length + '/' + t.maxTeams + '</b></div>' +
      (can ? '<hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><b>Đăng ký đội (mô phỏng)</b><div class="form-grid mt8"><div class="field full"><label>Tên đội</label><input class="input" id="tr-name"></div><div class="field"><label>Số điện thoại</label><input class="input" id="tr-phone" value="' + esc(m ? m.phone : '') + '"></div><div class="field"><label>Số cầu thủ (5–15)</label><input class="input" type="number" id="tr-pl" min="5" max="15" value="8"></div></div><div id="tr-err" class="field-err mt8"></div><div class="notice mt8">' + ic('info', 16) + '<span>Lệ phí đóng bằng QR là mô phỏng, chưa có giao dịch thật.</span></div>' : '<div class="notice warn mt16">' + ic('circle-alert', 16) + '<span>' + (full ? 'Giải đã đủ số đội.' : 'Giải đã đóng đăng ký.') + '</span></div>') + '</div>' +
      '<div><b>Các đội đã đăng ký</b><ol style="padding-left:20px;margin:8px 0 0;max-height:300px;overflow:auto">' + t.teams.map(function (x) { return '<li style="padding:3px 0">' + esc(x.name) + ' <span class="muted">(' + x.players + ' cầu thủ)</span> ' + (x.paid ? '<span class="chip ok">Đã đóng lệ phí</span>' : '<span class="chip warn">Chờ đóng lệ phí</span>') + '</li>'; }).join('') + '</ol></div></div>',
      foot: '<button class="btn btn-outline" data-close>Đóng</button>' + (can ? '<button class="btn btn-primary" id="tr-ok">Đăng ký đội</button>' : ''), onMount: function (el, api) {
        var ok = $('#tr-ok', el); if (!ok) return;
        ok.onclick = function () { var r = HH.registerTeam(id, { name: $('#tr-name', el).value, phone: $('#tr-phone', el).value, players: $('#tr-pl', el).value }); if (!r.ok) { $('#tr-err', el).textContent = r.errors[0].message; return; } api.close(); toast('ok', 'Đăng ký thành công', ['Đội của bạn đã vào danh sách (chờ đóng lệ phí mô phỏng).']); };
      } });
  }

  /* ======================================================================
     THÀNH VIÊN
     ====================================================================== */
  function pageMember() {
    setNav('thanh-vien');
    var render = function () {
      var m = HH.getSession(), cfg = HH.getConfig();
      if (!m) {
        $app.innerHTML = '<div class="page-enter container"><div class="page-head"><div><h1 class="page-title">Thành viên</h1><div class="page-sub">Tích điểm, lên hạng và nhận ưu đãi</div></div></div><div class="card card-pad center" style="max-width:560px;margin:10px auto">' + empty('user-round', 'Bạn chưa đăng nhập', '<span>Đăng nhập mô phỏng bằng số điện thoại để xem lịch đặt sân, điểm thưởng và điểm uy tín.</span>', '<div class="row wrap" style="justify-content:center"><button class="btn btn-primary" data-auth="login">Đăng nhập</button><button class="btn btn-outline" data-auth="register">Đăng ký</button></div><button class="btn btn-soft mt16" id="demo-login">' + ic('sparkles', 16) + ' Dùng tài khoản demo</button>') + '</div>' +
          '<section class="section"><div class="section-head"><h2>Quyền lợi theo hạng</h2></div><div class="feature-grid">' + cfg.tiers.map(function (t) { return '<div class="tier-card"><b style="font-size:16px">' + esc(t.name) + '</b><div class="hint">Từ ' + t.minHours + ' giờ chơi / 90 ngày</div><p style="margin:8px 0 0">' + esc(t.perk) + '</p></div>'; }).join('') + '</div></section></div>';
        $('#demo-login').onclick = function () { HH.login(HH.DEMO_PHONE); renderHeader(); route(); };
        return;
      }
      var s = HH.memberStats(m.phone), next = s.nextTier, pctNext = next ? Math.min(100, Math.round(s.hours90 / next.minHours * 100)) : 100;
      var rep = s.reputation, promos = HH.getPromos().filter(function (p) { return p.active; });
      $app.innerHTML = '<div class="page-enter container"><div class="page-head"><div><h1 class="page-title">Thành viên</h1></div></div>' +
        '<div class="member-banner"><div class="avatar lg' + (m.phone === HH.DEMO_PHONE ? ' me' : '') + '">' + esc(initials(m.name)) + '</div><div class="grow"><small class="k">HUY HOÀNG MEMBERSHIP</small><h2>Chào mừng trở lại!</h2><div class="row wrap"><b style="font-size:18px">' + esc(m.name) + '</b><span class="chip" style="background:rgba(255,255,255,.18);color:#fff">' + ic('crown', 12) + 'Thành viên ' + esc(s.tier.name) + '</span></div></div><div style="min-width:260px;flex:1;max-width:340px"><div class="row" style="justify-content:space-between"><span>' + ic('shield-check', 16) + ' Điểm uy tín: <b>' + rep + '/100</b></span><span>' + (next ? s.hours90 + '/' + next.minHours + 'h lên hạng ' + esc(next.name) : 'Hạng cao nhất') + '</span></div><div class="rep-bar"><i style="width:' + rep + '%"></i></div><div class="rep-bar" style="height:6px;margin-top:8px"><i style="width:' + pctNext + '%;background:#ffd34d"></i></div></div></div>' +
        '<div class="tile-row"><div class="tile" data-go="orders"><span class="ic-wrap">' + ic('calendar-days', 22) + '</span><b>Lịch đặt sân</b><small>' + s.upcoming.length + ' đơn sắp tới</small></div><div class="tile" data-go="points"><span class="ic-wrap">' + ic('award', 22) + '</span><b>Điểm thưởng</b><small>' + s.points.toLocaleString('vi-VN') + ' điểm</small></div><div class="tile" data-go="fixed"><span class="ic-wrap">' + ic('repeat', 22) + '</span><b>Sân cố định</b><small>Đặt lặp hằng tuần</small></div><div class="tile" data-go="rep"><span class="ic-wrap">' + ic('shield-check', 22) + '</span><b>Điểm uy tín</b><small>Xem lịch sử</small></div></div>' +
        '<div class="book-layout mt24"><div><div class="card card-pad" id="m-orders"><div class="card-title">Lịch đặt sân sắp tới</div>' + (s.upcoming.length ? s.upcoming.map(miniOrder).join('') : empty('calendar', 'Chưa có lịch sắp tới', '', '<a class="btn btn-primary" href="#/dat-san">Đặt sân ngay</a>')) + '</div>' +
        '<div class="card card-pad mt16"><div class="card-title">Lịch sử đặt sân</div>' + (s.history.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Sân</th><th>Ngày giờ</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>' + s.history.slice(0, 12).map(function (b) { return '<tr><td><a class="order-code" href="#/don/' + b.id + '">' + b.id + '</a></td><td>' + b.courtId + '</td><td>' + HH.fmtDate(b.date) + ' · ' + HH.fmtRange(b.startHour, b.endHour) + '</td><td>' + money(b.totalAmount) + '</td><td>' + statusChip(b) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty('history', 'Chưa có lịch sử')) + '</div></div>' +
        '<aside class="side-stack"><div class="card side-card"><h3>Hạng thành viên</h3>' + cfg.tiers.map(function (t) { return '<div class="tier-card ' + (t.id === s.tier.id ? 'on' : '') + '" style="margin-bottom:8px"><b>' + esc(t.name) + '</b> <span class="hint">từ ' + t.minHours + 'h / 90 ngày</span><div style="font-size:12.5px;margin-top:4px">' + esc(t.perk) + '</div></div>'; }).join('') + '</div></aside></div>' +
        '<section class="section"><div class="section-head"><h2>Mã khuyến mãi &amp; ưu đãi</h2></div><div class="feature-grid">' + promos.map(voucherHtml).join('') + '<div class="voucher" style="border-color:#f5b301"><div class="left" style="background:linear-gradient(160deg,#c2410c,#f59e0b)">' + ic('zap', 30) + '</div><div class="right"><b>Flash sale giờ chót</b><p class="muted" style="margin:4px 0;font-size:12.5px">Tự động giảm đến ' + Math.max.apply(null, cfg.flash.tiers.map(function (t) { return t.percent; })) + '% khi còn trống sát giờ đá. Không cộng dồn mã khác.</p></div></div></div></section></div>';
      if ($app.__tileFn) $app.removeEventListener('click', $app.__tileFn); // tránh gắn trùng handler mỗi lần vẽ lại (gây mở 2 hộp thoại)
      $app.__tileFn = function (e) {
        var t = e.target.closest('.tile'); if (!t || !$app.contains(t)) return;
        var k = t.dataset.go;
        if (k === 'orders') $('#m-orders').scrollIntoView({ behavior: 'smooth', block: 'center' });
        else if (k === 'points') openModal({ title: 'Điểm thưởng', body: '<div class="center"><div class="price-big">' + s.points.toLocaleString('vi-VN') + ' điểm</div><p class="muted">Quy tắc mô phỏng: 1 điểm cho mỗi ' + money(cfg.pointsPerVnd) + ' của đơn đã xác nhận (đã cọc/thanh toán). Điểm có thể đổi giờ chơi, nước uống hoặc giảm giá — chức năng đổi điểm chỉ minh họa, chưa có hệ thống tích điểm thật.</p></div>', foot: '<button class="btn btn-primary" data-close>Đã hiểu</button>' });
        else if (k === 'fixed') fixedBookingModal(m);
        else openModal({ title: 'Điểm uy tín: ' + rep + '/100', size: 'wide', body: '<div class="rep-bar" style="background:#e3ebe5"><i style="width:' + rep + '%;background:var(--g600)"></i></div><p class="muted">' + (rep >= 80 ? 'Cọc thấp, được ưu tiên danh sách chờ và ghép kèo.' : rep >= 50 ? 'Cọc cao hơn bình thường (' + cfg.lowReputationDepositPercent + '%).' : 'Dưới 50: không thể mở/nhận kèo, cần thanh toán trước.') + ' Bạn có thể khiếu nại trong 48 giờ (mô phỏng).</p><ul class="timeline">' + m.reputationLog.slice().reverse().map(function (l) { return '<li><span class="delta ' + (l.delta > 0 ? 'pos' : (l.delta < 0 ? 'neg' : '')) + '">' + (l.delta > 0 ? '+' : '') + l.delta + '</span><span class="grow">' + esc(l.reason) + '</span><span class="hint">' + HH.fmtDate(l.date) + '</span></li>'; }).join('') + '</ul>', foot: '<button class="btn btn-primary" data-close>Đóng</button>' });
      };
      $app.addEventListener('click', $app.__tileFn);
    };
    on($app, 'click', '[data-auth]', function () { /* xử lý ở bộ lắng nghe chung */ });
    render();
    page = { onData: render };
  }
  /* ======================================================================
     ĐẶT SÂN CỐ ĐỊNH HẰNG TUẦN (tab Thành viên)
     Chọn sân + khung giờ + số tuần -> xem trước từng tuần (trống / trùng / quá hạn) -> tạo một loạt đơn,
     mỗi đơn kiểm tra trùng lịch và quy tắc sân 5 <-> sân 7 như đặt thường (HH.createBooking).
     ====================================================================== */
  function fixedBookingModal(m) {
    var today = HH.todayStr(), cfg = HH.getConfig();
    var st = { type: '5', courtId: 'A1', date: HH.addDays(today, 1), start: 19, hours: 1, weeks: 4, skip: true };
    function courtsOf(type) { return HH.getCourts().filter(function (c) { return String(c.type) === type && c.active !== false; }); }
    function hourOpts(from, to, sel, suffix) { var o = ''; for (var h = from; h <= to; h++) o += '<option value="' + h + '"' + (h === sel ? ' selected' : '') + '>' + (suffix ? h + ' giờ' : HH.fmtHour(h)) + '</option>'; return o; }
    function plan() {
      var court = HH.getCourt(st.courtId), end = st.start + st.hours, rows = [], now = HH.now();
      for (var n = 0; n < st.weeks; n++) {
        var d = HH.addDays(st.date, 7 * n);
        var v = HH.validateSlot({ courtId: st.courtId, date: d, startHour: st.start, endHour: end }, { now: now, cfg: cfg, maxAdvanceDays: HH.RECURRING_MAX_DAYS });
        var price = v.ok ? HH.priceBreakdown(court, d, st.start, end, cfg, now).total : 0;
        rows.push({ n: n + 1, date: d, ok: v.ok, msg: v.ok ? '' : v.errors[0].message, price: price });
      }
      return { rows: rows, end: end, court: court };
    }
    function money1(n) { return money(n); }
    function bodyHtml() {
      var cs = courtsOf(st.type);
      if (!cs.some(function (c) { return c.id === st.courtId; })) st.courtId = cs.length ? cs[0].id : '';
      return '<p style="margin-top:0">Giữ một khung giờ cố định mỗi tuần (VD: tối thứ 6 hằng tuần). Hệ thống kiểm tra từng tuần, tuần nào đã có người đặt sẽ được báo rõ.</p>' +
        '<div class="form-grid" style="grid-template-columns:repeat(2,1fr)">' +
        '<div class="field"><label>Loại sân</label><select class="select" id="fx-type"><option value="5"' + (st.type === '5' ? ' selected' : '') + '>Sân 5 người</option><option value="7"' + (st.type === '7' ? ' selected' : '') + '>Sân 7 người</option></select></div>' +
        '<div class="field"><label>Sân</label><select class="select" id="fx-court">' + cs.map(function (c) { return '<option value="' + c.id + '"' + (c.id === st.courtId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Buổi đầu tiên</label><input type="date" class="input" id="fx-date" value="' + st.date + '" min="' + today + '"><div class="hint" id="fx-dow"></div></div>' +
        '<div class="field"><label>Lặp lại</label><select class="select" id="fx-weeks">' + [4, 8, 12].map(function (w) { return '<option value="' + w + '"' + (w === st.weeks ? ' selected' : '') + '>' + w + ' tuần</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Giờ bắt đầu</label><select class="select" id="fx-start">' + hourOpts(0, 23, st.start) + '</select></div>' +
        '<div class="field"><label>Số giờ mỗi buổi</label><select class="select" id="fx-hours">' + hourOpts(1, Math.min(4, cfg.maxHoursPerBooking || 4), st.hours, true) + '</select></div></div>' +
        '<label class="check" style="margin:6px 0 10px"><input type="checkbox" id="fx-skip"' + (st.skip ? ' checked' : '') + '>Bỏ qua tuần bị trùng lịch, vẫn đặt các tuần còn lại</label>' +
        '<div id="fx-preview"></div>';
    }
    function previewHtml() {
      var p = plan(), okRows = p.rows.filter(function (r) { return r.ok; }), total = okRows.reduce(function (a, r) { return a + r.price; }, 0);
      var pct = HH.depositPercentFor(m.phone, cfg), dep = Math.round(total * pct / 100 / 1000) * 1000;
      return '<div class="table-wrap"><table class="tbl"><thead><tr><th>Tuần</th><th>Ngày</th><th>Giờ</th><th>Tình trạng</th><th style="text-align:right">Tiền sân</th></tr></thead><tbody>' +
        p.rows.map(function (r) { return '<tr><td>' + r.n + '</td><td>' + HH.fmtDateLong(r.date) + '</td><td>' + HH.fmtRange(st.start, p.end) + '</td><td>' + (r.ok ? '<span class="chip ok">Còn trống</span>' : '<span class="chip bad" title="' + esc(r.msg) + '">Không đặt được</span><div class="hint" style="max-width:260px">' + esc(r.msg) + '</div>') + '</td><td style="text-align:right">' + (r.ok ? money1(r.price) : '—') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<div class="row wrap mt8" style="justify-content:space-between"><span><b>' + okRows.length + '/' + p.rows.length + '</b> tuần đặt được</span><span>Tổng tiền sân: <b>' + money1(total) + '</b> · Cọc dự kiến (' + pct + '%): <b>' + money1(dep) + '</b></span></div>';
    }
    openModal({ title: 'Đặt sân cố định hằng tuần', size: 'wide', body: bodyHtml(),
      foot: '<button class="btn btn-outline" data-close>Đóng</button><button class="btn btn-primary" id="fx-ok">' + ic('repeat', 16) + ' Đặt cố định</button>',
      onMount: function (el, api) {
        var $e = function (sel) { return $(sel, el); };
        function redraw(full) {
          if (full) $e('.modal-body').innerHTML = bodyHtml();
          $e('#fx-dow').textContent = HH.isValidDateStr(st.date) ? 'Lặp vào ' + HH.weekdayName(st.date) + ' hằng tuần' : '';
          $e('#fx-preview').innerHTML = previewHtml();
        }
        redraw(false);
        on(el, 'change', '#fx-type', function (e, t) { st.type = t.value; redraw(true); });
        on(el, 'change', '#fx-court', function (e, t) { st.courtId = t.value; redraw(false); });
        on(el, 'change', '#fx-date', function (e, t) { if (!HH.isValidDateStr(t.value) || t.value < today) { toast('bad', 'Ngày không hợp lệ', ['Vui lòng chọn ngày từ hôm nay trở đi.']); t.value = st.date; return; } st.date = t.value; redraw(false); });
        on(el, 'change', '#fx-weeks', function (e, t) { st.weeks = +t.value; redraw(false); });
        on(el, 'change', '#fx-start', function (e, t) { st.start = +t.value; redraw(false); });
        on(el, 'change', '#fx-hours', function (e, t) { st.hours = +t.value; redraw(false); });
        on(el, 'change', '#fx-skip', function (e, t) { st.skip = t.checked; });
        $e('#fx-ok').onclick = function () {
          var p = plan(), okRows = p.rows.filter(function (r) { return r.ok; });
          if (!okRows.length) { toast('bad', 'Không có tuần nào đặt được', ['Hãy chọn sân hoặc khung giờ khác.']); return; }
          if (!st.skip && okRows.length < p.rows.length) { toast('warn', 'Có tuần bị trùng lịch', ['Bật "Bỏ qua tuần bị trùng" hoặc đổi khung giờ/sân.']); return; }
          var gid = 'FIX' + Date.now().toString(36).toUpperCase(), made = [], failed = [];
          okRows.forEach(function (r, i) {
            var res = HH.createBooking({ courtId: st.courtId, date: r.date, startHour: st.start, endHour: p.end, customerName: m.name, phone: m.phone,
              note: 'Đặt cố định hằng tuần (buổi ' + r.n + '/' + st.weeks + ')', recurring: { group: gid, index: r.n, total: st.weeks } }, { actor: 'Khách hàng' });
            if (res.ok) made.push(res.booking); else failed.push({ r: r, msg: res.errors[0].message });
          });
          if (!made.length) { toast('bad', 'Không thể đặt sân cố định', failed.slice(0, 3).map(function (f) { return f.msg; })); return; }
          toast('ok', 'Đã đặt cố định ' + made.length + ' buổi', ['Sân ' + st.courtId + ' · ' + HH.weekdayName(st.date) + ' · ' + HH.fmtRange(st.start, p.end)]);
          var totalDep = made.reduce(function (a, b) { return a + b.depositAmount; }, 0), total = made.reduce(function (a, b) { return a + b.totalAmount; }, 0);
          function resultHtml() {
            var cur = made.map(function (b) { return HH.getBooking(b.id) || b; }), unpaid = cur.filter(function (b) { return b.paymentStatus === 'unpaid' && b.status !== 'cancelled'; });
            return '<div class="notice ok">' + ic('circle-check', 16) + '<span>Đã tạo <b>' + made.length + '</b> đơn cho ' + esc(HH.getCourt(st.courtId).name) + ' (' + HH.weekdayName(st.date) + ' hằng tuần, ' + HH.fmtRange(st.start, p.end) + ').' + (failed.length ? ' ' + failed.length + ' tuần bị bỏ qua do trùng lịch.' : '') + '</span></div>' +
              '<div class="table-wrap mt8"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Ngày</th><th>Trạng thái</th><th style="text-align:right">Tiền sân</th></tr></thead><tbody>' + cur.map(function (b) { return '<tr><td><a class="order-code" href="#/don/' + b.id + '" data-close>' + b.id + '</a></td><td>' + HH.fmtDate(b.date) + '</td><td>' + statusChip(b) + '</td><td style="text-align:right">' + money(b.totalAmount) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
              '<div class="row wrap mt8" style="justify-content:space-between"><span>Tổng: <b>' + money(total) + '</b></span><span>Tổng cọc: <b>' + money(totalDep) + '</b>' + (unpaid.length ? '' : ' · <span class="chip ok">Đã cọc tất cả</span>') + '</span></div>' +
              (unpaid.length ? '<p class="hint mt8">Mỗi buổi có thể thanh toán cọc riêng trong trang đơn, hoặc bấm “Cọc tất cả” để ghi nhận cọc cho cả loạt (mô phỏng, không trừ tiền thật).</p>' : '');
          }
          $e('.modal-title, .modal-head h3').textContent = 'Đã đặt sân cố định';
          $e('.modal-body').innerHTML = resultHtml();
          $e('.modal-foot').innerHTML = '<button class="btn btn-outline" data-close>Đóng</button><button class="btn btn-soft" id="fx-pay">' + ic('wallet', 16) + ' Cọc tất cả (mô phỏng)</button><a class="btn btn-primary" href="#/thanh-vien" data-close>Xem lịch đặt sân</a>';
          $e('#fx-pay').onclick = function () {
            var n = 0; made.forEach(function (b) { var r = HH.markPayment(b.id, 'deposit', 'Khách hàng'); if (r.ok) n++; });
            toast(n ? 'ok' : 'warn', n ? 'Đã ghi nhận cọc ' + n + ' đơn (mô phỏng)' : 'Các đơn đã được cọc trước đó', []);
            $e('.modal-body').innerHTML = resultHtml(); $e('#fx-pay').remove();
          };
        };
      } });
  }

  /* Logo đội tròn: có img/tim-doi/doi/<slug>.jpg thì dùng, không thì hiện chữ viết tắt trên nền xanh */
  function teamLogoHtml(name) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cdc2e"/><stop offset="1" stop-color="#14702f"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="#04210f">' + esc(initials(name)) + '</text></svg>';
    return '<img class="team-logo" src="' + HH.teamImg(name, 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)) + '" alt="' + esc(name) + '">';
  }
  function miniOrder(b) {
    var c = HH.getCourt(b.courtId);
    return '<a class="mini-order" href="#/don/' + b.id + '"><img src="' + c.image + '" alt=""><div class="grow"><b>' + esc(c.name) + ' · ' + HH.fmtRange(b.startHour, b.endHour) + '</b><div class="hint">' + HH.fmtDateLong(b.date) + '</div></div><div style="text-align:right">' + statusChip(b) + '<div style="font-weight:800;margin-top:4px">' + money(b.totalAmount) + '</div></div></a>';
  }

  /* ======================================================================
     TRANG GIỚI THIỆU SÂN BÓNG (ảnh sân 5, sân 7 và tiện ích lấy từ thư mục img/)
     ====================================================================== */
  function pageAbout() {
    setNav('gioi-thieu');
    var cfg = HH.getConfig(), c = cfg.contact, courts = HH.getCourts();
    var c5 = courts.filter(function (x) { return x.type === 5; }), c7 = courts.filter(function (x) { return x.type === 7; });
    function fig(src, cap, big) { return '<figure class="about-fig' + (big ? ' big' : '') + '"><img src="' + src + '" alt="' + esc(cap) + '" loading="lazy"><figcaption>' + esc(cap) + '</figcaption></figure>'; }
    var amen = [
      ['img/tien-ich/may-ban-nuoc.jpg', 'Máy bán nước tự động', 'Nước suối, nước ngọt, nước yến sáo lạnh bán tự động 24/24 ngay cạnh sân.'],
      ['img/tien-ich/phong-tam.jpg', 'Phòng tắm sạch sẽ', 'Phòng tắm vách ngăn riêng, có nước nóng, rèm che và sàn chống trơn.'],
      ['img/tien-ich/tu-do-1.jpg', 'Tủ đồ cá nhân', 'Tủ khóa riêng cho từng người, có móc treo áo đấu và ngăn để giày.'],
      ['img/tien-ich/tu-do-2.jpg', 'Phòng thay đồ', 'Ghế ngồi êm, ngăn kéo đựng giày dưới ghế, thay đồ thoải mái trước và sau trận.']
    ];
    $app.innerHTML = '<div class="page-enter container"><div class="page-head"><div><h1 class="page-title">Giới thiệu sân bóng HUY HOÀNG</h1><div class="page-sub">Cụm ' + c5.length + ' sân 5 người và ' + c7.length + ' sân 7 người – ' + esc(c.hours) + '</div></div><a class="btn btn-primary" href="#/dat-san">Đặt sân ngay ' + ic('arrow-right', 16) + '</a></div>' +
      '<section class="section"><div class="section-head"><h2>Sân 5 người</h2><span class="muted">' + c5.length + ' sân · ' + HH.fmtK(Math.min.apply(null, c5.map(courtMinPrice))) + ' - ' + HH.fmtK(Math.max.apply(null, c5.map(function (x) { return Math.max(x.priceOff, x.pricePeak); }))) + '/giờ</span></div>' +
      '<p class="muted" style="margin:0 0 14px">Có cả sân ngoài trời và sân trong nhà, cỏ nhân tạo thế hệ mới, đèn LED chiếu sáng ban đêm, lưới bao quanh an toàn.</p>' +
      '<div class="about-grid">' + [1, 2, 3, 4, 5, 6].map(function (i) { return fig('img/san-thuc-te/luoi/luoi-' + i + '.jpg', i === 2 ? 'Sân 5 trong nhà' : 'Sân 5 ngoài trời', i === 1); }).join('') + '</div></section>' +
      '<section class="section"><div class="section-head"><h2>Sân 7 người</h2><span class="muted">' + c7.length + ' sân · ghép từ 3 sân 5</span></div>' +
      '<p class="muted" style="margin:0 0 14px">Sân rộng đạt chuẩn thi đấu 7 người, có vạch chia thành 3 sân 5 để linh hoạt đặt theo nhu cầu, phù hợp tổ chức giải và giao hữu.</p>' +
      '<div class="about-grid three">' + [1, 2, 3].map(function (i) { return fig('img/san-thuc-te/san-7/san7-' + i + '.jpg', 'Sân 7 người V' + i); }).join('') + '</div></section>' +
      '<section class="section"><div class="section-head"><h2>Tiện ích sân bóng</h2></div>' +
      '<div class="card card-pad" style="margin-bottom:14px"><div class="amen-icons">' + ['led', 'wc', 'locker', 'water', 'shower', 'ball', 'bib', 'parking'].map(function (a) { var m = HH.AMENITIES[a]; return '<div><span class="ic-wrap">' + ic(m.icon, 22) + '</span>' + m.label + '</div>'; }).join('') + '</div></div>' +
      '<div class="about-grid four">' + amen.map(function (a) { return '<figure class="about-fig tall"><img src="' + a[0] + '" alt="' + esc(a[1]) + '" loading="lazy"><figcaption><b>' + esc(a[1]) + '</b><span>' + esc(a[2]) + '</span></figcaption></figure>'; }).join('') + '</div></section>' +
      '<section class="section"><div class="card card-pad row wrap" style="gap:20px"><span class="ic-wrap" style="width:54px;height:54px">' + ic('map-pin', 26) + '</span><div class="grow"><h3 style="font-size:18px">Địa chỉ &amp; liên hệ</h3><p class="muted" style="margin:4px 0 0">' + esc(c.address) + ' · Hotline/Zalo ' + esc(c.phone) + ' · ' + esc(c.hours) + '</p></div><a class="btn btn-dark" href="#/dat-san">Đặt sân ngay</a></div></section></div>';
    page = null;
  }

  /* ======================================================================
     ĐỊNH TUYẾN
     ====================================================================== */
  function route() {
    cleanup();
    // Thay khung nội dung bằng bản sao rỗng để gỡ các bộ lắng nghe sự kiện của trang trước (tránh bấm 1 lần chạy 2 lần)
    var fresh = $app.cloneNode(false); $app.parentNode.replaceChild(fresh, $app); $app = fresh;
    var h = location.hash.replace(/^#/, '') || '/';
    var parts = h.split('?'), segs = parts[0].split('/').filter(Boolean), q = parseQuery(parts[1]);
    window.scrollTo(0, 0);
    renderHeader();
    try {
      switch (segs[0]) {
        case undefined: pageHome(); break;
        case 'dat-san': pageBook(q); break;
        case 'san': pageCourt(decodeURIComponent(segs[1] || ''), q); break;
        case 'dat': pageCheckout(decodeURIComponent(segs[1] || ''), q); break;
        case 'doi-thanh-toan': pageSeekPay(decodeURIComponent(segs[1] || '').toUpperCase()); break;
        case 'don': pageOrder(decodeURIComponent(segs[1] || '').toUpperCase()); break;
        case 'gioi-thieu': pageAbout(); break;
        case 'tim-doi': pageSeek(); break;
        case 'giai-dau': pageTournaments(); break;
        case 'thanh-vien': pageMember(); break;
        default: setNav(''); $app.innerHTML = '<div class="container mt24 card">' + empty('search', 'Không tìm thấy trang', '', '<a class="btn btn-primary" href="#/">Về trang chủ</a>') + '</div>';
      }
    } catch (err) {
      console.error(err);
      $app.innerHTML = '<div class="container mt24 card">' + empty('triangle-alert', 'Đã xảy ra lỗi hiển thị', '<span>' + esc(err.message) + '</span>', '<a class="btn btn-primary" href="#/">Về trang chủ</a>') + '</div>';
    }
  }
  window.addEventListener('hashchange', route);

  // Đồng bộ: dữ liệu đổi (do tab này hoặc tab Admin) -> trang hiện tại tự cập nhật
  HH.onChange(HH.debounce(function (d) {
    if (d && d.key === HH.KEYS.session) renderHeader();
    if (page && page.onData) { try { page.onData(); } catch (e) { console.error(e); } }
  }, 80));

  /* ======================================================================
     HIỆU ỨNG HOVER 3D: rê chuột vào ô giờ còn trống -> cầu thủ sút bóng vào góc cao, thủ môn bay người không kịp.
     (Thuần CSS 3D + 1 phần tử nổi dùng chung; tự tắt trên màn hình cảm ứng / khi bật "giảm chuyển động".)
     ====================================================================== */
  (function kickFx() {
    if (window.matchMedia && (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var person = function (shirt, hair) { return '<svg viewBox="0 0 30 46" width="30" height="46"><ellipse cx="15" cy="44" rx="9" ry="2" fill="rgba(0,0,0,.3)"/><g><rect x="8" y="26" width="5" height="16" rx="2" fill="#f1c9a0"/><rect x="8" y="39" width="6" height="4" rx="1.5" fill="#111"/></g><g class="ks-leg"><rect x="15" y="26" width="5.5" height="16" rx="2.5" fill="#f1c9a0"/><rect x="15" y="39" width="7" height="4.5" rx="2" fill="#111"/></g><rect x="7" y="12" width="16" height="17" rx="5" fill="' + shirt + '"/><rect x="9" y="26" width="12" height="6" rx="2" fill="#1b2a6b"/><circle cx="15" cy="8" r="6" fill="#f1c9a0"/><path d="M9 7c0-5 12-6 12 0-3-2-9-2-12 0z" fill="' + hair + '"/><rect x="2" y="14" width="5" height="11" rx="2.5" fill="' + shirt + '"/><rect x="23" y="14" width="5" height="11" rx="2.5" fill="' + shirt + '"/></svg>'; };
    var keeper = '<svg viewBox="0 0 26 36" width="26" height="36"><rect x="7" y="17" width="5" height="17" rx="2" fill="#222"/><rect x="14" y="17" width="5" height="17" rx="2" fill="#222"/><rect x="5" y="8" width="16" height="13" rx="4" fill="#ffd400"/><circle cx="13" cy="5" r="5" fill="#f1c9a0"/><path d="M8 4c0-5 10-5 10 0-3-2-7-2-10 0z" fill="#3a2a1a"/><rect x="0" y="9" width="6" height="11" rx="3" fill="#ffd400"/><rect x="20" y="9" width="6" height="11" rx="3" fill="#ffd400"/><circle cx="3" cy="21" r="3" fill="#39ff14"/><circle cx="23" cy="21" r="3" fill="#39ff14"/></svg>';
    var el = document.createElement('div'); el.className = 'ks'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="ks-box"><div class="ks-pitch"></div><div class="ks-goal"></div><div class="ks-keeper">' + keeper + '</div><div class="ks-shadow"></div><div class="ks-ball"></div><div class="ks-player">' + person('#e5362b', '#1a1a1a') + '</div><div class="ks-goaltxt">GOOOL!</div><div class="ks-tag">Đặt sân – sút là vào!</div></div>';
    document.body.appendChild(el);
    var cur = null, timer = null;
    function show(t) {
      var r = t.getBoundingClientRect(), w = 250, h = 164, x = r.left + r.width / 2 - w / 2, y = r.top - h - 10;
      if (y < 8) y = r.bottom + 10;
      x = Math.max(8, Math.min(innerWidth - w - 8, x)); el.style.left = x + 'px'; el.style.top = y + 'px';
      el.classList.remove('on'); void el.offsetWidth; // khởi động lại animation mỗi lần rê vào
      el.querySelectorAll('.ks-box *').forEach(function (n) { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
      el.classList.add('on');
    }
    function hide() { clearTimeout(timer); cur = null; el.classList.remove('on'); }
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest('.slot.free, .tchip.free') : null;
      if (t === cur) return;
      hide(); if (!t) return; cur = t; timer = setTimeout(function () { if (cur === t) show(t); }, 140);
    });
    document.addEventListener('mousedown', hide); window.addEventListener('scroll', hide, true); window.addEventListener('hashchange', hide);
  })();

  /* ======================================================================
     HIỆU ỨNG 3D QUAY QUANH SÂN: rê chuột vào tên sân (lưới đặt sân) hoặc ảnh thẻ sân -> mô hình sân 3D xoay vòng
     (khung thành, cột đèn, vạch chia sân 7 = 3 sân 5). Thẻ sân còn nghiêng 3D theo con trỏ.
     ====================================================================== */
  (function court3dFx() {
    if (window.matchMedia && (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    // nghiêng thẻ sân theo con trỏ
    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest ? e.target.closest('.court-card') : null;
      if (!card) return; var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      card.classList.add('tilt'); card.style.transform = 'perspective(800px) rotateY(' + (px * 12).toFixed(2) + 'deg) rotateX(' + (-py * 10).toFixed(2) + 'deg) translateY(-4px)';
    });
    document.addEventListener('mouseout', function (e) { var card = e.target.closest ? e.target.closest('.court-card') : null; if (card && !card.contains(e.relatedTarget)) { card.classList.remove('tilt'); card.style.transform = ''; } });
  })();

  renderFooter();
  route();
})();
