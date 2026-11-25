/* MATCHSTICK · menus: home, modes, locker, profile, settings, pause, results */
const $ = id => document.getElementById(id);
const ic = (n, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '"><use href="#i-' + n + '"/></svg>';
const SPARK = ic('flame');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SCREENS = ['load', 'home', 'modes', 'locker', 'profile', 'settings'];
const UI = { cur: 'load', back: 'home', locker: { tab: 'today', sel: null, confirm: 0 }, figT: 0, toastT: 0, quitArm: 0, resetArm: 0 };

function show(id) {
  for (const s of SCREENS) { const el = $(s); if (!el) continue; const on = s === id; el.hidden = !on; if (on) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } }
  UI.cur = id;
  if (id === 'home') refreshHome();
  if (id === 'locker') buildLocker();
  if (id === 'modes') buildModes();
  if (id === 'profile') buildProfile();
  if (id === 'settings') buildSettings();
}
function toast(msg, ms) {
  const t = $('toast'); t.textContent = msg; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(UI.toastT); UI.toastT = setTimeout(() => { t.hidden = true; }, ms || 2200);
}
function overlay(id, on) { $(id).hidden = !on; }
function confirmBox(title, body, yes, onYes) {
  $('cfT').textContent = title; $('cfB').textContent = body; $('cfYes').textContent = yes;
  overlay('confirm', true);
  $('cfYes').onclick = () => { overlay('confirm', false); AU.play('ui'); onYes(); };
  $('cfNo').onclick = () => { overlay('confirm', false); AU.play('back'); };
}
function embBg() { const c = COLORS.find(x => x.id === SV.eq.color); return c && !c.special ? c.hex : c ? c.hex : INK; }
function tap(el, fn, snd) { el.addEventListener('click', e => { auUnlock(); AU.play(snd || 'ui'); fn(e); }); }

/* ---------- home ---------- */
function refreshHome() {
  ensureDaily();
  $('hName').textContent = SV.name;
  $('hLvl').textContent = 'Level ' + SV.level;
  $('hEmb').innerHTML = emblemSVG(SV.eq.emblem, embBg(), 36);
  $('hSparks').innerHTML = SPARK + '<span>' + fmtN(SV.sparks) + '</span>';
  const need = xpForLevel(SV.level);
  $('hXpLbl').textContent = 'Level ' + SV.level; $('hXp').style.width = (100 * SV.xp / need).toFixed(1) + '%';
  const nx = nextUnlock();
  $('hXpTxt').textContent = nx ? 'Level ' + nx.lvl + ' unlocks ' + nx.it.name : fmtN(SV.xp) + ' / ' + fmtN(need) + ' XP';
  const done = SV.daily.list.filter(d => d.done).length;
  $('hDailyT').textContent = done === 3 ? 'Dailies complete' : 'Daily challenges';
  const hrs = Math.floor(msToMidnight() / 3600000), mins = Math.floor(msToMidnight() / 60000) % 60;
  $('hDailyS').textContent = done + ' of 3 done · new in ' + (hrs ? hrs + 'h ' : '') + mins + 'm';
  const m = MODES[SV.mode], party = SV.mode === 'party' ? partyToday() : null;
  $('hPlaySub').textContent = (party ? party.name : m.name) + ' · random map · ' + (SV.mode === 'tdm' ? teamSize() + 'v' + teamSize() : SET.bots + ' bots');
  const afford = featuredToday().some(f => !owns(f.cat, f.id) && SV.sparks >= f.price);
  $('hLockDot').hidden = !afford;
}
const teamSize = () => (SET.bots + 1) / 2;
function homeInit() {
  tap($('hPlay'), () => { AU.play('start'); playNow(); }, 'toggle');
  tap($('hModes'), () => show('modes'));
  tap($('hLocker'), () => { UI.locker.tab = 'today'; show('locker'); });
  tap($('hFigBtn'), () => { UI.locker.tab = 'head'; show('locker'); });
  tap($('hProfile'), () => show('profile'));
  tap($('hMe'), () => show('profile'));
  tap($('hSet'), () => { UI.back = 'home'; show('settings'); });
  tap($('hDaily'), () => openDaily());
  document.querySelectorAll('[data-back]').forEach(b => tap(b, () => goBack(), 'back'));
  document.querySelectorAll('[data-close]').forEach(b => tap(b, () => { b.closest('.overlay').hidden = true; }, 'back'));
}
function goBack() {
  if (UI.cur === 'settings' && UI.back === 'pause') { $('settings').hidden = true; UI.cur = 'match'; $('game').hidden = false; showPause(true); return; }
  show('home');
}
function openDaily() {
  ensureDaily();
  const hrs = Math.floor(msToMidnight() / 3600000), mins = Math.floor(msToMidnight() / 60000) % 60;
  $('dSub').textContent = 'New challenges in ' + (hrs ? hrs + 'h ' : '') + mins + 'm. Rewards land automatically.';
  $('dList').innerHTML = SV.daily.list.map(d => {
    const def = dailyDef(d.id); if (!def) return '';
    const p = Math.min(d.prog, def.goal);
    return '<div class="daily' + (d.done ? ' done' : '') + '"><b>' + esc(def.text) + '</b><span class="rw">' + (d.done ? ic('check') + 'Done' : SPARK + def.reward) + '</span><div class="bar"><i style="width:' + (100 * p / def.goal) + '%"></i></div><span class="pc">' + p + ' / ' + def.goal + '</span></div>';
  }).join('');
  overlay('sheetDaily', true);
}

