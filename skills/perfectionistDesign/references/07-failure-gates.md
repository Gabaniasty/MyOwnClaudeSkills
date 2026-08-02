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
  // An overflow is a DEFECT only when NOTHING clips it. Two mistakes to avoid:
  //   1. Checking only the immediate parent. <picture> is inline and never clips,
  //      so every <picture><img> pair reports a false positive.
  //   2. Treating "overflows its clipper" as a defect. A scaled image inside an
  //      overflow:hidden wrapper is the effect working, not a bug.
  function hasClippingAncestor(el) {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (/hidden|clip|auto|scroll/.test(cs.overflow) || cs.clipPath !== 'none') return n;
      n = n.parentElement;
    }
    return null;
  }
  const defects = [];
  document.querySelectorAll('img, video, [style*="background-image"]').forEach(el => {
    if (hasClippingAncestor(el)) return;                    // clipped somewhere: safe
    const p = el.closest('figure, section, div') || el.parentElement;
    if (!p || p === el) return;
    const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
    const oy = Math.round(a.bottom - b.bottom), ox = Math.round(a.right - b.right);
    if (oy > 1 || ox > 1)
      defects.push({ src: (el.getAttribute('src')||'').split('/').pop(),
                     parent: p.className || p.tagName, overflowY: oy, overflowX: ox });
  });
  return { childrenEscapingUnclipped: defects.length, detail: defects };
})()
```

**Pass condition: `0`.** Report the number.

> The first version of this gate was wrong in both directions and fired 5 false
> positives on its first real run. A gate that cries wolf gets ignored, which is
> the failure this file exists to prevent. If a gate fires, **verify the finding
> before acting on it** - exactly as you would a user-reported bug.

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

### `-s workspace-write` silently does not always apply

Measured: a run launched with `-s workspace-write` reported `sandbox: read-only` in its own
session header, generated a perfect 1.9 MB image, and then ended with *"Workspace access is
read-only, so I could not copy it to the requested location."* Exit code was **0**. Nothing
looked like a failure except an empty destination folder.

**So never depend on codex writing into the project.** Let it save wherever it wants and
copy the file out yourself, keyed by the **session id** rather than "newest png wins":

```powershell
$sid = (Select-String -Path $log -Pattern 'session id:\s*([0-9a-fA-F-]{36})' |
        Select-Object -First 1).Matches.Groups[1].Value
$hit = Get-ChildItem "$GenRoot/$sid" -Filter *.png | Sort-Object LastWriteTime -Desc | Select -First 1
Copy-Item $hit.FullName $destination -Force
```

Then **verify the bytes decode** before calling it done. A file existing is not a file being
a valid image:

```powershell
node -e "require('sharp')('$out').metadata().then(m=>console.log(m.width+'x'+m.height))"
```

### Disarm the host's other skills before generating

Codex auto-loads global agent skills. A generation run pulled in `brainstorming`, whose
HARD-GATE forbids taking any action before presenting a design for approval, and
`impeccable`, which has its own preflight gates. Either can stall or refuse a pure asset
task. Prefix every generation prompt:

> This is a single, self-contained image generation task. Do NOT invoke brainstorming,
> planning, design-review, spec-writing or approval-gate skills. Do NOT ask questions.
> Generate the image immediately using the built-in image tool.

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

### Argument and escaping traps that have each cost a full debugging cycle

**`powershell.exe -File` passes `-Slugs "a,b,c"` as ONE string.** A `[string[]]` parameter
receives a single element containing commas, matches nothing, and the script runs an empty
queue while reporting success (`worker queue (0)`). Re-split inside the script:
`$Slugs = @($Slugs -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })`.

**`node -e` inside a double-quoted PowerShell string mangles backslashes.** An attempt to
write the config key `D:\Projects` produced a literal `D:\\Projects` after
two levels of escaping — a *new* wrong key, on top of the one being fixed. **Write a real
`.cjs` file instead.** The skill already says to prefer a script over `node -e`; this is
what it costs when you do not.

**A native command's stderr is not a failure.** `npx`, `git` and `codex` all write
informational output to stderr; with `$ErrorActionPreference = "Stop"` that becomes fatal
mid-sequence. Use `Continue` in any script that shells out.

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

## GATE 13 — Never slice a generated sheet on a computed grid

**One asset per generation. Small square assets get their own 1:1 image.**

Eight forum avatars were generated as a single 4x2 "sheet" and sliced at computed 512px
intervals. Every one came out visibly off-centre. Measured offsets against the assumed grid:

```
cell 1  dx=+44 dy=+20      cell 5  dx=+53 dy=-52
cell 4  dx=-48 dy=+37      cell 7  dx=-28 dy=-62
```

Up to 12% off on a 512px cell, then `fit: cover` compounded it. The user spotted it
immediately; the reference audit did not, because every file resolved.

**Why it cannot be fixed by cropping smarter.** Even correcting to the detected centroid
does not save it: the emblem bounding boxes measured 355x179 for one and 239x345 for
another. A single square crop frames a wide subject and a tall subject completely
differently. The sheet was the wrong artefact, not the crop.

### The rule
| Asset | How to generate |
|---|---|
| Avatars, icons, badges, logos, any small square | **one 1:1 image per asset**, subject centred, ~60% of frame, even margins |
| Hero, section background, editorial photo | one image at the section's real aspect ratio |
| A set that must look related | generate individually, pass the first as `-i` to the rest |

Put the framing in the prompt so no crop is ever needed:

> Square, 1:1. A single subject **precisely centred**, occupying roughly the middle 60% of
> the frame with even margin on all four sides. It must not touch or approach the edges.
> **Do not generate a grid, sheet, contact sheet or montage.**

### If you inherit a sheet anyway
Detect actual content bounds per cell; never slice at computed intervals. But treat that as
salvage, not as the method:

```js
// per nominal cell: centroid + bbox of non-background pixels
let sx=0, sy=0, n=0, minX=1e9, maxX=-1, minY=1e9, maxY=-1;
for (…) if (Math.max(r,g,b) > 70) { sx+=x; sy+=y; n++; /* track bbox */ }
const cx = sx/n, cy = sy/n;   // compare against the assumed centre
```
If any `|dx|` or `|dy|` exceeds 3% of cell width, the grid assumption is invalid — regenerate
individually.

### The general lesson for asset planning
When analysing a mockup, **enumerate every distinct asset and choose a generation strategy
per asset before generating anything.** Small repeated elements are the ones most likely to
be batched for convenience, and they are exactly the ones where batching fails, because they
are displayed small and centred where any offset reads as broken.

---

## GATE 14 — Fix latent copies of any bug you find

The reveal-gating bug hid ten images on one page and was **latent in two others**. The rAF
latch deadlock was the same. When you find a defect in shared code, grep the other projects
for the same pattern and fix them in the same turn.

---

## GATE 15 — A redesign must MEASURABLY diverge from the original

A redesign shipped as a reskin: same section order, same type pairing, same hero
composition, same palette, more whitespace. The user's first reaction was *"it looks almost
identical as the original design."* Every single choice had been justified as brand
fidelity, and the sum of them was the old site.

The cause was structural. Phase 1 was skipped because the phase map said Phase 1 is
"skippable when the user already has a reference image", and on a redesign the existing site
looks like one. With no mockup of the new design, the only composition available to anchor
on is the old one.

**Score the build against the original on these eight axes. Fill in the table honestly.**

| # | Axis | Original | New | Changed? |
|---|---|---|---|---|
| 1 | Section order and count | | | |
| 2 | Hero composition family | | | |
| 3 | Display type family | | | |
| 4 | Ground strategy (flat / layered / colour-block) | | | |
| 5 | Layout family of the primary content section | | | |
| 6 | Header and navigation treatment | | | |
| 7 | Signature motion device | | | |
| 8 | Imagery strategy | | | |

**Pass condition: at least 5 of 8 changed, AND axes 1 and 2 both changed.**

Axes 1 and 2 are mandatory because section order is the page's skeleton and the hero is the
whole first impression. A page that keeps both reads as the same site no matter what happens
to the colours.

### What does NOT count as divergence
- More padding. Whitespace is a density change, not a composition change.
- A new accent shade of the same hue.
- Reordering the *contents* of a section while the section order holds.
- Swapping a card grid for a slightly different card grid.

### What is EXEMPT from scoring
Anything on the written preservation list, which the client named explicitly: logo, company
name, brand hue, copy, legal text, URL structure, section ids. Preserving those is required
and never counts against the score. **If the preservation list has more than about seven
items, you almost certainly widened it yourself.** Re-read what the client actually named.

### Report it
State the score as a number, like every other gate: `divergence 6/8, axes 1 and 2 both
changed`. "It looks quite different" is not a result.

---

## GATE 16 — A redesign must be COMPLETE. Deleting content is not redesigning.

Gate 15 stops a redesign being too similar. This gate stops the overcorrection, and they
must both pass. Chasing divergence, a mockup dropped an entire Process section, collapsed
eight real projects into four invented ones, cut a six-item nav to one, reduced a seven-field
form to a single input, and dropped the footer tagline. The user's verdict was exact:

> *"You completely missed many sections and replaced them purely with images. You must give
> better redesign results so they feel an actual redesign not deleting things."*

**Replacing content with a photograph is not a design decision, it is a deletion.**

### Build the inventory from the DOM, not from a screenshot

A screenshot cannot tell you a form has a hidden honeypot field or that the nav has six
items when one is a button. Run this against the live site **before** writing the mockup
prompt:

```js
(() => {
  const inv = { sections: [], pageHeight: document.documentElement.scrollHeight };
  inv.nav = [...document.querySelectorAll('header nav a')].map(a => a.textContent.trim());
  document.querySelectorAll('main > section').forEach((s, i) => inv.sections.push({
    i, id: s.id || null,
    heading: (s.querySelector('h1,h2')||{}).textContent?.trim(),
    subheads: [...s.querySelectorAll('h3')].map(h => h.textContent.trim()),
    listItems: s.querySelectorAll('li').length,
    cards: s.querySelectorAll('article').length,
    inputs: s.querySelectorAll('input,select,textarea').length,
    links: s.querySelectorAll('a').length
  }));
  inv.formFields = [...document.querySelectorAll('form input,form select,form textarea')]
    .map(f => f.name);                        // catches hidden honeypots
  inv.outboundLinks = [...new Set([...document.querySelectorAll('a')]
    .map(a => a.getAttribute('href')).filter(h => h && h.startsWith('http')))];
  return inv;
})()
```

Scroll-reveal sites hide below-fold content from screenshots. Force it visible first:
`*{opacity:1!important;transform:none!important;visibility:visible!important}`.

### The assertion

```
sections in original      : N      sections in mockup      : >= N
nav items in original     : A      nav items in mockup     : A
form fields in original   : B      form fields in mockup   : B
work/portfolio items      : C      items in mockup         : C
outbound links            : D      preserved in mockup     : D
```

**Pass condition: every count in the mockup is >= the original.** Sections may be merged or
re-ordered, but nothing may silently vanish. A section may only be dropped if the user
explicitly asked for it, and then you say so out loud.

### The rule
> Redesign every section. Delete none of them. Divergence is about **how** content is
> presented, never about **how much** survives.

Put the full inventory into the mockup prompt as an explicit numbered list with counts
("Process: 5 named steps", "Work: 8 named projects"). An image model given "a work section"
invents three cards; given "eight named projects, listed here" it renders eight.

---

## GATE 17 — Verify the LAYOUT, not just the assets

Every gate before this one checks *content*: is the file there, does the text contrast, is
the count right. All of them passed on a page whose hero call-to-action was visibly broken:
an icon collapsed to zero width, a decorative image sat in the middle of the copy, and a
phone render dropped onto a second row. Nothing threw. No console error. The reference audit
said 45/45 resolved.

**The cause was one line of CSS:**

```css
.deco      { position: absolute; }   /* specificity 0,1,0 */
.cta-box > *{ position: relative; }  /* specificity 0,1,0, and LATER in the file */
```

Equal specificity, so the later rule won, and an absolutely-positioned decoration became a
**grid item**. It took column 1, squeezed the icon to `0px`, and pushed the last child onto
a new row. The computed grid read `386px 0px 572px`.

### The rule
> **Never blanket-set `position` on the children of a grid or flex container.** Always
> exclude the decorative layer: `.box > *:not(.deco)`. Absolutely-positioned children are
> invisible to grid; making them `relative` silently enrols them in the layout.

### Run this after any layout change

```js
// 1. zero-width grid tracks   2. collapsed boxes   3. overlapping siblings
document.querySelectorAll('*').forEach(el => {
  const cs = getComputedStyle(el);
  if (!/grid/.test(cs.display)) return;
  const cols = cs.gridTemplateColumns.split(' ').filter(Boolean);
  if (cols.some(c => parseFloat(c) === 0)) console.warn('ZERO TRACK', el, cs.gridTemplateColumns);
});
```

Full script: `scripts/check-layout.cjs` in the project it came from.
**Pass condition: `0` problems.** Report the number.

### Also check the tag tree
Hand-editing nested markup is where an unclosed `<div>` slips in, and the browser silently
repairs it, so nothing looks wrong until a layout collapses at some other breakpoint. Balance
the tree after every structural edit (`scripts/check-nesting.cjs`).

### And re-render the composed result
An asset can be perfect on its own and wrong in place: a phone render generated on an opaque
background ships a visible rectangle on a coloured panel. **When recreating a mockup, compare
the built section against the mockup section, not the asset against its prompt.**

---

## GATE 18 — Regenerating an asset means DELETING its derived variants first

**Phase 3/4, every time a master is regenerated.**

A regenerated master trims to a *different* size than its predecessor. The old variants do
not disappear, and a srcset builder that reads the directory will happily merge both
generations into one list:

```
dev-hardware   png 520, 900, 963, 995
                              ^new  ^old, and still the previous palette
