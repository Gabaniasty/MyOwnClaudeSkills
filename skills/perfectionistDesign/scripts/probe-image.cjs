/* Prints "<width>x<height>" for a real decodable image, or "BAD" and exits 1.
 *
 * WHY THIS IS A FILE AND NOT AN INLINE `node -e` IN THE RUNNER
 * The runner used to probe with `node -e "require('sharp')(...)"`, executed with
 * the PROJECT as its working directory. sharp lives at the workspace root, so the
 * require failed, the catch printed BAD, and the runner deleted three perfectly
 * good 1 MB images as "unreadable" — three times, then reported the asset failed.
 * Codex had done its job correctly every time.
 *
 * Resolving sharp is _config.cjs's job. Reuse it rather than guessing a path.
 *
 * usage: node probe-image.cjs <file>
 */
const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.log("BAD"); process.exit(1); }

let sharp;
try {
  /* Walk up from BOTH the image being probed and this script.
   *
   * This used to walk up from __dirname only. The skill installs to
   * ~/.claude/skills/perfectionistDesign/scripts/ while sharp lives at the
   * workspace root (~/pd-projects/node_modules/sharp) - two trees that never
   * meet, so `found` was always null, `require("sharp")` threw, and every probe
   * fell through to the magic-bytes branch and printed "0x0".
   *
   * That is a SILENT DOWNGRADE, which is the dangerous part. "0x0" matches the
   * runner's `^\d+x\d+$` success test, so the check passed every file it was
   * ever shown - including the truncated writes it exists to catch - while
   * printing what looks like a real dimension read. Months of "OK slug 0x0".
   *
   * The image is always inside the project, so starting from it reaches the
   * workspace root the same way _config.cjs's loadSharp() does. */
  const starts = [path.dirname(path.resolve(file)), __dirname];
  let found = null;
  for (const start of starts) {
    let d = start;
    for (let i = 0; i < 8 && !found; i++) {
      const p = path.join(d, "node_modules", "sharp");
      if (fs.existsSync(p)) { found = p; break; }
      const up = path.dirname(d);
      if (up === d) break;
      d = up;
    }
    if (found) break;
  }
  sharp = found ? require(found) : require("sharp");
} catch {
  /* No sharp at all. Fall back to magic bytes: far weaker than a decode, but the
     alternative is deleting good images, and a wrong "unreadable" is worse than
     a missed corrupt file — the reference audit catches that later anyway. */
  const b = Buffer.alloc(12);
  const fd = fs.openSync(file, "r");
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  const ok = (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8) ||
             (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP");
  if (!ok || fs.statSync(file).size === 0) { console.log("BAD"); process.exit(1); }
  /* Say that the check is degraded. The old value here was a bare "0x0", which
     is indistinguishable from a successful probe of a zero-sized image and is
     accepted by the runner's `^\d+x\d+$` test - so a dead check reported as a
     passing one. Callers must treat this token as "header looked right, decode
     NOT verified". */
  console.log("0x0-nosharp");
  process.exit(0);
}

/* metadata() alone is NOT a decode. It reads the PNG IHDR header, which is the
 * first ~33 bytes, so a file truncated to 300 bytes still reports its full
 * declared dimensions and sails through. Measured: a valid 256x256 PNG cut to
 * 300 bytes returned "256x256", exit 0, ACCEPTED by the runner - while this
 * file's own header promised to verify "a real decodable image, not a truncated
 * write". The check was measuring the wrong property.
 *
 * stats() forces sharp to decode the pixel data, so a short or corrupt IDAT
 * stream throws instead of passing. Dimensions still come from metadata(). */
sharp(file).metadata()
  .then((m) => {
    if (!m.width || !m.height) { console.log("BAD"); process.exit(1); }
    return sharp(file).stats().then(() => {
      console.log(`${m.width}x${m.height}`);
    });
  })
  .catch(() => { console.log("BAD"); process.exit(1); });
