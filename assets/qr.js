/*
 * Bộ tạo mã QR nhỏ gọn (viết riêng cho dự án, không cần thư viện ngoài).
 * - Chế độ byte, mức sửa lỗi M, phiên bản 1–6 (tối đa ~106 ký tự).
 * - Dùng: HH.qrSvg('nội dung', {size:200, margin:2, dark:'#0b1f14', light:'#fff'})
 * Lưu ý: mã sinh ra là QR thật (quét được) nhưng nội dung chỉ là chuỗi minh họa,
 * KHÔNG phải mã thanh toán ngân hàng thật.
 */
(function (g) {
  'use strict';
  var HH = g.HH = g.HH || {};

  // [tổng codeword, codeword sửa lỗi mỗi khối, [[số khối, data mỗi khối], ...]] — mức M, phiên bản 1..6
  var VERSIONS = [
    null,
    [26, 10, [[1, 16]]],
    [44, 16, [[1, 28]]],
    [70, 26, [[1, 44]]],
    [100, 18, [[2, 32]]],
    [134, 24, [[2, 43]]],
    [172, 16, [[4, 27]]]
  ];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

  // ---- Toán trên trường Galois GF(256) ----
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenerator(deg) {
    var poly = [1];
    for (var i = 0; i < deg; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = data.concat(new Array(ecLen).fill(0));
    for (var i = 0; i < data.length; i++) {
      var coef = res[i];
      if (coef !== 0) for (var j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], coef);
    }
    return res.slice(data.length);
  }

  function utf8Bytes(str) {
    var out = [], s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function buildCodewords(bytes, ver) {
    var info = VERSIONS[ver], groups = info[2], ecLen = info[1];
    var dataCap = 0; groups.forEach(function (gr) { dataCap += gr[0] * gr[1]; });
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, 8);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCap * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var pad = [0xec, 0x11], pi = 0;
    while (bits.length < cap) { put(pad[pi++ % 2], 8); }
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0; for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k]; cw.push(v);
    }
    // chia khối + tính mã sửa lỗi
    var blocks = [], pos = 0;
    groups.forEach(function (gr) {
      for (var b = 0; b < gr[0]; b++) {
        var d = cw.slice(pos, pos + gr[1]); pos += gr[1];
        blocks.push({ data: d, ec: rsEncode(d, ecLen) });
      }
    });
    var out = [], maxData = 0;
    blocks.forEach(function (b) { if (b.data.length > maxData) maxData = b.data.length; });
    for (var x = 0; x < maxData; x++) blocks.forEach(function (b) { if (x < b.data.length) out.push(b.data[x]); });
    for (var y = 0; y < ecLen; y++) blocks.forEach(function (b) { out.push(b.ec[y]); });
    return out;
  }

  function bchFormat(data) { // data 5 bit -> 15 bit
    var d = data << 10;
    for (var i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= 0x537 << (i - 10);
    return ((data << 10) | d) ^ 0x5412;
  }

  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
  ];

  function penalty(m, n) {
    var p = 0, r, c, run, i;
    for (r = 0; r < n; r++) { // chạy ngang
      run = 1;
      for (c = 1; c < n; c++) { if (m[r][c] === m[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
    }
    for (c = 0; c < n; c++) {
      run = 1;
      for (r = 1; r < n; r++) { if (m[r][c] === m[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
    }
    for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) { // khối 2x2
      var v = m[r][c]; if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
    }
    var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function match(arr, pat) { for (var q = 0; q < pat.length; q++) if (arr[q] !== pat[q]) return false; return true; }
    for (r = 0; r < n; r++) for (c = 0; c <= n - 11; c++) {
      var row = m[r].slice(c, c + 11); if (match(row, pat1) || match(row, pat2)) p += 40;
    }
    for (c = 0; c < n; c++) for (r = 0; r <= n - 11; r++) {
      var col = []; for (i = 0; i < 11; i++) col.push(m[r + i][c]);
      if (match(col, pat1) || match(col, pat2)) p += 40;
    }
    var dark = 0; for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) dark++;
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  function makeMatrix(text) {
    var bytes = utf8Bytes(text), ver = 0;
    for (var v = 1; v <= 6; v++) {
      var cap = 0; VERSIONS[v][2].forEach(function (gr) { cap += gr[0] * gr[1]; });
      if (bytes.length + 2 <= cap) { ver = v; break; } // 4 bit mode + 8 bit độ dài ≈ 2 byte
    }
    if (!ver) throw new Error('Nội dung QR quá dài');
    var n = 17 + 4 * ver, i, j;
    var mod = [], fn = []; // mod: giá trị, fn: là vùng chức năng (không bị che mặt nạ)
    for (i = 0; i < n; i++) { mod.push(new Array(n).fill(0)); fn.push(new Array(n).fill(false)); }
    function setF(r, c, val) { if (r >= 0 && c >= 0 && r < n && c < n) { mod[r][c] = val ? 1 : 0; fn[r][c] = true; } }
    function finder(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        var val = inRing && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setF(r0 + dr, c0 + dc, val);
      }
    }
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (i = 8; i < n - 8; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    var al = ALIGN[ver];
    for (i = 0; i < al.length; i++) for (j = 0; j < al.length; j++) {
      var ar = al[i], ac = al[j];
      if (fn[ar][ac]) continue; // trùng bộ định vị
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++)
        setF(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    setF(n - 8, 8, true); // ô tối cố định
    for (i = 0; i < 9; i++) { if (!fn[8][i]) setF(8, i, false); if (!fn[i][8]) setF(i, 8, false); }
    for (i = 0; i < 8; i++) { if (!fn[8][n - 1 - i]) setF(8, n - 1 - i, false); if (!fn[n - 1 - i][8]) setF(n - 1 - i, 8, false); }
    mod[n - 8][8] = 1;

    // đặt dữ liệu theo đường zigzag
    var cw = buildCodewords(bytes, ver), bitsArr = [];
    cw.forEach(function (b) { for (var k = 7; k >= 0; k--) bitsArr.push((b >> k) & 1); });
    var bi = 0, up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var t = 0; t < n; t++) {
        var r = up ? n - 1 - t : t;
        for (var cc = 0; cc < 2; cc++) {
          var c = col - cc;
          if (!fn[r][c]) { mod[r][c] = bi < bitsArr.length ? bitsArr[bi++] : 0; }
        }
      }
      up = !up;
    }

    function withMask(mk) {
      var m = mod.map(function (row) { return row.slice(); });
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (!fn[r][c] && MASKS[mk](r, c)) m[r][c] ^= 1;
      var f = bchFormat((0 << 3) | mk); // mức M = 00
      for (var k = 0; k < 15; k++) {
        var bit = (f >> k) & 1;
        // bản sao 1 quanh bộ định vị trái-trên
        if (k < 6) m[k][8] = bit; else if (k < 8) m[k + 1][8] = bit; else if (k === 8) m[8][7] = bit; else m[8][14 - k] = bit;
        // bản sao 2
        if (k < 8) m[8][n - 1 - k] = bit; else m[n - 15 + k][8] = bit;
      }
      m[n - 8][8] = 1;
      return m;
    }
    var best = null, bestP = 1e9;
    for (var mk = 0; mk < 8; mk++) {
      var cand = withMask(mk), pn = penalty(cand, n);
      if (pn < bestP) { bestP = pn; best = cand; }
    }
    return best;
  }

  HH.qrMatrix = makeMatrix;
  HH.qrSvg = function (text, opt) {
    opt = opt || {};
    var m = makeMatrix(text), n = m.length, margin = opt.margin == null ? 2 : opt.margin, size = opt.size || 200;
    var dark = opt.dark || '#0b1f14', light = opt.light || '#ffffff', d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) d += 'M' + (c + margin) + ' ' + (r + margin) + 'h1v1h-1z';
    var total = n + margin * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="Mã QR minh họa"><rect width="' + total + '" height="' + total + '" fill="' + light + '"/><path d="' + d + '" fill="' + dark + '"/></svg>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