```

The browser then picks by width, so on some viewports it serves the **old** image. In the
session that produced this gate, that meant purple devices on an orange page, at some
window sizes only — the hardest kind of bug to see, because the page looks correct at the
width you happen to be testing.

```bash
# BEFORE reprocessing, delete every derived variant of every regenerated slug
for s in $SLUGS; do rm -f "images/$s"-[0-9]*.{png,jpg,jpeg,webp}; done
node scripts/process-deco.cjs      # rebuild from the new masters only
node scripts/reconcile-srcset.cjs  # widths derived from disk, never hand-written
node scripts/audit-refs.cjs
```

**Pass condition:** every referenced width exists AND every file on disk is referenced.
Both directions. `unused: 0` and `MISSING: 0`.

### Three sub-rules that cost real time

**The reconciler must cover EVERY slug, not a prefix.** A reconciler matching only
`dev-*` left `bg-aura-hero`, `bg-grid` and `cta-phone` pointing at widths their new masters
could not produce — six dangling references that survived a run reporting "8 slugs
reconciled". If a slug has no variants at all, that is not a reason to leave the markup
alone silently; **log it and exit non-zero.**

**The processing manifest must be derived, not hand-maintained.** A hand-written list had
`deco-torus`, `deco-shards`, `deco-helix` — all retired — while `deco-nodes` and `deco-orb`,
the two the page actually places, were absent. Their regenerated masters were silently
skipped. Build the list from what the document references.

**The filename did not change, so the browser did not re-fetch.** Same URL, new bytes.
The user kept seeing the old asset and reported it as a bug that no longer existed on disk.
Verify with a cache-bypassing fetch before you believe either the user's screenshot or your
own eyes:

```js
const blob = await (await fetch(url, { cache: 'reload' })).blob();
// decode and measure — this is what the SERVER holds, not what the tab kept
```

If you can, give regenerated assets content-hashed filenames so this cannot happen at all.

---

## GATE 19 — Cut the plate to the box it will live in

**Phase 3, before writing any image prompt for a full-bleed or `object-fit:cover` slot.**

Generating a 1.43:1 photograph for a band that renders at 2.66:1 forces `cover` to scale it
up **1.77×** at 1920 and **1.70×** at 2560 — past its native pixels, showing barely a third
of the frame. This is exactly what "the bigger the screen, the more zoomed in it gets" means
in practice, and it is decided at prompt time, not fixable in CSS.

```
required plate ratio ≈ (widest supported viewport) / (band height at that viewport)
required plate width ≈ widest supported viewport, in device pixels
```

**Pass condition:** at every tested width, rendered scale ≤ 1.0. Measure it:

```js
const sc = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
// sc > 1 means you are upscaling: the plate is too small or the wrong shape
```

### Two things that follow from `cover` and are easy to get backwards

**A full-bleed band's height must track WIDTH, not viewport height.** With a fixed
`max-height`, the band grows wider at every breakpoint while staying the same height, so its
aspect ratio — and the crop — blows out. `min-height: clamp(620px, calc(34vw + 240px), 940px)`
holds the aspect roughly constant; `clamp(580px, 70vh, 720px)` does not.

**`sizes` must describe the RENDERED width, not the box width.** Under `cover` filling the
band's height, the plate is drawn *wider* than the viewport and then cropped. `sizes="100vw"`
therefore selects a variant the browser must still stretch. Use the real figure
(`sizes="(max-width:959px) 100vw, 135vw"`), and re-check that `sc ≤ 1`.

**Also re-check the intrinsic `width`/`height` attributes after regeneration.** They were
left at `480x1110` for an image that had become `513x1191`.

---

## GATE 20 — Contrast is measured on GLYPH extents, on the axis that actually crops

**Phase 6, and any time text sits on a photograph.**

Three compounding errors made a perfectly fixable hero look impossible:

**1. Block boxes are not text.** A block element's rect includes the empty space to the
right of every short line. Sampling it finds dark pixels no letter ever touches. The first
pass reported "impossible even at full white" for a hero that in the end needed **no scrim
at all**. Use a `Range` over the text nodes:

```js
const r = document.createRange(); r.selectNodeContents(textNode);
for (const rect of r.getClientRects()) { /* THIS is where glyphs are */ }
```

**2. Check which axis overflows before tuning `object-position`.** A 1.43:1 image in a
1.99:1 box crops **vertically**; the horizontal figure is inert. Six identical rows of search
output were the tell, and they were nearly read as "nothing helps."

```js
const panX = img.naturalWidth * scale - box.width;   // 0 => object-position X does nothing
const panY = img.naturalHeight * scale - box.height;
```

**3. Find the BINDING constraint before adding a scrim.** One 12.5px caption in the
faintest ink token was, on its own, forcing an **86%** white wash over the whole photograph.
Darkening that single caption to the body token dropped the requirement to 44%; cutting the
plate correctly (Gate 19) dropped it to **0**. Always report which element binds:

```
tightest line: trust-note 4.50/4.5   <- this one caption is your whole scrim budget
```

**Order of levers, cheapest first:** re-cut or re-crop the plate → restyle the one binding
element → narrow the text column → *only then* a scrim, binary-searched to its minimum and
feathered to alpha 0 before the subject.

**Shape matters as much as strength.** A scrim easing from full opacity at x=0 had decayed
to alpha 0.09 by the time it reached the end of the body copy, so *no* peak value could ever
pass. It needs a **plateau across the copy column**, then a fall to zero.

**Pass condition:** 0 failures measured against real composited pixels, and state the scrim
actually painted. `--hero-scrim: 0` with 13/13 lines passing at 8.28:1 is a result. "Looks
readable" is not.

---

## GATE 21 — A breakout must be budgeted against the gap it breaks into

**Phase 6, any time an element escapes its container by design.**

A floating device that rises `0.26 × stage-height` above its stage, plus ~5% of its own
width again from the lean's bounding-box expansion, needs about **78px** of clearance. With
a 16px grid row gap it landed squarely on the "View case" link of the card in the row above
— **8 measured collisions**, in a layout that had already been reported as fixed once.

```js
cards.forEach((c, ci) => {
  const d = c.querySelector('.floating')?.getBoundingClientRect(); if (!d) return;
  cards.forEach((o, oi) => { if (oi === ci) return;
    o.querySelectorAll('h3,p,a,span').forEach(t => {
      const r = t.getBoundingClientRect();
      if (Math.min(d.right,r.right) - Math.max(d.left,r.left) > 2 &&
          Math.min(d.bottom,r.bottom) - Math.max(d.top,r.top) > 2) collisions++;
    });});});
