// touch.js — on-screen pad for phones and tablets.
// It speaks the same key vocabulary the keyboard does (__sans.input), so the game
// logic never has to know which of the two is driving it.
(function () {
  const pad = document.getElementById('pad');
  const api = window.__sans && window.__sans.input;
  const dpad = document.getElementById('dpad');
  if (!pad || !api || !dpad) return;

  const KEYS = ['l', 'r', 'u', 'd', 'z', 'x', 'esc', 'f', 'm'];
  const DEAD = 0.3;                    // fraction of the stick radius that means "no direction"
  const btns = {}, down = {}, ptr = new Map();
  for (const b of pad.querySelectorAll('[data-k]')) btns[b.dataset.k] = b;

  const stick = new Set();             // pointer ids that own the d-pad
  // the stage is turned on its side when the phone is held upright, so undo that turn
  const turned = () => innerHeight > innerWidth * 1.05;
  function stickKeys(x, y) {
    const r = dpad.getBoundingClientRect();
    let dx = x - (r.x + r.width / 2), dy = y - (r.y + r.height / 2);
    if (turned()) { const t = dx; dx = dy; dy = -t; }
    const reach = Math.min(r.width, r.height) / 2, lim = reach * DEAD, out = [];
    if (dx > lim) out.push('r'); else if (dx < -lim) out.push('l');
    if (dy > lim) out.push('d'); else if (dy < -lim) out.push('u');
    return out;
  }
  const inStick = (x, y) => {
    const r = dpad.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  // the pad keeps the set of keys wanted by the fingers that are down; diff it against
  // what was already committed, so press/release fire exactly once per edge
  function sync() {
    const want = new Set();
    for (const keys of ptr.values()) for (const k of keys) want.add(k);
    for (const k of KEYS) {
      const on = want.has(k);
      if (on === !!down[k]) continue;
      down[k] = on;
      if (btns[k]) btns[k].classList.toggle('on', on);
      if (on) api.press(k); else api.release(k);
    }
    pad.classList.toggle('act', ptr.size > 0);
  }
  const setKeys = (id, keys) => { ptr.set(id, new Set(keys)); sync(); };
  const drop = id => { if (ptr.delete(id)) { stick.delete(id); sync(); } };
  const dropAll = () => { ptr.clear(); stick.clear(); sync(); };

  pad.addEventListener('pointerdown', e => {
    if (inStick(e.clientX, e.clientY)) {
      e.preventDefault();
      stick.add(e.pointerId);
      setKeys(e.pointerId, stickKeys(e.clientX, e.clientY));
      return;
    }
    const b = e.target.closest && e.target.closest('[data-k]');
    if (!b || !pad.contains(b)) return;
    e.preventDefault();
    setKeys(e.pointerId, [b.dataset.k]);      // z / x / esc / f / m stay with the finger that pressed them
  });
  addEventListener('pointermove', e => {
    if (!stick.has(e.pointerId)) return;
    setKeys(e.pointerId, stickKeys(e.clientX, e.clientY));   // sliding off the cross stops movement
  });
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, e => drop(e.pointerId));
  addEventListener('blur', dropAll);
  addEventListener('visibilitychange', () => { if (document.hidden) dropAll(); });

  // show the pad for touch, hide it the moment a real keyboard shows up
  const show = v => { document.body.classList.toggle('touch', v); api.touch = v; };
  show(matchMedia('(any-pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && Math.min(innerWidth, innerHeight) < 820));
  addEventListener('keydown', e => { if (e.isTrusted) show(false); }, true);
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch') show(true); }, true);

  // iOS Safari has no element fullscreen, so the button would be a no-op there
  if (!document.documentElement.requestFullscreen) {
    const b = pad.querySelector('[data-k="f"]');
    if (b) b.remove();
  }
})();
