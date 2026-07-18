# Phase 5 — Build Standards

Pull in `design-taste-frontend` and `ui-ux-pro-max` before starting. This file covers the
architecture and the specific traps, not taste.

---

## 1. Architecture: one self-contained file

```
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>...</title>
  <meta name="description" content="..." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=...&display=swap" rel="stylesheet" />
  <style> /* the whole design system + every component */ </style>
  <script> /* the .js gate — see §3 */ </script>
</head>
<body>
  ... semantic sections ...
  <script> /* one IIFE, "use strict" */ </script>
</body>
</html>
```

Rules: no bundler, no CDN `<script>`, no icon library (inline the SVG paths — Lucide path
data inlines cleanly), Google Fonts `<link>` is the one permitted external resource.

Ship `package.json` + `serve.mjs` alongside so the folder runs locally and deploys under
Nixpacks:

```json
{ "name": "<slug>", "private": true, "type": "module",
  "scripts": { "start": "node serve.mjs" }, "engines": { "node": ">=18" } }
```

`serve.mjs` must read `process.env.PORT`. That single line is what makes it deployable.

---

## 2. Design system as custom properties

Declare everything on `:root` first, then never hard-code a value again.

```css
:root {
  /* layered backgrounds, not one flat colour — this is what stops the page feeling flat */
  --background: #090b09;
  --background-soft: #0d0f0d;
  --surface: #101310;
  --surface-elevated: #171a17;

  --primary: #b9f51c;
  --primary-hover: #c9ff35;
  --primary-muted: rgba(185, 245, 28, 0.12);
  --primary-border: rgba(185, 245, 28, 0.55);

  --text-primary: #f5f7f2;
  --text-secondary: #b7bcb5;
  --text-muted: #818780;

  --border: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.15);

  --radius-button: 5px;
  --radius-card: 7px;
  --radius-image: 5px;

  --t: 180ms;
  --ease: cubic-bezier(.22, .61, .36, 1);

  --pad: 20px;          /* bumped at breakpoints */
  --header-h: 84px;
}
```

**Accent discipline:** the accent goes on buttons, eyebrows, icons, metrics, link arrows,
stars, result figures, focus rings. It does **not** flood the page. If more than ~8% of the
viewport is accent-coloured, pull back.

**Type scale** with `clamp()`, uppercase condensed display against a neutral body face:

```css
--font-display: "Barlow Condensed", sans-serif;
--font-body: "Inter", sans-serif;

.hero-title    { font-size: clamp(4rem, 7vw, 7.75rem); line-height: .86; letter-spacing: -.03em; }
.section-title { font-size: clamp(2.2rem, 4vw, 4rem);  line-height: 1;   letter-spacing: -.025em; }
```

> **Line-height trap.** `line-height: .86` on very large condensed uppercase is fine at
> 124px and collides at 95px, because descender-free uppercase still has real glyph height.
> If the user says lines look "cluttered together", the fix is `line-height` toward `.98`
> plus `letter-spacing: .06em` — not a font-size change.

---

## 3. The reveal-animation contract (load-bearing)

Content must be visible if JavaScript does nothing at all.

**Head gate** — hiding rules only ever apply under `.js`:

```html
<script>
(function () {
  var ok = "IntersectionObserver" in window;
  var reduce = window.matchMedia &&
               window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (ok && !reduce) document.documentElement.className += " js";
})();
</script>
```

```css
.rv { opacity: 1; }                                  /* default: visible */
.js .rv { opacity: 0; transform: translateY(16px);
          transition: opacity .55s var(--ease), transform .55s var(--ease); }
.js .rv.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .rv { opacity: 1 !important; transform: none !important; } }
```

**Unconditional sweep.** The sweep runs alongside the observer and is *never* gated on
observer health:

```js
var pending = Array.prototype.slice.call(document.querySelectorAll(".rv"));
function sweep() {
  if (!pending.length) return;
  var vh = window.innerHeight || 0;
  pending = pending.filter(function (el) {
    if (el.classList.contains("in")) return false;
    var b = el.getBoundingClientRect();
    if (b.top < vh + 120 && b.bottom > -120) { reveal(el); return false; }
    return true;
  });
}
```

> **Why this is absolute.** A fallback once ran only `if (observerAlive)`. The hero flipped
> that true at load, which disabled recovery for everything below it, and **ten images were
> clipped invisible on a live page.** Never gate the recovery path on a signal the happy
> path also sets.

---

## 4. JS patterns

### Self-releasing rAF latch
A plain `if (ticking) return;` deadlocks forever if a frame never lands (backgrounded tab,
throttling). Always pair with a timeout that cancels and runs the work directly:

```js
window.addEventListener("scroll", function () {
  if (ticking) return;
  ticking = true;
  var id = window.requestAnimationFrame(frame);
  window.setTimeout(function () {
    if (!ticking) return;
    window.cancelAnimationFrame(id);
    frame();
  }, 100);
}, { passive: true });
```

Same principle for count-ups (land on the real number after `dur + 500`) and for
`scroll-behavior: smooth` (if `document.hidden`, jump instantly — smooth scrolling is
frame-driven and silently never starts).

### Dialogs — the full contract
`inert` when closed, body scroll lock, focus trap, focus restore, Escape, backdrop click.

