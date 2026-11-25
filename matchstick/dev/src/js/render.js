/* MATCHSTICK · renderer: camera, map, entities, effects, HUD (canvas 2D) */
const FONT_UI = '"Barlow", system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_D = '"Barlow Condensed", "Barlow", system-ui, sans-serif';
const RN = {
  cv: null, ctx: null, dpr: 1, W: 0, H: 0, S: 1, cam: { x: 0, y: 0 }, trauma: 0, shx: 0, shy: 0,
  fx: [], decals: [], marks: [], kx: 0, ky: 0, feed: [], banners: [], koNote: null, hitmark: 0, killmark: 0, dmgDirs: [], pets: {}, trailT: {}, ghostT: {},
  lowHpGrad: null, quality: 'high', fps: 0, fpsAcc: 0, fpsN: 0, hint: null, look: { x: 0, y: 0 },
};
const SAFE = { t: 0, r: 0, b: 0, l: 0 };
function rnInit(cv) { RN.cv = cv; RN.ctx = cv.getContext('2d', { alpha: false }); rnResize(); }
function rnResize() {
  const cv = RN.cv; if (!cv) return;
  RN.W = Math.max(1, cv.clientWidth || window.innerWidth); RN.H = Math.max(1, cv.clientHeight || window.innerHeight);
  const cap = RN.quality === 'high' ? 2 : 1.25;
  RN.dpr = Math.min(window.devicePixelRatio || 1, cap);
  cv.width = Math.round(RN.W * RN.dpr); cv.height = Math.round(RN.H * RN.dpr);
  const short = Math.min(RN.W, RN.H); let vis = clamp(lerp(452, 590, (short - 360) / 540), 452, 600);
  if (RN.H > RN.W && RN.W < 700) vis = 525;
  RN.S = short / vis;
  RN.lowHpGrad = null;
  readSafe();
}
function readSafe() {
  const el = document.getElementById('safeProbe'); if (!el) return;
  const cs = getComputedStyle(el);
  SAFE.t = parseFloat(cs.paddingTop) || 0; SAFE.r = parseFloat(cs.paddingRight) || 0; SAFE.b = parseFloat(cs.paddingBottom) || 0; SAFE.l = parseFloat(cs.paddingLeft) || 0;
}
function rnReset(g) {
  RN.fx.length = 0; RN.decals.length = 0; RN.marks.length = 0; RN.feed.length = 0; RN.banners.length = 0; RN.dmgDirs.length = 0; RN.pets = {}; RN.trailT = {}; RN.ghostT = {};
  RN.koNote = null; RN.hitmark = RN.killmark = 0; RN.trauma = 0; RN.snap = true;
  const h = g.players.find(p => p.human); if (h) { RN.cam.x = h.x || g.map.pw / 2; RN.cam.y = h.y || g.map.ph / 2; }
}
const fxCap = () => (RN.quality === 'high' ? 420 : 170);
function fxAdd(f) { if (RN.fx.length >= fxCap()) RN.fx.splice(0, 20); f.age = 0; RN.fx.push(f); return f; }
function decalAdd(d) { if (RN.decals.length > 46) RN.decals.shift(); d.age = 0; RN.decals.push(d); }
function shakeAdd(v) { if (!SET.shake) return; RN.trauma = Math.min(1, RN.trauma + v); }
function palOf(g, p, t) { return g.teams ? teamPal(p.team, g.map.theme.dark) : bodyPal(p.skin.color, g.map.theme.dark, t, p.id); }
function muzzleOf(p, ax) {
  const a = ax == null ? p.aim : ax, wid = p.cur === 'gun' && p.gun ? p.gun : null;
  const L = wid === 'pistol' ? 12 + 13 : wid ? 5 + W[wid].len - 2 : 20;
  return [p.x + Math.cos(a) * L - Math.sin(a) * 1.8, p.y + Math.sin(a) * L + Math.cos(a) * 1.8];
}

