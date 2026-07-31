/* GATE 20, the half of it that does NOT need a browser.
 *
 * WHY THIS EXISTS
 * A build passed all four mechanical gates and still shipped 38 contrast
 * failures, because contrast lived only in audit.browser.js and an agent working
 * headlessly could not run it. The gates said "correct" about a page whose body
 * copy measured 3.17:1. A check that cannot be run is not a check.
 *
 * This catches the common case with no dependencies: a rule that sets BOTH a
 * text colour and a background, and any declared token pair that is unsafe.
 * Text over a photograph still needs the browser pass — that is stated in the
 * output rather than left implied, because the gap is the whole point of Gate 24.
 *
 * usage: node check-contrast.cjs [--root=<path>] [--min=4.5]
 */
const { cfg, html, arg } = require("./_config.cjs");

const doc = html();
const MIN = +arg("min", 4.5);
const MIN_LARGE = 3;

/* ---------- resolve custom properties, following var() chains ---------- */
const tokens = {};
for (const m of doc.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}]+)[;}]/g)) {
  const name = m[1], val = m[2].trim();
  if (!(name in tokens)) tokens[name] = val;       // first wins = :root
}
function resolve(v, depth = 0) {
  if (depth > 8 || !v) return v;
  const m = v.match(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)/);
  if (!m) return v.trim();
  const next = tokens[m[1]] !== undefined ? tokens[m[1]] : m[2];
  return resolve(v.replace(m[0], next || ""), depth + 1);
}

function parseColor(raw) {
  if (!raw) return null;
  const v = resolve(raw).trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = v.match(/^#([0-9a-f]{6})/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = v.match(/^rgba?\(([^)]+)\)/);
  if (m) {
    const n = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (n.length >= 3 && n.every((x) => !isNaN(x))) {
      if (n.length > 3 && n[3] < 0.9) return null;   // translucent: cannot judge statically
      return n.slice(0, 3);
    }
  }
  const NAMED = { white: [255,255,255], black: [0,0,0], transparent: null };
  if (v in NAMED) return NAMED[v];
  return null;                                       // gradients, color-mix, currentColor
}

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };

/* ---------- 1. rules that set colour AND background together ---------- */
const failures = [];
let checkedRules = 0;
for (const m of doc.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
  const sel = m[1].trim().split("\n").pop().trim(), body = m[2];
  if (!/(^|[;\s])color\s*:/.test(body)) continue;
  const bgRaw = (body.match(/background(?:-color)?\s*:\s*([^;]+)/) || [])[1];
  if (!bgRaw || /gradient|url\(/i.test(bgRaw)) continue;
  const fg = parseColor((body.match(/(?:^|[;\s])color\s*:\s*([^;]+)/) || [])[1]);
  const bg = parseColor(bgRaw);
  if (!fg || !bg) continue;
  checkedRules++;
  /* a rule that also declares a large font size gets the large-text threshold */
  const fs = (body.match(/font-size\s*:\s*([\d.]+)(px|rem)/) || []);
  const px = fs[1] ? (fs[2] === "rem" ? +fs[1] * 16 : +fs[1]) : null;
  const bold = /font-weight\s*:\s*(700|800|900|bold)/.test(body);
  const need = px && (px >= 24 || (px >= 18.66 && bold)) ? MIN_LARGE : MIN;
  const r = ratio(fg, bg);
  if (r < need) failures.push({ sel: sel.slice(0, 60), got: +r.toFixed(2), need,
    fg: `rgb(${fg})`, bg: `rgb(${bg})` });
}

/* ---------- 2. the declared token palette, as a matrix ---------- */
const inkish = [], bgish = [];
for (const [name, raw] of Object.entries(tokens)) {
  const c = parseColor(raw);
  if (!c) continue;
  if (/(ink|text|fg|foreground|on-)/.test(name)) inkish.push([name, c]);
  if (/(bg|background|panel|surface|card|ground)/.test(name)) bgish.push([name, c]);
}
const pairFails = [];
for (const [inName, inC] of inkish) for (const [bgName, bgC] of bgish) {
  const r = ratio(inC, bgC);
  if (r < MIN) pairFails.push({ pair: `${inName} on ${bgName}`, got: +r.toFixed(2) });
}

/* ---------- report ---------- */
console.log(`rules declaring both colour and background : ${checkedRules}`);
console.log(`FAILING                                    : ${failures.length}`);
failures.slice(0, 25).forEach((f) =>
  console.log(`   ${String(f.got).padStart(5)} / ${f.need}   ${f.sel}   ${f.fg} on ${f.bg}`));
if (failures.length > 25) console.log(`   ...and ${failures.length - 25} more`);

console.log(`\ntoken pairs checked : ${inkish.length * bgish.length}`);
console.log(`unsafe pairs        : ${pairFails.length}`);
pairFails.sort((a, b) => a.got - b.got).slice(0, 12).forEach((p) =>
  console.log(`   ${String(p.got).padStart(5)} / ${MIN}   ${p.pair}`));
if (pairFails.length)
  console.log("   (a pair only matters if it is actually used together — check before rewriting)");

console.log(`\nNOT COVERED HERE: text over photographs, gradients, color-mix() or any`);
console.log(`translucent ground. Those need the rendered-pixel pass —`);
console.log(`scripts/audit.browser.js, then await pdAudit(). Do not report "contrast OK"`);
console.log(`on the strength of this file alone.`);

if (failures.length) process.exit(1);
