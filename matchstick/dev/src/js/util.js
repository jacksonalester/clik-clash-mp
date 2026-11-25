'use strict';
/* MATCHSTICK · shared helpers (no DOM) */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; }
const lerpAng = (a, b, t) => a + angDiff(a, b) * t;
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => (a + Math.random() * (b - a + 1)) | 0;
const pick = arr => arr[(Math.random() * arr.length) | 0];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function seeded(seed) { // mulberry32
  return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
/* colour */
const _rgbCache = new Map();
function hexRgb(h) {
  let c = _rgbCache.get(h); if (c) return c;
  let s = h.replace('#', ''); if (s.length === 3) s = s.split('').map(x => x + x).join('');
  const n = parseInt(s, 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; _rgbCache.set(h, c); return c;
}
function rgbHex(r, g, b) { return '#' + ((1 << 24) | (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255)).toString(16).slice(1); }
function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
function shade(h, t) { return t < 0 ? mix(h, '#000000', -t) : mix(h, '#ffffff', t); }
const _rgbaCache = new Map();
function rgba(h, a) {
  const k = h + (Math.round(a * 100));
  let s = _rgbaCache.get(k); if (s) return s;
  const c = hexRgb(h); s = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (Math.round(a * 100) / 100) + ')';
  if (_rgbaCache.size > 4000) _rgbaCache.clear(); _rgbaCache.set(k, s); return s;
}
function luma(h) { const c = hexRgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
const fmtN = n => Math.round(n).toLocaleString('en-US');
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); }
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function todayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function msToMidnight() { const n = new Date(); const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m - n; }
