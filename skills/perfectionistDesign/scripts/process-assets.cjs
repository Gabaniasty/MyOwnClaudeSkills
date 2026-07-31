/* PHASE 4 — masters to shipped variants.
 *
 * Four families, because they need genuinely different handling:
 *   PHOTO      plain jpg + webp
 *   ATMOSPHERE generated on pure white, composited with multiply — white snaps
 *              to pure so the glow melts in with no rectangle
 *   CUTOUT     generated on flat chroma green, keyed to true alpha, trimmed
 *   ICON       cutout, then squared and padded so a whole set shares one
 *              optical size
 *
 * THE MANIFEST IS DERIVED, NOT HAND-MAINTAINED. A hand-written list once held
 * three retired slugs while the two the page actually placed were absent, so
 * their regenerated masters were silently skipped. Slugs come from the document.
 *
 * usage: node process-assets.cjs [--root=<path>] [--only=slug,slug]
 */
const fs = require("fs");
const path = require("path");
const { ROOT, cfg, abs, arg, loadSharp, html } = require("./_config.cjs");
const sharp = loadSharp();

const SRC = abs(cfg.masters);
const OUT = abs(cfg.images);
const ONLY = arg("only", "") ? new Set(arg("only").split(",").map((s) => s.trim())) : null;

/* families + widths come from assets.json if present, else inferred */
const MANIFEST = abs("assets.json");
let spec = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, "utf8").replace(/^﻿/, ""))
  : null;

if (!spec) {
  /* infer: every master that the document references, at the widths it references */
  const doc = html();
  spec = {};
  /* THE ORDER IS IMAGES BEFORE BUILD, so the document usually does not exist yet.
     Deriving widths from a page that has not been written finds nothing, and this
     script then reported "ok" having produced zero variants — a pass that meant
     the opposite. When the document references none of the masters, process them
     ALL at sensible defaults so the build has something real to reference. */
  const docRefsAny = fs.existsSync(SRC) && fs.readdirSync(SRC)
    .some((f) => /\.png$/i.test(f) && doc.includes(`${cfg.images}/${f.replace(/\.png$/i, "")}-`));
  if (!docRefsAny) console.log("document references no masters yet - processing every master at default widths\n");

  for (const f of fs.existsSync(SRC) ? fs.readdirSync(SRC) : []) {
    if (!/\.png$/i.test(f)) continue;
    const slug = f.replace(/\.png$/i, "");
    if (/-source$/.test(slug)) continue;
    /* _mockup is a design input, never a shipped asset */
    if (slug === "_mockup" || /^_/.test(slug)) continue;
    let widths = [...new Set([...doc.matchAll(new RegExp(`${cfg.images}\\/${slug}-(\\d+)\\.`, "g"))].map((m) => +m[1]))];
    if (!widths.length && !docRefsAny) widths = [520, 900, 1400];
    if (!widths.length) continue;
    const kind = /^ic-/.test(slug) ? "icon"
      : /^(bg-|atmos)/.test(slug) ? "atmosphere"
      : /^(deco-|dev-|cut-)/.test(slug) ? "cutout" : "photo";
    spec[slug] = { kind, widths: widths.sort((a, b) => a - b) };
  }
  console.log(`no assets.json — inferred ${Object.keys(spec).length} slugs from ${cfg.html}\n`);
}

const key = (data, info) => {
  let keyed = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const greenness = g - Math.max(r, b);
    if (greenness > 40) { data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0; keyed++; }
    else if (greenness > 8) {
      const t = (greenness - 8) / 32;
      data[o + 3] = Math.round(255 * (1 - t));
      data[o + 1] = Math.round(Math.max(r, b) + (g - Math.max(r, b)) * (1 - t));  // despill
      keyed++;
    }
  }
  return keyed;
};

/* --only names a slug EXPLICITLY, so it must work even when the inferred spec has
   never heard of it. Asking for a brand-new master by name and getting "processed 0
   slugs" is the same chicken-and-egg as above wearing a different hat: the spec
   comes from the document, and a new asset is not in the document yet. */