```

**Pass condition: 0 collisions and 0 side spills at EVERY breakpoint.** Sizing the gap so
the breakout lands in empty space is also what makes the element read as genuinely floating
rather than pasted over its neighbour.

### Test at the animation's worst frame, not a random one

If the element also has an idle float, a screenshot catches an arbitrary phase. Pin it to
the extreme and re-run:

```js
const s = document.createElement('style');
s.textContent = '.floating{animation:none!important;transform:translateY(-5px)!important}';
document.head.appendChild(s);   // worst case, then measure
```

### Rotation expands the bounding box

A rotated box is taller and wider than its layout size: roughly `0.05 × width` extra at 6°.
Two devices cleared their card's edge by 7px and 4px purely from the lean. Measure the
**rotated** rect, and remember the picture really does reach the box edge on the axis that
binds.

---

## GATE 22 — `object-fit: contain` does not equalise size. Measure what RENDERS.

**Phase 6, for any SET of mixed-aspect assets in a shared box.**

`contain` guarantees nothing escapes; it guarantees nothing about apparent size. In one
uniform box, **width** bound on a 1.58-ratio laptop while **height** bound on a 0.39-ratio
phone, and the laptop rendered **190px tall next to a 277px phone**. A laptop that looks
smaller than a phone is backwards, and every individual asset passed its own check.

```js
const r = img.naturalWidth / img.naturalHeight, br = box.width / box.height;
const renderedH = r > br ? box.width / r : box.height;   // the number that matters
const renderedW = r > br ? box.width : box.height * r;
```

**Pass condition:** rendered-height spread across the set ≤ ~30%, or a stated reason.
The fix is a per-asset box multiplier for the landscape members — widening a portrait asset
does nothing, because its height is already the binding axis.

**A set-consistency check must be rewritten when the assets change kind.** The check
inherited from an earlier project measured the mean luminance of a 6% border strip — the
"paper" behind each subject. Correct for opaque renders; meaningless for chroma-keyed
cutouts, where every border strip is identically blank. It would have returned a perfect
score forever while telling you nothing. **When the asset format changes, re-derive what the
check should measure.**

---

## GATE 23 — Prove every declared animation receives its driving value

**Phase 6.**

Declaring motion is not the same as wiring it. Three separate cases in one session:

| Declared | Why it never ran |
|---|---|
| `transform: translate3d(0, var(--py), 0)` on 3 atmosphere layers | no `data-par` attribute, so the driver never selected them — `--py` was permanently `0` |
| `transition-delay: var(--d)` on the contact form | element had **two `style` attributes**; the parser silently drops the second |
| `.eye::before { width: 0 }` → `.eye.in::before { width: 14px }` | rule unscoped, so eyebrows without a reveal class could never get `.in` and would sit at 0 width forever |

```js
// every element whose CSS reads a custom property must actually receive it
[...document.querySelectorAll('[data-par]')].map(e => getComputedStyle(e).getPropertyValue('--py'));
// and: are there elements the CSS targets that carry no driver attribute at all?
```

```bash
# duplicate style attributes — this has now bitten twice in two different sessions
grep -oP '<[a-z]+[^>]*\sstyle="[^"]*"[^>]*\sstyle="' index.html | wc -l   # must be 0
```

**Pass condition:** driver values are non-zero somewhere in the scroll range; duplicate
`style` attributes = 0; and any `X → X.in` pair is scoped so an element that can never
receive `.in` keeps its resting value. **Scope reveal-driven rules to the reveal class**
(`.eye.rv`, not `.eye`) — an unscoped one is a stranded reveal wearing a different hat.

---

## GATE 24 — Order your verification passes, and doubt the check before the artefact

**Phase 6. This gate is about your own instruments.**

Two false alarms in one session, both from the harness rather than the page:

**A theme toggle before a pixel pass.** A combined audit flipped `data-theme` to dark,
flipped it back, then read the hero's text colours and compared them against light-theme
photo pixels — reporting **4 hero contrast failures that did not exist**. Run pixel passes
**first**; anything that mutates global state runs **last**.

**Not-yet-loaded is not broken.** `!img.complete` flags every lazy, offscreen image.
Ten "broken images" were ten images that had simply not been asked for yet:

```js
const broken = imgs.filter(i => i.complete && i.naturalWidth === 0);  // complete AND zero
const notYet = imgs.filter(i => !i.complete);                          // different thing
```

**Pass condition:** before reporting any failure, re-run the check in isolation. If the
isolated run passes, the harness was wrong — say so plainly and fix the harness. This is
Gate 2 applied to your own tools: *the artefact was fine every time.*

---

## GATE 25 — Never inherit a credential, path, or config by search order

**Phase 7, and any time you touch a config file. This one cost the most trust.**

A repair script scanned every project in a shared config for an entry named `<deploy-host>`
and kept **the first one it found**. Another project already had one, so it copied that
project's stale API key over the key the user had just supplied. The resulting `401 invalid
api key` was then reported back to the user as *"your key is rejected, please re-copy it"* —
when their credential had been correct the entire time.

**Rules:**
- Address config by **exact key**, never by "first match" or "any project containing".
- After writing a credential, **prove it end-to-end before reporting anything about it**:
  ```
  200 /tenants  -> tenant ten_…, plan pro     # authenticated
  401 /tenants  -> {"error":"invalid api key"} # NOT authenticated
  ```
  Isolate the credential from its wrapper — call the API directly, no SDK in the path.
- **Verify the wrapper before blaming the secret.** Unpacking the npm package took two
  minutes and proved the env var names, base URL and auth header were all exactly right,
  which is what narrowed it to the stored value.
- Print a **masked** form only (`hk_Rt…GQQ (35 chars)`). Masking is also what exposed this
  bug: the stored key started `hk_Mj`, the user's started `hk_Rtj`.

### Config written by a CLI is keyed by the CWD it ran from

`claude mcp add` run from a Bash shell wrote its entry under `D:/Projects`, while
the session reads `D:\Projects`. It reported success, `mcp list` showed it connected,
and it would have been invisible on restart. **After any config-writing CLI, read the file
back and confirm the entry is under the key the consumer actually uses.**

### An MCP server added mid-session is not callable in that session

Servers attach at session start. You can still drive one over stdio yourself — `initialize`
→ `notifications/initialized` → `tools/list` → `tools/call` — which is how this deploy
completed without a restart. Do that rather than making the user restart.

---

## GATE 26 — Ship a derived folder, never the working directory

**Phase 7.**

The working folder was **87.7 MB**; the site is **18.1 MB**. The difference is generation
masters, scratch, scripts and mockups — none of which the site serves, all of which a
"deploy this directory" command would happily upload.

**Derive the file list from the document, never from hand-written copy rules:**

```js
const refs = new Set(html.match(/(?:images|logo|fonts)\/[\w.\/-]+\.(?:png|jpe?g|webp|svg|avif|ico|woff2?)/g));
// copy exactly these, plus the runtime entry points
```

**Pass condition:** `referenced === copied`, `missing = 0`, and the deployed folder is
smaller than the working one. Then **fetch the live URL and HEAD every asset on it** — a
deploy tool's success message is not evidence that the page renders:

```
HTTP 200, 149 asset refs, 149 resolved, 0 broken
```

---

## GATE 27 — Parallel generation needs an exact mapping, not "newest file wins"

**Phase 3, when running more than one generation worker.**

A single-worker recovery path — *"if the expected output is missing, take the newest image
anywhere in the tool's output directory"* — is sound only while exactly one generation is in
flight. With three workers sharing a queue it will hand worker A's image to worker B's slug,
and the mismatch is silent and plausible-looking.

**Rule:** parallel workers run in a strict mode where recovery uses the **session-id
directory alone**. Workers skip any output that already exists, so overlapping ranges cost
time, never correctness. Give each worker a disjoint, explicitly ordered slice and let the
most visible assets land first.

Three workers took a 34-asset run from ~90 minutes to ~30 with zero failures — but only
after the fallback was disarmed.

---

## GATE 28 — "It looks off" is three measurable things

**Phase 6.** Alignment is not a matter of taste and it is not reliably eyeballable at 1px.
Almost every "something's wrong but I can't say what" reduces to one of these:

```js
// 1. NEAR-MISS EDGES — elements that almost share a left edge but do not.
//    An edge used by 3+ elements is intentional. One sitting 1-3px off it is a
//    mistake, and it is exactly the distance the eye notices but cannot name.
nearMissEdges  ->  must be []

// 2. SPACING THAT CAME FROM NOWHERE. Gaps should come from a small scale.
//    Twenty distinct gap values in one page means the spacing was typed, not designed.
distinctGapValues  ->  a handful, not dozens

