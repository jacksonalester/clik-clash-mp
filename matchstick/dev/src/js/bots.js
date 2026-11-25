/* MATCHSTICK · bot brains: perception, aim, movement, A* navigation (no DOM) */
const WANT_RANGE = { melee: 0, pistol: 300, smg: 240, shotgun: 115, rifle: 540, launcher: 330 };

function tileIdx(map, x, y) { return clamp(Math.floor(y / TILE), 0, map.h - 1) * map.w + clamp(Math.floor(x / TILE), 0, map.w - 1); }
function nearestWalkable(map, idx) {
  if (map.grid[idx] === 0) return idx;
  const x0 = idx % map.w, y0 = (idx / map.w) | 0;
  for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
    if (map.grid[y * map.w + x] === 0) return y * map.w + x;
  }
  return idx;
}
function astar(map, sx, sy, gx, gy) {
  const w = map.w, h = map.h, n = w * h, grid = map.grid;
  const s = nearestWalkable(map, tileIdx(map, sx, sy)), goal = nearestWalkable(map, tileIdx(map, gx, gy));
  if (s === goal) return [{ x: gx, y: gy }];
  const gS = new Float32Array(n).fill(1e9), par = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const heap = [], f = new Float32Array(n);
  const gxT = goal % w, gyT = (goal / w) | 0;
  const H = i => { const dx = Math.abs(i % w - gxT), dy = Math.abs(((i / w) | 0) - gyT); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
  const push = i => { heap.push(i); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (f[heap[p]] <= f[heap[c]]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === c) break; const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m; } } return top; };
  gS[s] = 0; f[s] = H(s); push(s);
  let found = false, iter = 0;
  while (heap.length && iter++ < 4000) {
    const cur = pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const cx = cur % w, cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx; if (grid[ni] !== 0 || closed[ni]) continue;
      if (dx && dy && (grid[cy * w + nx] !== 0 || grid[ny * w + cx] !== 0)) continue; // no corner cutting
      const ng = gS[cur] + (dx && dy ? 1.4142 : 1);
      if (ng < gS[ni]) { gS[ni] = ng; par[ni] = cur; f[ni] = ng + H(ni); push(ni); }
    }
  }
  if (!found) return null;
  const path = []; let c = goal;
  while (c !== -1 && c !== s) { path.push({ x: (c % w + 0.5) * TILE, y: (((c / w) | 0) + 0.5) * TILE }); c = par[c]; }
  path.reverse();
  if (path.length) { const last = path[path.length - 1]; if (!blockedAt(map, gx, gy) && Math.hypot(gx - last.x, gy - last.y) < TILE) { last.x = gx; last.y = gy; } }
  return path;
}
/* a straight line a body can actually walk (low walls block, body width respected) */
function walkClear(map, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy); if (d < 1) return true;
  const ox = -dy / d * (PR - 3), oy = dx / d * (PR - 3);
  return !rayWall(map, x0, y0, x1, y1, true) && !rayWall(map, x0 + ox, y0 + oy, x1 + ox, y1 + oy, true) && !rayWall(map, x0 - ox, y0 - oy, x1 - ox, y1 - oy, true);
}

function newBrain(skill) {
  const s = clamp(skill, 0, 1);
  return {
    skill: s, react: lerp(0.6, 0.17, s) * rand(0.85, 1.15), aimErr: lerp(0.28, 0.045, s), flickErr: lerp(0.85, 0.22, s),
    settle: lerp(2.6, 7.5, s), turn: lerp(4.8, 15, s), lead: lerp(0.15, 0.95, s), strafeAmt: lerp(0.45, 0.95, s),
    dashRate: lerp(0.12, 0.85, s), rangeMul: rand(0.85, 1.2), bounty: rand(0.5, 1.2), burst: lerp(0.55, 1, s),
    target: null, tid: -1, seeT: 0, flick: 0, noise: 0, noiseT: 0, noiseTarget: 0,
    strafe: Math.random() < 0.5 ? -1 : 1, strafeT: 0, burstT: 0, holdT: 0,
    goal: null, goalT: 0, goalKind: '', path: null, pi: 0, repathT: 0,
    lastSeen: null, stuckT: 0, sx: 0, sy: 0, jitterT: 0, jx: 0, jy: 0, thinkT: 0, lastKills: 0, retreatT: 0, reset: false,
  };
}
const wTier = id => (id && W[id] && W[id].tier) || 0;
function curWeapon(p) { return p.cur === 'gun' && p.gun ? p.gun : 'melee'; }

