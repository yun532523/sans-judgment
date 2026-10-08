// render.js — all drawing: pixel sprites, bones, blasters, box, HUD, hall, post FX
(function () {
  const G = window.G;
  const S = 1.5, OX = 160, OY = 0, SW = 1280, SH = 720;
  const PI = Math.PI, clamp = G.clamp;
  const R = G.R = {};
  const COL = { white: '#fff', blue: '#22b4ff', orange: '#ff9a1f', red: '#ff0000', yellow: '#ffff00', ui: '#ff7f27', kr: '#ff00ff', green: '#3cff3c' };
  R.COL = COL;

  // ---------------------------------------------------------------- canvases
  const scene = document.createElement('canvas'); scene.width = SW; scene.height = SH;
  const ctx = scene.getContext('2d');
  const bloom = document.createElement('canvas'); bloom.width = 320; bloom.height = 180;
  const bctx = bloom.getContext('2d');
  R.init = function (out) { R.out = out; R.octx = out.getContext('2d'); };
  const world = () => ctx.setTransform(S, 0, 0, S, OX, OY);
  const screen = () => ctx.setTransform(1, 0, 0, 1, 0, 0);
  R.toScreen = (x, y) => [OX + x * S, OY + y * S];

  // ---------------------------------------------------------------- pixel text
  const TX = new Map();
  const CJK = '"Zpix","Fusion Pixel 12px M zh_hans","SimSun","NSimSun","Songti SC","Noto Sans SC","Microsoft YaHei",sans-serif';
  R.HEI = '"SimHei","Microsoft YaHei",sans-serif';
  const LAT = '"Press Start 2P","Courier New",monospace';
  function textCanvas(str, size, color, font) {
    const key = str + '|' + size + '|' + color + '|' + font;
    let c = TX.get(key);
    if (c) return c;
    if (TX.size > 600) TX.clear();
    c = document.createElement('canvas');
    const x = c.getContext('2d');
    x.font = `${size}px ${font}`;
    const w = Math.max(1, Math.ceil(x.measureText(str).width) + 2), h = Math.ceil(size * 1.25) + 2;
    c.width = w; c.height = h;
    x.font = `${size}px ${font}`; x.textBaseline = 'top'; x.fillStyle = color;
    x.fillText(str, 1, 1);
    const im = x.getImageData(0, 0, w, h), d = im.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 92 ? 255 : 0;
    x.putImageData(im, 0, 0);
    TX.set(key, c);
    return c;
  }
  // built-in 5x7 bitmap font for Latin/digits (bold), no web font needed
  const F57 = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.',
    D: '####.|#...#|#...#|#...#|#...#|#...#|####.', E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#', I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
    J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
    P: '####.|#...#|#...#|####.|#....|#....|#....', Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
    V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.', 2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
    3: '####.|....#|....#|.###.|....#|....#|####.', 4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
    6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...', 8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
    9: '.###.|#...#|#...#|.####|....#|....#|.###.', '/': '....#|....#|...#.|..#..|.#...|#....|#....', '-': '.....|.....|.....|#####|.....|.....|.....',
    '·': '.....|.....|.....|..#..|.....|.....|.....', '.': '.....|.....|.....|.....|.....|.....|..#..', ':': '.....|..#..|.....|.....|.....|..#..|.....',
    '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
  };
  function latCanvas(str, color) {
    const key = 'L|' + str + '|' + color;
    let c = TX.get(key); if (c) return c;
    str = str.toUpperCase();
    let w = 0; for (const ch of str) w += ch === ' ' ? 4 : 7;
    c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = 7;
    const x = c.getContext('2d'); x.fillStyle = color;
    let cx = 0;
    for (const ch of str) {
      if (ch === ' ') { cx += 4; continue; }
      const g = F57[ch];
      if (g) g.split('|').forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') x.fillRect(cx + i, j, 2, 1); });
      cx += 7;
    }
    TX.set(key, c); return c;
  }
  // screen-space pixel text. o: {size, scale, color, align, lat, lh}
  R.text = function (str, x, y, o = {}) {
    const size = o.size || 14, sc = o.scale || 2, color = o.color || '#fff', font = o.font || (o.lat ? LAT : CJK);
    const lines = String(str).split('\n'), lh = (o.lh || size * 1.45) * sc;
    const c2 = o.ctx || ctx;
    c2.imageSmoothingEnabled = false;
    const lm = Math.max(1, Math.round(sc * size / 8));
    lines.forEach((ln, i) => {
      if (!ln) return;
      if (o.lat) {
        const c = latCanvas(ln, color);
        let xx = x; if (o.align === 'center') xx -= c.width * lm / 2; else if (o.align === 'right') xx -= c.width * lm;
        c2.drawImage(c, Math.round(xx), Math.round(y + i * (9 * lm)), c.width * lm, c.height * lm);
        return;
      }
      const c = textCanvas(ln, size, color, font);
      let xx = x;
      if (o.align === 'center') xx -= c.width * sc / 2; else if (o.align === 'right') xx -= c.width * sc;
      c2.drawImage(c, Math.round(xx), Math.round(y + i * lh), c.width * sc, c.height * sc);
    });
  };
  R.textW = (str, o = {}) => o.lat ? latCanvas(str, '#fff').width * Math.max(1, Math.round((o.scale || 2) * (o.size || 14) / 8)) : textCanvas(str, o.size || 14, '#fff', o.lat ? LAT : CJK).width * (o.scale || 2);

  // ---------------------------------------------------------------- sprites
  function bitmap(rows, color) {
    const h = rows.length, w = rows[0].length, c = document.createElement('canvas');
    c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = color;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rows[j][i] === '#') x.fillRect(i, j, 1, 1);
    return c;
  }
  const SANS = G.DATA.sans, HEAD_ROWS = 24;
  const sansHead = bitmap(SANS.slice(0, HEAD_ROWS), '#fff');
  const sansBody = bitmap(SANS.slice(HEAD_ROWS), '#fff');
  // filled silhouette: everything not reachable from outside the sprite
  const FILLED = (() => {
    const h = SANS.length, w = SANS[0].length, out = SANS.map(r => r.split('').map(() => '#'));
    const seen = new Uint8Array(w * h), q = [];
    for (let i = 0; i < w; i++) { q.push([i, 0], [i, h - 1]); } for (let j = 0; j < h; j++) { q.push([0, j], [w - 1, j]); }
    while (q.length) {
      const [x, y] = q.pop();
      if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x] || SANS[y][x] === '#') continue;
      seen[y * w + x] = 1; out[y][x] = '.';
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return out.map(r => r.join(''));
  })();
  const sansHeadK = bitmap(FILLED.slice(0, HEAD_ROWS), '#000');
  const sansBodyK = bitmap(FILLED.slice(HEAD_ROWS), '#000');
  const SANS_W = SANS[0].length;
  const HEART = ['.###....###.', '#####..#####', '############', '############', '############', '.##########.', '..########..', '...######...', '....####....', '.....##.....'];
  const heartC = { red: bitmap(HEART, '#ff0000'), blue: bitmap(HEART, '#0b6cff'), white: bitmap(HEART, '#fff'), dark: bitmap(HEART, '#600') };
  const HALF_L = HEART.map(r => r.slice(0, 6) + '......'), HALF_R = HEART.map(r => '......' + r.slice(6));
  const heartHalf = [bitmap(HALF_L, '#ff0000'), bitmap(HALF_R, '#ff0000')];
  R.heart = heartC;

  // Gaster Blaster, drawn facing down, low-res vector -> crisp pixels. frames by mouth opening
  const GBW = 44, GBH = 52;
  function makeGB(open) {
    const c = document.createElement('canvas'); c.width = GBW; c.height = GBH;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
    const jaw = open * 7;
    // horns
    x.beginPath(); x.moveTo(9, 13); x.quadraticCurveTo(1, 9, 2, 0); x.lineTo(6, 2); x.quadraticCurveTo(7, 8, 13, 9); x.fill();
    x.beginPath(); x.moveTo(35, 13); x.quadraticCurveTo(43, 9, 42, 0); x.lineTo(38, 2); x.quadraticCurveTo(37, 8, 31, 9); x.fill();
    // dome
    x.beginPath(); x.ellipse(22, 17, 15, 13, 0, 0, PI * 2); x.fill();
    // upper snout
    x.beginPath(); x.moveTo(10, 22); x.lineTo(34, 22); x.lineTo(31, 36); x.lineTo(13, 36); x.closePath(); x.fill();
    // lower jaw
    x.beginPath(); x.moveTo(13, 36 + jaw); x.lineTo(31, 36 + jaw); x.lineTo(28, 46 + jaw); x.lineTo(16, 46 + jaw); x.closePath(); x.fill();
    x.fillStyle = '#000';
    // eye sockets (angled)
    x.beginPath(); x.moveTo(10, 15); x.lineTo(19, 18); x.lineTo(18, 23); x.lineTo(11, 22); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(34, 15); x.lineTo(25, 18); x.lineTo(26, 23); x.lineTo(33, 22); x.closePath(); x.fill();
    // nose ridge & nostrils
    x.fillRect(21, 26, 2, 5); x.fillRect(18, 31, 2, 2); x.fillRect(24, 31, 2, 2);
    // teeth line
    if (open > 0.05) {
      x.fillRect(13, 36, 18, jaw);
      x.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) { x.fillRect(14 + i * 3.6, 36, 2, Math.min(3, jaw)); x.fillRect(15 + i * 3.6, 36 + jaw - Math.min(3, jaw), 2, Math.min(3, jaw)); }
    } else { x.fillRect(14, 36, 16, 1); }
    // cheek cracks
    x.fillStyle = '#000'; x.fillRect(8, 26, 3, 1); x.fillRect(33, 26, 3, 1);
    const im = x.getImageData(0, 0, GBW, GBH), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const on = d[i + 3] > 110; const wht = d[i] > 128; d[i] = d[i + 1] = d[i + 2] = wht ? 255 : 0; d[i + 3] = on ? 255 : 0; }
    x.putImageData(im, 0, 0);
    return c;
  }
  const GBF = [0, 0.25, 0.5, 0.75, 1].map(makeGB);

  // ---------------------------------------------------------------- background
  const DUST = [];
  { const r = G.rng(7); for (let i = 0; i < 70; i++) DUST.push({ x: r() * SW, y: r() * SH, z: 0.3 + r() * 1.2, s: 6 + r() * 16, a: 0.06 + r() * 0.16, ph: r() * 9 }); }
  const GRID = document.createElement('canvas'); GRID.width = SW; GRID.height = SH;
  { const g = GRID.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.045)'; for (let y = 8; y < SH; y += 16) for (let x = 8; x < SW; x += 16) g.fillRect(x, y, 2, 2); }
  function drawBackground(t, beat) {
    screen();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
    // faint dot grid
    ctx.drawImage(GRID, 0, 0);
    for (const d of DUST) {
      const x = ((d.x - t * 12 * d.z) % SW + SW) % SW, y = ((d.y - t * 7 * d.z + Math.sin(t * 0.5 + d.ph) * 8) % SH + SH) % SH;
      ctx.fillStyle = `rgba(200,200,200,${d.a * (1 + beat * 0.8)})`;
      ctx.fillRect(x, y, d.s * d.z, d.s * d.z);
    }
  }

  // ---------------------------------------------------------------- sans
  function eyeState(t, F) {
    let e = G.eyeAt(t).eye;
    if (F.dodgeT && t - F.dodgeT < 1.4 && t - F.dodgeT > 0.4 && e === 'normal') e = 'wink';
    return e;
  }
  const eyeParts = [];
  R.drawSans = function (t, F, beat) {
    if (F.dustDone) return;
    const e = eyeState(t, F);
    const px = 2; // world units per sprite pixel
    let sx = 320 - SANS_W * px / 2, sy = 58;
    // dodge
    if (F.dodgeT) {
      const a = t - F.dodgeT;
      const off = a < 0 ? 0 : a < 0.15 ? -EASEo(a / 0.15) * 62 : a < 1.0 ? -62 : a < 1.3 ? -62 * (1 - EASEo((a - 1.0) / 0.3)) : 0;
      sx += off;
    }
    // slam gesture & idle sway
    let bx = 0, by = 0, hx = 0, hy = 0;
    for (const s of G.slams) {
      const a = t - s.t; if (a < -0.05 || a > 0.4) continue;
      const k = a < 0 ? (a + 0.05) / 0.05 : 1 - a / 0.4;
      const v = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[s.dir];
      bx += v[0] * 8 * k; by += v[1] * 6 * k;
    }
    const fighting = t > G.b(4) && t < G.b(72);
    if (fighting) {
      const ph = ((t - G.T0) / 0.5) % 2;
      hy = (ph % 1) < 0.5 ? 0 : px; // head dips on the off half of each beat
      bx += (ph < 1 ? 0 : px) * 0.5;
    }
    if (e === 'sleep' || e === 'closed') hy = px * (0.5 + 0.5 * Math.sin(t * 2.4));
    let shakeX = 0;
    if (F.hitT && t - F.hitT < 1.2) shakeX = Math.sin((t - F.hitT) * 80) * 4 * (1 - (t - F.hitT) / 1.2);
    sx += bx + shakeX; sy += by;
    world();
    ctx.imageSmoothingEnabled = false;
    if (F.dustT && t > F.dustT) { drawDust(t, F, sx, sy, px, hy); return; }
    const silhouette = F.silhouette;
    ctx.drawImage(silhouette ? sansBodyK : sansBody, sx, sy + HEAD_ROWS * px, SANS_W * px, (SANS.length - HEAD_ROWS) * px);
    ctx.drawImage(silhouette ? sansHeadK : sansHead, sx + hx, sy + hy, SANS_W * px, HEAD_ROWS * px);
    if (silhouette) return;
    const [p1, p2] = G.DATA.pupils; // viewer-left, viewer-right
    const P = (p, col) => { ctx.fillStyle = col; ctx.fillRect(sx + hx + p[0] * px, sy + hy + p[1] * px, 2 * px, 2 * px); };
    const lid = p => { ctx.fillStyle = '#fff'; ctx.fillRect(sx + hx + (p[0] - 3) * px, sy + hy + (p[1] + 1) * px, 8 * px, px); };
    if (e === 'normal') { P(p1, '#fff'); P(p2, '#fff'); }
    else if (e === 'wink') { P(p1, '#fff'); lid(p2); }
    else if (e === 'closed' || e === 'sleep') { lid(p1); lid(p2); }
    else if (e === 'blue' || e === 'flame') {
      const yel = e === 'flame' && Math.floor(t * 9) % 2 === 0;
      const col = yel ? '#ffe600' : '#2ad8ff';
      const ex = sx + hx + (p1[0] + 1) * px, ey = sy + hy + (p1[1] + 1) * px;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(ex - 9, ey - 9, 18, 18);
      ctx.fillStyle = '#fff'; ctx.fillRect(ex - 2, ey - 2, 4, 4);
      ctx.fillStyle = col; ctx.fillRect(ex - 3, ey - 1, 6, 2); ctx.fillRect(ex - 1, ey - 3, 2, 6);
      // flame trail
      if (Math.random() < 0.6) eyeParts.push({ x: ex, y: ey, vx: -20 - Math.random() * 30, vy: -25 - Math.random() * 30, t, col });
    }
    if (e === 'hurt' || (F.hitT && t > F.hitT)) {
      // red slash wound
      ctx.fillStyle = '#d00';
      for (let i = 0; i < 18; i++) ctx.fillRect(sx + (14 + i * 1.3) * px, sy + (28 + i) * px, 2 * px, px);
    }
    for (let i = eyeParts.length - 1; i >= 0; i--) {
      const q = eyeParts[i], a = t - q.t;
      if (a > 0.45 || a < 0) { eyeParts.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - a / 0.45; ctx.fillStyle = q.col;
      ctx.fillRect(q.x + q.vx * a, q.y + q.vy * a, 3, 3);
    }
    ctx.globalAlpha = 1;
    if (e === 'sleep') {
      for (let i = 0; i < 3; i++) {
        const a = ((t * 0.6 + i / 3) % 1);
        ctx.globalAlpha = Math.sin(a * PI);
        screen(); const [zx, zy] = R.toScreen(sx + 100 + a * 30, sy + 10 - a * 40);
        R.text('Z', zx, zy, { size: 8 + i * 2, lat: true, scale: 2 }); world();
      }
      ctx.globalAlpha = 1;
    }
  };
  function EASEo(x) { return 1 - (1 - x) * (1 - x); }
  let dustPix = null;
  function drawDust(t, F, sx, sy, px, hy) {
    if (!dustPix) {
      dustPix = []; const r = G.rng(3);
      SANS.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') dustPix.push({ i, j, d: j / SANS.length * 0.9 + r() * 0.35, vx: 20 + r() * 60, vy: -15 - r() * 50 }); });
    }
    ctx.fillStyle = '#fff';
    for (const p of dustPix) {
      const a = t - F.dustT - p.d;
      const yo = p.j < HEAD_ROWS ? hy : 0;
      if (a <= 0) { ctx.globalAlpha = 1; ctx.fillRect(sx + p.i * px, sy + p.j * px + yo, px, px); continue; }
      if (a > 1.6) continue;
      ctx.globalAlpha = 1 - a / 1.6; ctx.fillStyle = a < 0.15 ? '#fff' : '#aaa';
      ctx.fillRect(sx + p.i * px + p.vx * a, sy + p.j * px + yo + p.vy * a - 30 * a * a, px, px);
    }
    ctx.globalAlpha = 1;
    if (t - F.dustT > 2.6) F.dustDone = true;
  }

  // ---------------------------------------------------------------- box & hazards
  R.drawBox = function (t, bx, intro, alpha = 1) {
    world();
    const x0 = bx.x - bx.w / 2, y0 = bx.y - bx.h / 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, bx.w, bx.h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
    if (intro < 1) {
      const per = 2 * (bx.w + bx.h), L = per * intro;
      ctx.setLineDash([L, per]);
    }
    ctx.strokeRect(x0 + 2.5, y0 + 2.5, bx.w - 5, bx.h - 5);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };
  function clipBox(bx) {
    const E = G.edges(bx);
    ctx.save(); ctx.beginPath(); ctx.rect(E.l, E.t, E.r - E.l, E.b - E.t); ctx.clip();
  }
  function boneColor(k) { return k === 1 ? COL.blue : k === 2 ? COL.orange : '#fff'; }
  function drawBone(h) {
    const L = h.hh * 2;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.transform(h.c, h.s, -h.s, h.c, 0, 0);
    ctx.fillStyle = boneColor(h.kind);
    if (h.ghost) ctx.globalAlpha = 0.3;
    ctx.fillRect(-3, -h.hh + 2, 6, L - 4);
    const k = 3.1;
    for (const e of [-1, 1]) {
      const yy = e * (h.hh - 2.5);
      ctx.beginPath(); ctx.arc(-2.6, yy, k, 0, PI * 2); ctx.arc(2.6, yy, k, 0, PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  R.drawHazards = function (t, list, bx, plats) {
    world();
    clipBox(bx);
    // platforms
    for (const p of plats) {
      ctx.fillStyle = '#0a2a0a'; ctx.fillRect(p.x, p.y, p.w, 6);
      ctx.strokeStyle = COL.green; ctx.lineWidth = 1.6; ctx.strokeRect(p.x + 0.8, p.y + 0.8, p.w - 1.6, 4.4);
    }
    for (const h of list) {
      if (h.type === 'bone') drawBone(h);
      else if (h.type === 'warn') {
        const blink = Math.floor(t * 16) % 2;
        ctx.fillStyle = h.kind === 1 ? `rgba(34,180,255,${0.10 + blink * 0.12})` : `rgba(255,40,40,${0.10 + blink * 0.14})`;
        ctx.fillRect(h.x - h.hw, h.y - h.hh, h.hw * 2, h.hh * 2);
        ctx.strokeStyle = blink ? '#ff4040' : '#fff'; ctx.lineWidth = 1.5;
        ctx.strokeRect(h.x - h.hw + 1, h.y - h.hh + 1, h.hw * 2 - 2, h.hh * 2 - 2);
      } else if (h.type === 'aim') {
        ctx.strokeStyle = `rgba(255,60,60,${0.25 + 0.5 * h.p})`; ctx.lineWidth = 1.2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(h.x - Math.cos(h.ang) * 400, h.y - Math.sin(h.ang) * 400); ctx.lineTo(h.x + Math.cos(h.ang) * 400, h.y + Math.sin(h.ang) * 400); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  };
  R.drawBlasters = function (t, list) {
    world();
    ctx.imageSmoothingEnabled = false;
    for (const h of list) {
      if (h.type !== 'beam') continue;
      const ww = h.vw * (1 + 0.07 * Math.sin(t * 60));
      ctx.save(); ctx.translate(h.mx, h.my); ctx.rotate(h.ang);
      const age = t - h.t0;
      const g = ctx.createLinearGradient(0, -ww, 0, ww);
      g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.3, 'rgba(160,235,255,0.55)'); g.addColorStop(0.5, '#fff'); g.addColorStop(0.7, 'rgba(160,235,255,0.55)'); g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, -ww, 1900, ww * 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, -ww / 2, 1900, ww);
      if (age < 0.12) { ctx.globalAlpha = 1 - age / 0.12; ctx.beginPath(); ctx.arc(0, 0, ww * 1.4, 0, PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.restore();
    }
    for (const h of list) {
      if (h.type !== 'gb') continue;
      const f = GBF[Math.round(h.open * 4)];
      const sc = 1.15 * h.size;
      ctx.save(); ctx.globalAlpha = h.alpha; ctx.translate(h.x, h.y); ctx.rotate(h.ang - PI / 2);
      ctx.drawImage(f, -GBW * sc / 2, -GBH * sc * 0.42, GBW * sc, GBH * sc);
      // charging eyes
      if (h.charge > 0.3 && h.open < 1) {
        const k = (h.charge - 0.3) / 0.7;
        ctx.fillStyle = `rgba(255,255,255,${k})`;
        ctx.fillRect(-7 * sc, -2 * sc, 3 * sc, 3 * sc); ctx.fillRect(4 * sc, -2 * sc, 3 * sc, 3 * sc);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };
  R.drawSoul = function (t, st, F) {
    if (!st.active && !F.soulOverride) return;
    const x = F.soulOverride ? F.soulOverride[0] : st.x, y = F.soulOverride ? F.soulOverride[1] : st.y;
    const blink = F.hurtT && t - F.hurtT < 0.4 && Math.floor(t * 30) % 2 === 0;
    const img = blink ? heartC.dark : st.mode === 'blue' && !F.soulOverride ? heartC.blue : heartC.red;
    screen(); ctx.imageSmoothingEnabled = false;
    const [sx, sy] = R.toScreen(x, y);
    // slam trail
    if (st.slam && st.mode === 'blue') {
      ctx.globalAlpha = 0.35;
      const v = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[st.grav];
      for (let i = 1; i <= 3; i++) ctx.drawImage(img, sx - 12 - v[0] * i * 14, sy - 10 - v[1] * i * 14, 24, 20);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, sx - 12, sy - 10, 24, 20);
  };
  R.drawAIPath = function (path) {
    if (!path || path.length < 4) return;
    world(); ctx.strokeStyle = 'rgba(255,60,60,0.45)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
    ctx.stroke(); ctx.setLineDash([]);
  };

  // ---------------------------------------------------------------- HUD
  const BTN = [{ x: 32, label: '战斗', icon: 'fight' }, { x: 185, label: '行动', icon: 'act' }, { x: 345, label: '物品', icon: 'item' }, { x: 500, label: '仁慈', icon: 'mercy' }];
  R.BTN = BTN;
  R.drawHUD = function (t, H) {
    screen();
    const y = 390;
    const [nx, ny] = R.toScreen(32, y);
    R.text(H.name, nx, ny - 2, { lat: true, size: 8, scale: 2.4 });
    R.text('LV ' + H.lv, R.toScreen(140, 0)[0], ny - 2, { lat: true, size: 8, scale: 2.4 });
    const [hx] = R.toScreen(245, 0);
    R.text('HP', hx, ny, { lat: true, size: 6, scale: 2.4 });
    const bx = R.toScreen(275, 0)[0], bw = H.max * 1.2 * S, bh = 21 * S * 0.68;
    ctx.fillStyle = '#c00'; ctx.fillRect(bx, ny - 1, bw, bh);
    const hpw = Math.max(0, H.hp) / H.max * bw, krw = Math.min(H.kr, H.hp) / H.max * bw;
    ctx.fillStyle = COL.yellow; ctx.fillRect(bx, ny - 1, hpw, bh);
    if (krw > 0) { ctx.fillStyle = COL.kr; ctx.fillRect(bx + hpw - krw, ny - 1, krw, bh); }
    const kx = bx + bw + 14;
    R.text('KR', kx, ny, { lat: true, size: 6, scale: 2.4, color: H.kr > 0 ? COL.kr : '#fff' });
    R.text(`${Math.max(0, Math.ceil(H.hp))} / ${H.max}`, kx + 52, ny - 2, { lat: true, size: 8, scale: 2.4, color: H.kr > 0 ? COL.kr : '#fff' });
    // buttons
    for (let i = 0; i < 4; i++) {
      const b = BTN[i];
      const sel = H.menu && H.sel === i;
      const dis = H.lockBtn && i > 0;
      const col = dis ? '#5a3010' : sel ? COL.yellow : COL.ui;
      const [x0, y0] = R.toScreen(b.x, 412);
      const w = 110 * S, h = 42 * S;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
      if (sel && H.showHeart) ctx.drawImage(heartC.red, x0 + 14, y0 + h / 2 - 10, 24, 20);
      else drawIcon(b.icon, x0 + 14, y0 + h / 2 - 12, col);
      R.text(b.label, x0 + 56, y0 + 13, { size: 16, scale: 2.2, color: col });
    }
  };
  function drawIcon(k, x, y, col) {
    ctx.fillStyle = col;
    const p = (i, j, w = 1, h = 1) => ctx.fillRect(x + i * 3, y + j * 3, w * 3, h * 3);
    if (k === 'fight') { for (let i = 0; i < 6; i++) p(5 - i, i + 1); p(0, 6, 2, 1); p(1, 5); p(0, 7); }
    if (k === 'act') { p(1, 2, 1, 4); p(3, 1, 1, 6); p(5, 0, 1, 8); }
    if (k === 'item') { p(2, 0, 3, 1); p(1, 2, 5, 1); p(0, 3, 1, 4); p(6, 3, 1, 4); p(1, 7, 5, 1); p(3, 4, 1, 2); }
    if (k === 'mercy') { for (let i = 0; i < 6; i++) { p(i, i + 1); p(5 - i, i + 1); } }
  }

  // speech bubble next to sans
  R.bubble = function (text, n, t) {
    screen();
    const [x, y] = R.toScreen(390, 62);
    const lines = text.split('\n');
    const w = Math.max(200, Math.max(...lines.map(l => R.textW(l, { size: 12, scale: 2 }))) + 40), h = lines.length * 35 + 30;
    ctx.fillStyle = '#fff';
    roundRect(x, y, w, h, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2, y + 26); ctx.lineTo(x - 22, y + 36); ctx.lineTo(x + 2, y + 46); ctx.fill();
    R.text(typed(text, n), x + 20, y + 16, { size: 12, scale: 2, color: '#000', lh: 17.5 });
  };
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function typed(text, n) { let out = '', k = 0; for (const ch of text) { if (k >= n) break; out += ch; if (ch !== '\n') k++; } return out; }
  R.typed = typed;
  R.boxText = function (text, n, bx, o = {}) {
    screen();
    const [x, y] = R.toScreen(bx.x - bx.w / 2 + 24, bx.y - bx.h / 2 + 18);
    R.text(typed(text, n), x, y, { size: 14, scale: 2.2, color: o.color || '#fff', lh: 20 });
  };

  // ---------------------------------------------------------------- judgement hall
  R.drawHall = function (t, h, alpha) {
    screen();
    ctx.globalAlpha = alpha;
    const a = t - h.t0;
    const g = ctx.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, '#f8e7a8'); g.addColorStop(0.55, '#e8b95c'); g.addColorStop(1, '#6a4a1a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    const vx = 640, vy = 300, cz = a * 0.35;
    // floor tiles
    for (let i = 0; i < 18; i++) {
      const z0 = (i - (cz * 4) % 1 + 0.6) * 0.5, z1 = z0 + 0.5;
      if (z0 <= 0.05) continue;
      const y0 = vy + 300 / z0, y1 = vy + 300 / z1;
      ctx.fillStyle = i % 2 ? 'rgba(90,60,20,0.35)' : 'rgba(255,240,200,0.15)';
      ctx.fillRect(0, y1, SW, y0 - y1);
    }
    // windows light
    ctx.fillStyle = 'rgba(255,255,240,0.18)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(150 + i * 300, 0); ctx.lineTo(270 + i * 300, 0); ctx.lineTo(420 + i * 260, SH); ctx.lineTo(250 + i * 260, SH); ctx.fill(); }
    // pillars (receding, both sides)
    for (let i = 9; i >= 0; i--) {
      const z = (i + 1 - (cz * 2) % 1) * 0.55;
      if (z < 0.12) continue;
      const k = 1 / z, w = 70 * k, top = vy - 520 * k, bot = vy + 300 * k;
      const shade = clamp(1 - z / 6, 0, 1);
      for (const side of [-1, 1]) {
        const x = vx + side * 420 * k;
        ctx.fillStyle = `rgba(${40 + 60 * (1 - shade)},${25 + 40 * (1 - shade)},${8},${0.9})`;
        ctx.fillRect(x - w / 2, top, w, bot - top);
        ctx.fillStyle = 'rgba(255,230,160,0.25)'; ctx.fillRect(x - w / 2, top, w * 0.18, bot - top);
      }
    }
    // sans silhouette at the end of hall
    const s = 1.5 + a * 0.12;
    ctx.imageSmoothingEnabled = false;
    const w = SANS_W * 2 * s, hh = SANS.length * 2 * s;
    ctx.drawImage(sansBodyK, vx - w / 2, vy + 120 - hh + HEAD_ROWS * 2 * s, w, hh - HEAD_ROWS * 2 * s);
    ctx.drawImage(sansHeadK, vx - w / 2, vy + 120 - hh, w, HEAD_ROWS * 2 * s);
    // eye glint
    const p = G.DATA.pupils[0];
    if (a > 1.6) { ctx.fillStyle = Math.floor(t * 10) % 2 ? '#2ad8ff' : '#ffe600'; ctx.fillRect(vx - w / 2 + p[0] * 2 * s, vy + 120 - hh + p[1] * 2 * s, 4 * s, 4 * s); }
    ctx.globalAlpha = 1;
  };
  R.hallText = function (text, n, alpha) {
    screen(); ctx.globalAlpha = alpha;
    const [x, y] = R.toScreen(40, 360);
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, 560 * S, 100 * S);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(x + 3, y + 3, 560 * S - 6, 100 * S - 6);
    R.text(typed(text, n), x + 30, y + 26, { size: 14, scale: 2.3, lh: 21 });
    ctx.globalAlpha = 1;
  };

  // ---------------------------------------------------------------- compositing
  R.begin = function () { screen(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false; };
  R.ctx = ctx; R.world = world; R.screen = screen;
  R.background = drawBackground;
  R.flash = function (a, col = '255,255,255') { if (a <= 0) return; screen(); ctx.fillStyle = `rgba(${col},${a})`; ctx.fillRect(0, 0, SW, SH); };
  const SCAN = document.createElement('canvas'); SCAN.width = SW; SCAN.height = SH;
  { const g = SCAN.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < SH; y += 3) g.fillRect(0, y, SW, 1); }
  R.present = function (fx) {
    const o = R.octx;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    o.drawImage(scene, 0, 0);
    // bloom
    bctx.globalCompositeOperation = 'source-over';
    bctx.filter = 'none'; bctx.clearRect(0, 0, 320, 180);
    bctx.filter = 'blur(5px)'; bctx.drawImage(scene, 0, 0, 320, 180); bctx.filter = 'none';
    o.globalCompositeOperation = 'lighter'; o.globalAlpha = 0.55 + (fx.bloom || 0);
    o.imageSmoothingEnabled = true;
    o.drawImage(bloom, 0, 0, SW, SH);
    o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    // glitch slices
    if (fx.glitch > 0.02) {
      const n = Math.ceil(fx.glitch * 9);
      for (let i = 0; i < n; i++) {
        const y = Math.random() * SH, h = 4 + Math.random() * 30, dx = (Math.random() - 0.5) * 70 * fx.glitch;
        o.drawImage(R.out, 0, y, SW, h, dx, y, SW, h);
      }
    }
    // scanlines + vignette
    o.drawImage(SCAN, 0, 0);
    const v = o.createRadialGradient(640, 360, 300, 640, 360, 820);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(${fx.hurt ? 120 : 0},0,0,${0.6 + (fx.hurt || 0) * 0.3})`);
    o.fillStyle = v; o.fillRect(0, 0, SW, SH);
  };
})();
