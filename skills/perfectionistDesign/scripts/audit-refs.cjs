/* GATE 3 + GATE 6 + GATE 18 — reference audit, BOTH directions.
 *
 * Checks src AND srcset. A file reachable only through a srcset candidate is
 * still shipped to half your users, and a src-only scan both misses broken ones
 * and marks live ones as unused.
 *
 * Reports MISSING (referenced, absent) and UNUSED (present, unreferenced).
 * The second direction is what catches a regeneration that left old variants
 * behind, which is how one project served a superseded palette at some widths.
 *
 * usage: node audit-refs.cjs [--root=<path>]
 */
const fs = require("fs");
const path = require("path");
const { ROOT, cfg, abs, html, referencedAssets } = require("./_config.cjs");

const doc = html();
const refs = referencedAssets(doc);
const IMG = abs(cfg.images);

const missing = [], corrupt = [];
let bytes = 0;

/* magic bytes, because a 0-byte or HTML-error-page file passes existsSync */
const MAGIC = {
  png:  (b) => b[0] === 0x89 && b[1] === 0x50,
  jpg:  (b) => b[0] === 0xff && b[1] === 0xd8,
  webp: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP",
  gif:  (b) => b.slice(0, 3).toString() === "GIF",
  svg:  (b) => /<svg/i.test(b.slice(0, 400).toString()),
};

for (const r of refs) {
  const p = path.resolve(ROOT, r);
  if (!fs.existsSync(p)) { missing.push(r); continue; }
  const st = fs.statSync(p);
  bytes += st.size;
  const ext = path.extname(p).slice(1).toLowerCase().replace("jpeg", "jpg");
  const check = MAGIC[ext];
  if (check) {
    const fd = fs.openSync(p, "r");
    const buf = Buffer.alloc(400);
    fs.readSync(fd, buf, 0, 400, 0);
    fs.closeSync(fd);
    if (!check(buf) || st.size === 0) corrupt.push(`${r} (${st.size} bytes)`);
  }
}

/* the other direction */
const onDisk = [];
(function walk(dir, base) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (cfg.neverShip.includes(e.name)) continue;
      walk(path.join(dir, e.name), base ? `${base}/${e.name}` : e.name);
    } else if (new RegExp(`\\.(?:${cfg.assetExt})$`, "i").test(e.name)) {
      onDisk.push(`${cfg.images}${base ? "/" + base : ""}/${e.name}`);
    }
  }
})(IMG, "");
const unused = onDisk.filter((f) => !refs.has(f));

console.log(`references : ${refs.size}`);
console.log(`resolved   : ${refs.size - missing.length}`);
console.log(`MISSING    : ${missing.length}`);
missing.forEach((m) => console.log("   " + m));
console.log(`CORRUPT    : ${corrupt.length}`);
corrupt.forEach((c) => console.log("   " + c));
console.log(`UNUSED     : ${unused.length}`);
unused.slice(0, 20).forEach((u) => console.log("   " + u));
if (unused.length > 20) console.log(`   ...and ${unused.length - 20} more`);
console.log(`\ntotal referenced asset weight: ${Math.round(bytes / 1024)} KB`);

if (missing.length || corrupt.length) process.exit(1);
