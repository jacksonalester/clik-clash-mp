const { WebSocketServer } = require('ws');
const http = require('http');
let createCanvas;
try {
  if (process.env.MP_NOCANVAS) throw new Error('forced fake');
  createCanvas = require('canvas').createCanvas;
  console.log('[mp] canvas: real (node-canvas)');
} catch (e) {
  // Server never renders; collision is tile-grid (solidPx). All draw calls no-op via proxies.
  createCanvas = () => uniCanvas();
  console.log('[mp] canvas: proxy stubs (render-free server)');
}
function uniCanvas(){ const c = uni('canvas'); c.width = 960; c.height = 540; return c; }

/* ---- headless runtime stubs (identical pattern to the gate test harness) ---- */
function uni(name) {
  const store = {};
  const fn = function () { return uni(name + '()'); };
  return new Proxy(fn, {
    get(t, k) {
      if (k === 'then' || k === Symbol.iterator || k === Symbol.asyncIterator) return undefined;
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'toString') return () => '';
      if (k === 'length') return 0;
      if (k in store) return store[k];
      if (k === 'style' || k === 'dataset') { store[k] = {}; return store[k]; }
      if (k === 'classList') { store[k] = { add(){}, remove(){}, toggle(){}, contains: () => false }; return store[k]; }
      if (k === 'children') return [];
      if (k === 'querySelectorAll') return () => [];
      if (k === 'querySelector') return () => uni(name + '.qs');
      if (k === 'getBoundingClientRect') return () => ({ left:0, top:0, right:960, bottom:540, width:960, height:540 });
      if (k === 'connect') return x => x;
      if (k === 'value') return 0;
      return uni(name + '.' + String(k));
    },
    set(t, k, v) { store[k] = v; return true; },
    apply() { return uni(name + '()'); },
    has() { return true; }
  });
}
const gameCanvas = createCanvas(960, 540);
gameCanvas.style = {}; gameCanvas.dataset = {};
gameCanvas.addEventListener = () => {};
gameCanvas.getBoundingClientRect = () => ({ left:0, top:0, right:960, bottom:540, width:960, height:540 });
const rawCtx = gameCanvas.getContext('2d');
gameCanvas.getContext = () => rawCtx;
const elements = {};
global.document = {
  getElementById(id){ if(id==='cv') return gameCanvas; if(!elements[id]) elements[id]=uni('#'+id); return elements[id]; },
  createElement(tag){ if(tag==='canvas'){ const c=createCanvas(300,150); c.style={}; c.addEventListener=()=>{}; return c; } return uni('<'+tag+'>'); },
  addEventListener(){}, removeEventListener(){}, body: uni('body'), documentElement: uni('html'),
  querySelectorAll: () => [], querySelector: () => uni('doc.qs'), hidden: false,
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() }
};
global.window = global;
function AudioCtxStub(){
  const node = () => uni('audioNode');
  return { createOscillator:node, createGain:node, createBiquadFilter:node, createBufferSource:node, createStereoPanner:node, createDynamicsCompressor:node,
    createBuffer:(ch,len)=>({getChannelData:()=>new Float32Array(len||1),length:len||1}),
    decodeAudioData:(buf,ok)=>{ if(ok) ok({duration:1,length:1,numberOfChannels:1,sampleRate:44100,getChannelData:()=>new Float32Array(1)}); return Promise.resolve(); },
    destination:{}, currentTime:0, sampleRate:44100, state:'running', resume:()=>Promise.resolve() };
}
global.AudioContext = AudioCtxStub; global.webkitAudioContext = AudioCtxStub;
global.Audio = function(){ return uni('audio'); };
global.Image = function(){ const o={ set src(v){ setTimeout(()=>o.onload&&o.onload(),0); } }; return o; };
global.navigator = { vibrate:()=>{}, userAgent:'server', language:'en', maxTouchPoints:0 };
global.matchMedia = () => ({ matches:false, addEventListener(){}, addListener(){} });
global.requestAnimationFrame = () => 0; global.cancelAnimationFrame = () => {};
global.devicePixelRatio = 1; global.innerWidth = 960; global.innerHeight = 540;
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.__DEV = 0;
global.location = { href:'server', search:'', hash:'' };
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };

/* ---- the actual game, running server-side as the single source of truth ---- */
const M = require('./block1.js');
async function main(){
  await M.boot(); // boot() is async and its own tail starts a demo match + forces state='menu' after up to 700ms — must fully settle first
  M.loadMapDbg(process.env.MP_MAP || 'quarry');
  M.startMatch(false);
  if (process.env.MP_TRACE) {
    let n=0;
    setInterval(()=>{ n++; if(n%10===0){ const sd=M.getSdDbg(); console.log('[trace] tick',n,'sd.phase=',sd&&sd.phase,'state=',M.getState()); } }, 50);
  }
  runServer();
}
main();

