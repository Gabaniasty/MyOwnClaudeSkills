/* Shared config for every script in this folder.
 *
 * NOTHING here hard-codes a path. Each script resolves against the project root,
 * which is (in order): --root=<path>, PD_ROOT, project.config.json's own folder,
 * or the current working directory.
 *
 * The scripts these were generalised from all carried an absolute path to one
 * machine, which is exactly why they could not be reused. Do not reintroduce one.
 */
const fs = require("fs");
const path = require("path");

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const DEFAULTS = {
  html: "index.html",
  images: "images",
  masters: "images/_masters",
  logo: "logo",
  scratch: "scratch",
  deployOut: "../<project>-deploy",
  /* extensions treated as site assets by the reference audit and the pruner */
  assetExt: "png|jpe?g|webp|avif|svg|ico|gif|woff2?",
  /* directories the deploy step must never ship */
  neverShip: ["_masters", "_superseded", "scratch", "scripts", "mockups", "node_modules", ".git"],
};

function findRoot() {
  const explicit = arg("root", process.env.PD_ROOT);
  if (explicit) return path.resolve(explicit);
  let d = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, "project.config.json"))) return d;
    if (fs.existsSync(path.join(d, "index.html"))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return process.cwd();
}

const ROOT = findRoot();
let fileCfg = {};
const cfgPath = path.join(ROOT, "project.config.json");
if (fs.existsSync(cfgPath)) {
  /* PowerShell 5.1 writes UTF-8 WITH a BOM and JSON.parse rejects it (Gate 12) */
  fileCfg = JSON.parse(fs.readFileSync(cfgPath, "utf8").replace(/^﻿/, ""));
}

const cfg = { ...DEFAULTS, ...fileCfg };
const abs = (p) => path.resolve(ROOT, p);

/* sharp lives at the workspace root, not per project. Walk up to find it rather
   than requiring a fixed absolute path. */
function loadSharp() {
  let d = ROOT;
  for (let i = 0; i < 6; i++) {
    const p = path.join(d, "node_modules", "sharp");
    if (fs.existsSync(p)) return require(p);
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  try { return require("sharp"); } catch (e) {
    console.error("sharp not found. Install it at the workspace root:  npm i sharp");
    process.exit(1);
  }
}

/* every local asset path the document mentions, from src, srcset and CSS url() */
function referencedAssets(html, cfgLocal = cfg) {
  const dirs = [cfgLocal.images, cfgLocal.logo, "fonts"].filter(Boolean)
    .map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?:${dirs})\\/[A-Za-z0-9._\\/-]+\\.(?:${cfgLocal.assetExt})`, "g");
  return new Set(html.match(re) || []);
}

module.exports = {
  ROOT, cfg, abs, arg, loadSharp, referencedAssets,
  html: () => fs.readFileSync(abs(cfg.html), "utf8"),
  writeHtml: (s) => fs.writeFileSync(abs(cfg.html), s, "utf8"),
};
