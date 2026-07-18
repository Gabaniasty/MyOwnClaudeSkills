# Failure Gates

Every rule here comes from a defect that reached the user in a real session. Nine times
across six projects the user reported breakage that the immediately preceding assistant
turn had explicitly verified as passing. Three of those failures recurred **after** the
rule was already written into this skill as prose.

That is the central lesson of this file:

> **A prose warning is not a control. Only a named, mechanical check that produces a
> number you must report is a control.**

So each gate below is a command or assertion with a pass condition, tied to a phase. Run
them. Report the numbers. "I checked" is not a result.

---

## GATE 1 — Measure the CHILD against its PARENT, never the parent alone

**This single failure class caused 5 of the 9 user-reported defects.**

What happened: `.hero` measured exactly 880px, which was correct, and was reported as
"fits viewport, verified." The image *inside* it was 1007px, overflowing 127px and covering
the next section. The number was real; it was the wrong number.

Same shape three times:
- hero container correct while its `<img>` overflowed
- `src=` audit clean while every `srcset=` WebP 404'd
- accent contrast measured on porcelain, then used on darker sand

**Run this for every element with `object-fit`, `aspect-ratio`, `height: 100%`, or a
background image:**

```js
(() => {
  const bad = [];
  document.querySelectorAll('img, video, picture, [style*="background-image"]').forEach(el => {
    const p = el.parentElement; if (!p) return;
    const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
    const oy = Math.round(a.bottom - b.bottom), ox = Math.round(a.right - b.right);
    const clipped = /hidden|clip|auto|scroll/.test(getComputedStyle(p).overflow);
    if ((oy > 1 || ox > 1) && !clipped)
      bad.push({ el: el.tagName + '.' + (el.className||'').toString().split(' ')[0],
                 overflowsY: oy, overflowsX: ox, parentOverflow: getComputedStyle(p).overflow });
  });
  return { childrenOverflowingUnclippedParents: bad.length, detail: bad };
})()
```

**Pass condition: `0`.** Report the number.

### The CSS trap behind it
`height: 100%` on a grid item resolves against the grid *area*. With no explicit row track
the area is content-sized, so 100% is indefinite, falls back to `auto`, the image renders at
its natural ratio, and that inflates the row past the container. Fix:

```css
.parent { display: grid; grid-template-rows: minmax(0, 1fr); height: <definite>; overflow: hidden; }
.child  { height: 100%; min-height: 0; overflow: hidden; }
```

`aspect-ratio` is separately overridden by the HTML `height` attribute unless you set
`height: auto`. Without it, gallery frames rendered 184x504 instead of 184x153.

---

## GATE 2 — Prove the mechanism can run here before calling code broken

**Seven distinct occasions. The discriminator was known in the first hour and had to be
rediscovered three more times.**

The browser pane runs with `document.hidden === true`. Everything frame-driven is frozen:

| Frozen | Symptom that looks like a page bug |
|---|---|
| `requestAnimationFrame` | scroll handlers "never fire" |
| `scroll-behavior: smooth` | `scrollTo` does nothing, page never moves |
| programmatic `scrollTo` | dispatches no scroll event, so sweeps never run |
| CSS transitions | `.open` class present but computed style unchanged |
| screenshot compositor | blank capture at any non-zero scroll |
| `:focus` | cannot match; `activeElement` is set but styles don't apply |
| image decode | screenshot taken before paint shows an empty panel |

**Run this FIRST, before diagnosing any behavioural bug:**

```js
(() => ({
  documentHidden: document.hidden,
  rafFires: null,           // set by the probe below
  smoothScroll: getComputedStyle(document.documentElement).scrollBehavior,
  note: 'If documentHidden is true, treat frozen animation/scroll/transition/focus as ENVIRONMENT until proven otherwise'
}))()
```

Then use these workarounds rather than "fixing" the page:
- scrolling → `document.documentElement.style.scrollBehavior = 'auto'` then `scrollTo`,
  then **`window.dispatchEvent(new Event('scroll'))`** (respect any throttle: one dispatch
  per tool call, real time elapses between calls)