```js
function open()  { last = document.activeElement; el.removeAttribute("inert");
                   el.classList.add("open"); document.body.style.overflow = "hidden";
                   setTimeout(function(){ closeBtn.focus(); }, 50); }  // deferred: focus on
                                                                       // a hidden element
                                                                       // fails silently
function close() { el.classList.remove("open"); el.setAttribute("inert", "");
                   document.body.style.overflow = "";
                   if (last && last.focus) last.focus(); }
```

```css
.lb { opacity: 0; visibility: hidden; pointer-events: none;
      transition: opacity .28s var(--ease), visibility .28s var(--ease); }
.lb.open { opacity: 1; visibility: visible; pointer-events: auto; }
```

`pointer-events` must flip immediately — otherwise the dismissed overlay swallows clicks
for the whole fade.

### Carousel/lightbox: read slides from the DOM
Never keep a parallel JS array of captions. Derive from the cards, and pick the **largest**
`srcset` candidate so the lightbox is not a blown-up thumbnail:

```js
var best = (img.getAttribute("srcset") || "").split(",")
  .map(function (p) { var b = p.trim().split(/\s+/); return { url: b[0], w: parseInt(b[1],10)||0 }; })
  .sort(function (a, b) { return b.w - a.w; })[0];
```

### z-index ladder
Declare it once and honour it. A lightbox at 120 under a header at 200 hides its own close
button.

```
header 200 · nav panel 190 · lightbox 250 · trial/primary modal 300
```

---

## 5. `object-fit: cover` crop mathematics

The most common source of "the image is cut off". For container `cw × ch` and natural
`nw × nh`:

```
scale = max(cw/nw, ch/nh)
sw, sh = nw*scale, nh*scale          # scaled size
offX = (sw - cw) * posX              # posX from object-position, 0..1
visible window = [offX/sw, (offX+cw)/sw]   # as a fraction of the source
```

**The flip.** While `cw/ch < nw/nh` the crop is horizontal. The moment the container is
*wider* than the image ratio, it flips to cropping **vertically** — which is what takes the
tops of heads off on ultra-wide monitors. At 2560×860 against a 1.78 photo that is 581px
removed from the top.

**Two fixes, both verified:**

*Desktop* — cap the image box so its ratio can never exceed the source's, and pin it to the
side the subject is on. Fill the remainder with page ground; a full-width tint over the top
makes the seam imperceptible (measured 1.012:1).

```css
.hero-bg { position: absolute; top:0; right:0; bottom:0; left:auto;
           width: 100%; max-width: 1528px; }   /* 860 × 1.7768 */
```

*Mobile* — sometimes the crop is simply impossible: a 390×800 container exposes ~27% of a
16:9 image's width while two faces span 29%. No `object-position` fixes that. Restructure:
the photo becomes a **band at the top** with the copy on solid ground beneath it.

```css
.hero { --band-h: clamp(360px, 100vw, 480px); display: flex; flex-direction: column; }
.hero-bg { position: relative; width: 100%; height: var(--band-h); }
/* overlays clothe the band only, and melt its lower edge into the page ground */
.hero-tint { position:absolute; left:0; right:0; top:0; height: var(--band-h);
  background: linear-gradient(180deg, rgba(0,0,0,.58) 0%, rgba(0,0,0,.16) 26%,
                                      rgba(0,0,0,.10) 58%, rgba(10,12,10,.99) 100%); }
```

---

## 6. Traps that cost real time

| Trap | Symptom | Fix |
|---|---|---|
| UA `figure` margin | Every framed image silently 80px narrow | `figure, blockquote, figcaption { margin: 0 }` in the reset |
| `<img src="">` | Re-fetches the whole HTML doc as an image; 1 "broken image" | Omit the attribute entirely; set it in JS |
| `<source>` 404 | WebP missing → **no fallback to `<img>`**, blank image | Audit `srcset` as well as `src` (`05` §2) |
| Full-bleed rail | Arrows dead at wide viewports | Centre in the frame; fractional card widths |
| `scroll-behavior: smooth` + programmatic `scrollLeft` | Animation stalls, control looks dead | Self-driven rAF tween + timeout guard |
| Shared button class hidden at a breakpoint | Focus trap breaks — element unfocusable | Scope the hiding rule (`.hdr .menu-btn`, not `.menu-btn`) |
| Fixed headline width vs `%` image start | Contrast collapses to ~1.0 at some widths | `min(470px, 34vw)`; stack the lockup |

---

## 7. Accessibility floor

Non-negotiable: 4.5:1 body contrast **measured against rendered pixels**; visible focus
rings (`outline: 2px solid var(--primary); outline-offset: 3px`); real `<button>`/`<a>`;
meaningful `alt`; labelled form fields; landmarks; keyboard-operable mobile menu; nothing
requiring animation to be understood; `prefers-reduced-motion` honoured.

---

## 8. Honesty rules

Placeholder imagery is fine. These are factual claims and must never be fabricated:

- **Before/after pairs.** Two different people presented as one person's result is
  misleading advertising. If no genuine matched pair exists, ship the layout, add an honest
  line on the page, and capitalise the warning at the top of `credits.json`.
- **Testimonials** attached to stock portraits.
- **Attribution.** Never invent a photographer. Record `null` plus the source URL and a note.
- **Third-party assets.** Record the real copyright holder, state plainly that they are not
  licensed to the project, and carry a disclaimer in the footer. Never spoof a user agent to
  get past a 403.
- **Result figures** must match what the photo actually shows. A "+10kg muscle" caption over
  frames that read as fat loss is a claim, not a caption.

Put the caveat where whoever launches the page will see it, and repeat it in your summary
rather than burying it.
