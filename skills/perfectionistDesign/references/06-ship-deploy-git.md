# Phase 7 — Ship: Deploy and Git

Deploying and pushing are outward-facing. Confirm before the first one unless the user has
already said to ship. Approval for one project does not carry to the next — five sites once
came with "deploy only the 4, not the gym yet", and that standing instruction held until it
was explicitly reversed. **Honour standing exclusions until the user lifts them.**

---

## 1. Stage before you deploy

Never push the project folder as-is. Source masters are build inputs, not site assets.

```powershell
$src = "<project>"; $stage = "<scratch>\deploy-<slug>"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force "$stage\images" | Out-Null
Copy-Item "$src\index.html","$src\package.json","$src\serve.mjs" $stage
Get-ChildItem "$src\images" -File | Copy-Item -Destination "$stage\images"   # files only:
                                                                             # skips _masters
                                                                             # and _superseded
"{0:N0} KB" -f ((Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum/1kb)
```

A 32 MB folder should stage to ~2 MB. Then run the reference audit
(`05-verification-protocol.md` §2) **against the stage**, not the source.

---

## 2. Deploy

The project needs `package.json` with `start`, and `serve.mjs` honouring `process.env.PORT`.
Nixpacks detects Node and builds server-side — no Dockerfile.

If the deploy MCP server's tools are not loaded (commonly because it is registered against a
**parent** directory and the session cwd is a sub-folder), do not hand-edit `~/.claude.json`
— that corrupted the config once and produced a bogus key. Either restart from the
registered directory, or drive the server directly over stdio JSON-RPC:

```
initialize → notifications/initialized → tools/list → tools/call
```

Read credentials from the existing config; never print a key back to the user.

Pass tool arguments via a **file**, not an inline JSON string — Windows paths through two
layers of shell quoting will mangle. And PowerShell 5.1's `-Encoding utf8` writes a BOM that
`JSON.parse` rejects, so strip `^﻿` when reading it back.

---

## 3. Live audit — the step that is always skipped

A deploy tool returning `"status": "running"` proves a container started. It proves nothing
about your assets.

```js
// scripts/liveaudit.cjs
const BASE = "https://<app>.<host>";
(async () => {
  const html = await (await fetch(BASE)).text();
  const refs = new Set();
  for (const m of html.matchAll(/\bsrc="([^"]+)"/g))
    if (m[1] && !/^(https?:|data:|#)/.test(m[1])) refs.add(m[1]);
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g))
    m[1].split(",").forEach(c => { const u = c.trim().split(/\s+/)[0];
      if (u && !/^(https?:|data:)/.test(u)) refs.add(u); });

  const results = await Promise.all([...refs].map(async r => {
    const h = await fetch(BASE + "/" + r.replace(/^\//, ""), { method: "HEAD" });
    return { r, status: h.status };
  }));
  const bad = results.filter(x => x.status !== 200);
  const webp = results.filter(x => x.r.endsWith(".webp"));
  console.log("referenced:", results.length,
              "| webp:", webp.filter(w => w.status === 200).length + "/" + webp.length,
              "| failing:", bad.length);
  bad.forEach(b => console.log("  ", b.status, b.r));
})();
```

Then confirm the bytes are real images and not 200-status error pages, by checking magic
numbers: WebP starts `52 49 46 46` (RIFF), JPEG `FF D8 FF`, PNG `89 50 4E 47`.

If anything about the assets was renamed or reordered, **download one back from the live
host and open it.** A rename that only changed labels locally would otherwise ship silently.

---

## 4. Git

One project, one repo. Check visibility and emptiness before pushing.

```powershell
$ErrorActionPreference = "Continue"   # native git stderr would be fatal under "Stop"
git init -b main $path
Set-Content "$path\.gitignore" -Value "node_modules/`n.DS_Store`nThumbs.db`n*.log" -Encoding ascii
git -C $path add -A
git -C $path commit -F $msgFile --quiet
$existing = git -C $path remote
if ($existing -contains "origin") { git -C $path remote remove origin | Out-Null }
git -C $path remote add origin $url
git -C $path push -u origin main --quiet
```

Commit messages end with:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

### Verify the pairing, not just the push
A successful push proves bytes moved, not that the right project reached the right repo.
Pull `index.html` back from each remote and check its `<title>`:

```powershell
$html = gh api "repos/<owner>/<repo>/contents/index.html" --jq '.content'
$txt  = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($html -replace '\s','')))
[regex]::Match($txt, '<title>(.*?)</title>').Groups[1].Value
```

Then compare remote blob count and byte total against the local folder, and confirm each
working tree is clean with 0 unpushed commits.

### Public vs private
Before anything is made public, re-check §8 of `04-build-standards.md`. Unlicensed
third-party artwork and photography of identifiable people without consent are acceptable
in a private repo and are not acceptable in a public one. Flag it at push time so the
decision is made deliberately, not by a visibility toggle months later.

---

## 5. Ship report

Give the user:
- the live URL
- what was excluded from the deploy and why
- the live audit numbers (referenced / webp / failing)
- repo → project mapping, verified by title
- any outstanding honesty caveat, repeated, not buried
