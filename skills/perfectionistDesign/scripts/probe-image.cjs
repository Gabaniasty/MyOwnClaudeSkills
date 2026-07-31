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
  /* walk up from THIS script, not from the cwd, so the probe works no matter
     which directory the runner happens to be invoked in */
  let d = __dirname, found = null;
  for (let i = 0; i < 8 && !found; i++) {
    const p = path.join(d, "node_modules", "sharp");
    if (fs.existsSync(p)) found = p;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
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
  console.log("0x0");          // shape unknown, but it is a real image
  process.exit(0);
}

sharp(file).metadata()
  .then((m) => {
    if (!m.width || !m.height) { console.log("BAD"); process.exit(1); }
    console.log(`${m.width}x${m.height}`);
  })
  .catch(() => { console.log("BAD"); process.exit(1); });
