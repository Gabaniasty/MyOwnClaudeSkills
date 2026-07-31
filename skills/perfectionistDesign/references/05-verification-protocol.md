# Phase 6 — Verification Protocol

> The browser pane often cannot screenshot or run animations (`document.hidden === true`).
> Treat that as the normal case: **measure everything.** When screenshots do work they are
> a bonus for the user, never your evidence.

Distinguish genuine bugs from environment artefacts. Frozen transitions, stalled smooth
scroll and stale computed styles are usually the harness, not the page. Confirm with
geometry before "fixing" a non-bug.

Run every check below. Report numbers, not adjectives.

---

## 0. Environment discriminator — run this FIRST, every time

Before diagnosing any behavioural bug, establish whether the mechanism can run here at all.
Seven times in one session a frozen harness was misread as broken code.

```js
(() => ({
  documentHidden: document.hidden,
  scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  verdict: document.hidden
    ? 'FROZEN: rAF, smooth scroll, CSS transitions, :focus and screenshots are all unreliable. Defeat the artifact before concluding anything.'
    : 'live'
}))()
```

If `documentHidden` is true, apply the workarounds in `07-failure-gates.md` Gate 2 **before**
editing any code. If defeating the artifact makes the symptom disappear, there was no bug —
say so instead of shipping a fix.

## 0.5 Child-overflow sweep — the single highest-value check

One failure class (measuring a container, not its child) caused 5 of the 9 defects that
escaped to the user. Run `07-failure-gates.md` Gate 1 at every breakpoint. Pass condition is
`0`, and the number goes in your report.

## 1. Clean-load baseline

```js
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const steps = Math.ceil(document.body.scrollHeight / 400);
  for (let i = 0; i <= steps; i++) { window.scrollTo(0, i * 400); await wait(45); }
  await wait(900);
  const rv = [...document.querySelectorAll('.rv')];
  return {
    revealTargets: rv.length,
    stranded: rv.filter(el => !el.classList.contains('in')).length,
    imagesBroken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length,
    imagesPending: [...document.images].filter(i => !i.complete).length,
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth
  };
})()
```

All four counters must be 0. Then `read_console_messages({ onlyErrors: true })` — also 0.

---

## 2. Reference audit — `src` **and** `srcset`

Run against disk before deploy, and against the live host after. A failing `<source>` does
**not** fall back to `<img>`; an audit that only checks `src=` reports "0 broken" while ten
WebP files are missing. That shipped once.

```js
// scripts/audit.cjs
const fs = require("fs"), path = require("path");
const dir = process.argv[2] || ".";
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");

const refs = new Set();
for (const m of html.matchAll(/\bsrc="([^"]+)"/g))
  if (m[1] && !/^(https?:|data:|#)/.test(m[1])) refs.add(m[1]);
for (const m of html.matchAll(/\bsrcset="([^"]+)"/g))
  m[1].split(",").forEach(c => {
    const u = c.trim().split(/\s+/)[0];
    if (u && !/^(https?:|data:)/.test(u)) refs.add(u);
  });

const missing = [...refs].filter(r => !fs.existsSync(path.join(dir, r)));
const onDisk = fs.readdirSync(path.join(dir, "images"))
  .filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f)).map(f => "images/" + f);
const unreferenced = onDisk.filter(f => !refs.has(f));

console.log("referenced :", refs.size);
console.log("missing    :", missing.length, missing);
console.log("unreferenced:", unreferenced.length);
```

Both `missing` and `unreferenced` should be 0 — unreferenced files mean either dead weight
or a slot you forgot to wire.

---

## 2.5 ORDER THE PASSES — this file's own instruments have lied twice

Before writing a combined audit, fix the order. Two false alarms came from the harness, not
the page, and both were reported to the user before being caught:

1. **Pixel-sampling passes run FIRST.** Anything that mutates global state — a `data-theme`
   flip, an injected stylesheet, a forced class — runs **LAST**. An audit that toggled to
   dark and back, then read hero text colours, compared *dark-theme text* against
   *light-theme photo pixels* and invented **4 contrast failures**.
2. **Distinguish "not loaded yet" from "failed".** `!img.complete` is true for every lazy,
   offscreen image. Ten "broken images" were ten images that had simply not been requested.