/* ---------- sim events → effects ---------- */
function rnEvents(g, list, me) {
  const dark = g.map.theme.dark;
  for (const e of list) {
    switch (e.t) {
      case 'shot': {
        const p = g.players[e.p]; const [mx, my] = muzzleOf(p, e.a);
        fxAdd({ k: 'muzzle', x: mx, y: my, a: e.a, life: 0.06, big: e.w === 'shotgun' || e.w === 'rifle' || e.w === 'launcher' });
        fxAdd({ k: 'flash', x: mx, y: my, r: e.w === 'shotgun' ? 60 : 40, life: 0.07, col: '#FFB54A' });
        if (e.w !== 'launcher') {
          const sa = e.a + Math.PI / 2 + rand(-0.3, 0.3);
          fxAdd({ k: 'casing', x: p.x + Math.cos(e.a) * 6, y: p.y + Math.sin(e.a) * 6, vx: Math.cos(sa) * rand(90, 150), vy: Math.sin(sa) * rand(90, 150), r: rand(0, 3), vr: rand(-18, 18), life: 0.9, col: e.w === 'shotgun' ? '#C8322A' : '#C9A227' });
        } else for (let i = 0; i < 3; i++) fxAdd({ k: 'smoke', x: mx, y: my, vx: rand(-30, 30) - Math.cos(e.a) * 60, vy: rand(-30, 30) - Math.sin(e.a) * 60, r: 5, vr: 22, life: 0.5, col: dark ? '#8A92A1' : '#C9CED6' });
        if (p === me) { shakeAdd(W[e.w].kick * 0.3); if (SET.shake) { RN.kx -= Math.cos(e.a) * W[e.w].kick * 9; RN.ky -= Math.sin(e.a) * W[e.w].kick * 9; } }
        break;
      }
      case 'bend': if (e.w === 'rifle') fxAdd({ k: 'beam', x: e.px, y: e.py, x2: e.x, y2: e.y, life: 0.22 }); break;
      case 'wall': {
        for (let i = 0; i < (e.w === 'shotgun' ? 2 : 4); i++) { const a = Math.atan2(e.ny, e.nx) + rand(-1.1, 1.1); fxAdd({ k: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * rand(160, 360), vy: Math.sin(a) * rand(160, 360), life: rand(0.12, 0.25), col: '#FFC857', len: 5 }); }
        fxAdd({ k: 'dust', x: e.x, y: e.y, r: 2, vr: 40, life: 0.3, col: dark ? '#6A7180' : '#9AA1AD' });
        if (RN.marks.length > 70) RN.marks.shift(); RN.marks.push({ x: e.x - e.nx * 1.5, y: e.y - e.ny * 1.5, r: e.w === 'shotgun' ? 1.3 : 1.8, age: 0 });
        break;
      }
      case 'hit': {
        const v = g.players[e.p], col = palOf(g, v, g.t).line;
        for (let i = 0; i < 4; i++) { const a = Math.atan2(e.dy, e.dx) + rand(-0.7, 0.7); fxAdd({ k: 'ink', x: e.x, y: e.y, vx: Math.cos(a) * rand(80, 240), vy: Math.sin(a) * rand(80, 240), r: rand(1.4, 2.8), life: rand(0.25, 0.5), col }); }
        if (me && e.by === me.id && e.p !== me.id) { RN.hitmark = 0.16; AU.play('hit', 0.9); if (SET.dmgNums) fxAdd({ k: 'num', x: e.x, y: e.y - 10, vy: -60, txt: String(e.amt), life: 0.6 }); }
        if (me && e.p === me.id) {
          const src = g.players[e.by]; shakeAdd(e.amt > 60 ? 0.55 : 0.22);
          if (src && src !== me) RN.dmgDirs.push({ a: Math.atan2(src.y - me.y, src.x - me.x), t: 0.9 });
          AU.play('hurt', 0.8); buzz(e.amt > 60 ? 40 : 18);
        } else AU.at('thud', e.x, e.y, 0.35);
        break;
      }
      case 'block': fxAdd({ k: 'ring', x: e.x, y: e.y, r: 6, vr: 60, life: 0.25, col: '#FFFFFF', w: 2 }); break;
      case 'swing': { const p = g.players[e.p]; AU.at('swing', p.x, p.y, 0.6); if (e.hits) { AU.at('smack', p.x, p.y, 1); if (p === me) { RN.hitmark = 0.16; G.hitstop = 0.05; shakeAdd(0.25); } } break; }
      case 'ko': koFx(g, e, me); break;
      case 'boom': {
        fxAdd({ k: 'flash', x: e.x, y: e.y, r: 150, life: 0.12, col: '#FFD38A' });
        fxAdd({ k: 'ring', x: e.x, y: e.y, r: 10, vr: 520, life: 0.22, col: '#FFF1C2', w: 5 });
        for (let i = 0; i < 8; i++) { const a = rand(0, TAU); fxAdd({ k: 'smoke', x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12, vx: Math.cos(a) * rand(30, 110), vy: Math.sin(a) * rand(30, 110), r: rand(10, 18), vr: 26, life: rand(0.5, 0.9), col: dark ? '#5A6170' : '#B6BCC6' }); }
        for (let i = 0; i < 12; i++) { const a = rand(0, TAU); fxAdd({ k: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * rand(250, 520), vy: Math.sin(a) * rand(250, 520), life: rand(0.2, 0.4), col: i % 2 ? '#FF7A1F' : '#FFD25A', len: 7 }); }
        decalAdd({ k: 'scorch', x: e.x, y: e.y, r: 34, life: 16, seed: Math.random() * 1000 });
        if (me) { const d = Math.hypot(me.x - e.x, me.y - e.y); shakeAdd(clamp(1 - d / 520, 0, 1) * 0.7); }
        AU.at('boom', e.x, e.y, 1.1);
        break;
      }
      case 'dash': { const p = g.players[e.p]; for (let i = 0; i < 4; i++) fxAdd({ k: 'dust', x: e.x - Math.cos(e.a) * 6 + rand(-6, 6), y: e.y - Math.sin(e.a) * 6 + rand(-6, 6), r: 4, vr: 30, life: 0.35, col: g.map.theme.dark ? '#6A7180' : '#B6BCC6' }); AU.at('dash', p.x, p.y, 0.6); break; }
      case 'pickup': {
        fxAdd({ k: 'ring', x: e.x, y: e.y, r: 10, vr: 120, life: 0.3, col: e.kind === 'health' ? '#26A065' : '#F2541B', w: 2.5 });
        if (me && e.p === me.id) { AU.play(e.kind === 'health' ? 'heal' : 'pickup', 0.8); fxAdd({ k: 'num', x: e.x, y: e.y - 18, vy: -40, txt: e.kind === 'health' ? '+50' : W[e.kind].name, life: 0.9, col: e.kind === 'health' ? '#26A065' : null }); }
        break;
      }
      case 'empty': if (me && e.p === me.id) { AU.play('dry', 0.8); RN.koNote = { txt: 'Out of ammo', sub: 'Back to melee', t: 1.2 }; } break;
      case 'swap': if (me && e.p === me.id) AU.play('swap', 0.5); break;
      case 'spawn': { const p = g.players[e.p]; fxAdd({ k: 'ring', x: e.x, y: e.y, r: 8, vr: 90, life: 0.35, col: palOf(g, p, g.t).line, w: 2 }); if (p === me) AU.play('spawn', 0.5); break; }
      case 'respawnItem': fxAdd({ k: 'ring', x: e.x, y: e.y, r: 4, vr: 70, life: 0.3, col: g.map.theme.paint, w: 1.6 }); break;
      case 'overtime': banner('Overtime', 'Next KO wins', '#F2541B'); AU.play('alarm', 0.7); break;
    }
  }
}
function teamText(t, dark) { return dark ? shade(TEAM_COL[t], 0.42) : shade(TEAM_COL[t], -0.08); }
function banner(text, sub, col, flame) { RN.banners.push({ text, sub, col, flame, t: 0, life: 1.5 }); if (RN.banners.length > 3) RN.banners.shift(); }
function koFx(g, e, me) {
  const v = g.players[e.v], k = e.k >= 0 ? g.players[e.k] : null, dark = g.map.theme.dark;
  const pal = palOf(g, v, g.t), dx = e.dx || 0, dy = e.dy || 0;
  // the figure snaps apart
  const a = v.aim, ca = Math.cos(a), sa = Math.sin(a), force = e.w === 'launcher' ? 420 : e.w === 'rifle' ? 360 : 240;
  const segs = [[-0.6, -8, -0.6, 8], [-0.6, 8, 8, 6], [-0.6, -8, 6, -7], [-0.6, 0, -8.5, 0], [-8.5, -2.6, -15, -6], [-8.5, 2.6, -15, 6]];
  for (const s of segs) {
    const cx = (s[0] + s[2]) / 2, cy = (s[1] + s[3]) / 2, wx = v.x + cx * ca - cy * sa, wy = v.y + cx * sa + cy * ca;
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]), la = Math.atan2(s[3] - s[1], s[2] - s[0]) + a;
    fxAdd({ k: 'seg', x: wx, y: wy, vx: dx * force * rand(0.6, 1.2) + rand(-110, 110), vy: dy * force * rand(0.6, 1.2) + rand(-110, 110), a: la, va: rand(-14, 14), len, life: 1.7, col: pal.line, out: pal.out });
  }
  fxAdd({ k: 'head', x: v.x + ca * 2.2, y: v.y + sa * 2.2, vx: dx * force * 1.2 + rand(-60, 60), vy: dy * force * 1.2 + rand(-60, 60), a, va: rand(-10, 10), life: 1.8, pal, head: v.skin.head, r: RIG.R * (g.R.headScale || 1) });
  decalAdd({ k: 'ink', x: v.x + dx * 8, y: v.y + dy * 8, col: pal.line, life: 14, seed: Math.random() * 1000, r: 16 });
  // killer's finisher
  const fin = k && !e.self ? (k.skin.fx || 'ink') : 'ink';
  finisher(fin, v.x, v.y, pal, dark);
  AU.at('snap', v.x, v.y, 1);
  // feed
  const nameCol = p => g.teams ? teamText(p.team, dark) : null;
  RN.feed.unshift({ k: k && !e.self ? k.name : '', kc: k ? nameCol(k) : null, v: v.name, vc: nameCol(v), w: e.self ? 'self' : e.w, t: 0, mine: !!(me && (e.k === me.id || e.v === me.id)), kEm: k ? k.skin.emblem : null });
  if (RN.feed.length > 5) RN.feed.pop();
  if (!me) return;
  if (e.k === me.id && !e.self) {
    RN.killmark = 0.3; AU.play('ko', 1); buzz(12);
    RN.koNote = { txt: 'KO', sub: v.name + (e.wasLit ? ' · put out' : ''), t: 1.3 };
    if (e.first) banner('First spark', 'First KO of the match', '#F2541B', true);
    if (e.wasLit) { banner('Extinguished', v.name + ' was on a ' + e.vStreak + ' streak', '#2F80ED'); AU.play('ext', 0.9); }
    if (MULTI[e.multi]) banner(MULTI[e.multi], e.multi + ' KOs in a row, fast', '#F2541B');
    if (STREAK[e.streak]) { banner(STREAK[e.streak], e.streak + ' KOs without dying', '#F2541B', e.streak >= LIT_AT); if (e.streak === LIT_AT) AU.play('ignite', 1); }
  }
  if (e.v === me.id) { RN.koNote = null; RN.deathBy = k && !e.self ? k.id : -1; RN.deathW = e.w; AU.play('down', 0.8); }
  if (e.k !== me.id && k && STREAK[e.streak] && e.streak >= LIT_AT && e.streak % 5 === 0) RN.feed[0].note = k.name + ' is ' + STREAK[e.streak].toLowerCase();
}
function finisher(id, x, y, pal, dark) {
  switch (id) {
    case 'smoke': for (let i = 0; i < 7; i++) { const a = rand(0, TAU); fxAdd({ k: 'smoke', x, y, vx: Math.cos(a) * rand(40, 90), vy: Math.sin(a) * rand(40, 90), r: rand(8, 13), vr: 18, life: 0.8, col: dark ? '#6A7180' : '#C2C8D1' }); } break;
    case 'pixels': for (let i = 0; i < 18; i++) { const a = rand(0, TAU); fxAdd({ k: 'px', x, y, vx: Math.cos(a) * rand(120, 300), vy: Math.sin(a) * rand(120, 300), s: rand(2.5, 4.5), life: rand(0.4, 0.8), col: i % 3 ? pal.line : '#FFFFFF' }); } break;
    case 'confetti': for (let i = 0; i < 26; i++) { const a = rand(0, TAU); fxAdd({ k: 'conf', x, y, vx: Math.cos(a) * rand(100, 280), vy: Math.sin(a) * rand(100, 280), r: rand(0, TAU), vr: rand(-12, 12), life: rand(0.7, 1.2), col: pick(['#E5483D', '#F2C14E', '#2F80ED', '#26A065', '#E5559C', '#8A4FD8']) }); } break;
    case 'shatter': for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + rand(-0.2, 0.2); fxAdd({ k: 'shard', x, y, vx: Math.cos(a) * rand(260, 420), vy: Math.sin(a) * rand(260, 420), a, life: 0.45, col: dark ? '#E9ECF2' : '#FFFFFF' }); } fxAdd({ k: 'ring', x, y, r: 6, vr: 260, life: 0.25, col: dark ? '#E9ECF2' : '#FFFFFF', w: 3 }); break;
    case 'firework': for (let i = 0; i < 20; i++) { const a = i * TAU / 20; fxAdd({ k: 'spark', x, y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 0.5, col: ['#F2C14E', '#E5483D', '#2F80ED', '#26A065'][i % 4], len: 8 }); } fxAdd({ k: 'ring', x, y, r: 8, vr: 300, life: 0.3, col: '#F2C14E', w: 2 }); break;
    default: for (let i = 0; i < 6; i++) { const a = rand(0, TAU); fxAdd({ k: 'ink', x, y, vx: Math.cos(a) * rand(100, 260), vy: Math.sin(a) * rand(100, 260), r: rand(2, 3.6), life: rand(0.3, 0.55), col: pal.line }); }
  }
}

