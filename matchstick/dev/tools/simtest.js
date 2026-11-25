// Headless check: run bot-only matches on every map/mode and report problems.
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '../src/js/');
const code = ['util.js', 'data.js', 'sim.js', 'bots.js'].map(f => fs.readFileSync(SRC + f, 'utf8')).join('\n') +
  '\n;globalThis.__api={MAPS,MAP,MODES,PARTY,newGame,addPlayer,step,botUpdate,standings,STEP,W,astar,parseMap,COLORS,HEADS};';
const ctx = { console, Math, Date, Set, Map, Float32Array, Int32Array, Uint8Array, Array, Object, JSON, Number, String, Error };
vm.createContext(ctx); vm.runInContext(code, ctx);
const A = ctx.__api;
const report = { matches: [], problems: [] };
function connectivity(map) {
  const seen = new Uint8Array(map.w * map.h); const st = [];
  const s0 = map.spawns[0]; const i0 = Math.floor(s0.y / 40) * map.w + Math.floor(s0.x / 40); st.push(i0); seen[i0] = 1; let n = 0;
  while (st.length) { const i = st.pop(); n++; const x = i % map.w, y = (i / map.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * map.w + x + dx; if (map.grid[j] === 0 && !seen[j]) { seen[j] = 1; st.push(j); } } }
  let open = 0; for (let i = 0; i < map.grid.length; i++) if (map.grid[i] === 0) open++;
  const bad = []; for (const it of map.items) { const j = Math.floor(it.y / 40) * map.w + Math.floor(it.x / 40); if (!seen[j]) bad.push(it.c + '@' + it.x + ',' + it.y); }
  for (const s of map.spawns) { const j = Math.floor(s.y / 40) * map.w + Math.floor(s.x / 40); if (!seen[j]) bad.push('S@' + s.x + ',' + s.y); }
  return { reach: n, open, bad };
}
for (const id in A.MAP) { const m = A.MAP[id]; const c = connectivity(m); if (c.reach !== c.open || c.bad.length) report.problems.push(`${id}: ${c.open - c.reach} unreachable floor tiles ${c.bad.join(' ')}`); console.log(`map ${id}: ${m.w}x${m.h} walls=${m.walls.length} lows=${m.lows.length} spawns=${m.spawns.length} items=${m.items.map(i => i.c).join('')} reach=${c.reach}/${c.open}`); }
const runs = [];
for (const id in A.MAP) { runs.push({ map: id, mode: 'ffa', bots: 6 }); runs.push({ map: id, mode: 'tdm', bots: 8 }); }
for (const pa of A.PARTY) runs.push({ map: 'yard', mode: 'party', party: pa, bots: 6 });
const t0 = Date.now(); let stepMs = 0, steps = 0;
for (const r of runs) {
  const g = A.newGame({ map: r.map, mode: r.mode, party: r.party });
  for (let i = 0; i < r.bots; i++) {
    const pl = A.addPlayer(g, { name: 'B' + i, bot: true, team: g.teams ? i % 2 : -1, skin: { color: 'red', head: 'plain' }, skill: 0.2 + (i / r.bots) * 0.75 });
  }
  const dist = new Array(r.bots).fill(0), last = g.players.map(p => [p.x, p.y]);
  let nan = false, idleMax = 0; const idle = new Array(r.bots).fill(0);
  let frames = 0;
  while (!g.over && frames < 60 * 400) {
    const a = Date.now();
    for (const p of g.players) A.botUpdate(g, p, A.STEP);
    A.step(g, A.STEP);
    stepMs += Date.now() - a; steps++;
    g.ev.length = 0; frames++;
    g.players.forEach((p, i) => {
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.aim) || !isFinite(p.hp)) nan = true;
      if (p.alive) { const d = Math.hypot(p.x - last[i][0], p.y - last[i][1]); dist[i] += d; idle[i] = d < 0.2 ? idle[i] + 1 : 0; idleMax = Math.max(idleMax, idle[i]); }
      last[i] = [p.x, p.y];
    });
  }
  const st = A.standings(g);
  const res = { map: r.map, mode: r.mode + (r.party ? ':' + r.party.id : ''), secs: (frames / 60).toFixed(0), why: g.endWhy || 'cap', kills: g.players.reduce((s, p) => s + p.kills, 0),
    top: st[0].name + ' ' + st[0].kills, team: g.teams ? g.teamScore.join('-') : '', minDist: Math.min(...dist).toFixed(0), idleMaxSec: (idleMax / 60).toFixed(1), nan };
  report.matches.push(res);
  if (nan) report.problems.push(`${r.map}/${res.mode}: NaN state`);
  if (!g.over) report.problems.push(`${r.map}/${res.mode}: match never ended`);
  if (idleMax > 60 * 4) report.problems.push(`${r.map}/${res.mode}: a bot stood still ${res.idleMaxSec}s`);
  if (+res.minDist < 2000) report.problems.push(`${r.map}/${res.mode}: a bot only travelled ${res.minDist}`);
}
console.table(report.matches);
console.log('avg sim+bots step ms:', (stepMs / steps).toFixed(4), 'total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(report.problems.length ? 'PROBLEMS:\n' + report.problems.join('\n') : 'NO PROBLEMS');
