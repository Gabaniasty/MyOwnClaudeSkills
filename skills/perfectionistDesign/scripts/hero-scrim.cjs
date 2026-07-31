/* GATE 19 + GATE 20 — find the WEAKEST hero treatment that still clears AA.
 *
 * Levers, cheapest first:
 *   1. object-position — pans the crop so the photo's DARK features sit clear of
 *      the copy. Costs nothing.
 *   2. copy width — stops long lines running into dark pixels. Costs nothing.
 *   3. a scrim — veils the photo. Costs image quality, so it is binary-searched
 *      to its minimum and forced to alpha 0 before the subject.
 *
 * TWO THINGS THIS LEARNED THE HARD WAY
 *   - RECTS MUST BE REAL GLYPH EXTENTS. A block box includes the empty space to
 *     the right of every short line; sampling it reports dark pixels no letter
 *     touches and makes a fixable hero look hopeless. Get them from the page with
 *     scripts/hero-rects.browser.js and paste them into RECTS below.
 *   - CHECK WHICH AXIS ACTUALLY OVERFLOWS. A 1.43:1 image in a 1.99:1 box crops
 *     vertically, so object-position X is completely inert. Identical rows of
 *     output are the tell.
 *
 * usage:
 *   node hero-scrim.cjs --img=images/hero-1900.jpg --box=1425x717 --rects=scratch/hero-rects.json
 *   node hero-scrim.cjs ... --verify --oy=0.5 --peak=0
 */
const fs = require("fs");
const { abs, arg, loadSharp } = require("./_config.cjs");
const sharp = loadSharp();

const IMG = abs(arg("img", ""));
if (!IMG || !fs.existsSync(IMG)) { console.error("--img=<path> required"); process.exit(1); }
const [BW, BH] = arg("box", "1425x717").split("x").map(Number);
const RECTS_FILE = arg("rects", "");
const WHITE = [255, 255, 255];

/* Plateau across the copy column, then a smoothstep to exactly 0.
   A pure smoothstep from x=0 was tried first and reported "impossible even at
   full white": it had decayed to alpha .09 by the end of the body copy, so no
   peak could ever help. The plateau is the fix. */
const PLATEAU_END = +arg("plateau", 0.34);
const FEATHER_END = +arg("feather", 0.56);
const alphaAt = (peak, fx) => {
  if (fx >= FEATHER_END) return 0;
  if (fx <= PLATEAU_END) return peak;
  const t = (fx - PLATEAU_END) / (FEATHER_END - PLATEAU_END);
  return peak * (1 - t * t * (3 - 2 * t));
};

/* [name, x, y, w, h, [r,g,b], isLargeText] in BOX pixel coordinates */
const RECTS = RECTS_FILE && fs.existsSync(abs(RECTS_FILE))
  ? JSON.parse(fs.readFileSync(abs(RECTS_FILE), "utf8"))
  : (console.error("--rects=<file> required; produce it with hero-rects.browser.js"), process.exit(1));

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };

(async () => {
  const meta = await sharp(IMG).metadata();
  const { data } = await sharp(IMG).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = Math.max(BW / meta.width, BH / meta.height);
  const panX = meta.width * scale - BW, panY = meta.height * scale - BH;

  console.log(`${IMG.split(/[\\/]/).pop()}  ${meta.width}x${meta.height} -> ${BW}x${BH}`);
  console.log(`rendered scale ${scale.toFixed(3)}${scale > 1.02 ? "   *** UPSCALING — the plate is the wrong size or shape (Gate 19) ***" : ""}`);
  console.log(`pannable: x ${Math.round(panX)}px, y ${Math.round(panY)}px` +
              `${panX < 1 ? "   (object-position X is INERT here)" : ""}` +
              `${panY < 1 ? "   (object-position Y is INERT here)" : ""}\n`);

  const evaluate = (ox, oy, peak, report) => {
    const offX = panX * ox, offY = panY * oy;
    let worst = Infinity, which = null;
    for (const [name, x, y, w, h, color, large] of RECTS) {
      const need = large ? 3 : 4.5;
      let lw = Infinity;
      for (let py = y; py < y + h; py += 1) {
        for (let px = x; px < x + w; px += 1) {
          const sx = Math.floor((px + offX) / scale), sy = Math.floor((py + offY) / scale);
          if (sx < 0 || sy < 0 || sx >= meta.width || sy >= meta.height) continue;
          const i = (sy * meta.width + sx) * 3;
          const a = alphaAt(peak, px / BW);
          const g = [data[i], data[i + 1], data[i + 2]].map((c, k) => c * (1 - a) + WHITE[k] * a);
          const r = ratio(color, g);
          if (r < lw) lw = r;
        }
      }
      if (report) console.log(`  ${name.padEnd(10)} need ${String(need).padEnd(4)} got ${lw.toFixed(2).padStart(6)}  ${lw >= need ? `pass (+${(lw - need).toFixed(2)})` : "*** FAIL ***"}`);
      if (lw - need < worst) { worst = lw - need; which = `${name} ${lw.toFixed(2)}/${need}`; }
    }
    return { head: worst, which };
  };

  if (process.argv.includes("--verify")) {
    const oy = +arg("oy", 0.5), ox = +arg("ox", 0.5), peak = +arg("peak", 0);
    console.log(`shipped: object-position ${(ox * 100).toFixed(0)}% ${(oy * 100).toFixed(0)}%   scrim ${peak}\n`);
    const r = evaluate(ox, oy, peak, true);
    console.log(`\n${r.head >= 0 ? "hero contrast OK at the shipped values" : "HERO CONTRAST FAILS"}  (tightest: ${r.which})`);
    process.exit(r.head >= 0 ? 0 : 1);
  }

  const OY = panY > 1 ? [0.2, 0.35, 0.5, 0.65, 0.8] : [0.5];
  const OX = panX > 1 ? [0.5, 0.65, 0.8, 1.0] : [0.5];
  let best = null;
  for (const oy of OY) for (const ox of OX) {
    if (evaluate(ox, oy, 1).head < 0) { console.log(`crop ${(ox * 100) | 0}%/${(oy * 100) | 0}%  -> impossible even at full white`); continue; }
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (evaluate(ox, oy, mid).head >= 0) hi = mid; else lo = mid; }
    const r = evaluate(ox, oy, hi);
    console.log(`crop ${String((ox * 100) | 0).padStart(3)}%/${String((oy * 100) | 0).padStart(3)}%  min scrim ${(hi * 100).toFixed(1).padStart(5)}%   tightest: ${r.which}`);
    if (!best || hi < best.peak) best = { ox, oy, peak: hi };
  }
  if (best) {
    console.log(`\nSHIP: object-position ${(best.ox * 100).toFixed(0)}% ${(best.oy * 100).toFixed(0)}%   --hero-scrim ${best.peak.toFixed(2)}`);
    console.log(`veil on the right ${100 - (FEATHER_END * 100 | 0)}% of the photograph: 0% (untouched)`);
    if (best.peak > 0.5) console.log(`\nA scrim above ~0.5 means the PLATE is wrong, not the CSS. Re-read Gate 19 and\nre-cut it: the last hero that needed 86% needed 0% once the plate was re-cut.`);
  }
})();