- transitions → set `el.style.transition = 'none'` before reading computed style
- focus → assert the CSS rule exists in `document.styleSheets`, not that `:focus` matches
- screenshots → only trust them at `scrollY === 0`; verify everything else by geometry
- image state → check `img.complete && img.naturalWidth > 0` before believing a screenshot

**A genuine bug survives the workaround.** If defeating the artifact makes the symptom
vanish, it was never a bug. State that plainly instead of shipping a "fix."

---

## GATE 3 — Confirm a variant exists before referencing its width

**Recurred twice in the same project, after the rule was already written.**

`hero-dentist-1200` and `cta-band-2000` were both referenced as `src` fallbacks. Neither
existed, because `sharp`'s `withoutEnlargement` silently skips any width above the master.
Both would have shipped a broken image.

**Never hand-write a width into HTML. Derive it:**

```js
const meta = await sharp(input).metadata();
const widths = [520, 800, 1200].filter(w => w <= meta.width);
if (!widths.includes(meta.width) && meta.width < Math.max(...[520,800,1200]))
  widths.push(meta.width);          // widest honest variant, never upscale
console.log(slug, meta.width + 'x' + meta.height, '->', widths.join(','));
```

Then the reference audit (Gate 6) catches anything that slipped.

---

## GATE 4 — One fresh render per section. Count them.

The CTA band shipped as a flat colour because it was analysed from a 760px-wide crop of an
1824px mockup. At that scale a photographed plaster wall with a vase and bowl reads as flat
sand. `image-to-code` §5 already forbade cropping; four renders were generated for eight
sections and three sections were still analysed from crops.

> The rule is not "generate renders for the sections that seem to matter."

**Mechanical check before leaving Phase 2:**

```
sections identified in the mockup : N
standalone renders in _sections/  : M
ASSERT M === N
```

If `M < N`, name the missing sections and generate them. A section analysed from a crop is
not analysed.

**Also:** crop the mockup at *full resolution* when identifying what a section contains.
Downscaling to 760px is what destroyed the evidence.

---

## GATE 5 — The mockup is not an authority on accessibility

Measured on two separate projects: the reference mockup's own text failed AA.
- gym hero headline over key art: **1.06:1**
- dental CTA band: heading **3.22:1**, button **3.12:1**

Copying the reference faithfully ships an inaccessible page. Measure the *reference* as
well as your build, and when it fails, deviate and record why in `DESIGN-SPEC.md`.

Related: measure the accent against **every ground it lands on**, not one. `#8f5c2a` passed
at 5.12:1 on porcelain and failed at 4.23:1 on sand in the same page.

---

## GATE 6 — Reference audit covers `srcset`, and does not prove content

Two separate failures:

1. An audit scanning only `src=` reported "0 broken" while ten WebP files were missing. A
   failing `<source>` does **not** fall back to `<img>`. Audit both. (Script in `05` §2.)
2. A clean reference audit cannot detect that a correctly-resolving file contains the wrong
   thing. `tr-michael-*.jpg` held a woman and `tr-emily-*.jpg` held a man; both resolved,
   both were labelled wrong, and the audit said "58 references, 0 missing."

**So after any rename, reorder, or batch placement: open at least one file and look at it.**
For matched pairs (before/after), open both and confirm they are the same person.

---

## GATE 7 — Background work: alive is not working

**Twice a background process reported healthy while doing nothing, costing three user
prompts chasing progress.**

- `codex exec` reads stdin; detached, stdin never closes and it hangs at ~0 CPU forever
- `Start-Job` without `Wait-Job` inside a backgrounded command orphans every job — and
  **the harness reports exit 0**, which reads as success

CPU time alone is a bad signal: 0.078s over 6min was a genuine hang, but 1.86s over 2.8min
was perfectly healthy work waiting on a network render.

**The reliable check is whether the job is producing artefacts:**

```powershell
# process alive?
Get-Process codex -ErrorAction SilentlyContinue |
  ForEach-Object { "{0:N1} min, CPU {1:N2}s" -f ((Get-Date)-$_.StartTime).TotalMinutes, $_.CPU }
# is it actually DOING anything? a session log that is growing is the real signal
Get-ChildItem "$env:USERPROFILE\.codex\sessions" -Recurse -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1 |
  ForEach-Object { "{0:N0} B, last write {1:N0}s ago" -f $_.Length, ((Get-Date)-$_.LastWriteTime).TotalSeconds }
```

