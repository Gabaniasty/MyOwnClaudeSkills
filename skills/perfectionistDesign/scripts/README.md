# scripts/

The measurement tools the gates in `references/07-failure-gates.md` refer to.
Every one exists because something shipped broken without it.

**Nothing here contains a credential, an API key, or a path to anyone's machine.**
Image generation uses your own ChatGPT login through the Codex CLI; deployment
uses whatever MCP server you have configured. If a script needs a path, it takes
one — see *Configuration* below.

---

## Setup

```bash
npm i sharp            # at your WORKSPACE root, not per project
codex login --device-auth   # once, only if `codex` is not already signed in
```

`sharp` is located by walking up from the project folder, so one install at the
workspace root serves every project under it.

## Configuration

Scripts resolve the project root as: `--root=<path>` → `PD_ROOT` → the nearest
folder containing `project.config.json` or `index.html` → cwd.

Drop a `project.config.json` in the project root to override defaults:

```json
{
  "html": "index.html",
  "images": "images",
  "masters": "images/_masters",
  "logo": "logo",
  "assetExt": "png|jpe?g|webp|avif|svg|ico|gif|woff2?",
  "neverShip": ["_masters", "scratch", "scripts", "mockups", "node_modules", ".git"]
}
```

Optionally add `assets.json` to declare generation families explicitly; without
it, `process-assets.cjs` infers them from what the document references.

---

## What to run, and when

### Phase 3 — generating

| Script | Purpose |
|---|---|
| `run-imagegen.ps1` | Drives Codex. Copies output from `CODEX_HOME` by session id, probes every file with sharp, retries 3×, skips what exists. `-Strict -Slugs "a,b,c"` for parallel workers. **Gates 8, 27** |

Before writing a single prompt, read **Gate 19**: a plate cut to the wrong aspect
cannot be repaired in CSS.

### Phase 4 — asset pipeline

```bash
node scripts/process-assets.cjs       # masters -> variants (4 families)
node scripts/reconcile-srcset.cjs     # widths derived FROM DISK
node scripts/audit-refs.cjs           # both directions
node scripts/prune-images.cjs         # dry run; --apply to delete
```

**Regenerating anything?** Delete the old variants first, or the srcset will mix
generations and serve the old image at some viewport widths. **Gate 18**

```bash
rm images/<slug>-[0-9]*.{png,jpg,webp}    # then reprocess
```

### Phase 6 — verification

| Script | Catches |
|---|---|
| `audit.browser.js` | Contrast on glyph runs, breakout collisions at the animation's worst frame, rendered-size spread, parallax wiring, upscaling, stranded reveals. **Gates 20–24** |
| `hero-rects.browser.js` | Dumps real glyph rects for `hero-scrim.cjs` |
| `hero-scrim.cjs` | Binary-searches the weakest scrim that clears AA. **Gates 19, 20** |
| `check-nesting.cjs` | Tag tree balance. **Gate 17** |
| `check-markup.cjs` | Duplicate `style` attributes, unset custom properties, unscoped reveal rules. **Gate 23** |

The browser audit is the highest-value one. Paste it into the page and call it:

```js
await pdAudit()
await pdAudit({ hero: '.hero-media', grid: '.cards', card: '.card', float: '.device' })
```

Run it at **375 / 768 / 1024 / 1440 / 1920** and report the numbers at each.

Its pass order is load-bearing: pixel sampling first, theme mutation last. An
earlier version flipped `data-theme` and back before reading text colours and
reported four hero contrast failures that did not exist. **Gate 24**

### Phase 7 — ship

```bash
node scripts/build-deploy.cjs --out=../myproject-deploy
```

Derives the file list from the document and asserts `referenced === copied`. One
project's 87.7 MB working folder staged to 18.1 MB this way.

Then fetch the live URL and HEAD every asset on it. A deploy tool's success
message is not evidence the page renders — and include a discriminator that only
the new build contains, or you will happily audit a cached previous version.

---

## The order that actually works

```
generate → process → reconcile → audit-refs → prune
         → check-nesting → check-markup
         → pdAudit() at every breakpoint
         → build-deploy → live audit
```

Skipping the middle because a change felt small is how a stale asset survives.
That is the whole of Gate 18.

---

## Not included, deliberately

No deployment or credential script ships here. Credential handling is described
in `references/06-ship-deploy-git.md` — address config by **exact key**, prove it
with a live authenticated call, print masked only. A script that reads keys is
one search-order bug away from copying someone else's; that mistake cost a whole
debugging session and was reported to the user as *their* key being invalid.
