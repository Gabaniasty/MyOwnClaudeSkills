/* GATE 23 — markup faults that silently disable things.
 *
 * Each of these shipped at least once and none of them throws an error:
 *   - TWO style attributes on one element. The parser keeps the FIRST and drops
 *     the second, so a custom property set in the second never applies. This has
 *     now happened in two separate sessions, on different elements.
 *   - A custom property read by CSS that no element ever receives. Three
 *     atmosphere layers declared transform: translate3d(0, var(--py), 0) while
 *     nothing set --py, so that parallax had never once run.
 *   - A reveal-driven rule that is not scoped to the reveal class, so an element
 *     that can never receive .in sits at its hidden value forever.
 *
 * usage: node check-markup.cjs [--root=<path>]
 */
const { cfg, html } = require("./_config.cjs");
const doc = html();
let problems = 0;

/* 1. duplicate attributes on one tag */
for (const attr of ["style", "class", "id", "src", "href"]) {
  const re = new RegExp(`<[a-zA-Z][^>]*?\\s${attr}="[^"]*"[^>]*?\\s${attr}="`, "g");
  const hits = doc.match(re) || [];
  if (hits.length) {
    problems += hits.length;
    console.log(`*** ${hits.length} element(s) with TWO ${attr} attributes — the second is dropped:`);
    hits.slice(0, 5).forEach((h) => console.log("    " + h.slice(0, 130).replace(/\s+/g, " ")));
  }
}

/* 2. custom properties read WITHOUT a fallback and never written anywhere.
      Only the no-fallback case matters: var(--x, 4px) degrades gracefully, while
      var(--x) on a transform silently resolves to nothing and the effect never
      runs — which is how three parallax layers stayed frozen for a whole build. */
const noFallback = new Set([...doc.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)].map((m) => m[1]));
const setVars = new Set([...doc.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
const jsSet = new Set([...doc.matchAll(/setProperty\(\s*["'](--[a-zA-Z0-9-]+)/g)].map((m) => m[1]));
const never = [...noFallback].filter((v) => !setVars.has(v) && !jsSet.has(v));
if (never.length) {
  problems += never.length;
  console.log(`\n*** ${never.length} custom propert(y|ies) read with NO fallback and never set:`);
  never.forEach((v) => console.log(`    ${v}  — resolves to nothing; whatever it drives never runs`));
}

/* 3. X -> X.in pairs whose hidden state is not gated.
      A hidden state is SAFE when it is gated by an ancestor class such as `.js`
      (the reveal opt-in) or a media query, because the unconditional default
      stays visible. `.rv` itself is the canonical safe case:
          .rv      { opacity: 1 }        <- visible with no JS
          .js .rv  { opacity: 0 }        <- hidden only once JS is proven
      Flagging that would make this check cry wolf, and a check that cries wolf
      gets ignored. Only flag an UNGATED hidden state. */
const revealClasses = [...new Set([...doc.matchAll(/\.([a-zA-Z0-9_-]+)\.in\b/g)].map((m) => m[1]))];
const HIDDEN = /\b(?:opacity|width|height)\s*:\s*0(?:[a-z%]*)?\s*(?:;|$|!)/;
const offenders = [];

for (const cls of revealClasses) {
  /* every rule whose selector mentions .cls as a whole class */
  const rule = new RegExp(`([^{}]*\\.${cls}(?![a-zA-Z0-9_-])[^{}]*)\\{([^{}]*)\\}`, "g");
  let m2;
  while ((m2 = rule.exec(doc))) {
    const selector = m2[1].split(",").find((s) => new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])`).test(s)) || m2[1];
    const body = m2[2];
    if (!HIDDEN.test(body)) continue;
    if (new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])[^\\s]*\\.in\\b`).test(selector)) continue;  // the visible half
    /* A PSEUDO-ELEMENT is not a reveal target. `.card::before{opacity:0}` is the
       standard resting state of a hover sheen with its own :hover lifecycle, and
       flagging it made this check fire on a page that was entirely correct. */
    if (new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])[^,{]*::?(before|after|placeholder|marker|selection)`).test(selector)) continue;
    /* :hover / :focus / :active states are transient by design, not stranded */
    if (new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])[^,{]*:(hover|focus|active|checked|disabled)`).test(selector)) continue;
    /* GATED if anything qualifies .cls from the left: an ancestor class/attribute
       (".js .rv"), or .cls itself carrying another class (".rv.foo"). The
       unconditional default then stays visible, which is the reveal contract. */
    const before = selector.slice(0, selector.search(new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])`)));
    if (/[.\[#][a-zA-Z0-9_-]/.test(before)) continue;
    offenders.push(`${cls}   ${selector.trim().slice(0, 60)} { ${body.trim().slice(0, 40)} }`);
    break;
  }
}
if (offenders.length) {
  problems += offenders.length;
  console.log(`\n*** reveal-driven classes with an UNGATED hidden state:`);
  offenders.forEach((o) => console.log(`    .${o}`));
  console.log("    An element that never receives .in keeps the hidden value forever.");
  console.log("    Gate it like the reveal contract does:  .rv{opacity:1}  .js .rv{opacity:0}");
}

/* 4. GATE 30 — hand-drawn illustration masquerading as markup.
      A <path> carrying a long coordinate string is traced artwork: a map, a
      diagram, an illustration. It belongs in images/ as a generated asset.
      A build once hand-wrote a WORLD MAP as ten inline SVG elements, because the
      Phase 2 inventory recorded the mockup's photographs but not its map. It
      rendered as a wobbly outline nothing like the mockup, and nobody can edit
      an 80-character path by hand afterwards.
      Icons, logos, arrows and rules are short. Artwork is not. */
const longPaths = doc.match(/<path[^>]*\sd="[^"]{80,}"/g) || [];
if (longPaths.length) {
  problems += longPaths.length;
  console.log(`\n*** ${longPaths.length} hand-drawn SVG path(s) with 80+ coordinate chars:`);
  longPaths.slice(0, 5).forEach((p) => {
    const d = (p.match(/d="([^"]*)"/) || [])[1] || "";
    console.log(`    ${d.length} chars: ${d.slice(0, 60)}...`);
  });
  console.log("    This is traced artwork, not an icon. Generate it as an image, take it");
  console.log("    from a real library, or build it in CSS. Never draw it by hand.");
}

console.log(`\ntotal faults: ${problems}`);
if (problems) process.exit(1);
console.log("no duplicate attributes, no dead custom properties, no ungated reveals, no traced SVG");
