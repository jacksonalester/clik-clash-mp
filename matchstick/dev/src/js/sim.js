/* MATCHSTICK · simulation. Pure game state, no DOM, deterministic step at 60 Hz. */
const STEP = 1 / 60;
const PR = 14;              // player radius
const MAXV = 1150;
const TEAM_COL = ['#2F74E0', '#E5483D'];
const TEAM_NAME = ['Blue', 'Red'];

/* ---------- map parsing ---------- */
function greedyRects(grid, w, h, val) {
  const used = new Uint8Array(w * h), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (grid[i] !== val || used[i]) continue;
    let ww = 1; while (x + ww < w && grid[i + ww] === val && !used[i + ww]) ww++;
    let hh = 1; outer: while (y + hh < h) { for (let k = 0; k < ww; k++) { const j = (y + hh) * w + x + k; if (grid[j] !== val || used[j]) break outer; } hh++; }
    for (let yy = 0; yy < hh; yy++) for (let k = 0; k < ww; k++) used[(y + yy) * w + x + k] = 1;
    out.push({ x: x * TILE, y: y * TILE, w: ww * TILE, h: hh * TILE });
  }
  return out;
}
function parseMap(def) {
  const half = def.half, H = half.length, HW = half[0].length, Wt = HW * 2;
  const grid = new Uint8Array(Wt * H), spawns = [], raw = [];
  for (let y = 0; y < H; y++) {
    const row = half[y]; if (row.length !== HW) throw new Error(def.id + ' row ' + y + ' has ' + row.length + ' cells');
    const full = row + row.split('').reverse().join('');
    for (let x = 0; x < Wt; x++) {
      const c = full[x];
      grid[y * Wt + x] = c === '#' ? 1 : c === '=' ? 2 : 0;
      if (c === 'S') spawns.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, side: x < HW ? 0 : 1 });
      else if (GUN_CODES[c] || c === '+') raw.push({ c, x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, tx: x, ty: y });
    }
  }
  const items = [];
  for (const it of raw) { // a pickup sitting on both sides of the mirror seam becomes one centred pickup
    if (it.tx === HW && raw.some(o => o.tx === HW - 1 && o.ty === it.ty && o.c === it.c)) continue;
    if (it.tx === HW - 1 && raw.some(o => o.tx === HW && o.ty === it.ty && o.c === it.c)) it.x = HW * TILE;
    items.push(it);
  }
  return { id: def.id, name: def.name, themeId: def.theme, theme: THEMES[def.theme], w: Wt, h: H, grid, spawns, items,
    pw: Wt * TILE, ph: H * TILE, walls: greedyRects(grid, Wt, H, 1), lows: greedyRects(grid, Wt, H, 2) };
}
const MAP = {}; for (const m of MAPS) MAP[m.id] = parseMap(m);

function cell(map, tx, ty) { if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return 1; return map.grid[ty * map.w + tx]; }
function solidAt(map, x, y) { return cell(map, Math.floor(x / TILE), Math.floor(y / TILE)) === 1; }
function blockedAt(map, x, y) { return cell(map, Math.floor(x / TILE), Math.floor(y / TILE)) !== 0; }

/* grid ray: first solid wall hit on segment (x0,y0)->(x1,y1). returns {t,x,y,nx,ny} or null */
function rayWall(map, x0, y0, x1, y1, lowsBlock) {
  let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
  const dx = x1 - x0, dy = y1 - y0;
  const hit = v => v === 1 || (lowsBlock && v === 2);
  if (hit(cell(map, tx, ty))) return { t: 0, x: x0, y: y0, nx: -Math.sign(dx) || 0, ny: -Math.sign(dy) || 0 };
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(TILE / dx) : Infinity, tdy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
  let tmx = dx !== 0 ? (dx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx) : Infinity;
  let tmy = dy !== 0 ? (dy > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy) : Infinity;
  for (let guard = 0; guard < 400; guard++) {
    let t, nx = 0, ny = 0;
    if (tmx < tmy) { t = tmx; tx += sx; tmx += tdx; nx = -sx; } else { t = tmy; ty += sy; tmy += tdy; ny = -sy; }
    if (t > 1) return null;
    if (hit(cell(map, tx, ty))) return { t, x: x0 + dx * t, y: y0 + dy * t, nx, ny };
  }
  return null;
}
function los(map, ax, ay, bx, by) { return rayWall(map, ax, ay, bx, by, false) === null; }
/* segment vs circle: smallest t in [0,1] or -1 */
function segCircle(x0, y0, dx, dy, cx, cy, r) {
  const fx = x0 - cx, fy = y0 - cy;
  const c = fx * fx + fy * fy - r * r; if (c <= 0) return 0;
  const a = dx * dx + dy * dy; if (a === 0) return -1;
  const b = 2 * (fx * dx + fy * dy); const disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : -1;
}