/* ---------- modes ---------- */
function buildModes() {
  const party = partyToday();
  const list = [
    { id: 'ffa', name: MODES.ffa.name, desc: MODES.ffa.desc },
    { id: 'tdm', name: MODES.tdm.name, desc: MODES.tdm.desc },
    { id: 'party', name: party.name, desc: party.desc, tag: 'Today' },
  ];
  $('mList').innerHTML = list.map(m => '<button class="mode-card" role="radio" data-mode="' + m.id + '" aria-checked="' + (SV.mode === m.id) + '"><b>' + esc(m.name) + (m.tag ? '<span class="tag">' + m.tag + '</span>' : '') + '</b><span>' + esc(m.desc) + '</span><i class="radio"></i></button>').join('');
  $('mList').querySelectorAll('.mode-card').forEach(b => tap(b, () => { SV.mode = b.dataset.mode; persist(); buildModes(); }, 'toggle'));
  $('mMaps').innerHTML = '<button class="map-card" role="radio" data-map="random" aria-checked="' + (SV.map === 'random') + '"><div class="rand">' + ic('shuffle') + '</div><span>Random</span></button>' +
    MAPS.map(m => '<button class="map-card" role="radio" data-map="' + m.id + '" aria-checked="' + (SV.map === m.id) + '"><canvas data-mapthumb="' + m.id + '"></canvas><span>' + esc(m.name) + '</span></button>').join('');
  $('mMaps').querySelectorAll('canvas[data-mapthumb]').forEach(cv => drawMapThumb(cv, MAP[cv.dataset.mapthumb]));
  $('mMaps').querySelectorAll('.map-card').forEach(b => tap(b, () => { SV.map = b.dataset.map; persist(); $('mMaps').querySelectorAll('.map-card').forEach(x => x.setAttribute('aria-checked', String(x === b))); modesNote(); }, 'toggle'));
  segment($('mBots'), [[3, '3'], [5, '5'], [7, '7']], SET.bots, v => { SET.bots = v; persist(); modesNote(); });
  segment($('mSkill'), [['auto', 'Auto'], ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], SET.skill, v => { SET.skill = v; persist(); modesNote(); });
  modesNote();
  $('mStart').onclick = () => { auUnlock(); AU.play('start'); startMatch({ mode: SV.mode, map: SV.map === 'random' ? null : SV.map }); };
}
function modesNote() {
  const teams = SV.mode === 'tdm';
  $('mNote').textContent = (teams ? 'Teams of ' + teamSize() + '. ' : SET.bots + ' bots join you. ') + (SET.skill === 'auto' ? 'Auto skill follows how you play: win often and bots sharpen up, struggle and they ease off.' : 'Bot skill is fixed at ' + SET.skill + '.') + ' Play now uses this mode with a random map.';
}
function segment(host, opts, cur, onPick) {
  host.innerHTML = opts.map(([v, l]) => '<button role="radio" data-v="' + v + '" aria-checked="' + (String(v) === String(cur)) + '">' + esc(l) + '</button>').join('');
  host.querySelectorAll('button').forEach(b => tap(b, () => {
    host.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    const raw = b.dataset.v; onPick(isNaN(+raw) ? raw : +raw);
  }, 'toggle'));
}
function drawMapThumb(cv, map) {
  const w = cv.clientWidth || 120, h = cv.clientHeight || 80, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const th = map.theme, s = Math.min(w / map.pw, h / map.ph), ox = (w - map.pw * s) / 2, oy = (h - map.ph * s) / 2;
  ctx.fillStyle = th.wall; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
  ctx.fillStyle = th.floor; ctx.fillRect(0, 0, map.pw, map.ph);
  ctx.fillStyle = th.low; for (const r of map.lows) ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
  ctx.fillStyle = th.wall; for (const r of map.walls) ctx.fillRect(r.x, r.y, r.w, r.h);
  for (const it of map.items) { ctx.fillStyle = it.c === '+' ? '#26A065' : (W[GUN_CODES[it.c]].tier >= 3 ? '#F2541B' : th.paint); ctx.beginPath(); ctx.arc(it.x, it.y, 22, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ---------- locker ---------- */
function lockerTabs() { return [{ id: 'today', name: 'Today' }].concat(CATS.map(c => ({ id: c.id, name: c.name }))); }
function buildLocker() {
  $('lSparks').innerHTML = SPARK + '<span>' + fmtN(SV.sparks) + '</span>';
  $('lTabs').innerHTML = lockerTabs().map(t => '<button class="tab" role="tab" data-tab="' + t.id + '" aria-selected="' + (UI.locker.tab === t.id) + '">' + t.name + '</button>').join('');
  $('lTabs').querySelectorAll('.tab').forEach(b => tap(b, () => { UI.locker.tab = b.dataset.tab; UI.locker.sel = null; UI.locker.confirm = 0; buildLocker(); }, 'toggle'));
  const sel = $('lTabs').querySelector('[aria-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  let items;
  if (UI.locker.tab === 'today') items = featuredToday().map(f => ({ cat: f.cat, it: findItem(f.cat, f.id), price: f.price }));
  else items = catList(UI.locker.tab).map(it => ({ cat: UI.locker.tab, it, price: priceFor(UI.locker.tab, it) }));
  if (!UI.locker.sel) {
    if (UI.locker.tab === 'today') { const f = items[0]; UI.locker.sel = f ? { cat: f.cat, id: f.it.id } : null; }
    else UI.locker.sel = { cat: UI.locker.tab, id: SV.eq[UI.locker.tab] };
  }
  const grid = $('lGrid');
  let html = '';
  if (UI.locker.tab === 'today') { const hrs = Math.floor(msToMidnight() / 3600000), mins = Math.floor(msToMidnight() / 60000) % 60; html += '<p class="shelf-note">30% off today. New picks in ' + (hrs ? hrs + 'h ' : '') + mins + 'm.</p>'; }
  html += items.map(x => itemCard(x.cat, x.it, x.price, UI.locker.tab === 'today')).join('');
  grid.innerHTML = html;
  grid.querySelectorAll('canvas[data-thumb]').forEach(cv => { const [cat, id] = cv.dataset.thumb.split(':'); drawThumb(cv, cat, findItem(cat, id)); });
  grid.querySelectorAll('.item').forEach(b => tap(b, () => { UI.locker.sel = { cat: b.dataset.cat, id: b.dataset.id }; UI.locker.confirm = 0; markSel(); updateSel(); }, 'toggle'));
  markSel(); updateSel();
}
function itemCard(cat, it, price, showCat) {
  const own = owns(cat, it.id), eq = SV.eq[cat] === it.id, lock = lockReason(cat, it), full = itemPrice(it);
  let meta;
  if (eq) meta = '<span class="it-meta">Equipped</span>';
  else if (own) meta = '<span class="it-meta">Owned</span>';
  else if (lock) meta = '<span class="it-meta">' + ic('lock-simple') + esc(lock.text) + '</span>';
  else meta = '<span class="it-meta price">' + SPARK + fmtN(price) + (price < full ? ' <s>' + fmtN(full) + '</s>' : '') + '</span>';
  const name = showCat ? CATS.find(c => c.id === cat).name + ' · ' + it.name : it.name;
  return '<button class="item' + (lock ? ' locked' : '') + '" role="listitem" data-cat="' + cat + '" data-id="' + it.id + '" aria-label="' + esc(name) + '"><canvas data-thumb="' + cat + ':' + it.id + '"></canvas>' +
    (eq ? '<span class="eq">' + ic('check') + '</span>' : '') +
    '<span class="it-name"><i class="rar" style="--rc:' + RARITY[it.r].col + '"></i>' + esc(it.name) + '</span>' + meta + '</button>';
}
function markSel() { $('lGrid').querySelectorAll('.item').forEach(b => b.classList.toggle('sel', !!UI.locker.sel && b.dataset.cat === UI.locker.sel.cat && b.dataset.id === UI.locker.sel.id)); }
function updateSel() {
  const s = UI.locker.sel, btn = $('lAct'); if (!s) return;
  const it = findItem(s.cat, s.id), own = owns(s.cat, s.id), eq = SV.eq[s.cat] === s.id, lock = lockReason(s.cat, it), price = priceFor(s.cat, it);
  $('lSelName').textContent = it.name;
  $('lSelMeta').textContent = CATS.find(c => c.id === s.cat).name + ' · ' + RARITY[it.r].name + (lock ? ' · ' + lock.desc : '');
  btn.className = 'btn btn-act';
  if (eq) { btn.innerHTML = ic('check') + 'Equipped'; btn.classList.add('muted'); }
  else if (own) btn.innerHTML = 'Equip';
  else if (lock) { btn.innerHTML = ic('lock-simple') + esc(lock.text); btn.classList.add('muted'); }
  else if (UI.locker.confirm > performance.now()) { btn.innerHTML = 'Confirm ' + SPARK + fmtN(price); btn.classList.add('confirm'); }
  else { btn.innerHTML = 'Buy ' + SPARK + fmtN(price); btn.classList.add('buy'); }
  btn.onclick = () => {
    auUnlock();
    if (eq) return;
    if (own) { SV.eq[s.cat] = s.id; persist(); AU.play('toggle'); buildLocker(); toast(it.name + ' equipped'); return; }
    if (lock) { AU.play('denied'); toast(lock.kind === 'lvl' ? 'Reach level ' + it.lvl + ' to unlock ' + it.name : 'Unlock by earning ' + lock.text + ': ' + lock.desc); return; }
    if (SV.sparks < price) { AU.play('denied'); toast('You need ' + fmtN(price - SV.sparks) + ' more sparks. Every match pays out.'); return; }
    if (UI.locker.confirm > performance.now()) {
      SV.sparks -= price; grant(s.cat, s.id); SV.eq[s.cat] = s.id; UI.locker.confirm = 0;
      const fresh = checkAchievements(); persist(); AU.play('buy'); buildLocker(); toast(it.name + ' unlocked and equipped');
      if (fresh.length) setTimeout(() => toast('Achievement: ' + fresh[0].name), 1400);
      return;
    }
    UI.locker.confirm = performance.now() + 3500; AU.play('ui'); updateSel();
    setTimeout(() => { if (UI.cur === 'locker') updateSel(); }, 3600);
  };
}
function previewSkin() {
  const sk = Object.assign({}, SV.eq), s = UI.locker.sel;
  if (s && UI.cur === 'locker') sk[s.cat] = s.id;
  return sk;
}
function drawThumb(cv, cat, it) {
  const w = cv.clientWidth || 96, h = cv.clientHeight || 96, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.save(); ctx.translate(w / 2, h / 2);
  const sz = Math.min(w, h), col = SV.eq.color;
  switch (cat) {
    case 'head': { ctx.scale(sz / 54, sz / 54); ctx.translate(3, 6); drawHeadFront(ctx, it.id, 10.5, bodyPal(col, false, 1, 0), 1, {}, false); if (it.id === 'matchhead') drawFlame(ctx, 0, -10, 0.9, 1, 0); break; }
    case 'color': { ctx.scale(sz / 104, sz / 104); ctx.translate(0, 40); drawStickFront(ctx, { pal: bodyPal(it.id, false, 1, 2), head: SV.eq.head, melee: SV.eq.melee, weapon: 'melee', t: 1, swing: -1 }); break; }
    case 'melee': { ctx.scale(sz / 44, sz / 44); ctx.rotate(-0.78); ctx.translate(-14, 0); drawMelee(ctx, it.id, 1, false); break; }
    case 'pet': { if (it.id === 'none') { emptyMark(ctx, sz); break; } drawPet(ctx, it.id, 0, -2, -0.6, 1, sz / 30, false); break; }
    case 'trail': { if (it.id === 'none') { emptyMark(ctx, sz); break; } ctx.scale(sz / 112, sz / 112); ctx.translate(10, 40); ctx.save(); ctx.translate(-26, -2); ctx.scale(1.2, 1.2); trailSample(ctx, it.id, bodyPal(col, false, 1, 2).line); ctx.restore(); drawStickFront(ctx, { pal: bodyPal(col, false, 1, 2), head: SV.eq.head, melee: SV.eq.melee, weapon: 'melee', t: 1, swing: -1, move: 1, walk: 1.1 }); break; }
    case 'fx': { ctx.scale(sz / 70, sz / 70); fxSample(ctx, it.id); break; }
    case 'emblem': drawEmblem(ctx, it.id, 0, 0, sz * 0.56, embBg()); break;
  }
  ctx.restore();
}
function emptyMark(ctx, sz) { ctx.strokeStyle = 'rgba(27,30,37,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, sz * 0.18, 0, TAU); ctx.moveTo(-sz * 0.12, sz * 0.12); ctx.lineTo(sz * 0.12, -sz * 0.12); ctx.stroke(); }
function trailSample(ctx, id, col) {
  const r = seeded(7);
  for (let i = 0; i < 7; i++) {
    const x = -8 - i * 5.5, y = (r() - 0.5) * 8, a = 1 - i / 8;
    switch (id) {
      case 'prints': ctx.fillStyle = rgba(col, 0.4 * a); ctx.beginPath(); ctx.ellipse(x, (i % 2 ? 3 : -3), 3.4, 2, 0, 0, TAU); ctx.fill(); break;
      case 'lines': ctx.strokeStyle = rgba(col, 0.5 * a); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y); ctx.stroke(); break;
      case 'sparks': ctx.strokeStyle = rgba('#FFB020', a); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 2); ctx.stroke(); break;
      case 'pixels': ctx.fillStyle = rgba(col, a); ctx.fillRect(x, y, 3, 3); break;
      case 'hearts': ctx.fillStyle = rgba('#E5559C', a); ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.bezierCurveTo(x - 5, y - 1, x - 3, y - 5, x, y - 2); ctx.bezierCurveTo(x + 3, y - 5, x + 5, y - 1, x, y + 3); ctx.fill(); break;
      case 'confetti': ctx.fillStyle = ['#E5483D', '#F2C14E', '#2F80ED', '#26A065'][i % 4]; ctx.save(); ctx.translate(x, y); ctx.rotate(i); ctx.fillRect(-2.5, -1.2, 5, 2.4); ctx.restore(); break;
      case 'embers': ctx.fillStyle = rgba(FLAME[i % 3], a); ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); break;
    }
  }
}
function fxSample(ctx, id) {
  const r = seeded(11), col = '#E5483D';
  switch (id) {
    case 'smoke': for (let i = 0; i < 7; i++) { const a = r() * TAU, d = 8 + r() * 12; ctx.fillStyle = 'rgba(160,168,180,0.45)'; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 6 + r() * 5, 0, TAU); ctx.fill(); } break;
    case 'pixels': for (let i = 0; i < 16; i++) { const a = r() * TAU, d = 6 + r() * 20; ctx.fillStyle = i % 3 ? col : '#1B1E25'; ctx.fillRect(Math.cos(a) * d - 1.5, Math.sin(a) * d - 1.5, 3.5, 3.5); } break;
    case 'confetti': for (let i = 0; i < 18; i++) { const a = r() * TAU, d = 6 + r() * 20; ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(r() * 6); ctx.fillStyle = ['#E5483D', '#F2C14E', '#2F80ED', '#26A065', '#E5559C'][i % 5]; ctx.fillRect(-3, -1.3, 6, 2.6); ctx.restore(); } break;
    case 'shatter': for (let i = 0; i < 10; i++) { const a = i * TAU / 10, d = 12 + r() * 10, c = Math.cos(a), s = Math.sin(a); ctx.fillStyle = '#1B1E25'; ctx.beginPath(); ctx.moveTo(c * (d + 7), s * (d + 7)); ctx.lineTo(c * d - s * 2, s * d + c * 2); ctx.lineTo(c * d + s * 2, s * d - c * 2); ctx.fill(); } break;
    case 'firework': for (let i = 0; i < 16; i++) { const a = i * TAU / 16; ctx.strokeStyle = ['#F2C14E', '#E5483D', '#2F80ED', '#26A065'][i % 4]; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.stroke(); } break;
    default: for (let i = 0; i < 9; i++) { const a = r() * TAU, d = r() * 12; ctx.fillStyle = rgba(col, 0.75); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 3 + r() * 5, 0, TAU); ctx.fill(); }
  }
}

