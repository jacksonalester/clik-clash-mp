/* MATCHSTICK · sound: every effect is synthesized with WebAudio (no files) */
const AU = { ctx: null, out: null, sfx: null, noise: null, vol: 0.8, ok: false, last: {}, voices: 0, lx: 0, ly: 0 };
function auInit() {
  if (AU.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = new AC(); AU.ctx = c;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    AU.out = c.createGain(); AU.out.gain.value = 0.9; AU.sfx = c.createGain(); AU.sfx.gain.value = AU.vol;
    AU.sfx.connect(AU.out); AU.out.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 1, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = buf; AU.ok = true;
  } catch (e) { AU.ok = false; }
}
function auUnlock() { auInit(); if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {}); }
function auVolume(v) { AU.vol = v; if (AU.sfx) AU.sfx.gain.value = v; }
function _env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function _chain(vol, pan) {
  const c = AU.ctx, g = c.createGain(); let node = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(AU.sfx); } else g.connect(AU.sfx);
  g.gain.value = vol; return g;
}
function tone(dst, type, f0, f1, t, dur, peak, att) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  _env(g, t, att || 0.004, peak, dur); o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dst, type, f0, f1, q, t, dur, peak, att) {
  const c = AU.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AU.noise; s.playbackRate.value = 1; f.type = type; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = q || 0.8;
  _env(g, t, att || 0.003, peak, dur); s.connect(f); f.connect(g); g.connect(dst);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const SFX = {
  pistol: (d, t, r) => { hiss(d, 'bandpass', 2200 * r, 900, 0.9, t, 0.09, 0.9); tone(d, 'triangle', 170 * r, 60, t, 0.07, 0.6); },
  smg: (d, t, r) => { hiss(d, 'bandpass', 2600 * r, 1200, 1, t, 0.05, 0.6); tone(d, 'square', 140 * r, 70, t, 0.04, 0.18); },
  shotgun: (d, t, r) => { hiss(d, 'lowpass', 2400 * r, 300, 0.7, t, 0.28, 1); tone(d, 'triangle', 95 * r, 40, t, 0.18, 0.8); },
  rifle: (d, t, r) => { hiss(d, 'highpass', 3000, 2000, 0.7, t, 0.04, 0.9); hiss(d, 'bandpass', 700, 260, 1.2, t + 0.01, 0.32, 0.45); tone(d, 'sawtooth', 1400 * r, 180, t, 0.16, 0.12); },
  launcher: (d, t, r) => { hiss(d, 'bandpass', 380, 1700, 1.4, t, 0.26, 0.7, 0.02); tone(d, 'triangle', 120, 60, t, 0.12, 0.5); },
  boom: (d, t) => { hiss(d, 'lowpass', 900, 120, 0.6, t, 0.75, 1.2); tone(d, 'sine', 80, 32, t, 0.55, 1); },
  swing: (d, t, r) => { hiss(d, 'bandpass', 1100 * r, 420, 2.2, t, 0.13, 0.35, 0.03); },
  smack: (d, t, r) => { hiss(d, 'lowpass', 1500 * r, 400, 0.9, t, 0.1, 0.9); tone(d, 'triangle', 210 * r, 80, t, 0.09, 0.7); },
  hit: (d, t) => { tone(d, 'square', 1900, 1700, t, 0.03, 0.12); tone(d, 'sine', 3200, 2800, t, 0.025, 0.08); },
  thud: (d, t, r) => { tone(d, 'sine', 160 * r, 90, t, 0.06, 0.4); },
  hurt: (d, t) => { tone(d, 'sine', 240, 120, t, 0.12, 0.5); hiss(d, 'lowpass', 900, 300, 0.7, t, 0.08, 0.35); },
  snap: (d, t, r) => { hiss(d, 'highpass', 2600 * r, 2600, 0.8, t, 0.025, 0.9); hiss(d, 'bandpass', 1300 * r, 600, 2, t + 0.012, 0.06, 0.6); tone(d, 'triangle', 140 * r, 60, t, 0.14, 0.5); },
  ko: (d, t) => { tone(d, 'triangle', 880, 880, t, 0.09, 0.35); tone(d, 'triangle', 1320, 1320, t + 0.07, 0.14, 0.32); },
  ext: (d, t) => { hiss(d, 'highpass', 5000, 1800, 0.7, t, 0.35, 0.35, 0.02); tone(d, 'sine', 660, 330, t, 0.3, 0.2); },
  ignite: (d, t) => { hiss(d, 'bandpass', 3000, 900, 1, t, 0.09, 0.7); hiss(d, 'lowpass', 600, 1800, 0.6, t + 0.06, 0.45, 0.55, 0.05); },
  dash: (d, t) => { hiss(d, 'bandpass', 600, 1500, 1.6, t, 0.14, 0.4, 0.02); },
  pickup: (d, t) => { tone(d, 'triangle', 520, 980, t, 0.09, 0.35); },
  heal: (d, t) => { tone(d, 'sine', 600, 600, t, 0.08, 0.3); tone(d, 'sine', 900, 900, t + 0.07, 0.12, 0.28); },
  dry: (d, t) => { tone(d, 'square', 420, 380, t, 0.03, 0.15); tone(d, 'square', 380, 340, t + 0.06, 0.03, 0.12); },
  swap: (d, t) => { hiss(d, 'bandpass', 2400, 1800, 3, t, 0.05, 0.3); },
  spawn: (d, t) => { tone(d, 'sine', 330, 660, t, 0.18, 0.18, 0.02); },
  alarm: (d, t) => { tone(d, 'square', 660, 660, t, 0.1, 0.16); tone(d, 'square', 660, 660, t + 0.18, 0.1, 0.16); },
  down: (d, t) => { tone(d, 'triangle', 300, 120, t, 0.35, 0.3); },
  ui: (d, t) => { tone(d, 'sine', 740, 740, t, 0.045, 0.16, 0.002); },
  back: (d, t) => { tone(d, 'sine', 520, 440, t, 0.06, 0.14, 0.002); },
  toggle: (d, t) => { tone(d, 'sine', 900, 900, t, 0.035, 0.12, 0.002); },
  buy: (d, t) => { [880, 1175, 1568].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.06, 0.16, 0.24)); },
  denied: (d, t) => { tone(d, 'square', 220, 200, t, 0.08, 0.12); tone(d, 'square', 180, 170, t + 0.1, 0.1, 0.12); },
  level: (d, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.08, 0.22, 0.26)); },
  win: (d, t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.09, 0.3, 0.26)); },
  lose: (d, t) => { [440, 392, 330].forEach((f, i) => tone(d, 'triangle', f, f * 0.98, t + i * 0.12, 0.3, 0.22)); },
  start: (d, t) => { hiss(d, 'bandpass', 3200, 1000, 1, t, 0.08, 0.6); hiss(d, 'lowpass', 500, 2000, 0.6, t + 0.05, 0.4, 0.4, 0.04); tone(d, 'sine', 440, 880, t + 0.05, 0.25, 0.12, 0.02); },
};
AU.play = function (name, vol, pan, rate) {
  if (!AU.ok || !SFX[name] || AU.vol <= 0) return;
  const c = AU.ctx; if (c.state !== 'running') return;
  const now = c.currentTime, k = name;
  if (AU.last[k] && now - AU.last[k] < 0.028) return; AU.last[k] = now;
  if (AU.voices > 40) return;
  AU.voices++; setTimeout(() => { AU.voices--; }, 600);
  try { SFX[name](_chain(vol == null ? 1 : vol, pan || 0), now + 0.005, rate || (0.94 + Math.random() * 0.12)); } catch (e) {}
};
AU.at = function (name, x, y, vol) {
  const dx = x - AU.lx, dy = y - AU.ly, d = Math.hypot(dx, dy);
  const k = clamp(1 - (d - 160) / 900, 0, 1); if (k <= 0.02) return;
  AU.play(name, (vol == null ? 1 : vol) * k * k, clamp(dx / 600, -0.8, 0.8));
};