// 3. SUBPIXEL GEOMETRY. An element at x=133.5 renders with a blurred edge.
//    Usually a percentage width or an odd-numbered flex gap.
subpixelElements  ->  0
```

All three are in `scripts/audit.browser.js`; run `await pdAudit()` and report
`out.alignment`. Measured on a real build: `majorEdges [40, 77, 133]`,
`nearMissEdges []`, but **9 subpixel elements** — invisible in a screenshot, and a
genuine source of soft edges.

**Pass condition:** `nearMissEdges: []` and `subpixelElements: 0`. A non-zero count is
not automatically a defect — a deliberately offset element is fine — but it must be a
decision you can name, not a surprise.

---

## GATE 29 — `<picture>` does not inherit sizing. Size the PICTURE, not the img.

**Phase 6, and Phase 5 the moment you write a `<picture>`.**

The user reported *"images are too small in certain places"* and *"things are blurry."*
Both were one defect:

```
.coach-media  (grid item, stretched by its row)   428px tall
  └ <picture>                                     326px      <- auto height
      └ <img height:100%>                         326px      <- 100% OF THE PICTURE
```

**102px of dead black space** inside the container, which reads as an image that is
too small sitting in a void. `img { height: 100% }` resolves against its parent — and
its parent is the `<picture>`, not the box you sized. `<picture>` is an inline wrapper
with no dimensions of its own; it silently breaks every `height: 100%` chain through it.

```css
/* WRONG — the chain is broken by the wrapper */
.media { height: 100%; }
.media img { width: 100%; height: 100%; object-fit: cover; }

/* RIGHT — the wrapper must be sized too */
.media { position: relative; }              /* or display:grid */
.media picture { display: block; width: 100%; height: 100%; }
.media img { width: 100%; height: 100%; object-fit: cover; display: block; }
```

**Measure it, do not eyeball it:**

```js
// for every img, compare against the nearest ancestor that is NOT a wrapper
starvedOfHeight  ->  must be 0
```

`scripts/audit.browser.js` reports `out.media.starvedOfHeight` with the dead-pixel count
and whether a `<picture>` is in the chain.

### The blur has the same root

That container measured `326.203px`. Fractional geometry puts an image on a half-pixel
boundary and the browser resamples it — a genuinely soft edge, invisible in a
screenshot, obvious on a real display. `out.media.fractionalGeometry` counts them.

Usual causes: `em`-based dimensions under a `clamp()` font-size, odd-numbered flex gaps,
and percentage widths that do not divide cleanly. Prefer whole `px` for anything that
sizes media, and let the flexible unit live on the container instead.

**Pass condition:** `starvedOfHeight: 0` and `fractionalGeometry: 0`.

> The first version of this counted ANY fractional width, left or top, and reported
> 11/11 on a perfectly good fluid layout. A fluid column is fractional by definition;
> demanding zero there sends someone chasing an unfixable number. It now counts only
> what actually resamples: a fractional HEIGHT under object-fit, or a fractional
> vertical offset. **A gate that cannot be satisfied gets ignored, and then so do the
> gates next to it.**

---

## GATE 30 — NEVER hand-draw an illustration in SVG. It is a generated asset.

**Phase 2 inventory, and Phase 5 the moment you are tempted.**

The mockup showed a world map with dots on the origin countries. The analysis pass did
not record it as an image, so the build **hand-wrote a world map in SVG path data** — ten
elements, four paths of 80+ coordinates each. It rendered as a wobbly traced outline
nothing like the mockup, and it is unmaintainable: nobody can edit that path by hand, and
no future change can improve it.

The existing rule *"never hand-roll an icon, install a set"* was read as being about
icons only. It is not. **Any drawn artwork is an asset.**

| Hand-authored SVG is fine | It is NOT fine for |
|---|---|
| an icon from a real icon set | maps, world or regional |
| a logo extracted verbatim from the brand | diagrams, charts, flow illustrations |
| a rule, a divider, a chevron, an arrow | anything with a recognisable real-world shape |
| geometry with a handful of coordinates | textures, patterns, decorative artwork |

**The mechanical test — run it on every build:**

```bash
# any inline <path> with a long coordinate string is traced artwork, not an icon
grep -o '<path[^>]*d="[^"]\{80,\}"' index.html | wc -l     # must be 0
```

A `d` attribute longer than about 80 characters is not something a person wrote
deliberately; it is something that should have been generated as an image, or taken from
a real library.

### Where this actually goes wrong: the Phase 2 inventory

The root cause is upstream. `09-phase-entry-checks.md` already says *"inventory every
ELEMENT, not just sections"* — this is the case it was written for and it still got
missed. When reading a mockup, every one of these becomes a row in the asset list with a
decision beside it:

> photographs · **maps** · **diagrams and charts** · **illustrations** · textures and
> patterns · background washes · icons · logos · badges · dividers

For each: **generate it, take it from a library, or build it in CSS.** "Draw it in SVG
by hand" is not one of the three options. If the mockup shows it and you cannot name
which of the three it is, you have not finished the inventory.

**Pass condition:** long-path count `0`, and every drawn element in the mockup appears in
the asset list.

---

## GATE 31 — `100vw` includes the scrollbar. Full-bleed built on it always overflows.

**Phase 6, and Phase 5 whenever you write a bleed.**

The standard break-out idiom:

```css
--page: min(1280px, calc(100vw - 48px));
.bleed { margin-right: calc(-1 * (100vw - var(--page)) / 2); }
```

`100vw` is the viewport **including** the classic scrollbar. The layout viewport
(`documentElement.clientWidth`) excludes it. So the bleed overshoots the right edge by
exactly the scrollbar width — measured at **8px** on one build — and creates the
horizontal scroll the author was trying to design.

`overflow-x: hidden` on `body` does **not** fix it: the document still reports the
overflow, and on some engines the scrollbar still appears.

**The fix — on BODY, never on `<html>`:**

```css
body { overflow-x: clip; }     /* NOT html, and NOT hidden */
```

> **This gate said `html { overflow-x: clip }` when it was first written, and that was
> wrong.** Shipping it broke the sticky nav on the very next build: the cart button
> scrolled off the top of a phone screen and became unreachable. The advice that `clip`
> is safe on the root because only `hidden` creates a scroll container does not hold —
> `clip` makes the root a *clip container*, which kills `position: sticky` for every
> descendant just as thoroughly.

Measured, all three combinations, scrolled to 2000px:

| | nav sticky | overflow |
|---|---|---|
| `html { overflow-x: clip }` | **false** | 0 |
| `body { overflow-x: clip }` | true | 0 |
| neither | true | 0 |

`body` works because `<html>` remains the scroll container. And do not leave a second
`overflow-x: hidden` on `body` elsewhere in the sheet — that reintroduces the same bug
from the other direction.

### `clip` is the belt. It is NOT the fix. — corrected a second time

The table above was measured on a page whose bleed happened to land inside the clip, and
it made `body { overflow-x: clip }` look sufficient. **It is not.** On the next build the
same page still measured **8px of overflow at 768 and 1440 with `clip` already applied**,
because `overflow` set on `body` while `<html>` is `visible` is *propagated to the
viewport* — body itself computes to `visible` and clips nothing. You cannot rely on it to
absorb a bleed that is genuinely too wide.

**Stop deriving the bleed from `100vw` at all.** Stamp the real layout width once and use
it everywhere:

```css
:root {
  --sbw:  0px;                          /* stamped by JS; 0 is a safe no-JS default */
  --vw:   calc(100vw - var(--sbw));     /* the LAYOUT viewport */
  --page: min(1280px, calc(var(--vw) - 48px));
}
.bleed { margin-right: calc(-1 * (var(--vw) - var(--page)) / 2); }
```

```js
var w = window.innerWidth - document.documentElement.clientWidth;
document.documentElement.style.setProperty('--sbw', (w > 0 ? w : 0) + 'px');
```

**And see Gate 32 before you write that script — stamping it once from `<head>` reports 0
on every load and quietly reinstates the bug you just fixed.**

Verify by arithmetic, not just by the aggregate. At 768 with a 15px scrollbar the numbers
have to close exactly:

| | broken (`--sbw` = 0) | fixed (`--sbw` = 15) |
|---|---|---|
| layout width | 753 | 753 |
| `--page` | 736 | 721 |
| centred gutter | 8.5 | 16 |
| bleed offset | −16 | −16 |
| right edge | 760.5 | 753 |
| **overflow** | **8** | **0** |

If the aggregate says 0 but you cannot make the arithmetic close, you are measuring a
viewport where the scrollbar happens to be absent.

**Always verify BOTH properties together**, because fixing one breaks the other:

```js
{ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,  // 0
  sticky:  (window.scrollTo(0,2000), Math.round(nav.getBoundingClientRect().top)) }       // 0