/* ---------- profile ---------- */
function buildProfile() {
  $('pEmb').innerHTML = emblemSVG(SV.eq.emblem, embBg(), 64);
  $('pName').value = SV.name;
  $('pNameForm').onsubmit = e => { e.preventDefault(); const n = cleanName($('pName').value); SV.name = n; $('pName').value = n; persist(); AU.play('toggle'); toast('Callsign saved'); $('pName').blur(); };
  $('pEmbGrid').innerHTML = EMBLEMS.map(e => { const own = owns('emblem', e.id), lk = lockReason('emblem', e); return '<button class="emb-btn' + (own ? '' : ' locked') + '" data-id="' + e.id + '" aria-pressed="' + (SV.eq.emblem === e.id) + '" aria-label="' + esc(e.name) + '">' + emblemSVG(e.id, own ? embBg() : '#9AA1AD', 32) + '</button>'; }).join('');
  $('pEmbGrid').querySelectorAll('.emb-btn').forEach(b => tap(b, () => {
    const e = findItem('emblem', b.dataset.id);
    if (!owns('emblem', e.id)) { const lk = lockReason('emblem', e); AU.play('denied'); toast(lk ? (lk.kind === 'lvl' ? 'Unlocks at level ' + e.lvl : 'Earn "' + lk.text + '": ' + lk.desc) : e.name + ' is in the locker'); return; }
    SV.eq.emblem = e.id; persist(); buildProfile();
  }, 'toggle'));
  const s = SV.stats, kd = s.deaths ? (s.kills / s.deaths) : s.kills, acc = s.shots ? Math.round(100 * s.hits / s.shots) : 0;
  const favW = ['melee', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher'].sort((a, b) => (s['w_' + b] || 0) - (s['w_' + a] || 0))[0];
  const mins = Math.round(s.time / 60);
  const cells = [[fmtN(s.matches), 'Matches'], [fmtN(s.wins), 'Wins'], [fmtN(s.kills), 'KOs'], [kd.toFixed(2), 'KOs per death'], [fmtN(s.bestStreak), 'Best KO streak'], [fmtN(s.bestWinStreak || 0), 'Best win streak'], [acc + '%', 'Accuracy'], [s['w_' + favW] ? (favW === 'melee' ? 'Melee' : W[favW].name) : '—', 'Favorite weapon'], [fmtN(s.ext), 'Lit players put out'], [mins < 60 ? mins + 'm' : (mins / 60).toFixed(1) + 'h', 'Time played']];
  $('pStats').innerHTML = cells.map(c => '<div class="stat"><b>' + esc(c[0]) + '</b><span>' + c[1] + '</span></div>').join('');
  $('pAch').innerHTML = ACHIEVEMENTS.map(a => {
    const done = !!SV.ach[a.id], v = Math.min(statFor(a.stat), a.goal), em = EMBLEMS.find(e => e.ach === a.id);
    return '<div class="ach' + (done ? '' : ' locked') + '">' + emblemSVG(em ? em.id : 'star', done ? embBg() : '#9AA1AD', 40) + '<div><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + (a.also ? ' · unlocks ' + a.also : '') + '</span></div><span class="prog' + (done ? ' done' : '') + '">' + (done ? 'Done' : fmtN(v) + ' / ' + fmtN(a.goal)) + '</span>' + (done ? '' : '<div class="bar"><i style="width:' + (100 * v / a.goal) + '%"></i></div>') + '</div>';
  }).join('');
}

/* ---------- settings ---------- */
function setTgl(el, v) { el.setAttribute('aria-checked', String(!!v)); }
function buildSettings() {
  const vol = $('sVol'); vol.value = Math.round(SET.sfx * 100);
  vol.oninput = () => { SET.sfx = vol.value / 100; auVolume(SET.sfx); };
  vol.onchange = () => { persist(); auUnlock(); AU.play('ui'); };
  const tg = (id, key, after) => { const el = $(id); setTgl(el, SET[key]); el.onclick = () => { SET[key] = !SET[key]; setTgl(el, SET[key]); persist(); auUnlock(); AU.play('toggle'); if (after) after(); }; };
  tg('sShake', 'shake'); tg('sNums', 'dmgNums'); tg('sAssist', 'assist'); tg('sLefty', 'lefty', () => { $('hud').classList.toggle('lefty', SET.lefty); layoutSticks(); }); tg('sFps', 'fps'); tg('sBuzz', 'buzz');
  segment($('sGfx'), [['high', 'Sharp'], ['low', 'Light']], SET.quality, v => { SET.quality = v; RN.quality = v; persist(); rnResize(); });
  segment($('sSkill'), [['auto', 'Auto'], ['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], SET.skill, v => { SET.skill = v; persist(); });
  $('sHow').onclick = () => { AU.play('ui'); openHow(); };
  $('sReset').onclick = () => { AU.play('ui'); confirmBox('Reset all progress?', 'Your level, sparks, unlocks and stats go back to zero. This cannot be undone.', 'Reset', () => { SV = freshSave(); Object.assign(SET, SV.set); persist(); toast('Progress reset'); show('home'); }); };
  $('sAbout').textContent = GAME_NAME.charAt(0) + GAME_NAME.slice(1).toLowerCase() + ' ' + VERSION + ' · © 2026 ' + STUDIO + '. Fonts: Barlow and Barlow Condensed (SIL Open Font License). Icons: Phosphor (MIT). Every character, map, effect and sound is made in code for this game. Saves stay on this device.';
}
function openHow() {
  const touch = IN.touch;
  const rows = touch
    ? [['Move', SET.lefty ? 'Right thumb, anywhere on the right side' : 'Left thumb, anywhere on the left side'], ['Aim and fire', (SET.lefty ? 'Left' : 'Right') + ' thumb. Drag past the ring to shoot. A quick tap fires at the nearest enemy'], ['Dash', 'Lightning button. Short burst, then a cooldown'], ['Switch', 'Weapon pill swaps between your gun and melee'], ['Pick up', 'Walk over a gun. To trade guns, tap Swap']]
    : [['Move', '<span class="kbd">W</span> <span class="kbd">A</span> <span class="kbd">S</span> <span class="kbd">D</span>'], ['Aim and fire', 'Mouse, hold to fire'], ['Melee', 'Right click, or <span class="kbd">Q</span> to put the gun away'], ['Dash', '<span class="kbd">Space</span>'], ['Pick up', 'Walk over a gun. <span class="kbd">E</span> trades for a different one'], ['Scores', 'Hold <span class="kbd">Tab</span>'], ['Pause', '<span class="kbd">Esc</span>']];
  const rules = [['Get lit', 'Five KOs without dying sets your head on fire. Everyone will come for you'], ['Put it out', 'KO a lit player for an Extinguished bonus'], ['Guns', 'Guns spawn on the map with limited ammo. When one runs dry you are back to melee'], ['Health', 'Green crosses heal 50. You also recover after a few seconds out of the fight']];
  $('howBody').innerHTML = rows.concat(rules).map(r => '<div class="how-row"><b>' + r[0] + '</b><span>' + r[1] + '</span></div>').join('');
  overlay('sheetHow', true);
}

/* ---------- pause, board, results ---------- */
function tableRows(g, me, max) {
  const st = standings(g).slice(0, max || 12);
  return '<li class="head"><span>#</span><span></span><span>Player</span><span class="num">KOs</span><span class="num">Deaths</span></li>' +
    st.map((p, i) => '<li class="' + (p === me ? 'me ' : '') + (i === 0 ? 'first' : '') + '"><span class="rk">' + (i + 1) + '</span>' + emblemSVG(p.skin.emblem || 'stick', g.teams ? TEAM_COL[p.team] : (p.human ? embBg() : colorHex(p.skin.color)), 22) +
      '<span class="nm">' + (g.teams ? '<i style="background:' + TEAM_COL[p.team] + '"></i>' : '') + esc(p.name) + '</span><span class="num">' + p.kills + '</span><span class="num">' + p.deaths + '</span></li>').join('');
}
function showPause(on) {
  const g = G.g, me = G.me;
  if (on) {
    UI.quitArm = 0; $('pzQuit').textContent = 'Quit match';
    const modeName = g.party ? g.party.name : MODES[g.mode].name;
    $('pzSub').textContent = modeName + ' · ' + g.map.name + ' · ' + (g.overtime ? 'overtime' : fmtTime(g.timeLeft) + ' left');
    $('pzTable').innerHTML = tableRows(g, me, 8);
  }
  overlay('pause', on);
}
function pauseInit() {
  tap($('tPause'), () => pauseGame(true));
  tap($('pzResume'), () => pauseGame(false));
  tap($('pzSet'), () => { overlay('pause', false); UI.back = 'pause'; $('settings').hidden = false; $('settings').classList.add('enter'); UI.cur = 'settings'; buildSettings(); });
  tap($('pzQuit'), () => {
    if (UI.quitArm > performance.now()) { UI.quitArm = 0; quitMatch(); return; }
    UI.quitArm = performance.now() + 3000; $('pzQuit').textContent = 'Tap again to quit';
    setTimeout(() => { if (UI.quitArm && UI.quitArm <= performance.now()) $('pzQuit').textContent = 'Quit match'; }, 3100);
  });
  tap($('rAgain'), () => { overlay('results', false); AU.play('start'); playNow(true); }, 'toggle');
  tap($('rMenu'), () => { overlay('results', false); toMenu(); }, 'back');
  tap($('tDash'), () => {}, 'none');
  $('tDash').addEventListener('pointerdown', e => { e.preventDefault(); auUnlock(); IN.edge.dash = true; });
  $('tSwap').addEventListener('pointerdown', e => { e.preventDefault(); IN.edge.swap = true; });
  $('tPick').addEventListener('pointerdown', e => { e.preventDefault(); IN.edge.pick = true; });
}
function hudDom(g, me) {
  const hud = $('hud');
  hud.classList.toggle('touch', IN.touch); hud.classList.toggle('dark', g.map.theme.dark); hud.classList.toggle('lefty', !!SET.lefty);
  if (!IN.touch || !me) return;
  const cd = me.dashCD > 0 ? clamp(me.dashCD / g.R.dashCD, 0, 1) : 0;
  $('tDash').style.setProperty('--cd', cd.toFixed(3));
  const wid = me.cur === 'gun' && me.gun ? me.gun : 'melee';
  const nm = wid === 'melee' ? (findItem('melee', me.skin.melee) || { name: 'Melee' }).name : W[wid].name;
  if (UI._swapN !== nm) { $('tSwapName').textContent = nm; UI._swapN = nm; }
  const am = wid === 'melee' ? (me.gun ? (g.R.infAmmo ? '∞' : String(me.ammo)) : '') : (g.R.infAmmo ? '∞' : String(me.ammo));
  if (UI._swapA !== am) { $('tSwapAmmo').textContent = am; UI._swapA = am; }
  $('tSwap').classList.toggle('low', wid !== 'melee' && !g.R.infAmmo && me.ammo <= 3);
  const near = me.alive && me.near ? 'Swap for ' + W[me.near.kind].name : '';
  if (UI._pick !== near) { $('tPick').hidden = !near; $('tPickTxt').textContent = near; UI._pick = near; }
}
