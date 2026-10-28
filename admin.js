/* ==========================================================================
   HUY HOÀNG Football Booking — admin.js
   Giao diện QUẢN TRỊ (admin.html). Dùng chung dữ liệu localStorage và hàm nghiệp vụ HH.* (script.js)
   với trang khách hàng, nên mọi thao tác ở đây hiện ngay bên trang User (và ngược lại).
   Trang: #/tong-quan  #/lich-san  #/don-dat-san  #/thanh-toan  #/quan-ly-san  #/tim-doi  #/khuyen-mai  #/khach-hang  #/cai-dat
   ========================================================================== */
(function () {
  'use strict';
  var HH = window.HH, ic = HH.icon, esc = HH.esc, money = HH.fmtMoney;
  HH.init();
  var $view = document.getElementById('view');
  var page = null;

  /* ---------------- Tiện ích giao diện ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function on(root, ev, sel, fn) { root.addEventListener(ev, function (e) { var t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); }); }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function toast(type, title, msgs) {
    var el = document.createElement('div'); el.className = 'toast ' + type;
    var icon = type === 'ok' ? 'circle-check' : (type === 'bad' ? 'circle-x' : (type === 'warn' ? 'triangle-alert' : 'info'));
    el.innerHTML = ic(icon, 20) + '<div><b>' + esc(title) + '</b>' + (msgs && msgs.length ? '<ul>' + msgs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    document.getElementById('toasts').appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(function () { el.remove(); }, 300); }, type === 'bad' ? 7000 : 4000);
  }
  function toastErr(r, t) { toast('bad', t || 'Không thực hiện được', (r.errors || []).map(function (e) { return e.message; })); }
  var modals = [];
  function openModal(o) {
    var ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true"><div class="modal-head"><h3>' + o.title + '</h3><button class="icon-btn" style="color:#111" data-close aria-label="Đóng">' + ic('x', 20) + '</button></div><div class="modal-body">' + o.body + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</div>';
    document.getElementById('modal-root').appendChild(ov);
    var api = { el: ov, close: function () { ov.remove(); modals = modals.filter(function (m) { return m !== api; }); if (o.onClose) o.onClose(); } };
    modals.push(api);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) api.close(); });
    on(ov, 'click', '[data-close]', function () { api.close(); });
    if (o.onMount) o.onMount(ov, api);
    return api;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modals.length) modals[modals.length - 1].close(); });
  function confirmBox(title, msg, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false;
      openModal({ title: title, size: 'sm', body: '<div>' + msg + '</div>', foot: '<button class="btn btn-outline" data-close>Quay lại</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" id="cf-ok">' + esc(okLabel || 'Đồng ý') + '</button>',
        onMount: function (el, api) { $('#cf-ok', el).onclick = function () { done = true; api.close(); resolve(true); }; }, onClose: function () { if (!done) resolve(false); } });
    });
  }
  function empty(icon, title, msg) { return '<div class="empty">' + ic(icon, 44) + '<b>' + title + '</b>' + (msg || '') + '</div>'; }
  function statusChip(b) { var s = HH.STATUS[b.status]; return '<span class="chip ' + s.cls + '">' + s.label + '</span>'; }
  function payChip(b) { var p = HH.PAYMENT[b.paymentStatus]; return '<span class="chip ' + p.cls + '">' + p.short + '</span>'; }
  function levelBadge(id) { var l = HH.levelOf(id); return '<span class="lvl" style="background:' + l.color + '">' + esc(l.label) + '</span>'; }
  function parseQuery(s) { var q = {}; (s || '').split('&').forEach(function (p) { if (!p) return; var kv = p.split('='); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }); return q; }
  function fmtM(n) { return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'tr' : (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)); }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function pagerHtml(page, pages) {
    if (pages <= 1) return '';
    var out = '<div class="pager"><button data-p="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>‹</button>', gap = false;
    for (var i = 1; i <= pages; i++) {
      if (pages > 9 && i > 2 && i < pages - 1 && Math.abs(i - page) > 1) { if (!gap) { out += '<button disabled>…</button>'; gap = true; } continue; }
      gap = false; out += '<button data-p="' + i + '" class="' + (i === page ? 'on' : '') + '">' + i + '</button>';
    }
    return out + '<button data-p="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + '>›</button></div>';
  }
  function sortedByCreated() { return HH.getBookings().slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }); }

  /* ---------------- Khung: sidebar, topbar ---------------- */
  var NAV = [
    ['tong-quan', 'Tổng quan', 'layout-dashboard'], ['lich-san', 'Lịch sân', 'calendar-days'], ['don-dat-san', 'Đơn đặt sân', 'clipboard-list'],
    ['thanh-toan', 'Thanh toán', 'wallet'], ['quan-ly-san', 'Quản lý sân', 'grid-3x3'], ['tim-doi', 'Tìm đối', 'swords'],
    ['khuyen-mai', 'Khuyến mãi & Giải đấu', 'ticket'], ['khach-hang', 'Khách hàng', 'users'], ['cai-dat', 'Cài đặt', 'settings']
  ];
  var TITLES = {}; NAV.forEach(function (n) { TITLES[n[0]] = n[1]; });
  function renderChrome(key) {
    var pending = HH.getBookings().filter(function (b) { return b.status === 'pending'; }).length;
    $('#side-nav').innerHTML = NAV.map(function (n) { return '<a href="#/' + n[0] + '" class="' + (n[0] === key ? 'active' : '') + '">' + ic(n[2], 18) + n[1] + (n[0] === 'don-dat-san' && pending ? '<span class="badge">' + pending + '</span>' : '') + '</a>'; }).join('');
    $('#top-title').textContent = TITLES[key] || 'Quản trị';
    $('#top-date').textContent = HH.fmtDateLong(HH.todayStr());
    $('#bell').innerHTML = ic('bell', 20) + (pending ? '<span class="dot">' + pending + '</span>' : '');
    $('#side-toggle').innerHTML = ic('menu', 22);
    $('#sidebar').classList.remove('open');
  }
  $('#side-toggle').onclick = function () { $('#sidebar').classList.toggle('open'); };
  $('#bell').onclick = function () { go('#/don-dat-san?status=pending'); };

  /* ======================================================================
     TỔNG QUAN
     ====================================================================== */
  var dash = { period: 'all', hour: null };
  function barChart(vals, labels, o) {
    o = o || {}; var W = 560, H = 190, pl = 40, pb = 24, pt = 10, n = vals.length, max = Math.max.apply(null, vals.concat([1]));
    var step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / step) * step; if (top / step < 2) top = step * 2;
    var bw = (W - pl) / n, g = '';
    for (var i = 0; i <= 4; i++) { var y = pt + (H - pb - pt) * (1 - i / 4); g += '<line class="grid" x1="' + pl + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text x="' + (pl - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + (o.fmt ? o.fmt(top * i / 4) : Math.round(top * i / 4)) + '</text>'; }
    vals.forEach(function (v, i) {
      var h = (H - pb - pt) * v / top, x = pl + i * bw + bw * .16, y = H - pb - h;
      g += '<rect class="bar ' + (o.alt && o.alt[i] ? 'alt' : '') + '" x="' + x + '" y="' + y + '" width="' + bw * .68 + '" height="' + Math.max(h, v ? 1 : 0) + '" rx="3"><title>' + esc(labels[i]) + ': ' + (o.tip ? o.tip(v) : v) + '</title></rect>';
      if (n <= 14 || i % 2 === 0) g += '<text x="' + (x + bw * .34) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(labels[i]) + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Biểu đồ') + '">' + g + '</svg>';
  }
  function donut(parts, total, centerTop, centerSub) {
    var R = 54, C = 2 * Math.PI * R, off = 0, segs = '';
    parts.forEach(function (p) { if (!p.v) return; var len = C * p.v / total; segs += '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + p.c + '" stroke-width="20" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 70 70)"><title>' + esc(p.l) + ': ' + p.v + '</title></circle>'; off += len; });
    return '<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Biểu đồ tình trạng sân"><circle r="' + R + '" cx="70" cy="70" fill="none" stroke="#eef3ef" stroke-width="20"/>' + segs + '<text x="70" y="68" text-anchor="middle" style="font:800 24px Inter,sans-serif;fill:#0e1f15">' + centerTop + '</text><text x="70" y="86" text-anchor="middle" style="font:500 10px Inter,sans-serif;fill:#6b7c72">' + centerSub + '</text></svg>';
  }

  function pageDashboard() {
    var now = HH.now(), today = HH.todayStr(now);
    if (dash.hour == null) dash.hour = Math.max(HH.OPEN_HOUR, Math.min(HH.CLOSE_HOUR - 1, now.getHours() + 1));
    var render = function () {
      var range = HH.periodRange(dash.period, now), s = HH.computeStats(range, now), cfg = HH.getConfig(), courts = HH.getCourts();
      // doanh thu theo ngày
      var days = [];
      if (dash.period === 'all') { for (var i = -6; i <= 6; i++) days.push(HH.addDays(today, i)); } else { for (var d = range.from; d <= range.to; d = HH.addDays(d, 1)) days.push(d); }
      var revVals = days.map(function (d) { return s.dayRevenue[d] || 0; });
      var hrs = [], hv = []; for (var h = HH.OPEN_HOUR; h < HH.CLOSE_HOUR; h++) { hrs.push(String(h)); hv.push(s.hourCounts[h] || 0); }
      var topH = hrs.map(function (x, i) { return [x, hv[i]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3).filter(function (x) { return x[1] > 0; });
      var st = HH.courtStatusAt(today, dash.hour, now);
      var parts = [{ l: 'Đã đặt', v: st.booked, c: '#ef4444' }, { l: 'Giữ chỗ / chờ xác nhận', v: st.holding, c: '#f5b301' }, { l: 'Đang tìm đối', v: st.seeking, c: '#8b5cf6' }, { l: 'Còn trống', v: st.free, c: '#22c55e' }, { l: 'Không khả dụng (khóa do ghép sân / bảo trì)', v: st.blocked + st.maintenance, c: '#9ca3af' }];
      var recent = sortedByCreated().slice(0, 7);
      var fillPct = Math.round(s.fillRate * 100), goldPct = Math.round(s.fillGolden * 100);
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><span class="grow"></span><div class="field" style="flex-direction:row;align-items:center;gap:8px"><label>Thống kê theo ngày đá:</label><select class="select" id="d-period" style="width:auto">' + [['all', 'Tất cả đơn'], ['today', 'Hôm nay'], ['next7', '7 ngày tới'], ['past7', '7 ngày qua']].map(function (p) { return '<option value="' + p[0] + '" ' + (dash.period === p[0] ? 'selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="kpis">' +
        kpi('wallet', 'Doanh thu mô phỏng', money(s.revenue), 'tổng tiền các đơn đã xác nhận') +
        kpi('clipboard-list', 'Tổng đơn đặt sân', s.total, range.label, '#/don-dat-san') +
        kpi('hourglass', 'Đơn chờ xác nhận', s.pending, 'cần nhân viên xử lý', '#/don-dat-san?status=pending') +
        kpi('circle-check', 'Đơn đã xác nhận', s.confirmed, 'đang chiếm lịch sân', '#/don-dat-san?status=confirmed') +
        kpi('circle-x', 'Đơn đã hủy', s.cancelled, 'đã nhả lịch', '#/don-dat-san?status=cancelled') +
        kpi('grid-3x3', 'Tổng số sân', courts.length, courts.filter(function (c) { return c.type === 5; }).length + ' sân 5 + ' + courts.filter(function (c) { return c.type === 7; }).length + ' sân 7', '#/quan-ly-san') +
        kpi('target', 'Tỷ lệ lấp đầy', fillPct + '%', Math.round(s.occHours) + '/' + s.capacity + ' giờ-sân vật lý') +
        kpi('flame', 'Lấp đầy giờ vàng ' + cfg.peakFrom + 'h–' + cfg.peakTo + 'h', goldPct + '%', Math.round(s.occGolden) + '/' + s.capacityGolden + ' giờ-sân') + '</div>' +
        '<div class="grid2"><div class="card card-pad"><div class="card-title">Doanh thu theo ngày đá (đơn đã xác nhận)</div>' + barChart(revVals, days.map(HH.fmtDateDM), { fmt: fmtM, tip: money, label: 'Doanh thu theo ngày', alt: days.map(function (d) { return d === today; }) }) + '<div class="hint">Cột tím là hôm nay.</div></div>' +
        '<div class="card card-pad"><div class="row" style="justify-content:space-between"><div class="card-title" style="margin:0">Tình trạng 23 sân hôm nay</div><select class="select" id="d-hour" style="width:auto">' + hrs.map(function (x) { return '<option value="' + x + '" ' + (+x === dash.hour ? 'selected' : '') + '>' + HH.fmtHour(+x) + '</option>'; }).join('') + '</select></div><div class="donut-wrap mt16">' + donut(parts, st.total, st.total, 'lựa chọn sân') + '<div class="donut-legend">' + parts.map(function (p) { return '<div><i style="background:' + p.c + '"></i>' + p.l + '<b>' + p.v + '</b></div>'; }).join('') + '</div></div></div></div>' +
        '<div class="grid2"><div class="card card-pad"><div class="card-title">Khung giờ phổ biến (số đơn theo giờ bắt đầu chiếm sân)</div>' + barChart(hv, hrs.map(function (x) { return x + 'h'; }), { tip: function (v) { return v + ' đơn'; }, label: 'Khung giờ phổ biến', alt: hrs.map(function (x) { return +x >= cfg.peakFrom && +x < cfg.peakTo; }) }) + '<div class="hint">Cột tím: giờ vàng.' + (topH.length ? ' Phổ biến nhất: ' + topH.map(function (x) { return x[0] + 'h (' + x[1] + ' đơn)'; }).join(', ') + '.' : '') + '</div></div>' +
        '<div class="card card-pad"><div class="card-title">Đặt sân gần đây</div>' + (recent.length ? '<div class="table-wrap"><table class="tbl"><tbody>' + recent.map(function (b) { return '<tr><td><span class="code" data-order="' + b.id + '">' + b.id + '</span><div class="hint">' + HH.fmtDateTime(b.createdAt) + '</div></td><td>' + esc(b.customerName) + '<div class="hint">' + b.courtId + ' · ' + HH.fmtDateDM(b.date) + ' ' + HH.fmtHour(b.startHour) + '</div></td><td>' + statusChip(b) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty('clipboard-list', 'Chưa có đơn nào')) + '</div></div></div>';
      $('#d-period').onchange = function () { dash.period = this.value; render(); };
      $('#d-hour').onchange = function () { dash.hour = +this.value; render(); };
    };
    function kpi(icon, label, v, sub, href) { return '<div class="card kpi ' + (href ? 'clickable' : '') + '" ' + (href ? 'data-href="' + href + '"' : '') + '><small>' + ic(icon, 15) + label + '</small><div class="v">' + v + '</div><div class="s">' + esc(sub) + '</div></div>'; }
    render();
    on($view, 'click', '[data-href]', function (e, t) { go(t.dataset.href); });
    on($view, 'click', '[data-order]', function (e, t) { showOrder(t.dataset.order); });
    page = { onData: render };
  }

  /* ======================================================================
     ĐƠN ĐẶT SÂN
     ====================================================================== */
  var ord = { q: '', date: '', status: 'all', pay: 'all', page: 1 };
  function filteredOrders() {
    var q = ord.q.trim().toLowerCase();
    return sortedByCreated().filter(function (b) {
      if (q && b.id.toLowerCase().indexOf(q) < 0 && b.customerName.toLowerCase().indexOf(q) < 0 && b.phone.indexOf(q.replace(/\s/g, '')) < 0) return false;
      if (ord.date && b.date !== ord.date) return false;
      if (ord.status !== 'all' && b.status !== ord.status) return false;
      if (ord.pay !== 'all' && b.paymentStatus !== ord.pay) return false;
      return true;
    });
  }
  function pageOrders(q) {
    if (q.status) { ord.status = q.status; ord.page = 1; }
    var render = function () {
      var list = filteredOrders(), pages = Math.max(1, Math.ceil(list.length / 10)); if (ord.page > pages) ord.page = pages;
      var rows = list.slice((ord.page - 1) * 10, ord.page * 10);
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Quản lý đơn đặt sân</h2><span class="grow"></span><button class="btn btn-outline" id="o-csv">' + ic('file-down', 16) + ' Xuất CSV</button><button class="btn btn-primary" id="o-new">' + ic('plus', 16) + ' Tạo đơn hộ khách</button></div>' +
        '<div class="card"><div class="toolbar"><div class="search"><span>' + ic('search', 16) + '</span><input class="input" id="o-q" placeholder="Tìm mã đơn, tên khách, số điện thoại…" value="' + esc(ord.q) + '"></div>' +
        '<div class="field"><label>Ngày đá</label><input type="date" class="input" id="o-date" value="' + ord.date + '"></div>' +
        '<div class="field"><label>Trạng thái đơn</label><select class="select" id="o-status"><option value="all">Tất cả</option>' + ['pending', 'confirmed', 'cancelled'].map(function (s) { return '<option value="' + s + '" ' + (ord.status === s ? 'selected' : '') + '>' + HH.STATUS[s].label + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Thanh toán</label><select class="select" id="o-pay"><option value="all">Tất cả</option>' + Object.keys(HH.PAYMENT).map(function (s) { return '<option value="' + s + '" ' + (ord.pay === s ? 'selected' : '') + '>' + HH.PAYMENT[s].short + '</option>'; }).join('') + '</select></div>' +
        '<button class="btn btn-outline" id="o-reset" title="Xóa bộ lọc">' + ic('rotate-ccw', 16) + '</button></div>' +
        (rows.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Ngày tạo</th><th>Khách hàng</th><th>SĐT</th><th>Sân</th><th>Ngày &amp; giờ đặt</th><th class="num">Tổng tiền</th><th class="num">Tiền cọc</th><th>Thanh toán</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>' +
          rows.map(function (b) {
            return '<tr><td><span class="code" data-order="' + b.id + '">' + b.id + '</span></td><td class="nowrap">' + HH.fmtDateTime(b.createdAt) + '</td><td>' + esc(b.customerName) + (b.seek ? ' <span class="chip purple">' + (b.seek.opponent ? 'Đã ghép' : 'Tìm đối') + '</span>' : '') + '</td><td class="nowrap">' + HH.fmtPhone(b.phone) + '</td><td><b>' + b.courtId + '</b></td><td class="nowrap">' + HH.fmtDate(b.date) + '<div class="hint">' + HH.fmtRange(b.startHour, b.endHour) + '</div></td><td class="num"><b>' + money(b.totalAmount) + '</b></td><td class="num">' + money(b.depositAmount) + '</td><td>' + payChip(b) + '</td><td>' + statusChip(b) + '</td>' +
              '<td><div class="act"><button class="btn btn-outline btn-sm btn-icon" data-order="' + b.id + '" title="Xem chi tiết">' + ic('eye', 15) + '</button>' + (b.status === 'pending' ? '<button class="btn btn-soft btn-sm btn-icon" data-act="confirm" data-id="' + b.id + '" title="Xác nhận đơn">' + ic('check', 15) + '</button>' : '') + (b.status !== 'cancelled' ? '<button class="btn btn-outline btn-sm btn-icon" style="color:var(--bad)" data-act="cancel" data-id="' + b.id + '" title="Hủy đơn">' + ic('ban', 15) + '</button>' : '') + '</div></td></tr>';
          }).join('') + '</tbody></table></div><div style="display:flex;justify-content:space-between;align-items:center;padding:0 16px;flex-wrap:wrap"><span class="hint">Hiển thị ' + rows.length + ' / ' + list.length + ' đơn (tổng ' + HH.getBookings().length + ' đơn)</span>' + pagerHtml(ord.page, pages) + '</div>'
          : empty('clipboard-list', 'Không có đơn nào phù hợp', '<span>Thử đổi từ khóa hoặc xóa bộ lọc.</span>')) + '</div></div>';
      var qEl = $('#o-q'); qEl.oninput = HH.debounce(function () { ord.q = qEl.value; ord.page = 1; var pos = qEl.selectionStart; render(); var n = $('#o-q'); n.focus(); n.setSelectionRange(pos, pos); }, 250);
      $('#o-date').onchange = function () { ord.date = this.value; ord.page = 1; render(); };
      $('#o-status').onchange = function () { ord.status = this.value; ord.page = 1; render(); };
      $('#o-pay').onchange = function () { ord.pay = this.value; ord.page = 1; render(); };
      $('#o-reset').onclick = function () { ord = { q: '', date: '', status: 'all', pay: 'all', page: 1 }; render(); };
      $('#o-new').onclick = function () { createOrderModal({}); };
      $('#o-csv').onclick = function () {
        var l = filteredOrders(); if (!l.length) { toast('warn', 'Không có đơn để xuất'); return; }
        var rows = [['Mã đơn', 'Ngày tạo', 'Khách hàng', 'SĐT', 'Sân', 'Ngày đá', 'Giờ', 'Tổng tiền', 'Tiền cọc', 'Thanh toán', 'Trạng thái', 'Nguồn']].concat(l.map(function (b) { return [b.id, HH.fmtDateTime(b.createdAt), b.customerName, b.phone, b.courtId, HH.fmtDate(b.date), HH.fmtRange(b.startHour, b.endHour), b.totalAmount, b.depositAmount, HH.PAYMENT[b.paymentStatus].label, HH.STATUS[b.status].label, HH.sourceLabel(b.source)]; }));
        download('don-dat-san-huyhoang.csv', '﻿' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
        toast('ok', 'Đã xuất ' + l.length + ' đơn ra file CSV');
      };
    };
    render();
    on($view, 'click', '[data-p]', function (e, b) { ord.page = +b.dataset.p; render(); });
    page = { onData: function () { var a = document.activeElement; if (a && a.id === 'o-q') return; render(); } };
    wireOrderActions($view);
  }
  function wireOrderActions(root) {
    on(root, 'click', '[data-order]', function (e, t) { showOrder(t.dataset.order); });
    on(root, 'click', '[data-act="confirm"]', function (e, t) { doConfirm(t.dataset.id); });
    on(root, 'click', '[data-act="cancel"]', function (e, t) { cancelModal(t.dataset.id); });
    on(root, 'click', '[data-act="deposit"]', function (e, t) { doPay(t.dataset.id, 'deposit'); });
    on(root, 'click', '[data-act="paid"]', function (e, t) { doPay(t.dataset.id, 'paid'); });
  }
  function doConfirm(id) { var r = HH.confirmBooking(id, 'Quản trị viên'); if (r.ok) toast('ok', 'Đã xác nhận đơn ' + id, ['Khách hàng thấy trạng thái mới ngay trên website.']); else toastErr(r); refreshOrderModal(id); }
  function doPay(id, kind) { var r = HH.markPayment(id, kind, 'Quản trị viên'); if (r.ok) toast('ok', kind === 'deposit' ? 'Đã ghi nhận đặt cọc (mô phỏng)' : 'Đã ghi nhận thanh toán đủ (mô phỏng)'); else toastErr(r); refreshOrderModal(id); }

  var orderModalApi = null;
  function refreshOrderModal(id) { if (orderModalApi && document.body.contains(orderModalApi.el)) { orderModalApi.close(); showOrder(id); } }
  function showOrder(id) {
    var b = HH.getBooking(id); if (!b) { toast('bad', 'Không tìm thấy đơn ' + id); return; }
    if (orderModalApi && document.body.contains(orderModalApi.el)) orderModalApi.close();
    var c = HH.getCourt(b.courtId), paid = HH.paidAmount(b);
    var body = '<div class="row wrap" style="margin-bottom:12px"><span class="order-code">' + b.id + '</span>' + statusChip(b) + '<span class="chip ' + HH.PAYMENT[b.paymentStatus].cls + '">' + HH.PAYMENT[b.paymentStatus].label + '</span>' + (b.seek ? '<span class="chip purple">' + (b.seek.opponent ? 'Kèo đã ghép' : 'Đang tìm đối') + '</span>' : '') + '<span class="chip">Nguồn: ' + HH.sourceLabel(b.source) + '</span></div>' +
      '<div class="kv-grid"><div><div class="kv"><span>Khách hàng</span><b>' + esc(b.customerName) + '</b></div><div class="kv"><span>Số điện thoại</span><b>' + HH.fmtPhone(b.phone) + '</b></div><div class="kv"><span>Sân</span><b>' + esc(c.name) + (c.type === 7 ? ' (' + c.components.join('+') + ')' : '') + '</b></div><div class="kv"><span>Ngày đá</span><b>' + HH.fmtDateLong(b.date) + '</b></div><div class="kv"><span>Giờ</span><b>' + HH.fmtRange(b.startHour, b.endHour) + ' (' + (b.endHour - b.startHour) + ' giờ)</b></div><div class="kv"><span>Ngày tạo đơn</span><b>' + HH.fmtDateTime(b.createdAt) + '</b></div>' + (b.note ? '<div class="kv"><span>Ghi chú</span><b>' + esc(b.note) + '</b></div>' : '') + '</div>' +
      '<div>' + b.lines.map(function (l) { return '<div class="kv"><span>' + HH.fmtRange(l.hour, l.hour + 1) + (l.flash ? ' (giờ chót -' + l.percent + '%)' : '') + '</span><b>' + money(l.price) + '</b></div>'; }).join('') + b.services.map(function (s) { return '<div class="kv"><span>' + esc(s.name) + ' × ' + s.qty + '</span><b>' + money(s.amount) + '</b></div>'; }).join('') + (b.discountAmount ? '<div class="kv"><span>Mã ' + esc(b.promoCode) + '</span><b>-' + money(b.discountAmount) + '</b></div>' : '') + '<div class="kv total"><span>Tổng tiền</span><b>' + money(b.totalAmount) + '</b></div><div class="kv"><span>Tiền cọc (' + b.depositPercent + '%)</span><b>' + money(b.depositAmount) + '</b></div><div class="kv"><span>Đã thu (mô phỏng)</span><b>' + money(paid) + '</b></div>' + (b.status === 'cancelled' ? '<div class="kv"><span>Hoàn cọc (' + (b.refundPercent || 0) + '%)</span><b>' + money(b.refundAmount || 0) + '</b></div>' : '') + '</div></div>' +
      (b.status === 'cancelled' ? '<div class="notice bad mt16">' + ic('circle-x', 16) + '<span><b>Đã hủy' + (b.cancelledBy ? ' bởi ' + esc(b.cancelledBy) : '') + ':</b> ' + esc(b.cancelReason || '') + '</span></div>' : '') +
      (b.seek ? '<div class="notice mt16" style="background:var(--purple-bg);color:#4c2aa8">' + ic('swords', 16) + '<span>Đội chủ <b>' + esc(b.seek.teamName) + '</b> (' + b.seek.havePlayers + '/' + b.seek.teamSize + ' người, ' + esc(HH.levelOf(b.seek.level).label) + ')' + (b.seek.opponent ? ' · Đối thủ <b>' + esc(b.seek.opponent.teamName) + '</b> (' + esc(b.seek.opponent.phone) + ')' : ' · chưa có đội nhận') + '</span></div>' : '') +
      '<div class="card-title mt16">Nhật ký thao tác</div><ul class="hist">' + b.history.slice().reverse().map(function (h) { return '<li><time>' + HH.fmtDateTime(h.at) + '</time><span><b>' + esc(h.action) + '</b> · ' + esc(h.by) + (h.note ? ' — ' + esc(h.note) : '') + '</span></li>'; }).join('') + '</ul>';
    var foot = '<button class="btn btn-outline" data-close>Đóng</button>' +
      (b.status === 'cancelled' ? '<button class="btn btn-soft" data-act="reopen" data-id="' + b.id + '">' + ic('undo-2', 15) + ' Khôi phục đơn</button>' : '') +
      (b.status !== 'cancelled' && b.paymentStatus === 'unpaid' ? '<button class="btn btn-soft" data-act="deposit" data-id="' + b.id + '">Ghi nhận đã cọc</button>' : '') +
      (b.status !== 'cancelled' && (b.paymentStatus === 'unpaid' || b.paymentStatus === 'deposit') ? '<button class="btn btn-soft" data-act="paid" data-id="' + b.id + '">Ghi nhận trả đủ</button>' : '') +
      (b.status !== 'cancelled' ? '<button class="btn btn-outline" style="color:var(--bad)" data-act="cancel" data-id="' + b.id + '">Hủy đơn</button>' : '') +
      (b.status === 'pending' ? '<button class="btn btn-primary" data-act="confirm" data-id="' + b.id + '">' + ic('check', 15) + ' Xác nhận đơn</button>' : '');
    orderModalApi = openModal({ title: 'Chi tiết đơn ' + b.id, size: 'wide', body: body, foot: foot, onMount: function (el) {
      on(el, 'click', '[data-act="confirm"]', function (e, t) { doConfirm(t.dataset.id); });
      on(el, 'click', '[data-act="deposit"]', function (e, t) { doPay(t.dataset.id, 'deposit'); });
      on(el, 'click', '[data-act="paid"]', function (e, t) { doPay(t.dataset.id, 'paid'); });
      on(el, 'click', '[data-act="cancel"]', function (e, t) { cancelModal(t.dataset.id); });
      on(el, 'click', '[data-act="reopen"]', function (e, t) { var r = HH.reopenBooking(t.dataset.id, 'Quản trị viên'); if (r.ok) toast('ok', 'Đã khôi phục đơn', ['Đơn quay lại trạng thái "Chờ xác nhận" và giữ chỗ.']); else toastErr(r, 'Không khôi phục được đơn'); refreshOrderModal(t.dataset.id); });
    } });
  }

  function cancelModal(id) {
    var b = HH.getBooking(id); if (!b) return;
    var paid = HH.paidAmount(b), pct = HH.refundPercentFor(b);
    openModal({ title: 'Hủy đơn ' + b.id, body: '<p style="margin-top:0">Hủy đơn của <b>' + esc(b.customerName) + '</b> – ' + b.courtId + ', ' + HH.fmtDate(b.date) + ' ' + HH.fmtRange(b.startHour, b.endHour) + '. Sân sẽ được mở lại (nếu không còn đơn khác chiếm cùng khung giờ).</p>' +
      '<div class="field"><label>Lý do hủy</label><select class="select" id="cx-reason"><option value="policy">Khách yêu cầu hủy — hoàn cọc theo chính sách (' + pct + '%)</option><option value="full">Sân gặp sự cố / thời tiết — hoàn 100%</option><option value="none">Khách không đến / vi phạm — không hoàn cọc</option></select></div>' +
      '<div class="notice mt16" id="cx-prev"></div>', foot: '<button class="btn btn-outline" data-close>Quay lại</button><button class="btn btn-danger" id="cx-ok">Xác nhận hủy đơn</button>', onMount: function (el, api) {
        var texts = { policy: 'Khách yêu cầu hủy', full: 'Sân gặp sự cố hoặc thời tiết xấu', none: 'Khách không đến / vi phạm nội quy' };
        var prev = function () { var m = $('#cx-reason', el).value, p = m === 'full' ? 100 : (m === 'none' ? 0 : pct); $('#cx-prev', el).innerHTML = ic('wallet', 16) + '<span>' + (paid > 0 ? 'Đã thu ' + money(paid) + ' → hoàn <b>' + p + '%</b> = <b>' + money(Math.round(paid * p / 100 / 1000) * 1000) + '</b> (mô phỏng).' : 'Đơn chưa thanh toán nên không phát sinh hoàn tiền.') + '</span>'; };
        $('#cx-reason', el).onchange = prev; prev();
        $('#cx-ok', el).onclick = function () { var m = $('#cx-reason', el).value; var r = HH.cancelBooking(id, { by: 'Quản trị viên', reason: texts[m], refundMode: m }); api.close(); if (r.ok) toast('ok', 'Đã hủy đơn ' + id, ['Lịch sân đã được giải phóng.']); else toastErr(r); refreshOrderModal(id); };
      } });
  }

  /* ---------- Tạo đơn hộ khách (Zalo / hotline / tại quầy) ---------- */
  function createOrderModal(pre) {
    var courts = HH.getCourts(), today = HH.todayStr(), now = HH.now();
    var body = '<div class="notice" style="margin-bottom:12px">' + ic('info', 16) + '<span>Đặt hộ khách gọi hotline/Zalo hoặc đến quầy — cùng một lịch duy nhất, vẫn kiểm tra xung đột sân 5 ↔ 7.</span></div><div class="form-grid">' +
      '<div class="field"><label>Sân</label><select class="select" id="a-court">' + courts.map(function (c) { return '<option value="' + c.id + '" ' + (pre.courtId === c.id ? 'selected' : '') + '>' + c.name + (c.type === 7 ? ' (7 người)' : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Ngày</label><input type="date" class="input" id="a-date" min="' + today + '" value="' + (pre.date || today) + '"></div>' +
      '<div class="field"><label>Giờ bắt đầu</label><select class="select" id="a-start"></select></div><div class="field"><label>Giờ kết thúc</label><select class="select" id="a-end"></select></div>' +
      '<div class="field"><label>Tên khách *</label><input class="input" id="a-name" maxlength="60"></div><div class="field"><label>Số điện thoại *</label><input class="input" id="a-phone" placeholder="0901234567"></div>' +
      '<div class="field"><label>Nguồn đặt</label><select class="select" id="a-src"><option value="hotline">Hotline</option><option value="zalo">Zalo</option><option value="counter">Tại quầy</option></select></div><div class="field"><label>Trạng thái đơn</label><select class="select" id="a-status"><option value="confirmed">Đã xác nhận</option><option value="pending">Chờ xác nhận</option></select></div>' +
      '<div class="field"><label>Thanh toán</label><select class="select" id="a-pay"><option value="unpaid">Chưa thanh toán</option><option value="deposit">Đã cọc</option><option value="paid">Đã trả đủ</option></select></div><div class="field"><label>Ghi chú</label><input class="input" id="a-note" maxlength="200"></div></div><div id="a-msg" class="mt16"></div>';
    openModal({ title: 'Tạo đơn hộ khách', size: 'wide', body: body, foot: '<button class="btn btn-outline" data-close>Đóng</button><button class="btn btn-primary" id="a-ok">Tạo đơn</button>', onMount: function (el, api) {
      var s = $('#a-start', el), e = $('#a-end', el);
      for (var h = HH.OPEN_HOUR; h < HH.CLOSE_HOUR; h++) s.insertAdjacentHTML('beforeend', '<option value="' + h + '">' + HH.fmtHour(h) + '</option>');
      for (var h2 = HH.OPEN_HOUR + 1; h2 <= HH.CLOSE_HOUR; h2++) e.insertAdjacentHTML('beforeend', '<option value="' + h2 + '">' + HH.fmtHour(h2) + '</option>');
      s.value = pre.start || Math.max(HH.OPEN_HOUR, Math.min(21, now.getHours() + 1)); e.value = pre.end || (+s.value + 1);
      var input = function () { return { courtId: $('#a-court', el).value, date: $('#a-date', el).value, startHour: +s.value, endHour: +e.value, customerName: $('#a-name', el).value, phone: $('#a-phone', el).value, note: $('#a-note', el).value, source: $('#a-src', el).value }; };
      var check = function () {
        var i = input(), v = HH.validateSlot(i, { allowCurrentHour: true }), box = $('#a-msg', el);
        if (v.ok) { var pb = HH.priceBreakdown(HH.getCourt(i.courtId), i.date, i.startHour, i.endHour, HH.getConfig(), HH.now()); box.innerHTML = '<div class="notice ok">' + ic('circle-check', 16) + '<span>Khung giờ còn trống. Tiền sân dự kiến: <b>' + money(pb.total) + '</b> (' + pb.hours + ' giờ).</span></div>'; }
        else box.innerHTML = '<div class="notice bad">' + ic('circle-alert', 16) + '<div><b>Không đặt được:</b><ul style="margin:4px 0 0;padding-left:16px">' + v.errors.map(function (x) { return '<li>' + esc(x.message) + '</li>'; }).join('') + '</ul></div></div>';
        return v.ok;
      };
      $$('select,input', el).forEach(function (x) { x.addEventListener('change', check); }); check();
      $('#a-ok', el).onclick = function () {
        var i = input(), r = HH.createBooking(i, { initialStatus: $('#a-status', el).value, initialPayment: $('#a-pay', el).value, actor: 'Quản trị viên', allowCurrentHour: true });
        if (!r.ok) { toastErr(r, 'Không tạo được đơn'); check(); return; }
        api.close(); toast('ok', 'Đã tạo đơn ' + r.booking.id, ['Lịch sân đã cập nhật, khách xem được ở trang tra cứu.']);
      };
    } });
  }

  /* ======================================================================
     LỊCH SÂN (Admin)
     ====================================================================== */
  var sch = { date: null, type: '5', win: 'all' };
  function pageSchedule() {
    var today = HH.todayStr(); if (!sch.date || sch.date < today) sch.date = today;
    var render = function () {
      var cfg = HH.getConfig(), courts = HH.getCourts(), now = HH.now(), idx = HH.buildDayIndex(sch.date), w = HH.TIME_WINDOWS.filter(function (x) { return x.id === sch.win; })[0];
      var list = courts.filter(function (c) { return String(c.type) === sch.type; }), hours = [], nowH = now.getHours(); for (var h = w.from; h < w.to; h++) { if (sch.date === today && h < nowH) continue; hours.push(h); } // hôm nay: ẩn các giờ đã qua
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Lịch sân</h2><span class="grow"></span><div class="seg" id="s-type"><button data-t="5" class="' + (sch.type === '5' ? 'on' : '') + '">Sân 5</button><button data-t="7" class="' + (sch.type === '7' ? 'on' : '') + '">Sân 7</button></div></div>' +
        '<div class="card"><div class="toolbar"><div class="field"><label>Ngày</label><input type="date" class="input" id="s-date" value="' + sch.date + '"></div><div class="date-chips">' + [0, 1, 2].map(function (n) { var d = HH.addDays(today, n); return '<button class="dchip ' + (d === sch.date ? 'on' : '') + '" data-d="' + d + '">' + (n === 0 ? 'Hôm nay' : (n === 1 ? 'Ngày mai' : HH.fmtDateDM(d))) + '</button>'; }).join('') + '</div><div class="field"><label>Khung giờ</label><select class="select" id="s-win">' + HH.TIME_WINDOWS.map(function (x) { return '<option value="' + x.id + '" ' + (x.id === sch.win ? 'selected' : '') + '>' + x.label + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="legend" style="padding:12px 16px 0"><span><i class="lg-free"></i>Còn trống (bấm để đặt hộ)</span><span><i class="lg-hold"></i>Chờ xác nhận</span><span><i class="lg-booked"></i>Đã xác nhận</span><span><i class="lg-seek"></i>Đang tìm đối</span><span><i class="lg-off"></i>Bảo trì / đã qua</span></div>' +
        (hours.length ? '' : '<div class="hint" style="padding:14px 16px">Khung giờ này hôm nay đã qua hết — chọn ngày khác hoặc khung giờ khác.</div>') + '<div class="sched-wrap" style="border:0;border-radius:0 0 14px 14px"><table class="sched"><thead><tr><th class="rowhead">Sân</th>' + hours.map(function (h) { return '<th class="' + (HH.isPeakHour(h, cfg) ? 'golden' : '') + '">' + HH.fmtHour(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        list.map(function (c) { return '<tr><td class="rowhead">' + c.code + '<small>' + (c.type === 7 ? c.components.join('+') : 'Sân 5') + '</small></td>' + hours.map(function (h) { return '<td>' + cell(c, h, idx, now, courts, cfg) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div></div>';
    };
    function cell(c, h, idx, now, courts, cfg) {
      var st = HH.slotState(idx, c, sch.date, h, now, courts), b = st.booking;
      var nm = b ? esc(b.customerName.split(' ').slice(-1)[0]) : '';
      if (st.state === 'past') return b ? '<button class="slot mini ' + HH.visualState(b) + (st.linked ? ' linked' : '') + '" data-order="' + b.id + '" style="opacity:.55">' + nm + '<small>đã qua</small></button>' : '<div class="slot past">—</div>';
      switch (st.state) {
        case 'free': return '<button class="slot mini free" data-new="' + c.id + '|' + h + '">' + HH.fmtK(HH.priceForHour(c, sch.date, h, cfg, now).price) + '</button>';
        case 'maintenance': return '<div class="slot mini maintenance">Bảo trì</div>';
        default: var lab = { booked: 'Đã xác nhận', holding: 'Chờ xác nhận', seeking: 'Tìm đối' }[st.state];
          return '<button class="slot mini ' + st.state + (st.linked ? ' linked' : '') + '" data-order="' + b.id + '" title="' + esc(b.customerName) + ' · ' + b.id + '">' + nm + '<small>' + (st.linked ? 'qua ' + b.courtId : lab) + '</small></button>';
      }
    }
    render();
    on($view, 'click', '#s-type button', function (e, b) { sch.type = b.dataset.t; render(); });
    on($view, 'click', '.dchip', function (e, b) { sch.date = b.dataset.d; render(); });
    on($view, 'change', '#s-date', function (e, el) { if (!HH.isValidDateStr(el.value) || el.value < HH.todayStr()) { toast('bad', 'Ngày không hợp lệ'); el.value = sch.date; return; } sch.date = el.value; render(); });
    on($view, 'change', '#s-win', function (e, el) { sch.win = el.value; render(); });
    on($view, 'click', '[data-new]', function (e, b) { var p = b.dataset.new.split('|'); createOrderModal({ courtId: p[0], date: sch.date, start: +p[1], end: +p[1] + 1 }); });
    on($view, 'click', '[data-order]', function (e, b) { showOrder(b.dataset.order); });
    page = { onData: render };
  }

  /* ======================================================================
     THANH TOÁN (mô phỏng)
     ====================================================================== */
  var pay = { f: 'todo', page: 1 };
  function pagePayments() {
    var render = function () {
      var all = HH.getBookings(), s = HH.computeStats({ from: null, to: null, label: 'Tất cả' }), list = sortedByCreated().filter(function (b) {
        if (pay.f === 'todo') return b.status !== 'cancelled' && b.paymentStatus !== 'paid';
        if (pay.f === 'refund') return b.status === 'cancelled' && b.refundAmount > 0;
        return pay.f === 'all' || b.paymentStatus === pay.f;
      });
      var pages = Math.max(1, Math.ceil(list.length / 10)); if (pay.page > pages) pay.page = pages;
      var rows = list.slice((pay.page - 1) * 10, pay.page * 10);
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Thanh toán</h2></div><div class="notice warn" style="margin-bottom:14px">' + ic('triangle-alert', 16) + '<span>Toàn bộ là <b>thanh toán mô phỏng</b>: nhân viên bấm ghi nhận thủ công, không có đối soát ngân hàng thật.</span></div>' +
        '<div class="kpis">' + [['wallet', 'Đã thu (cọc + trả đủ)', money(s.collected), 'mô phỏng'], ['hourglass', 'Cần thu cọc', money(s.toCollect), 'đơn chưa thanh toán'], ['rotate-ccw', 'Đã hoàn cọc', money(s.refunded), 'đơn đã hủy'], ['receipt', 'Đơn chưa trả đủ', all.filter(function (b) { return b.status !== 'cancelled' && b.paymentStatus !== 'paid'; }).length, 'đang hoạt động']].map(function (k) { return '<div class="card kpi"><small>' + ic(k[0], 15) + k[1] + '</small><div class="v">' + k[2] + '</div><div class="s">' + k[3] + '</div></div>'; }).join('') + '</div>' +
        '<div class="card mt16"><div class="toolbar"><div class="field"><label>Hiển thị</label><select class="select" id="p-f">' + [['todo', 'Cần xử lý (chưa trả đủ)'], ['all', 'Tất cả đơn'], ['unpaid', 'Chờ thanh toán'], ['deposit', 'Đã cọc'], ['paid', 'Đã trả đủ'], ['refund', 'Có hoàn cọc']].map(function (x) { return '<option value="' + x[0] + '" ' + (pay.f === x[0] ? 'selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div></div>' +
        (rows.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đá</th><th class="num">Tổng tiền</th><th class="num">Đã thu</th><th class="num">Còn lại</th><th>Thanh toán</th><th>Thao tác</th></tr></thead><tbody>' + rows.map(function (b) {
          var paid = HH.paidAmount(b);
          return '<tr><td><span class="code" data-order="' + b.id + '">' + b.id + '</span></td><td>' + esc(b.customerName) + '<div class="hint">' + HH.fmtPhone(b.phone) + '</div></td><td class="nowrap">' + HH.fmtDate(b.date) + '<div class="hint">' + HH.fmtRange(b.startHour, b.endHour) + '</div></td><td class="num">' + money(b.totalAmount) + '</td><td class="num">' + money(paid) + (b.refundAmount ? '<div class="hint">hoàn ' + money(b.refundAmount) + '</div>' : '') + '</td><td class="num">' + (b.status === 'cancelled' ? '—' : money(b.totalAmount - paid)) + '</td><td>' + payChip(b) + (b.status === 'cancelled' ? ' ' + statusChip(b) : '') + '</td><td><div class="act">' + (b.status !== 'cancelled' && b.paymentStatus === 'unpaid' ? '<button class="btn btn-soft btn-sm" data-act="deposit" data-id="' + b.id + '">Ghi nhận cọc</button>' : '') + (b.status !== 'cancelled' && b.paymentStatus !== 'paid' ? '<button class="btn btn-outline btn-sm" data-act="paid" data-id="' + b.id + '">Trả đủ</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' + pagerHtml(pay.page, pages) : empty('wallet', 'Không có khoản nào cần xử lý')) + '</div></div>';
      $('#p-f').onchange = function () { pay.f = this.value; pay.page = 1; render(); };
    };
    render();
    on($view, 'click', '[data-p]', function (e, b) { pay.page = +b.dataset.p; render(); });
    wireOrderActions($view);
    page = { onData: render };
  }

  /* ======================================================================
     QUẢN LÝ SÂN
     ====================================================================== */
  function pageCourts() {
    var render = function () {
      var courts = HH.getCourts(), cfg = HH.getConfig(), indep = courts.filter(function (c) { return c.type === 5 && !HH.parentOf(c.id, courts); }).map(function (c) { return c.id; });
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Quản lý sân</h2><span class="muted">' + courts.length + ' lựa chọn đặt sân · ' + courts.filter(function (c) { return c.active === false; }).length + ' đang ngừng hoạt động</span></div>' +
        '<div class="card card-pad"><div class="card-title">' + ic('layers', 18) + ' Sơ đồ liên kết sân 7 ↔ sân 5 (cố định)</div><div class="link-diagram">' + courts.filter(function (c) { return c.type === 7; }).map(function (c) { return '<div class="link-box"><div class="top">' + c.id + ' = ' + c.components.join(' + ') + '</div><div class="kids">' + c.components.map(function (k) { return '<span>' + k + '</span>'; }).join('') + '</div></div>'; }).join('') + '<div class="link-box"><b>' + indep.length + ' sân 5 độc lập</b><div class="hint" style="margin:6px 0">' + indep.join(', ') + '</div><p class="hint" style="margin:0">Không liên kết với sân 7, đặt bình thường.</p></div></div><p class="hint mt8">Quy tắc: đặt sân 7 ⇒ 3 sân 5 thành phần bị khóa cùng khung giờ; đặt một sân 5 thành phần ⇒ sân 7 tương ứng bị khóa. Cấu trúc này được khóa để không làm hỏng các đơn đã đặt (muốn đổi, sửa <code>HH.COURT_LINKS</code> trong data.js rồi khôi phục dữ liệu mẫu).</p></div>' +
        '<div class="card mt16"><div class="table-wrap"><table class="tbl"><thead><tr><th>Mã sân</th><th>Loại</th><th>Liên kết</th><th class="num">Giá giờ thường</th><th class="num">Giá giờ vàng</th><th>Đơn sắp tới</th><th>Hoạt động</th><th>Thao tác</th></tr></thead><tbody>' + courts.map(function (c) {
          var par = c.type === 5 ? HH.parentOf(c.id, courts) : null, up = HH.upcomingUsageCount(c.id);
          return '<tr><td><b>' + c.code + '</b> <span class="hint">' + esc(c.zone) + '</span></td><td>' + (c.type === 7 ? 'Sân 7 người' : 'Sân 5 người') + '</td><td>' + (c.type === 7 ? '<span class="chip">' + c.components.join(' + ') + '</span>' : (par ? '<span class="chip info">Thuộc ' + par + '</span>' : '<span class="chip muted">Độc lập</span>')) + '</td><td class="num">' + money(c.priceOff) + '</td><td class="num">' + money(c.pricePeak) + '</td><td>' + up + ' đơn</td><td><label class="switch" title="Bật/tắt hoạt động"><input type="checkbox" data-toggle="' + c.id + '" ' + (c.active !== false ? 'checked' : '') + '><span></span></label></td><td><div class="act"><button class="btn btn-outline btn-sm" data-usage="' + c.id + '">' + ic('history', 14) + ' Lịch sử</button><button class="btn btn-outline btn-sm" data-price="' + c.id + '">' + ic('pencil', 14) + ' Giá</button></div></td></tr>';
        }).join('') + '</tbody></table></div></div></div>';
    };
    render();
    on($view, 'change', '[data-toggle]', function (e, el) {
      var id = el.dataset.toggle, want = el.checked, up = HH.upcomingUsageCount(id);
      el.checked = !want; // chờ xác nhận mới đổi
      var apply = function () { var r = HH.setCourtActive(id, want); if (r.ok) toast('ok', (want ? 'Đã bật hoạt động ' : 'Đã tắt hoạt động ') + id); else toastErr(r); };
      if (want) { apply(); return; }
      var rel = HH.relatedCourts(id);
      confirmBox('Tắt hoạt động ' + id + '?', '<p style="margin:0">Khách sẽ <b>không đặt được</b> sân này' + (rel.length ? ' (và các sân liên kết: ' + rel.filter(function (x) { return HH.getCourt(x).type === 7; }).join(', ') + ' nếu có)' : '') + '.</p>' + (up ? '<div class="notice warn mt16">' + ic('triangle-alert', 16) + '<span>Hiện có <b>' + up + ' đơn sắp tới</b> dùng sân này. Các đơn đó <b>vẫn được giữ nguyên</b> (không bị xóa), hãy liên hệ khách để đổi lịch nếu cần.</span></div>' : ''), 'Tắt hoạt động', true).then(function (ok) { if (ok) apply(); });
    });
    on($view, 'click', '[data-usage]', function (e, b) { usageModal(b.dataset.usage); });
    on($view, 'click', '[data-price]', function (e, b) { priceModal(b.dataset.price); });
    page = { onData: render };
  }
  function usageModal(id) {
    var c = HH.getCourt(id), list = HH.courtUsage(id), up = list.filter(function (u) { return HH.isOccupying(u.booking); }).length;
    var relLabel = { same: 'Trực tiếp', component: 'Qua sân thành phần', parent: 'Qua sân 7 người' };
    openModal({ title: 'Lịch sử dụng ' + esc(c.name), size: 'wide', body: '<p class="muted" style="margin-top:0">' + list.length + ' đơn liên quan (' + up + ' đang chiếm lịch)' + (c.type === 7 ? ' — gồm cả đơn đặt trên ' + c.components.join(', ') + ' vì dùng chung mặt sân.' : (HH.parentOf(id) ? ' — gồm cả đơn đặt sân 7 ' + HH.parentOf(id) + ' vì dùng chung mặt sân.' : '.')) + '</p>' +
      (list.length ? '<div class="table-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Ngày giờ</th><th>Khách</th><th>Liên quan</th><th>Trạng thái</th></tr></thead><tbody>' + list.slice(0, 60).map(function (u) { var b = u.booking; return '<tr><td><span class="code" data-order="' + b.id + '">' + b.id + '</span></td><td>' + HH.fmtDate(b.date) + ' ' + HH.fmtRange(b.startHour, b.endHour) + '</td><td>' + esc(b.customerName) + '</td><td>' + relLabel[u.relation] + (u.relation !== 'same' ? ' ' + b.courtId : '') + '</td><td>' + statusChip(b) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (list.length > 60 ? '<p class="hint">Hiển thị 60 đơn gần nhất.</p>' : '') : empty('history', 'Chưa có đơn nào')), foot: '<button class="btn btn-primary" data-close>Đóng</button>',
      onMount: function (el) { on(el, 'click', '[data-order]', function (e, t) { showOrder(t.dataset.order); }); } });
  }
  function priceModal(id) {
    var c = HH.getCourt(id);
    openModal({ title: 'Chỉnh giá ' + esc(c.name), size: 'sm', body: '<div class="notice" style="margin-bottom:12px">' + ic('info', 16) + '<span>Giá mới chỉ áp dụng cho <b>đơn tạo sau</b>. Các đơn cũ giữ nguyên giá đã chốt.</span></div><div class="field"><label>Giá giờ thường (đ/giờ)</label><input class="input" type="number" id="pr-off" step="1000" value="' + c.priceOff + '"></div><div class="field mt8"><label>Giá giờ vàng ' + HH.getConfig().peakFrom + 'h–' + HH.getConfig().peakTo + 'h (đ/giờ)</label><input class="input" type="number" id="pr-peak" step="1000" value="' + c.pricePeak + '"></div><div id="pr-err" class="field-err mt8"></div>',
      foot: '<button class="btn btn-outline" data-close>Hủy</button><button class="btn btn-primary" id="pr-ok">Lưu giá</button>', onMount: function (el, api) {
        $('#pr-ok', el).onclick = function () { var r = HH.setCourtPrices(id, $('#pr-off', el).value, $('#pr-peak', el).value); if (!r.ok) { $('#pr-err', el).textContent = r.errors[0].message; return; } api.close(); toast('ok', 'Đã cập nhật giá ' + id, ['Áp dụng cho các đơn mới.']); };
      } });
  }

  /* ======================================================================
     TÌM ĐỐI (kèo + bài đăng ghép người)
     ====================================================================== */
  function pageSeek() {
    var render = function () {
      var cfg = HH.getConfig(), seeks = sortedByCreated().filter(function (b) { return b.seek; }), posts = HH.getPosts();
      var open = seeks.filter(function (b) { return HH.isOccupying(b) && HH.isSeekingOpen(b); }).length;
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Tìm đối &amp; ghép người</h2></div><div class="kpis">' +
        [['swords', 'Kèo đang chờ đối', open, 'sân màu tím'], ['handshake', 'Kèo đã ghép', seeks.filter(function (b) { return b.seek.opponent && HH.isOccupying(b); }).length, 'sân màu đỏ'], ['timer', 'Hạn chót ghép', HH.fmtHour(cfg.seek.deadlineHour), 'ngày thi đấu'], ['layers', 'Giới hạn mỗi ngày', cfg.seek.maxPerDay + ' sân', 'tìm đối cùng lúc']].map(function (k) { return '<div class="card kpi"><small>' + ic(k[0], 15) + k[1] + '</small><div class="v">' + k[2] + '</div><div class="s">' + k[3] + '</div></div>'; }).join('') + '</div>' +
        '<div class="card mt16"><div class="card-pad" style="padding-bottom:0"><div class="card-title">Danh sách kèo tìm đối</div></div>' + (seeks.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Mã đơn</th><th>Đội chủ</th><th>Sân</th><th>Ngày giờ</th><th>Trình độ</th><th>Người</th><th>Đội nhận kèo</th><th>Tình trạng</th><th></th></tr></thead><tbody>' + seeks.slice(0, 30).map(function (b) {
          var stt = b.status === 'cancelled' ? '<span class="chip bad">Đã hủy</span>' : (b.seek.opponent ? '<span class="chip ok">Đã ghép</span>' : '<span class="chip purple">Đang chờ đối</span>');
          return '<tr><td><span class="code" data-order="' + b.id + '">' + b.id + '</span></td><td><b>' + esc(b.seek.teamName) + '</b><div class="hint">' + esc(b.customerName) + '</div></td><td>' + b.courtId + '</td><td class="nowrap">' + HH.fmtDate(b.date) + '<div class="hint">' + HH.fmtRange(b.startHour, b.endHour) + '</div></td><td>' + levelBadge(b.seek.level) + '</td><td>' + b.seek.havePlayers + '/' + b.seek.teamSize + '</td><td>' + (b.seek.opponent ? esc(b.seek.opponent.teamName) : '—') + '</td><td>' + stt + '</td><td><div class="act">' + (b.status !== 'cancelled' && !b.seek.opponent ? '<button class="btn btn-soft btn-sm" data-match="' + b.id + '">Ghép đội</button><button class="btn btn-outline btn-sm" style="color:var(--bad)" data-act="cancel" data-id="' + b.id + '">Hủy kèo</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' : empty('swords', 'Chưa có kèo nào')) + '</div>' +
        '<div class="card mt16"><div class="card-pad" style="padding-bottom:0"><div class="card-title">Bài đăng tìm người / cầu thủ tự do (' + posts.length + ')</div></div>' + (posts.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Loại</th><th>Tiêu đề</th><th>Người đăng</th><th>Thời gian</th><th>Trình độ</th><th>Đăng ký</th><th></th></tr></thead><tbody>' + posts.map(function (p) {
          return '<tr><td>' + (p.type === 'need_players' ? '<span class="chip info">Cần người</span>' : '<span class="chip ok">Cầu thủ tự do</span>') + '</td><td>' + esc(p.title) + '</td><td>' + esc(p.name) + '<div class="hint">' + HH.fmtPhone(p.phone) + '</div></td><td>' + (p.date ? HH.fmtDate(p.date) + ' ' + HH.fmtHour(p.hour) : esc(p.availability || '')) + '</td><td>' + levelBadge(p.level) + '</td><td>' + p.joined.length + (p.type === 'need_players' ? '/' + p.needed : '') + '</td><td><button class="btn btn-outline btn-sm btn-icon" style="color:var(--bad)" data-delpost="' + p.id + '" title="Xóa bài">' + ic('trash-2', 15) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>' : empty('users', 'Chưa có bài đăng')) + '</div></div>';
    };
    render();
    wireOrderActions($view);
    on($view, 'click', '[data-match]', function (e, b) {
      var id = b.dataset.match;
      openModal({ title: 'Ghép đội thủ công cho đơn ' + id, size: 'sm', body: '<div class="form-grid"><div class="field full"><label>Tên đội đối thủ</label><input class="input" id="m-team"></div><div class="field"><label>Số điện thoại</label><input class="input" id="m-phone"></div><div class="field"><label>Số người</label><input class="input" type="number" id="m-pl" min="1" value="5"></div><div class="field full"><label>Trình độ</label><select class="select" id="m-lv">' + HH.LEVELS.map(function (l) { return '<option value="' + l.id + '">' + l.label + '</option>'; }).join('') + '</select></div></div><div id="m-err" class="field-err mt8"></div>', foot: '<button class="btn btn-outline" data-close>Hủy</button><button class="btn btn-primary" id="m-ok">Ghép đội</button>', onMount: function (el, api) {
        $('#m-ok', el).onclick = function () { var r = HH.joinSeek(id, { teamName: $('#m-team', el).value, phone: $('#m-phone', el).value, level: $('#m-lv', el).value, players: $('#m-pl', el).value }); if (!r.ok) { $('#m-err', el).textContent = r.errors[0].message; return; } api.close(); toast('ok', 'Đã ghép đội thành công'); };
      } });
    });
    on($view, 'click', '[data-delpost]', function (e, b) { confirmBox('Xóa bài đăng?', 'Bài đăng sẽ biến mất khỏi trang khách hàng.', 'Xóa bài', true).then(function (ok) { if (ok) { HH.deletePost(b.dataset.delpost); toast('ok', 'Đã xóa bài đăng'); } }); });
    page = { onData: render };
  }

  /* ======================================================================
     KHUYẾN MÃI & GIẢI ĐẤU
     ====================================================================== */
  var promoTab = 'promo';
  function pagePromos() {
    var render = function () {
      var promos = HH.getPromos(), tours = HH.getTournaments();
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Khuyến mãi &amp; Giải đấu</h2></div><div class="card"><div class="tabs"><button data-tab="promo" class="' + (promoTab === 'promo' ? 'on' : '') + '">Mã khuyến mãi (' + promos.length + ')</button><button data-tab="tour" class="' + (promoTab === 'tour' ? 'on' : '') + '">Giải đấu (' + tours.length + ')</button></div>' +
        (promoTab === 'promo' ? '<div class="toolbar"><span class="muted grow">Mã không cộng dồn với giá giờ chót (flash sale). Cấu hình flash sale ở mục Cài đặt.</span><button class="btn btn-primary" id="pm-new">' + ic('plus', 16) + ' Thêm mã</button></div>' + (promos.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Chương trình</th><th>Mức giảm</th><th>Điều kiện</th><th>Hết hạn</th><th>Bật</th><th></th></tr></thead><tbody>' + promos.map(function (p) { return '<tr><td><b class="code" style="cursor:default">' + esc(p.code) + '</b></td><td>' + esc(p.title) + '</td><td>' + (p.type === 'percent' ? p.value + '%' + (p.maxDiscount ? ' (tối đa ' + money(p.maxDiscount) + ')' : '') : money(p.value)) + '</td><td>' + (p.minAmount ? 'Đơn từ ' + money(p.minAmount) : 'Không') + (p.offPeakOnly ? ' · giờ thấp điểm' : '') + '</td><td>' + (p.validTo ? HH.fmtDate(p.validTo) : '—') + '</td><td><label class="switch"><input type="checkbox" data-ptoggle="' + p.id + '" ' + (p.active ? 'checked' : '') + '><span></span></label></td><td><div class="act"><button class="btn btn-outline btn-sm btn-icon" data-pedit="' + p.id + '" title="Sửa">' + ic('pencil', 15) + '</button><button class="btn btn-outline btn-sm btn-icon" style="color:var(--bad)" data-pdel="' + p.id + '" title="Xóa">' + ic('trash-2', 15) + '</button></div></td></tr>'; }).join('') + '</tbody></table></div>' : empty('ticket', 'Chưa có mã khuyến mãi'))
          : '<div class="toolbar"><span class="muted grow">Giải đấu hiển thị ở trang Giải đấu của khách hàng.</span><button class="btn btn-primary" id="tr-new">' + ic('plus', 16) + ' Thêm giải đấu</button></div>' + (tours.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Giải đấu</th><th>Thời gian</th><th>Thể thức / sân</th><th class="num">Lệ phí</th><th>Số đội</th><th>Mở đăng ký</th><th></th></tr></thead><tbody>' + tours.map(function (t) { return '<tr><td><b>' + esc(t.name) + '</b></td><td class="nowrap">' + HH.fmtDate(t.startDate) + (t.endDate !== t.startDate ? ' – ' + HH.fmtDate(t.endDate) : '') + '</td><td>' + esc(t.format) + '<div class="hint">' + esc(t.venue) + '</div></td><td class="num">' + money(t.fee) + '</td><td>' + t.teams.length + '/' + t.maxTeams + '</td><td><label class="switch"><input type="checkbox" data-ttoggle="' + t.id + '" ' + (t.registrationOpen ? 'checked' : '') + '><span></span></label></td><td><div class="act"><button class="btn btn-outline btn-sm" data-tteams="' + t.id + '">Đội</button><button class="btn btn-outline btn-sm btn-icon" data-tedit="' + t.id + '" title="Sửa">' + ic('pencil', 15) + '</button><button class="btn btn-outline btn-sm btn-icon" style="color:var(--bad)" data-tdel="' + t.id + '" title="Xóa">' + ic('trash-2', 15) + '</button></div></td></tr>'; }).join('') + '</tbody></table></div>' : empty('trophy', 'Chưa có giải đấu'))) + '</div></div>';
    };
    render();
    on($view, 'click', '[data-tab]', function (e, b) { promoTab = b.dataset.tab; render(); });
    on($view, 'click', '#pm-new', function () { promoModal(null); });
    on($view, 'click', '[data-pedit]', function (e, b) { promoModal(b.dataset.pedit); });
    on($view, 'change', '[data-ptoggle]', function (e, el) { var l = HH.getPromos(), p = l.filter(function (x) { return x.id === el.dataset.ptoggle; })[0]; p.active = el.checked; HH.savePromos(l); toast('ok', (p.active ? 'Đã bật mã ' : 'Đã tắt mã ') + p.code); });
    on($view, 'click', '[data-pdel]', function (e, b) { var p = HH.getPromos().filter(function (x) { return x.id === b.dataset.pdel; })[0]; confirmBox('Xóa mã ' + esc(p.code) + '?', 'Mã sẽ không còn dùng được. Các đơn đã áp dụng mã vẫn giữ nguyên.', 'Xóa mã', true).then(function (ok) { if (ok) { HH.savePromos(HH.getPromos().filter(function (x) { return x.id !== p.id; })); toast('ok', 'Đã xóa mã ' + p.code); } }); });
    on($view, 'click', '#tr-new', function () { tourModal(null); });
    on($view, 'click', '[data-tedit]', function (e, b) { tourModal(b.dataset.tedit); });
    on($view, 'change', '[data-ttoggle]', function (e, el) { var l = HH.getTournaments(), t = l.filter(function (x) { return x.id === el.dataset.ttoggle; })[0]; t.registrationOpen = el.checked; HH.saveTournaments(l); toast('ok', t.registrationOpen ? 'Đã mở đăng ký' : 'Đã đóng đăng ký', [t.name]); });
    on($view, 'click', '[data-tdel]', function (e, b) { var t = HH.getTournaments().filter(function (x) { return x.id === b.dataset.tdel; })[0]; confirmBox('Xóa giải đấu?', '<b>' + esc(t.name) + '</b> cùng ' + t.teams.length + ' đội đã đăng ký sẽ bị xóa.', 'Xóa giải', true).then(function (ok) { if (ok) { HH.saveTournaments(HH.getTournaments().filter(function (x) { return x.id !== t.id; })); toast('ok', 'Đã xóa giải đấu'); } }); });
    on($view, 'click', '[data-tteams]', function (e, b) {
      var id = b.dataset.tteams, t = HH.getTournaments().filter(function (x) { return x.id === id; })[0];
      openModal({ title: 'Đội đăng ký: ' + esc(t.name), size: 'wide', body: '<div class="table-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th>#</th><th>Đội</th><th>SĐT</th><th>Cầu thủ</th><th>Lệ phí</th></tr></thead><tbody>' + t.teams.map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td>' + HH.fmtPhone(x.phone) + '</td><td>' + x.players + '</td><td><label class="check"><input type="checkbox" data-paid="' + i + '" ' + (x.paid ? 'checked' : '') + '> Đã đóng (mô phỏng)</label></td></tr>'; }).join('') + '</tbody></table></div>', foot: '<button class="btn btn-primary" data-close>Đóng</button>', onMount: function (el) {
        on(el, 'change', '[data-paid]', function (e2, c) { var l = HH.getTournaments(), tt = l.filter(function (x) { return x.id === id; })[0]; tt.teams[+c.dataset.paid].paid = c.checked; HH.saveTournaments(l); });
      } });
    });
    page = { onData: render };
  }
  function promoModal(id) {
    var p = id ? HH.getPromos().filter(function (x) { return x.id === id; })[0] : { code: '', title: '', desc: '', type: 'percent', value: 10, maxDiscount: 50000, minAmount: 0, offPeakOnly: false, active: true, validTo: HH.addDays(HH.todayStr(), 60) };
    openModal({ title: id ? 'Sửa mã ' + esc(p.code) : 'Thêm mã khuyến mãi', body: '<div class="form-grid"><div class="field"><label>Mã *</label><input class="input" id="pm-code" value="' + esc(p.code) + '" maxlength="20" style="text-transform:uppercase"></div><div class="field"><label>Loại giảm</label><select class="select" id="pm-type"><option value="percent" ' + (p.type === 'percent' ? 'selected' : '') + '>Phần trăm (%)</option><option value="amount" ' + (p.type === 'amount' ? 'selected' : '') + '>Số tiền (đ)</option></select></div><div class="field full"><label>Tên chương trình *</label><input class="input" id="pm-title" value="' + esc(p.title) + '" maxlength="80"></div><div class="field full"><label>Mô tả</label><input class="input" id="pm-desc" value="' + esc(p.desc) + '" maxlength="160"></div><div class="field"><label>Giá trị giảm *</label><input class="input" type="number" id="pm-value" value="' + p.value + '"></div><div class="field"><label>Giảm tối đa (đ)</label><input class="input" type="number" id="pm-max" value="' + (p.maxDiscount || 0) + '"></div><div class="field"><label>Đơn tối thiểu (đ)</label><input class="input" type="number" id="pm-min" value="' + (p.minAmount || 0) + '"></div><div class="field"><label>Hết hạn</label><input class="input" type="date" id="pm-to" value="' + (p.validTo || '') + '"></div><label class="check full"><input type="checkbox" id="pm-off" ' + (p.offPeakOnly ? 'checked' : '') + '>Chỉ áp dụng giờ thấp điểm</label></div><div id="pm-err" class="field-err mt8"></div>',
      foot: '<button class="btn btn-outline" data-close>Hủy</button><button class="btn btn-primary" id="pm-ok">Lưu</button>', onMount: function (el, api) {
        $('#pm-ok', el).onclick = function () {
          var code = $('#pm-code', el).value.trim().toUpperCase(), type = $('#pm-type', el).value, val = Number($('#pm-value', el).value), err = $('#pm-err', el), l = HH.getPromos();
          if (!/^[A-Z0-9]{4,20}$/.test(code)) { err.textContent = 'Mã gồm 4–20 chữ hoặc số, không dấu, không khoảng trắng.'; return; }
          if (l.some(function (x) { return x.code === code && x.id !== id; })) { err.textContent = 'Mã này đã tồn tại.'; return; }
          if ($('#pm-title', el).value.trim().length < 3) { err.textContent = 'Vui lòng nhập tên chương trình.'; return; }
          if (!Number.isFinite(val) || val <= 0 || (type === 'percent' && val > 100) || (type === 'amount' && val < 1000)) { err.textContent = type === 'percent' ? 'Phần trăm giảm phải từ 1 đến 100.' : 'Số tiền giảm tối thiểu 1.000đ.'; return; }
          var obj = { id: id || 'P' + Date.now().toString(36), code: code, title: $('#pm-title', el).value.trim(), desc: $('#pm-desc', el).value.trim(), type: type, value: val, maxDiscount: Math.max(0, Number($('#pm-max', el).value) || 0), minAmount: Math.max(0, Number($('#pm-min', el).value) || 0), offPeakOnly: $('#pm-off', el).checked, active: p.active, validFrom: p.validFrom || null, validTo: $('#pm-to', el).value || null };
          if (id) l = l.map(function (x) { return x.id === id ? obj : x; }); else l.push(obj);
          HH.savePromos(l); api.close(); toast('ok', id ? 'Đã cập nhật mã ' + code : 'Đã thêm mã ' + code);
        };
      } });
  }
  function tourModal(id) {
    var t = id ? HH.getTournaments().filter(function (x) { return x.id === id; })[0] : { name: '', format: 'Sân 7 người', venue: 'Sân V2 (có khán đài)', startDate: HH.addDays(HH.todayStr(), 21), endDate: HH.addDays(HH.todayStr(), 22), fee: 1000000, maxTeams: 8, prize: '', desc: '', livestream: false, registrationOpen: true, teams: [], image: 'assets/images/cup-1.svg' };
    openModal({ title: id ? 'Sửa giải đấu' : 'Thêm giải đấu', size: 'wide', body: '<div class="form-grid"><div class="field full"><label>Tên giải *</label><input class="input" id="tn-name" value="' + esc(t.name) + '" maxlength="80"></div><div class="field"><label>Thể thức</label><select class="select" id="tn-format"><option ' + (t.format === 'Sân 5 người' ? 'selected' : '') + '>Sân 5 người</option><option ' + (t.format === 'Sân 7 người' ? 'selected' : '') + '>Sân 7 người</option></select></div><div class="field"><label>Địa điểm</label><input class="input" id="tn-venue" value="' + esc(t.venue) + '"></div><div class="field"><label>Ngày bắt đầu</label><input class="input" type="date" id="tn-start" value="' + t.startDate + '"></div><div class="field"><label>Ngày kết thúc</label><input class="input" type="date" id="tn-end" value="' + t.endDate + '"></div><div class="field"><label>Lệ phí / đội (đ)</label><input class="input" type="number" id="tn-fee" value="' + t.fee + '" step="50000"></div><div class="field"><label>Số đội tối đa (hiện có ' + t.teams.length + ')</label><input class="input" type="number" id="tn-max" value="' + t.maxTeams + '"></div><div class="field full"><label>Giải thưởng</label><input class="input" id="tn-prize" value="' + esc(t.prize) + '"></div><div class="field full"><label>Mô tả</label><textarea class="textarea" id="tn-desc">' + esc(t.desc) + '</textarea></div><label class="check"><input type="checkbox" id="tn-live" ' + (t.livestream ? 'checked' : '') + '>Có livestream</label><label class="check"><input type="checkbox" id="tn-open" ' + (t.registrationOpen ? 'checked' : '') + '>Đang mở đăng ký</label></div><div id="tn-err" class="field-err mt8"></div>',
      foot: '<button class="btn btn-outline" data-close>Hủy</button><button class="btn btn-primary" id="tn-ok">Lưu</button>', onMount: function (el, api) {
        $('#tn-ok', el).onclick = function () {
          var err = $('#tn-err', el), name = $('#tn-name', el).value.trim(), s = $('#tn-start', el).value, e = $('#tn-end', el).value, fee = Number($('#tn-fee', el).value), max = parseInt($('#tn-max', el).value, 10);
          if (name.length < 3) { err.textContent = 'Vui lòng nhập tên giải.'; return; } if (!HH.isValidDateStr(s) || !HH.isValidDateStr(e)) { err.textContent = 'Ngày bắt đầu/kết thúc không hợp lệ.'; return; }
          if (e < s) { err.textContent = 'Ngày kết thúc phải sau hoặc cùng ngày bắt đầu.'; return; } if (!(fee >= 0)) { err.textContent = 'Lệ phí không hợp lệ.'; return; }
          if (!(max >= 2 && max <= 64)) { err.textContent = 'Số đội tối đa từ 2 đến 64.'; return; } if (max < t.teams.length) { err.textContent = 'Số đội tối đa không được nhỏ hơn số đội đã đăng ký (' + t.teams.length + ').'; return; }
          var obj = Object.assign({}, t, { id: id || 'T' + Date.now().toString(36), name: name, format: $('#tn-format', el).value, venue: $('#tn-venue', el).value.trim(), startDate: s, endDate: e, fee: fee, maxTeams: max, prize: $('#tn-prize', el).value.trim() || 'Quà tặng', desc: $('#tn-desc', el).value.trim(), livestream: $('#tn-live', el).checked, registrationOpen: $('#tn-open', el).checked });
          var l = HH.getTournaments(); if (id) l = l.map(function (x) { return x.id === id ? obj : x; }); else l.unshift(obj);
          HH.saveTournaments(l); api.close(); toast('ok', id ? 'Đã cập nhật giải đấu' : 'Đã thêm giải đấu');
        };
      } });
  }

  /* ======================================================================
     KHÁCH HÀNG
     ====================================================================== */
  var cu = { q: '' };
  function pageCustomers() {
    var render = function () {
      var q = cu.q.trim().toLowerCase(), list = HH.customers().filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0 || c.phone.indexOf(q) >= 0; }).sort(function (a, b) { return b.spent - a.spent; });
      $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Khách hàng</h2><span class="muted">' + list.length + ' khách (suy ra từ các đơn đặt sân)</span></div><div class="card"><div class="toolbar"><div class="search"><span>' + ic('search', 16) + '</span><input class="input" id="c-q" placeholder="Tìm tên hoặc số điện thoại…" value="' + esc(cu.q) + '"></div></div>' +
        (list.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Khách hàng</th><th>SĐT</th><th class="num">Số đơn</th><th class="num">Giờ chơi (90 ngày)</th><th class="num">Tổng chi tiêu</th><th>Hạng</th><th>Điểm uy tín</th><th></th></tr></thead><tbody>' + list.slice(0, 50).map(function (c) { return '<tr><td><b>' + esc(c.name) + '</b>' + (c.member ? ' <span class="chip ok">Thành viên</span>' : '') + '</td><td>' + HH.fmtPhone(c.phone) + '</td><td class="num">' + c.orders + (c.cancelled ? ' <span class="hint">(' + c.cancelled + ' hủy)</span>' : '') + '</td><td class="num">' + c.hours + 'h</td><td class="num">' + money(c.spent) + '</td><td>' + esc(c.tier.name) + '</td><td>' + (c.member ? '<b style="color:' + (c.reputation >= 80 ? 'var(--ok)' : (c.reputation >= 50 ? 'var(--warn)' : 'var(--bad)')) + '">' + c.reputation + '/100</b>' : '<span class="muted">—</span>') + '</td><td><button class="btn btn-outline btn-sm" data-cust="' + c.phone + '">Chi tiết</button></td></tr>'; }).join('') + '</tbody></table></div>' + (list.length > 50 ? '<p class="hint" style="padding:0 16px 12px">Hiển thị 50 khách chi tiêu cao nhất — dùng ô tìm kiếm để lọc.</p>' : '') : empty('users', 'Không tìm thấy khách hàng')) + '</div></div>';
      var e = $('#c-q'); e.oninput = HH.debounce(function () { cu.q = e.value; var p = e.selectionStart; render(); var n = $('#c-q'); n.focus(); n.setSelectionRange(p, p); }, 250);
    };
    render();
    on($view, 'click', '[data-cust]', function (e, b) { custModal(b.dataset.cust); });
    page = { onData: function () { var a = document.activeElement; if (a && a.id === 'c-q') return; render(); } };
  }
  function custModal(phone) {
    var c = HH.customers().filter(function (x) { return x.phone === phone; })[0], orders = HH.getBookings().filter(function (b) { return b.phone === phone; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 10), m = c.member;
    openModal({ title: esc(c.name) + ' · ' + HH.fmtPhone(phone), size: 'wide', body: '<div class="row wrap"><span class="chip">Hạng ' + esc(c.tier.name) + '</span><span class="chip">' + c.orders + ' đơn</span><span class="chip">' + money(c.spent) + ' đã chi</span>' + (m ? '<span class="chip ok">Uy tín ' + c.reputation + '/100</span>' : '<span class="chip muted">Chưa là thành viên</span>') + '</div>' +
      '<div class="card-title mt16">Đơn gần đây</div><div class="table-wrap" style="max-height:230px"><table class="tbl"><tbody>' + orders.map(function (b) { return '<tr><td><span class="code" data-order="' + b.id + '">' + b.id + '</span></td><td>' + b.courtId + ' · ' + HH.fmtDate(b.date) + ' ' + HH.fmtRange(b.startHour, b.endHour) + '</td><td class="num">' + money(b.totalAmount) + '</td><td>' + statusChip(b) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (m ? '<div class="card-title mt16">Điều chỉnh điểm uy tín (mô phỏng)</div><div class="row wrap"><input class="input" type="number" id="rp-d" placeholder="VD: -5 hoặc +2" style="width:130px"><input class="input grow" id="rp-r" placeholder="Lý do (bắt buộc)"><button class="btn btn-soft" id="rp-ok">Áp dụng</button></div><div id="rp-err" class="field-err mt8"></div><ul class="timeline mt8" style="max-height:140px;overflow:auto">' + m.reputationLog.slice().reverse().slice(0, 6).map(function (l) { return '<li><span class="delta ' + (l.delta > 0 ? 'pos' : (l.delta < 0 ? 'neg' : '')) + '">' + (l.delta > 0 ? '+' : '') + l.delta + '</span><span class="grow">' + esc(l.reason) + '</span><span class="hint">' + HH.fmtDate(l.date) + '</span></li>'; }).join('') + '</ul>' : ''),
      foot: '<button class="btn btn-primary" data-close>Đóng</button>', onMount: function (el, api) {
        on(el, 'click', '[data-order]', function (e, t) { showOrder(t.dataset.order); });
        var ok = $('#rp-ok', el); if (ok) ok.onclick = function () { var r = HH.adjustReputation(phone, $('#rp-d', el).value, $('#rp-r', el).value); if (!r.ok) { $('#rp-err', el).textContent = r.errors[0].message; return; } api.close(); toast('ok', 'Đã cập nhật điểm uy tín', ['Điểm mới: ' + HH.reputationOf(r.member) + '/100']); custModal(phone); };
      } });
  }

  /* ======================================================================
     CÀI ĐẶT + SAO LƯU / KHÔI PHỤC
     ====================================================================== */
  function pageSettings() {
    var cfg = HH.getConfig();
    var fl = function (label, id, v, extra) { return '<div class="field"><label for="' + id + '">' + label + '</label><input class="input" type="number" id="' + id + '" value="' + v + '" ' + (extra || '') + '></div>'; };
    var tiers = (cfg.flash.tiers || []).slice().sort(function (a, b) { return b.withinHours - a.withinHours; });
    var rp = function (h) { var x = cfg.refundPolicy.filter(function (r) { return r.hoursBefore === h; })[0]; return x ? x.percent : 0; };
    var usage = 0; try { Object.keys(HH.KEYS).forEach(function (k) { var v = localStorage.getItem(HH.KEYS[k]); if (v) usage += v.length; }); } catch (e) { /* bỏ qua */ }
    $view.innerHTML = '<div class="page-enter"><div class="pg-head"><h2>Cài đặt quy tắc &amp; dữ liệu</h2></div>' +
      '<div class="notice warn" style="margin-bottom:14px">' + ic('triangle-alert', 18) + '<div><b>Giới hạn của bản mô phỏng:</b> dữ liệu chỉ lưu trong <b>localStorage của trình duyệt này</b> (không đồng bộ giữa máy tính/điện thoại khác nhau), không bảo đảm chống đặt trùng tuyệt đối nếu nhiều người dùng ở nhiều thiết bị, và không phải hệ thống bảo mật. Dùng để trình diễn, không dùng kinh doanh thật.</div></div>' +
      '<div class="card card-pad"><form id="set-form"><div class="sec-title">Đặt cọc &amp; giữ chỗ</div><div class="settings-grid">' + fl('Cọc mặc định (%)', 's-dep', cfg.depositPercent, 'min="0" max="100"') + fl('Cọc khi uy tín thấp (%)', 's-dep2', cfg.lowReputationDepositPercent, 'min="0" max="100"') + fl('Ngưỡng uy tín thấp (điểm)', 's-thr', cfg.reputationThreshold, 'min="0" max="100"') + fl('Giữ chỗ chờ cọc (phút)', 's-hold', cfg.holdMinutes, 'min="1" max="120"') + fl('Tối đa giờ / đơn', 's-maxh', cfg.maxHoursPerBooking, 'min="1" max="8"') + fl('Đặt trước tối đa (ngày)', 's-adv', cfg.maxAdvanceDays, 'min="1" max="180"') + '</div>' +
      '<div class="row wrap mt16" style="gap:22px"><label class="check"><input type="checkbox" id="s-rel" ' + (cfg.autoReleaseHold ? 'checked' : '') + '>Tự nhả chỗ khi hết hạn giữ chỗ</label><label class="check"><input type="checkbox" id="s-auto" ' + (cfg.autoConfirmAfterDeposit ? 'checked' : '') + '>Tự xác nhận ngay khi khách báo đã cọc</label></div>' +
      '<div class="sec-title">Giá theo thời điểm</div><div class="settings-grid">' + fl('Giờ vàng từ (giờ)', 's-pf', cfg.peakFrom, 'min="0" max="23"') + fl('Giờ vàng đến (giờ)', 's-pt', cfg.peakTo, 'min="1" max="24"') + fl('Hệ số T7 – CN (×)', 's-wk', cfg.weekendFactor, 'step="0.05" min="1" max="3"') + '</div>' +
      '<div class="sec-title">Giá giờ chót (flash sale)</div><label class="check"><input type="checkbox" id="s-fl" ' + (cfg.flash.enabled ? 'checked' : '') + '>Bật flash sale tự động trong ngày</label><div class="settings-grid mt8">' + tiers.map(function (t, i) { return fl('Còn ≤ ' + t.withinHours + ' giờ: giảm (%)', 's-ft' + i, t.percent, 'min="0" max="90" data-within="' + t.withinHours + '"'); }).join('') + '</div><div class="hint mt8">Giá giảm không bao giờ thấp hơn giá sàn (giá giờ thường của sân).</div>' +
      '<div class="sec-title">Hoàn cọc khi hủy</div><div class="settings-grid">' + fl('Hủy trước 24 giờ: hoàn (%)', 's-r24', rp(24), 'min="0" max="100"') + fl('Hủy 24 giờ → 6 giờ: hoàn (%)', 's-r6', rp(6), 'min="0" max="100"') + '</div><div class="hint mt8">Hủy dưới 6 giờ: không hoàn cọc.</div>' +
      '<div class="sec-title">Tìm đối (sân màu tím) — quy tắc mô phỏng</div><label class="check"><input type="checkbox" id="s-sk" ' + (cfg.seek.enabled ? 'checked' : '') + '>Bật tính năng "Cần tìm đối"</label><div class="settings-grid mt8">' + fl('Hạn chót ghép (giờ)', 's-sd', cfg.seek.deadlineHour, 'min="0" max="23"') + fl('Chỉ cho trận từ (giờ)', 's-sm', cfg.seek.minStartHour, 'min="0" max="23"') + fl('Tối đa sân tìm đối / ngày', 's-sx', cfg.seek.maxPerDay, 'min="1" max="23"') + fl('Điểm uy tín tối thiểu', 's-sr', cfg.seek.minReputation, 'min="0" max="100"') + '</div>' +
      '<div class="sec-title">Giá dịch vụ đi kèm</div><div class="settings-grid">' + cfg.services.map(function (s, i) { return fl(esc(s.name) + ' (đ/' + esc(s.unit) + ')', 's-sv' + i, s.price, 'min="0" step="1000"'); }).join('') + '</div>' +
      '<div id="set-err" class="field-err mt16"></div><div class="row mt16"><button class="btn btn-primary" type="submit">' + ic('save', 16) + ' Lưu cài đặt</button><span class="hint">Áp dụng cho các đơn tạo sau khi lưu.</span></div></form></div>' +
      '<div class="card card-pad mt16"><div class="card-title">' + ic('database', 18) + ' Dữ liệu mô phỏng</div><p class="muted" style="margin-top:0">Đang dùng khoảng <b>' + (usage / 1024).toFixed(0) + ' KB</b> localStorage (' + HH.getBookings().length + ' đơn, ' + HH.getCourts().length + ' sân). Hai trang <code>index.html</code> và <code>admin.html</code> dùng chung các khóa <code>hh_*_v1</code>.</p><div class="row wrap"><button class="btn btn-outline" id="bk-exp">' + ic('download', 16) + ' Sao lưu ra file JSON</button><button class="btn btn-outline" id="bk-imp">' + ic('upload', 16) + ' Nhập file sao lưu</button><input type="file" id="bk-file" accept="application/json,.json" class="hide"><button class="btn btn-danger" id="bk-reset">' + ic('rotate-ccw', 16) + ' Khôi phục dữ liệu mẫu</button></div><p class="hint mt8">“Khôi phục dữ liệu mẫu” xóa mọi thay đổi (đơn mới, đổi giá, mã khuyến mãi…) và tạo lại dữ liệu mẫu tính theo ngày hôm nay.</p></div></div>';
    $('#set-form').onsubmit = function (e) {
      e.preventDefault();
      var n = function (id) { return Number($('#' + id).value); }, err = $('#set-err'), c = HH.clone(HH.getConfig());
      var chk = function (v, lo, hi, msg) { if (!Number.isFinite(v) || v < lo || v > hi) { err.textContent = msg; return false; } return true; };
      err.textContent = '';
      if (!chk(n('s-dep'), 0, 100, 'Cọc mặc định phải từ 0 đến 100%.') || !chk(n('s-dep2'), 0, 100, 'Cọc khi uy tín thấp phải từ 0 đến 100%.') || !chk(n('s-thr'), 0, 100, 'Ngưỡng uy tín từ 0 đến 100.') || !chk(n('s-hold'), 1, 120, 'Giữ chỗ từ 1 đến 120 phút.') || !chk(n('s-maxh'), 1, 8, 'Tối đa giờ mỗi đơn từ 1 đến 8.') || !chk(n('s-adv'), 1, 180, 'Đặt trước tối đa từ 1 đến 180 ngày.') || !chk(n('s-pf'), 0, 23, 'Giờ vàng bắt đầu từ 0 đến 23.') || !chk(n('s-pt'), 1, 24, 'Giờ vàng kết thúc từ 1 đến 24.') || !chk(n('s-wk'), 1, 3, 'Hệ số cuối tuần từ 1 đến 3.') || !chk(n('s-r24'), 0, 100, 'Phần trăm hoàn từ 0 đến 100.') || !chk(n('s-r6'), 0, 100, 'Phần trăm hoàn từ 0 đến 100.') || !chk(n('s-sd'), 0, 23, 'Hạn chót ghép từ 0 đến 23 giờ.') || !chk(n('s-sm'), 0, 23, 'Giờ tối thiểu từ 0 đến 23.') || !chk(n('s-sx'), 1, 23, 'Tối đa sân tìm đối từ 1 đến 23.') || !chk(n('s-sr'), 0, 100, 'Điểm uy tín tối thiểu từ 0 đến 100.')) return;
      if (n('s-pt') <= n('s-pf')) { err.textContent = 'Giờ vàng kết thúc phải sau giờ bắt đầu.'; return; }
      if (n('s-r6') > n('s-r24')) { err.textContent = 'Hoàn cọc khi hủy muộn không được cao hơn khi hủy sớm.'; return; }
      var ft = $$('[data-within]').map(function (x) { return { withinHours: +x.dataset.within, percent: Number(x.value) }; });
      if (ft.some(function (t) { return !Number.isFinite(t.percent) || t.percent < 0 || t.percent > 90; })) { err.textContent = 'Phần trăm flash sale từ 0 đến 90.'; return; }
      var sorted = ft.slice().sort(function (a, b) { return b.withinHours - a.withinHours; });
      for (var i = 1; i < sorted.length; i++) if (sorted[i].percent < sorted[i - 1].percent) { err.textContent = 'Càng sát giờ thì mức giảm không được thấp hơn (6h ≤ 3h ≤ 1h).'; return; }
      for (var j = 0; j < c.services.length; j++) { var pv = n('s-sv' + j); if (!Number.isFinite(pv) || pv < 0) { err.textContent = 'Giá dịch vụ không hợp lệ.'; return; } c.services[j].price = Math.round(pv); }
      c.depositPercent = n('s-dep'); c.lowReputationDepositPercent = n('s-dep2'); c.reputationThreshold = n('s-thr'); c.holdMinutes = n('s-hold'); c.maxHoursPerBooking = n('s-maxh'); c.maxAdvanceDays = n('s-adv');
      c.autoReleaseHold = $('#s-rel').checked; c.autoConfirmAfterDeposit = $('#s-auto').checked;
      c.peakFrom = n('s-pf'); c.peakTo = n('s-pt'); c.weekendFactor = n('s-wk');
      c.flash.enabled = $('#s-fl').checked; c.flash.tiers = ft;
      c.refundPolicy = [{ hoursBefore: 24, percent: n('s-r24') }, { hoursBefore: 6, percent: n('s-r6') }, { hoursBefore: 0, percent: 0 }];
      c.seek.enabled = $('#s-sk').checked; c.seek.deadlineHour = n('s-sd'); c.seek.minStartHour = n('s-sm'); c.seek.maxPerDay = n('s-sx'); c.seek.minReputation = n('s-sr');
      HH.saveConfig(c); toast('ok', 'Đã lưu cài đặt', ['Áp dụng cho các đơn tạo sau thời điểm này.']);
    };
    $('#bk-exp').onclick = function () { download('huyhoang-sao-luu-' + HH.todayStr() + '.json', HH.exportBackup(), 'application/json'); toast('ok', 'Đã tải file sao lưu'); };
    $('#bk-imp').onclick = function () { $('#bk-file').click(); };
    $('#bk-file').onchange = function () {
      var f = this.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { confirmBox('Nhập file sao lưu?', 'Dữ liệu hiện tại sẽ bị <b>thay thế</b> bởi nội dung file <b>' + esc(f.name) + '</b>.', 'Nhập dữ liệu', true).then(function (ok) { if (!ok) return; var r = HH.importBackup(String(rd.result)); if (r.ok) { toast('ok', 'Đã nhập dữ liệu sao lưu'); route(); } else toastErr(r, 'Không nhập được file'); }); };
      rd.readAsText(f); this.value = '';
    };
    $('#bk-reset').onclick = function () {
      confirmBox('Khôi phục dữ liệu mẫu?', '<p style="margin:0 0 8px">Thao tác này sẽ <b>xóa toàn bộ thay đổi mô phỏng đã lưu</b>: đơn đặt sân mới, trạng thái đơn, giá sân, mã khuyến mãi, giải đấu, thành viên… và nạp lại dữ liệu mẫu ban đầu.</p><p style="margin:0">Không thể hoàn tác (hãy sao lưu JSON trước nếu cần).</p>', 'Xóa & khôi phục', true).then(function (ok) { if (!ok) return; HH.resetAll(); toast('ok', 'Đã khôi phục dữ liệu mẫu'); route(); });
    };
    page = { onData: function () { /* không vẽ lại để không mất chỗ đang nhập */ } };
  }

  /* ======================================================================
     ĐỊNH TUYẾN
     ====================================================================== */
  /* Cổng đăng nhập quản trị (mô phỏng): admin / admin123, có nút dùng tài khoản demo */
  function adminGate() {
    var g = document.getElementById('admin-gate');
    if (!g) { g = document.createElement('div'); g.id = 'admin-gate'; document.body.appendChild(g); }
    g.innerHTML = '<form class="gate-card" id="gate-form"><img src="assets/images/logo.svg" alt="" width="54" height="54"><h2>Đăng nhập quản trị</h2><p class="muted">HUY HOÀNG Football Booking · bản mô phỏng</p>' +
      '<label>Tài khoản<input class="input" id="g-user" autocomplete="username" placeholder="admin"></label><label>Mật khẩu<input class="input" id="g-pass" type="password" autocomplete="current-password" placeholder="••••••••"></label>' +
      '<div class="field-err" id="g-err"></div><button class="btn btn-primary btn-block" type="submit">Đăng nhập</button><button class="btn btn-soft btn-block" type="button" id="g-demo">Dùng tài khoản demo</button><a class="gate-back" href="index.html">← Về trang khách hàng</a></form>';
    function ok(r) { if (r.ok) { g.remove(); route(); } else document.getElementById('g-err').textContent = r.message; }
    document.getElementById('gate-form').onsubmit = function (e) { e.preventDefault(); ok(HH.adminLogin(document.getElementById('g-user').value, document.getElementById('g-pass').value)); };
    document.getElementById('g-demo').onclick = function () { ok(HH.adminLogin(HH.ADMIN_ACCOUNT.user, HH.ADMIN_ACCOUNT.pass)); };
  }
  function route() {
    if (!HH.isAdmin()) { adminGate(); return; }
    var h = location.hash.replace(/^#/, '') || '/tong-quan', parts = h.split('?'), key = parts[0].split('/').filter(Boolean)[0] || 'tong-quan', q = parseQuery(parts[1]);
    page = null;
    var fresh = $view.cloneNode(false); $view.parentNode.replaceChild(fresh, $view); $view = fresh; // gỡ listener cũ
    window.scrollTo(0, 0);
    renderChrome(key);
    try {
      switch (key) {
        case 'tong-quan': pageDashboard(); break;
        case 'lich-san': pageSchedule(); break;
        case 'don-dat-san': pageOrders(q); break;
        case 'thanh-toan': pagePayments(); break;
        case 'quan-ly-san': pageCourts(); break;
        case 'tim-doi': pageSeek(); break;
        case 'khuyen-mai': pagePromos(); break;
        case 'khach-hang': pageCustomers(); break;
        case 'cai-dat': pageSettings(); break;
        default: renderChrome(''); $view.innerHTML = '<div class="card">' + empty('search', 'Không tìm thấy trang') + '</div>';
      }
    } catch (err) { console.error(err); $view.innerHTML = '<div class="card">' + empty('triangle-alert', 'Đã xảy ra lỗi hiển thị', '<span>' + esc(err.message) + '</span>') + '</div>'; }
  }
  window.addEventListener('hashchange', route);
  // Đồng bộ: đơn đổi từ trang khách hàng (tab khác) hoặc từ chính tab này -> vẽ lại
  HH.onChange(HH.debounce(function () {
    var key = (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0]) || 'tong-quan';
    renderChrome(key);
    if (page && page.onData) { try { page.onData(); } catch (e) { console.error(e); } }
  }, 80));
  route();
})();
