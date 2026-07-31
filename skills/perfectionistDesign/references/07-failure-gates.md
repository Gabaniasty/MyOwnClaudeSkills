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

**The fix, on the root:**

```css
html { overflow-x: clip; }     /* NOT hidden */
```

`clip` contains the overshoot without making `<html>` a scroll container. `hidden` makes
it one, and that silently breaks every `position: sticky` on the page — a much worse bug
than the one being fixed.

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

## THE REPORTING RULE

When you claim something works, the claim must name **what** was measured and **what the
number was**. Not "verified responsive" but "0 horizontal overflow at 375/768/1024/1440/1920."

And when you have measured a container, say so explicitly — *"container measured; child
overflow checked separately"* — because the failure mode is not skipping measurement. It is
measuring one true thing and letting it stand in for a different claim.