```

**Pass condition:**

```js
document.documentElement.scrollWidth - document.documentElement.clientWidth   // 0
```

Check it at every breakpoint. An off-canvas drawer or a fixed panel parked at
`translateX(100%)` will trip this too, and `clip` covers those as well.

### While you are there: the blank band under the header

The same build had `padding-top: 88px` on a hero sitting under a 77px header — 165px of
empty page before anything appeared, where the mockup had the hero starting immediately
below the nav rule. Measure it rather than eyeballing:

```js
heroTop + heroPaddingTop - headerHeight   // the blank band, in px
```

If the mockup's first content sits close under the nav and yours does not, the padding is
wrong. This is Gate 5's rule in a new place: **the mockup is the spec for spacing, not
just for colour.**

---

## GATE 32 — Anything measured from `<head>` is measured on an empty document

**Phase 5, for every value stamped into CSS by script.**

The Gate 31 fix was written correctly and still shipped broken, because the stamping
script lived in `<head>`:

```js
// runs before <body> exists → the document has no height → no vertical scrollbar
var w = window.innerWidth - document.documentElement.clientWidth;   // ALWAYS 0
```

It read `0` on every single load. The `--sbw` variable existed, the arithmetic that used
it was right, and the overflow came straight back. It measured clean once — on a viewport
that had been *resized* after load, which fired the resize listener and stamped the real
value. **A resize is not a load.** The pass came from the one path that could not occur
for a real visitor.

This is the general trap: `clientWidth`, `scrollHeight`, `getBoundingClientRect`,
`matchMedia` on content-dependent queries, and font metrics are all meaningless in `<head>`.

**Stamp early for first paint if you must, then re-stamp when the value can be real, and
keep watching:**

```js
set();                                                    // first paint, may be wrong
document.addEventListener('DOMContentLoaded', set);
window.addEventListener('load', set);                     // after images settle layout
window.addEventListener('resize', set, { passive: true });
if ('ResizeObserver' in window) new ResizeObserver(set).observe(document.documentElement);
```

The ResizeObserver is not belt-and-braces. A scrollbar appears and disappears from things
`resize` never fires for: a modal locking scroll, lazy images landing, content collapsing.

**Pass condition — assert on a FRESH LOAD, never after a resize:**

```js
// reload first, then:
getComputedStyle(document.documentElement).getPropertyValue('--sbw')  // '15px', not '0px'
document.documentElement.scrollWidth - document.documentElement.clientWidth   // 0
```

---

## GATE 33 — Resolve colours through a canvas, never through a regex

**Phase 6, before reporting a single contrast number.**

Three separate contrast audits in this skill's history reported large numbers of failures
that did not exist, all from the same cause: a hand-written `parseColor` that special-cased
the syntaxes its author thought of.

| what the browser returned | what the parser did | phantom failures |
|---|---|---|
| `color(srgb 0.95 0.94 0.92)` | read 0-1 floats as 0-255 → near-black | 18 |
| `oklab(0.953803 0.00216 0.01177 / 0.92)` | matched no branch, first 3 numbers as RGB | 28 |
| `rgba(0,0,0,0)` on a translucent ground | fell back to white | 31 |

The third one is the dangerous shape: legible dark-on-paper nav text measured **1.21:1**,
and the report read as a serious accessibility failure. Acting on it would have darkened
text that was already correct.

Modern engines return `oklab()`, `oklch()`, `color()`, `lab()`, `color-mix()` results and
relative-colour syntax from `getComputedStyle`. You will not keep up with a regex.

**Let the browser do the conversion. It already has a complete parser:**

```js
const _cc = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function parseColor(s) {
  const t = String(s || "").trim();
  if (!t || t === "none" || t === "transparent") return null;
  let alpha = 1;
  const slash = t.match(/\/\s*([\d.]+%?)\s*\)/);
  if (slash) alpha = slash[1].endsWith("%") ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
  else if (/^rgba?\(/i.test(t)) { const n = t.match(/-?[\d.]+/g) || []; if (n.length > 3) alpha = parseFloat(n[3]); }
  _cc.fillStyle = "#000";
  _cc.fillStyle = t;                       // invalid values leave it at #000
  _cc.fillRect(0, 0, 1, 1);
  const d = _cc.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], alpha];        // always sRGB 0-255
}
```

Cache by string — a full-page sweep asks for the same twenty colours hundreds of times.

**Pass condition, run BEFORE trusting any failure list:**

```js
["#8A7F70", "rgb(138,127,112)", "oklab(0.95 0.002 0.012 / 0.92)", "color(srgb 0.95 0.94 0.92)",
 "color-mix(in oklab, #A8412A 8%, transparent)"].map(parseColor)
// every entry non-null, every channel 0-255, none silently [0,0,0]
```

If a contrast run reports failures on text you can plainly read in a screenshot, **the
parser is the suspect, not the page.** This is Gate 24 with a specific culprit.

---

## GATE 34 — A hidden tab does not composite, so transitions never finish

**Phase 6. This produced four separate wrong conclusions in one session.**

When the automation tab is not fronted, `document.visibilityState === "hidden"` and the
rendering pipeline is paused. Everything that depends on a frame silently stops:

| what stops | how it misreads |
|---|---|
| CSS transitions | transitioned properties read their **start** value forever |
| `requestAnimationFrame` | callbacks never run — see the latch below |
| `IntersectionObserver` | entries never deliver → "the observer is broken" |
| `computer{screenshot}` | returns a **stale composited frame**, not current state |

Concretely, all four in one build: a scroll-driven nav reported `flag: "top"` at
`scrollY: 9000`; a FAB that was correctly hidden reported `opacity: 1`; and a screenshot
showed the navbar still on screen *after* the DOM attribute had already flipped to
`retracted`. Every one of them was the harness. The page was correct throughout.

**Separate the two halves before concluding anything:**

1. **Does the CSS produce the right result?** Set the state attribute by hand, inject a
   transition-kill sheet, measure every combination:
   ```js
   const kill = document.createElement('style');
   kill.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
   document.head.appendChild(kill);
   for (const [nav, overlay] of [['top','closed'],['retracted','closed'],['retracted','open']]) { ... }
   ```
2. **Does the driver fire?** Only a **real gesture** proves this. `window.scrollTo()` called
   from an injected eval context does not dispatch a `scroll` event in every harness —
   a probe listener counted **0** events after `scrollTo(0, 900)` moved the page. Either
   drive a real scroll, or `window.dispatchEvent(new Event('scroll'))` explicitly, and
   front the tab first.

**Never report "the JS doesn't work" from a background tab.** Front it, or test the halves
separately.

### The latch this exposes — do not gate state on a rAF flag

```js
let queued = false;
addEventListener('scroll', () => {                  // BROKEN
  if (queued) return;
  queued = true;
  requestAnimationFrame(sync);                      // clears `queued` — inside the frame
});
```

In a tab that never paints, the frame never arrives, `queued` is never cleared, and the
component is stuck in whatever state it last held. It is not only a test artefact: a
backgrounded or restored tab hits it for real. Either do the work inline (a guarded
attribute write is cheap), or clear the guard outside the callback.

```js
function setNavState(retracted) {
  const next = retracted ? 'retracted' : 'top';
  if (document.body.dataset.nav !== next) document.body.dataset.nav = next;  // no latch
}
new IntersectionObserver(e => setNavState(!e[e.length-1].isIntersecting)).observe(sentinel);
addEventListener('scroll', () => setNavState(scrollY > 130), { passive: true });
```

---

## GATE 35 — The moment a control gains a second instance, every write must target the SET

**Phase 5, whenever a component appears in more than one place.**

A cart badge lived at `getElementById('cart-badge')`. A second cart button was added for
mobile, carrying its own badge. Every `renderBadge()` call kept updating exactly one of
them — the mobile badge sat at `0` while the bag held four items.

This passes every per-element check ever written. The element exists, it is visible, it has
the right styles. It is simply never written to.

```js
const badges = document.querySelectorAll('[data-cart-badge]');   // the SET
function renderBadge() {
  const n = itemCount();
  badges.forEach(b => { b.textContent = String(n); b.dataset.empty = n === 0 ? 'true' : 'false'; });
}
```

Same rule for the handler — bind by attribute, not by id:

```js
document.querySelectorAll('[data-cart-open]').forEach(b => b.addEventListener('click', open));
```

**Pass condition — exercise from EACH instance, and assert on all of them:**

```js
document.querySelector('.cart-fab').click();                     // the new one, not the original
[...document.querySelectorAll('[data-cart-badge]')].map(b => b.textContent)   // ['4','4']
```

This is Gate 4's "check the set, not each item" applied to behaviour instead of assets.
Whenever you duplicate a component, grep the file for `getElementById` naming any part of
it — each hit is a write that now covers half the instances.

### And while you are there: disabled is exempt from WCAG, not exempt from being readable

A drawer's checkout button inherited `color: #fff` from its enabled rule and put it over a
pale disabled tint: **1.73:1**. WCAG 1.4.3 excuses disabled controls, so no audit that
filters on the spec will ever flag it, and it is still an unreadable button on screen.
Give the disabled state its own colour pair — outline plus muted label reads as "off" and
measures 5.30:1.

---

## GATE 36 — A fresh deploy's first requests are cold starts, not 404s

**Phase 7, every time, before reporting anything about a live host.**

Straight after a deploy returned `status: running`, an asset sweep printed:

```
MISSING 000 images/bag_01_yirgacheffe-1254.jpg
MISSING 000 images/bag_01_yirgacheffe-520.webp
... 10 of them, and the root document too
```

Every one of those files was present and correct. The container was still booting;
`curl` gave up before it answered. **`000` is not an HTTP status — it is "no response".**
Reported as-is it reads as a broken deploy, and the obvious next move is to go rebuild
something that was never wrong.

The tell is in the numbers: the failures were the *first* requests in alphabetical order,
and the count was small and contiguous. A real missing-asset problem does not politely
confine itself to the first ten entries.

**Warm the host, then sweep, and treat only a real 4xx/5xx as a defect:**

```bash
# warm-up: burn the cold start on the document, with a generous timeout
for i in 1 2 3; do curl -s -m 30 -o /dev/null -w "%{http_code}\n" "$URL/"; done

# now sweep, and RETRY anything that is not 200 before believing it
code=$(curl -s -m 25 -o /dev/null -w "%{http_code}" "$URL/$a")
if [ "$code" != "200" ]; then
  sleep 2
  code=$(curl -s -m 25 -o /dev/null -w "%{http_code}" "$URL/$a")   # second opinion
fi
```

**Pass condition — report all three, not just the last:**

```
root: 200, served bytes == local bytes
assets: N checked, 0 non-200 after retry
served index.html byte-identical to the deploy folder's
```

The byte-comparison is the one that actually proves the *new* build is live. A 200 only
proves *something* is there — on a redeploy that is frequently the previous version.

---

## GATE 37 — A rejected push means YOUR clone is stale. Never resolve it with force.

**Phase 7. This is the one that destroys the user's work, so it outranks convenience.**