/* ---------- game ---------- */
function newGame(o) {
  const map = MAP[o.map] || MAP.yard;
  const mode = MODES[o.mode] || MODES.ffa;
  const party = o.mode === 'party' ? (o.party || partyToday()) : null;
  const R = Object.assign({ target: mode.target, time: mode.time, respawn: 2.0, dashCD: 2.0, speedMul: 1, headScale: 1, rocketMul: 1 }, party ? party.rules : {});
  if (o.target) R.target = o.target;
  const g = { map, mode: mode.id, teams: !!mode.teams, party, R, t: 0, timeLeft: R.time, players: [], bullets: [], rockets: [], pickups: [],
    ev: [], noise: [], over: false, overT: 0, winner: null, winTeam: -1, overtime: false, otT: 0, teamScore: [0, 0], firstKO: false, nextId: 1 };
  if (!R.noGuns) for (const it of map.items) g.pickups.push(mkPickup(it.c === '+' ? 'health' : GUN_CODES[it.c], it.x, it.y, true));
  else for (const it of map.items) if (it.c === '+') g.pickups.push(mkPickup('health', it.x, it.y, true));
  return g;
}
function mkPickup(kind, x, y, base, ammo) {
  return { kind, x, y, base, active: true, t: 0, ammo: ammo || 0, ttl: base ? 0 : 15, spin: Math.random() * TAU };
}
function addPlayer(g, o) {
  const p = {
    id: g.players.length, name: o.name, bot: !!o.bot, human: !!o.human, team: o.team == null ? -1 : o.team, skin: o.skin,
    color: g.teams ? TEAM_COL[o.team] : colorHex(o.skin.color),
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, aim: 0, paim: 0, r: PR,
    alive: false, hp: 100, respawnT: 0.05 + g.players.length * 0.02, spawnT: 0, lastHurtT: -99, lastHitBy: -1,
    gun: null, ammo: 0, cur: 'melee', fireCD: 0, meleeCD: 0, swingT: 0, swingSide: 1, bloom: 0,
    dashT: 0, dashCD: 0, dvx: 0, dvy: 0,
    kills: 0, deaths: 0, streak: 0, best: 0, assists: 0, multi: 0, lastKO: -99, dmgBy: {}, near: null,
    in: { mx: 0, my: 0, aim: 0, fire: false, melee: false, dash: false, swap: false, pick: false, emote: false },
    pv: { dash: false, swap: false, pick: false, emote: false },
    walk: 0, move: 0, recoil: 0, hurt: 0, emote: '', emoteT: 0, spawnFx: 0,
    st: { ko: 0, shots: 0, hits: 0, dmg: 0, melee: 0, pistol: 0, smg: 0, shotgun: 0, rifle: 0, launcher: 0, lit: 0, ext: 0, double: 0, pickup: 0, dashes: 0, died: 0 },
    brain: null, skill: o.skill == null ? 0.5 : o.skill,
  };
  g.players.push(p);
  return p;
}
const enemies = (g, a, b) => a !== b && (!g.teams || a.team !== b.team);
const evt = (g, e) => { g.ev.push(e); };

