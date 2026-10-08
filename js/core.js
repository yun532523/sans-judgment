// core.js — timing, tweening, geometry, hazard registry. Pure & deterministic (runs in browser and node).
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};

  G.W = 640; G.H = 480;
  G.T0 = 0.228;                       // first downbeat (bar 0) of the song, 120 BPM
  G.b = (bar, beat = 0) => G.T0 + bar * 2 + beat * 0.5;
  G.END = 159;
  G.DT = 1 / 60;

  const clamp = G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G.lerp = (a, b, t) => a + (b - a) * t;
  const EASE = G.EASE = {
    lin: t => t,
    io: t => t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t),
    out: t => 1 - (1 - t) * (1 - t),
    out3: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t,
    back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    step: t => t < 1 ? 0 : 1,
  };

  // keyframe track: keys [{t, v:{...}, d, e}] — tween from current value to v over d seconds
  G.track = function (def, keys) {
    keys.sort((a, b) => a.t - b.t);
    return function (t) {
      let from = def, to = def, kt = -1e9, kd = 0, ke = EASE.io;
      const val = tt => {
        const p = kd > 0 ? clamp((tt - kt) / kd, 0, 1) : 1, e = ke(p), o = {};
        for (const k in to) o[k] = from[k] + (to[k] - from[k]) * e;
        return o;
      };
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k.t > t) break;
        const s = val(k.t);
        from = s; to = Object.assign({}, s, k.v); kt = k.t; kd = k.d || 0; ke = EASE[k.e || 'io'];
      }
      return val(t);
    };
  };
  // step track: [{t, ...}] returns last key with t<=now
  G.steps = function (def, keys) {
    keys.sort((a, b) => a.t - b.t);
    return t => { let r = def; for (const k of keys) { if (k.t > t) break; r = k; } return r; };
  };

  // memoize a pure function of time on the 60 Hz frame grid
  G.memoFrame = function (fn) {
    const cache = [];
    return t => {
      const f = Math.round(t * 60);
      if (f < 0 || Math.abs(f / 60 - t) > 1e-6) return fn(t);
      const v = cache[f];
      return v !== undefined ? v : (cache[f] = fn(t));
    };
  };
  // deterministic rng
  G.rng = function (seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };

  // onsets from the song analysis
  G.onsets = function (t0, t1, minS = 0, minGap = 0, src) {
    const out = []; let last = -9;
    for (const [t, s] of (src || G.DATA.on)) {
      if (t < t0 || t >= t1 || s < minS || t - last < minGap) continue;
      out.push(t); last = t;
    }
    return out;
  };

  // ---------------- hazard registry ----------------
  // attack = {t0, t1, gen(t, out)} ; out items: {type, x,y,hw,hh,c,s, kind(0 white,1 blue,2 orange), hz(bool), clip(bool), ...}
  G.reset = function () {
    G.attacks = []; G.buckets = {}; G.events = []; G.slams = []; G.plats = [];
  };
  G.reset();
  G.add = function (t0, t1, gen) {
    const a = { t0, t1, gen };
    G.attacks.push(a);
    for (let s = Math.floor(t0); s <= Math.floor(t1); s++) (G.buckets[s] = G.buckets[s] || []).push(a);
    return a;
  };
  G.ev = (t, name, arg) => G.events.push({ t, name, arg });
  G.minT = 0;   // hazards spawned before this are suppressed (checkpoint restart)
  G.collect = function (t, out) {
    out.length = 0;
    const L = G.buckets[Math.floor(t)];
    if (!L) return out;
    for (const a of L) if (t >= a.t0 && t < a.t1 && a.t0 >= G.minT) a.gen(t, out);
    return out;
  };
  G.platsAt = function (t, out) {
    out.length = 0;
    for (const p of G.plats) if (t >= p.t0 && t < p.t1 && p.t0 >= G.minT) p.gen(t, out);
    return out;
  };

  // ---------------- primitives ----------------
  const BW = 3; // bone half width (hitbox)
  G.BW = BW;
  // bone from (x1,y1) to (x2,y2)
  G.boneSeg = function (out, x1, y1, x2, y2, kind = 0, extra) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 1) return;
    // local y axis along the bone
    const c = dy / L, s = -dx / L; // local x = (c,s) perpendicular
    const o = { type: 'bone', x: (x1 + x2) / 2, y: (y1 + y2) / 2, hw: BW, hh: L / 2, c, s, kind, hz: true, clip: true };
    if (extra) Object.assign(o, extra);
    out.push(o);
    return o;
  };
  G.boneC = function (out, x, y, len, ang, kind = 0, extra) { // centered bone, ang = direction of bone axis
    const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
    return G.boneSeg(out, x - dx, y - dy, x + dx, y + dy, kind, extra);
  };
  G.rect = function (out, x, y, hw, hh, ang, props) {
    const o = { x, y, hw, hh, c: Math.cos(ang), s: Math.sin(ang), hz: true, kind: 0 };
    Object.assign(o, props); out.push(o); return o;
  };

  // circle vs OBB: returns distance from circle center to rect (0 when inside)
  G.distOBB = function (px, py, h) {
    const dx = px - h.x, dy = py - h.y;
    const lx = dx * h.c + dy * h.s, ly = -dx * h.s + dy * h.c;
    const ex = Math.abs(lx) - h.hw, ey = Math.abs(ly) - h.hh;
    const ox = ex > 0 ? ex : 0, oy = ey > 0 ? ey : 0;
    return Math.sqrt(ox * ox + oy * oy);
  };

  G.inner = function (box) { // inner play area for soul center
    const m = 5 + 7;
    return { l: box.x - box.w / 2 + m, r: box.x + box.w / 2 - m, t: box.y - box.h / 2 + m, b: box.y + box.h / 2 - m };
  };
  G.edges = function (box) { // inner edges of the border
    return { l: box.x - box.w / 2 + 5, r: box.x + box.w / 2 - 5, t: box.y - box.h / 2 + 5, b: box.y + box.h / 2 - 5 };
  };
})();
