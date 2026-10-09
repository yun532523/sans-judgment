// game.js — states, input, audio/sfx, turns, damage, modes, screens
(function () {
  const G = window.G, R = G.R, B = G.b, clamp = G.clamp, PI = Math.PI;
  G.build();

  const out = document.getElementById('cv'), stage = document.getElementById('stage'), fitEl = document.getElementById('fit');
  const music = document.getElementById('music');
  const caR = document.getElementById('caR'), caB = document.getElementById('caB');
  R.init(out);

  // ---------------------------------------------------------------- input
  const keys = {}, pressed = {};
  const MAP = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', KeyZ: 'z', Enter: 'z', Space: 'z', KeyX: 'x', ShiftLeft: 'x', ShiftRight: 'x', Escape: 'esc', KeyP: 'p', KeyF: 'f', KeyM: 'm' };
  // shared by the keyboard and the on-screen pad (core exposes it as __sans.input)
  const pressKey = k => { if (!keys[k]) pressed[k] = true; keys[k] = true; };
  const releaseKey = k => { keys[k] = false; };
  let touchUI = matchMedia('(any-pointer: coarse)').matches; // on-screen pad: shown for touch, swapped by real input
  addEventListener('keydown', e => { const k = MAP[e.code]; if (!k) return; e.preventDefault(); pressKey(k); audioUnlock(); });
  addEventListener('keyup', e => { const k = MAP[e.code]; if (k) releaseKey(k); });
  addEventListener('pointerdown', () => audioUnlock());
  const hit = k => { const v = pressed[k]; pressed[k] = false; return v; };
  const clearPressed = () => { for (const k in pressed) pressed[k] = false; };

  // ---------------------------------------------------------------- sfx (synthesized)
  let AC = null, master = null, noiseBuf = null, muted = false, primed = false;
  function audioUnlock() {
    // iOS refuses a programmatic play() until the element has been started from a gesture,
    // so start it silently (muted) the first time real input arrives.
    if (!primed) {
      primed = true; music.muted = true;
      const p = music.play();
      const done = () => { if (state !== 'play') music.pause(); music.muted = muted; };
      if (p && p.then) p.then(done, done);
    }
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.32; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(f0, f1, dur, type = 'square', vol = 0.2, delay = 0) {
    if (!AC || muted) return;
    const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2, f0 = 3000, f1 = 300, q = 0.8, type = 'lowpass', delay = 0) {
    if (!AC || muted) return;
    const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  const SFX = {
    move: () => tone(900, 900, 0.05, 'square', 0.08),
    select: () => { tone(660, 660, 0.05, 'square', 0.1); tone(1320, 1320, 0.07, 'square', 0.08, 0.05); },
    voice: () => tone(150 + Math.random() * 60, 140, 0.05, 'square', 0.07),
    tick: () => tone(1050, 1050, 0.018, 'triangle', 0.05),
    hurt: () => { tone(340, 120, 0.12, 'square', 0.12); noise(0.08, 0.12, 4000, 800); },
    gbin: () => { tone(180, 900, 0.5, 'sawtooth', 0.035); noise(0.45, 0.04, 800, 4000, 2, 'bandpass'); },
    gbfire: s => { noise(0.7, 0.28 * (s || 1), 5000, 120); tone(90, 32, 0.5, 'sine', 0.4); tone(600, 200, 0.25, 'sawtooth', 0.05); },
    slam: () => { tone(110, 38, 0.22, 'sine', 0.45); noise(0.15, 0.2, 1500, 200); },
    warn: () => { tone(1500, 1500, 0.04, 'square', 0.05); tone(1500, 1500, 0.04, 'square', 0.05, 0.08); },
    stab: () => noise(0.12, 0.12, 6000, 2000, 1, 'highpass'),
    slash: () => { noise(0.35, 0.25, 9000, 400, 1); tone(800, 120, 0.3, 'sawtooth', 0.05); },
    miss: () => tone(300, 300, 0.001, 'sine', 0),
    dodge: () => noise(0.18, 0.08, 2500, 600, 1, 'bandpass'),
    shatter: () => { tone(520, 80, 0.4, 'square', 0.15); noise(0.4, 0.2, 7000, 300); },
    crack: () => { tone(300, 150, 0.12, 'square', 0.16); },
    heal: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.1, 'square', 0.07, i * 0.06)),
    hitbig: () => { tone(70, 30, 0.6, 'sine', 0.5); noise(0.5, 0.25, 2000, 100); },
    dust: () => noise(1.6, 0.08, 1200, 200, 0.5, 'bandpass'),
  };

  // ---------------------------------------------------------------- song clock
  let anchor = 0, lastCT = -1, endedAt = -1, endedT = 0;
  let forcedT = null;
  function songTime() {
    if (forcedT !== null) return forcedT;
    const now = performance.now() / 1000;
    if (music.ended) { if (endedAt < 0) { endedAt = now; endedT = music.duration || G.b(78); } return endedT + now - endedAt; }
    const ct = music.currentTime;
    if (music.paused) return ct;
    if (ct !== lastCT) { const est = now - anchor; lastCT = ct; if (Math.abs(est - ct) > 0.04) anchor = now - ct; else anchor += ((now - ct) - anchor) * 0.1; }
    return now - anchor;
  }

  // ---------------------------------------------------------------- state
  const MODES = { challenge: '挑战模式', ai: '无敌 · AI 无伤', lock: '无敌 · 人类锁血' };
  let state = 'title', mode = 'challenge', chapter = 0, tSel = 0;
  let S = null; // run state
  const ITEMS0 = () => [
    { n: '奶油糖果派', heal: 92, msg: '* 你吃掉了奶油糖果派。\n* HP 已回满！' },
    { n: '牛排', heal: 60, msg: '* 你吃掉了牛排。\n* 恢复了 60 HP！' },
    { n: '传说英雄', heal: 40, msg: '* 你吃掉了传说英雄。\n* 恢复了 40 HP！' },
    { n: '雪人碎片', heal: 45, msg: '* 你吃掉了雪人碎片。\n* 恢复了 45 HP！' },
  ];
  function newRun(from, attempts, silent) {
    G.minT = from > 0.5 ? from : 0;
    const start = from > 0.5 ? Math.max(0, from - 1.1) : 0;
    S = {
      from, start, t: start, fr: Math.floor(start * 60), soul: G.newSoul(), ai: G.AI(),
      hp: 92, kr: 0, krAcc: 0, hitFrames: 0, incidents: 0, lastHit: -9, hurtT: -9, F: {},
      evI: G.events.findIndex(e => e.t > start), shake: 0, flash: 0, ca: 0, glitch: 0,
      turn: null, items: ITEMS0(), said: {}, typedN: {}, attempts: attempts || 1, path: [], kickI: 0,
      wallStart: performance.now(), deathT: 0, showPath: S ? S.showPath : false,
    };
    if (S.evI < 0) S.evI = G.events.length;
    endedAt = -1;
    if (!silent) { music.currentTime = start; music.play().catch(() => {}); }
    anchor = performance.now() / 1000 - start; lastCT = -1;
    state = 'play';
  }

  // ---------------------------------------------------------------- turns
  function turnUpdate(t) {
    const u = G.inTurn(t);
    if (!u) {
      if (S.turn && S.turn.ph === 'target' && !S.turn.stopped) strike(t, S.turn);
      S.turn = null; return;
    }
    if (!S.turn || S.turn.u !== u) clearPressed(), S.turn = { u, ph: 'menu', sel: 0, sub: 0, t0: t, text: u.flavor, textT: u.t0 };
    const T = S.turn;
    const ai = mode === 'ai';
    if (t > u.t1) { if (T.ph === 'target' && !T.stopped) strike(t, T); return; }
    const L = hit('l'), Rr = hit('r'), U = hit('u'), D = hit('d'), Z = hit('z'), X = hit('x');
    if (T.ph === 'menu') {
      if (ai) { if (t - T.t0 > 0.55) { T.sel = 0; SFX.select(); startTarget(t, T); } return; }
      if (L) { T.sel = (T.sel + 3) % 4; SFX.move(); }
      if (Rr) { T.sel = (T.sel + 1) % 4; SFX.move(); }
      if (u.final) T.sel = 0;
      if (Z) {
        SFX.select();
        if (T.sel === 0) startTarget(t, T);
        else if (T.sel === 1) { T.ph = 'list'; T.list = ['查看', '嘲讽']; T.sub = 0; T.kind = 'act'; }
        else if (T.sel === 2) { const L2 = S.items.map(i => i.n); if (!L2.length) { T.ph = 'text'; T.text = '* 你没有物品了。'; T.textT = t; } else { T.ph = 'list'; T.list = L2; T.sub = 0; T.kind = 'item'; } }
        else { T.ph = 'list'; T.list = ['饶恕']; T.sub = 0; T.kind = 'mercy'; }
      }
    } else if (T.ph === 'list') {
      if (U) { T.sub = (T.sub + T.list.length - 1) % T.list.length; SFX.move(); }
      if (D) { T.sub = (T.sub + 1) % T.list.length; SFX.move(); }
      if (X) { T.ph = 'menu'; return; }
      if (Z) {
        SFX.select(); T.ph = 'text'; T.textT = t;
        if (T.kind === 'act') T.text = T.sub === 0 ? '* SANS 1 攻击 1 防御\n* 最简单的敌人。\n* 只能造成 1 点伤害。' : '* 你告诉 Sans 你不会再杀人了。\n* 他只是笑了笑。';
        if (T.kind === 'item') { const it = S.items.splice(T.sub, 1)[0]; T.text = it.msg; S.hp = Math.min(92, S.hp + it.heal); S.kr = Math.min(S.kr, S.hp - 1); SFX.heal(); }
        if (T.kind === 'mercy') T.text = u.n === 1 ? '* 你试着饶恕 Sans。\n* ……他只是眨了眨眼。' : '* 你试着饶恕 Sans。\n* ……他摇了摇头。';
      }
    } else if (T.ph === 'target') {
      const p = (t - T.bt) / 1.5;
      const want = ai && Math.abs(p - 0.5) < 0.012;
      if ((Z || want) && !T.stopped) strike(t, T);
      if (p > 1 && !T.stopped) strike(t, T);
    }
  }
  function startTarget(t, T) { T.ph = 'target'; T.bt = t; T.stopped = false; }
  function strike(t, T) {
    T.stopped = true; T.st = t; T.ph = 'struck';
    T.acc = 1 - Math.abs((t - T.bt) / 1.5 - 0.5) * 2;
    S.F.slashT = t; SFX.slash();
    if (T.u.final) { S.F.hitT = t + 0.45; setTimeout(() => SFX.hitbig(), 450); }
    else { S.F.dodgeT = t + 0.05; S.F.missT = t + 0.45; SFX.dodge(); }
  }

  // ---------------------------------------------------------------- simulation
  function simTo(t) {
    let steps = 0;
    while ((S.fr + 1) / 60 <= t && steps < 14) {
      const ft = S.fr / 60, tt = (S.fr + 1) / 60;
      let inp = { dx: 0, dy: 0 };
      if (!S.turn) {
        if (mode === 'ai') inp = S.ai.think(S.soul, ft);
        else inp = { dx: (keys.r ? 1 : 0) - (keys.l ? 1 : 0), dy: (keys.d ? 1 : 0) - (keys.u ? 1 : 0) };
      }
      const wasSlam = S.soul.slamHit;
      const h = G.simFrame(S.soul, inp, tt);
      if (S.soul.slamHit !== wasSlam) { SFX.slam(); S.shake = Math.max(S.shake, 7); }
      if (h) damage(tt);
      // karma drain
      if (S.kr > 0 && mode === 'challenge') {
        S.krAcc += 1 / 60;
        const iv = S.kr > 30 ? 1 / 30 : S.kr > 20 ? 2 / 30 : S.kr > 10 ? 5 / 30 : 15 / 30;
        if (S.krAcc >= iv) { S.krAcc = 0; S.kr--; if (S.hp > 1) S.hp--; }
      }
      S.fr++; steps++;
      if (state !== 'play') return;
    }
    if ((S.fr + 1) / 60 <= t) S.fr = Math.floor(t * 60);
  }
  function damage(t) {
    S.hitFrames++;
    if (t - S.lastHit > 0.25) { S.incidents++; SFX.hurt(); }
    if (t - S.lastHit > 0.09) S.hurtT = t;
    S.lastHit = t;
    S.ca = Math.max(S.ca, 0.7); S.shake = Math.max(S.shake, 3);
    if (mode !== 'challenge') return;
    if (S.fr % 2 === 0) { S.hp -= 1; S.kr = Math.min(40, S.kr + 2); if (S.kr > S.hp - 1) S.kr = Math.max(0, S.hp - 1); }
    if (S.hp <= 0) die(t);
  }
  function die(t) {
    S.hp = 0; S.deathT = t; S.deathPos = [S.soul.x, S.soul.y];
    music.pause(); state = 'dead'; S.deadAt = performance.now() / 1000;
    setTimeout(() => SFX.crack(), 400); setTimeout(() => SFX.shatter(), 1300);
  }

  // events (sfx & fx)
  function events(t) {
    while (S.evI < G.events.length && G.events[S.evI].t <= t) {
      const e = G.events[S.evI++];
      if (e.t < G.minT - 0.01 || t - e.t > 0.3) continue;
      if (e.name === 'gbin') SFX.gbin();
      if (e.name === 'gbfire') { SFX.gbfire(e.arg); S.shake = Math.max(S.shake, 5 * (e.arg || 1)); S.ca = Math.max(S.ca, 0.35 * (e.arg || 1)); }
      if (e.name === 'warn') SFX.warn();
      if (e.name === 'stab') SFX.stab();
      if (e.name === 'flash') S.flash = Math.max(S.flash, e.arg);
      if (e.name === 'slam') S.glitch = Math.max(S.glitch, 0.25);
    }
  }

  // ---------------------------------------------------------------- drawing helpers
  function drawTurn(t, bx) {
    const T = S.turn; if (!T) return;
    const ctx = R.ctx;
    if (T.ph === 'menu' || T.ph === 'text') {
      const n = Math.floor((t - (T.ph === 'menu' ? T.u.t0 : T.textT)) * 28);
      R.boxText(T.ph === 'menu' ? T.u.flavor : T.text, n, bx);
      if (n !== S.lastTick && n < 40) { S.lastTick = n; if (n % 2) SFX.tick(); }
    } else if (T.ph === 'list') {
      R.screen();
      const [x, y] = R.toScreen(bx.x - bx.w / 2 + 60, bx.y - bx.h / 2 + 18);
      T.list.forEach((s, i) => {
        const cx = x + (i % 2) * 380, cy = y + Math.floor(i / 2) * 46;
        R.text('* ' + s, cx, cy, { size: 14, scale: 2.2 });
        if (i === T.sub) ctx.drawImage(R.heart.red, cx - 40, cy + 6, 24, 20);
      });
    } else if (T.ph === 'target' || T.ph === 'struck') {
      R.world();
      const E = G.edges(bx), cx = bx.x, cy = bx.y, w = E.r - E.l - 20, h = E.b - E.t - 16;
      ctx.save();
      // target (eye-shaped lens with stripes)
      ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, PI * 2);
      ctx.strokeStyle = '#3cff3c'; ctx.lineWidth = 2; ctx.stroke();
      ctx.clip();
      for (let i = -12; i <= 12; i++) {
        const xx = cx + i * w / 26, near = 1 - Math.abs(i) / 12;
        ctx.fillStyle = near > 0.85 ? '#ffff00' : near > 0.5 ? '#9cff3c' : '#2a8a2a';
        ctx.fillRect(xx - 1, E.t, 2.2, h + 20);
      }
      ctx.fillStyle = '#ff2a2a'; ctx.fillRect(cx - w / 2 + 10, cy - 12, 3, 24); ctx.fillRect(cx + w / 2 - 13, cy - 12, 3, 24);
      ctx.fillStyle = '#ffff00'; ctx.fillRect(cx - 4, E.t, 8, h + 20);
      ctx.restore();
      const p = T.stopped ? (T.st - T.bt) / 1.5 : (t - T.bt) / 1.5;
      const bxp = E.l + 6 + clamp(p, 0, 1) * (E.r - E.l - 12);
      const fl = T.stopped && Math.floor(t * 14) % 2;
      ctx.fillStyle = fl ? '#000' : '#fff'; ctx.fillRect(bxp - 5, E.t + 2, 10, E.b - E.t - 4);
      ctx.strokeStyle = fl ? '#fff' : '#000'; ctx.lineWidth = 2; ctx.strokeRect(bxp - 5, E.t + 2, 10, E.b - E.t - 4);
    }
  }
  function drawSlash(t) {
    const F = S.F, ctx = R.ctx;
    if (F.slashT && t > F.slashT && t - F.slashT < 0.5) {
      const a = (t - F.slashT) / 0.45;
      R.world(); ctx.save(); ctx.translate(320, 128); ctx.rotate(-0.9);
      const L = 150 * Math.min(1, a * 2), wdt = 10 * (1 - Math.max(0, a - 0.5) * 2);
      ctx.fillStyle = '#ff1a1a'; ctx.fillRect(-75, -wdt / 2, L, wdt);
      ctx.fillStyle = '#fff'; ctx.fillRect(-75, -wdt / 6, L, wdt / 3);
      ctx.restore();
    }
    if (F.missT && t > F.missT && t - F.missT < 1.2) {
      const a = t - F.missT;
      R.screen(); ctx.globalAlpha = Math.min(1, (1.2 - a) * 3);
      const [x, y] = R.toScreen(320, 40 - a * 10);
      R.text('MISS', x + 3, y + 3, { lat: true, size: 16, scale: 3, color: '#000', align: 'center' });
      R.text('MISS', x, y, { lat: true, size: 16, scale: 3, color: '#c0c0c0', align: 'center' });
      ctx.globalAlpha = 1;
    }
  }
  function sayActive(t) { for (const s of G.says) if (t >= s.t0 && t < s.t1) return s; return null; }
  function cpFor(t) { let c = 0; for (const cp of G.checkpoints) if (cp <= t + 0.01) c = cp; return c; }
  function sectionFor(t) { let n = ''; for (const [s, name] of G.sections) if (t >= s) n = name; return n; }
  function fmt(s) { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

  let camPulse = 0;
  function applyCamera(t, cam, extra) {
    const sh = S ? S.shake : 0;
    const shx = (Math.random() - 0.5) * sh * 2, shy = (Math.random() - 0.5) * sh * 2;
    stage.style.transform = `translate(${cam.x + shx}px, ${cam.y + shy}px) perspective(1700px) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) rotateZ(${cam.rz}deg) scale(${cam.z * (1 + extra)})`;
  }
  function setCA(a) {
    if (a < 0.03) { if (out.style.filter) out.style.filter = ''; return; }
    caR.setAttribute('dx', (a * 7).toFixed(2)); caB.setAttribute('dx', (-a * 7).toFixed(2));
    if (!out.style.filter) out.style.filter = 'url(#ca)';
  }
  function kickEnv(t) {
    const K = G.DATA.kick;
    while (S.kickI < K.length - 1 && K[S.kickI + 1][0] <= t) S.kickI++;
    while (S.kickI > 0 && K[S.kickI][0] > t) S.kickI--;
    const k = K[S.kickI]; if (!k) return 0;
    const a = t - k[0];
    return a >= 0 && a < 0.18 ? k[1] * (1 - a / 0.18) : 0;
  }

  // ---------------------------------------------------------------- frame: play
  function framePlay(dtw) {
    let t = songTime();
    if (hit('esc')) { state = 'pause'; music.pause(); return; }
    if (hit('p')) S.showPath = !S.showPath;
    turnUpdate(t);
    simTo(t);
    if (state !== 'play') return;
    events(t);
    S.t = t;
    S.shake *= Math.pow(0.0006, dtw); S.ca *= Math.pow(0.02, dtw); S.flash *= Math.pow(0.004, dtw); S.glitch *= Math.pow(0.01, dtw);
    const F = S.F;
    if (G.dust && t > G.dust && !F.dustT) { F.dustT = G.dust; SFX.dust(); }
    if (t > G.endT) { finish(); return; }

    const kick = kickEnv(t);
    R.begin();
    R.background(t, kick);
    const hall = G.inHall(t);
    const bx = G.boxAt(t);
    const ending = t > G.lastText.t0 - 0.8;
    const hz = G.collect(t, []);
    const pl = G.platsAt(t, []);
    if (!ending) {
      R.drawSans(t, F, kick);
      R.drawBox(t, bx, clamp(t / 0.9, 0, 1));
      R.drawHazards(t, hz, bx, pl);
      drawTurn(t, bx);
      R.drawSoul(t, S.soul, { hurtT: S.hurtT });
      if (S.showPath && mode === 'ai') R.drawAIPath(S.ai.path);
      R.drawHUD(t, { name: 'CHARA', lv: 19, hp: S.hp, kr: S.kr, max: 92, menu: !!S.turn, sel: S.turn ? S.turn.sel : -1, showHeart: S.turn && S.turn.ph === 'menu', lockBtn: S.turn && S.turn.u.final });
      R.drawBlasters(t, hz);
      drawSlash(t);
    }
    if (hall) {
      const a = Math.min(1, (t - hall.t0) / 0.25, (hall.t1 - t) / 0.2);
      R.drawHall(t, hall, a);
    }
    const s = sayActive(t);
    if (s) {
      const n = Math.floor((t - s.t0) * (s.who === 'hall' ? 16 : 18));
      if (s.who === 'hall') R.hallText(s.text, n, 1);
      else if (!ending) R.bubble(s.text, n, t);
      const key = s.t0;
      if ((S.typedN[key] || 0) < n && n <= s.text.length) { S.typedN[key] = n; if (n % 2 === 0) SFX.voice(); }
    }
    if (ending) {
      R.screen(); const ctx = R.ctx;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720);
      const lt = G.lastText, a = t - lt.t0;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(R.heart.red, 640 - 12, 330, 24, 20);
      if (a > 0) R.text(R.typed(lt.text, Math.floor(a * 9)), 640, 420, { size: 14, scale: 2.2, align: 'center' });
    }
    R.flash(Math.min(1, S.flash));
    // corner info
    R.screen();
    if (!hall && !ending) {
    R.text(MODES[mode] + (mode === 'challenge' && S.attempts > 1 ? `  第 ${S.attempts} 次` : ''), 18, 14, { size: 12, scale: 2, color: mode === 'ai' ? '#7fdcff' : mode === 'lock' ? '#ffd27f' : '#ff7f7f' });
    R.text(`受击 ${S.incidents}   ${sectionFor(t)}   ${fmt(t)}`, 18, 46, { size: 12, scale: 2, color: '#888' });
    if (mode === 'ai') R.text('P 显示 AI 预测路径', 1262, 14, { size: 12, scale: 2, color: '#555', align: 'right' });
    }
    const glitchBase = t > B(68) && t < B(70) ? 0.12 + kick * 0.4 : 0;
    R.present({ glitch: Math.max(S.glitch, glitchBase), hurt: t - S.hurtT < 0.3 ? 1 - (t - S.hurtT) / 0.3 : 0, bloom: kick * 0.25 });
    setCA(S.ca + glitchBase * 0.6);
    applyCamera(t, G.camAt(t), kick * 0.012);
  }
  function finish() {
    state = 'result'; S.wall = (performance.now() - S.wallStart) / 1000; S.resT = performance.now() / 1000;
    stage.style.transform = ''; setCA(0);
  }

  // ---------------------------------------------------------------- dead
  function frameDead() {
    const a = performance.now() / 1000 - S.deadAt;
    stage.style.transform = ''; setCA(0);
    R.begin(); R.background(S.deathT, 0);
    const ctx = R.ctx;
    R.screen(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720);
    const [sx, sy] = R.toScreen(S.deathPos[0], S.deathPos[1]);
    ctx.imageSmoothingEnabled = false;
    if (a < 0.4) ctx.drawImage(R.heart.red, sx - 12, sy - 10, 24, 20);
    else if (a < 1.3) { const d = a < 0.5 ? 0 : 3; ctx.drawImage(R.heart.dark && R.heart.red, 0, 0, 6, 10, sx - 12 - d, sy - 10, 12, 20); ctx.drawImage(R.heart.red, 6, 0, 6, 10, sx + d, sy - 10, 12, 20); ctx.fillStyle = '#000'; ctx.fillRect(sx - 1, sy - 10, 2, 20); }
    else if (a < 3) {
      const r = G.rng(5);
      for (let i = 0; i < 6; i++) {
        const vx = (r() - 0.5) * 300, vy = -150 - r() * 150, q = a - 1.3;
        ctx.fillStyle = '#f00'; ctx.fillRect(sx + vx * q, sy + vy * q + 500 * q * q, 8, 8);
      }
    }
    if (a > 2.4) {
      const k = Math.min(1, (a - 2.4) / 1);
      ctx.globalAlpha = k;
      R.text('GAME', 640, 120, { lat: true, size: 32, scale: 3, align: 'center' });
      R.text('OVER', 640, 240, { lat: true, size: 32, scale: 3, align: 'center' });
      ctx.globalAlpha = 1;
    }
    if (a > 3.4) {
      // save-point style panel
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.fillStyle = '#000';
      ctx.fillRect(250, 420, 780, 210); ctx.strokeRect(253, 423, 774, 204);
      R.text(sectionFor(S.deathT), 290, 450, { size: 14, scale: 2.4 });
      R.text('LV 19', 650, 450, { size: 14, scale: 2.4 });
      R.text(fmt(S.deathT), 980, 450, { size: 14, scale: 2.4, align: 'right' });
      ['继续', '重置'].forEach((s, i) => {
        R.text(s, 360 + i * 330, 540, { size: 14, scale: 2.6, color: tSel === i ? '#ffff00' : '#fff' });
        if (tSel === i) ctx.drawImage(R.heart.red, 320 + i * 330, 548, 24, 20);
      });
      R.text(`第 ${S.attempts + 1} 次`, 640, 650, { size: 12, scale: 2.2, color: '#c00', align: 'center' });
      if (hit('l') || hit('r')) { tSel = 1 - tSel; SFX.move(); }
      if (hit('z')) { SFX.select(); const n = S.attempts + 1; newRun(tSel === 0 ? cpFor(S.deathT) : G.sections[chapter][0], n); tSel = 0; }
      if (hit('x')) { state = 'title'; }
    } else clearPressed();
    R.present({});
  }

  // ---------------------------------------------------------------- pause & result
  function framePause() {
    const ctx = R.octx;
    if (!S.pauseDrawn) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, 1280, 720); S.pauseDrawn = true; R.text('暂停', 640, 290, { size: 20, scale: 3, align: 'center', ctx }); R.text('Z 继续   ·   X 返回标题', 640, 400, { size: 14, scale: 2, align: 'center', ctx, color: '#aaa' }); }
    if (hit('z') || hit('esc')) { S.pauseDrawn = false; state = 'play'; music.play(); }
    if (hit('x')) { S.pauseDrawn = false; state = 'title'; stage.style.transform = ''; setCA(0); }
  }
  function frameResult() {
    R.begin(); const t = performance.now() / 1000; R.background(t, 0);
    const a = t - S.resT, ctx = R.ctx;
    ctx.globalAlpha = Math.min(1, a / 0.8);
    R.text('审判结束', 640, 90, { size: 24, scale: 3, align: 'center' });
    const nohit = S.incidents === 0;
    const rank = mode === 'challenge' ? (nohit ? 'S' : S.incidents < 6 ? 'A' : S.incidents < 15 ? 'B' : S.incidents < 30 ? 'C' : 'D') : (nohit ? '无伤' : '—');
    const rows = [['模式', MODES[mode]], ['起始章节', G.sections[chapter][1]], ['受击次数', String(S.incidents)], ['受击帧', String(S.hitFrames)], ['剩余 HP', mode === 'challenge' ? `${Math.ceil(S.hp)} / 92` : '锁定'], ['尝试次数', String(S.attempts)]];
    rows.forEach(([k, v], i) => { R.text(k, 400, 210 + i * 54, { size: 14, scale: 2.4, color: '#aaa' }); R.text(v, 880, 210 + i * 54, { size: 14, scale: 2.4, align: 'right' }); });
    if (a > 1) {
      const pulse = 1 + 0.04 * Math.sin(t * 5);
      R.text(mode === 'challenge' ? `评价  ${rank}` : rank, 640, 560, { size: 20, scale: 3 * pulse, align: 'center', color: nohit ? '#ffff00' : '#fff' });
    }
    R.text('Z 再来一次   ·   X 返回标题', 640, 660, { size: 12, scale: 2, align: 'center', color: '#777' });
    ctx.globalAlpha = 1;
    R.present({});
    if (a > 1) { if (hit('z')) { SFX.select(); newRun(G.sections[chapter][0], 1); } if (hit('x')) state = 'title'; } else clearPressed();
  }

  // ---------------------------------------------------------------- title
  const TITLE = [
    { k: 'challenge', name: '挑战模式', d: '92 HP · KARMA · 死亡后可从检查点继续' },
    { k: 'ai', name: '无敌模式 · AI 无伤通关', d: '看 AI 实时预判、零失误打完整场审判' },
    { k: 'lock', name: '无敌模式 · 人类锁血', d: 'HP 锁定，只记录你被击中的次数' },
    { k: 'chap', name: '起始章节', d: '←/→ 选择从哪一段开始' },
  ];
  function frameTitle() {
    const t = performance.now() / 1000;
    if (!music.paused) music.pause();
    stage.style.transform = ''; setCA(0);
    R.begin(); R.background(t, 0.2 + 0.2 * Math.sin(t * 2));
    const ctx = R.ctx;
    // sans with burning eye
    R.drawSans(t, { silhouette: false }, 0);
    // fake eye glow on title
    R.world();
    const p = G.DATA.pupils[0];
    const ex = 320 - 52 + (p[0] + 1) * 2, ey = 58 + (p[1] + 1) * 2;
    const col = Math.floor(t * 4) % 2 ? '#2ad8ff' : '#ffe600';
    const gr = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(ex - 10, ey - 10, 20, 20); ctx.fillStyle = '#fff'; ctx.fillRect(ex - 2, ey - 2, 4, 4);
    R.screen();
    R.text('狂 妄 之 人', 640, 322, { size: 30, scale: 3, align: 'center', font: R.HEI });
    R.text('SANS  ·  THE  JUDGEMENT', 640, 440, { lat: true, size: 8, scale: 2.5, align: 'center', color: '#888' });
    TITLE.forEach((it, i) => {
      const y = 500 + i * 46, sel = i === tSel;
      const label = it.k === 'chap' ? `${it.name}：‹ ${G.sections[chapter][1]} ›` : it.name;
      R.text(label, 470, y, { size: 14, scale: 2.2, color: sel ? '#ffff00' : '#fff' });
      if (sel) { ctx.imageSmoothingEnabled = false; ctx.drawImage(R.heart.red, 430, y + 6, 24, 20); }
    });
    R.text(TITLE[tSel].d, 640, 690, { size: 12, scale: 2, align: 'center', color: '#888' });
    R.text(touchUI ? '左下方向键移动 · 右下 确认 / 取消' : '方向键/WASD 移动 · Z/Enter 确认 · X 取消 · Esc 暂停 · F 全屏 · M 静音', 640, 20, { size: 12, scale: 1.7, align: 'center', color: '#555' });
    R.present({});
    if (hit('u')) { tSel = (tSel + 3) % 4; SFX.move(); }
    if (hit('d')) { tSel = (tSel + 1) % 4; SFX.move(); }
    if (TITLE[tSel].k === 'chap') {
      if (hit('l')) { chapter = (chapter + G.sections.length - 1) % G.sections.length; SFX.move(); }
      if (hit('r')) { chapter = (chapter + 1) % G.sections.length; SFX.move(); }
    }
    if (hit('z') && TITLE[tSel].k !== 'chap') { SFX.select(); mode = TITLE[tSel].k; newRun(G.sections[chapter][0], 1); }
  }

  // ---------------------------------------------------------------- loop
  let lastW = performance.now(), fpsN = 0, fpsT = 0, fps = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    fpsN++; if (now - fpsT > 1000) { fps = fpsN * 1000 / (now - fpsT); fpsN = 0; fpsT = now; }
    const dtw = Math.min(0.1, (now - lastW) / 1000); lastW = now;
    if (hit('f')) {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { } })
          .catch(() => {});
      }
    }
    if (hit('m')) { muted = !muted; music.muted = muted; }
    try {
      if (state === 'title') frameTitle();
      else if (state === 'play') framePlay(dtw);
      else if (state === 'dead') frameDead();
      else if (state === 'pause') framePause();
      else if (state === 'result') frameResult();
    } catch (e) { window.__err = String(e.stack || e); console.error(e); }
  }
  function fit() {
    const cs = getComputedStyle(document.body);
    const availW = innerWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    // held upright, a 16:9 stage is turned on its side so it can fill the screen
    const turn = touchUI && availH > availW * 1.05;
    const k = turn ? Math.min(availH / 1280, availW / 720) : Math.min(availW / 1280, availH / 720);
    out.style.width = 1280 * k + 'px'; out.style.height = 720 * k + 'px';
    fitEl.style.transform = turn ? 'rotate(90deg)' : '';
    document.documentElement.style.setProperty('--u', k + 'px');
  }
  addEventListener('resize', fit); fit();
  requestAnimationFrame(loop);
  // debug hook
  window.__sans = {
    shot(t, m = 'ai', from) {
      mode = m; muted = true;
      newRun(from === undefined ? 0 : from, 1, true);
      S.showPath = true;
      const st = from === undefined ? Math.max(0, cpFor(t) - 0.5) : S.start;
      if (from === undefined) { G.minT = 0; S.fr = Math.floor(st * 60); S.evI = G.events.findIndex(e => e.t > st); }
      for (let f = S.fr; f < t * 60; f++) { forcedT = f / 60; turnUpdate(forcedT); simTo(forcedT); if (state !== 'play') break; }
      forcedT = t; S.evI = G.events.findIndex(e => e.t > t - 0.2); if (S.evI < 0) S.evI = G.events.length;
      framePlay(1 / 60);
      return { hp: S.hp, inc: S.incidents, state };
    }, start: (m, t) => { mode = m; audioUnlock(); newRun(t || 0, 1); }, get S() { return S; }, get state() { return state; }, get fps() { return fps; }, get t() { return S ? S.t : 0; },
    input: { press: pressKey, release: releaseKey },
    get touch() { return touchUI; }, set touch(v) { const was = touchUI; touchUI = !!v; if (was !== touchUI) fit(); } };
})();