function chooseSpawn(g, p) {
  let pts = g.map.spawns;
  if (g.teams) { const own = pts.filter(s => s.side === p.team); if (own.length) pts = own; }
  let best = pts[0], bs = -1e9;
  for (const s of pts) {
    let minD = 1e9, seen = false;
    for (const q of g.players) {
      if (q === p || !q.alive) continue;
      const d = Math.sqrt(dist2(s.x, s.y, q.x, q.y));
      if (d < 46) { minD = -1000; continue; }
      if (!enemies(g, p, q)) continue;
      if (d < minD) minD = d;
      if (d < 760 && los(g.map, s.x, s.y, q.x, q.y)) seen = true;
    }
    const sc = Math.min(minD, 1100) - (seen ? 450 : 0) + Math.random() * 160;
    if (sc > bs) { bs = sc; best = s; }
  }
  return best;
}
function spawnPlayer(g, p) {
  const s = chooseSpawn(g, p);
  p.x = p.px = s.x + rand(-5, 5); p.y = p.py = s.y + rand(-5, 5);
  p.vx = p.vy = 0; p.hp = 100; p.alive = true; p.spawnT = 1.6; p.spawnFx = 0.35; p.dmgBy = {};
  p.aim = p.paim = p.in.aim = Math.atan2(g.map.ph / 2 - p.y, g.map.pw / 2 - p.x);
  p.gun = g.R.spawnGun || null; p.ammo = p.gun ? W[p.gun].ammo : 0; p.cur = p.gun ? 'gun' : 'melee';
  p.dashCD = 0; p.dashT = 0; p.bloom = 0; p.streak = 0;
  if (p.brain) p.brain.reset = true;
  evt(g, { t: 'spawn', p: p.id, x: p.x, y: p.y });
}