/* ---------- per-frame ---------- */
function rnUpdate(g, dt, me) {
  for (let i = RN.fx.length - 1; i >= 0; i--) {
    const f = RN.fx[i]; f.age += dt;
    if (f.age >= f.life) { RN.fx.splice(i, 1); continue; }
    if (f.vx != null) {
      const fr = f.k === 'seg' || f.k === 'head' ? 4.5 : f.k === 'casing' ? 5 : f.k === 'conf' ? 2.2 : f.k === 'smoke' ? 2.5 : 1.5;
      const damp = Math.exp(-fr * dt); f.vx *= damp; f.vy *= damp; f.x += f.vx * dt; f.y += f.vy * dt;
      if ((f.k === 'seg' || f.k === 'head' || f.k === 'casing') && g && blockedAt(g.map, f.x, f.y)) { f.x -= f.vx * dt; f.y -= f.vy * dt; f.vx *= -0.4; f.vy *= -0.4; }
    }
    if (f.va) { f.a += f.va * dt; f.va *= Math.exp(-3 * dt); }
    if (f.vr && f.k !== 'conf' && f.k !== 'casing') f.r += f.vr * dt;
    if (f.k === 'conf' || f.k === 'casing') f.r += f.vr * dt;
    if (f.k === 'ember') { f.y -= 26 * dt; f.x += Math.sin(f.age * 9 + f.seed) * 10 * dt; }
    if (f.k === 'num') f.y += f.vy * dt;
  }
  for (let i = RN.decals.length - 1; i >= 0; i--) { const d = RN.decals[i]; d.age += dt; if (d.age > d.life) RN.decals.splice(i, 1); }
  for (const f of RN.feed) f.t += dt; while (RN.feed.length && RN.feed[RN.feed.length - 1].t > 5.5) RN.feed.pop();
  for (const b of RN.banners) b.t += dt; while (RN.banners.length && RN.banners[0].t > RN.banners[0].life) RN.banners.shift();
  for (let i = RN.dmgDirs.length - 1; i >= 0; i--) { RN.dmgDirs[i].t -= dt; if (RN.dmgDirs[i].t <= 0) RN.dmgDirs.splice(i, 1); }
  if (RN.koNote) { RN.koNote.t -= dt; if (RN.koNote.t <= 0) RN.koNote = null; }
  RN.hitmark = Math.max(0, RN.hitmark - dt); RN.killmark = Math.max(0, RN.killmark - dt);
  RN.trauma = Math.max(0, RN.trauma - dt * 1.8);
  RN.kx = approach(RN.kx, 0, 14, dt); RN.ky = approach(RN.ky, 0, 14, dt);
  const tr = RN.trauma * RN.trauma; RN.shx = (Math.random() * 2 - 1) * tr * 9; RN.shy = (Math.random() * 2 - 1) * tr * 9;
  if (!g) return;
  // cosmetics that emit while moving
  for (const p of g.players) {
    if (!p.alive) continue;
    const pet = RN.pets[p.id] || (RN.pets[p.id] = { x: p.x - 20, y: p.y - 20, a: 0 });
    const side = p.id % 2 ? 1 : -1, oa = p.aim + Math.PI + side * 0.9;
    const tx = p.x + Math.cos(oa) * 26, ty = p.y + Math.sin(oa) * 26;
    const pa = Math.atan2(ty - pet.y, tx - pet.x);
    pet.x = approach(pet.x, tx, 5, dt); pet.y = approach(pet.y, ty, 5, dt);
    if (Math.hypot(tx - pet.x, ty - pet.y) > 3) pet.a = lerpAng(pet.a, pa, 0.15);
    const trail = p.skin.trail;
    if (p.move > 0.35 && trail && trail !== 'none' && RN.quality === 'high') {
      RN.trailT[p.id] = (RN.trailT[p.id] || 0) - dt;
      if (RN.trailT[p.id] <= 0) { RN.trailT[p.id] = trail === 'prints' ? 0.14 : 0.06; emitTrail(g, p, trail); }
    }
    if (p.streak >= LIT_AT && Math.random() < dt * 16) fxAdd({ k: 'ember', x: p.x + rand(-6, 6), y: p.y - 10, r: rand(1, 2.2), life: rand(0.4, 0.8), col: pick(FLAME), seed: Math.random() * 9 });
    if (p.dashT > 0) { RN.ghostT[p.id] = (RN.ghostT[p.id] || 0) - dt; if (RN.ghostT[p.id] <= 0) { RN.ghostT[p.id] = 0.035; fxAdd({ k: 'ghost', x: p.x, y: p.y, a: p.aim, life: 0.2, p: p.id, weapon: p.cur === 'gun' && p.gun ? p.gun : 'melee' }); } }
  }
}
function emitTrail(g, p, kind) {
  const col = palOf(g, p, g.t).line, back = p.aim + Math.PI;
  const bx = p.x + Math.cos(back) * 12, by = p.y + Math.sin(back) * 12;
  switch (kind) {
    case 'prints': { RN.trailT['s' + p.id] = !RN.trailT['s' + p.id]; const s = RN.trailT['s' + p.id] ? 1 : -1, a = Math.atan2(p.vy, p.vx); fxAdd({ k: 'print', x: p.x - Math.sin(a) * 3 * s - Math.cos(a) * 10, y: p.y + Math.cos(a) * 3 * s - Math.sin(a) * 10, a, life: 1.4, col }); break; }
    case 'lines': fxAdd({ k: 'streak', x: bx, y: by, a: Math.atan2(p.vy, p.vx), life: 0.25, col }); break;
    case 'sparks': fxAdd({ k: 'spark', x: bx, y: by, vx: rand(-60, 60), vy: rand(-60, 60), life: 0.25, col: '#FFC857', len: 4 }); break;
    case 'pixels': fxAdd({ k: 'px', x: bx + rand(-5, 5), y: by + rand(-5, 5), vx: 0, vy: 0, s: rand(2, 3.5), life: 0.5, col }); break;
    case 'hearts': fxAdd({ k: 'heart', x: bx + rand(-4, 4), y: by + rand(-4, 4), vx: 0, vy: -20, life: 0.7, col: '#E5559C' }); break;
    case 'confetti': fxAdd({ k: 'conf', x: bx, y: by, vx: rand(-50, 50), vy: rand(-50, 50), r: rand(0, TAU), vr: rand(-10, 10), life: 0.7, col: pick(['#E5483D', '#F2C14E', '#2F80ED', '#26A065']) }); break;
    case 'embers': fxAdd({ k: 'ember', x: bx + rand(-4, 4), y: by + rand(-4, 4), r: rand(1, 2), life: 0.6, col: pick(FLAME), seed: Math.random() * 9 }); break;
  }
}

