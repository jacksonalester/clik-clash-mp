/* MATCHSTICK · save data, settings, progression (XP, sparks, dailies, achievements, shop rotation) */
const SAVE_KEY = 'matchstick.save.v1';
const SET = { sfx: 0.8, shake: true, dmgNums: false, quality: 'high', assist: true, lefty: false, fps: false, skill: 'auto', bots: 5, buzz: true };
function buzz(ms) { if (!SET.buzz || !IN.touch) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function freshSave() {
  const owned = {}; for (const c of CATS) owned[c.id] = c.list.filter(i => i.free).map(i => i.id);
  return {
    v: 1, name: 'Player ' + randi(100, 999), sparks: 100, xp: 0, level: 1, owned,
    eq: { head: 'plain', color: 'ink', melee: 'bat', pet: 'none', trail: 'none', fx: 'ink', emblem: 'match' },
    stats: { matches: 0, wins: 0, teamWins: 0, kills: 0, deaths: 0, shots: 0, hits: 0, bestStreak: 0, w_melee: 0, w_pistol: 0, w_smg: 0, w_shotgun: 0, w_rifle: 0, w_launcher: 0, ext: 0, dashes: 0, flawless: 0, top3: 0, time: 0, doubles: 0, winStreak: 0, bestWinStreak: 0 },
    maps: {}, ach: {}, daily: { date: '', list: [], streak: 0, lastAll: '' }, rating: 950, set: Object.assign({}, SET),
    mode: 'ffa', map: 'random', seenHint: false, recent: [], seenItems: 0,
  };
}
let SV = freshSave();
function cleanName(s) { s = String(s || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14); return s || 'Player'; }
function loadSave() {
  let raw = null; try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
  if (raw) { try { SV = sanitize(JSON.parse(raw)); } catch (e) { SV = freshSave(); } }
  Object.assign(SET, SV.set);
}
function sanitize(s) {
  const f = freshSave();
  if (!s || typeof s !== 'object') return f;
  const out = Object.assign(freshSave(), s);
  out.name = cleanName(out.name);
  for (const k of ['sparks', 'xp', 'level', 'rating']) out[k] = Number.isFinite(+out[k]) ? Math.max(0, +out[k]) : f[k];
  out.level = Math.max(1, Math.min(200, Math.floor(out.level)));
  out.owned = Object.assign({}, f.owned, s.owned || {});
  for (const c of CATS) { const ids = new Set(c.list.map(i => i.id)); out.owned[c.id] = Array.from(new Set([...(f.owned[c.id] || []), ...((out.owned[c.id] || []).filter(x => ids.has(x)))])); }
  out.eq = Object.assign({}, f.eq, s.eq || {});
  for (const c of CATS) if (!out.owned[c.id].includes(out.eq[c.id])) out.eq[c.id] = f.eq[c.id];
  out.stats = Object.assign({}, f.stats, s.stats || {}); for (const k in out.stats) if (!Number.isFinite(+out.stats[k])) out.stats[k] = 0;
  out.set = Object.assign({}, SET, s.set || {});
  out.set.sfx = clamp(+out.set.sfx || 0, 0, 1); out.set.bots = [3, 5, 7].includes(+out.set.bots) ? +out.set.bots : 5;
  if (!['auto', 'easy', 'normal', 'hard'].includes(out.set.skill)) out.set.skill = 'auto';
  if (!['high', 'low'].includes(out.set.quality)) out.set.quality = 'high';
  if (!MODES[out.mode]) out.mode = 'ffa'; if (out.map !== 'random' && !MAP[out.map]) out.map = 'random';
  out.daily = Object.assign({}, f.daily, s.daily || {}); if (!Array.isArray(out.daily.list)) out.daily.list = [];
  out.maps = s.maps && typeof s.maps === 'object' ? s.maps : {}; out.ach = s.ach && typeof s.ach === 'object' ? s.ach : {};
  out.recent = Array.isArray(s.recent) ? s.recent.filter(m => MAP[m]).slice(-3) : [];
  return out;
}
function persist() { SV.set = Object.assign({}, SET); try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) {} }