function perceive(g, p, b) {
  let best = null, bs = 1e9;
  for (const q of g.players) {
    if (!q.alive || !enemies(g, p, q)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y); if (d > 980) continue;
    if (!los(g.map, p.x, p.y, q.x, q.y)) continue;
    let sc = d;
    if (q.id === p.lastHitBy && g.t - p.lastHurtT < 2) sc -= 240;
    if (q.streak >= LIT_AT) sc -= 170 * b.bounty;
    if (q.spawnT > 0) sc += 420;
    sc -= (100 - q.hp) * 1.2;
    if (q.id === b.tid) sc -= 130;
    if (sc < bs) { bs = sc; best = q; }
  }
  if (best) {
    if (best.id !== b.tid) { b.tid = best.id; b.seeT = 0; b.flick = (Math.random() - 0.5) * 2 * b.flickErr; }
    b.target = best; b.lastSeen = { x: best.x, y: best.y, t: g.t };
  } else {
    b.target = null; b.tid = -1;
    if (!b.lastSeen || g.t - b.lastSeen.t > 1.6) {
      for (const n of g.noise) {
        const q = g.players[n.id]; if (!q || !q.alive || !enemies(g, p, q)) continue;
        if (dist2(n.x, n.y, p.x, p.y) < 780 * 780) { b.lastSeen = { x: n.x, y: n.y, t: n.t }; break; }
      }
    }
  }
}
function chooseGoal(g, p, b) {
  b.goalT = rand(5, 8); b.path = null;
  const map = g.map;
  // 1 health when hurt
  if (p.hp < 55) {
    let best = null, bd = 1e9;
    for (const k of g.pickups) if (k.active && k.kind === 'health') { const d = dist2(p.x, p.y, k.x, k.y); if (d < bd) { bd = d; best = k; } }
    if (best && bd < 900 * 900) { b.goal = { x: best.x, y: best.y }; b.goalKind = 'health'; return; }
  }
  // 2 a better gun
  const have = wTier(p.gun) + (p.gun && p.ammo < W[p.gun].ammo * 0.3 ? -1.5 : 0);
  let bestK = null, bScore = -1e9;
  for (const k of g.pickups) {
    if (!k.active || k.kind === 'health') continue;
    const gain = wTier(k.kind) - have; if (gain <= 0 && p.gun) continue;
    const d = Math.sqrt(dist2(p.x, p.y, k.x, k.y)); if (d > 1100) continue;
    const sc = gain * 300 - d + (p.gun ? 0 : 400);
    if (sc > bScore) { bScore = sc; bestK = k; }
  }
  if (bestK) { b.goal = { x: bestK.x, y: bestK.y }; b.goalKind = 'gun'; return; }
  // 3 hunt the last thing heard or seen
  if (b.lastSeen && g.t - b.lastSeen.t < 4) { b.goal = { x: b.lastSeen.x, y: b.lastSeen.y }; b.goalKind = 'hunt'; return; }
  // 4 roam toward the action
  const foes = g.players.filter(q => q.alive && enemies(g, p, q));
  if (foes.length && Math.random() < 0.45) { const q = pick(foes); b.goal = { x: q.x + rand(-80, 80), y: q.y + rand(-80, 80) }; b.goalKind = 'roam'; return; }
  const pts = map.items.length && Math.random() < 0.6 ? map.items : map.spawns;
  const pt = pick(pts); b.goal = { x: pt.x + rand(-40, 40), y: pt.y + rand(-40, 40) }; b.goalKind = 'roam';
}
function followPath(g, p, b, gx, gy) {
  const map = g.map;
  if (walkClear(map, p.x, p.y, gx, gy)) { b.path = null; return [gx - p.x, gy - p.y]; }
  b.repathT -= STEP;
  if (!b.path || b.repathT <= 0) { b.path = astar(map, p.x, p.y, gx, gy); b.pi = 0; b.repathT = 0.9 + Math.random() * 0.4; }
  if (!b.path || !b.path.length) return [gx - p.x, gy - p.y];
  while (b.pi < b.path.length - 1 && dist2(p.x, p.y, b.path[b.pi].x, b.path[b.pi].y) < 20 * 20) b.pi++;
  for (let k = Math.min(b.path.length - 1, b.pi + 3); k > b.pi; k--) { if (walkClear(map, p.x, p.y, b.path[k].x, b.path[k].y)) { b.pi = k; break; } }
  const wp = b.path[b.pi]; return [wp.x - p.x, wp.y - p.y];
}
function botUpdate(g, p, dt) {
  const b = p.brain || (p.brain = newBrain(p.skill));
  const I = p.in;
  I.swap = false; I.pick = false; I.dash = false; I.emote = false; I.melee = false;
  if (!p.alive || g.over) { I.mx = I.my = 0; I.fire = false; b.target = null; b.path = null; b.goal = null; return; }
  if (b.reset) { b.reset = false; b.path = null; b.goal = null; b.target = null; b.tid = -1; b.seeT = 0; b.lastSeen = null; }
  if (p.kills > b.lastKills) { b.lastKills = p.kills; if (Math.random() < 0.12) { I.emote = true; I.emoteText = pick(BOT_LINES); } }
  b.thinkT -= dt; if (b.thinkT <= 0) { b.thinkT = 0.07 + Math.random() * 0.05; perceive(g, p, b); }
  const wid = curWeapon(p);
  let mvx = 0, mvy = 0;
  if (b.target && b.target.alive) {
    const q = b.target; b.seeT += dt;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.max(1, Math.hypot(dx, dy));
    let tx = q.x, ty = q.y;
    if (wid !== 'melee') { const spd = W[wid].speed || 900; const tt = d / spd * b.lead; tx += q.vx * tt; ty += q.vy * tt; }
    const want = Math.atan2(ty - p.y, tx - p.x);
    b.noiseT -= dt; if (b.noiseT <= 0) { b.noiseT = rand(0.25, 0.6); b.noiseTarget = (Math.random() - 0.5) * 2 * b.aimErr * (0.6 + d / 900); }
    b.noise = approach(b.noise, b.noiseTarget, 6, dt);
    b.flick = approach(b.flick, 0, b.settle, dt);
    const aimTo = want + b.noise + b.flick;
    const diff = angDiff(p.aim, aimTo), mt = b.turn * dt;
    I.aim = p.aim + clamp(diff, -mt, mt);
    const err = Math.abs(angDiff(I.aim, want));
    const tol = wid === 'rifle' ? 0.05 : wid === 'melee' ? 0.9 : wid === 'shotgun' ? 0.24 : 0.13 + 16 / d;
    const inRange = wid === 'melee' ? d < W.melee.reach + q.r + 8 : d < (W[wid].range || 900) * 0.92;
    b.burstT -= dt;
    if (b.burstT <= 0) { b.holdT = Math.random() > b.burst ? rand(0.2, 0.45) : 0; b.burstT = rand(0.6, 1.3); }
    b.holdT -= dt;
    const tooClose = wid === 'launcher' && d < 120;
    I.fire = b.seeT >= b.react && inRange && err < tol && !tooClose && b.holdT <= 0 && q.spawnT <= 0.2;
    if (wid === 'melee' && d < W.melee.reach + q.r + 6 && b.seeT >= b.react * 0.7) I.fire = true;
    // weapon handling
    if (p.gun && p.cur === 'gun' && (p.gun === 'rifle' || p.gun === 'launcher') && d < 70 && Math.random() < 0.08 * b.skill) I.swap = true;
    if (p.gun && p.cur === 'melee' && d > 150) I.swap = true;
    // movement: keep range and strafe
    const wantD = WANT_RANGE[wid] * b.rangeMul;
    let radial = wid === 'melee' ? 1 : d > wantD + 70 ? 1 : d < wantD - 70 ? -0.8 : 0;
    if (p.hp < 30 && q.hp > p.hp + 30 && wid !== 'melee') { b.retreatT = 1.5; }
    if (b.retreatT > 0) { b.retreatT -= dt; radial = -1; }
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafeT = rand(0.45, 1.35) * (1.3 - b.skill * 0.6); if (Math.random() < 0.75) b.strafe = -b.strafe; }
    const ux = dx / d, uy = dy / d, sx = -uy, sy = ux;
    const strafe = wid === 'melee' ? 0.35 : b.strafeAmt;
    mvx = ux * radial + sx * b.strafe * strafe; mvy = uy * radial + sy * b.strafe * strafe;
    if (radial > 0 && !walkClear(g.map, p.x, p.y, q.x, q.y)) { const v = followPath(g, p, b, q.x, q.y); const l = Math.hypot(v[0], v[1]) || 1; mvx = v[0] / l + sx * b.strafe * 0.25; mvy = v[1] / l + sy * b.strafe * 0.25; }
    const ml = Math.hypot(mvx, mvy) || 1;
    if (blockedAt(g.map, p.x + mvx / ml * 30, p.y + mvy / ml * 30)) { b.strafe = -b.strafe; mvx = ux * radial + sx * b.strafe * strafe; mvy = uy * radial + sy * b.strafe * strafe; }
    // dash: close in with melee/shotgun, or escape when hurt
    if (p.dashCD <= 0) {
      const close = (wid === 'melee' || wid === 'shotgun') && d < 280 && d > 80;
      const rate = b.dashRate * (close ? 2.6 : p.hp < 45 ? 1.6 : 0.25);
      if (Math.random() < rate * dt) I.dash = true;
    }
    b.goal = null;
  } else {
    // roam / collect / hunt
    I.fire = false;
    b.goalT -= dt;
    if (!b.goal || b.goalT <= 0 || dist2(p.x, p.y, b.goal.x, b.goal.y) < 34 * 34) chooseGoal(g, p, b);
    const v = followPath(g, p, b, b.goal.x, b.goal.y); mvx = v[0]; mvy = v[1];
    // face where we are going, a little ahead
    const ma = Math.atan2(mvy, mvx);
    if (Math.hypot(mvx, mvy) > 4) I.aim = p.aim + clamp(angDiff(p.aim, ma), -6 * dt, 6 * dt);
    if (p.gun && p.cur === 'melee') I.swap = true;
  }
  // swap for a better gun underfoot
  if (p.near && (wTier(p.near.kind) > wTier(p.gun) || (p.gun && p.ammo < W[p.gun].ammo * 0.25))) I.pick = true;
  // unstick
  b.stuckT += dt;
  if (b.stuckT > 0.6) {
    const moved = Math.hypot(p.x - b.sx, p.y - b.sy);
    if (moved < 10 && Math.hypot(mvx, mvy) > 1) { b.path = null; b.repathT = 0; b.jitterT = 0.35; const a = Math.random() * TAU; b.jx = Math.cos(a); b.jy = Math.sin(a); if (!b.target) b.goal = null; }
    b.stuckT = 0; b.sx = p.x; b.sy = p.y;
  }
  if (b.jitterT > 0) { b.jitterT -= dt; mvx = b.jx; mvy = b.jy; }
  const l = Math.hypot(mvx, mvy);
  if (l > 0.001) { I.mx = mvx / l; I.my = mvy / l; } else { I.mx = 0; I.my = 0; }
}
