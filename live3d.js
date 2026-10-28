/* ==========================================================================
   HUY HOÀNG — live3d.js
   Trận đấu "livestream" MÔ PHỎNG dạng 3D (CSS 3D, không cần thư viện):
   sân nghiêng có phối cảnh, cầu thủ dựng đứng (billboard), bóng có độ cao, tỉ số, đồng hồ chạy trực tiếp,
   đội đang cầm bóng, cú sút nguy hiểm, thống kê và đổi góc nhìn camera.
   Dữ liệu trận là NGẪU NHIÊN do máy tính tạo ra — không phải video thật.
   Dùng: var live = HH.live3D(element, { teamA: 'Tên A', teamB: 'Tên B', title: '...' });  live.stop();
   ========================================================================== */
(function (global) {
  'use strict';
  var HH = global.HH = global.HH || {};
  var W = 640, H = 380;                         // kích thước sân (đơn vị pixel của cảnh 3D)
  var NAMES = ['Quân', 'Bảo', 'Huy', 'Khoa', 'Nam', 'Vinh', 'Tú', 'Long', 'Phúc', 'Đạt', 'Sơn', 'Kiệt', 'Thịnh', 'Hải', 'Dũng', 'Tuấn', 'Minh', 'Lâm', 'Trí', 'Khang'];
  var FORM = [[34, 190, 'GK'], [118, 78, 'DF'], [118, 190, 'DF'], [118, 302, 'DF'], [250, 122, 'MF'], [250, 258, 'MF'], [372, 190, 'FW']]; // đội A tấn công sang phải
  var CAMS = { stand: { rx: 56, rz: 0, k: 1, label: 'Khán đài' }, top: { rx: 14, rz: 0, k: 1, label: 'Trên cao' }, goal: { rx: 54, rz: -90, k: .66, label: 'Sau gôn' } };
  function esc(s) { return HH.esc ? HH.esc(s) : String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  HH.live3D = function (root, opts) {
    opts = opts || {};
    if (root.__live) root.__live.stop();
    var names = [opts.teamA || 'Đoàn Kết FC', opts.teamB || 'Phố Núi FC'], colors = ['#ef3b2d', '#2f8cff'], stopped = false, raf = 0, tmr = 0;
    var S;
    function fresh() {
      S = { score: [0, 0], shots: [0, 0], onT: [0, 0], danger: [0, 0], poss: [1, 1], clock: 8 * 60, half: 1, speed: 26, last: 0, pause: 0, holder: null, ball: { x: W / 2, y: H / 2, h: 0, tx: W / 2, ty: H / 2, th: 0, spd: 0 }, mode: 'play', until: 0, passAt: 0, team: 0, players: [], feed: [], ended: false, ht: false };
      var used = {};
      for (var t = 0; t < 2; t++) for (var i = 0; i < 7; i++) {
        var nm; do { nm = pick(NAMES); } while (used[nm]); used[nm] = 1;
        var f = FORM[i], bx = t === 0 ? f[0] : W - f[0], by = f[1];
        S.players.push({ team: t, role: f[2], base: { x: bx, y: by }, x: bx, y: by, name: nm, no: i === 0 ? 1 : [0, 0, 4, 5, 8, 10, 9][i] + (t ? 0 : 0), ph: Math.random() * 6 });
      }
      S.players[0].no = 1; S.players[7].no = 1;
      S.players[1].no = 2; S.players[2].no = 4; S.players[3].no = 3; S.players[4].no = 8; S.players[5].no = 6; S.players[6].no = 9;
      for (var k = 8; k < 14; k++) S.players[k].no = S.players[k - 7].no;
      S.holder = S.players[2]; S.ball.x = S.holder.x + 10; S.ball.y = S.holder.y;
    }
    fresh();

    /* ---------- Dựng giao diện ---------- */
    root.innerHTML = '<div class="l3">' +
      '<div class="l3-top"><div class="l3-team"><i style="background:' + colors[0] + '"></i><b>' + esc(names[0]) + '</b></div><div class="l3-score"><span id="l3-a">0</span><em>:</em><span id="l3-b">0</span></div><div class="l3-team r"><b>' + esc(names[1]) + '</b><i style="background:' + colors[1] + '"></i></div></div>' +
      '<div class="l3-clockbar"><span class="l3-live"><i></i> LIVE · MÔ PHỎNG</span><span id="l3-clock" class="l3-clock">HIỆP 1 · 08:00</span><span id="l3-hold" class="l3-hold"></span></div>' +
      '<div class="l3-stage" id="l3-stage"><div class="l3-cam" id="l3-cam"><div class="l3-field" id="l3-field">' +
      '<div class="l3-line mid"></div><div class="l3-circle"></div><div class="l3-box l"></div><div class="l3-box r"></div>' +
      '<div class="l3-goal l"><b></b></div><div class="l3-goal r"><b></b></div></div></div>' +
      '<div class="l3-banner" id="l3-banner"></div><div class="l3-cams" id="l3-cams">' + Object.keys(CAMS).map(function (k) { return '<button data-cam="' + k + '" class="' + (k === 'stand' ? 'on' : '') + '">' + CAMS[k].label + '</button>'; }).join('') + '</div></div>' +
      '<div class="l3-stats"><div class="l3-poss"><span id="l3-pa">50%</span><div><i id="l3-pbar" style="width:50%;background:' + colors[0] + '"></i></div><span id="l3-pb">50%</span></div>' +
      '<div class="l3-nums"><div><b id="l3-s0">0</b><small>Sút</small><b id="l3-s1">0</b></div><div><b id="l3-t0">0</b><small>Trúng đích</small><b id="l3-t1">0</b></div><div><b id="l3-d0">0</b><small>Nguy hiểm</small><b id="l3-d1">0</b></div></div></div>' +
      '<ul class="l3-feed" id="l3-feed"></ul><p class="l3-note">Trận đấu do máy tính mô phỏng ngẫu nhiên để minh họa tính năng livestream — không phải video thật.</p></div>';
    var $ = function (id) { return root.querySelector('#' + id); };
    var field = $('l3-field'), cam = $('l3-cam'), stage = $('l3-stage'), banner = $('l3-banner');
    S.players.forEach(function (p) {
      var el = document.createElement('div'); el.className = 'l3-pl t' + p.team + (p.role === 'GK' ? ' gk' : '');
      el.innerHTML = '<span class="sh"></span><div class="bd"><i class="hd"></i><i class="tr" style="background:' + (p.role === 'GK' ? '#f6c90e' : colors[p.team]) + '"><em>' + p.no + '</em></i><i class="lg"></i><u>' + esc(p.name) + '</u></div>';
      field.appendChild(el); p.el = el;
    });
    var ballEl = document.createElement('div'); ballEl.className = 'l3-ball'; ballEl.innerHTML = '<span class="sh"></span><div class="bd"><i></i></div>'; field.appendChild(ballEl);
    var holdMark = document.createElement('div'); holdMark.className = 'l3-mark'; field.appendChild(holdMark);
    function fit() { var sc = Math.min(1.25, Math.max(.5, stage.clientWidth / (W + 90))); stage.style.setProperty('--sc', sc.toFixed(3)); }
    fit(); var onResize = function () { fit(); }; global.addEventListener('resize', onResize);
    root.onclick = function (e) {
      if (e.target.closest('[data-replay]')) { fresh2(); return; }
      var b = e.target.closest('[data-cam]'); if (!b) return; var c = CAMS[b.dataset.cam];
      cam.style.setProperty('--rx', c.rx + 'deg'); cam.style.setProperty('--rz', c.rz + 'deg'); cam.style.setProperty('--k', c.k);
      Array.prototype.forEach.call(root.querySelectorAll('[data-cam]'), function (x) { x.classList.toggle('on', x === b); });
    };

    /* ---------- Tiện ích trận đấu ---------- */
    function mm() { var s = Math.floor(S.clock); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
    function minute() { return Math.floor(S.clock / 60) + 1; }
    function log(icon, txt, cls) {
      S.feed.unshift('<li class="' + (cls || '') + '"><time>' + minute() + '\'</time><span>' + icon + ' ' + txt + '</span></li>'); S.feed.length = Math.min(S.feed.length, 6);
      $('l3-feed').innerHTML = S.feed.join('');
    }
    function flash(txt, cls) { banner.className = 'l3-banner'; void banner.offsetWidth; banner.textContent = txt; banner.className = 'l3-banner show ' + (cls || ''); }
    function attackGoal(team) { return { x: team === 0 ? W : 0, y: H / 2 }; }
    function teamPlayers(t) { return S.players.filter(function (p) { return p.team === t; }); }
    function setBall(x, y, spd, h) { S.ball.tx = x; S.ball.ty = y; S.ball.spd = spd || 360; S.ball.th = h || 0; }
    function giveTo(p, now) { S.holder = p; S.team = p.team; setBall(p.x + (p.team ? -9 : 9), p.y, 300, 0); S.passAt = now + rnd(600, 1100); }

    function shoot(now) {
      var p = S.holder, t = p.team, g = attackGoal(t), roll = Math.random(), res, ty;
      S.shots[t]++; S.mode = 'shot'; S.holder = null;
      if (roll < .30) res = 'goal'; else if (roll < .62) res = 'save'; else if (roll < .78) res = 'wide'; else if (roll < .90) res = 'post'; else res = 'block';
      var spd = Math.round(rnd(58, 96));
      if (res === 'goal' || res === 'save' || res === 'post') { S.onT[t]++; S.danger[t]++; flash('⚠ CÚ SÚT NGUY HIỂM! ' + spd + ' km/h', 'warn'); log('⚠️', '<b>Cú sút nguy hiểm!</b> ' + esc(p.name) + ' (' + esc(names[t]) + ') dứt điểm ' + spd + ' km/h', 'warn'); }
      else { log('🥅', esc(p.name) + ' (' + esc(names[t]) + ') ' + (res === 'wide' ? 'sút chệch cột dọc' : 'bị chặn lại'), ''); }
      ty = res === 'goal' ? (Math.random() < .5 ? H / 2 - 52 : H / 2 + 52) : (res === 'post' ? H / 2 + (Math.random() < .5 ? -40 : 40) : (res === 'wide' ? H / 2 + (Math.random() < .5 ? -100 : 100) : H / 2 + rnd(-20, 20)));
      var gk = S.players.filter(function (q) { return q.team !== t && q.role === 'GK'; })[0];
      S.shot = { res: res, team: t, shooter: p, gk: gk, gy: ty };
      var tx = res === 'block' ? p.x + (t ? -60 : 60) : (res === 'save' ? g.x + (t ? 22 : -22) : g.x + (t ? -4 : 4));
      setBall(tx, ty, 640, res === 'goal' ? 18 : (res === 'save' ? 12 : 22));
      S.until = now + 1100;
    }
    function resolveShot(now) {
      var s = S.shot, t = s.team, opp = 1 - t, def = teamPlayers(opp);
      S.mode = 'play';
      if (s.res === 'goal') {
        S.score[t]++; $('l3-a').textContent = S.score[0]; $('l3-b').textContent = S.score[1];
        flash('GOOOL! ' + S.score[0] + ' - ' + S.score[1], 'goal'); log('⚽', '<b>VÀO!</b> ' + esc(s.shooter.name) + ' ghi bàn cho ' + esc(names[t]) + ' — ' + S.score[0] + '-' + S.score[1], 'goal');
        S.mode = 'pause'; S.until = now + 2200; S.restart = opp; setBall(W / 2, H / 2, 500, 0);
      } else if (s.res === 'save') {
        log('🧤', 'Thủ môn ' + esc(s.gk.name) + ' (' + esc(names[opp]) + ') cứu thua xuất thần!', ''); flash('CỨU THUA!', 'save'); giveTo(s.gk, now);
      } else if (s.res === 'post') {
        log('🧱', 'Bóng dội cột dọc! Suýt nữa thì vào', ''); flash('TRÚNG CỘT DỌC!', 'save'); giveTo(def[2 + Math.floor(Math.random() * 2)], now);
      } else { giveTo(s.res === 'wide' ? s.gk : def[1 + Math.floor(Math.random() * 3)], now); }
      S.shot = null;
    }
    function nearestOf(team, pt, skip) { var best = null, bd = 1e9; teamPlayers(team).forEach(function (p) { if (p === skip) return; var d = dist(p, pt); if (d < bd) { bd = d; best = p; } }); return best; }

    function decide(now) {
      var h = S.holder; if (!h) return;
      var t = h.team, g = attackGoal(t), inFinal = Math.abs(h.x - g.x) < 250;
      if (Math.random() < .18) { var thief = nearestOf(1 - t, h, null); if (thief.role !== 'GK' || Math.random() < .3) { giveTo(thief, now); return; } }
      if (inFinal && h.role !== 'GK' && Math.random() < .7) { shoot(now); return; }
      var mates = teamPlayers(t).filter(function (p) { return p !== h; });
      var fwd = mates.filter(function (p) { return t === 0 ? p.x > h.x - 20 : p.x < h.x + 20; });
      var to = pick(fwd.length && Math.random() < .75 ? fwd : mates); S.holder = null; S.pass = { to: to };
      setBall(to.x + (t ? -9 : 9), to.y, 330, 0); S.mode = 'pass'; S.until = now + Math.max(400, dist(h, to) / 330 * 1000);
    }

    /* ---------- Vòng lặp ---------- */
    function tick(ts) {
      if (stopped) return; raf = global.requestAnimationFrame(tick);
      if (!S.last) S.last = ts; var dt = Math.min(.05, (ts - S.last) / 1000); S.last = ts, now = ts;
      var b = S.ball;
      if (!S.ended) {
        if (S.mode !== 'pause' && !S.ht) S.clock += dt * S.speed;
        if (S.half === 1 && S.clock >= 20 * 60 && !S.ht) { S.ht = true; S.mode = 'pause'; S.until = ts + 2500; S.half1 = true; flash('HẾT HIỆP 1', 'save'); log('⏱️', 'Kết thúc hiệp 1: ' + S.score[0] + '-' + S.score[1], ''); }
        if (S.half === 2 && S.clock >= 40 * 60) { S.ended = true; S.mode = 'end'; flash('HẾT GIỜ ' + S.score[0] + '-' + S.score[1], 'goal'); log('🏁', '<b>Hết giờ!</b> ' + esc(S.score[0] > S.score[1] ? names[0] + ' thắng' : (S.score[1] > S.score[0] ? names[1] + ' thắng' : 'Hai đội hòa')) + ' ' + S.score[0] + '-' + S.score[1], 'goal'); $('l3-cams').insertAdjacentHTML('beforeend', '<button data-replay="1" class="again">↻ Xem lại</button>'); }
      }
      if (!S.ended) {
        if (S.mode === 'pause' && ts >= S.until) {
          if (S.ht) { S.ht = false; S.half = 2; S.clock = 20 * 60; }
          S.mode = 'play'; var st = S.restart != null ? S.restart : (S.ht ? 0 : Math.round(Math.random())); S.restart = null;
          var kp = teamPlayers(st)[5]; kp.x = W / 2 + (st ? 10 : -10); kp.y = H / 2; b.x = W / 2; b.y = H / 2; giveTo(kp, ts);
        } else if (S.mode === 'play' && S.holder && ts >= S.passAt) decide(ts);
        else if (S.mode === 'pass' && ts >= S.until) { var to = S.pass.to; S.pass = null; S.mode = 'play'; giveTo(to, ts); }
        else if (S.mode === 'shot' && ts >= S.until) resolveShot(ts);
      }
      // bóng bay tới đích
      var dx = b.tx - b.x, dy = b.ty - b.y, dd = Math.hypot(dx, dy), stp = b.spd * dt;
      if (dd > 1) { var k = Math.min(1, stp / dd); b.x += dx * k; b.y += dy * k; }
      var hTarget = (S.mode === 'pass') ? Math.min(22, dd * .22) : b.th; b.h += (hTarget - b.h) * Math.min(1, dt * 10);
      // cầu thủ chạy theo thế trận
      var team = S.holder ? S.holder.team : (S.mode === 'pass' && S.pass ? S.pass.to.team : S.team);
      S.players.forEach(function (p) {
        var push = (p.team === team ? 70 : 20) * (p.team === 0 ? 1 : -1), shift = (b.x - W / 2) * .34;
        var tx = p.base.x + shift + (p.role === 'GK' ? -shift * .9 : push) + Math.sin(ts / 900 + p.ph) * 14, ty = p.base.y + (b.y - H / 2) * .22 + Math.cos(ts / 1100 + p.ph) * 12;
        if (p.role === 'GK') { tx = p.base.x; ty = H / 2 + Math.max(-70, Math.min(70, (b.y - H / 2) * .5)); if (S.shot && S.shot.gk === p) { ty = S.shot.res === 'save' ? S.shot.gy : S.shot.gy + (S.shot.gy < H / 2 ? 36 : -36); } }
        if (S.holder === p) { tx = p.x + (p.team ? -30 : 30) * dt * 2 + 0; ty = p.y; tx = p.x + (p.team ? -1 : 1) * 22 * dt; }
        if (S.mode === 'pass' && S.pass && S.pass.to === p) { tx = b.tx; ty = b.ty; }
        var spd = (S.mode === 'shot' && p.role !== 'GK') ? 10 : 70; p.x += Math.max(-spd * dt, Math.min(spd * dt, tx - p.x)); p.y += Math.max(-spd * dt, Math.min(spd * dt, ty - p.y));
        p.x = Math.max(8, Math.min(W - 8, p.x)); p.y = Math.max(10, Math.min(H - 10, p.y));
        p.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0)';
      });
      if (S.holder && S.mode === 'play') { b.tx = S.holder.x + (S.holder.team ? -9 : 9); b.ty = S.holder.y; b.spd = 220; }
      ballEl.style.transform = 'translate3d(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px,0)'; ballEl.querySelector('.bd').style.transform = 'rotateZ(calc(var(--rz) * -1)) rotateX(calc(var(--rx) * -1)) translateY(' + (-b.h).toFixed(1) + 'px)';
      var sh = ballEl.querySelector('.sh'); sh.style.opacity = Math.max(.25, 1 - b.h / 40); sh.style.transform = 'scale(' + (1 - b.h / 80).toFixed(2) + ')';
      if (S.holder) { holdMark.style.display = 'block'; holdMark.style.transform = 'translate3d(' + S.holder.x.toFixed(1) + 'px,' + S.holder.y.toFixed(1) + 'px,0)'; holdMark.style.borderColor = colors[S.holder.team]; } else holdMark.style.display = 'none';
      // bảng điểm / thống kê (cập nhật ~10 lần/giây)
      if (ts - (S.ui || 0) > 100) {
        S.ui = ts; if (S.holder) S.poss[S.holder.team] += .1;
        $('l3-clock').textContent = (S.ended ? 'HẾT GIỜ' : (S.ht ? 'NGHỈ GIỮA HIỆP' : 'HIỆP ' + S.half)) + ' · ' + mm();
        var pa = Math.round(S.poss[0] / (S.poss[0] + S.poss[1]) * 100); $('l3-pa').textContent = pa + '%'; $('l3-pb').textContent = (100 - pa) + '%'; $('l3-pbar').style.width = pa + '%';
        ['s', 't', 'd'].forEach(function (k, i) { var arr = [S.shots, S.onT, S.danger][i]; $('l3-' + k + '0').textContent = arr[0]; $('l3-' + k + '1').textContent = arr[1]; });
        var hl = $('l3-hold'); if (S.holder) hl.innerHTML = '<i style="background:' + colors[S.holder.team] + '"></i> Đang cầm bóng: <b>' + esc(S.holder.name) + ' #' + S.holder.no + '</b> (' + esc(names[S.holder.team]) + ')'; else if (S.mode === 'shot') hl.innerHTML = '<b>⚽ Cú sút!</b>'; else if (S.mode === 'pass') hl.innerHTML = 'Chuyền bóng…';
      }
    }
    var now = 0; raf = global.requestAnimationFrame(tick);
    function fresh2() { HH.live3D(root, { teamA: names[0], teamB: names[1] }); }
    var api = { stop: function () { stopped = true; global.cancelAnimationFrame(raf); global.removeEventListener('resize', onResize); if (root.__live === api) root.__live = null; } };
    root.__live = api; return api;
  };
})(window);