/* ---------- unlocks ---------- */
function owns(cat, id) { return SV.owned[cat].includes(id); }
function lockReason(cat, it) {
  if (owns(cat, it.id)) return null;
  if (it.ach) { const a = ACHIEVEMENTS.find(x => x.id === it.ach); return { kind: 'ach', text: a ? a.name : 'Achievement', desc: a ? a.desc : '' }; }
  if (it.lvl && SV.level < it.lvl) return { kind: 'lvl', text: 'Level ' + it.lvl, desc: 'Unlocks at level ' + it.lvl };
  return null;
}
function grant(cat, id) { if (!owns(cat, id)) { SV.owned[cat].push(id); return true; } return false; }
function ownedCount() { let n = 0; for (const c of CATS) n += SV.owned[c.id].filter(id => { const it = findItem(c.id, id); return it && !it.free; }).length; return n; }
/* today's featured items: 4 unowned, 30% off, same for everyone that day */
function featuredToday() {
  const r = seeded(hashStr('shop' + todayKey())), pool = [];
  for (const c of CATS) for (const it of c.list) if (!it.free && !it.ach && itemPrice(it) > 0) pool.push({ cat: c.id, it });
  for (let i = pool.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 4).map(x => ({ cat: x.cat, id: x.it.id, price: Math.round(itemPrice(x.it) * 0.7 / 10) * 10 }));
}
function priceFor(cat, it) { const f = featuredToday().find(x => x.cat === cat && x.id === it.id); return f ? f.price : itemPrice(it); }

/* ---------- dailies ---------- */
function ensureDaily() {
  const today = todayKey();
  if (SV.daily.date === today && SV.daily.list.length === 3) return;
  const r = seeded(hashStr('daily' + today));
  const easy = DAILY_POOL.filter(d => d.easy), rest = DAILY_POOL.filter(d => !d.easy);
  const pickR = arr => arr.splice((r() * arr.length) | 0, 1)[0];
  const a = [pickR(easy.slice()), pickR(rest), pickR(rest)];
  SV.daily.date = today; SV.daily.list = a.map(d => ({ id: d.id, prog: 0, done: false }));
}
function dailyDef(id) { return DAILY_POOL.find(d => d.id === id); }

/* ---------- levels ---------- */
function addXP(n) {
  const ups = [];
  SV.xp += n;
  while (SV.xp >= xpForLevel(SV.level)) { SV.xp -= xpForLevel(SV.level); SV.level++; ups.push(SV.level); }
  return ups;
}
function nextUnlock() { let best = null; for (const c of CATS) for (const it of c.list) if (it.lvl && it.lvl > SV.level && !owns(c.id, it.id) && (!best || it.lvl < best.lvl)) best = { lvl: it.lvl, it, cat: c.id }; return best; }
function unlocksAtLevel(l) { const out = []; for (const c of CATS) for (const it of c.list) if (it.lvl === l) out.push({ cat: c.id, it }); return out; }
function statFor(stat) {
  if (stat === 'owned') return ownedCount();
  if (stat === 'mapsPlayed') return Object.keys(SV.maps).filter(k => MAP[k]).length;
  return SV.stats[stat] || 0;
}
function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (SV.ach[a.id]) continue;
    if (statFor(a.stat) >= a.goal) {
      SV.ach[a.id] = todayKey(); fresh.push(a);
      for (const c of CATS) for (const it of c.list) if (it.ach === a.id) grant(c.id, it.id);
    }
  }
  return fresh;
}
function botSkill() {
  switch (SET.skill) { case 'easy': return 0.18; case 'normal': return 0.45; case 'hard': return 0.78; }
  return clamp((SV.rating - 700) / 900, 0.12, 0.92);
}