```js
const broken = imgs.filter(i => i.complete && i.naturalWidth === 0);   // real failure
const notYet = imgs.filter(i => !i.complete);                          // just lazy
```

3. **Re-run any failing check in isolation before reporting it.** If it passes alone, the
   harness is the bug. Say that plainly and fix the harness — see Gate 24.

4. **Pin animated elements to their worst frame** before measuring geometry, or a
   measurement catches an arbitrary phase of an idle float.

---

## 3. Contrast against rendered pixels

Not element boxes, not the declared background. Composite the actual backdrop onto a
canvas, then sample the **glyph runs** via `Range.getClientRects()`.

> **Glyph runs, not block boxes — and this is not a detail.** A block element's rect spans
> the empty space to the right of every short line, so sampling it finds dark pixels no
> letter ever touches. Measured that way, one hero reported "impossible even at full white."
> Measured on glyph extents, the same hero needed **no scrim at all**.

> **Check which axis actually crops before tuning `object-position`.** A 1.43:1 image in a
> 1.99:1 box crops vertically; the horizontal value is inert and tuning it does nothing.
> `panX = naturalWidth * scale - box.width` — if that is 0, stop turning that dial.

> **Name the BINDING element.** One 12.5px caption in the faintest ink token was, alone,
> forcing an 86% wash over an entire photograph. Report `tightest: <element> <got>/<need>`
> so the cheapest fix is visible. Order of levers: re-cut the plate → restyle the one
> binding element → narrow the column → only then a scrim, binary-searched to its minimum.

```js
(async () => {
  const hero = document.querySelector('.hero'), img = document.querySelector('.hero-bg img');
  const hb = hero.getBoundingClientRect(), ib = img.getBoundingClientRect();
  const c = document.createElement('canvas');
  c.width = Math.round(hb.width); c.height = Math.round(hb.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = getComputedStyle(hero).backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  // replicate object-fit: cover exactly
  const nw = img.naturalWidth || 1672, nh = img.naturalHeight || 941;
  const scale = Math.max(ib.width / nw, ib.height / nh);
  const sw = nw * scale, sh = nh * scale;
  const p = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(ib.left - hb.left, ib.top - hb.top, ib.width, ib.height);
  ctx.clip();
  ctx.drawImage(img,
    ib.left - hb.left - (sw - ib.width) * p[0],
    ib.top  - hb.top  - (sh - ib.height) * p[1], sw, sh);
  ctx.restore();

  // then paint each overlay gradient in the same order the CSS declares them
  const tint = ctx.createLinearGradient(0, 0, c.width, 0);
  [[0,.98],[.25,.93],[.52,.62],[.74,.30],[1,.45]]
    .forEach(([s, a]) => tint.addColorStop(s, `rgba(5,7,5,${a})`));
  ctx.fillStyle = tint; ctx.fillRect(0, 0, c.width, c.height);

  const lum = (r,g,b) => { const f = v => { v/=255;
    return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
    return .2126*f(r) + .7152*f(g) + .0722*f(b); };

  function check(sel, label) {
    const el = document.querySelector(sel); if (!el) return { label, error: 'missing' };
    const fg = getComputedStyle(el).color.match(/[\d.]+/g).map(Number);
    const fgL = lum(fg[0], fg[1], fg[2]);
    const range = document.createRange(); range.selectNodeContents(el);
    let worst = Infinity;
    for (const r of range.getClientRects()) {           // glyph runs, not the box
      const x0 = Math.max(0, Math.round(r.left - hb.left));
      const y0 = Math.max(0, Math.round(r.top  - hb.top));
      const w = Math.min(c.width - x0, Math.round(r.width));
      const h = Math.min(c.height - y0, Math.round(r.height));
      if (w < 2 || h < 2) continue;
      const d = ctx.getImageData(x0, y0, w, h).data;
      for (let i = 0; i < d.length; i += 4 * 7) {
        const bl = lum(d[i], d[i+1], d[i+2]);
        const ratio = (Math.max(fgL,bl) + .05) / (Math.min(fgL,bl) + .05);
        if (ratio < worst) worst = ratio;
      }
    }
    return { label, contrast: worst.toFixed(2) + ':1', pass: worst >= 4.5 };
  }
  return [check('.hero-title','headline'), check('.hero-desc','body'),
          check('.hero-eyebrow','eyebrow')];
})()
```