No log, no growth, near-zero CPU → hung. Log growing → working, regardless of CPU.

**Report the artefact evidence to the user, not "still running."**

---

## GATE 8 — Codex saves to CODEX_HOME. Look there before reporting a stall.

**Written into this skill after batch 1, then violated on batch 2 and again on batch 3.**

Built-in `image_gen` writes to `$CODEX_HOME/generated_images/<session>/exec-<uuid>.png` and
only copies into the project **at the very end of the run**. Mid-run this is indistinguishable
from a hang.

**The moment a user asks why images are missing, run this before answering:**

```powershell
Get-ChildItem "$env:USERPROFILE\.codex\generated_images" -Recurse -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 12 |
  ForEach-Object { "{0,-46} {1,9:N0} B  {2:HH:mm:ss}" -f $_.Name, $_.Length, $_.LastWriteTime }
```

They are almost always there. Placing them yourself by ascending timestamp is safe **only
if you verify the mapping at both ends** — open the first and last images and confirm they
match the first and last entries of your task file.

---

## GATE 9 — Check every registry before declaring a capability absent

"Codex CLI cannot generate images" was stated with high confidence after checking
`codex plugin list` alone. `imagegen` is a **system skill** at `$CODEX_HOME/skills/.system/`
and never appears in that list. The false claim was written into this skill before being
disproven, where it would have misled every future run.

Before "X cannot do Y", check: subcommands, plugin list, **system skills directory**, MCP
servers, and the tool's own docs. Absence of evidence in one registry is not evidence of
absence.

---

## GATE 10 — Never assert about the user's files without checking your own cwd

Claimed three of the user's source PNGs "are gone" and said the cause was unknown. They
were present the whole time; the shell's working directory had drifted into `deploy/`. The
phantom then caused extra defensive work in the following turns.

**Before any claim that a file is missing:** `pwd`, then re-check with an absolute path.

A wrong claim about the user's data is worse than the bug you were chasing.

---

## GATE 11 — Load the skills the instructions name

Across five projects, exactly one design skill was ever invoked — `design-taste-frontend`,
once, at the very start of the first project. `emil-design-eng` and `ui-ux-pro-max` were
never loaded despite the global CLAUDE.md pointing at the first and a brief explicitly
saying *"Use the UI UX Pro Design skill."*

**At the start of Phase 5, state which skills you are loading and invoke them.** If a brief
names a skill, that is not a suggestion.

---

## GATE 12 — Windows / PowerShell hazards

| Hazard | Symptom | Fix |
|---|---|---|
| `codex.ps1` npm shim re-splits args | `unexpected argument 'Cosmetic' found` | pipe the prompt via stdin: `Get-Content task.md -Raw \| codex exec ...` |
| bullets starting with `-` in a prompt | `unexpected argument '-' found` | same fix as above |
| detached `codex exec` | hangs forever at ~0 CPU | same fix as above (stdin closes) |
| `Start-Job` without `Wait-Job` | jobs die, harness reports exit 0 | hold the parent open with `Wait-Job` |
| PS 5.1 `-Encoding utf8` | writes a BOM; `JSON.parse` throws | strip `^﻿` when reading back |
| `$ErrorActionPreference = "Stop"` | git/gh stderr becomes fatal | use `"Continue"` for scripts that shell out |
| fresh deploy subdomain | `DEPTH_ZERO_SELF_SIGNED_CERT` | `node --use-system-ca`, or use `Invoke-WebRequest` |
| `Remove-Item` with an odd literal path | "path is protected from removal" | use `-LiteralPath` |

---

## GATE 13 — Fix latent copies of any bug you find

The reveal-gating bug hid ten images on one page and was **latent in two others**. The rAF
latch deadlock was the same. When you find a defect in shared code, grep the other projects
for the same pattern and fix them in the same turn.

---

## THE REPORTING RULE

When you claim something works, the claim must name **what** was measured and **what the
number was**. Not "verified responsive" but "0 horizontal overflow at 375/768/1024/1440/1920."

And when you have measured a container, say so explicitly — *"container measured; child
overflow checked separately"* — because the failure mode is not skipping measurement. It is
measuring one true thing and letting it stand in for a different claim.
