/* GATE 18 + GATE 26 — delete image files the document does not reference.
 *
 * Two safety rules, both learned the hard way:
 *
 * 1. IMAGE EXTENSIONS ONLY. images/ also holds credits.json and manifest.json.
 *    A bare "is it a file, is it referenced" test marks both as unused, and
 *    deleting credits.json destroys the provenance record the ledger exists for.
 *
 * 2. Report families that lose EVERY variant separately from families that just
 *    shed stale widths. The first is either a genuine retirement or a stale
 *    srcset about to lose a real image — that difference must be a decision, not
 *    an accident.
 *
 * Dry run by default. --apply to delete.
 *
 * usage: node prune-images.cjs [--root=<path>] [--apply]
 */
const fs = require("fs");
const path = require("path");
const { cfg, abs, html, referencedAssets } = require("./_config.cjs");

const APPLY = process.argv.includes("--apply");
const IMG = abs(cfg.images);
const EXT = new RegExp(`\\.(?:${cfg.assetExt})$`, "i");

const referenced = new Set([...referencedAssets(html())]
  .filter((r) => r.startsWith(cfg.images + "/"))
  .map((r) => r.slice(cfg.images.length + 1)));

const onDisk = fs.readdirSync(IMG)
  .filter((f) => fs.statSync(path.join(IMG, f)).isFile() && EXT.test(f));

const unused = onDisk.filter((f) => !referenced.has(f));
const missing = [...referenced].filter((f) => !onDisk.includes(f));

const famOf = (f) => f.replace(/-\d+\./, ".").replace(EXT, "");
const byFamily = {};
let bytes = 0;
for (const f of unused) {
  bytes += fs.statSync(path.join(IMG, f)).size;
  (byFamily[famOf(f)] ||= []).push(f);
}

console.log(`referenced by ${cfg.html} : ${referenced.size}`);
console.log(`image files on disk       : ${onDisk.length}`);
console.log(`unused                    : ${unused.length}  (${(bytes / 1048576).toFixed(1)} MB)\n`);
Object.entries(byFamily).sort().forEach(([f, l]) => console.log(`  ${f.padEnd(22)} ${l.length} file(s)`));

const live = new Set([...referenced].map(famOf));
const retired = Object.keys(byFamily).filter((f) => !live.has(f)).sort();
const trimmed = Object.keys(byFamily).filter((f) => live.has(f)).sort();
console.log(`\nfamilies RETIRED ENTIRELY (${retired.length}): ${retired.join(", ") || "none"}`);
console.log(`families still live, stale widths only (${trimmed.length}): ${trimmed.join(", ") || "none"}`);

if (missing.length) {
  console.log(`\n*** REFERENCED BUT ABSENT (${missing.length}) — fix before shipping:`);
  missing.forEach((m) => console.log("   " + m));
}

if (APPLY) {
  unused.forEach((f) => fs.unlinkSync(path.join(IMG, f)));
  console.log(`\ndeleted ${unused.length} files, reclaimed ${(bytes / 1048576).toFixed(1)} MB`);
} else {
  console.log("\ndry run — pass --apply to delete");
}
if (missing.length) process.exit(1);