/* ---------- draw ---------- */
function rnFrame(g, alpha, dt, me, view) {
  const ctx = RN.ctx, dpr = RN.dpr, Wd = RN.W, Hd = RN.H, S = RN.S, th = g.map.theme;
  // camera follows you, a little ahead of where you aim
  let fx, fy;
  const follow = me && me.alive ? me : (RN.deathBy >= 0 && g.players[RN.deathBy] && g.players[RN.deathBy].alive ? g.players[RN.deathBy] : null);
  if (follow) { fx = lerp(follow.px, follow.x, alpha); fy = lerp(follow.py, follow.y, alpha); } else if (me) { fx = me.x; fy = me.y; } else { fx = g.map.pw / 2; fy = g.map.ph / 2; }
  const lk = me && me.alive ? RN.look : { x: 0, y: 0 };
  let tcx = fx + lk.x, tcy = fy + lk.y;
  const vwC = Wd / S, vhC = Hd / S, mg = 24;
  tcx = vwC >= g.map.pw ? clamp(tcx, g.map.pw - vwC / 2, vwC / 2) : clamp(tcx, vwC / 2 - mg, g.map.pw - vwC / 2 + mg);
  tcy = vhC >= g.map.ph ? clamp(tcy, g.map.ph - vhC / 2, vhC / 2) : clamp(tcy, vhC / 2 - mg, g.map.ph - vhC / 2 + mg);
  if (RN.snap) { RN.cam.x = tcx; RN.cam.y = tcy; RN.snap = false; }
  RN.cam.x = approach(RN.cam.x, tcx, 9, dt); RN.cam.y = approach(RN.cam.y, tcy, 9, dt);
  const cx = RN.cam.x + RN.shx + RN.kx, cy = RN.cam.y + RN.shy + RN.ky;
  const vw = Wd / S, vh = Hd / S, x0 = cx - vw / 2, y0 = cy - vh / 2, x1 = x0 + vw, y1 = y0 + vh;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = th.out || (th.out = th.dark ? shade(th.floor, -0.4) : mix(th.floor, th.wall, 0.16)); ctx.fillRect(0, 0, Wd, Hd);
  ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * (Wd / 2 - cx * S), dpr * (Hd / 2 - cy * S));
  if (x0 < 0 || y0 < 0 || x1 > g.map.pw || y1 > g.map.ph) { ctx.fillStyle = hatchFor(ctx, th); ctx.fillRect(x0 - 40, y0 - 40, vw + 80, vh + 80); }
  const t = g.t;
  // floor
  ctx.fillStyle = th.floor; ctx.fillRect(0, 0, g.map.pw, g.map.ph);
  const gx0 = Math.max(0, Math.floor(x0 / TILE) * TILE), gx1 = Math.min(g.map.pw, x1), gy0 = Math.max(0, Math.floor(y0 / TILE) * TILE), gy1 = Math.min(g.map.ph, y1);
  ctx.lineWidth = 1 / S; ctx.strokeStyle = rgba(th.ink, th.grid); ctx.beginPath();
  for (let x = gx0; x <= gx1; x += TILE) { ctx.moveTo(x, gy0); ctx.lineTo(x, gy1); }
  for (let y = gy0; y <= gy1; y += TILE) { ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); }
  ctx.stroke();
  ctx.lineWidth = 1.6 / S; ctx.strokeStyle = rgba(th.ink, th.slab); ctx.beginPath();
  for (let x = Math.ceil(gx0 / 160) * 160; x <= gx1; x += 160) { ctx.moveTo(x, gy0); ctx.lineTo(x, gy1); }
  for (let y = Math.ceil(gy0 / 160) * 160; y <= gy1; y += 160) { ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); }
  ctx.stroke();
  // floor paint: centre ring + spawn pads
  ctx.strokeStyle = rgba(th.paint, th.dark ? 0.42 : 0.4); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(g.map.pw / 2, g.map.ph / 2, 96, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.arc(g.map.pw / 2, g.map.ph / 2, 120, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = rgba(th.paint, 0.22); ctx.lineWidth = 2;
  for (const s of g.map.spawns) { ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s.x - 5, s.y); ctx.lineTo(s.x + 5, s.y); ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x, s.y + 5); ctx.stroke(); }
  if (g.teams) for (let side = 0; side < 2; side++) { ctx.fillStyle = rgba(TEAM_COL[side], 0.05); const sx = side ? g.map.pw - 6 * TILE : 0; ctx.fillRect(sx, 0, 6 * TILE, g.map.ph); }
  // decals
  for (const d of RN.decals) {
    const a = clamp(1 - (d.age - d.life * 0.6) / (d.life * 0.4), 0, 1);
    if (d.x < x0 - 60 || d.x > x1 + 60 || d.y < y0 - 60 || d.y > y1 + 60) continue;
    if (d.k === 'ink') { ctx.fillStyle = rgba(d.col, (th.dark ? 0.32 : 0.24) * a); const r = seeded(d.seed | 0); ctx.beginPath(); for (let i = 0; i < 9; i++) { const aa = r() * TAU, dd = r() * d.r, rr2 = 3 + r() * 7; ctx.moveTo(d.x + Math.cos(aa) * dd + rr2, d.y + Math.sin(aa) * dd); ctx.arc(d.x + Math.cos(aa) * dd, d.y + Math.sin(aa) * dd, rr2, 0, TAU); } ctx.fill(); }
    else if (d.k === 'scorch') { ctx.fillStyle = rgba('#000000', (th.dark ? 0.35 : 0.13) * a); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill(); }
  }
  // wall shadows, low walls, walls
  ctx.fillStyle = th.shadow; ctx.beginPath();
  for (const r of g.map.walls) if (r.x < x1 + 10 && r.x + r.w > x0 - 10 && r.y < y1 + 10 && r.y + r.h > y0 - 10) ctx.rect(r.x + 5, r.y + 7, r.w, r.h);
  for (const r of g.map.lows) if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) ctx.rect(r.x + 3, r.y + 4, r.w, r.h);
  ctx.fill();
  for (const r of g.map.lows) {
    if (!(r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0)) continue;
    ctx.fillStyle = th.low; ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.fillStyle = th.lowHi; ctx.fillRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14);
    if (g.map.themeId === 'greenhouse') { ctx.fillStyle = '#5E8F4A'; for (let xx = r.x + 14; xx < r.x + r.w - 6; xx += 18) for (let yy = r.y + 14; yy < r.y + r.h - 6; yy += 18) { ctx.beginPath(); ctx.arc(xx, yy, 5, 0, TAU); ctx.fill(); } }
  }
  ctx.fillStyle = th.wall; ctx.beginPath();
  for (const r of g.map.walls) if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) ctx.rect(r.x, r.y, r.w, r.h);
  ctx.fill();
  ctx.strokeStyle = th.wallHi; ctx.lineWidth = 2; ctx.beginPath();
  for (const r of g.map.walls) if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) { ctx.moveTo(r.x + 1, r.y + r.h - 1); ctx.lineTo(r.x + 1, r.y + 1); ctx.lineTo(r.x + r.w - 1, r.y + 1); }
  ctx.stroke();
  // bullet marks on wall faces
  ctx.fillStyle = th.dark ? 'rgba(0,0,0,0.5)' : 'rgba(10,12,16,0.55)';
  for (const m of RN.marks) if (m.x > x0 && m.x < x1 && m.y > y0 && m.y < y1) { ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); }
  // pickups
  for (const k of g.pickups) if (k.x > x0 - 30 && k.x < x1 + 30 && k.y > y0 - 30 && k.y < y1 + 30) drawPickup(ctx, k, t, th.dark);
  // under-figure effects
  for (const f of RN.fx) if (f.k === 'print' || f.k === 'seg' || f.k === 'head' || f.k === 'casing') drawFx(ctx, f, g);
  // your ring
  if (me && me.alive) { const mx = lerp(me.px, me.x, alpha), my = lerp(me.py, me.y, alpha); ctx.strokeStyle = rgba(th.dark ? '#FFFFFF' : INK, 0.22); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 20, 0, TAU); ctx.stroke(); }
  // rifle laser sights
  for (const p of g.players) {
    if (!p.alive || p.cur !== 'gun' || p.gun !== 'rifle') continue;
    const a = p === me ? p.in.aim : lerpAng(p.paim, p.aim, alpha), px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
    const ex = px + Math.cos(a) * 1600, ey = py + Math.sin(a) * 1600, wh = rayWall(g.map, px, py, ex, ey, false);
    const tx = wh ? wh.x : ex, ty = wh ? wh.y : ey;
    ctx.strokeStyle = rgba('#F2541B', p.fireCD > 0.2 ? 0.12 : 0.38); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 38, py + Math.sin(a) * 38); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = '#F2541B'; ctx.beginPath(); ctx.arc(tx, ty, 2.2, 0, TAU); ctx.fill();
  }
  // figures
  const hs = g.R.headScale || 1;
  for (const f of RN.fx) if (f.k === 'ghost') { const p = g.players[f.p]; drawStick(ctx, { x: f.x, y: f.y, aim: f.a, move: 1, walk: 0, weapon: f.weapon, melee: p.skin.melee, head: p.skin.head, pal: palOf(g, p, t), alpha: 0.28 * (1 - f.age / f.life), t, dark: th.dark, noShadow: true, noFx: true, headScale: hs }); }
  for (const p of g.players) {
    if (!p.alive) continue;
    const px = lerp(p.px, p.x, alpha), py = lerp(p.py, p.y, alpha);
    if (px < x0 - 60 || px > x1 + 60 || py < y0 - 60 || py > y1 + 60) continue;
    const aim = p === me ? p.in.aim : lerpAng(p.paim, p.aim, alpha);
    const pet = RN.pets[p.id]; if (pet && p.skin.pet && p.skin.pet !== 'none') drawPet(ctx, p.skin.pet, pet.x, pet.y, pet.a, t + p.id, 1, th.dark);
    drawStick(ctx, { x: px, y: py, aim, moveA: Math.atan2(p.vy, p.vx), move: p.move, walk: p.walk, swingT: p.swingT, swingSide: p.swingSide, recoil: p.recoil,
      weapon: p.cur === 'gun' && p.gun ? p.gun : 'melee', melee: p.skin.melee, head: p.skin.head, pal: palOf(g, p, t), hurt: p.hurt, t: t + p.id * 1.7,
      lit: p.streak >= LIT_AT, dark: th.dark, spawnFx: p.spawnFx, seed: p.id, headScale: hs });
    if (p.spawnT > 0) { ctx.strokeStyle = rgba(th.dark ? '#FFFFFF' : INK, 0.35); ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(px, py, 24, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
  // projectiles
  ctx.lineCap = 'round';
  for (const b of g.bullets) {
    const bx = lerp(b.px, b.x, alpha), by = lerp(b.py, b.y, alpha), sp = Math.hypot(b.vx, b.vy);
    const L = Math.min(b.age * sp, b.w === 'rifle' ? 70 : b.w === 'shotgun' ? 16 : 28);
    ctx.strokeStyle = th.tracer; ctx.lineWidth = b.w === 'rifle' ? 2.6 : b.w === 'shotgun' ? 1.8 : 2.2;
    ctx.beginPath(); ctx.moveTo(bx - b.vx / sp * L, by - b.vy / sp * L); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = '#FFB54A'; ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, TAU); ctx.fill();
  }
  for (const r of g.rockets) {
    const rx = lerp(r.px, r.x, alpha), ry = lerp(r.py, r.y, alpha);
    if (Math.random() < 0.7) fxAdd({ k: 'smoke', x: rx - Math.cos(r.a) * 10, y: ry - Math.sin(r.a) * 10, vx: rand(-15, 15), vy: rand(-15, 15), r: 3, vr: 18, life: 0.45, col: th.dark ? '#5A6170' : '#C9CED6' });
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(r.a);
    ctx.fillStyle = '#3F6B3F'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; rr(ctx, -9, -3, 15, 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E5483D'; ctx.beginPath(); ctx.arc(6, 0, 3, -1.57, 1.57); ctx.fill();
    ctx.fillStyle = '#FFB54A'; ctx.beginPath(); ctx.moveTo(-9, -2.4); ctx.lineTo(-16 - Math.random() * 5, 0); ctx.lineTo(-9, 2.4); ctx.fill();
    ctx.restore();
  }
  // over-figure effects
  for (const f of RN.fx) if (f.k !== 'print' && f.k !== 'seg' && f.k !== 'head' && f.k !== 'casing' && f.k !== 'ghost') drawFx(ctx, f, g);
  // ---------- screen space ----------
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const toS = (x, y) => [(x - cx) * S + Wd / 2, (y - cy) * S + Hd / 2];
  const txt = th.dark ? '#F4F5F7' : INK, halo = th.dark ? 'rgba(10,12,16,0.85)' : 'rgba(255,255,255,0.88)';
  // name tags
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const p of g.players) {
    if (!p.alive || p === me) continue;
    const [sx, sy] = toS(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha));
    if (sx < -60 || sx > Wd + 60 || sy < -40 || sy > Hd + 60) continue;
    const ny = sy - 26 * S - (p.streak >= LIT_AT ? 14 : 0);
    const col = g.teams ? teamText(p.team, g.map.theme.dark) : txt;
    const under = ny < SAFE.t + 70 ? 0.25 : 1; if (under < 1) ctx.globalAlpha = under;
    hudText(ctx, p.name, sx, ny, '600 12px ' + FONT_UI, col, halo, 'center');
    if (p.streak >= 3) { const w = ctx.measureText(p.name).width; hudText(ctx, String(p.streak), sx + w / 2 + 10, ny, 'italic 700 13px ' + FONT_D, '#F2541B', halo, 'center'); }
    if (g.t - p.lastHurtT < 2.5 && p.hp < 100 && (!g.teams || !me || p.team !== me.team)) {
      ctx.fillStyle = th.dark ? 'rgba(255,255,255,0.18)' : 'rgba(20,24,32,0.16)'; ctx.fillRect(sx - 16, ny + 4, 32, 3);
      ctx.fillStyle = p.hp < 35 ? '#E5483D' : (th.dark ? '#F4F5F7' : INK); ctx.fillRect(sx - 16, ny + 4, 32 * clamp(p.hp / 100, 0, 1), 3);
    }
    ctx.globalAlpha = 1;
    if (p.emoteT > 0) { const a = Math.min(1, p.emoteT * 3); ctx.globalAlpha = a; bubble(ctx, p.emote, sx, ny - 18); ctx.globalAlpha = 1; }
  }
  if (me && me.alive && me.emoteT > 0) { const [sx, sy] = toS(me.x, me.y); ctx.globalAlpha = Math.min(1, me.emoteT * 3); bubble(ctx, me.emote, sx, sy - 30 * S - 18); ctx.globalAlpha = 1; }
  if (view.hud) drawHUD(ctx, g, me, view, txt, halo, toS, dt);
}
function hatchFor(ctx, th) {
  if (th._hatch) return th._hatch;
  const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d');
  x.strokeStyle = th.dark ? 'rgba(255,255,255,0.05)' : 'rgba(27,30,37,0.07)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(-6, 30); x.lineTo(30, -6); x.moveTo(-6, 6); x.lineTo(6, -6); x.moveTo(18, 30); x.lineTo(30, 18); x.stroke();
  th._hatch = ctx.createPattern(c, 'repeat'); return th._hatch;
}
function hudText(ctx, s, x, y, font, fill, halo, align, base) {
  ctx.font = font; ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'alphabetic';
  if (halo) { ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.strokeStyle = halo; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function bubble(ctx, s, x, y) {
  ctx.font = '600 12px ' + FONT_UI; const w = ctx.measureText(s).width + 16;
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(20,24,32,0.18)'; ctx.lineWidth = 1;
  rr(ctx, x - w / 2, y - 22, w, 22, 11); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x, y + 5); ctx.lineTo(x + 5, y - 1); ctx.fill();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y - 11);
}
function drawFx(ctx, f, g) {
  const k = 1 - f.age / f.life;
  switch (f.k) {
    case 'muzzle': {
      const s = f.big ? 1.5 : 1; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.fillStyle = '#FFD25A'; ctx.beginPath(); ctx.moveTo(0, -4 * s); ctx.lineTo(14 * s, 0); ctx.lineTo(0, 4 * s); ctx.lineTo(4 * s, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFF6D6'; ctx.beginPath(); ctx.arc(2, 0, 3 * s, 0, TAU); ctx.fill(); ctx.restore(); break;
    }
    case 'flash': { ctx.fillStyle = rgba(f.col, 0.22 * k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); break; }
    case 'beam': { ctx.strokeStyle = rgba(g.map.theme.dark ? '#FFE7A3' : '#F2541B', 0.55 * k); ctx.lineWidth = 2.6 * k + 0.4; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); break; }
    case 'spark': { const sp = Math.hypot(f.vx, f.vy) || 1; ctx.strokeStyle = rgba(f.col, k); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx / sp * f.len, f.y - f.vy / sp * f.len); ctx.stroke(); break; }
    case 'dust': case 'smoke': { ctx.fillStyle = rgba(f.col, (f.k === 'smoke' ? 0.5 : 0.4) * k); ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0.5, f.r), 0, TAU); ctx.fill(); break; }
    case 'ring': { ctx.strokeStyle = rgba(f.col, 0.8 * k); ctx.lineWidth = f.w || 2; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0.5, f.r), 0, TAU); ctx.stroke(); break; }
    case 'ink': { ctx.fillStyle = rgba(f.col, k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); break; }
    case 'casing': { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.fillStyle = rgba(f.col, Math.min(1, k * 2)); ctx.fillRect(-2, -1, 4, 2); ctx.restore(); break; }
    case 'seg': { const a = Math.min(1, k * 2.2), c = Math.cos(f.a) * f.len / 2, s = Math.sin(f.a) * f.len / 2; ctx.lineCap = 'round'; ctx.globalAlpha = a; ctx.strokeStyle = f.out; ctx.lineWidth = RIG.LW + RIG.OW; ctx.beginPath(); ctx.moveTo(f.x - c, f.y - s); ctx.lineTo(f.x + c, f.y + s); ctx.stroke(); ctx.strokeStyle = f.col; ctx.lineWidth = RIG.LW; ctx.stroke(); ctx.globalAlpha = 1; break; }
    case 'head': { ctx.save(); ctx.globalAlpha = Math.min(1, k * 2.2); ctx.translate(f.x, f.y); ctx.rotate(f.a); drawHead(ctx, f.head, f.r, f.pal, 0, { move: 0, walk: 0 }); ctx.restore(); break; }
    case 'num': { hudTextWorld(ctx, f.txt, f.x, f.y, k, f.col, g.map.theme.dark); break; }
    case 'px': { ctx.fillStyle = rgba(f.col, k); ctx.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s); break; }
    case 'conf': { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.fillStyle = rgba(f.col, Math.min(1, k * 2)); ctx.fillRect(-2.5, -1.2, 5, 2.4); ctx.restore(); break; }
    case 'shard': { const c = Math.cos(f.a), s = Math.sin(f.a); ctx.fillStyle = rgba(f.col, k); ctx.beginPath(); ctx.moveTo(f.x + c * 8, f.y + s * 8); ctx.lineTo(f.x - s * 2, f.y + c * 2); ctx.lineTo(f.x + s * 2, f.y - c * 2); ctx.closePath(); ctx.fill(); break; }
    case 'ember': { ctx.fillStyle = rgba(f.col, k); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); break; }
    case 'heart': { ctx.fillStyle = rgba(f.col, k); ctx.beginPath(); ctx.moveTo(f.x, f.y + 3); ctx.bezierCurveTo(f.x - 5, f.y - 1, f.x - 3, f.y - 5, f.x, f.y - 2); ctx.bezierCurveTo(f.x + 3, f.y - 5, f.x + 5, f.y - 1, f.x, f.y + 3); ctx.fill(); break; }
    case 'print': { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.fillStyle = rgba(f.col, 0.35 * k); ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 2, 0, 0, TAU); ctx.fill(); ctx.restore(); break; }
    case 'streak': { ctx.strokeStyle = rgba(f.col, 0.5 * k); ctx.lineWidth = 1.5; const c = Math.cos(f.a), s = Math.sin(f.a); for (const o of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(f.x - s * o, f.y + c * o); ctx.lineTo(f.x - s * o - c * 16, f.y + c * o - s * 16); ctx.stroke(); } break; }
  }
}
function hudTextWorld(ctx, s, x, y, k, col, dark) {
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.font = 'italic 700 14px ' + FONT_D; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(10,12,16,0.85)' : 'rgba(255,255,255,0.9)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col || (dark ? '#F4F5F7' : INK); ctx.fillText(s, x, y); ctx.restore();
}

