/* GATE 26 — assemble a clean deploy folder.
 *
 * A deploy tool uploads the directory you point it at. The working folder also
 * holds generation masters, scratch, scripts and mockups — none of which the
 * site serves. One project measured 87.7 MB working against an 18.1 MB site.
 *
 * The file list is DERIVED FROM THE DOCUMENT, never hand-listed. A copy rule is
 * one retired asset away from shipping dead weight and one new folder away from
 * missing something. Asserts referenced === copied before it will succeed.
 *
 * usage: node build-deploy.cjs [--root=<path>] [--out=<dir>]
 */
const fs = require("fs");
const path = require("path");
const { ROOT, cfg, arg, html, referencedAssets } = require("./_config.cjs");

const OUT = path.resolve(ROOT, arg("out", path.join("..", path.basename(ROOT) + "-deploy")));
if (path.resolve(OUT) === path.resolve(ROOT)) {
  console.error("refusing to write the deploy folder over the project folder");
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const doc = html();
const refs = referencedAssets(doc);

const copy = (rel) => {
  const from = path.resolve(ROOT, rel), to = path.join(OUT, rel);
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
};

let copied = 0;
const missing = [];
for (const r of refs) (copy(r) ? copied++ : missing.push(r));

/* the runtime, plus files browsers request by convention rather than by markup */
const runtime = [cfg.html, "serve.mjs", "package.json", "favicon.ico", "favicon.svg",
                 "robots.txt", "site.webmanifest"];
const shipped = runtime.filter(copy);

const bytes = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => {
  const p = path.join(d, e.name);
  return n + (e.isDirectory() ? bytes(p) : fs.statSync(p).size);
}, 0);

const files = [];
(function walk(d, base) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name), r = base ? `${base}/${e.name}` : e.name;
    e.isDirectory() ? walk(p, r) : files.push(r);
  }
})(OUT, "");

console.log(`assets referenced by ${cfg.html} : ${refs.size}`);
console.log(`copied                          : ${copied}`);
console.log(`runtime files                   : ${shipped.join(", ")}`);
if (missing.length) { console.log("MISSING:"); missing.forEach((m) => console.log("   " + m)); }
console.log(`\nworking folder : ${(bytes(ROOT) / 1048576).toFixed(1)} MB`);
console.log(`deploy folder  : ${(bytes(OUT) / 1048576).toFixed(1)} MB   -> ${OUT}`);
console.log(`files          : ${files.length}`);
console.log(`top level      : ${[...new Set(files.map((f) => f.split("/")[0]))].join(", ")}`);

/* GATE 43. A deploy folder has TWO requirements and only one used to be checked.
 * `referenced === copied` proves every ASSET arrived. It says nothing about
 * whether the folder can RUN, and a folder that cannot run deploys "successfully"
 * and then 404s from the host's router, because the buildpack produces a
 * container that never listens on a port.
 *
 * Measured, the two staged folders side by side:
 *     runtime files : index.html                            -> 404, three deploys wasted
 *     runtime files : index.html, serve.mjs, package.json   -> 200
 *
 * So assert the runtime, and report it as a line like the asset count. A project
 * that is genuinely a static upload can say so with a marker file rather than
 * being silently allowed through. */
const runnable = { ok: false, how: null, why: null };
const outHas = (f) => fs.existsSync(path.join(OUT, f));

if (outHas("package.json")) {
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(path.join(OUT, "package.json"), "utf8").replace(/^﻿/, "")); } catch {}
  const start = pkg && pkg.scripts && pkg.scripts.start;
  if (!start) {
    runnable.why = "package.json has no scripts.start";
  } else {
    /* The start script must point at a file that is actually IN the folder.
       `node serve.mjs` with no serve.mjs is the same 404 with extra steps. */
    const named = (start.match(/[\w./-]+\.(?:mjs|cjs|js|ts)/) || [])[0];
    if (named && !outHas(named)) runnable.why = `scripts.start runs ${named}, which was not copied`;
    else { runnable.ok = true; runnable.how = `package.json · ${start}`; }
  }
} else if (outHas(".static") || outHas("_static") || outHas("Staticfile")) {
  runnable.ok = true; runnable.how = "static marker (no server expected)";
} else {
  runnable.why = "no package.json and no static marker";
}

console.log(`runtime                         : ${runnable.ok ? runnable.how : "MISSING — " + runnable.why}`);

if (missing.length) { console.log("\nreferenced !== copied — NOT safe to deploy"); process.exit(1); }
if (!runnable.ok) {
  console.log(`\nNOT RUNNABLE — ${runnable.why}`);
  console.log("A host will build this and route nothing. Add a package.json with a");
  console.log("start script and the file it runs, or drop an empty `.static` marker in");
  console.log("the project root if it is genuinely a static upload.");
  process.exit(1);
}
console.log("\nreferenced === copied, 0 missing · runtime present");
