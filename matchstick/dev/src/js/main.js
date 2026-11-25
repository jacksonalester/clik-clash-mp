/* MATCHSTICK · boot, main loop, match lifecycle, rewards */
const G = { state: 'load', g: null, me: null, acc: 0, last: 0, hitstop: 0, endShown: false, figT: 0, mapId: null, dirty: false };
const TIPS = ['Five KOs in a row sets your head on fire', 'Put out a lit player for a bonus', 'Low walls stop bodies, not bullets', 'Dash through a doorway to break line of sight', 'Rifles pierce. Line them up', 'Guns run dry. Melee never does', 'Green crosses heal 50', 'Out of the fight for 4 seconds? You heal on your own'];

function boot() {
  loadSave(); RN.quality = SET.quality; auVolume(SET.sfx);
  rnInit($('game')); inputInit($('game'));
  homeInit(); pauseInit();
  $('hud').classList.toggle('lefty', !!SET.lefty);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'match') pauseGame(true); });
  document.addEventListener('pointerdown', () => auUnlock(), { capture: true, passive: true });
  window.addEventListener('keydown', e => { if (e.key === 'm' && G.state !== 'load' && !(e.target && e.target.tagName === 'INPUT')) { SET.sfx = SET.sfx > 0 ? 0 : 0.8; auVolume(SET.sfx); persist(); toast(SET.sfx ? 'Sound on' : 'Sound off', 1200); } });
  ensureDaily(); persist();
  loading();
  requestAnimationFrame(loop);
}
function loading() {
  const el = $('load'), mark = el.querySelector('.logo-i'), bar = el.querySelector('.striker');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('loadTip').textContent = pick(TIPS);
  const fontsReady = document.fonts && document.fonts.load ? Promise.all(['500 15px "Barlow"', '600 15px "Barlow"', 'italic 700 30px "Barlow Condensed"'].map(f => document.fonts.load(f))).catch(() => {}) : Promise.resolve();
  const t0 = performance.now(), dur = reduce ? 200 : 1150;
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    bar.style.setProperty('--p', 1); mark.classList.add('lit'); requestAnimationFrame(tick);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { show('home'); el.classList.remove('out'); G.state = 'menu'; }, 240); }, reduce ? 50 : 420);
  };
  el.addEventListener('pointerdown', () => fontsReady.then(finish), { once: true });
  const run = $('loadRun');
  const drawRunner = (now, moving) => {
    try { drawPreview(run, SV.eq, (now - t0) / 1000, { weapon: 'melee', move: moving ? 1 : 0, walk: (now - t0) / 1000 * 15, swing: moving ? -1 : clamp(((now - t0) / 1000 - dur / 1000) / 0.4, 0, 1), aim: 0, pet: false }); } catch (e) {}
  };
  const tick = now => {
    if (done) { if (now - t0 < dur + 700) { drawRunner(now, false); requestAnimationFrame(tick); } return; }
    const p = Math.min(1, (now - t0) / dur);
    bar.style.setProperty('--p', ease.inOut(p).toFixed(3));
    drawRunner(now, true);
    if (p < 1) requestAnimationFrame(tick); else fontsReady.then(finish);
  };
  requestAnimationFrame(tick);
}
function onResize() { rnResize(); layoutSticks(); G.dirty = true; }