/* ---------- HUD ---------- */
function drawHUD(ctx, g, me, view, txt, halo, toS, dt) {
  const Wd = RN.W, Hd = RN.H, L = SAFE.l + 16, R = Wd - SAFE.r - 16, T = SAFE.t + 14, B = Hd - SAFE.b - 16;
  const touch = view.touch;
  // low-health vignette
  if (me && me.alive && me.hp < 40) {
    if (!RN.lowHpGrad) { const gr = ctx.createRadialGradient(Wd / 2, Hd / 2, Math.min(Wd, Hd) * 0.35, Wd / 2, Hd / 2, Math.max(Wd, Hd) * 0.75); gr.addColorStop(0, 'rgba(229,72,61,0)'); gr.addColorStop(1, 'rgba(229,72,61,0.38)'); RN.lowHpGrad = gr; }
    ctx.globalAlpha = clamp((40 - me.hp) / 30, 0, 1) * (0.75 + 0.25 * Math.sin(g.t * 6)); ctx.fillStyle = RN.lowHpGrad; ctx.fillRect(0, 0, Wd, Hd); ctx.globalAlpha = 1;
  }
  // damage direction
  for (const d of RN.dmgDirs) {
    const a = d.a, rr2 = Math.min(Wd, Hd) * 0.22;
    ctx.strokeStyle = rgba('#E5483D', Math.min(1, d.t * 1.6) * 0.85); ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(Wd / 2, Hd / 2, rr2, a - 0.32, a + 0.32); ctx.stroke();
  }
  // score + timer
  const narrow = Wd < 640, cxm = narrow ? R - 82 : Wd / 2;
  const time = g.overtime ? 'OT ' + fmtTime(g.otT) : fmtTime(g.timeLeft);
  if (g.teams) {
    const my = me ? me.team : 0, ot = 1 - my;
    hudText(ctx, String(g.teamScore[my]), cxm - 56, T + 26, 'italic 700 30px ' + FONT_D, teamText(my, g.map.theme.dark), halo, 'right');
    hudText(ctx, String(g.teamScore[ot]), cxm + 56, T + 26, 'italic 700 30px ' + FONT_D, teamText(ot, g.map.theme.dark), halo, 'left');
    hudText(ctx, time, cxm, T + 22, 'italic 700 22px ' + FONT_D, g.timeLeft < 30 && !g.overtime ? '#E5483D' : txt, halo, 'center');
    hudText(ctx, 'First to ' + g.R.target, cxm, T + 40, '500 11px ' + FONT_UI, txt, halo, 'center');
  } else {
    const st = standings(g), rank = me ? st.indexOf(me) + 1 : 0;
    const lead = st[0], rival = me && lead === me ? st[1] : lead;
    hudText(ctx, time, cxm, T + 22, 'italic 700 22px ' + FONT_D, g.timeLeft < 30 && !g.overtime ? '#E5483D' : txt, halo, 'center');
    if (me) {
      hudText(ctx, String(me.kills), cxm - 52, T + 26, 'italic 700 30px ' + FONT_D, txt, halo, 'right');
      hudText(ctx, ordinal(rank), cxm - 52, T + 41, '600 11px ' + FONT_UI, rank === 1 ? '#F2541B' : txt, halo, 'right');
      if (rival) { hudText(ctx, String(rival.kills), cxm + 52, T + 26, 'italic 700 30px ' + FONT_D, txt, halo, 'left'); hudText(ctx, rival === lead ? 'Leader' : '2nd', cxm + 52, T + 41, '500 11px ' + FONT_UI, txt, halo, 'left'); }
    }
    hudText(ctx, 'First to ' + g.R.target, cxm, T + 40, '500 11px ' + FONT_UI, txt, halo, 'center');
  }
  // kill feed
  ctx.textBaseline = 'middle';
  let fy = narrow ? T + 66 : T + 12;
  const feedR = R, maxFeed = narrow || Hd < 520 ? 3 : 5;
  for (let i = 0; i < Math.min(RN.feed.length, maxFeed); i++) {
    const f = RN.feed[i], a = clamp((5.5 - f.t) * 2, 0, 1); ctx.globalAlpha = a;
    ctx.font = '600 12px ' + FONT_UI;
    const vw = ctx.measureText(f.v).width, kw = f.k ? ctx.measureText(f.k).width : 0, total = kw + vw + 34 + (f.k ? 8 : 0);
    if (Wd < 520 && i === 0 && false) {}
    let x = feedR;
    if (f.mine) { ctx.fillStyle = rgba('#F2541B', 0.16); rr(ctx, x - total - 6, fy - 10, total + 12, 20, 10); ctx.fill(); }
    hudText(ctx, f.v, x, fy, '600 12px ' + FONT_UI, f.vc || txt, halo, 'right', 'middle'); x -= vw + 16;
    drawWeaponIcon(ctx, f.w, x, fy, 0.8, f.mine ? '#F2541B' : txt); x -= 18;
    if (f.k) hudText(ctx, f.k, x, fy, '600 12px ' + FONT_UI, f.kc || txt, halo, 'right', 'middle');
    fy += 22;
    if (f.note) { hudText(ctx, f.note, feedR, fy, '500 11px ' + FONT_UI, '#F2541B', halo, 'right', 'middle'); fy += 18; }
  }
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  if (!me) return;
  // banners
  const bcx = Wd / 2;
  let by = Hd * 0.24;
  for (const b of RN.banners) {
    const k = b.t / b.life, inn = ease.back(Math.min(1, b.t / 0.18)), out = clamp((b.life - b.t) / 0.25, 0, 1);
    ctx.save(); ctx.globalAlpha = out; ctx.translate(bcx, by); ctx.scale(0.7 + 0.3 * inn, 0.7 + 0.3 * inn);
    hudText(ctx, b.text, 0, 0, 'italic 700 38px ' + FONT_D, b.col || txt, halo, 'center');
    if (b.sub) hudText(ctx, b.sub, 0, 20, '500 13px ' + FONT_UI, txt, halo, 'center');
    if (b.flame) { ctx.font = 'italic 700 38px ' + FONT_D; const w = ctx.measureText(b.text).width; drawFlame(ctx, w / 2 + 14, -12, 0.85, g.t, 3); }
    ctx.restore(); by += 58; if (k > 1) continue;
  }
  if (!me.alive) {
    ctx.fillStyle = 'rgba(15,17,22,0.18)'; ctx.fillRect(0, 0, Wd, Hd);
    const killer = RN.deathBy >= 0 ? g.players[RN.deathBy] : null;
    hudText(ctx, killer ? 'KO’d by ' + killer.name : 'KO’d', bcx, Hd * 0.62, 'italic 700 30px ' + FONT_D, txt, halo, 'center');
    if (!g.over) hudText(ctx, 'Back in ' + Math.max(0, me.respawnT).toFixed(1), bcx, Hd * 0.62 + 24, '500 13px ' + FONT_UI, txt, halo, 'center');
    return;
  }
  // KO note
  if (RN.koNote) { const a = Math.min(1, RN.koNote.t * 3); ctx.globalAlpha = a; hudText(ctx, RN.koNote.txt, bcx, Hd * 0.7, 'italic 700 26px ' + FONT_D, RN.koNote.txt === 'KO' ? '#F2541B' : txt, halo, 'center'); hudText(ctx, RN.koNote.sub, bcx, Hd * 0.7 + 18, '500 12px ' + FONT_UI, txt, halo, 'center'); ctx.globalAlpha = 1; }
  // health
  const hpY = B - (touch ? 0 : 0);
  const hpX = touch ? L : L;
  if (!touch) {
    hudText(ctx, String(Math.ceil(me.hp)), hpX, hpY - 12, 'italic 700 32px ' + FONT_D, me.hp < 35 ? '#E5483D' : txt, halo, 'left');
    ctx.fillStyle = g.map.theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(20,24,32,0.14)'; rr(ctx, hpX, hpY - 6, 130, 6, 3); ctx.fill();
    ctx.fillStyle = me.hp < 35 ? '#E5483D' : (g.map.theme.dark ? '#F4F5F7' : INK); rr(ctx, hpX, hpY - 6, Math.max(6, 130 * me.hp / 100), 6, 3); ctx.fill();
    if (me.streak >= 2) { hudText(ctx, 'Streak ' + me.streak, hpX + 50, hpY - 13, '600 12px ' + FONT_UI, me.streak >= LIT_AT ? '#F2541B' : txt, halo, 'left'); if (me.streak >= LIT_AT) drawFlame(ctx, hpX + 120, hpY - 22, 0.5, g.t, 1); }
  }
  // weapon + ammo
  const wid = me.cur === 'gun' && me.gun ? me.gun : 'melee';
  const wName = wid === 'melee' ? (findItem('melee', me.skin.melee) || { name: 'Melee' }).name : W[wid].name;
  const ammo = wid === 'melee' ? '' : (g.R.infAmmo ? '∞' : String(me.ammo));
  if (touch) {
    const ax = view.ammoX, ay = view.ammoY;
    if (ax != null) hudText(ctx, ammo, ax, ay, 'italic 700 26px ' + FONT_D, me.ammo <= 3 && ammo && !g.R.infAmmo ? '#E5483D' : txt, halo, 'right');
    if (ax != null) hudText(ctx, wName, ax - (ammo ? ctx.measureText(ammo).width + 8 : 0), ay, '600 12px ' + FONT_UI, txt, halo, 'right');
    // compact health for touch layouts
    hudText(ctx, String(Math.ceil(me.hp)), view.hpX, view.hpY, 'italic 700 26px ' + FONT_D, me.hp < 35 ? '#E5483D' : txt, halo, 'left');
    ctx.fillStyle = g.map.theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(20,24,32,0.14)'; rr(ctx, view.hpX + 40, view.hpY - 10, 90, 5, 2.5); ctx.fill();
    ctx.fillStyle = me.hp < 35 ? '#E5483D' : (g.map.theme.dark ? '#F4F5F7' : INK); rr(ctx, view.hpX + 40, view.hpY - 10, Math.max(5, 90 * me.hp / 100), 5, 2.5); ctx.fill();
    if (me.streak >= 2) hudText(ctx, 'Streak ' + me.streak, view.hpX + 40, view.hpY - 16, '600 11px ' + FONT_UI, me.streak >= LIT_AT ? '#F2541B' : txt, halo, 'left');
  } else {
    hudText(ctx, ammo, R, B - 12, 'italic 700 32px ' + FONT_D, me.ammo <= 3 && ammo && !g.R.infAmmo ? '#E5483D' : txt, halo, 'right');
    const aw = ammo ? (ctx.font = 'italic 700 32px ' + FONT_D, ctx.measureText(ammo).width + 10) : 0;
    hudText(ctx, wName, R - aw, B - 14, '600 13px ' + FONT_UI, txt, halo, 'right');
    // dash + swap key hints
    const kx = R - 4; let ky = B - 50;
    keyHint(ctx, 'Space', 'Dash', kx, ky, me.dashCD > 0 ? 1 - me.dashCD / g.R.dashCD : 1, txt, halo, g.map.theme.dark); ky -= 24;
    if (me.gun) keyHint(ctx, 'Q', me.cur === 'gun' ? 'Melee' : W[me.gun].name, kx, ky, 1, txt, halo, g.map.theme.dark);
  }
  // pickup prompt
  if (me.near) {
    const s = touch ? 'Swap for ' + W[me.near.kind].name : 'E  ·  Swap for ' + W[me.near.kind].name;
    if (!touch) { ctx.font = '600 13px ' + FONT_UI; const w = ctx.measureText(s).width + 24; ctx.fillStyle = g.map.theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)'; rr(ctx, bcx - w / 2, Hd * 0.8 - 16, w, 30, 15); ctx.fill(); hudText(ctx, s, bcx, Hd * 0.8, '600 13px ' + FONT_UI, txt, null, 'center', 'middle'); }
  }
  // hint (first match)
  if (RN.hint && RN.hint.t > 0) { RN.hint.t -= dt; const a = clamp(RN.hint.t, 0, 1); ctx.globalAlpha = a; hudText(ctx, RN.hint.text, bcx, touch ? Hd * 0.4 : Hd * 0.86, '600 14px ' + FONT_UI, txt, halo, 'center'); ctx.globalAlpha = 1; }
  // crosshair
  if (!touch && view.mouse) {
    const mx = view.mouse.x, my = view.mouse.y, wpn = W[wid];
    const spread = wid === 'melee' ? 10 : 6 + ((wpn.spread || 0) + me.bloom) * 120 + me.recoil * 4;
    const col = RN.killmark > 0 ? '#F2541B' : txt;
    ctx.strokeStyle = halo; ctx.lineWidth = 4; ctx.lineCap = 'round'; crossLines(ctx, mx, my, spread); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 2; crossLines(ctx, mx, my, spread); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, TAU); ctx.fill();
    if (RN.hitmark > 0 || RN.killmark > 0) { const k = Math.max(RN.hitmark / 0.16, RN.killmark / 0.3), s = 7 + (1 - k) * 4; ctx.strokeStyle = RN.killmark > 0 ? '#F2541B' : txt; ctx.lineWidth = 2.2; ctx.beginPath(); for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(mx + dx * s, my + dy * s); ctx.lineTo(mx + dx * (s + 6), my + dy * (s + 6)); } ctx.stroke(); }
  } else if (touch && (RN.hitmark > 0 || RN.killmark > 0)) {
    const [sx, sy] = toS(me.x + Math.cos(me.aim) * 70, me.y + Math.sin(me.aim) * 70), k = Math.max(RN.hitmark / 0.16, RN.killmark / 0.3), s = 6 + (1 - k) * 4;
    ctx.strokeStyle = RN.killmark > 0 ? '#F2541B' : txt; ctx.lineWidth = 2.2; ctx.beginPath(); for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(sx + dx * s, sy + dy * s); ctx.lineTo(sx + dx * (s + 6), sy + dy * (s + 6)); } ctx.stroke();
  }
  // touch sticks
  if (touch && view.sticks) for (const st of view.sticks) {
    if (!st.show) continue;
    ctx.globalAlpha = st.active ? 0.9 : 0.35;
    ctx.fillStyle = g.map.theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)'; ctx.strokeStyle = g.map.theme.dark ? 'rgba(255,255,255,0.35)' : 'rgba(20,24,32,0.28)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(st.ox, st.oy, st.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = st.fire ? '#F2541B' : (g.map.theme.dark ? 'rgba(255,255,255,0.8)' : 'rgba(20,24,32,0.75)');
    ctx.beginPath(); ctx.arc(st.ox + st.dx * st.r, st.oy + st.dy * st.r, st.r * 0.38, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (SET.fps) { RN.fpsAcc += dt; RN.fpsN++; if (RN.fpsAcc > 0.5) { RN.fps = RN.fpsN / RN.fpsAcc; RN.fpsAcc = 0; RN.fpsN = 0; } hudText(ctx, Math.round(RN.fps) + ' fps', L + 48, T + 30, '500 11px ' + FONT_UI, txt, halo, 'left'); }
}
function crossLines(ctx, x, y, g) { ctx.beginPath(); ctx.moveTo(x - g - 7, y); ctx.lineTo(x - g, y); ctx.moveTo(x + g, y); ctx.lineTo(x + g + 7, y); ctx.moveTo(x, y - g - 7); ctx.lineTo(x, y - g); ctx.moveTo(x, y + g); ctx.lineTo(x, y + g + 7); }
function keyHint(ctx, key, label, x, y, ready, txt, halo, dark) {
  ctx.font = '600 11px ' + FONT_UI; const kw = ctx.measureText(key).width + 12, lw = ctx.measureText(label).width;
  const bx = x - lw - 8 - kw;
  ctx.globalAlpha = ready >= 1 ? 1 : 0.5;
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(20,24,32,0.35)'; ctx.lineWidth = 1; rr(ctx, bx, y - 9, kw, 18, 5); ctx.stroke();
  if (ready < 1) { ctx.fillStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(20,24,32,0.12)'; rr(ctx, bx, y - 9, kw * ready, 18, 5); ctx.fill(); }
  hudText(ctx, key, bx + kw / 2, y + 0.5, '600 11px ' + FONT_UI, txt, null, 'center', 'middle');
  hudText(ctx, label, x, y + 0.5, '500 12px ' + FONT_UI, txt, halo, 'right', 'middle');
  ctx.globalAlpha = 1;
}

/* ---------- menu figure (DOM canvas previews, front view) ---------- */
function drawPreview(cv, skin, t, opts) {
  opts = opts || {};
  const ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const s = opts.scale || Math.min(h / 112, w / 96);
  ctx.save(); ctx.translate(w / 2 + (opts.ox || 0) * s, h * 0.5 + 44 * s);
  ctx.scale(s, s);
  if (opts.trail && opts.trail !== 'none') { ctx.save(); ctx.translate(-26, -2); ctx.scale(1.2, 1.2); trailSample(ctx, opts.trail, bodyPal(skin.color, false, t, 3).line); ctx.restore(); }
  drawStickFront(ctx, { pal: bodyPal(skin.color, false, t, 3), head: skin.head, melee: skin.melee, weapon: opts.weapon || 'melee', aim: opts.aim, swing: opts.swing == null ? -1 : opts.swing, walk: opts.walk || 0, move: opts.move || 0, t, lit: opts.lit, pet: opts.pet === false ? 'none' : skin.pet });
  if (opts.fx) { const k = (t % 1.6) / 1.6; ctx.save(); ctx.translate(34, -44); ctx.globalAlpha = 1 - k; ctx.scale(0.5 + k * 0.6, 0.5 + k * 0.6); fxSample(ctx, opts.fx); ctx.restore(); }
  ctx.restore();
}