function runServer(){

const TICK_HZ = 20;
const TICK_MS = 1000 / TICK_HZ;

const clients = new Map(); // ws -> { ent, input }

function claimEnt(){
  const ents = M.getEnts();
  const pool = ents.filter(e => e.bot && !e._claimed && !e.dead && !e.riding);
  if (!pool.length) return null;
  // team-balanced assignment: hand the new human to whichever team has fewer humans
  const nClaimed = t => ents.filter(x => x._claimed && x.team === t).length;
  pool.sort((a, b) => nClaimed(a.team) - nClaimed(b.team));
  const e = pool[0];
  e.bot = false; e._claimed = true;
  e.mvx = 0; e.mvy = 0; e.smx = 0; e.smy = 0;      // input + smoothed momentum
  e.vmx = 0; e.vmy = 0; e.thr = 0;                  // vehicle momentum/throttle
  e.knbx = 0; e.knby = 0;                            // knockback
  e.moving = false; e._traceMe = !!process.env.MP_TRACE3;
  M.driveDbg(e, 0, 0);
  return e;
}
function releaseEnt(e){
  if (!e) return;
  e.bot = true; e._claimed = false;
  M.driveDbg(e, null);
}
function snapshot(){
  return M.getEnts().filter(e=>!e.dead || e.respT!==undefined).map(e => ({
    id: e.name, team: e.team, x: Math.round(e.x), y: Math.round(e.y), aim: +e.aim.toFixed(2),
    hp: e.hp, dead: !!e.dead, downed: !!e.downed, bot: !!e.bot, weapon: e.weapon, streak: e.streak||0
  }));
}

const PORT = process.env.PORT || process.env.MP_PORT || 8081;
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ ok: true, game: 'CLIK! CLASH MP', map: process.env.MP_MAP || 'quarry', clients: clients.size, state: M.getState(), uptime: Math.round(process.uptime()) }));
});
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT, () => console.log('[mp] authoritative server listening on', PORT, 'map:', process.env.MP_MAP || 'quarry'));

wss.on('connection', (ws) => {
  const ent = claimEnt();
  if (!ent) { ws.send(JSON.stringify({t:'full'})); ws.close(); return; }
  clients.set(ws, { ent, input: { mvx:0, mvy:0, aim:ent.aim, fire:false } });
  ws.send(JSON.stringify({ t:'welcome', id: ent.name, team: ent.team }));
  console.log('[mp] client claimed', ent.name, '(' + ent.team + ')');

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.t === 'input') {
        const c = clients.get(ws);
        if (c) c.input = { mvx: +msg.mvx||0, mvy: +msg.mvy||0, aim: +msg.aim||0, fire: !!msg.fire };
      }
      if (msg.t === 'debug') console.log('[debug-msg]', JSON.stringify(msg), 'MP_DEBUG=', JSON.stringify(process.env.MP_DEBUG));
      if (msg.t === 'debug' && process.env.MP_DEBUG) {
        if ('freezeBots' in msg) M.freezeBotsDbg(!!msg.freezeBots);
        if (msg.warp) {
          const t = M.getEnts().find(e => e.name === msg.warp.id);
          console.log('[warp]', msg.warp.id, 'found=', !!t, t ? ('-> ' + msg.warp.x + ',' + msg.warp.y + ' (was ' + Math.round(t.x) + ',' + Math.round(t.y) + ')') : '');
          if (t) { t.x = +msg.warp.x; t.y = +msg.warp.y; t.smx = t.smy = t.vmx = t.vmy = t.knbx = t.knby = 0; }
        }
      }
    } catch(_e) {}
  });

  ws.on('close', () => {
    const c = clients.get(ws);
    if (c) { console.log('[mp] client disconnected', c.ent.name); releaseEnt(c.ent); }
    clients.delete(ws);
  });
});

setInterval(() => {
  M.dismissHintDbg(); // hint overlay hard-freezes update() (line 4762: if(hintUp && state==='match') return)
  for (const [ws, c] of clients) {
    if (ws.readyState !== 1) continue;
    const e = c.ent, inp = c.input;
    M.driveDbg(e, inp.mvx, inp.mvy);
    e.aim = inp.aim;
    if (inp.fire) M.fireDbg(e);
    if (process.env.MP_TRACE2) console.log('[trace2 pre]', e.name, 'inp=', JSON.stringify(inp), 'e.mvx/mvy=', e.mvx, e.mvy, 'e.x/y=', Math.round(e.x), Math.round(e.y));
  }
  M.update(1 / TICK_HZ);
  if (process.env.MP_TRACE2) { for (const [ws,c] of clients){ const e=c.ent; const live=M.getEnts().find(x=>x.name===e.name); console.log('[trace2 post]', e.name, 'heldRef.x=', Math.round(e.x), 'sameObj?', live===e, 'liveRef.x=', live?Math.round(live.x):'?', 'live._dbgMv=', live&&JSON.stringify(live._dbgMv)); } }

  const snap = JSON.stringify({ t:'state', ents: snapshot() });
  for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(snap);
}, TICK_MS);
}
