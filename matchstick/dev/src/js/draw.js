/* MATCHSTICK · drawing: stick-figure rig, heads, weapons, pets, emblems, pickups. Shared by game and menus. */
const INK = '#1B1E25';
const FLAME = ['#FF5A1F', '#FFA51F', '#FFF1C2'];

function bodyPal(colorId, dark, t, seed) {
  const c = COLORS.find(x => x.id === colorId) || COLORS[0];
  if (c.id === 'ink') return dark ? { line: '#E4E7EE', out: '#0C0E12', head: '#1B1E25', ring: '#E4E7EE', id: c.id } : { line: INK, out: INK, head: '#FFFFFF', ring: INK, id: c.id };
  if (c.id === 'chalk') return { line: '#F4F5F7', out: '#3A3F4A', head: '#F4F5F7', ring: '#3A3F4A', id: c.id };
  if (c.special === 'prism') { const h = ((t || 0) * 70 + (seed || 0) * 47) % 360; const col = hslHex(h, 78, 54); return { line: col, out: hslHex(h, 60, 22), head: col, ring: hslHex(h, 60, 22), id: c.id }; }
  if (c.special === 'ember') { const f = 0.5 + 0.5 * Math.sin((t || 0) * 13 + (seed || 0)); const col = mix('#E8430F', '#FF8A2A', f * 0.6); return { line: col, out: '#5A1405', head: col, ring: '#5A1405', id: c.id, glow: true }; }
  if (c.special === 'gold') return { line: '#D9A21B', out: '#6E4E05', head: '#E8B630', ring: '#6E4E05', id: c.id, shine: '#FFE9A6' };
  if (c.special === 'chrome') return { line: '#A9B3BF', out: '#3C4450', head: '#C3CBD5', ring: '#3C4450', id: c.id, shine: '#F2F5F9' };
  return { line: c.hex, out: shade(c.hex, -0.55), head: c.hex, ring: shade(c.hex, -0.55), id: c.id };
}
function teamPal(team, dark) { const c = TEAM_COL[team]; return { line: c, out: shade(c, -0.55), head: c, ring: shade(c, -0.55), id: 'team' }; }
function hslHex(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return rgbHex(f(0) * 255, f(8) * 255, f(4) * 255); }

function elbow(sx, sy, hx, hy, L1, L2, side) {
  const dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 0.001;
  if (d >= L1 + L2 - 0.05) return [sx + dx * L1 / (L1 + L2), sy + dy * L1 / (L1 + L2)];
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  return [sx + dx * a / d - dy / d * h * side, sy + dy * a / d + dx / d * h * side];
}