/* ---------- step ---------- */
function step(g, dt) {
  g.t += dt;
  if (g.over) { g.overT += dt; for (const p of g.players) { p.px = p.x; p.py = p.y; p.paim = p.aim; } stepProjectiles(g, dt); return; }
  if (!g.overtime) {
    g.timeLeft -= dt;
    if (g.timeLeft <= 0) { g.timeLeft = 0; if (leaderTie(g)) { g.overtime = true; g.otT = 45; evt(g, { t: 'overtime' }); } else return endGame(g, 'time'); }
  } else { g.otT -= dt; if (g.otT <= 0) return endGame(g, 'time'); }
  for (const p of g.players) updatePlayer(g, p, dt);
  separate(g);
  stepProjectiles(g, dt);
  updatePickups(g, dt);
  for (let i = g.noise.length - 1; i >= 0; i--) if (g.t - g.noise[i].t > 1.2) g.noise.splice(i, 1);
}
function updatePlayer(g, p, dt) {
  p.px = p.x; p.py = p.y; p.paim = p.aim;
  if (!p.alive) { p.respawnT -= dt; if (p.respawnT <= 0) spawnPlayer(g, p); return; }
  const I = p.in, R = g.R;
  p.fireCD -= dt; p.meleeCD -= dt; p.dashCD -= dt; p.spawnT -= dt; p.swingT -= dt; p.emoteT -= dt;
  p.recoil = Math.max(0, p.recoil - dt * 7); p.hurt = Math.max(0, p.hurt - dt); p.spawnFx = Math.max(0, p.spawnFx - dt);
  p.bloom = Math.max(0, p.bloom - dt * 0.22);
  p.aim = I.aim;
  if (I.swap && !p.pv.swap && p.gun) { p.cur = p.cur === 'gun' ? 'melee' : 'gun'; evt(g, { t: 'swap', p: p.id }); }
  if (I.emote && !p.pv.emote && p.emoteT < -1) { p.emote = I.emoteText || 'GG'; p.emoteT = 2.2; }
  // dash
  if (I.dash && !p.pv.dash && p.dashCD <= 0) {
    const ml = Math.hypot(I.mx, I.my);
    const a = ml > 0.2 ? Math.atan2(I.my, I.mx) : p.aim;
    p.dashT = 0.15; p.dashCD = R.dashCD; p.dvx = Math.cos(a) * 760; p.dvy = Math.sin(a) * 760;
    p.st.dashes++; evt(g, { t: 'dash', p: p.id, x: p.x, y: p.y, a });
  }
  // movement
  let mx = I.mx, my = I.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const holding = p.cur === 'gun' && p.gun;
  const maxS = 255 * R.speedMul * (holding ? W[p.gun].slow : 1.04) * (p.swingT > 0 ? 0.92 : 1);
  if (p.dashT > 0) { p.dashT -= dt; p.vx = lerp(p.vx, p.dvx, 0.6); p.vy = lerp(p.vy, p.dvy, 0.6); }
  else { const k = 1 - Math.exp(-16 * dt); p.vx += (mx * maxS - p.vx) * k; p.vy += (my * maxS - p.vy) * k; }
  const sp = Math.hypot(p.vx, p.vy); if (sp > MAXV) { p.vx *= MAXV / sp; p.vy *= MAXV / sp; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  collide(g.map, p);
  const spd = Math.hypot(p.x - p.px, p.y - p.py) / dt;
  p.move = approach(p.move, clamp(spd / 255, 0, 1.4), 12, dt);
  p.walk += spd * dt * 0.085;
  // health regen
  if (g.t - p.lastHurtT > 4 && p.hp < 100) p.hp = Math.min(100, p.hp + 9 * dt);
  // attack
  const meleeNow = I.melee || (I.fire && (p.cur === 'melee' || !p.gun));
  if (meleeNow && p.meleeCD <= 0 && p.fireCD <= 0.05) doMelee(g, p);
  else if (I.fire && p.cur === 'gun' && p.gun && p.fireCD <= 0) fireGun(g, p);
  // pickups: manual swap
  if (I.pick && !p.pv.pick && p.near) takePickup(g, p, p.near, true);
  p.pv.dash = I.dash; p.pv.swap = I.swap; p.pv.pick = I.pick; p.pv.emote = I.emote;
}
function collide(map, p) {
  const r = p.r;
  for (let it = 0; it < 3; it++) {
    const x0 = Math.floor((p.x - r) / TILE), x1 = Math.floor((p.x + r) / TILE);
    const y0 = Math.floor((p.y - r) / TILE), y1 = Math.floor((p.y + r) / TILE);
    let moved = false;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (cell(map, tx, ty) === 0) continue;
      const bx = tx * TILE, by = ty * TILE;
      const cx = clamp(p.x, bx, bx + TILE), cy = clamp(p.y, by, by + TILE);
      const dx = p.x - cx, dy = p.y - cy, dd = dx * dx + dy * dy;
      if (dd >= r * r) continue;
      moved = true;
      if (dd < 1e-6) {
        const l = p.x - bx, rr = bx + TILE - p.x, t = p.y - by, b = by + TILE - p.y, m = Math.min(l, rr, t, b);
        if (m === l) p.x = bx - r; else if (m === rr) p.x = bx + TILE + r; else if (m === t) p.y = by - r; else p.y = by + TILE + r;
      } else {
        const d = Math.sqrt(dd), nx = dx / d, ny = dy / d; p.x += nx * (r - d); p.y += ny * (r - d);
        const vn = p.vx * nx + p.vy * ny; if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
      }
    }
    if (!moved) break;
  }
  p.x = clamp(p.x, TILE + r, map.pw - TILE - r); p.y = clamp(p.y, TILE + r, map.ph - TILE - r);
}
function separate(g) {
  const ps = g.players;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i]; if (!a.alive) continue;
    for (let j = i + 1; j < ps.length; j++) {
      const b = ps[j]; if (!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, m = a.r + b.r - 2;
      if (d2 < m * m && d2 > 1e-4) { const d = Math.sqrt(d2), push = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
    }
  }
}

