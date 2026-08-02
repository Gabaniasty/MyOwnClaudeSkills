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

### Derive the file list from the DOCUMENT, not from a copy rule

Copying "all files in `images/`" is one retired asset away from shipping dead weight, and
one *new folder* away from missing something. Ask the document what it needs:

```js
const refs = new Set(html.match(/(?:images|logo|fonts)\/[\w.\/-]+\.(?:png|jpe?g|webp|svg|avif|ico|woff2?)/g));
// copy exactly these, plus index.html / serve.mjs / package.json
```

**Assert `referenced === copied` and `missing === 0`** before deploying. A working folder of
**87.7 MB** staged to **18.1 MB** this way, with 149 referenced and 149 copied — and the
assertion is what makes that a fact rather than a hope. This is Gate 26.

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

### NEVER inherit a credential by search order (Gate 25 — the costliest error in this file)

A repair script scanned every project in a shared config for a server entry by **name** and
kept the first match. A different project already had one, so it copied that project's
**stale API key** over the one the user had just supplied. The `401 invalid api key` was then
reported back as *"your key is rejected, please re-copy it"* — while their credential had
been correct all along.

- Address config by **exact key**. Never "first match", never "any project containing".
- **Prove the credential end-to-end before saying anything about it**, with the SDK out of
  the path: a direct request that returns `200` and identifies the tenant. `401` on the
  authenticated endpoint while an unauthenticated one returns `200` isolates it precisely.
- **Verify the wrapper before blaming the secret.** Unpacking the npm package took two
  minutes and confirmed the env var names, base URL and auth header were all correct — which
  is what narrowed it to the stored value.
- Print **masked only** (`hk_Rt…GQQ (35 chars)`). Masking is what exposed this: the stored
  key began `hk_Mj`, the user's began `hk_Rtj`.

### Config written by a CLI is keyed by the CWD that CLI ran from

`claude mcp add` run from a Bash shell wrote its entry under `B:/Project`, while the session
reads `B:\Project`. It reported success and `mcp list` showed it connected — and it would
have been invisible on restart. **Read the file back and confirm the entry sits under the
key the consumer actually uses.** Then normalise with a real `.cjs` file; a `node -e` repair
inside a double-quoted PowerShell string turned `B:\Project` into `B:\\Project` and made it
worse (Gate 12).

Pass tool arguments via a **file**, not an inline JSON string — Windows paths through two
layers of shell quoting will mangle. And PowerShell 5.1's `-Encoding utf8` writes a BOM that
`JSON.parse` rejects, so strip `^﻿` when reading it back.

### An MCP server reads its credential ONCE, at startup

A deploy MCP returned `401 invalid api key` on every tenant-scoped call. The user supplied a
working key; writing it into the server's config **changed nothing**, because the process
was already running with the old value. There is no in-session fix: the connection has to
be restarted, which the agent cannot do.

Two things follow, and the second is the useful one:

1. **Fix the config anyway** so the next session works, back it up first, and re-parse the
   file after writing — MCP config commonly lives in a large shared JSON you must not corrupt.
2. **The MCP server is a thin client over an HTTP API you can call yourself.** `npm pack`
   the package and read `dist/client.js`; the endpoints, auth header and body encoding are
   right there. That recovered the full contract in one step:

   ```
   GET  /tenants                                   -> tenant id
   GET  /tenants/{tid}/projects                    -> find by name
   POST /tenants/{tid}/projects   {name}           -> create
   POST /projects/{pid}/source?app&port&mode&size  -> gzipped tarball, x-api-key header
   ```

   The deploy then runs from a script with no MCP involved.

**Never hardcode the key in that script.** Read it from the config at runtime and mask it
out of every log line and error message — deploy scripts get committed:

```js
const safe = s => String(s).split(KEY).join('hk_***');   // wrap every throw
```

Then grep the repo for the key's prefix before pushing, and tell the user to rotate any
credential they pasted into chat.

---

## 3. Live audit — the step that is always skipped

A deploy tool returning `"status": "running"` proves a container started. It proves nothing
about your assets.

> **Include a discriminator that only the NEW build contains.** Re-deploying to the same URL
> can serve a cached or still-rolling old build, and every asset will resolve perfectly while
> you audit the previous version. Pick something the change introduced — a new symbol id, a
> new class — and assert it is present before you believe the numbers:
> `brand symbols live: 3  coinbase:true zapier:true cursor:true`, and only then report.
> Write this as a `.cjs` file: a regex containing `/` and quotes inside a double-quoted
> PowerShell string is a parser error, and it caught this skill's author again (Gate 12).

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