/* o: x,y,aim,moveA,move,walk,swingT,swingSide,recoil,weapon,melee,head,pal,hurt,alpha,scale,t,headScale,lit,dark,spawnFx,noShadow,seed */
const RIG = { R: 6.3, LW: 2.9, OW: 2.3, shoulder: 8, spine: 8.5, hip: 2.6 };
function drawStick(ctx, o) {
  const t = o.t || 0, sc = (o.scale || 1) * (o.spawnFx ? 0.65 + 0.35 * ease.out(1 - o.spawnFx / 0.35) : 1);
  let pal = o.pal;
  if (o.hurt > 0) pal = { line: '#FFFFFF', out: pal.out, head: '#FFFFFF', ring: pal.out, id: pal.id };
  const LW = RIG.LW, OW = LW + RIG.OW, mv = Math.min(1, o.move || 0);
  ctx.save();
  ctx.translate(o.x, o.y); ctx.scale(sc, sc);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= o.alpha;
  if (!o.noShadow) { ctx.fillStyle = o.dark ? 'rgba(0,0,0,0.32)' : 'rgba(20,24,32,0.1)'; ctx.beginPath(); ctx.ellipse(2, 3, 12.5, 9.5, 0, 0, TAU); ctx.fill(); }
  const ca = Math.cos(o.aim), sa = Math.sin(o.aim);
  const bob = Math.sin((o.walk || 0) * 2) * 0.8 * mv, breathe = Math.sin(t * 2.2 + (o.seed || 0)) * 0.35;
  // hips sit behind the shoulders; legs follow the movement direction
  const mA = o.moveA == null ? o.aim : o.moveA, mc = Math.cos(mA), ms = Math.sin(mA);
  const hipC = -RIG.spine;
  const hx = ca * hipC, hy = sa * hipC, rx = -sa * RIG.hip, ry = ca * RIG.hip;
  const lhx = hx - rx, lhy = hy - ry, rhx = hx + rx, rhy = hy + ry;
  const stride = 10.5 * mv, sw = Math.sin(o.walk || 0);
  const rest = 1 - mv; // idle stance: feet splayed behind
  const bx = -ca * 6 * rest, by = -sa * 6 * rest, ox = -sa * 3.4 * rest, oy = ca * 3.4 * rest;
  const lfx = lhx + mc * stride * sw + bx - ox, lfy = lhy + ms * stride * sw + by - oy;
  const rfx = rhx - mc * stride * sw + bx + ox, rfy = rhy - ms * stride * sw + by + oy;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const legs = () => { ctx.beginPath(); ctx.moveTo(lfx, lfy); ctx.lineTo(lhx, lhy); ctx.lineTo(rhx, rhy); ctx.lineTo(rfx, rfy); };
  legs(); ctx.strokeStyle = pal.out; ctx.lineWidth = OW; ctx.stroke(); ctx.strokeStyle = pal.line; ctx.lineWidth = LW; ctx.stroke();
  // upper body in aim frame
  ctx.rotate(o.aim);
  const wpn = o.weapon || 'melee', rec = (o.recoil || 0) * 3.4;
  let gx, gy, ga, rH, lH, swingArc = null;
  if (wpn === 'melee') {
    const st = o.swingT > 0 ? 1 - o.swingT / 0.24 : -1;
    if (st >= 0) {
      const side = o.swingSide || 1, a0 = 1.75 * side, a1 = -1.45 * side, e = ease.out(Math.min(1, st * 1.15));
      ga = lerp(a0, a1, e);
      gx = Math.cos(ga * 0.8) * 8 + 3; gy = Math.sin(ga * 0.8) * 8;
      swingArc = [a0, ga, side, st];
      rH = [gx, gy]; lH = [gx - Math.cos(ga) * 3.5, gy - Math.sin(ga) * 3.5];
    } else { ga = 0.9 + breathe * 0.1; gx = 7; gy = 7.5; rH = [gx, gy]; lH = [5.5, -7 + breathe]; }
  } else if (wpn === 'pistol') { ga = 0; gx = 12 - rec; gy = 1.6; rH = [gx, gy]; lH = [gx - 1.2, gy - 1.6]; }
  else { const L = W[wpn] ? W[wpn].len : 30; ga = 0; gx = 5 - rec; gy = 2; rH = [gx, gy]; lH = [gx + L * 0.42, 0.9]; }
  const shw = RIG.shoulder + breathe * 0.4;
  const sL = [-0.6, -shw], sR = [-0.6, shw];
  const eR = elbow(sR[0], sR[1], rH[0], rH[1], 7.6, 7.6, 1), eL = elbow(sL[0], sL[1], lH[0], lH[1], 7.6, 7.6, -1);
  if (swingArc && !o.noFx) { // a thin motion trail behind the swing
    const [a0, a1, side, st] = swingArc;
    ctx.strokeStyle = rgba(o.dark ? '#FFFFFF' : (pal.out === INK ? INK : pal.line), 0.32 * (1 - st));
    ctx.lineWidth = 3; ctx.beginPath();
    if (side > 0) ctx.arc(0, 0, 30, a1, a0); else ctx.arc(0, 0, 30, a0, a1);
    ctx.stroke(); ctx.lineWidth = 1.4; ctx.beginPath(); if (side > 0) ctx.arc(0, 0, 24, a1, a0); else ctx.arc(0, 0, 24, a0, a1); ctx.stroke();
  }
  // spine
  ctx.beginPath(); ctx.moveTo(-0.6, 0); ctx.lineTo(hipC, 0);
  ctx.strokeStyle = pal.out; ctx.lineWidth = OW; ctx.stroke(); ctx.strokeStyle = pal.line; ctx.lineWidth = LW; ctx.stroke();
  // weapon under the hands
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(ga);
  if (wpn === 'melee') drawMelee(ctx, o.melee || 'bat', t, o.dark); else drawGun(ctx, wpn, o.dark);
  ctx.restore();
  // arms + shoulders
  ctx.beginPath();
  ctx.moveTo(sL[0], sL[1]); ctx.lineTo(sR[0], sR[1]);
  ctx.moveTo(sR[0], sR[1]); ctx.lineTo(eR[0], eR[1]); ctx.lineTo(rH[0], rH[1]);
  ctx.moveTo(sL[0], sL[1]); ctx.lineTo(eL[0], eL[1]); ctx.lineTo(lH[0], lH[1]);
  ctx.strokeStyle = pal.out; ctx.lineWidth = OW; ctx.stroke();
  ctx.strokeStyle = pal.line; ctx.lineWidth = LW; ctx.stroke();
  if (pal.shine) { ctx.strokeStyle = rgba(pal.shine, 0.75); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(sL[0] - 0.7, sL[1] + 1); ctx.lineTo(sR[0] - 0.7, sR[1] - 1); ctx.stroke(); }
  // hands
  ctx.fillStyle = pal.line; ctx.strokeStyle = pal.out; ctx.lineWidth = 1.2;
  for (const h of [rH, lH]) { ctx.beginPath(); ctx.arc(h[0], h[1], 2.1, 0, TAU); ctx.fill(); ctx.stroke(); }
  // head
  const R = RIG.R * (o.headScale || 1);
  ctx.save(); ctx.translate(2.2 + bob * 0.3, 0);
  drawHead(ctx, o.head || 'plain', R, pal, t, o);
  ctx.restore();
  ctx.restore();
  // halo + flames live in screen space above the head
  const hpx = o.x + ca * 2.2 * sc, hpy = o.y + sa * 2.2 * sc;
  if (o.head === 'halo') { ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha; ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.ellipse(hpx, hpy - 4 * sc, (R + 2.6) * sc, (R + 0.6) * sc, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  if (o.lit || o.head === 'matchhead') drawFlame(ctx, hpx, hpy - R * 0.5 * sc, (o.lit ? 0.9 : 0.56) * sc * (o.headScale || 1), t, o.seed || 0);
}
function drawFlame(ctx, x, y, s, t, seed) {
  const f1 = 1 + 0.12 * Math.sin(t * 19 + seed), f2 = 1 + 0.14 * Math.sin(t * 27 + seed * 2.3), sway = Math.sin(t * 7 + seed) * 1.2;
  const layer = (col, w, h) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y + 2 * s);
    ctx.bezierCurveTo(x - w * s, y + 1 * s, x - w * 0.9 * s, y - h * 0.45 * s, x + sway * s * 0.6, y - h * s);
    ctx.bezierCurveTo(x + w * 0.9 * s, y - h * 0.45 * s, x + w * s, y + 1 * s, x, y + 2 * s);
    ctx.fill();
  };
  layer(FLAME[0], 7.5 * f2, 19 * f1); layer(FLAME[1], 5.2 * f1, 13.5 * f2); layer(FLAME[2], 2.8, 7.5 * f1);
}
function ringHead(ctx, R, fill, ring) { ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.3; ctx.strokeStyle = ring; ctx.stroke(); }
function blob(ctx, pts, fill, stroke, lw) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.6; ctx.stroke(); } }
function star(n, ro, ri, rot) { const pts = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return pts; }
function tails(ctx, R, col, t, o, n) {
  const sp = 0.6 + (o.move || 0) * 0.8;
  ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  for (let k = 0; k < (n || 2); k++) {
    const off = (k ? 2.2 : -2.2), ph = t * 9 + k * 1.7;
    ctx.beginPath(); ctx.moveTo(-R + 1, off * 0.6);
    ctx.quadraticCurveTo(-R - 5 * sp, off + Math.sin(ph) * 3, -R - 10 * sp, off * 1.6 + Math.sin(ph + 1.4) * 4); ctx.stroke();
  }
}
function drawHead(ctx, id, R, pal, t, o) {
  const dark = '#1B1E25';
  switch (id) {
    case 'cap':
      ringHead(ctx, R, pal.head, pal.ring);
      blob(ctx, [[R * 0.2, -R * 0.82], [R * 1.55, -R * 0.62], [R * 1.75, 0], [R * 1.55, R * 0.62], [R * 0.2, R * 0.82]], '#C23A30', dark, 1.4);
      ctx.beginPath(); ctx.arc(-0.6, 0, R * 0.92, 0, TAU); ctx.fillStyle = '#E5483D'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(-0.6, 0, 1.4, 0, TAU); ctx.fillStyle = '#F4F5F7'; ctx.fill(); break;
    case 'beanie':
      ctx.beginPath(); ctx.arc(0, 0, R + 0.8, 0, TAU); ctx.fillStyle = '#E3A321'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = '#B9811A'; ctx.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2.6, Math.sin(a) * 2.6); ctx.lineTo(Math.cos(a) * (R - 0.6), Math.sin(a) * (R - 0.6)); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(-0.5, 0, 2.6, 0, TAU); ctx.fillStyle = '#F4F5F7'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.stroke(); break;
    case 'band':
      tails(ctx, R, '#E5483D', t, o, 2);
      ringHead(ctx, R, pal.head, pal.ring);
      ctx.beginPath(); ctx.arc(0, 0, R - 1.6, 0, TAU); ctx.strokeStyle = '#E5483D'; ctx.lineWidth = 2.6; ctx.stroke(); break;
    case 'bun':
      ctx.beginPath(); ctx.arc(-R * 0.62, 0, 3.8, 0, TAU); ctx.fillStyle = '#4A3226'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.stroke();
      ringHead(ctx, R, '#5B3D2E', dark);
      ctx.beginPath(); ctx.moveTo(-R * 0.35, -2.4); ctx.lineTo(-R * 0.35, 2.4); ctx.strokeStyle = '#E5559C'; ctx.lineWidth = 1.8; ctx.stroke(); break;
    case 'spiky':
      blob(ctx, star(9, R + 3.4, R - 0.4, t * 0), '#F0C24B', dark, 1.5);
      ctx.beginPath(); ctx.arc(0, 0, R - 2.4, 0, TAU); ctx.fillStyle = '#F7D77A'; ctx.fill(); break;
    case 'mohawk': {
      ringHead(ctx, R, pal.head, pal.ring);
      const pts = []; for (let i = 0; i <= 6; i++) { const x = -R - 1 + i * (2 * R + 3) / 6; pts.push([x, -2.4 - (i % 2 ? 1.6 : 0)]); }
      for (let i = 6; i >= 0; i--) { const x = -R - 1 + i * (2 * R + 3) / 6; pts.push([x, 2.4 + (i % 2 ? 1.6 : 0)]); }
      blob(ctx, pts, '#3FCB6B', dark, 1.3); break; }
    case 'ponytail': {
      const sw = Math.sin((o.walk || 0) * 0.5 + t * 3) * 3.5;
      ctx.strokeStyle = dark; ctx.lineWidth = 5.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-R + 1, 0); ctx.quadraticCurveTo(-R - 6, sw * 0.5, -R - 11, sw); ctx.stroke();
      ctx.strokeStyle = '#7A4A30'; ctx.lineWidth = 3.6; ctx.stroke();
      ringHead(ctx, R, '#7A4A30', dark);
      ctx.beginPath(); ctx.arc(-R + 1.2, 0, 1.8, 0, TAU); ctx.fillStyle = '#2F80ED'; ctx.fill(); break; }
    case 'afro': {
      const pts = []; for (let i = 0; i < 14; i++) { const a = i * TAU / 14; pts.push([Math.cos(a) * (R + 4.3), Math.sin(a) * (R + 4.3)]); }
      ctx.fillStyle = '#2E211A'; ctx.strokeStyle = dark; ctx.lineWidth = 1.4;
      ctx.beginPath(); for (const p of pts) { ctx.moveTo(p[0] + 3, p[1]); ctx.arc(p[0], p[1], 3, 0, TAU); } ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, R + 4.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-1, -1.5, R * 0.45, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill(); break; }
    case 'bucket':
      ctx.beginPath(); ctx.arc(0, 0, R + 4.8, 0, TAU); ctx.fillStyle = '#C9B27C'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.86, 0, TAU); ctx.fillStyle = '#B39B67'; ctx.fill(); ctx.strokeStyle = '#3B3229'; ctx.lineWidth = 2; ctx.stroke(); break;
    case 'phones':
      ringHead(ctx, R, pal.head, pal.ring);
      ctx.strokeStyle = dark; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-1, -R - 1); ctx.lineTo(-1, R + 1); ctx.stroke();
      for (const s of [-1, 1]) { ctx.fillStyle = '#E5483D'; ctx.strokeStyle = dark; ctx.lineWidth = 1.4; rr(ctx, -4, s * (R + 1.3) - 3, 6, 6, 2); ctx.fill(); ctx.stroke(); }
      break;
    case 'ears':
      for (const s of [-1, 1]) {
        blob(ctx, [[Math.cos(0.42 * s) * R, Math.sin(0.42 * s) * R], [Math.cos(0.78 * s) * (R + 6), Math.sin(0.78 * s) * (R + 6)], [Math.cos(1.15 * s) * R, Math.sin(1.15 * s) * R]], pal.head, pal.ring, 1.8);
        blob(ctx, [[Math.cos(0.55 * s) * (R - 0.5), Math.sin(0.55 * s) * (R - 0.5)], [Math.cos(0.78 * s) * (R + 3.4), Math.sin(0.78 * s) * (R + 3.4)], [Math.cos(1.02 * s) * (R - 0.5), Math.sin(1.02 * s) * (R - 0.5)]], '#F49AB0', null);
      }
      ringHead(ctx, R, pal.head, pal.ring); break;
    case 'party':
      ctx.beginPath(); ctx.arc(0, 0, R + 0.6, 0, TAU); ctx.fillStyle = '#8A4FD8'; ctx.fill();
      ctx.fillStyle = '#F2C14E'; for (let i = 0; i < 6; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R + 0.6, i * TAU / 6 + t * 0.6, (i + 1) * TAU / 6 + t * 0.6); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, R + 0.6, 0, TAU); ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fillStyle = '#F4F5F7'; ctx.fill(); ctx.lineWidth = 1.1; ctx.stroke(); break;
    case 'chef':
      ctx.fillStyle = '#FBFBFC'; ctx.strokeStyle = '#B9C0CA'; ctx.lineWidth = 1.4;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3; ctx.moveTo(Math.cos(a) * R * 0.62 + 4.6, Math.sin(a) * R * 0.62); ctx.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, 4.6, 0, TAU); } ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, TAU); ctx.fill(); break;
    case 'tophat':
      ctx.beginPath(); ctx.arc(0, 0, R + 3.6, 0, TAU); ctx.fillStyle = '#1B1E25'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.fillStyle = '#30343D'; ctx.fill(); ctx.strokeStyle = '#E5483D'; ctx.lineWidth = 1.9; ctx.stroke();
      ctx.beginPath(); ctx.arc(-1.5, -1.5, R * 0.4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); break;
    case 'helmet':
      ctx.beginPath(); ctx.arc(0, 0, R + 1.6, 0, TAU); ctx.fillStyle = '#5E6B3E'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R + 0.6, -0.9, 0.9); ctx.strokeStyle = '#22303D'; ctx.lineWidth = 3.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R + 0.6, -0.55, -0.15); ctx.strokeStyle = '#7FB4E0'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(-1.5, -1, R * 0.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); break;
    case 'ninja':
      tails(ctx, R, '#E5483D', t, o, 2);
      ringHead(ctx, R, '#24272E', '#0D0F12');
      ctx.strokeStyle = '#F4F5F7'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(R * 0.42, -R * 0.62); ctx.lineTo(R * 0.42, R * 0.62); ctx.stroke(); break;
    case 'horns':
      ringHead(ctx, R, pal.head, pal.ring);
      for (const s of [-1, 1]) blob(ctx, [[R * 0.25, s * R * 0.55], [R * 0.85, s * R * 0.25], [R + 6.5, s * (R + 2.8)]], '#C8322A', dark, 1.3);
      break;
    case 'viking':
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-1, s * (R - 1)); ctx.quadraticCurveTo(-2, s * (R + 6), 4, s * (R + 8)); ctx.lineCap = 'round'; ctx.strokeStyle = dark; ctx.lineWidth = 5.4; ctx.stroke(); ctx.strokeStyle = '#F1E3C0'; ctx.lineWidth = 3.4; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, R + 1.4, 0, TAU); ctx.fillStyle = '#A3ACB8'; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = '#6F7885'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R + 1, 0); ctx.stroke(); break;
    case 'antenna':
      for (const s of [-1, 1]) { ctx.strokeStyle = '#5C6675'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-1, s * 3); ctx.lineTo(-6.5, s * 10.5); ctx.stroke(); ctx.beginPath(); ctx.arc(-6.5, s * 10.5, 2.1, 0, TAU); ctx.fillStyle = (Math.sin(t * 6 + s) > 0) ? '#FF5A1F' : '#E5483D'; ctx.fill(); }
      ringHead(ctx, R, '#B7C0CC', '#3C4450');
      ctx.fillStyle = '#3C4450'; rr(ctx, R * 0.15, -R * 0.55, 3, R * 1.1, 1.2); ctx.fill(); break;
    case 'bubble':
      ringHead(ctx, R, pal.head, pal.ring);
      ctx.beginPath(); ctx.arc(0, 0, R + 5, 0, TAU); ctx.fillStyle = 'rgba(170,210,255,0.28)'; ctx.fill(); ctx.strokeStyle = 'rgba(110,160,225,0.95)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R + 3, -2.6, -1.7); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.8; ctx.stroke(); break;
    case 'crown':
      ringHead(ctx, R, pal.head, pal.ring);
      blob(ctx, star(6, R + 3.6, R + 0.3, t * 0.3), '#E9B308', '#7A5800', 1.3);
      ctx.beginPath(); ctx.arc(0, 0, R - 1.2, 0, TAU); ctx.fillStyle = pal.head; ctx.fill();
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + t * 0.3; ctx.beginPath(); ctx.arc(Math.cos(a) * (R + 1.6), Math.sin(a) * (R + 1.6), 1.2, 0, TAU); ctx.fillStyle = '#E5483D'; ctx.fill(); }
      break;
    case 'matchhead':
      ringHead(ctx, R, '#D63A2A', '#7E1A10');
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(-2, -2.2, 2.2, 0, TAU); ctx.fill(); break;
    default: ringHead(ctx, R, pal.head, pal.ring);
  }
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* guns: local frame, grip at 0, barrel toward +x */
function drawGun(ctx, id, dark) {
  const body = dark ? '#C9CED8' : '#2A2E37', mid = dark ? '#8A92A1' : '#4B515D', edge = dark ? '#0D0F13' : '#15171C';
  ctx.lineWidth = 1.2; ctx.strokeStyle = edge;
  switch (id) {
    case 'pistol':
      ctx.fillStyle = body; rr(ctx, -2, -2, 15, 4, 1.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = mid; rr(ctx, -2.5, -1.2, 4, 5.5, 1); ctx.fill(); break;
    case 'smg':
      ctx.fillStyle = body; rr(ctx, -4, -2.4, 22, 4.8, 1.4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = mid; rr(ctx, 4, 1.8, 3.6, 6.5, 1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = body; rr(ctx, 17, -1.2, 7, 2.4, 0.8); ctx.fill(); ctx.stroke(); break;
    case 'shotgun':
      ctx.fillStyle = mid; rr(ctx, -6, -2.6, 9, 5.2, 1.6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = body; rr(ctx, 2, -2.8, 26, 2.6, 1); ctx.fill(); ctx.stroke(); rr(ctx, 2, 0.2, 26, 2.6, 1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#8A5A3B'; rr(ctx, 11, -3.4, 7, 6.8, 1.6); ctx.fill(); ctx.stroke(); break;
    case 'rifle':
      ctx.fillStyle = mid; rr(ctx, -7, -2.6, 12, 5.2, 1.6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = body; rr(ctx, 3, -1.6, 33, 3.2, 1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = edge; rr(ctx, 6, -3.8, 10, 2.6, 1.2); ctx.fill();
      ctx.fillStyle = '#F2541B'; ctx.beginPath(); ctx.arc(36, 0, 1.3, 0, TAU); ctx.fill(); break;
    case 'launcher':
      ctx.fillStyle = '#3F6B3F'; rr(ctx, -8, -3.8, 36, 7.6, 3.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = mid; rr(ctx, 2, 3, 4, 5, 1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#E5483D'; ctx.beginPath(); ctx.arc(28, 0, 2.6, -1.57, 1.57); ctx.fill(); break;
  }
}
function drawMelee(ctx, id, t, dark) {
  const e = dark ? '#0D0F13' : '#15171C';
  ctx.lineWidth = 1.2; ctx.strokeStyle = e; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const shaft = (x0, x1, w, col) => { ctx.fillStyle = col; rr(ctx, x0, -w / 2, x1 - x0, w, w / 2); ctx.fill(); ctx.stroke(); };
  switch (id) {
    case 'pipe': shaft(-3, 26, 3.6, '#9BA4AF'); ctx.fillStyle = '#6F7885'; rr(ctx, 9, -2.4, 3, 4.8, 0.8); ctx.fill(); rr(ctx, 20, -2.4, 3, 4.8, 0.8); ctx.fill(); break;
    case 'wrench': shaft(-3, 20, 3.4, '#A9B3BF'); ctx.fillStyle = '#A9B3BF'; ctx.beginPath(); ctx.arc(23, 0, 5, 0.6, TAU - 0.6); ctx.lineTo(20, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'bone': shaft(-1, 23, 3.4, '#F2EBDD'); for (const x of [-2, 24]) for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x, s * 1.9, 2.4, 0, TAU); ctx.fillStyle = '#F2EBDD'; ctx.fill(); ctx.stroke(); } break;
    case 'hockey': shaft(-3, 24, 2.8, '#C08A4F'); ctx.fillStyle = '#1B1E25'; rr(ctx, 21, -1.6, 4, 3.2, 1); ctx.fill(); ctx.fillStyle = '#C08A4F'; ctx.beginPath(); ctx.moveTo(24, -1.4); ctx.lineTo(29, -1.4); ctx.lineTo(30, 6); ctx.lineTo(26, 6.5); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'pan': shaft(-3, 14, 3, '#3A3F4A'); ctx.beginPath(); ctx.arc(21, 0, 7.4, 0, TAU); ctx.fillStyle = '#2B2F38'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(21, 0, 5.4, 0, TAU); ctx.fillStyle = '#454B57'; ctx.fill(); break;
    case 'umbrella': ctx.strokeStyle = '#3A3F4A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(-1, 2.6, 2.6, Math.PI, 0); ctx.moveTo(1.6, 2.6); ctx.lineTo(28, 0); ctx.stroke(); ctx.fillStyle = '#2F80ED'; ctx.strokeStyle = e; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(13, -3.6); ctx.lineTo(27, -0.6); ctx.lineTo(27, 0.6); ctx.lineTo(13, 3.6); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'baguette': shaft(-3, 27, 5, '#D9A55B'); ctx.strokeStyle = '#A8742E'; ctx.lineWidth = 1.2; for (const x of [5, 12, 19]) { ctx.beginPath(); ctx.moveTo(x, -1.8); ctx.lineTo(x + 3, 1.8); ctx.stroke(); } break;
    case 'katana': shaft(-3, 6, 3, '#24272E'); ctx.fillStyle = '#C9A227'; rr(ctx, 5.5, -3.4, 2, 6.8, 0.8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#E3E8EE'; ctx.beginPath(); ctx.moveTo(7.5, -1.3); ctx.quadraticCurveTo(20, -2.6, 32, -0.2); ctx.lineTo(7.5, 1.3); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'axe': shaft(-3, 24, 3, '#A8743E'); ctx.fillStyle = '#AEB7C2'; ctx.beginPath(); ctx.moveTo(18, -1.5); ctx.quadraticCurveTo(22, -9, 27, -8.5); ctx.quadraticCurveTo(25, -3, 24, -1.5); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'guitar': shaft(-3, 14, 2.4, '#5A3A24'); ctx.fillStyle = '#E5483D'; ctx.beginPath(); ctx.arc(17.5, 0, 4.8, 0, TAU); ctx.arc(24.5, 0, 6.2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(17.5, 0, 4.8, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(24.5, 0, 6.2, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(21, 0, 1.8, 0, TAU); ctx.fillStyle = '#1B1E25'; ctx.fill(); break;
    case 'neon': shaft(-3, 6, 3.4, '#24272E'); ctx.strokeStyle = 'rgba(54,214,255,0.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(32, 0); ctx.stroke(); ctx.strokeStyle = '#36D6FF'; ctx.lineWidth = 3.4; ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.2; ctx.stroke(); break;
    default: // bat
      ctx.fillStyle = '#C08A4F'; ctx.beginPath(); ctx.moveTo(-3, -1.3); ctx.lineTo(10, -1.6); ctx.lineTo(27, -3); ctx.quadraticCurveTo(30, 0, 27, 3); ctx.lineTo(10, 1.6); ctx.lineTo(-3, 1.3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1B1E25'; rr(ctx, -3.5, -1.8, 5, 3.6, 1.2); ctx.fill();
  }
}
/* simple right-facing silhouettes for the HUD and feed */
function drawWeaponIcon(ctx, id, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (id) {
    case 'pistol': rr(ctx, -6, -3, 13, 3.6, 1); ctx.fill(); rr(ctx, -6, -1, 3.6, 6, 1); ctx.fill(); break;
    case 'smg': rr(ctx, -9, -2.6, 17, 4, 1); ctx.fill(); rr(ctx, -2, 0, 3, 6, 1); ctx.fill(); rr(ctx, 7, -1.5, 4, 2, 0.6); ctx.fill(); break;
    case 'shotgun': rr(ctx, -12, -1.6, 8, 4, 1.2); ctx.fill(); rr(ctx, -5, -3, 17, 2.4, 0.8); ctx.fill(); rr(ctx, -5, 0, 17, 2.4, 0.8); ctx.fill(); break;
    case 'rifle': rr(ctx, -13, -1.5, 8, 4, 1.2); ctx.fill(); rr(ctx, -6, -1, 20, 2.4, 0.8); ctx.fill(); rr(ctx, -3, -3.6, 7, 2, 0.8); ctx.fill(); break;
    case 'launcher': rr(ctx, -12, -3, 22, 6, 3); ctx.fill(); rr(ctx, -4, 2, 3, 4, 1); ctx.fill(); break;
    case 'self': case 'world': ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(3, 3); ctx.stroke(); break;
    default: ctx.beginPath(); ctx.moveTo(-10, -1); ctx.lineTo(1, -1.4); ctx.lineTo(10, -2.6); ctx.quadraticCurveTo(12.5, 0, 10, 2.6); ctx.lineTo(1, 1.4); ctx.lineTo(-10, 1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* pets */
function drawPet(ctx, id, x, y, a, t, s, dark) {
  if (!id || id === 'none') return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1);
  const e = '#15171C';
  ctx.lineWidth = 1.2; ctx.strokeStyle = e; ctx.lineCap = 'round';
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.3)' : 'rgba(20,24,32,0.1)'; ctx.beginPath(); ctx.ellipse(3, 9, 6, 3, 0, 0, TAU); ctx.fill();
  const bob = Math.sin(t * 4) * 1.4; ctx.translate(0, bob);
  switch (id) {
    case 'plane': ctx.rotate(a); ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-7, -7); ctx.lineTo(-4, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-4, 0); ctx.strokeStyle = '#B9C0CA'; ctx.stroke(); break;
    case 'orb': { const gr = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.4, '#8FD3FF'); gr.addColorStop(1, 'rgba(47,128,237,0.15)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 3.4 + Math.sin(t * 5), 0, TAU); ctx.fillStyle = '#2F80ED'; ctx.fill(); break; }
    case 'bee': ctx.rotate(a); ctx.fillStyle = 'rgba(255,255,255,0.75)'; const fl = Math.sin(t * 40) * 2; ctx.beginPath(); ctx.ellipse(-1, -5, 3.5, 2 + fl * 0.3, 0.4, 0, TAU); ctx.ellipse(-1, 5, 3.5, 2 + fl * 0.3, -0.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#F2C14E'; ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 4.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.strokeStyle = e; ctx.lineWidth = 1.6; for (const xx of [-2, 1.5]) { ctx.beginPath(); ctx.moveTo(xx, -4); ctx.lineTo(xx, 4); ctx.stroke(); } break;
    case 'cube': ctx.rotate(t * 1.2); ctx.fillStyle = '#8B5CF6'; rr(ctx, -6, -6, 12, 12, 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#B89CFA'; rr(ctx, -3.5, -3.5, 7, 7, 1.5); ctx.fill(); break;
    case 'drone': { ctx.rotate(a); ctx.strokeStyle = '#2B2F38'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6); ctx.stroke(); for (const [px, py] of [[-6, -6], [6, 6], [6, -6], [-6, 6]]) { ctx.beginPath(); ctx.arc(px, py, 3.6, 0, TAU); ctx.fillStyle = 'rgba(160,170,185,0.5)'; ctx.fill(); ctx.strokeStyle = '#2B2F38'; ctx.lineWidth = 0.8; ctx.stroke(); } ctx.fillStyle = '#2B2F38'; rr(ctx, -3.5, -3, 7, 6, 1.5); ctx.fill(); ctx.fillStyle = Math.sin(t * 8) > 0 ? '#38E0B4' : '#2F80ED'; ctx.beginPath(); ctx.arc(2, 0, 1.2, 0, TAU); ctx.fill(); break; }
    case 'ghost': ctx.globalAlpha *= 0.9; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(-7, 6); ctx.lineTo(-7, -1); ctx.arc(0, -1, 7, Math.PI, 0); ctx.lineTo(7, 6); for (let i = 0; i < 4; i++) ctx.lineTo(7 - (i + 0.5) * 3.5, 6 + (i % 2 ? 2.5 : -1) + Math.sin(t * 6 + i) * 0.8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#B9C0CA'; ctx.stroke(); ctx.fillStyle = e; ctx.beginPath(); ctx.arc(-2.5, -1.5, 1.3, 0, TAU); ctx.arc(2.5, -1.5, 1.3, 0, TAU); ctx.fill(); break;
    case 'duck': ctx.rotate(a); ctx.fillStyle = '#F7D23E'; ctx.beginPath(); ctx.ellipse(-2, 0, 7, 5.4, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(5, 0, 3.8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#F28C28'; ctx.beginPath(); ctx.moveTo(8.4, -1.4); ctx.lineTo(11.5, 0); ctx.lineTo(8.4, 1.4); ctx.closePath(); ctx.fill(); break;
    case 'ufo': ctx.fillStyle = '#9AA3AE'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(140,220,255,0.85)'; ctx.beginPath(); ctx.arc(0, -1, 4, 0, TAU); ctx.fill(); ctx.stroke(); for (let i = 0; i < 5; i++) { const aa = t * 3 + i * TAU / 5; ctx.fillStyle = i % 2 ? '#F2C14E' : '#38E0B4'; ctx.beginPath(); ctx.arc(Math.cos(aa) * 7.5, Math.sin(aa) * 3.6, 1.1, 0, TAU); ctx.fill(); } break;
  }
  ctx.restore();
}

/* emblems */
const _glyphCache = {};
function glyphPath(id) { return _glyphCache[id] || (_glyphCache[id] = new Path2D(GLYPHS[id] || GLYPHS.stick)); }
function drawEmblem(ctx, id, x, y, size, bg) {
  const fg = luma(bg) > 0.62 ? INK : '#FFFFFF';
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, TAU); ctx.fillStyle = bg; ctx.fill();
  const k = size / 24 * 0.72; ctx.scale(k, k); ctx.translate(-12, -12);
  ctx.strokeStyle = fg; ctx.lineWidth = 2 / 0.95; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(glyphPath(id));
  ctx.restore();
}
function emblemSVG(id, bg, size) {
  const fg = luma(bg) > 0.62 ? INK : '#FFFFFF';
  return '<svg class="emb" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="' + bg + '"/><g transform="translate(3.36 3.36) scale(.72)"><path d="' + (GLYPHS[id] || GLYPHS.stick) + '" fill="none" stroke="' + fg + '" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
}

/* floor pickups */
function drawPickup(ctx, k, t, dark) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3 + k.x * 0.01);
  ctx.save(); ctx.translate(k.x, k.y);
  if (!k.active) {
    const w = k.kind === 'health' ? 15 : W[k.kind].respawn, prog = 1 - k.t / w;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(20,24,32,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(20,24,32,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + prog * TAU); ctx.stroke();
    ctx.restore(); return;
  }
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
  ctx.strokeStyle = k.kind === 'health' ? '#26A065' : (W[k.kind].tier >= 3 ? '#F2541B' : dark ? 'rgba(255,255,255,0.35)' : 'rgba(20,24,32,0.3)');
  ctx.lineWidth = 1.6; ctx.setLineDash([4, 3.5]); ctx.lineDashOffset = -t * 6; ctx.beginPath(); ctx.arc(0, 0, 17 + pulse * 1.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (k.kind === 'health') {
    ctx.fillStyle = '#26A065'; ctx.strokeStyle = '#0F5A35'; ctx.lineWidth = 1.2;
    rr(ctx, -3, -9, 6, 18, 1.6); ctx.fill(); ctx.stroke(); rr(ctx, -9, -3, 18, 6, 1.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#26A065'; ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
  } else {
    ctx.rotate(Math.sin(k.spin) * 0.5 - 0.6); ctx.translate(-(W[k.kind].len || 26) * 0.38, 0);
    drawGun(ctx, k.kind, dark);
  }
  ctx.restore();
}

/* ---------- front view: the classic stick figure, used in menus and the locker ---------- */
/* o: pal, head, melee, weapon, aim (screen angle the arm points), swing (0..1 or -1), walk, move, t, lit, pet */
function drawStickFront(ctx, o) {
  const t = o.t || 0, pal = o.pal, LW = 4.4, OW = LW + 2.6;
  const breathe = Math.sin(t * 2.1) * 0.7, mv = o.move || 0, ph = o.walk || 0;
  let aim = o.aim == null ? -0.25 : o.aim;
  const flip = Math.cos(aim) < 0; // face the way we point
  ctx.save();
  if (flip) { ctx.scale(-1, 1); aim = Math.PI - aim; }
  // ground shadow
  ctx.fillStyle = 'rgba(20,24,32,0.10)'; ctx.beginPath(); ctx.ellipse(0, 1.5, 24, 4.5, 0, 0, TAU); ctx.fill();
  const hipY = -31 + breathe * 0.4 + Math.abs(Math.sin(ph)) * -2 * mv, neckY = -55 + breathe;
  const step = Math.sin(ph) * 9 * mv;
  const lf = [-9 + step, -Math.max(0, Math.sin(ph)) * 4 * mv], rf = [9 - step, -Math.max(0, -Math.sin(ph)) * 4 * mv];
  const lk = elbow(-2, hipY, lf[0], lf[1], 16.5, 16.5, 1), rk = elbow(2, hipY, rf[0], rf[1], 16.5, 16.5, -1);
  const sh = [0, neckY + 4];
  // arms: right arm aims, left arm supports or relaxes
  const wpn = o.weapon || 'melee';
  let rH, lH, wa, wx, wy;
  if (wpn === 'melee') {
    if (o.swing >= 0) { const e = ease.out(Math.min(1, o.swing * 1.2)); wa = lerp(-2.55, 0.55, e); }
    else wa = -1.05 + Math.sin(t * 1.6) * 0.05;
    rH = [sh[0] + Math.cos(wa * 0.55 + 0.35) * 17, sh[1] + Math.sin(wa * 0.55 + 0.35) * 17];
    wx = rH[0]; wy = rH[1];
    lH = [-15, sh[1] + 15 + breathe];
  } else {
    const a = clamp(aim, -1.1, 1.1);
    const reach = wpn === 'pistol' ? 22 : 15;
    rH = [sh[0] + Math.cos(a) * reach, sh[1] + 3 + Math.sin(a) * reach];
    wa = a; wx = rH[0]; wy = rH[1];
    const L = W[wpn] ? W[wpn].len : 26;
    lH = wpn === 'pistol' ? [rH[0] - 2, rH[1] + 1] : [rH[0] + Math.cos(a) * L * 0.42, rH[1] + Math.sin(a) * L * 0.42];
  }
  const re = elbow(sh[0], sh[1], rH[0], rH[1], 13, 13, -1), le = elbow(sh[0], sh[1], lH[0], lH[1], 13, 13, 1);
  if (o.pet && o.pet !== 'none') drawPet(ctx, o.pet, -34, -58 + Math.sin(t * 2) * 3, 0, t, 1.25, false);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(lf[0], lf[1]); ctx.lineTo(lk[0], lk[1]); ctx.lineTo(-1.5, hipY); ctx.lineTo(1.5, hipY); ctx.lineTo(rk[0], rk[1]); ctx.lineTo(rf[0], rf[1]);
    ctx.moveTo(0, hipY); ctx.lineTo(0, neckY);
    ctx.moveTo(lH[0], lH[1]); ctx.lineTo(le[0], le[1]); ctx.lineTo(sh[0], sh[1]); ctx.lineTo(re[0], re[1]); ctx.lineTo(rH[0], rH[1]);
  };
  // melee rests behind the arm; guns sit in front
  if (wpn === 'melee') { ctx.save(); ctx.translate(wx, wy); ctx.rotate(wa); drawMelee(ctx, o.melee || 'bat', t, false); ctx.restore(); }
  body(); ctx.strokeStyle = pal.out; ctx.lineWidth = OW; ctx.stroke(); ctx.strokeStyle = pal.line; ctx.lineWidth = LW; ctx.stroke();
  if (pal.shine) { ctx.strokeStyle = rgba(pal.shine, 0.7); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-1, hipY - 2); ctx.lineTo(-1, neckY + 2); ctx.stroke(); }
  if (wpn !== 'melee') { ctx.save(); ctx.translate(wx, wy); ctx.rotate(wa); drawGun(ctx, wpn, false); ctx.restore(); }
  ctx.fillStyle = pal.line; ctx.strokeStyle = pal.out; ctx.lineWidth = 1.4;
  for (const h of [rH, lH]) { ctx.beginPath(); ctx.arc(h[0], h[1], 2.7, 0, TAU); ctx.fill(); ctx.stroke(); }
  // head
  const R = 10.5;
  ctx.save(); ctx.translate(0, neckY - R + 0.5);
  drawHeadFront(ctx, o.head || 'plain', R, pal, t, o, flip);
  ctx.restore();
  ctx.restore();
  if (o.lit || o.head === 'matchhead') drawFlame(ctx, flip ? -0 : 0, neckY - R * 2 - (o.head === 'matchhead' ? 1 : 3), o.lit ? 1.25 : 0.9, t, 2);
}
function headCircle(ctx, R, pal) { ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = pal.head; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = pal.ring; ctx.stroke(); }
function dome(ctx, R, cut, fill, line) { ctx.beginPath(); const a = Math.asin(clamp(cut / R, -1, 1)); ctx.arc(0, 0, R, Math.PI - a, a, false); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (line) { ctx.strokeStyle = line; ctx.lineWidth = 1.8; ctx.stroke(); } }
function drawHeadFront(ctx, id, R, pal, t, o, flip) {
  const dk = '#1B1E25';
  const sway = Math.sin(t * 2.4) * 2;
  switch (id) {
    case 'cap': headCircle(ctx, R, pal); dome(ctx, R + 1, -1.5, '#E5483D', dk); ctx.fillStyle = '#C23A30'; rr(ctx, R * 0.2, -3.2, R * 1.45, 3.4, 1.6); ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 1.6; ctx.stroke(); ctx.fillStyle = '#F4F5F7'; ctx.beginPath(); ctx.arc(0, -R - 0.6, 1.6, 0, TAU); ctx.fill(); break;
    case 'beanie': headCircle(ctx, R, pal); dome(ctx, R + 1.2, -0.5, '#E3A321', dk); ctx.fillStyle = '#B9811A'; rr(ctx, -R - 1.2, -3.2, (R + 1.2) * 2, 4, 1.6); ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 1.6; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -R - 3.5, 3.4, 0, TAU); ctx.fillStyle = '#F4F5F7'; ctx.fill(); ctx.stroke(); break;
    case 'band': { ctx.strokeStyle = '#E5483D'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(-R + 1, -4 + k * 2); ctx.quadraticCurveTo(-R - 7, -6 + k * 5 + sway, -R - 13, -2 + k * 7 + sway * 1.5); ctx.stroke(); }
      headCircle(ctx, R, pal); ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 1.2, 0, TAU); ctx.clip(); ctx.fillStyle = '#E5483D'; ctx.fillRect(-R, -5.5, R * 2, 3.6); ctx.restore(); break; }
    case 'bun': headCircle(ctx, R, pal); dome(ctx, R + 0.8, -2, '#5B3D2E', dk); ctx.beginPath(); ctx.arc(0, -R - 4, 4.6, 0, TAU); ctx.fillStyle = '#4A3226'; ctx.fill(); ctx.strokeStyle = dk; ctx.lineWidth = 1.6; ctx.stroke(); ctx.fillStyle = '#E5559C'; rr(ctx, -3.4, -R - 0.8, 6.8, 2, 1); ctx.fill(); break;
    case 'spiky': { headCircle(ctx, R, pal); const pts = [[-R - 1, -1]]; for (let i = 0; i <= 6; i++) { const x = -R - 1 + i * (2 * R + 2) / 6; pts.push([x - (2 * R + 2) / 12, -R - 6 - (i % 2) * 2]); pts.push([x, -R * 0.55]); } pts.push([R + 1, -1]); blob(ctx, pts, '#F0C24B', dk, 1.6); break; }
    case 'mohawk': { headCircle(ctx, R, pal); const pts = [[-4, -R + 2]]; for (let i = 0; i < 5; i++) { pts.push([-4 + i * 2 + 1, -R - 7 - (i % 2 ? 0 : 3)]); pts.push([-4 + i * 2 + 2, -R - 3]); } pts.push([4, -R + 2]); blob(ctx, pts, '#3FCB6B', dk, 1.5); break; }
    case 'ponytail': { ctx.strokeStyle = dk; ctx.lineWidth = 6.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-R + 2, -4); ctx.quadraticCurveTo(-R - 8 + sway, 0, -R - 6 + sway, 11); ctx.stroke(); ctx.strokeStyle = '#7A4A30'; ctx.lineWidth = 4.2; ctx.stroke();
      headCircle(ctx, R, pal); dome(ctx, R + 0.8, -2.5, '#7A4A30', dk); ctx.fillStyle = '#2F80ED'; ctx.beginPath(); ctx.arc(-R + 1.5, -4, 2, 0, TAU); ctx.fill(); break; }
    case 'afro': { ctx.fillStyle = '#2E211A'; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.moveTo(Math.cos(a) * (R + 5) + 4, -3 + Math.sin(a) * (R + 5)); ctx.arc(Math.cos(a) * (R + 5), -3 + Math.sin(a) * (R + 5), 4, 0, TAU); } ctx.fill(); ctx.beginPath(); ctx.arc(0, -3, R + 5, 0, TAU); ctx.fill();
      headCircle(ctx, R * 0.86, pal); ctx.save(); ctx.translate(0, 0); dome(ctx, R * 0.9, -R * 0.35, '#2E211A'); ctx.restore(); break; }
    case 'bucket': headCircle(ctx, R, pal); ctx.fillStyle = '#B39B67'; ctx.strokeStyle = dk; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-R * 0.7, -R - 4); ctx.lineTo(R * 0.7, -R - 4); ctx.lineTo(R * 0.95, -R * 0.3); ctx.lineTo(-R * 0.95, -R * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#C9B27C'; ctx.beginPath(); ctx.ellipse(0, -R * 0.3, R + 6, 2.8, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3B3229'; ctx.fillRect(-R * 0.86, -R * 0.62, R * 1.72, 2); break;
    case 'phones': headCircle(ctx, R, pal); ctx.strokeStyle = dk; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.arc(0, 0, R + 2.4, Math.PI + 0.35, -0.35); ctx.stroke(); for (const s of [-1, 1]) { ctx.fillStyle = '#E5483D'; ctx.strokeStyle = dk; ctx.lineWidth = 1.6; rr(ctx, s * (R + 1.5) - 3, -4.5, 6, 9, 2.4); ctx.fill(); ctx.stroke(); } break;
    case 'ears': for (const s of [-1, 1]) { blob(ctx, [[s * R * 0.92, -R * 0.38], [s * R * 0.66, -R - 7], [s * R * 0.05, -R * 0.96]], pal.head, pal.ring, 2.2); blob(ctx, [[s * R * 0.7, -R * 0.62], [s * R * 0.6, -R - 3.6], [s * R * 0.3, -R * 0.9]], '#F49AB0', null); } headCircle(ctx, R, pal); break;
    case 'party': { headCircle(ctx, R, pal); ctx.save(); ctx.translate(0, -R * 0.62); ctx.rotate(0.18); ctx.beginPath(); ctx.moveTo(-R * 0.72, 0); ctx.lineTo(0, -R * 1.65); ctx.lineTo(R * 0.72, 0); ctx.closePath(); ctx.fillStyle = '#8A4FD8'; ctx.fill(); ctx.save(); ctx.clip(); ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 2.6; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-R, -k * 5 + 2); ctx.lineTo(R, -k * 5 - 6); ctx.stroke(); } ctx.restore(); ctx.strokeStyle = dk; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-R * 0.72, 0); ctx.lineTo(0, -R * 1.65); ctx.lineTo(R * 0.72, 0); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -R * 1.65, 2.6, 0, TAU); ctx.fillStyle = '#F4F5F7'; ctx.fill(); ctx.stroke(); ctx.restore(); break; }
    case 'chef': headCircle(ctx, R, pal); ctx.fillStyle = '#FBFBFC'; ctx.strokeStyle = '#B9C0CA'; ctx.lineWidth = 1.6; rr(ctx, -R * 0.78, -R - 3, R * 1.56, 5, 1.5); ctx.fill(); ctx.stroke(); ctx.beginPath(); for (const [x, y, r] of [[-5, -R - 8, 5.4], [5, -R - 8, 5.4], [0, -R - 12, 6]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.fill(); ctx.stroke(); ctx.fillRect(-R * 0.75, -R - 9, R * 1.5, 6.5); break;
    case 'tophat': headCircle(ctx, R, pal); ctx.fillStyle = '#1B1E25'; rr(ctx, -R * 0.72, -R - 14, R * 1.44, 15, 1.5); ctx.fill(); rr(ctx, -R - 3.5, -R - 0.5, (R + 3.5) * 2, 3.4, 1.7); ctx.fill(); ctx.fillStyle = '#E5483D'; ctx.fillRect(-R * 0.72, -R - 4.5, R * 1.44, 2.8); break;
    case 'helmet': headCircle(ctx, R, pal); dome(ctx, R + 1.6, 1.5, '#5E6B3E', dk); ctx.fillStyle = '#22303D'; rr(ctx, -R * 0.82, -1.4, R * 1.64, 5.2, 2.4); ctx.fill(); ctx.fillStyle = '#7FB4E0'; rr(ctx, -R * 0.5, -0.6, R * 0.5, 1.4, 0.7); ctx.fill(); break;
    case 'ninja': { ctx.strokeStyle = '#E5483D'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(-R + 1, -2); ctx.quadraticCurveTo(-R - 7, k * 4 + sway, -R - 12, 3 + k * 6 + sway); ctx.stroke(); }
      headCircle(ctx, R, { head: '#24272E', ring: '#0D0F12' }); ctx.fillStyle = '#F4F5F7'; rr(ctx, -R * 0.72, -3, R * 1.44, 4.4, 2.2); ctx.fill(); ctx.fillStyle = '#1B1E25'; ctx.beginPath(); ctx.arc(-3, -0.8, 1.2, 0, TAU); ctx.arc(3, -0.8, 1.2, 0, TAU); ctx.fill(); break; }
    case 'horns': headCircle(ctx, R, pal); for (const s of [-1, 1]) { ctx.fillStyle = '#C8322A'; ctx.strokeStyle = dk; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s * R * 0.25, -R * 0.92); ctx.quadraticCurveTo(s * R * 0.55, -R - 9, s * (R + 3), -R - 7); ctx.quadraticCurveTo(s * R * 0.9, -R - 1, s * R * 0.75, -R * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke(); } break;
    case 'viking': headCircle(ctx, R, pal); for (const s of [-1, 1]) { ctx.lineCap = 'round'; ctx.strokeStyle = dk; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s * R * 0.9, -3); ctx.quadraticCurveTo(s * (R + 8), -4, s * (R + 7), -R - 7); ctx.stroke(); ctx.strokeStyle = '#F1E3C0'; ctx.lineWidth = 3.8; ctx.stroke(); } dome(ctx, R + 1.4, -1, '#A3ACB8', dk); ctx.strokeStyle = '#6F7885'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -R - 1.4); ctx.lineTo(0, -1.5); ctx.stroke(); break;
    case 'antenna': for (const s of [-1, 1]) { ctx.strokeStyle = '#5C6675'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s * 3, -R + 1); ctx.lineTo(s * 6.5, -R - 9); ctx.stroke(); ctx.beginPath(); ctx.arc(s * 6.5, -R - 9, 2.5, 0, TAU); ctx.fillStyle = Math.sin(t * 6 + s) > 0 ? '#FF5A1F' : '#E5483D'; ctx.fill(); } headCircle(ctx, R, { head: '#B7C0CC', ring: '#3C4450' }); ctx.fillStyle = '#3C4450'; rr(ctx, -R * 0.6, -2.4, R * 1.2, 4.2, 2); ctx.fill(); ctx.fillStyle = '#38E0B4'; rr(ctx, -R * 0.4, -1.2, R * 0.8, 1.8, 0.9); ctx.fill(); break;
    case 'bubble': headCircle(ctx, R, pal); ctx.beginPath(); ctx.arc(0, -1, R + 6, 0, TAU); ctx.fillStyle = 'rgba(170,210,255,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(110,160,225,0.95)'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -1, R + 3.5, -2.5, -1.7); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#9AA3AE'; rr(ctx, -R * 0.7, R + 3, R * 1.4, 3, 1.5); ctx.fill(); break;
    case 'halo': headCircle(ctx, R, pal); ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(0, -R - 6 + Math.sin(t * 2) * 0.8, R * 0.9, 2.8, 0, 0, TAU); ctx.stroke(); break;
    case 'crown': headCircle(ctx, R, pal); blob(ctx, [[-R * 0.82, -R * 0.55], [-R * 0.82, -R - 6], [-R * 0.4, -R - 1.5], [0, -R - 9], [R * 0.4, -R - 1.5], [R * 0.82, -R - 6], [R * 0.82, -R * 0.55]], '#E9B308', '#7A5800', 1.5); for (const x of [-R * 0.45, 0, R * 0.45]) { ctx.beginPath(); ctx.arc(x, -R * 0.82, 1.4, 0, TAU); ctx.fillStyle = '#E5483D'; ctx.fill(); } break;
    case 'matchhead': ctx.beginPath(); ctx.ellipse(0, 0, R, R * 1.1, 0, 0, TAU); ctx.fillStyle = '#D63A2A'; ctx.fill(); ctx.strokeStyle = '#7E1A10'; ctx.lineWidth = 2.6; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(-3, -4, 2.6, 0, TAU); ctx.fill(); break;
    default: headCircle(ctx, R, pal);
  }
}
