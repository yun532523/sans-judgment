// timeline.js — the whole fight, locked to the song (120 BPM, bar n starts at G.b(n))
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis).G;
  const B = G.b, EASE = G.EASE, clamp = G.clamp;
  const PI = Math.PI;

  G.build = function () {
    G.reset();
    const R = G.rng(19);
    const MB = { x: 320, y: 292, w: 580, h: 152 };
    const AB = (w, h, dx = 0) => ({ x: 320 + dx, y: 368 - h / 2, w, h });
    const boxKeys = [], camKeys = [], modeKeys = [], eyeKeys = [], sansKeys = [];
    const box = (t, b, d = 0.25, e = 'out') => boxKeys.push({ t, v: b, d, e });
    const cam = (t, v, d = 0.6, e = 'io') => camKeys.push({ t, v, d, e });
    const mode = (t, m, grav) => modeKeys.push({ t, mode: m, grav });
    const eye = (t, e) => eyeKeys.push({ t, eye: e });
    const boxAtBuild = t => G.track(MB, boxKeys.slice())(t);
    G.says = []; G.turns = []; G.halls = []; G.texts = [];
    const say = (t, t1, text, who = 'sans') => G.says.push({ t0: t, t1, text, who });

    // ---------------------------------------------------------------- helpers
    function slam(t, dir) { G.slams.push({ t, dir }); G.ev(t, 'slam', dir); }
    // vertical bone pair moving horizontally, passing box center at tc. dir=+1 moves right
    function sweep(tc, dir, gapY, gap, speed, bx, kind = 0, kind2) {
      const E = G.edges(bx), half = bx.w / 2 + 14;
      const t0 = tc - half / speed, t1 = tc + half / speed;
      G.add(t0, t1, (t, out) => {
        const x = bx.x + dir * speed * (t - tc);
        if (gap <= 0) { G.boneSeg(out, x, E.t - 6, x, E.b + 6, kind); return; }
        G.boneSeg(out, x, E.t - 6, x, gapY - gap / 2, kind);
        G.boneSeg(out, x, gapY + gap / 2, x, E.b + 6, kind2 === undefined ? kind : kind2);
      });
    }
    // horizontal bone pair moving vertically (gap in x), passing box center at tc. dir=+1 moves down
    function sweepV(tc, dir, gapX, gap, speed, bx, kind = 0) {
      const E = G.edges(bx), half = bx.h / 2 + 14;
      G.add(tc - half / speed, tc + half / speed, (t, out) => {
        const y = bx.y + dir * speed * (t - tc);
        G.boneSeg(out, E.l - 6, y, gapX - gap / 2, y, kind);
        G.boneSeg(out, gapX + gap / 2, y, E.r + 6, y, kind);
      });
    }
    // bone sliding along floor/ceiling (gravity attacks). h = height from the floor (or ceiling if top)
    function slider(tc, dir, h, speed, bx, kind = 0, top = false) {
      const E = G.edges(bx), half = bx.w / 2 + 14;
      G.add(tc - half / speed, tc + half / speed, (t, out) => {
        const x = bx.x + dir * speed * (t - tc);
        if (top) G.boneSeg(out, x, E.t - 6, x, E.t + h, kind);
        else G.boneSeg(out, x, E.b + 6, x, E.b - h, kind);
      });
    }
    // bones thrusting out of a wall. side: 'b','t','l','r'
    function stab(t, side, depth, bx, dur = 0.3, warn = 0.4, kind = 0) {
      const E = G.edges(bx);
      const horiz = side === 'b' || side === 't';
      const len = horiz ? E.r - E.l : E.b - E.t;
      const n = Math.max(2, Math.round(len / 11));
      G.ev(t - warn, 'warn'); G.ev(t, 'stab');
      G.add(t - warn, t, (tt, out) => {
        const p = (tt - (t - warn)) / warn;
        let x, y, hw, hh;
        if (side === 'b') { x = (E.l + E.r) / 2; y = E.b - depth / 2; hw = len / 2; hh = depth / 2; }
        if (side === 't') { x = (E.l + E.r) / 2; y = E.t + depth / 2; hw = len / 2; hh = depth / 2; }
        if (side === 'l') { x = E.l + depth / 2; y = (E.t + E.b) / 2; hw = depth / 2; hh = len / 2; }
        if (side === 'r') { x = E.r - depth / 2; y = (E.t + E.b) / 2; hw = depth / 2; hh = len / 2; }
        out.push({ type: 'warn', x, y, hw, hh, c: 1, s: 0, hz: false, clip: true, p, kind });
      });
      G.add(t, t + dur + 0.1, (tt, out) => {
        const a = tt - t;
        const p = a < 0.06 ? EASE.out(a / 0.06) : a > dur ? 1 - (a - dur) / 0.1 : 1;
        const d = depth * p;
        if (d < 1) return;
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          if (side === 'b') { const x = E.l + f * len; G.boneSeg(out, x, E.b + 4, x, E.b - d, kind); }
          if (side === 't') { const x = E.l + f * len; G.boneSeg(out, x, E.t - 4, x, E.t + d, kind); }
          if (side === 'l') { const y = E.t + f * len; G.boneSeg(out, E.l - 4, y, E.l + d, y, kind); }
          if (side === 'r') { const y = E.t + f * len; G.boneSeg(out, E.r + 4, y, E.r - d, y, kind); }
        }
      });
    }
    // Gaster Blaster. o: {t: fire time, x,y: blaster pos, ang: fire direction, w: beam width, dur, warn, size}
    function gb(o) {
      const tf = o.t, warn = o.warn || 0.62, ta = tf - warn, dur = o.dur || 0.42, te = tf + dur;
      const size = o.size || 1, w = o.w || 44;
      const cx = Math.cos(o.ang), cy = Math.sin(o.ang);
      const spin = o.spin === undefined ? (R() < 0.5 ? -1 : 1) * PI * 0.6 : o.spin;
      const fx = o.fx === undefined ? o.x - cx * 170 + cy * 90 * Math.sign(spin) : o.fx;
      const fy = o.fy === undefined ? o.y - cy * 170 - cx * 90 * Math.sign(spin) : o.fy;
      G.ev(ta, 'gbin'); G.ev(tf, 'gbfire', size);
      G.add(ta, te + 0.6, (t, out) => {
        let x = o.x, y = o.y, a = o.ang, alpha = 1, open = 0;
        const ent = Math.min(0.34, warn * 0.6);
        if (t < ta + ent) {
          const p = EASE.out3((t - ta) / ent);
          x = G.lerp(fx, o.x, p); y = G.lerp(fy, o.y, p); a = o.ang - spin * (1 - p);
          alpha = Math.min(1, (t - ta) / 0.08);
        }
        if (t > tf - 0.12) open = clamp((t - (tf - 0.12)) / 0.1, 0, 1);
        if (t > te) {
          const q = t - te;
          x -= cx * 900 * q * q; y -= cy * 900 * q * q; alpha = Math.max(0, 1 - q / 0.55); open = Math.max(0, 1 - q / 0.3);
        }
        const shake = t > tf && t < te ? 1.2 : 0;
        out.push({ type: 'gb', x: x + (shake ? (Math.sin(t * 91) * shake) : 0), y: y + (shake ? Math.cos(t * 77) * shake : 0), ang: a, open, alpha, size, hz: false, clip: false, charge: clamp((t - ta) / warn, 0, 1) });
        if (t >= tf && t < te) {
          const q = t - tf;
          let wf = q < 0.05 ? q / 0.05 : 1;
          if (te - t < 0.18) wf = (te - t) / 0.18;
          const ww = w * wf;
          const mx = x + cx * 22 * size, my = y + cy * 22 * size;
          out.push({ type: 'beam', x: mx + cx * 900, y: my + cy * 900, hw: ww / 2 * 0.86, hh: 900, c: cy, s: -cx, kind: 0, hz: wf > 0.35, clip: false, vw: ww, t0: tf, ang: o.ang, mx, my, size });
        }
      });
    }
    // convenience: blaster firing a lane through point (px,py) along angle ang, positioned dist back
    function lane(t, px, py, ang, w, extra = {}) {
      const dist = extra.dist || 150;
      gb(Object.assign({ t, x: px - Math.cos(ang) * dist, y: py - Math.sin(ang) * dist, ang, w }, extra));
    }
    function platRow(t0, t1, y, seg, gapL, speed, x0, bx) {
      const E = G.edges(bx), period = seg + gapL;
      G.plats.push({ t0, t1, gen(t, out) {
        const off = ((x0 + speed * (t - t0)) % period + period) % period;
        for (let x = E.l - period * 2 + off; x < E.r + period; x += period) {
          const a = Math.max(x, E.l), b2 = Math.min(x + seg, E.r);
          if (b2 - a > 4) out.push({ x: a, y, w: b2 - a, vx: speed, vy: 0 });
        }
      } });
    }
    // aim-line warning + flying spinning bone
    function flyer(tc, px, py, ang, speed, len, kind = 0) {
      const cx = Math.cos(ang), cy = Math.sin(ang), span = 260 / speed;
      G.add(tc - span - 0.35, tc - span + 0.1, (t, out) => {
        out.push({ type: 'aim', x: px, y: py, ang, hz: false, clip: true, p: clamp((t - (tc - span - 0.35)) / 0.35, 0, 1) });
      });
      G.add(tc - span, tc + span, (t, out) => {
        const d = speed * (t - tc);
        G.boneC(out, px + cx * d, py + cy * d, len, ang + PI / 2 + (t - tc) * 7, kind);
      });
    }

    // ================================================================ INTRO (bars 0–5)
    box(0, MB, 0);
    cam(0, { rx: 0, ry: 0, rz: 0, z: 1, x: 0, y: 0 }, 0);
    eye(0, 'normal');
    say(B(0) + 0.15, B(1) - 0.05, '今天真是美好的一天。');
    say(B(1), B(2) - 0.05, '鸟儿在歌唱，花儿在绽放……');
    say(B(2), B(3) - 0.05, '在这样的日子里，\n像你这样的孩子……');
    eye(B(3), 'none');
    say(B(3), B(4) - 0.1, '应该在地狱里燃烧。');
    cam(B(3), { z: 1.06 }, 2, 'in');
    // the surprise
    const I0 = AB(250, 130);
    box(B(4) - 0.22, I0, 0.2);
    mode(B(4) - 0.25, 'blue', 'down');
    eye(B(4) - 0.05, 'blue');
    cam(B(4), { z: 1, rx: 8 }, 0.3, 'out');
    G.ev(B(4) - 0.05, 'flash', 0.8);
    slam(B(4), 'down');
    stab(B(4, 1.1), 'b', 28, I0, 0.24, 0.45);
    [[4, 3, -1, 28, 0], [5, 0, 1, 30, 0], [5, 1, -1, 122, 1], [5, 2, 1, 34, 0], [5, 2.5, -1, 24, 0], [5, 3.2, 1, 122, 1]]
      .forEach(([bar, bt, dir, h, k]) => slider(B(bar, bt), dir, h, 230, I0, k));

    // ---------------- turn 1
    box(B(6) + 0.05, MB, 0.28);
    eye(B(6), 'normal');
    cam(B(6), { rx: 0, z: 1 }, 0.6);
    G.turns.push({ t0: B(6) + 0.32, t1: B(8) - 0.45, flavor: '* 你感觉你将要经历一段\n  糟糕的时光。', n: 1 });

    // ================================================================ A (bars 8–15) red soul
    const A1 = AB(165, 165);
    box(B(8) - 0.42, A1, 0.3);
    mode(B(8) - 0.45, 'red');
    {
      const on = G.onsets(B(8), B(10) - 0.5, 0.3, 0.26);
      let gy = A1.y, k = 0;
      for (const t of on) {
        const bar = Math.floor((t - G.T0) / 2);
        const dir = bar % 2 === 0 ? -1 : 1;
        gy = clamp(gy + (R() - 0.5) * 110, A1.y - 52, A1.y + 52);
        sweep(t, dir, gy, 50, 205, A1);
        k++;
      }
    }
    cam(B(9), { rz: -3 }, 1.5);
    // A2 wall stabs
    {
      const deep = ['b', 'r', 't', 'l'];
      for (let k = 0; k < 8; k++) {
        const t = B(10, k);
        if (k % 2 === 0) stab(t, deep[(k / 2) % 4], 92, A1, 0.32, 0.45);
        else {
          const s = deep[((k - 1) / 2) % 4];
          const perp = (s === 'b' || s === 't') ? ['l', 'r'] : ['t', 'b'];
          stab(t, perp[0], 30, A1, 0.26, 0.38); stab(t, perp[1], 30, A1, 0.26, 0.38);
        }
      }
    }
    cam(B(10), { rz: 0, ry: -9, rx: 6 }, 1.2);
    // A3 tall box, falling gap rows
    const A3 = AB(132, 165);
    box(B(12) - 0.3, A3, 0.3);
    cam(B(12), { ry: 0, rx: 0, rz: 4 }, 1);
    {
      const on = G.onsets(B(12), B(14) - 0.45, 0.35, 0.3);
      let gx = A3.x;
      for (const t of on) { gx = clamp(gx + (R() - 0.5) * 80, A3.x - 34, A3.x + 34); sweepV(t, 1, gx, 46, 190, A3); }
    }
    // A4 wide, blue bones (stay still) + white gaps
    const A4 = AB(300, 130);
    box(B(14) - 0.35, A4, 0.32);
    cam(B(14), { rz: -6, rx: 16, z: 1.04 }, 1.2);
    for (let k = 0; k < 7; k++) {
      const t = B(14, k + 0.5), dir = k % 2 ? 1 : -1;
      if (k % 2 === 0) sweep(t, dir, 0, 0, 190, A4, 1);
      else sweep(t, dir, A4.y + (R() - 0.5) * 50, 54, 190, A4);
    }

    // ================================================================ B (bars 16–23)
    const B1 = AB(190, 150);
    box(B(16) - 0.3, B1, 0.28);
    cam(B(16), { rz: 0, rx: 0, z: 1 }, 0.5);
    {
      const dirs = ['down', 'left', 'up', 'right', 'down', 'right', 'up', 'left'];
      const side = { down: 'b', up: 't', left: 'l', right: 'r' };
      dirs.forEach((d, k) => { const t = B(16, k); slam(t, d); stab(t + 0.38, side[d], 28, B1, 0.26, 0.3); });
    }
    // B2 jump rope
    const B2 = AB(300, 130);
    box(B(18) - 0.25, B2, 0.22);
    slam(B(18), 'down');
    cam(B(18), { ry: 10, rx: 4 }, 1);
    {
      const on = G.onsets(B(18) + 0.45, B(20) - 0.55, 0.45, 0.46);
      on.forEach((t, k) => {
        const dir = k % 2 ? 1 : -1, r = R();
        if (k % 5 === 3) slider(t, dir, 122, 210, B2, 1);
        else if (k % 5 === 1) { slider(t, dir, 20, 210, B2); slider(t, dir, B2.h - 10 - 66, 210, B2, 0, true); }
        else slider(t, dir, 24 + r * 14, 210, B2);
      });
    }
    // B3 blaster lanes
    const B3 = AB(165, 165);
    box(B(20) - 0.3, B3, 0.28);
    mode(B(20) - 0.3, 'red');
    eye(B(20) - 0.6, 'flame');
    cam(B(20), { ry: 0, rx: -10 }, 1);
    {
      const L = 52, cxs = [-L, 0, L];
      const seq = [['v', [0, 1]], ['h', [0, 1]], ['v', [1, 2]], ['h', [1, 2]], ['v', [0, 2]], ['h', [0, 2]], ['v', [0, 1]], ['h', [1, 2]]];
      seq.forEach(([o, ls], k) => {
        const t = B(20, k + 0.5);
        for (const l of ls) {
          if (o === 'v') lane(t, B3.x + cxs[l], B3.y, PI / 2, 52, { dist: 175, dur: 0.36 });
          else lane(t, B3.x, B3.y + cxs[l], (l + k) % 2 ? 0 : PI, 52, { dist: 200, dur: 0.36 });
        }
      });
    }
    // B4 sine tunnel
    const B4 = AB(280, 140);
    box(B(22) - 0.3, B4, 0.28);
    cam(B(22), { rx: 0, rz: -5 }, 1);
    eye(B(22), 'normal');
    {
      const sp = 150, E = G.edges(B4);
      for (let i = 0; i < 40; i++) {
        const tc = B(22) + 0.2 + i * 20 / sp + (B4.w / 2) / sp; // passes center
        if (tc > B(24) - 0.2) break;
        const gy = B4.y + 30 * Math.sin(i * 0.33);
        sweep(tc, -1, gy, 56, sp, B4);
      }
    }

    // ================================================================ C (bars 24–31) blasters
    const C1 = AB(165, 165);
    box(B(24) - 0.3, C1, 0.28);
    eye(B(24) - 0.7, 'flame');
    cam(B(24), { rz: 0, z: 1.03 }, 0.4);
    {
      let last = null;
      for (let k = 0; k < 15; k++) {
        const t = B(24, 0.5 + k * 0.5);
        const vert = k % 2 === 0;
        let off; do { off = [-56, -28, 0, 28, 56][Math.floor(R() * 5)]; } while (off === last);
        last = off;
        if (vert) lane(t, C1.x + off, C1.y, k % 4 === 0 ? PI / 2 : -PI / 2, 46, { dist: 170, dur: 0.34 });
        else lane(t, C1.x, C1.y + off, k % 4 === 1 ? 0 : PI, 46, { dist: 205, dur: 0.34 });
      }
    }
    // C2 giant halves
    cam(B(26), { ry: 8, z: 1.06 }, 0.8);
    for (let k = 0; k < 8; k++) {
      const t = B(26, k + 0.5);
      if (k % 2 === 0) {
        const s = (k / 2) % 2 ? 1 : -1;
        gb({ t, x: C1.x + s * 40, y: 30, ang: PI / 2, w: 86, size: 2, dur: 0.45, warn: 0.7 });
      } else {
        const s = ((k - 1) / 2) % 2 ? -1 : 1;
        lane(t, C1.x, C1.y + s * 50, s > 0 ? 0 : PI, 40, { dist: 210, dur: 0.3 });
      }
    }
    // C3 ring
    cam(B(28), { ry: 0, rz: 10, z: 1.02 }, 2.5);
    [[B(28) + 0.5, 15, 1], [B(29) + 0.5, 0, -1]].forEach(([t0, a0, sgn]) => {
      for (let i = 0; i < 6; i++) {
        const th = (a0 + sgn * i * 60) * PI / 180;
        const t = t0 + i * 0.25;
        gb({ t, x: C1.x - Math.cos(th) * 165, y: C1.y - Math.sin(th) * 165, ang: th, w: 38, dur: 0.22, warn: 0.75 + i * 0.04 });
      }
    });
    // C4 fast sweeps + lanes
    cam(B(30), { rz: -9, z: 1.05 }, 0.6);
    {
      const on = G.onsets(B(30), B(32) - 0.5, 0.4, 0.3);
      let gy = C1.y;
      on.forEach((t, k) => { gy = clamp(gy + (R() - 0.5) * 100, C1.y - 50, C1.y + 50); sweep(t, k % 2 ? 1 : -1, gy, 50, 250, C1); });
      lane(B(30, 2), C1.x - 50, C1.y, PI / 2, 40, { dist: 170, dur: 0.3 });
      lane(B(31, 2), C1.x + 50, C1.y, PI / 2, 40, { dist: 170, dur: 0.3 });
    }

    // ================================================================ D (bars 32–39)
    eye(B(32) - 0.3, 'normal');
    cam(B(32), { rz: 0, ry: 12, z: 1 }, 1);
    const D1 = AB(250, 150);
    box(B(32) - 0.3, D1, 0.25);
    for (let k = 1; k < 8; k++) box(B(32, k), k % 2 ? AB(150, 150) : AB(250, 150), 0.2, 'back');
    {
      const on = G.onsets(B(32) + 0.3, B(34) - 0.5, 0.42, 0.34);
      let gy = D1.y;
      on.forEach(t => { const bar = Math.floor((t - G.T0) / 2); gy = clamp(gy + (R() - 0.5) * 90, D1.y - 45, D1.y + 45); sweep(t, bar % 2 ? 1 : -1, gy, 50, 190, D1); });
    }
    // D2 slams
    const D2 = AB(200, 150);
    box(B(34) - 0.25, D2, 0.22);
    cam(B(34), { ry: 0, rx: 8 }, 0.8);
    {
      const dirs = ['down', 'up', 'left', 'down', 'right', 'left', 'up', 'down'];
      const side = { down: 'b', up: 't', left: 'l', right: 'r' };
      dirs.forEach((d, k) => { const t = B(34, k); slam(t, d); stab(t + 0.36, side[d], 30, D2, 0.26, 0.28); });
    }
    // D3 X / +
    const D3 = AB(165, 165);
    box(B(36) - 0.3, D3, 0.28);
    mode(B(36) - 0.3, 'red');
    eye(B(36) - 0.6, 'flame');
    cam(B(36), { rx: 14, rz: 7, z: 1.03 }, 1);
    function cross(t, rot, w, dur, warn) {
      for (let i = 0; i < 4; i++) {
        const th = rot + i * PI / 2;
        gb({ t, x: D3.x - Math.cos(th) * 160, y: D3.y - Math.sin(th) * 160, ang: th, w, dur, warn });
      }
    }
    cross(B(36, 0.5), PI / 4, 44, 0.42, 0.65);
    cross(B(36, 2.5), 0, 44, 0.42, 0.65);
    cross(B(37, 0.5), PI / 4, 44, 0.42, 0.65);
    cross(B(37, 2.5), 0, 44, 0.42, 0.65);
    // D4 halves
    cam(B(38), { rx: 0, rz: -8, z: 1.06 }, 0.8);
    cross(B(38, 0.5), PI / 8, 40, 0.38, 0.65);
    cross(B(38, 2.5), PI / 8 + PI / 4, 40, 0.38, 0.65);
    gb({ t: B(39, 0.5), x: 80, y: D3.y + 40, ang: 0, w: 92, size: 2, dur: 0.5, warn: 0.75 });
    gb({ t: B(39, 2.4), x: 560, y: D3.y - 40, ang: PI, w: 92, size: 2, dur: 0.5, warn: 0.75 });

    // ================================================================ lull (bars 40–47)
    box(B(40) + 0.05, MB, 0.28);
    eye(B(40), 'normal');
    cam(B(40), { rz: 0, z: 1, rx: 0 }, 1);
    G.turns.push({ t0: B(40) + 0.32, t1: B(42) - 0.3, flavor: '* Sans 正在准备着什么。', n: 2 });
    const L1 = AB(165, 165);
    box(B(42) - 0.28, L1, 0.26);
    mode(B(42) - 0.3, 'red');
    say(B(42), B(44) - 0.1, '什么？你觉得我会\n呆呆站在这里，让你打中吗？');
    eye(B(44), 'blue');
    {
      // bone propeller: 4 arms from a hub, rotating; reverses on bar 46
      const t0 = B(44), t1 = B(48) - 0.3, tr = B(46);
      const ang = t => {
        const w = PI * 0.5;
        if (t < tr) return PI / 4 + w * (t - t0) * EASE.out(clamp((t - t0) / 0.8, 0, 1));
        return PI / 4 + w * (tr - t0) - w * 1.25 * (t - tr);
      };
      G.ev(t0, 'warn');
      G.add(t0 - 0.5, t1, (t, out) => {
        const grow = clamp((t - (t0 - 0.5)) / 0.5, 0, 1);
        const hub = t < B(45) ? 24 : Math.max(0, 24 - (t - B(45)) * 40);
        const a = t < t0 ? PI / 4 : ang(t);
        for (let i = 0; i < 4; i++) {
          const th = a + i * PI / 2, c = Math.cos(th), s = Math.sin(th);
          const L = 130 * grow;
          const kind = t > B(46) - 0.2 && t < B(47) && i % 2 ? 1 : 0;
          const bone = G.boneSeg(out, L1.x + c * hub, L1.y + s * hub, L1.x + c * (hub + L), L1.y + s * (hub + L), kind);
          if (bone && t < t0) bone.hz = false, bone.ghost = 1;
        }
      });
      cam(t0, { rz: 6 }, 4, 'io');
    }

    // ================================================================ E (bars 48–55) platforms
    const E1 = { x: 320, y: 298, w: 520, h: 140 };
    box(B(48) - 0.3, E1, 0.3);
    mode(B(48) - 0.3, 'blue', 'down');
    eye(B(48) - 0.3, 'blue');
    cam(B(48), { rz: 0, rx: 18, z: 1 }, 1.2);
    {
      const E = G.edges(E1), t0 = B(48) - 0.3, t1 = B(56) - 0.2;
      // floor fence
      G.add(t0, t1, (t, out) => {
        const rise = clamp((t - t0) / 0.3, 0, 1) * clamp((t1 - t) / 0.2, 0, 1);
        for (let x = E.l + 6; x < E.r; x += 12) G.boneSeg(out, x, E.b + 4, x, E.b - 16 * rise, 0);
      });
      platRow(t0, t1, 322, 140, 44, -55, 230, E1);
      platRow(t0, t1, 282, 100, 84, 55, 40, E1);
      // blockers
      for (let k = 0; k < 7; k++) {
        const t = B(48, 1 + k * 2);
        if (k % 2 === 0) slider(t, -1, E.b - 300, 165, E1);
        else slider(t, 1, 290 - E.t, 165, E1, 0, true);
      }
      // E2 blasters on rows + columns
      for (let k = 0; k < 7; k++) {
        const t = B(52, 0.5 + k * 1);
        if (k % 2 === 0) gb({ t, x: 600, y: k % 4 === 0 ? 272 : 312, ang: PI, w: k % 4 === 0 ? 30 : 26, dur: 0.38, warn: 0.7 });
        else { const x = 200 + R() * 240; lane(t, x, 300, PI / 2, 34, { dist: 200, dur: 0.32, warn: 0.7 }); }
      }
    }
    cam(B(52), { rx: 12, ry: -10 }, 1.5);

    // ================================================================ F (bars 56–59)
    const F1 = AB(200, 165);
    box(B(56) - 0.2, F1, 0.25);
    mode(B(56) - 0.2, 'red');
    eye(B(56) - 0.2, 'normal');
    cam(B(56), { rx: 0, ry: 0, rz: -8 }, 1);
    {
      const on = G.onsets(B(56) + 0.4, B(58) - 0.2, 0.4, 0.24);
      on.forEach(t => {
        const ang = R() * PI * 2;
        const px = F1.x + (R() - 0.5) * 120, py = F1.y + (R() - 0.5) * 100;
        flyer(t, px, py, ang, 230, 44);
      });
    }
    const F2 = AB(84, 165);
    box(B(58) - 0.1, F2, 0.4, 'back');
    cam(B(58), { rz: 0, z: 1.08 }, 0.6);
    {
      const on = G.onsets(B(58) + 0.35, B(60) - 0.55, 0.38, 0.3);
      let gx = F2.x;
      on.forEach(t => { gx = clamp(gx + (R() - 0.5) * 40, F2.x - 14, F2.x + 14); sweepV(t, 1, gx, 34, 180, F2); });
    }

    // ================================================================ Judgement Hall (bars 60–61)
    G.halls.push({ t0: B(60) - 0.1, t1: B(62) - 0.25 });
    cam(B(60) - 0.1, { z: 1, rz: 0 }, 0.3);
    say(B(60), B(61) - 0.05, '* LV，是 LOVE 的缩写。', 'hall');
    say(B(61), B(62) - 0.3, '* 暴力等级。\n* ……而今天，由我来审判你。', 'hall');

    // ================================================================ G finale (bars 62–71)
    const G1 = AB(165, 165);
    box(B(62) - 0.28, G1, 0.26, 'back');
    mode(B(62) - 0.3, 'red');
    eye(B(62) - 0.3, 'flame');
    cam(B(62), { z: 1.08, rz: 0 }, 0.2, 'out');
    cam(B(62) + 0.3, { z: 1.02 }, 1);
    G.ev(B(62), 'flash', 1);
    lane(B(62), G1.x, G1.y - 55, 0, 42, { dist: 220, dur: 0.38, warn: 0.6 });
    lane(B(62), G1.x, G1.y + 55, PI, 42, { dist: 220, dur: 0.38, warn: 0.6 });
    lane(B(62, 1), G1.x - 55, G1.y, PI / 2, 42, { dist: 170, dur: 0.38 });
    lane(B(62, 1), G1.x + 55, G1.y, -PI / 2, 42, { dist: 170, dur: 0.38 });
    {
      D3.x = G1.x; D3.y = G1.y;
      cross(B(62, 2.5), PI / 4, 42, 0.36, 0.6);
      // storm
      let pk = null;
      for (let k = 0; k < 10; k++) {
        const t = B(63, 0.5) + k * 0.3;
        const ang = (R() * 4 | 0) * PI / 2 + (R() < 0.5 ? PI / 4 : 0);
        let off; do { off = (R() * 5 | 0) - 2; } while (off === pk); pk = off;
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        lane(t, G1.x + nx * off * 30, G1.y + ny * off * 30, ang, 38, { dist: 190, dur: 0.26, warn: 0.6 });
      }
    }
    // G2 slam frenzy
    const G2 = AB(200, 150);
    box(B(64) + 0.3, G2, 0.2);
    eye(B(64) + 0.3, 'blue');
    cam(B(64) + 0.3, { rx: 10, ry: -6, z: 1 }, 0.6);
    {
      const dirs = ['left', 'right', 'down', 'up', 'right', 'down', 'left', 'up'];
      const side = { down: 'b', up: 't', left: 'l', right: 'r' };
      dirs.forEach((d, k) => { if (k === 7) return; const t = B(64, k + 0.6); slam(t, d); stab(t + 0.34, side[d], 32, G2, 0.24, 0.26); });
    }
    // G3 fast tunnel + columns
    const G3 = AB(300, 140);
    box(B(66) - 0.1, G3, 0.25);
    mode(B(66) - 0.1, 'red');
    eye(B(66) - 0.1, 'flame');
    cam(B(66), { rx: 0, ry: 0, rz: -6, z: 1.04 }, 0.8);
    {
      const sp = 200;
      for (let i = 0; i < 60; i++) {
        const tc = B(66) + 0.3 + i * 22 / sp + (G3.w / 2) / sp;
        if (tc > B(68) - 0.15) break;
        sweep(tc, -1, G3.y + 32 * Math.sin(i * 0.36 + 1.2), 56, sp, G3);
      }
      [[66, 3], [67, 1], [67, 3]].forEach(([bar, bt], k) => lane(B(bar, bt), G3.x + [-90, 60, -20][k], G3.y, PI / 2, 40, { dist: 190, dur: 0.3, warn: 0.7 }));
    }
    // G4 rotating crosses
    const G4 = AB(165, 165);
    box(B(68) - 0.25, G4, 0.24);
    cam(B(68), { rz: 14, rx: 10, z: 1.05 }, 1.8);
    D3.x = G4.x; D3.y = G4.y;
    cross(B(68, 0.5), PI / 4, 42, 0.38, 0.62);
    cross(B(68, 2.5), PI / 4 + PI / 8, 42, 0.38, 0.62);
    cross(B(69, 0.5), PI / 4 + PI / 4, 42, 0.38, 0.62);
    cross(B(69, 2.5), PI / 4 + 3 * PI / 8, 42, 0.38, 0.62);
    // G5 final quadrant chase
    cam(B(70), { rz: -12, rx: 0, z: 1.1 }, 1.8);
    gb({ t: B(70, 0.5), x: 70, y: G4.y + 40, ang: 0, w: 88, size: 2, dur: 0.48, warn: 0.75 });
    gb({ t: B(70, 2.5), x: G4.x - 40, y: 30, ang: PI / 2, w: 88, size: 2, dur: 0.48, warn: 0.75 });
    gb({ t: B(71, 0.5), x: 570, y: G4.y - 40, ang: PI, w: 88, size: 2, dur: 0.48, warn: 0.75 });
    gb({ t: B(71, 2.4), x: G4.x + 40, y: 30, ang: PI / 2, w: 88, size: 2, dur: 0.5, warn: 0.75 });
    G.ev(B(72) - 0.02, 'flash', 1.2);
    G.ev(B(72) - 0.02, 'stopfx');

    // ================================================================ outro (bars 72–78)
    box(B(72), MB, 0.5);
    eye(B(72), 'closed');
    cam(B(72), { rz: 0, rx: 0, ry: 0, z: 1 }, 1.5);
    say(B(72) + 0.3, B(73) - 0.2, '……呼……\n……哈……', 'sans');
    eye(B(73), 'sleep');
    G.turns.push({ t0: B(73) + 0.1, t1: B(74, 3), flavor: '* Sans 睡着了。\n* 你只剩下「战斗」。', n: 3, final: true });
    eye(B(74, 3.3), 'hurt');
    say(B(75), B(75, 3), '……看来\n就这样了，嗯？');
    say(B(75, 3), B(76, 2.5), '……别说我\n没警告过你。');
    say(B(76, 2.6), B(77, 1), '……喂，Papyrus……');
    say(B(77, 1), B(77, 3), '你想吃点什么吗？');
    G.dust = B(77, 3);
    G.lastText = { t0: B(78) + 0.4, text: '* 这就是你想要的吗？' };
    G.endT = B(79) + 1.2;

    // finalize tracks
    G.boxAt = G.memoFrame(G.track(MB, boxKeys));
    G.camAt = G.track({ rx: 0, ry: 0, rz: 0, z: 1, x: 0, y: 0 }, camKeys);
    G.modeAt = G.memoFrame(G.steps({ t: -1, mode: 'red' }, modeKeys));
    G.slamF = {};
    for (const s of G.slams) G.slamF[Math.ceil(s.t * 60 - 1e-9)] = s;
    G.eyeAt = G.steps({ t: -1, eye: 'normal' }, eyeKeys);
    G.events.sort((a, b) => a.t - b.t);
    G.slams.sort((a, b) => a.t - b.t);
    G.checkpoints = [0, B(8) - 0.5, B(16) - 0.35, B(20) - 0.35, B(24) - 0.35, B(32) - 0.35, B(42) - 0.3, B(48) - 0.35, B(56) - 0.25, B(62) - 0.35, B(66) - 0.2].map(t => Math.max(0, t));
    G.sections = [
      [0, '序幕'], [B(8), '骨之回廊'], [B(16), '重力'], [B(20), '炮口'], [B(24), '龙骨炮'], [B(32), '十字审判'],
      [B(40), '喘息'], [B(48), '平台'], [B(56), '飞骨'], [B(60), '审判长廊'], [B(62), '终章'], [B(72), '终幕'],
    ];
  };

  G.inTurn = t => { for (const u of G.turns) if (t >= u.t0 - 0.05 && t < u.t1 + 0.05) return u; return null; };
  G.inHall = t => { for (const h of G.halls) if (t >= h.t0 && t < h.t1) return h; return null; };
  G.soulActiveAt = t => t >= G.b(4) - 0.22 && t < G.b(72) - 0.05 && !G.inTurn(t) && !G.inHall(t) && !(t >= G.b(6) - 0.05 && t < G.b(8) - 0.45);
})();
