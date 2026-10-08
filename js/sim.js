// sim.js — soul physics, hit detection, and the AI pilot (look-ahead search over future hazards)
(function () {
  const G = (typeof window !== 'undefined' ? window : globalThis).G;
  const clamp = G.clamp;
  const SPEED = 150, GRAV = 1250, JUMP = 410, FALLMAX = 640, SLAMV = 950;
  const R = 4.6; // hitbox radius
  G.SOUL_R = R;
  const GV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

  G.newSoul = function () {
    return { x: 320, y: 300, vg: 0, mode: 'red', grav: 'down', ground: false, held: false, slam: 0, active: false, moved: false, lastSlam: -1, plat: null, modeT: -1 };
  };

  // input: {dx, dy} each in {-1,0,1}
  G.stepSoul = function (st, inp, t, dt, plats) {
    const box = G.boxAt(t), I = G.inner(box);
    const ox = st.x, oy = st.y;
    // slam events
    const s = G.slamF[Math.round(t * 60)];
    if (s && s.t > st.lastSlam && s.t <= t + 1e-9 && s.t >= G.minT) {
      st.lastSlam = s.t; st.mode = 'blue'; st.grav = s.dir; st.vg = SLAMV; st.slam = 1; st.ground = false;
    }
    const m = G.modeAt(t);
    if (m.t > st.modeT) { st.modeT = m.t; st.mode = m.mode; if (m.grav) st.grav = m.grav; if (m.mode === 'blue' && !m.keepV) st.vg = 0; }
    if (st.mode === 'red') {
      let dx = inp.dx, dy = inp.dy;
      if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
      st.x += dx * SPEED * dt; st.y += dy * SPEED * dt;
    } else {
      const g = GV[st.grav];
      // lateral axis
      const lx = -g[1], ly = g[0];
      const lat = inp.dx * lx + inp.dy * ly;
      const up = -(inp.dx * g[0] + inp.dy * g[1]) > 0;
      st.x += lx * lat * SPEED * dt; st.y += ly * lat * SPEED * dt;
      if (up && st.ground && !st.held) { st.vg = -JUMP; st.ground = false; st.held = true; }
      if (!up) { st.held = false; if (st.vg < -80) st.vg = -80; }
      st.vg = Math.min(FALLMAX * (st.slam ? 1.6 : 1), st.vg + GRAV * dt);
      st.x += g[0] * st.vg * dt; st.y += g[1] * st.vg * dt;
      st.ground = false;
      // platforms (gravity down only), one-way
      if (st.grav === 'down' && plats && st.vg >= 0) {
        for (const p of plats) {
          const top = p.y - 7;
          if (st.x >= p.x - 3 && st.x <= p.x + p.w + 3 && oy <= top + 0.5 + p.vy * dt && st.y >= top) {
            st.y = top; st.vg = 0; st.ground = true; st.slam = 0;
            st.x += p.vx * dt;
            break;
          }
        }
      }
    }
    // box clamp
    if (st.x < I.l) st.x = I.l; if (st.x > I.r) st.x = I.r;
    if (st.y < I.t) st.y = I.t; if (st.y > I.b) st.y = I.b;
    if (st.mode === 'blue') {
      const g = GV[st.grav];
      const onWall = (g[1] > 0 && st.y >= I.b) || (g[1] < 0 && st.y <= I.t) || (g[0] > 0 && st.x >= I.r) || (g[0] < 0 && st.x <= I.l);
      if (onWall && st.vg >= 0) {
        if (st.slam && st.vg > 400) st.slamHit = t;
        st.vg = 0; st.ground = true; st.slam = 0;
      }
    }
    st.moved = Math.abs(st.x - ox) + Math.abs(st.y - oy) > 0.05;
  };

  // returns 0 if safe, else hazard
  G.hitAt = function (x, y, moved, hz) {
    for (let i = 0; i < hz.length; i++) {
      const h = hz[i];
      if (!h.hz) continue;
      if (h.kind === 1 && !moved) continue;
      if (h.kind === 2 && moved) continue;
      if (G.distOBB(x, y, h) < R) return h;
    }
    return null;
  };

  // one fixed simulation frame ending at time t. returns hazard hit (or null)
  const _hz = [], _pl = [];
  G.simFrame = function (st, inp, t) {
    const act = G.soulActiveAt(t);
    if (act && !st.active) {
      const bx = G.boxAt(t);
      Object.assign(st, { x: bx.x, y: bx.y, vg: 0, ground: false, held: false, slam: 0, modeT: -1, lastSlam: t - 1e-6, active: true });
    }
    if (!act) { st.active = false; return null; }
    G.platsAt(t, _pl);
    G.stepSoul(st, inp, t, G.DT, _pl);
    G.collect(t, _hz);
    return G.hitAt(st.x, st.y, st.moved, _hz);
  };

  // ---------------- AI pilot ----------------
  const ACT_RED = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ACT_RED.push({ dx, dy });
  const SEG = [7, 12, 18, 24]; // frames per search depth
  const STEP = 1;            // physics sub-steps per collision sample (frames)
  const hzCache = [], plCache = [];

  function actsFor(st) {
    if (st.mode === 'red') return ACT_RED;
    const g = GV[st.grav]; const lx = -g[1], ly = g[0];
    const A = [];
    for (let l = -1; l <= 1; l++) for (let j = 0; j <= 1; j++) {
      A.push({ dx: lx * l - (j ? g[0] : 0), dy: ly * l - (j ? g[1] : 0) });
    }
    return A;
  }
  function clone(s) { return Object.assign({}, s); }

  // cost of being at (x,y) with hazard list
  function cost(x, y, moved, hz, box, blue) {
    let c = 0;
    for (let i = 0; i < hz.length; i++) {
      const h = hz[i];
      if (!h.hz) continue;
      const blueSafe = (h.kind === 1 && !moved) || (h.kind === 2 && moved);
      const d = G.distOBB(x, y, h);
      if (d < R + 0.6) { if (!blueSafe) return 1e6; else { c += 2; continue; } }
      if (!blueSafe) { const m = 16 - d; if (m > 0) c += m * m * 0.25; }
      else if (d < 14) c += (14 - d) * 0.5;
    }
    // keep away from walls a bit (room to maneuver)
    if (blue) return c;
    const I = G.inner(box);
    const wx = Math.min(x - I.l, I.r - x), wy = Math.min(y - I.t, I.b - y);
    if (wx < 14) c += (14 - wx) * 0.4; if (wy < 14) c += (14 - wy) * 0.4;
    c += (Math.abs(x - box.x) + Math.abs(y - box.y)) * 0.01;
    return c;
  }

  G.AI = function () {
    const ai = { plan: [], cur: { dx: 0, dy: 0 }, k: 0, path: [] };
    ai.think = function (st, t) {
      if (!st.active) { ai.cur = { dx: 0, dy: 0 }; return ai.cur; }
      if (ai.k-- > 0) return ai.cur;
      ai.k = 2;
      const total = SEG.reduce((a, b) => a + b, 0);
      const N = Math.ceil(total / STEP) + 1;
      for (let i = 0; i <= N; i++) {
        const tt = t + i * STEP * G.DT;
        hzCache[i] = G.collect(tt, hzCache[i] || []).slice();
        plCache[i] = G.platsAt(tt, plCache[i] || []).slice();
      }
      // beam search
      let beam = [{ s: clone(st), c: 0, first: null, f: 0, path: [] }];
      const widths = [9, 24, 16, 8];
      for (let d = 0; d < SEG.length; d++) {
        const next = [];
        for (const node of beam) {
          for (const a of actsFor(node.s)) {
            const s = clone(node.s); let c = node.c, f = node.f; let dead = false; const path = node.path.slice();
            // penalize switching first action (reduces jitter)
            if (d === 0 && (a.dx !== ai.cur.dx || a.dy !== ai.cur.dy)) c += 0.6;
            for (let k = 0; k < SEG[d]; k++) {
              const tt = t + f * G.DT;
              G.stepSoul(s, a, tt + G.DT, G.DT, plCache[Math.floor((f + 1) / STEP)]);
              f++;
              if (f % STEP === 0) {
                const idx = f / STEP;
                const w = 1 / (1 + idx * 0.04);
                const cc = cost(s.x, s.y, s.moved, hzCache[idx], G.boxAt(tt + G.DT), s.mode === 'blue');
                if (cc >= 1e6) { c += 1e6 * w; dead = true; break; }
                c += cc * w * 0.08;
                if (idx % 6 === 0) path.push(s.x, s.y);
              }
            }
            if (dead && d > 0) c += 1e5;
            next.push({ s, c, first: node.first || a, f, path });
          }
        }
        next.sort((p, q) => p.c - q.c);
        beam = next.slice(0, widths[d]);
      }
      const best = beam[0];
      ai.cur = best.first; ai.path = best.path; ai.bestCost = best.c;
      return ai.cur;
    };
    return ai;
  };
})();