/* ---------- combat ---------- */
function doMelee(g, p) {
  const w = W.melee;
  p.meleeCD = w.rate; p.swingT = 0.24; p.swingSide = -p.swingSide; p.spawnT = Math.min(p.spawnT, 0);
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  p.vx += ca * w.lunge; p.vy += sa * w.lunge;
  let hits = 0;
  for (const q of g.players) {
    if (!q.alive || !enemies(g, p, q)) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
    if (d > w.reach + q.r) continue;
    const off = Math.abs(angDiff(p.aim, Math.atan2(dy, dx)));
    if (off > w.arc / 2 && d > p.r + q.r + 4) continue;
    if (!los(g.map, p.x, p.y, q.x, q.y)) continue;
    const nx = d > 0 ? dx / d : ca, ny = d > 0 ? dy / d : sa;
    q.vx += nx * w.knock; q.vy += ny * w.knock;
    hits++;
    damage(g, q, w.dmg, p, 'melee', nx, ny, q.x - nx * q.r, q.y - ny * q.r);
  }
  evt(g, { t: 'swing', p: p.id, hits });
}
function fireGun(g, p) {
  const w = W[p.gun];
  p.fireCD = w.rate; p.recoil = 1; p.spawnT = Math.min(p.spawnT, 0); p.st.shots++;
  const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
  g.noise.push({ x: p.x, y: p.y, t: g.t, id: p.id });
  const sid = g.nextId++;
  if (w.kind === 'rocket') {
    let sx = p.x + ca * 20, sy = p.y + sa * 20;
    if (!los(g.map, p.x, p.y, sx, sy)) { sx = p.x; sy = p.y; }
    g.rockets.push({ x: sx, y: sy, px: sx, py: sy, a: p.aim, v: w.speed, owner: p.id, team: p.team, life: 3.0, id: g.nextId++, sid });
  } else {
    for (let k = 0; k < w.pellets; k++) {
      const a = p.aim + (Math.random() - 0.5) * 2 * (w.spread / (w.pellets > 1 ? 1.6 : 1) + p.bloom) + (w.pellets > 1 ? (k / (w.pellets - 1) - 0.5) * w.spread : 0);
      const spd = w.speed * (w.pellets > 1 ? rand(0.9, 1.06) : 1);
      g.bullets.push({ x: p.x, y: p.y, px: p.x, py: p.y, ox: p.x, oy: p.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        owner: p.id, team: p.team, w: w.id, dmg: w.dmg, life: w.range / spd, pierce: !!w.pierce, hit: w.pierce ? [] : null, id: g.nextId++, age: 0, sid });
    }
  }
  if (w.bloom) p.bloom = Math.min(w.bloomMax, p.bloom + w.bloom);
  p.vx -= ca * w.recoil * 9; p.vy -= sa * w.recoil * 9;
  evt(g, { t: 'shot', p: p.id, w: w.id, x: p.x, y: p.y, a: p.aim });
  if (!g.R.infAmmo) {
    p.ammo--;
    if (p.ammo <= 0) { evt(g, { t: 'empty', p: p.id, w: w.id }); p.gun = null; p.cur = 'melee'; p.ammo = 0; }
  }
}
function stepProjectiles(g, dt) {
  const map = g.map;
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.px = b.x; b.py = b.y; b.age += dt;
    const bdt = Math.min(dt, b.life);
    const dx = b.vx * bdt, dy = b.vy * bdt;
    const wh = rayWall(map, b.x, b.y, b.x + dx, b.y + dy, false);
    let tEnd = wh ? wh.t : 1, dead = false;
    if (!g.over) {
      const owner = g.players[b.owner];
      // collect player hits along the segment
      let hits = null;
      for (const q of g.players) {
        if (!q.alive || q.id === b.owner) continue;
        if (g.teams && q.team === b.team) continue;
        if (b.hit && b.hit.indexOf(q.id) >= 0) continue;
        const t = segCircle(b.x, b.y, dx, dy, q.x, q.y, q.r + 1.5);
        if (t >= 0 && t <= tEnd) { (hits || (hits = [])).push([t, q]); }
      }
      if (hits) {
        hits.sort((a, c) => a[0] - c[0]);
        for (const [t, q] of hits) {
          let dmg = b.dmg;
          const w = W[b.w];
          if (w.falloff) { const trav = Math.hypot(b.x + dx * t - b.ox, b.y + dy * t - b.oy); dmg *= 1 - w.falloff * clamp(trav / w.range, 0, 1); }
          const sp = Math.hypot(b.vx, b.vy);
          q.vx += b.vx / sp * (w.id === 'shotgun' ? 26 : w.id === 'rifle' ? 160 : 34); q.vy += b.vy / sp * (w.id === 'shotgun' ? 26 : w.id === 'rifle' ? 160 : 34);
          if (owner && owner.lastSid !== b.sid) { owner.st.hits++; owner.lastSid = b.sid; }
          damage(g, q, dmg, owner, b.w, b.vx / sp, b.vy / sp, b.x + dx * t, b.y + dy * t);
          if (b.pierce) { b.hit.push(q.id); } else { tEnd = t; dead = true; break; }
        }
      }
    }
    if (!dead && wh) { evt(g, { t: 'wall', x: wh.x, y: wh.y, nx: wh.nx, ny: wh.ny, w: b.w }); dead = true; }
    b.x += dx * (dead ? tEnd : 1); b.y += dy * (dead ? tEnd : 1);
    b.life -= dt;
    if (dead || b.life <= 0) { b.dead = true; g.bullets.splice(i, 1); evt(g, { t: 'bend', x: b.x, y: b.y, px: b.px, py: b.py, w: b.w }); }
  }
  for (let i = g.rockets.length - 1; i >= 0; i--) {
    const r = g.rockets[i];
    r.px = r.x; r.py = r.y;
    r.v = Math.min(W.launcher.maxSpeed, r.v + W.launcher.accel * dt);
    const dx = Math.cos(r.a) * r.v * dt, dy = Math.sin(r.a) * r.v * dt;
    const wh = rayWall(map, r.x, r.y, r.x + dx, r.y + dy, false);
    let tEnd = wh ? wh.t : 1, boom = !!wh, hx = 0, hy = 0;
    for (const q of g.players) {
      if (!q.alive || q.id === r.owner || (g.teams && q.team === r.team)) continue;
      const t = segCircle(r.x, r.y, dx, dy, q.x, q.y, q.r + 3);
      if (t >= 0 && t <= tEnd) { tEnd = t; boom = true; }
    }
    r.x += dx * tEnd; r.y += dy * tEnd; r.life -= dt;
    if (wh && tEnd === wh.t) { hx = wh.nx * 3; hy = wh.ny * 3; }
    if (boom || r.life <= 0) { g.rockets.splice(i, 1); explode(g, r.x + hx, r.y + hy, g.players[r.owner], r.sid); }
  }
}
function explode(g, x, y, owner, sid) {
  const w = W.launcher, mul = g.R.rocketMul;
  evt(g, { t: 'boom', x, y });
  if (g.over) return;
  for (const q of g.players) {
    if (!q.alive) continue;
    const self = owner && q.id === owner.id;
    if (!self && owner && !enemies(g, owner, q)) continue;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d > w.radius + q.r) continue;
    if (!los(g.map, x, y, q.x, q.y)) continue;
    const k = clamp((d - q.r * 0.5) / w.radius, 0, 1);
    const dmg = lerp(w.dmg, w.minDmg, k) * mul * (self ? 0.45 : 1);
    const nx = d > 0.1 ? (q.x - x) / d : 1, ny = d > 0.1 ? (q.y - y) / d : 0;
    q.vx += nx * 520 * (1 - k * 0.6); q.vy += ny * 520 * (1 - k * 0.6);
    if (owner && !self && owner.lastSid !== sid) { owner.st.hits++; owner.lastSid = sid; }
    damage(g, q, dmg, owner, 'launcher', nx, ny, q.x, q.y);
  }
}
function damage(g, q, amount, by, w, dx, dy, hx, hy) {
  if (!q.alive || g.over) return;
  if (q.spawnT > 0) { evt(g, { t: 'block', p: q.id, x: hx, y: hy }); return; }
  amount = Math.round(amount);
  q.hp -= amount; q.hurt = 0.09; q.lastHurtT = g.t;
  if (by) { q.dmgBy[by.id] = g.t; q.lastHitBy = by.id; if (by !== q) by.st.dmg += amount; }
  evt(g, { t: 'hit', p: q.id, by: by ? by.id : -1, w, amt: amount, x: hx, y: hy, dx, dy, hp: q.hp });
  if (q.hp <= 0) kill(g, q, by, w, dx, dy);
}
function kill(g, v, k, w, dx, dy) {
  v.alive = false; v.hp = 0; v.deaths++; v.st.died++; v.respawnT = g.R.respawn;
  const wasLit = v.streak >= LIT_AT, vStreak = v.streak;
  v.streak = 0;
  if (v.gun && !g.R.infAmmo && v.ammo > 0) g.pickups.push(mkPickup(v.gun, v.x, v.y, false, v.ammo));
  v.gun = null; v.cur = 'melee'; v.ammo = 0;
  const e = { t: 'ko', v: v.id, k: k ? k.id : -1, w, x: v.x, y: v.y, dx, dy, wasLit, vStreak, multi: 0, streak: 0, first: false };
  if (k && k !== v) {
    k.kills++; k.streak++; k.st.ko++; if (k.st[w] != null) k.st[w]++;
    if (k.streak > k.best) k.best = k.streak;
    k.multi = (g.t - k.lastKO < 3.5) ? k.multi + 1 : 1; k.lastKO = g.t;
    if (k.multi === 2) k.st.double++;
    if (k.streak === LIT_AT) k.st.lit++;
    if (wasLit) k.st.ext++;
    if (g.teams) g.teamScore[k.team]++;
    for (const id in v.dmgBy) { const a = g.players[id]; if (a && a !== k && a !== v && g.t - v.dmgBy[id] < 5) a.assists++; }
    e.multi = k.multi; e.streak = k.streak;
    if (!g.firstKO) { g.firstKO = true; e.first = true; }
  } else {
    if (!g.teams) v.kills = Math.max(0, v.kills - 1);
    e.self = true;
  }
  v.dmgBy = {};
  evt(g, e);
  checkWin(g);
}
function checkWin(g) {
  if (g.over) return;
  if (g.teams) { for (let t = 0; t < 2; t++) if (g.teamScore[t] >= g.R.target) return endGame(g, 'score'); }
  else for (const p of g.players) if (p.kills >= g.R.target) return endGame(g, 'score');
  if (g.overtime && !leaderTie(g)) endGame(g, 'overtime');
}
function standings(g) {
  return g.players.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.assists - a.assists || a.id - b.id);
}
function leaderTie(g) {
  if (g.teams) return g.teamScore[0] === g.teamScore[1];
  const s = standings(g); return s.length > 1 && s[0].kills === s[1].kills;
}
function endGame(g, why) {
  if (g.over) return;
  g.over = true; g.overT = 0; g.endWhy = why;
  if (g.teams) g.winTeam = g.teamScore[0] === g.teamScore[1] ? -1 : (g.teamScore[0] > g.teamScore[1] ? 0 : 1);
  else g.winner = standings(g)[0].id;
  for (const p of g.players) { p.in.fire = false; p.in.melee = false; }
  evt(g, { t: 'end', why });
}

