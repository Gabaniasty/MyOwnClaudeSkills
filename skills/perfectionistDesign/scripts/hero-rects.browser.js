/* Companion to hero-scrim.cjs — dumps REAL GLYPH RECTS from the live page.
 *
 * Run in the page, save the output to scratch/hero-rects.json, pass it with
 * --rects=. Never hand-write these: a block box spans the empty space right of
 * every short line, and a scrim search fed block boxes reported "impossible even
 * at full white" for a hero that in the end needed no scrim at all.
 *
 *   pdHeroRects()                          // default selectors
 *   pdHeroRects('.hero-media', ['.hero h1','.hero .lede'])
 */
(function () {
  window.pdHeroRects = function (heroSel = ".hero-media", textSels = [
    ".hero h1", ".hero .lede", ".hero .eyebrow", ".hero .trust-note", ".hero .trust li",
  ]) {
    const media = document.querySelector(heroSel);
    if (!media) return `no element matches ${heroSel}`;
    const mb = media.getBoundingClientRect();
    const out = [];
    for (const sel of textSels) {
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el);
        const col = (cs.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400;
        const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
        const label = sel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(-10);
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!n.textContent.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          for (const rect of r.getClientRects()) {
            if (rect.width < 2 || rect.height < 2) continue;
            out.push([label,
              Math.round(rect.left - mb.left), Math.round(rect.top - mb.top),
              Math.round(rect.width), Math.round(rect.height), col, large]);
          }
        }
      });
    }
    console.log(`box: ${Math.round(mb.width)}x${Math.round(mb.height)}   pass this as --box=`);
    return { box: `${Math.round(mb.width)}x${Math.round(mb.height)}`, rects: out,
             json: JSON.stringify(out) };
  };
  return "pdHeroRects() installed";
})();