A push to the skills repo was rejected as non-fast-forward. The local clone was **seven
commits behind** — it had been left stale by an earlier session, and the working tree had
just been overwritten wholesale with a fresh sync of the live skill folder.

Everything about that situation argues for `--force`: the local tree is newer, it is a
strict superset of the content, and the remote "only" has old commits. **All three of
those things were true and force would still have destroyed seven commits of the user's
history**, including work from sessions this one never saw.

`git status` is silent about this. A clone that has not fetched believes it is current.

**The rule: a non-fast-forward rejection is information about you, not an obstacle.**

```bash
git fetch origin main
git log --oneline HEAD..origin/main        # what the remote has that you lack — READ IT
git diff --stat HEAD...origin/main         # and what those commits touched
```

Then rebuild your commit **on top of** the remote, so nothing upstream is discarded:

```bash
git reset --hard origin/main               # adopt the remote history wholesale
<re-apply your changes over it>            # a re-sync, or `git cherry-pick`
git add -A && git commit
git push origin main                       # a normal fast-forward
```

After the re-sync the staged diff shrinks to exactly your own new work — 33 files became
4. **That shrinkage is the proof you had nothing to force over.** If a full-tree sync
still shows dozens of changed files after resetting to the remote, you are about to
overwrite someone else's commits with a stale copy; stop and diff them one by one.

**Never pass `--force` or `--force-with-lease` to resolve a rejected push unless the user
has explicitly asked for that specific history to be discarded.** Rewriting published
history is not a merge strategy.

**Pass condition:**

```bash
git ls-remote origin main        # must equal
git rev-parse HEAD               # this, after a push with no --force
```

And confirm the push output shows a fast-forward range (`dfe8caa..36940eb`), never a
forced update (`+ dfe8caa...36940eb (forced update)`).

---

## GATE 38 — A named genre is not a design direction

**Phase 0 and Phase 1. Before a single mockup prompt is written.**

The user's standing brief, stated more than once across sessions: a visitor should be
**surprised**. Competent and familiar is the failure mode, not the safe option.

This skill actively worked against that. `01-discovery-interview.md` instructed:

> *"Offer **named classes** and let them choose: developer-tool minimal, Swiss editorial,
> motion showcase, premium consumer, technical credibility."*

Every option there is a famous look. Handing the user that menu guarantees the one outcome
they have said they do not want, and it did — the instruction survived several sessions of
"make the skill better" because nobody was checking the *interview*, only the build.

**Forbidden as a design direction:** editorial, Swiss, brutalist, neo-brutalist, punk,
glassmorphism, dark-tech, minimal, premium-consumer, luxury-hospitality, or any other
recognisable genre executed faithfully. They are vocabulary for *talking* about design
(`10-reference-and-components.md` §3), never the design itself.

### And never in a label the user reads

The "vocabulary for talking about design" clause was too loose, and a live run showed how.
A mockup went out labelled:

> *"Variant B — The Grid of Nights **(editorial index)**"* … *"A **newspaper-style editorial
> page**"*

The device under it was fine — the week's schedule rendered as a dense typographic index.
It had simply been *named* with one of the genres this gate bans. The user read the label,
not the reasoning, and immediately asked whether the rule was being followed. They were
right to.

**So the line is drawn at the surface, not at the intent.** A genre word may appear in your
private reasoning. It may never appear in:

- a variant name or heading
- a section label, eyebrow or pill
- the one-line description you present with a mockup
- anything else the user reads

Describe the device instead: *"the week's schedule as a dense typographic index"* says what
it is, is specific to this subject, and cannot be mistaken for a style off a shelf.

**Mechanical check before you send any Phase 1 presentation:**

```bash
grep -inE "editorial|swiss|brutalis|punk|glassmorph|minimal|premium.consumer|dark.tech" <your reply>
```

Any hit in a label is a rename, not a debate.

### The check

The Phase 0 preamble gains two lines, and both must be non-empty before Phase 1 starts:

```
Signature device : <the one thing that would look absurd on a competitor's site>
Category default : <what every other site in this category does> -> <what I did instead>
```

`Signature device` must be **load-bearing and derived from what the subject actually
does**, not decoration. "Warm palette" is not a device. "The scroll indicator is the
3-minute round clock, because that is how the gym is organised" is.

### The pass condition, and it is mechanical

> Take the finished mockup or page. Swap the logo and the copy for a different business in
> the same category. Does it still look right?

- **Still looks right → FAIL.** It is a template. Go back to `11-taste.md` §1.5.
- **Now looks wrong → PASS.** The design is carrying something specific to this subject.

Run it on the **mockup**, at Phase 2, before any build work. A generic mockup cannot be
rescued in CSS, and by Phase 5 the cost of finding out is a whole build.

### The tell in your own prompt

Grep the mockup prompt you are about to send. If the aesthetic is described **entirely** in
adjectives and genre names, with no sentence that could only be true of this one subject,
the mockup will come back generic. Add the device to the prompt explicitly and describe how
it appears on screen.

### The limit

Distinctive is not licence to break the page. Contrast, reduced motion, all states,
keyboard access and the reveal contract still bind. A device that strands content or hides
the primary action fails Gates 1, 2 and 23 regardless of how striking it is. **The surprise
is in the idea, never in making the page harder to use.**

---

## GATE 39 — Two mockups minimum, and the USER picks

**Phase 1. Standing instruction from the user, not a judgement call.**

> Every new website and every redesign produces **at least 2 visibly different mockups**,
> shown to the user, and **the user chooses.**

