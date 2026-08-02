/* GATE 46 — line-height vs the script the copy is actually in.
 *
 *   window.__leading()        -> { pass, collisions, tightestSlackPx, headroom }
 *
 * Measures REAL GLYPH INK with canvas TextMetrics, between the lines the browser
 * ACTUALLY rendered, and reports the tightest slack in pixels.
 *
 * ─── Two numbers, and only one of them is a gate ────────────────────────────
 *
 *   collisions  (GATE)      the copy on the page today. Any negative slack is a
 *                           real, visible overlap. This fails the build.
 *   headroom    (ADVISORY)  the worst mark stack the script COULD produce — an
 *                           uppercase ogonek directly beneath an acute. Negative
 *                           headroom is not a defect; it means future copy could
 *                           collide. Report it, do not gate on it.
 *
 * The first version of this file gated on headroom and reported 3 collisions on a
 * page that was already measured correct — because it tested `Ą` sitting under `Ó`,
 * which that page's copy never contains. A control that cries wolf gets ignored,
 * so the two numbers are now separate.
 *
 * ─── Why per adjacent line pair ─────────────────────────────────────────────
 *
 * Measuring a whole heading sums the tallest ascent and deepest descent anywhere in
 * it. On a real build that returned 82px for a headline whose true requirement was
 * 71px, because the descender sat on the LAST line with nothing beneath it.
 *
 * ─── Why this matters outside English ───────────────────────────────────────
 *
 * Polish Ż Ó Ś Ć Ń Ź sit above cap height and Ą Ę below the baseline; Vietnamese
 * stacks tone marks on vowel marks; Czech, Turkish, Romanian, Greek and Cyrillic all
 * mark capitals. A .9–.95 display leading is an English-capitals default and collides
 * in every one of them. A real page shipped at .94 and the dot of Ż landed in the
 * line above; the measured minimum was 1.224em, driven by an ordinary comma meeting
 * an ordinary acute.
 */
window.__leading = async function (opts) {
  opts = opts || {};
  const MAX_CHARS = opts.maxChars || 600;      // per-char line detection is O(n)
  await document.fonts.ready;                  // metrics are wrong before this

  const ctx = document.createElement('canvas').getContext('2d');
  const range = document.createRange();

  /* Worst mark stack per script: something with ink ABOVE cap height, and something
     with ink BELOW the baseline. Used for headroom only. */
  const STACKS = {
    pl: ['Ó', 'Ą'], vi: ['Ố', 'Ậ'], cs: ['Ď', 'Ų'],
    tr: ['İ', 'Ç'], ro: ['Ă', 'Ș'], el: ['Ά', 'Ϙ'],
  };

  function setFont(el) {
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
    return cs;
  }

  /* the lines the browser actually laid out, by grouping characters on their top edge */
  function renderedLines(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const out = [];
    let cur = null, curTop = null, seen = 0, node;
    while ((node = walker.nextNode())) {
      for (let i = 0; i < node.length; i++) {
        if (++seen > MAX_CHARS) return out.concat(cur === null ? [] : [cur]);
        range.setStart(node, i); range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (!r.height) continue;
        const top = Math.round(r.top);
        if (curTop === null || Math.abs(top - curTop) > 2) {
          if (cur !== null) out.push(cur);
          cur = ''; curTop = top;
        }
        cur += node.data[i];
      }
    }
    if (cur !== null) out.push(cur);
    return out;
  }

  function sig(el) {
    const c = (el.className || '').toString().trim().split(/\s+/).filter(Boolean)[0];
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  }

  const SEL = opts.selector ||
    'h1,h2,h3,h4,h5,p,li,blockquote,figcaption,dd,dt,td,th,caption';
  const gate = [], head = [], unmeasurable = [];

  document.querySelectorAll(SEL).forEach(el => {
    if (!el.textContent.trim()) return;
    if (el.querySelector(SEL)) return;                    // leaf blocks only
    const cs = setFont(el);
    const lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh)) { unmeasurable.push(sig(el)); return; }
    const up = cs.textTransform === 'uppercase';
    const cast = s => (up ? s.toUpperCase() : s);

    /* ── GATE: the copy that is on the page right now ── */
    const lines = renderedLines(el);
    for (let i = 1; i < lines.length; i++) {
      const need = ctx.measureText(cast(lines[i])).actualBoundingBoxAscent
                 + ctx.measureText(cast(lines[i - 1])).actualBoundingBoxDescent;
      gate.push({
        sel: sig(el), slack: +(lh - need).toFixed(1), lh: +lh.toFixed(1),
        need: +need.toFixed(1),
        pair: `${lines[i - 1].trim().slice(-22)} / ${lines[i].trim().slice(0, 22)}`,
      });
    }

    /* ── ADVISORY: worst stack this typeface could ever be asked to set ── */
    let worst = null;
    for (const [lang, [above, below]] of Object.entries(STACKS)) {
      const need = ctx.measureText(cast(above)).actualBoundingBoxAscent
                 + ctx.measureText(cast(below)).actualBoundingBoxDescent;
      const s = { sel: sig(el), lang, headroom: +(lh - need).toFixed(1) };
      if (!worst || s.headroom < worst.headroom) worst = s;
    }
    if (worst) head.push(worst);
  });

  gate.sort((a, b) => a.slack - b.slack);
  head.sort((a, b) => a.headroom - b.headroom);
  const collisions = gate.filter(r => r.slack < 0);

  console.log(`GATE  collisions in current copy : ${collisions.length}`);
  console.log(`GATE  tightest slack             : ${gate.length ? gate[0].slack + 'px  (' + gate[0].sel + ')' : 'n/a — nothing wrapped'}`);
  console.log(`ADV   tightest headroom          : ${head.length ? head[0].headroom + 'px  (' + head[0].sel + ', ' + head[0].lang + ')' : 'n/a'}`);
  console.log(`      line-height:normal          : ${unmeasurable.length}  (pin a number to make these measurable)`);
  if (collisions.length) console.table(collisions.slice(0, 15));

  console.log('\nNOT covered: clipping by a fixed-height or overflow:hidden ancestor.');
  console.log('Leading can be correct and the mark still be cut off. Check ancestors separately.');
  console.log('Blocks that did not wrap contribute no pair — widen the viewport and re-run.');

  return {
    pass: collisions.length === 0,
    collisions: collisions.length,
    tightestSlackPx: gate.length ? gate[0].slack : null,
    worstPairs: gate.slice(0, 5),
    headroom: head.length ? head[0].headroom : null,
    unmeasurable: unmeasurable.length,
  };
};