/* ---------- loop ---------- */
function loop(now) {
  const dt = Math.min(0.05, (now - (G.last || now)) / 1000) || 0.016; G.last = now;
  try {
    if (G.state === 'match' || G.state === 'results') matchFrame(dt);
    else if (G.state === 'pause') { if (G.dirty) { G.dirty = false; rnFrame(G.g, 1, 0, G.me, viewFor(false)); } }
    else if (G.state === 'menu') menuFrame(dt);
  } catch (err) { G.err = (G.err || 0) + 1; if (G.err < 5) console.error(err); if (G.err > 60 && G.state === 'match') { G.err = 0; quitMatch(); toast('Something went wrong, so we returned you to the menu'); } }
  requestAnimationFrame(loop);
}
function viewFor(hud) {
  return { hud, touch: IN.touch, mouse: IN.mouse.seen && !IN.touch ? IN.mouse : null, sticks: IN.touch ? IN.sticks : null, ammoX: null, ammoY: null, hpX: SAFE.l + 66, hpY: SAFE.t + 40 };
}
function matchFrame(dt) {
  const g = G.g, me = G.me;
  if (G.state === 'match') {
    if (IN.edge.pause) { IN.edge.pause = false; if (!g.over) { pauseGame(true); return; } }
    if (me.alive && !g.over) applyInput(g, me, dt); else { me.in.fire = false; me.in.mx = me.in.my = 0; me.in.melee = false; }
    const tab = IN.keys.has('Tab') && !g.over;
    if (tab !== !$('board').hidden) { if (tab) { $('bdTable').innerHTML = tableRows(g, me, 12); $('bdTitle').textContent = (g.party ? g.party.name : MODES[g.mode].name) + ' · ' + g.map.name; } overlay('board', tab); }
  }
  let scale = 1;
  if (G.hitstop > 0) { G.hitstop -= dt; scale = 0.08; }
  if (g.over && g.overT < 0.4) scale = 0.28;
  G.acc += dt * scale;
  let n = 0;
  while (G.acc >= STEP && n < 5) {
    for (const p of g.players) if (p.bot) botUpdate(g, p, STEP);
    step(g, STEP);
    if (!me.bot) { const I = me.in; I.dash = I.swap = I.pick = I.emote = false; }
    if (g.ev.length) { rnEvents(g, g.ev, me); g.ev.length = 0; }
    G.acc -= STEP; n++;
  }
  if (n >= 5) G.acc = 0;
  AU.lx = RN.cam.x; AU.ly = RN.cam.y;
  rnUpdate(g, dt * Math.max(scale, 0.3), me);
  rnFrame(g, G.acc / STEP, dt, me, viewFor(G.state === 'match'));
  hudDom(g, me);
  if (g.over && !G.endShown && g.overT > 0.75) showResults();
}
function menuFrame(dt) {
  G.figT += dt;
  const t = G.figT;
  if (UI.cur === 'home' && !$('home').hidden) {
    const cv = $('hFig'), cyc = Math.floor(t / 3.4) % 6, wpn = ['melee', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher'][cyc];
    const ph = t % 3.4, swing = wpn === 'melee' && ph > 1.5 && ph < 1.9 ? (ph - 1.5) / 0.4 : -1;
    let aim = -0.2 + Math.sin(t * 0.9) * 0.15;
    if (IN.mouse.seen && !IN.touch) { const r = cv.getBoundingClientRect(); aim = Math.atan2(IN.mouse.y - (r.top + r.height * 0.36), IN.mouse.x - (r.left + r.width / 2)); }
    drawPreview(cv, SV.eq, t, { weapon: wpn, swing, aim });
  } else if (UI.cur === 'locker' && !$('locker').hidden) {
    const cv = $('lFig'), sel = UI.locker.sel, cat = sel ? sel.cat : 'head', sk = previewSkin(), ph = t % 1.8;
    const swing = cat === 'melee' && ph > 0.9 && ph < 1.3 ? (ph - 0.9) / 0.4 : -1;
    drawPreview(cv, sk, t, { weapon: 'melee', swing, move: cat === 'trail' ? 1 : 0, walk: t * 7, trail: cat === 'trail' ? sk.trail : null, fx: cat === 'fx' ? sk.fx : null, lit: false });
  }
}
/* ---------- match lifecycle ---------- */
function pickMap() {
  const pool = MAPS.map(m => m.id).filter(id => !SV.recent.includes(id));
  return pick(pool.length ? pool : MAPS.map(m => m.id));
}
function weighted(list) {
  const wts = { common: 50, rare: 30, epic: 14, legendary: 6 }; let tot = 0;
  for (const it of list) tot += wts[it.r] || 10;
  let r = Math.random() * tot; for (const it of list) { r -= wts[it.r] || 10; if (r <= 0) return it; } return list[0];
}
function randomSkin() {
  const heads = HEADS.filter(h => h.id !== 'matchhead' || Math.random() < 0.15);
  return {
    head: weighted(heads).id, color: weighted(COLORS.filter(c => c.id !== 'ink' || Math.random() < 0.4)).id, melee: weighted(MELEES).id,
    pet: Math.random() < 0.3 ? weighted(PETS.slice(1)).id : 'none', trail: Math.random() < 0.25 ? weighted(TRAILS.slice(1)).id : 'none',
    fx: weighted(FINISHERS).id, emblem: pick(EMBLEMS).id,
  };
}
function botName(names, i) {
  let n = names[i % names.length];
  const r = Math.random();
  if (r < 0.18) n = n + randi(2, 99); else if (r < 0.26) n = n.toLowerCase(); else if (r < 0.3) n = n.toUpperCase();
  return n.slice(0, 12);
}
function startMatch(o) {
  ensureDaily();
  const mode = o.mode || SV.mode, mapId = o.map || pickMap();
  const g = newGame({ map: mapId, mode, party: mode === 'party' ? partyToday() : null });
  const me = addPlayer(g, { name: SV.name, human: true, team: g.teams ? 0 : -1, skin: Object.assign({}, SV.eq) });
  const nb = g.teams ? teamSize() * 2 - 1 : SET.bots, base = botSkill(), names = shuffle(BOT_NAMES.slice());
  for (let i = 0; i < nb; i++) {
    const team = g.teams ? (i < teamSize() - 1 ? 0 : 1) : -1;
    addPlayer(g, { name: botName(names, i), bot: true, team, skin: randomSkin(), skill: clamp(base + rand(-0.12, 0.12), 0.05, 0.98) });
  }
  G.g = g; G.me = me; G.acc = 0; G.hitstop = 0; G.endShown = false; G.mapId = mapId; G.state = 'match';
  SV.recent = SV.recent.concat(mapId).slice(-2); persist();
  rnReset(g); RN.deathBy = -1; RN.look.x = RN.look.y = 0;
  for (const s of SCREENS) $(s).hidden = true;
  for (const id of ['pause', 'results', 'board', 'sheetDaily', 'sheetHow', 'confirm']) $(id).hidden = true;
  $('hud').hidden = false; document.body.classList.add('in-match');
  UI._swapN = UI._swapA = UI._pick = null;
  layoutSticks(); rnResize();
  const modeName = g.party ? g.party.name : MODES[mode].name;
  banner(g.map.name, modeName + ' · first to ' + g.R.target, null);
  if (IN.touch && RN.H > RN.W && !G.rotHint) { G.rotHint = true; setTimeout(() => toast('Turn your phone sideways for a wider view', 2600), 600); }
  if (!SV.seenHint) RN.hint = { text: IN.touch ? (SET.lefty ? 'Right thumb moves. Left thumb aims and fires.' : 'Left thumb moves. Right thumb aims and fires.') : 'WASD to move · mouse to aim · click to fire · Space to dash', t: 7 };
  else RN.hint = null;
}
function playNow() { startMatch({ mode: SV.mode, map: null }); }
function pauseGame(on) {
  if (on) {
    if (G.state !== 'match' || !G.g || G.g.over) return;
    G.state = 'pause'; IN.mouse.down = false; IN.mouse.right = false; IN.keys.clear(); for (const s of IN.sticks) { s.id = null; s.active = false; s.dx = s.dy = 0; }
    $('board').hidden = true; showPause(true); G.dirty = true;
  } else {
    if (G.state !== 'pause') return;
    $('settings').hidden = true; showPause(false); G.state = 'match'; G.last = performance.now(); UI.cur = 'match';
  }
}
function leaveMatchUI() {
  $('hud').hidden = true; document.body.classList.remove('in-match');
  for (const id of ['pause', 'results', 'board', 'settings']) $(id).hidden = true;
}
function quitMatch() { G.state = 'menu'; G.g = null; G.me = null; leaveMatchUI(); show('home'); }
function toMenu() { G.state = 'menu'; leaveMatchUI(); show('home'); }

/* ---------- results + rewards ---------- */
function showResults() {
  G.endShown = true; G.state = 'results';
  const g = G.g, me = G.me, st = standings(g), rank = st.indexOf(me) + 1, n = st.length;
  const win = g.teams ? g.winTeam === me.team : rank === 1, draw = g.teams && g.winTeam === -1;
  SV.seenHint = true;
  // rewards
  const place = g.teams ? (win ? 500 : draw ? 250 : 150) : rank === 1 ? 500 : rank <= 3 ? 250 : 100;
  const xp = me.kills * 100 + me.assists * 30 + me.best * 25 + place + Math.round(Math.min(g.t, 300) * 1.5);
  const sKO = me.kills * 8, sPlace = g.teams ? (win ? 150 : draw ? 90 : 50) : ([120, 70, 40][rank - 1] || 20);
  let sDaily = 0;
  // lifetime stats
  const S = SV.stats;
  S.matches++; S.kills += me.kills; S.deaths += me.deaths; S.shots += me.st.shots; S.hits += me.st.hits; S.ext += me.st.ext; S.dashes += me.st.dashes; S.doubles += me.st.double;
  S.bestStreak = Math.max(S.bestStreak, me.best); S.time += g.t;
  for (const w of ['melee', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher']) S['w_' + w] += me.st[w] || 0;
  if (win) { S.wins++; if (g.teams) S.teamWins++; if (me.deaths === 0) S.flawless++; S.winStreak++; S.bestWinStreak = Math.max(S.bestWinStreak, S.winStreak); } else S.winStreak = 0;
  const top3 = g.teams ? win : rank <= 3; if (top3) S.top3++;
  SV.maps[g.map.id] = (SV.maps[g.map.id] || 0) + 1;
  // dailies
  ensureDaily();
  const prog = { ko: me.kills, match: 1, win: win ? 1 : 0, top3: top3 ? 1 : 0, melee: me.st.melee, shotgun: me.st.shotgun, rifle: me.st.rifle, smg: me.st.smg, launcher: me.st.launcher, lit: me.st.lit, ext: me.st.ext, double: me.st.double, pickup: me.st.pickup };
  const dailyDone = [];
  for (const d of SV.daily.list) { const def = dailyDef(d.id); if (!def || d.done) continue; d.prog += prog[def.stat] || 0; if (d.prog >= def.goal) { d.done = true; sDaily += def.reward; dailyDone.push(def); } }
  // levels
  const oldLvl = SV.level, oldXp = SV.xp, ups = addXP(xp), sLevel = ups.length * 100;
  const sFirst = win && SV.firstWin !== todayKey() ? 100 : 0; if (sFirst) SV.firstWin = todayKey();
  const total = sKO + sPlace + sDaily + sLevel + sFirst; SV.sparks += total;
  // skill rating drives Auto bots
  const perf = g.teams ? (win ? 0.72 : draw ? 0.5 : 0.3) + clamp((me.kills - me.deaths) / 25, -0.2, 0.2) : 1 - (rank - 1) / Math.max(1, n - 1);
  SV.rating = clamp(SV.rating + 170 * (perf - 0.5), 600, 1700);
  const fresh = checkAchievements();
  persist();
  // ---- UI ----
  const title = $('rTitle');
  title.textContent = g.teams ? (draw ? 'Draw' : win ? 'Victory' : 'Defeat') : (rank === 1 ? 'Victory' : ordinal(rank) + ' place');
  title.classList.toggle('win', win);
  const leader = st[0], acc = me.st.shots ? Math.round(100 * me.st.hits / me.st.shots) : 0;
  const head = g.teams ? (draw ? 'Even at ' + g.teamScore[0] + ' each.' : (win ? 'Your team took it ' : 'The other team took it ') + Math.max(...g.teamScore) + ' to ' + Math.min(...g.teamScore) + '.') : (rank === 1 ? 'You won ' + g.map.name + '.' : leader.name + ' won with ' + leader.kills + ' KOs.');
  $('rSub').textContent = head + ' You: ' + me.kills + ' KOs, ' + me.deaths + ' deaths, best streak ' + me.best + (me.st.shots ? ', ' + acc + '% accuracy' : '') + '.';
  $('rTable').innerHTML = tableRows(g, me, 8);
  const chips = [['KOs', sKO], [g.teams ? (win ? 'Win' : 'Played') : ordinal(rank) + ' place', sPlace]];
  if (sFirst) chips.push(['First win today', sFirst]); if (sDaily) chips.push(['Dailies', sDaily]); if (sLevel) chips.push(['Level up', sLevel]);
  $('rRewards').innerHTML = chips.map(c => '<span class="chip">' + esc(c[0]) + ' <b>+' + fmtN(c[1]) + '</b></span>').join('') + '<span class="chip total">' + SPARK + '<b>+' + fmtN(total) + '</b></span><span class="chip"><b>+' + fmtN(xp) + '</b> XP</span>';
  const news = [];
  for (const l of ups) { const un = unlocksAtLevel(l); news.push('<div class="news-item">' + ic('arrow-counter-clockwise') + '<span><b>Level ' + l + '</b>' + (un.length ? ' · unlocked ' + un.map(u => esc(u.it.name)).join(', ') : ' · +100 sparks') + '</span></div>'); }
  for (const a of fresh) { const em = EMBLEMS.find(e => e.ach === a.id); news.push('<div class="news-item">' + emblemSVG(em ? em.id : 'star', embBg(), 28) + '<span><b>' + esc(a.name) + '</b> · ' + esc(a.desc) + (a.also ? ' · ' + a.also + ' unlocked' : '') + '</span></div>'); }
  if (win && S.winStreak >= 2) news.unshift('<div class="news-item">' + ic('flame') + '<span><b>' + S.winStreak + ' wins in a row</b> · best ' + S.bestWinStreak + '</span></div>');
  { const nx = nextUnlock(); if (nx && !ups.length) news.push('<div class="news-item">' + ic('lock-simple') + '<span><b>Next unlock</b> · ' + esc(nx.it.name) + ' at level ' + nx.lvl + ' · ' + fmtN(xpForLevel(SV.level) - SV.xp) + ' XP to the next level</span></div>'); }
  for (const d of dailyDone) news.push('<div class="news-item">' + ic('calendar-check') + '<span><b>Daily done</b> · ' + esc(d.text) + ' · +' + d.reward + '</span></div>');
  $('rNews').innerHTML = news.slice(0, 4).join('');
  // XP bar fills from where you were, through any level-ups
  const bar = $('rXp'), lbl = $('rLvl'), txt = $('rXpTxt');
  bar.style.transition = 'none'; bar.style.width = (100 * oldXp / xpForLevel(oldLvl)) + '%'; lbl.textContent = 'Level ' + oldLvl; txt.textContent = '+' + fmtN(xp) + ' XP';
  void bar.offsetWidth;
  let lv = oldLvl;
  const stepBar = () => {
    if (lv < SV.level) { bar.style.transition = 'width 520ms cubic-bezier(.23,1,.32,1)'; bar.style.width = '100%'; setTimeout(() => { lv++; lbl.textContent = 'Level ' + lv; AU.play('level', 0.7); bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; stepBar(); }, 560); }
    else { bar.style.transition = 'width 620ms cubic-bezier(.23,1,.32,1)'; bar.style.width = (100 * SV.xp / xpForLevel(SV.level)) + '%'; txt.textContent = fmtN(SV.xp) + ' / ' + fmtN(xpForLevel(SV.level)) + ' XP'; }
  };
  setTimeout(stepBar, 260);
  overlay('results', true);
  $('hud').hidden = true;
  AU.play(win ? 'win' : 'lose', 0.8);
}

window.addEventListener('DOMContentLoaded', boot);
