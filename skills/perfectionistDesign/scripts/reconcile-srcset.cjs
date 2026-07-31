/* GATE 3 + GATE 18 — rewrite EVERY srcset from the variants that actually exist.
 *
 * Widths cannot be hand-written. A trimmed cutout's final size is only known
 * after generation, and a regenerated master trims to a different size than its
 * predecessor. Hand-written widths are therefore correct only until the next
 * regeneration, and then they dangle in silence.
 *
 * Covers every slug, not a prefix. An earlier version matched `dev-*` only and
 * left six dangling references alive while reporting "8 slugs reconciled".
 * A slug with NO variants on disk is logged and exits non-zero — silently
 * leaving that markup alone is how a dead reference survives a "clean" run.
 *
 * Operates on attribute VALUES, never on surrounding markup, so it cannot
 * damage structure.
 *
 * usage: node reconcile-srcset.cjs [--root=<path>] [--dry]
 */
const fs = require("fs");
const { cfg, abs, arg, html, writeHtml } = require("./_config.cjs");

const DRY = process.argv.includes("--dry");
const IMG = abs(cfg.images);
const files = fs.existsSync(IMG) ? fs.readdirSync(IMG) : [];

const widthsFor = (slug, ext) => files
  .map((f) => f.match(new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)\\.${ext === "jpg" ? "jpe?g" : ext}$`)))
  .filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);

let doc = html();
const touched = new Set();
const orphans = new Set();
const norm = (e) => (e.toLowerCase() === "jpeg" ? "jpg" : e.toLowerCase());

doc = doc.replace(/srcset="([^"]*)"/g, (full, val) => {
  const m = val.match(new RegExp(`${cfg.images}\\/([A-Za-z0-9-]+?)-\\d+\\.(${cfg.assetExt})`, "i"));
  if (!m) return full;
  const slug = m[1], ext = norm(m[2]);
  const w = widthsFor(slug, ext);
  if (!w.length) { orphans.add(`${slug}.${ext}`); return full; }
  touched.add(slug);
  return 'srcset="' + w.map((x) => `${cfg.images}/${slug}-${x}.${ext} ${x}w`).join(", ") + '"';
});

/* src is the fallback when the browser cannot pick from srcset, so it must exist
   too. Point it at a MIDDLE variant rather than the smallest. */
doc = doc.replace(new RegExp(`src="${cfg.images}\\/([A-Za-z0-9-]+?)-(\\d+)\\.(${cfg.assetExt})"`, "gi"),
  (full, slug, _w, ext) => {
    const e = norm(ext);
    const w = widthsFor(slug, e);
    if (!w.length) { orphans.add(`${slug}.${e}`); return full; }
    const pick = w[Math.max(0, Math.floor((w.length - 1) / 2))];
    return `src="${cfg.images}/${slug}-${pick}.${e}"`;
  });

if (!DRY) writeHtml(doc);

console.log(DRY ? "DRY RUN — nothing written\n" : "");
console.log("variants on disk:");
[...touched].sort().forEach((s) => {
  const parts = ["png", "jpg", "webp"].map((e) => `${e} ${widthsFor(s, e).join(", ") || "-"}`);
  console.log(`  ${s.padEnd(18)} ${parts.join("   ")}`);
});
console.log(`\nslugs reconciled: ${touched.size}`);

if (orphans.size) {
  console.log(`\n*** ${orphans.size} slug(s) referenced with NO variant on disk:`);
  [...orphans].forEach((o) => console.log("   " + o));
  process.exit(1);
}
