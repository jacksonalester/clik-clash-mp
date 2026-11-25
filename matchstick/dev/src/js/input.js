/* MATCHSTICK · input: keyboard + mouse, twin touch sticks, gamepad → player intent */
const IN = {
  keys: new Set(), mouse: { x: 0, y: 0, down: false, right: false, seen: false }, touch: false, lastTouchT: -1e9,
  sticks: [
    { role: 'move', id: null, ox: 0, oy: 0, dx: 0, dy: 0, r: 58, active: false, show: true, fire: false },
    { role: 'aim', id: null, ox: 0, oy: 0, dx: 0, dy: 0, r: 58, active: false, show: true, fire: false, t0: 0, moved: false },
  ],
  tapShot: 0, edge: { dash: false, swap: false, pick: false, emote: false, pause: false }, pad: null, padUsed: false, emoteIdx: 0, lastAim: 0,
};
const EMOTES = ['GG', 'Nice one', 'Oops', 'Let’s go'];
function inputInit(cv) {
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key) && G.state === 'match') e.preventDefault();
    if (!IN.keys.has(k)) {
      if (k === ' ' || k === 'Shift') IN.edge.dash = true;
      if (k === 'q') IN.edge.swap = true;
      if (k === 'e' || k === 'f') IN.edge.pick = true;
      if (k === 't') IN.edge.emote = true;
      if (k === 'Escape' || k === 'p') IN.edge.pause = true;
    }
    IN.keys.add(k);
    if (G.state === 'match' || G.state === 'pause') IN.touch = false;
  });
  window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; IN.keys.delete(k); });
  window.addEventListener('blur', () => { IN.keys.clear(); IN.mouse.down = false; IN.mouse.right = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    auUnlock();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') { IN.touch = true; IN.lastTouchT = performance.now(); touchDown(e); e.preventDefault(); return; }
    IN.touch = false; IN.mouse.x = e.clientX; IN.mouse.y = e.clientY; IN.mouse.seen = true;
    if (e.button === 2) IN.mouse.right = true; else IN.mouse.down = true;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  }, { passive: false });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') { touchMove(e); e.preventDefault(); return; }
    IN.mouse.x = e.clientX; IN.mouse.y = e.clientY; IN.mouse.seen = true;
    if (performance.now() - IN.lastTouchT > 800) IN.touch = false;
  }, { passive: false });
  const up = e => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') { touchUp(e); return; }
    if (e.button === 2) IN.mouse.right = false; else IN.mouse.down = false;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('gamepadconnected', () => { IN.padUsed = true; });
  if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches && (navigator.maxTouchPoints || 0) > 0) IN.touch = true;
}
function stickSide(x) { const left = x < RN.W * 0.48; return SET.lefty ? (left ? 'aim' : 'move') : (left ? 'move' : 'aim'); }
function touchDown(e) {
  const role = stickSide(e.clientX), st = IN.sticks.find(s => s.role === role);
  if (!st || st.id !== null) return;
  st.id = e.pointerId; st.ox = e.clientX; st.oy = e.clientY; st.dx = 0; st.dy = 0; st.active = true; st.moved = false; st.t0 = performance.now(); st.fire = false;
}
function touchMove(e) {
  const st = IN.sticks.find(s => s.id === e.pointerId); if (!st) return;
  let dx = (e.clientX - st.ox) / st.r, dy = (e.clientY - st.oy) / st.r; const l = Math.hypot(dx, dy);
  if (l > 1) { // drag the base along so the stick never "runs out"
    st.ox += (dx / l) * (l - 1) * st.r; st.oy += (dy / l) * (l - 1) * st.r; dx /= l; dy /= l;
  }
  st.dx = dx; st.dy = dy; if (l > 0.18) st.moved = true;
}
function touchUp(e) {
  const st = IN.sticks.find(s => s.id === e.pointerId); if (!st) return;
  if (st.role === 'aim' && !st.moved && performance.now() - st.t0 < 240) IN.tapShot = 0.12; // quick tap = auto-aimed shot
  st.id = null; st.active = false; st.dx = st.dy = 0; st.fire = false;
}
function layoutSticks() {
  const B = RN.H - SAFE.b, L = SAFE.l, R = RN.W - SAFE.r, r = clamp(Math.min(RN.W, RN.H) * 0.13, 48, 66);
  for (const st of IN.sticks) {
    st.r = r;
    if (!st.active) {
      const leftSide = (st.role === 'move') !== !!SET.lefty;
      st.ox = leftSide ? L + r + 34 : R - r - 34; st.oy = B - r - 34;
    }
  }
}
function pollPad() {
  if (IN.noPad) return null;
  let pads = null;
  try { pads = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { IN.noPad = true; return null; }
  if (!pads) return null;
  for (const p of pads) if (p && p.connected) return p;
  return null;
}
const DZ = v => (Math.abs(v) < 0.18 ? 0 : v);
/* turn devices into this frame's intent for the local player */
function applyInput(g, me, dt) {
  const I = me.in;
  I.melee = false;
  const pad = pollPad(); let padFire = false, padMelee = false, pax = 0, pay = 0, pmx = 0, pmy = 0;
  if (pad) {
    pmx = DZ(pad.axes[0] || 0); pmy = DZ(pad.axes[1] || 0); pax = DZ(pad.axes[2] || 0); pay = DZ(pad.axes[3] || 0);
    const b = i => pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.4);
    padFire = b(7) || b(5); padMelee = b(6) || b(1);
    if (pmx || pmy || pax || pay || padFire) { IN.padUsed = true; IN.touch = false; }
    const pv = IN.padPrev || {};
    if (b(0) && !pv.a) IN.edge.dash = true; if (b(3) && !pv.y) IN.edge.swap = true; if (b(2) && !pv.x) IN.edge.pick = true; if (b(9) && !pv.st) IN.edge.pause = true; if (b(12) && !pv.up) IN.edge.emote = true;
    IN.padPrev = { a: b(0), y: b(3), x: b(2), st: b(9), up: b(12) };
  }
  // movement
  let mx = 0, my = 0;
  const K = IN.keys;
  if (K.has('a') || K.has('ArrowLeft')) mx -= 1; if (K.has('d') || K.has('ArrowRight')) mx += 1;
  if (K.has('w') || K.has('ArrowUp')) my -= 1; if (K.has('s') || K.has('ArrowDown')) my += 1;
  const mv = IN.sticks[0];
  if (IN.touch && mv.active) { mx = mv.dx; my = mv.dy; const l = Math.hypot(mx, my); if (l < 0.12) { mx = my = 0; } }
  if (pmx || pmy) { mx = pmx; my = pmy; }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  I.mx = mx; I.my = my;
  // aim + fire
  let fire = false, aim = I.aim, look = { x: 0, y: 0 };
  if (IN.touch) {
    const as = IN.sticks[1];
    if (as.active && Math.hypot(as.dx, as.dy) > 0.22) {
      aim = Math.atan2(as.dy, as.dx); fire = Math.hypot(as.dx, as.dy) > 0.5; as.fire = fire;
      look = { x: as.dx * 110, y: as.dy * 110 };
      if (SET.assist) aim = assistAim(g, me, aim, 0.2);
    } else if (IN.tapShot > 0) {
      IN.tapShot -= dt; const t = nearestFoe(g, me, 760);
      if (t) aim = Math.atan2(t.y - me.y, t.x - me.x);
      fire = true;
    } else if (ml > 0.2) { aim = I.aim + clamp(angDiff(I.aim, Math.atan2(my, mx)), -9 * dt, 9 * dt); }
  } else if (pad && (pax || pay || padFire)) {
    if (pax || pay) aim = Math.atan2(pay, pax);
    if (SET.assist) aim = assistAim(g, me, aim, 0.16);
    fire = padFire; look = { x: pax * 120, y: pay * 120 };
    if (padMelee) I.melee = true;
  } else {
    const wx = (IN.mouse.x - RN.W / 2) / RN.S + RN.cam.x, wy = (IN.mouse.y - RN.H / 2) / RN.S + RN.cam.y;
    aim = Math.atan2(wy - me.y, wx - me.x);
    fire = IN.mouse.down; if (IN.mouse.right) I.melee = true;
    look = { x: clamp((IN.mouse.x - RN.W / 2) / RN.S * 0.26, -150, 150), y: clamp((IN.mouse.y - RN.H / 2) / RN.S * 0.26, -150, 150) };
  }
  I.aim = aim; I.fire = fire;
  RN.look.x = approach(RN.look.x, look.x, 6, dt); RN.look.y = approach(RN.look.y, look.y, 6, dt);
  // one-shot actions
  // one-shot actions stay armed until a game tick has used them (no lost taps on 120 Hz screens)
  I.dash = I.dash || IN.edge.dash; I.swap = I.swap || IN.edge.swap; I.pick = I.pick || IN.edge.pick;
  if (IN.edge.emote) { I.emote = true; I.emoteText = EMOTES[IN.emoteIdx++ % EMOTES.length]; }
  IN.edge.dash = IN.edge.swap = IN.edge.pick = IN.edge.emote = false;
}
function nearestFoe(g, me, maxD) {
  let best = null, bd = maxD * maxD;
  for (const q of g.players) { if (!q.alive || !enemies(g, me, q)) continue; const d = dist2(me.x, me.y, q.x, q.y); if (d < bd && los(g.map, me.x, me.y, q.x, q.y)) { bd = d; best = q; } }
  return best;
}
function assistAim(g, me, aim, cone) {
  let best = null, bs = cone;
  for (const q of g.players) {
    if (!q.alive || !enemies(g, me, q)) continue;
    const d = Math.hypot(q.x - me.x, q.y - me.y); if (d > 780) continue;
    const off = Math.abs(angDiff(aim, Math.atan2(q.y - me.y, q.x - me.x)));
    if (off < bs && los(g.map, me.x, me.y, q.x, q.y)) { bs = off; best = q; }
  }
  if (!best) return aim;
  return lerpAng(aim, Math.atan2(best.y - me.y, best.x - me.x), 0.55);
}