if (ONLY) {
  for (const slug of ONLY) {
    if (spec[slug]) continue;
    if (!fs.existsSync(path.join(SRC, slug + ".png"))) {
      console.log(`no master for --only slug "${slug}"`);
      continue;
    }
    const kind = /^ic-/.test(slug) ? "icon"
      : /^(bg-|atmos)/.test(slug) ? "atmosphere"
      : /^(deco-|dev-|cut-)/.test(slug) ? "cutout" : "photo";
    spec[slug] = { kind, widths: [520, 900, 1400] };
    console.log(`--only "${slug}" not in the inferred spec; adding it at default widths`);
  }
}

(async () => {
  const results = [];
  for (const [slug, job] of Object.entries(spec)) {
    if (ONLY && !ONLY.has(slug)) continue;
    const input = path.join(SRC, slug + ".png");
    if (!fs.existsSync(input)) { results.push({ slug, status: "MASTER MISSING" }); continue; }

    let pipeline = sharp(input), note = {};

    if (job.kind === "atmosphere") {
      const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let snapped = 0;
      for (let i = 0; i < info.width * info.height; i++) {
        const o = i * 3;
        if (data[o] > 246 && data[o + 1] > 246 && data[o + 2] > 246) {
          data[o] = data[o + 1] = data[o + 2] = 255; snapped++;
        }
      }
      note.whiteSnappedPct = +((snapped / (info.width * info.height)) * 100).toFixed(1);
      pipeline = sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });
    }

    if (job.kind === "cutout" || job.kind === "icon") {
      const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const keyed = key(data, info);
      note.keyedPct = +((keyed / (info.width * info.height)) * 100).toFixed(1);
      const cut = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
      const t = await sharp(cut).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
      note.trimmed = `${t.info.width}x${t.info.height}`;
      if (job.kind === "icon") {
        /* square on a transparent canvas so the SET shares one optical size */
        const side = Math.max(t.info.width, t.info.height);
        const pad = Math.round(side * 0.06);
        pipeline = sharp({ create: { width: side + pad * 2, height: side + pad * 2, channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: t.data, left: Math.round((side - t.info.width) / 2) + pad,
                        top: Math.round((side - t.info.height) / 2) + pad }]).png();
        pipeline = sharp(await pipeline.toBuffer());
        note.squaredTo = side + pad * 2;
      } else pipeline = sharp(t.data);
    }

    const meta = await pipeline.clone().metadata();
    /* always emit the master's own width as the widest honest variant: filtering
       alone silently drops a requested width and leaves the HTML dangling */
    const widths = [...new Set(job.widths.filter((w) => w <= meta.width).concat(meta.width))].sort((a, b) => a - b);
    const alpha = job.kind === "cutout" || job.kind === "icon";
    const written = [];
    for (const w of widths) {
      const base = pipeline.clone().resize({ width: w, withoutEnlargement: true });
      const main = path.join(OUT, `${slug}-${w}.${alpha ? "png" : "jpg"}`);
      const wp = path.join(OUT, `${slug}-${w}.webp`);
      if (alpha) await base.clone().png({ compressionLevel: 9 }).toFile(main);
      else await base.clone().jpeg({ quality: 84, progressive: true, mozjpeg: true }).toFile(main);
      await base.clone().webp({ quality: alpha ? 90 : 84, alphaQuality: 92, smartSubsample: true }).toFile(wp);
      written.push({ w, kb: Math.round(fs.statSync(main).size / 1024) });
    }
    results.push({ slug, kind: job.kind, master: `${meta.width}x${meta.height}`, ...note, written });
  }

  console.log(JSON.stringify(results, null, 2));
  const missing = results.filter((r) => r.status);
  if (missing.length) {
    console.log("\nMISSING MASTERS: " + missing.map((m) => m.slug).join(", "));
    process.exit(1);
  }
  console.log(`\nprocessed ${results.length} slugs. Now run reconcile-srcset.cjs, then audit-refs.cjs.`);
})();
