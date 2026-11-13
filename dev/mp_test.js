// local integration test: boots the real server against the new block1.js, joins 2 clients, checks protocol + health
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const PORT = 8099;
const srv = spawn('node', ['mp_server.js'], { cwd: require('path').join(__dirname, '..'), env: Object.assign({}, process.env, { MP_PORT: PORT, PORT: PORT }) });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
const R = []; const ok = (c, n) => { R.push((c ? 'PASS ' : 'FAIL ') + n); if (!c) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 60 && log.indexOf('listening') < 0; i++) await wait(250);
  ok(log.indexOf('listening') >= 0, 'server boots with the new game code');
  const health = () => new Promise((res) => http.get('http://127.0.0.1:' + PORT + '/', r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(Object.assign(JSON.parse(b), { cors: r.headers['access-control-allow-origin'] })); } catch (e) { res(null); } }); }).on('error', () => res(null)));
  const h0 = await health();
  ok(h0 && h0.ok === true && h0.game === 'BATTLEHEADS MP', 'health endpoint ok + branded: ' + JSON.stringify(h0));
  ok(h0 && h0.cors === '*', 'health endpoint allows the game page to read it (CORS)');
  const mk = () => new Promise(res => { const ws = new WebSocket('ws://127.0.0.1:' + PORT); const c = { ws, welcome: null, states: 0, last: null };
    ws.on('message', raw => { const m = JSON.parse(raw); if (m.t === 'welcome') c.welcome = m; if (m.t === 'state') { c.states++; c.last = m; } }); ws.on('open', () => res(c)); ws.on('error', () => res(c)); });
  const a = await mk(), b = await mk();
  await wait(1500);
  ok(a.welcome && b.welcome && a.welcome.id !== b.welcome.id, 'two players get separate fighters: ' + (a.welcome && a.welcome.id) + ' / ' + (b.welcome && b.welcome.id));
  ok(a.welcome && b.welcome && a.welcome.team !== b.welcome.team, 'players are split across teams');
  ok(a.states > 15 && b.states > 15, 'both receive ~20Hz state frames (' + a.states + ',' + b.states + ' in 1.5s)');
  const me0 = a.last.ents.find(e => e.id === a.welcome.id);
  for (let i = 0; i < 20; i++) { a.ws.send(JSON.stringify({ t: 'input', mvx: 1, mvy: 0, aim: 0, fire: false })); await wait(50); }
  const me1 = a.last.ents.find(e => e.id === a.welcome.id);
  ok(me0 && me1 && (Math.abs(me1.x - me0.x) > 20 || me1.dead || me0.dead), 'server moves a player from their input (dx=' + (me1 && me0 ? (me1.x - me0.x) : '?') + ')');
  const seenB = a.last.ents.find(e => e.id === b.welcome.id);
  ok(!!seenB && seenB.bot === false, 'player A sees player B as a human');
  const h1 = await health(); ok(h1 && h1.clients === 2, 'health reports 2 players');
  a.ws.close(); b.ws.close(); await wait(500);
  const h2 = await health(); ok(h2 && h2.clients === 0, 'seats are released when players leave');
  ok(!/TypeError|ReferenceError|Unhandled/.test(log), 'no server errors in log');
  console.log(R.join('\n')); if (process.exitCode) console.log('--- server log ---\n' + log.slice(-1500));
  srv.kill(); setTimeout(() => process.exit(process.exitCode || 0), 200);
})();