Run at **every** breakpoint. Changing a crop changes which pixels sit behind the text, so
re-run after any `object-position` or layout change.

---

## 4. Focal-subject survival (faces, products, logos)

Establish the focal band once by cropping the source and looking at it. Then assert it
survives at every width:

```js
(() => {
  const FACE = { x0: .58, x1: .87, y0: .07, y1: .32 };   // measured, not guessed
  const img = document.querySelector('.hero-bg img');
  const b = img.getBoundingClientRect();
  const nw = 1672, nh = 941;                              // intrinsic, from the attributes
  const scale = Math.max(b.width / nw, b.height / nh);
  const sw = nw * scale, sh = nh * scale;
  const p = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v)/100);
  const win = {
    x0: (sw - b.width)  * p[0] / sw, x1: ((sw - b.width)  * p[0] + b.width)  / sw,
    y0: (sh - b.height) * p[1] / sh, y1: ((sh - b.height) * p[1] + b.height) / sh
  };
  return {
    vw: innerWidth,
    window: `x ${(win.x0*100).toFixed(1)}-${(win.x1*100).toFixed(1)} | ` +
            `y ${(win.y0*100).toFixed(1)}-${(win.y1*100).toFixed(1)}`,
    facesWhole: win.x0 <= FACE.x0 && win.x1 >= FACE.x1 &&
                win.y0 <= FACE.y0 && win.y1 >= FACE.y1,
    verticalCropPx: Math.round(sh - b.height)
  };
})()
```

Sweep **375, 390, 768, 1024, 1440, 1920, 2560**. `facesWhole` must be true at every one.
Watch `verticalCropPx` — a non-zero value at wide widths is the ratio flip from
`04-build-standards.md` §5.

---

## 5. Layout and component geometry

```js
(() => {
  const shots = [...document.querySelectorAll('.card-media')];
  return {
    gridColumns: getComputedStyle(document.querySelector('.grid')).gridTemplateColumns,
    frame: (() => { const b = shots[0].getBoundingClientRect();
                    return Math.round(b.width) + 'x' + Math.round(b.height); })(),
    ratioVsSource: (shots[0].getBoundingClientRect().width /
                    shots[0].getBoundingClientRect().height).toFixed(3),
    variantsChosen: shots.map(s => (s.querySelector('img').currentSrc||'').split('/').pop())
  };
})()
```

`variantsChosen` catches a `sizes` attribute that is lying — if a 579px card pulls the
620w file, good; if it pulls 1400w, your `sizes` is wrong and you are wasting bandwidth.

If a grid column is wider than the element inside it, suspect the `figure` margin trap.

---

## 6. Interaction

Drive it, do not assume it. For a dialog, assert the whole contract in one pass:

```js
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const lb = document.getElementById('lb'), out = {};
  out.onLoad = { open: lb.classList.contains('open'), inert: lb.hasAttribute('inert'),
                 visibility: getComputedStyle(lb).visibility };
  const trigger = document.querySelectorAll('.open-btn')[1];
  trigger.focus(); trigger.click(); await wait(140);
  out.whileOpen = { focus: document.activeElement.id,
                    bodyLocked: document.body.style.overflow === 'hidden' };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(140);
  out.afterEscape = { open: lb.classList.contains('open'),
                      inert: lb.hasAttribute('inert'),
                      focusRestored: document.activeElement === trigger };
  return out;
})()
```

Also verify nothing paints over the dialog:

```js
document.elementFromPoint(innerWidth/2, 22).closest('.hdr')   // must be null when open
```

> A programmatic `.click()` leaves `activeElement` as `body`, so focus "restores" to
> nothing. Focus the trigger first, or you will misread a working restore as broken.

---

## 7. Reporting

State the numbers. "Hero title 15.26:1, body 9.72:1, both pass" — not "contrast looks
good". If a check fails, say so with the measurement and fix it before reporting done.
Never describe an unverified change as working.