`02-mockup-prompt.md` §0.8 used to make this conditional (*"when the job is hard"*, five
qualifying conditions) and then handed the decision to the agent (*"put them side by side
and **pick** with a written reason"*). Both halves were wrong. The user had asked for
options on every build, and choosing between design directions is the one decision that is
genuinely theirs — showing someone your pick after the fact is not a choice.

**Pass condition, all four:**

```
1. count(mockup images generated)  >= 2      (3 when high-stakes or unsure; 1 ONLY when
                                              the user supplied a reference of the NEW
                                              design or explicitly asked for one)
2. all of them presented to the user, same size, side by side
3. each carries one line: what it does well, what it costs
4. a recommendation is given AND the reply ends by asking which to build
```

Then **stop.** Do not enter Phase 2 on your own pick. If the user is unavailable and work
must continue, name the one you proceeded with and why, in the open, so it stays reversible.

### Coded previews are NOT mockups. This is how the gate gets bypassed.

On a Discord-community build the agent wrote **four coded HTML previews**, each a real
rendered hero with palette, type and a signature device, presented them side by side, and
let the user choose. It looked like a textbook Gate 39 pass. It was a bypass: the user came
back with *"our skill didn't generate any image mockups… you're meant to be building mockup
images, then building the site based off the mockup."*

The substitution is seductive precisely because the artefact is *better* in some ways —
it's real, it runs, it's already half the build. That is the problem. Composition decisions
you have to hand-write are decisions you already made; the entire value of Phase 1 is
reacting to a hundred choices **an image model made that you would not have**. A coded
preview can only contain what you already thought of.

It also silently collapses two phases: once four previews exist, the build has effectively
started, and the user is choosing between things you built rather than directions you
proposed.

**Pass condition is literal:** `count(image files generated by an image model) >= 2`.
Rendered HTML, screenshots of rendered HTML, Figma-style descriptions and ASCII layouts all
score **zero**. If no image model is reachable, say so and ask how to proceed — do not
substitute.

### The options must differ in the right way

**Different DEVICES are the good case.** This section originally demanded "a different
staging of the same signature device", and a live run did better than the rule: asked for a
cinema, it produced *The Projection Cone* (a light beam as the page's diagonal axis), *The
Grid of Nights* (the week's schedule as a dense typographic index) and *The Showtime Ladder*
(the hero IS the showtime list — giant time numerals, each with a Reserve button). Three
ideas, not three dressings of one. The user picked the third, a device the other two did not
share — a choice the rule as written would have prevented from existing.

At Phase 1 the *idea* is what is still open, so that is what the variants should explore.
Restaging one device is the narrower question and belongs later, if at all.

What must still hold:

- **Hold the section list, the copy and the palette identical.** Vary the idea, not five
  things at once, or the comparison teaches nothing about why one won.
- **Never a genre.** Three genres is the banned menu (Gate 38) with extra steps.
- **Name each device concretely**, so the user is choosing between things they can picture.

**Two checks before you send:**

1. If you can describe the difference between your mockups using only genre words
   ("A is editorial, B is brutalist"), you built a menu, not options. Regenerate.
2. **Grep your own presentation text for genre words before sending it.** In the run above
   Variant B went out labelled *"The Grid of Nights (editorial index)"* and described as *"a
   newspaper-style editorial page"*. The device underneath was legitimate; it had simply been
   labelled with one of the exact genres Gate 38 bans. The user noticed immediately and asked
   whether the rule was being followed. Genre words are for your own reasoning — never for a
   heading, a label, or a variant name the user reads.

### The count is mechanical

`scripts/check-mockups.cjs` counts prompts and rendered masters and reports both. It fails on
fewer than 2 masters, and on any prompt that never rendered — "three mockups" in the
transcript with two files on disk means the choice was made from an incomplete set.

It cannot see whether you actually showed them and asked, and it says so rather than
implying otherwise. That half is still yours.

A single mockup is legitimate when the user supplied a reference of the new design or asked
for one. Record it in the project so the exception is visible rather than remembered:

```bash
echo "user supplied a reference image of the new design" > scratch/.one-mockup
```

### Do not average them

Blending mockups produces the mush that having a mockup was supposed to prevent. Build the
chosen one, then graft **one** named idea from a loser and say what you took.

---

## GATE 40 — A rule that lives in two places is already stale in one of them

**Any time you change a rule. Verify at the surface that EXECUTES it, not the file you edited.**

Gate 39 was written into `02-mockup-prompt.md`, `07-failure-gates.md`,
`09-phase-entry-checks.md` and `SKILL.md`. All four correct. Then a live prompt was sent
through the dashboard and the agent answered:

> *"The skill requires exactly one mockup per new website. There is no 'choose between
> them' step; you don't pick from options."*

Confidently, and completely wrong. The dashboard builds its own `--append-system-prompt`
that **restates the pipeline in its own words**, and that copy still said *"write
scratch/prompts/_mockup.txt … then call generate_mockup"* — singular, one file, one image.
The agent obeyed the copy in front of it, which is the correct thing for it to do.

Three places held the same rule and only one was updated:

| Surface | Held | Was updated |
|---|---|---|
| `references/*.md` | the real rule | yes |
| dashboard `SYSTEM` prompt | a paraphrase of the pipeline | **no** |
| MCP tool `description` | a paraphrase of the same pipeline | **no** |
| dashboard job plumbing | `["_mockup"]` hardcoded, `s !== "_mockup"` filter | **no** |

The plumbing is the quiet one: even with both prompts fixed, `jobGenerate(path,
["_mockup"])` would have rendered **neither** `_mockup_a` nor `_mockup_b`, and the
sweep filter `s !== "_mockup"` would have let both variants through into the shipped
image set.

**The check, and it is not optional after a rule change:**

```
1. grep every surface for the OLD rule, not just the file you edited:
     references/  SKILL.md  dashboard/server.mjs  dashboard/mcp/*.mjs  scripts/
2. ask the running system, in its own words, what the rule is
3. compare its answer to the rule you wrote
```

Step 2 is the one that catches it. A file diff cannot: every file you looked at was right.

**Prefer one source over synchronised copies.** Where a paraphrase genuinely has to exist
(an MCP tool description the model reads before it can open a file), keep it to the
*trigger* and point at the reference for the substance — a short pointer goes stale far
less often than a restated rule.

---

## GATE 41 — The mockup cannot carry behaviour. Write a FUNCTIONAL CONTRACT.

**Phase 0, and re-read it at Phase 5 and Phase 6. This is the most expensive gap
this skill has.**

A cinema build was briefed, verbatim: *"connected to a open source API which will
display available movies"*, *"Find some open source api thats best TMDB"*,
*"showtimes from API"*, *"all frontend no backend functionality"*, *"primary action
book a ticket"*.

What shipped:

| Brief | Delivered |
|---|---|
| fetch real films from TMDB | a monospace pill reading `TMDB metadata` and a footer line `Powered by TMDB` |
| primary action: book a ticket | a seat map with `selectedSet = new Set(['F7','F8','F9'])` hardcoded, **no click handler on any seat**, a summary in static HTML, and a `Confirm booking` button with no listener |
| all frontend, no backend | never reached the build session at all |

**Both failures have one cause, and it is structural, not carelessness.** Phase 1
turns the brief into an *image* prompt. Phase 2 extracts the design system *from
that image*. A functional requirement has no visual form, so it survives only as
the thing it looks like — a credit line, a picture of a seat map — and by Phase 5
the requirement itself is gone. **The build satisfied the mockup completely and the
brief not at all**, which is precisely why it passed every visual check and looked
finished in a screenshot.

### The contract

The interview must emit this, in the reply, as text that travels **beside** the
mockup and is re-read before building:

```
FUNCTIONAL CONTRACT
  data        : real API | static fixtures | invented
  if real     : which provider, called from client or server, how the key is held
  backend     : yes | no
  interactions: every control that must DO something, one line each
  deploy      : target, or "local only"
```

`interactions` is the line that would have caught the dead seat map. Write it as
verbs the user can perform: *"pick seats and see the price update"*, *"complete a
booking and get a confirmation"*. Anything not on that list is decoration and may
legitimately be a picture; anything on it must work.

### Two hard rules that fall out of it

1. **A page may not display a provider's name, logo, or "Powered by X" unless it
   actually consumes X.** Attribution is a factual claim about where the data came
   from. Printing it over invented data is fabrication, banned by SKILL.md §4.3,
   and worse than omitting the credit entirely.
2. **"Renders" is not "works".** A control that looks right and has no listener is
   a defect at full severity, not a polish item.

### Pass condition, at Phase 6

Exercise every line of `interactions` in the browser and report a number:

```js
// for each interaction, prove the state actually changed
document.querySelector('.seat:not(.taken)').click();
({ selected: document.querySelectorAll('.seat.selected').length,   // must be > 0
   totalChanged: document.getElementById('summary-total').textContent })
```

`interactionsSpecified` vs `interactionsProven` must be equal, and both reported.
A brief that named a primary action and a build where that action does nothing is
the loudest possible failure, and it shipped because nobody asked the page to do
anything.

---

## GATE 42 — A tool's own caveat is part of its result

**Phase 6, and any time a script's output is summarised for a human.**

A deployed page carried **48 AA contrast failures** measured against rendered
pixels. The pipeline reported `gates ok 5/5`. Three things had to go right for that
to happen, and all three did:

1. `check-contrast.cjs` is a **static** token-pair checker. It exits 0, so the step
   renders `ok` — while its own stdout says, in as many words:
   > *"NOT COVERED HERE: text over photographs, gradients, color-mix() or any
   > translucent ground. Those need the rendered-pixel pass. **Do not report
   > 'contrast OK' on the strength of this file alone.**"*
2. It **did** report `unsafe pairs : 2`. The runner's summary regex matched only
   `MISSING|CORRUPT|UNUSED|faults`, so that count was silently dropped.
3. `scripts/audit.browser.js` — the rendered-pixel pass that catches all 48 — was
   never in the gates set. **The pipeline owned the right tool and never ran it.**

The script did its job perfectly. The harness threw away the part that mattered.

**Rules:**

- **Exit code is not a verdict.** A script that exits 0 while printing a non-zero
  count of anything has not passed. Parse the counts, or do not claim a pass.
- **A limitation printed by a tool must reach whoever reads the result.** If it
  says it cannot see X, the report must say X was not checked. Silence reads as
  "checked and fine".
- **A summariser must fail loudly on output it does not recognise.** A regex that
  matches nothing must not render as "passed" — it must render as "unparsed".
- **If the repo contains a stronger check for the same property, the weak one may
  not stand in for it.** Static contrast can accompany the rendered-pixel pass; it
  can never replace it. SKILL.md §6 requires contrast against **rendered pixels**.

**Pass condition:** for every gate, report `name: <numbers it produced>` and
`notCovered: <its own stated limits>`. A gate line with no numbers is not evidence.

---

## GATE 43 — A deploy folder must be RUNNABLE, not merely complete

**Phase 7.**

`stage` reported `ok ... passed` and the site returned **404** from the host's
router. The staged folder was:

```
runtime files : index.html                              <- the failing project
runtime files : index.html, serve.mjs, package.json     <- a project that deploys
```

No server, no `package.json`, so the buildpack produced a container that never
listened on a port and there was nothing to route. Gate 26 checks
`referenced === copied` — that every **asset** arrived. **It never asks whether the
folder can run.** A deploy folder has two requirements and only one was gated.

**Extend the stage check to assert a runtime, and report it like the asset count:**

```
referenced === copied, 0 missing          <- Gate 26, keep
runtime: package.json + start script + the file it runs   <- Gate 43, new
```

Fail staging when the folder has neither a start script nor an explicit
static-host marker. Scaffolding must create these for **every** new project — the
failing one was scaffolded without them while its sibling had them, which is how
the gap survived unnoticed.

### And implement Gate 36 rather than writing it down again

The same deploy reported `fail` three times at `verify live`, **14 seconds after
upload**, while the host was still building. The URL served 200 on a later retry.
Gate 36 says exactly this — warm the host, retry every non-200 before believing it
— and it was written into this file that morning and **never implemented in the
deploy code**. SKILL.md §4.6: a prose rule is not a control. Poll until 200 or a
real timeout (90s+), retry once, and only then sweep the assets.

**Pass condition:**

```
root 200, served bytes == built bytes, assets N checked / 0 non-200 after retry
```

---

## GATE 44 — State derived from events must reconcile against authority

**Any long-running UI or agent loop.**

Three separate stalls in one session, all the same shape:

| Symptom | Cause |
|---|---|
| Send button dead, UI claimed "working…", only escape was a reload | `busy` was set by an event and cleared **only** by a `chat:done` event that a server restart meant never arrived |
| Agent "stuck", actually not running at all | stopping a job killed the chat that launched it; nothing said so |
| Conversation lost its entire brief | the session id lived in an in-memory Map and a restart orphaned a transcript that was still on disk |

In every case **the authority knew the truth the whole time** — the server knew no
job was running, the session file was on disk — and the client never asked.

**Rules:**

- An event stream is a *notification channel*, never a source of truth. Any state
  derived from events needs a periodic reconcile against the authoritative source.
- **Any lock must have a path out that does not require a restart or reload.** If
  the only recovery is "refresh", the recovery will destroy something else — here
  it destroyed the visible conversation, because the transcript lived only in the
  DOM.
- **Anything a restart can orphan must be persisted**, and recoverable from the
  underlying artefact if the pointer is lost.
- **A stopped or killed unit must say so where the user is looking.** Silence is
  read as "still working", and the user waits indefinitely.

**Pass condition:** kill the server mid-turn, reload nothing, and confirm the UI
returns to a usable state on its own within one reconcile interval, with the
history intact.

---

## GATE 45 — Placeholder data must satisfy the features that consume it

**Phase 5, wherever fake data is generated.**

A cinema seat map marked seats as sold with:

```js
const isTaken = (r, c) => ((r * 7 + c * 3) % 5) < 2;   // "random-looking"
```

It renders beautifully. It is also the **least random distribution available**: a
modular expression takes exactly 2 of every 5 seats on a fixed cycle, spreading
them as evenly as arithmetic allows. Measured across the whole room, **the longest
run of adjacent free seats was 2.** Three friends could not sit together anywhere,
in any row.

Nothing revealed this while the map was only *displayed*. It surfaced the moment a
feature depended on the distribution — a "best available" button correctly reported
that no block of three existed, and read as broken code. It was not; the room was
genuinely unbookable.

**The rule: fake data has to satisfy every feature that reads it, not just look
plausible in a screenshot.**

| Looks fine | Breaks the moment something depends on it |
|---|---|
| `(i * 7) % 5 < 2` | evenly spread; no runs, no clusters, no gaps |
| `i % 3 === 0` | perfectly periodic; every third item identical |
| all names 8-12 chars | no wrapping ever tested |
| every price €X.99 | column alignment never stressed |
| all dates this month | no year boundary, no different month lengths |

**Use a hash for deterministic pseudo-randomness, and weight it if the domain has
a shape:**

```js
const h = Math.sin(r * 127.1 + c * 311.7) * 43758.5453;
const v = h - Math.floor(h);                   // 0..1, stable per seat
const density = 0.14 + 0.30 * closenessToMiddle;   // front rows sell last
return v < density;
```

Deterministic matters separately: data that reshuffles on every reload makes a page
look broken and makes a bug impossible to reproduce.

**Pass condition — assert the property your features need, and report it:**

```js
// for a seat map that offers "best available for N"
longestFreeRun >= maxPartySize        // measured across every row
rowsOffering(3) > 0                   // and print the number
```

Generalise it: whatever a feature asks of the data — the longest run, the widest
string, the largest number, an empty case, a duplicate — assert that the generator
actually produces it. **A screenshot cannot tell you your fake data is degenerate.**

---

## GATE 46 — Line-height is a function of the SCRIPT, not of taste

**Phase 5, the moment display type is set. Non-negotiable for any non-English copy.**

A Polish landing page shipped headings at `line-height:.94` — a perfectly normal display
setting, and correct for English capitals. Polish capitals do not fit in it. The user
reported the hero as "text looks improper" and asked to **delete the diacritic**, spelling
`STAŻ` as `STAZ`. That would have shipped a spelling error on the client's own homepage.

The cause is mechanical. In Polish, `Ż Ó Ś Ć Ń Ź` carry marks **above** cap height and
`Ą Ę` carry ogonki **below** the baseline. An English-caps line box has room for neither.
The same applies to Vietnamese (stacked diacritics, the worst case), Czech, Turkish,
Romanian, Greek and anything with combining marks.

Measured on the actual build:

| element | worst adjacent pair | required | had |
|---|---|---|---|
| h1 | `WBIJAJ RANGI.` / `NIE ZA STAŻ.` | 1.074em | 0.94 |
| h2 | `SERWER, NA KTÓRYM` / `AKTYWNOŚĆ MA ZNACZENIE.` | **1.224em** | 0.94 |
| h2 | `ZASADY,` / `KTÓRE MAJĄ SENS.` | **1.224em** | 0.94 |

Note what drives the worst case: a **comma** on the upper line meeting an **acute accent**
on the lower one. Neither is exotic. Neither is visible in a whole-string measurement.

**Measure per ADJACENT LINE PAIR, not per string.** Measuring the whole heading returned
82px for the rules headline because it summed the `Ó` ascent and the `Ą` descent — but the
`Ą` sits on the last line with nothing beneath it, so the real requirement was 71px.
Whole-string over-measures and pushes you to loosen type that did not need loosening.

```js
// canvas TextMetrics gives real ink extents, unlike font metrics
const need = ctx.measureText(LOWER).actualBoundingBoxAscent
           + ctx.measureText(UPPER).actualBoundingBoxDescent;
lineHeightPx >= need            // for EVERY adjacent pair, per element
```

**Pass condition:** every heading and every body block that can wrap reports positive
slack. Report the tightest number, not a pass/fail. Shipped values were h1 `1.14`
(slack +6.2px) and h2/h3 `1.26` (slack +2.1px), against a measured minimum of 1.224em.

`scripts/check-leading.browser.js` implements this. Run it at Phase 6.

### Gate on the copy that exists; report headroom separately

The first version of that script gated on the **worst mark stack the script could
produce** — an uppercase ogonek directly beneath an acute — and duly reported **3
collisions on a page that had already been measured correct**. The copy on that page never
puts `Ą` under `Ó`. A control that cries wolf gets switched off, so the two numbers are
now separate and only one of them fails a build:

| number | what it measures | is it a gate? |
|---|---|---|
| **collisions** | the lines the browser actually rendered, today | **yes** — a negative slack is a visible overlap |
| **headroom** | the worst stack the typeface could ever be asked to set | **no** — advisory |

Both are worth printing, because they say different things. On the shipped page:
`collisions 0, tightest slack +1.4px across 38 real pairs` — but
`headroom −18.3px on h1`. The page is correct **and** its hero has no room left: change
one word to something ending in `Ą` above a line starting with `Ó` and it collides. That
is a genuine warning, and it is not a defect.

> Generalises past leading. Whenever a check can be run against *actual state* or against
> *worst possible state*, run both and label them — but only ever gate on the actual. Gating
> on the hypothetical trains people to ignore the output.

> **The wider rule:** when a user reports text "looking wrong", find the typographic cause
> before accepting a copy change. The fix they propose is usually the cheapest thing they
> can see, not the thing that is broken. Deleting a letter to fix leading is a spelling
> bug traded for a layout bug.

---

## GATE 47 — One owner per animated property

**Phase 5, wherever JS writes a style that CSS also animates.**

Rank medallions tilted correctly, then "froze, went to initial state and got stuck for a
bit" — reliably, when the pointer was held still near the centre.

The element had a CSS keyframe animation on `transform` **and** JS writing
`element.style.transform` on pointermove. **CSS animations override inline styles.** The
guard was a class that disabled the animation, removed on a `setTimeout(560)` after
pointerleave — so entering, leaving and re-entering within 560ms let the stale timer fire
*while the pointer was inside*, the animation reclaimed `transform`, and the tilt died.
Holding still made it obvious only because no pointermove arrived to fight back.

Note what made this expensive to see: the transform WAS being computed and written
correctly the whole time. Logging the JS showed a healthy value. The bug lived entirely in
the cascade.

**The fix is structural, not a better timer.** Give the property exactly one writer:

- idle motion on a **different element** (the `<img>` inside the tilt wrapper), or
- drive idle + interactive from a **single rAF loop** that composes one transform string.

Pause with `animation-play-state`, never by toggling `animation` — play-state is a
different property, so it cannot contend for `transform` and cannot snap.

**Pass condition — replay the race, do not reason about it:**

```
enter → move → leave → re-enter within the guard window → hold motionless 900ms
assert: inline transform unchanged AND computed transform still a matrix3d
```

Any property written from both CSS animation and JS is this bug waiting. Grep for
`@keyframes` blocks touching `transform`, `opacity` or `filter` and confirm nothing writes
the same property inline.

---

## GATE 48 — An asset audit that reads markup cannot see paths built at runtime

**Phase 6, and again before any deploy.**

The reconcile script scanned both pages for `images/…` string literals and reported
**24 unused files**. All 24 were in use. Their paths were assembled in JS from a slug and a
width (`'images/' + slug + '-' + w + '.jpg'`), which no text scan can resolve.

The false positive is the harmless half. The same blindness means the audit **cannot
report those files MISSING either** — and that is a shipped broken image. It nearly
happened: client-supplied artwork had different native widths (one source was 1200px where
the rest were 1920 and 2025), so the hardcoded width list in JS pointed at four variants
the pipeline can never produce.

**Two rules:**

1. **The audit expands the same data the page expands.** Parse the widths out of the page's
   own structure rather than duplicating the list in the checker. A checker with its own
   copy of the truth drifts silently.
2. **Runtime-built widths are per-asset, never global.** Derive them from each master and
   store them beside the slug. A shared `[1000,1600,1920]` is Gate 3 wearing a disguise.

**Pass condition:** `MISSING: 0` **and** `UNUSED: 0`, with the count of runtime-expanded
paths printed so the number is auditable — `modal-lol[1000/1200]` is verifiable at a
glance; "22 files" is not.

---

## GATE 49 — Settle the page before you measure it

**Phase 6, before any measurement is allowed to become a defect report.**

Two false defects in one session, both from reading a value while the page was still
moving:

- Nav reported **broken** (`navHalves: false`, stuck at 44px) — measured at `scrollY: 23`,
  mid-flight through a `scroll-behavior:smooth` animation triggered by `scrollTo(0,0)`.
  The nav was correct: 72px at rest, 44px scrolled.
- **6 broken images** reported — measured before lazy-loading had fetched anything below
  the fold. Actual count after forcing load: 0.

Both would have been "fixed" by changing working code.

**Assert the precondition, then measure:**

```js
await document.fonts.ready;                       // type metrics are wrong before this
[...document.images].forEach(i => i.loading = 'eager');
await settleScroll(target);                       // poll until scrollY stops changing
await sleep(afterLastMutation);
```

`settleScroll` polls `scrollY` across frames until it stops changing — do not sleep a
guessed duration, and do not trust that `scrollTo` completed just because it returned.

**Pass condition:** every measurement script states the precondition it waited for. A
measurement with no settle step is not evidence, and a defect derived from one is not a
defect until it has been re-taken with the page at rest. This is Gate 24 upstream: re-run
in isolation, *after* settling.

---

## THE REPORTING RULE

When you claim something works, the claim must name **what** was measured and **what the
number was**. Not "verified responsive" but "0 horizontal overflow at 375/768/1024/1440/1920."

And when you have measured a container, say so explicitly — *"container measured; child
overflow checked separately"* — because the failure mode is not skipping measurement. It is
measuring one true thing and letting it stand in for a different claim.