/* ---------- pickups ---------- */
function updatePickups(g, dt) {
  for (const p of g.players) p.near = null;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const k = g.pickups[i];
    k.spin += dt * 1.4;
    if (!k.active) { k.t -= dt; if (k.t <= 0) { k.active = true; evt(g, { t: 'respawnItem', x: k.x, y: k.y, kind: k.kind }); } continue; }
    if (!k.base) { k.ttl -= dt; if (k.ttl <= 0) { g.pickups.splice(i, 1); continue; } }
    for (const p of g.players) {
      if (!p.alive) continue;
      if (dist2(p.x, p.y, k.x, k.y) > 26 * 26) continue;
      if (k.kind === 'health') {
        if (p.hp < 100) { p.hp = Math.min(100, p.hp + 50); k.active = false; k.t = 15; evt(g, { t: 'pickup', p: p.id, kind: 'health', x: k.x, y: k.y }); break; }
        continue;
      }
      if (!p.gun || p.gun === k.kind) { if (takePickup(g, p, k, false)) break; }
      else if (!p.near) p.near = k;
    }
  }
}
function takePickup(g, p, k, manual) {
  if (!k.active || !p.alive) return false;
  if (dist2(p.x, p.y, k.x, k.y) > 30 * 30) return false;
  const w = W[k.kind];
  if (p.gun === k.kind) {
    const full = w.ammo; if (p.ammo >= full && !manual) return false;
    p.ammo = Math.max(p.ammo, k.base ? full : k.ammo);
  } else {
    if (p.gun && manual) { // swap: leave the old gun on the floor
      if (p.ammo > 0) { const d = mkPickup(p.gun, p.x + rand(-6, 6), p.y + rand(-6, 6), false, p.ammo); d.ttl = 12; g.pickups.push(d); }
    }
    p.gun = k.kind; p.ammo = k.base ? w.ammo : k.ammo;
  }
  p.cur = 'gun'; p.fireCD = Math.max(p.fireCD, 0.12); p.st.pickup++; p.bloom = 0;
  if (k.base) { k.active = false; k.t = w.respawn; } else { const i = g.pickups.indexOf(k); if (i >= 0) g.pickups.splice(i, 1); }
  evt(g, { t: 'pickup', p: p.id, kind: k.kind, x: k.x, y: k.y });
  return true;
}
