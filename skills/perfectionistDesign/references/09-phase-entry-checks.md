# Phase Entry Checks

`07-failure-gates.md` is **forensic** — it explains defects after they exist. That is why it
kept failing to prevent them: in one session four rules from that file were each broken
*again* by the same agent that wrote them, because the file only gets opened once something
has already gone visibly wrong.

This file is **preventive**. It is short on purpose. Run the relevant block when you *enter*
a phase, before doing the work.

---

## Entering Phase 2 — analysing a mockup

**Do not look for sections. Inventory every visual element.**

Walk the mockup at **full resolution** and write down, per section:

```
section name
  ├─ background        photo? gradient? watermark? flat colour?
  ├─ icons             bespoke artwork, or generic glyphs?
  ├─ imagery           photos, illustrations, maps, avatars
  ├─ dividers/rules    vertical? horizontal? between what?
  ├─ badges/tags       colour-coded? per-item colour?
  └─ text layers       heading, body, meta, labels
```

Four separate misses in one build, every one a thing plainly visible in the mockup that was
never written down:
- a stats band whose **palm-silhouette background** was read as flat colour
- six category boards with **bespoke multi-coloured neon icons**, replaced by generic SVG
- four moderation **icons**, likewise replaced by generic SVG
- **vertical dividers** between the moderation items, omitted entirely

The section list was right every time. The *elements inside the sections* were not looked at.

**Crop at full resolution.** A 760px-wide slice of an 1824px mockup turns a photographed
plaster wall into flat sand and a neon icon into a grey blob. Downscale destroys exactly the
evidence you are hunting for.

**Ask per section: what is behind the text?** Flat colour is an *answer*, not a default.

---

## Entering Phase 3 — generating assets

Before the first `codex exec`:

- [ ] Written asset list exists, one line per asset, with a strategy each (`03` §3.15)
- [ ] Every small square asset — avatar, icon, badge — is **its own 1:1 generation**.
      No sheets, no grids, no montages. (Gate 13)
- [ ] Every prompt names the framing: *precisely centred, middle ~60%, even margins*
- [ ] Transparency needed? Generate on **flat chroma green**, key it out yourself.
      Do not rely on the bundled helper: it exits non-zero on an `--opaque-threshold`
      validation *after* succeeding, and sends codex into a retry loop.
- [ ] Launch is `Get-Content task.md -Raw | codex exec ...` with `run_in_background`.
      **Never `Start-Job` inside a foreground call** — the job dies when the call returns
      and the harness reports success. (Gate 7, broken twice.)

---

## Entering any "is it done yet?" check

**Doubt your check before you doubt the artefact.** Every single time this session that a
check reported absence or failure, the check was wrong and the artefact was fine:

| Reported | Reality |
|---|---|
| "Codex cannot generate images" | checked `codex plugin list` only; it is a **system skill** |
| "icons MISSING" | checked `_masters/`; they were written to `images/` |
| "stats band not deployed" | regex wanted `class="statsband"`, markup had `class="statsband rv"` |
| "deploy 404" | container restart window; 200 on the next poll |
| "codex failed, exit 255" | work completed; a post-success validation exited non-zero |
| "hidden without .js: 1" | sampled in the same frame as the class change |

So, in order:
1. Check **every plausible location**, not the one you expect.
2. A **non-zero exit is not evidence of a missing artefact** — go look for the artefact.
3. A **404 or a blank screenshot may be a timing window** — poll again before concluding.
4. Only after all three: conclude the thing is actually broken.

---

## Entering Phase 6 — verification

Two questions before you write a check:

**1. Am I measuring the property I am about to make a claim about?**
- Measuring a container proves nothing about its child. (5 of 9 escaped defects)
- Measuring `src` proves nothing about `srcset`.
- Measuring an accent on one ground proves nothing about another ground.
- Measuring an emblem's brightness centroid proves nothing about the *circle* the user sees.

**2. Am I checking each item, when the user will see a set?**

**Set-consistency is a separate check and it is the one that gets skipped.** Eight avatars
each passed a centring check while the set had a **14.4-point size spread** — one was
visibly smaller and the user spotted it immediately.

```js
// for any repeated visual element, measure the SET
const sizes = items.map(measure);
const mean = sizes.reduce((a,b)=>a+b)/sizes.length;
const spread = Math.max(...sizes) - Math.min(...sizes);
// spread > ~4% of mean => visibly inconsistent, normalise before shipping
```

Apply to: avatar diameters, icon bounding boxes, card heights, image aspect ratios, gap
rhythm, stroke weights.

---

## Entering Phase 7 — ship

- [ ] Staged copy audited, not the source folder
- [ ] Masters, mockups and task files excluded
- [ ] After deploy: **poll** for readiness before auditing (restart window)
- [ ] Live audit covers `srcset`, and magic numbers prove real bytes
- [ ] At least one placed asset downloaded from the live host and **opened**

---

## The one-line version

> Inventory every element, generate every small asset alone, doubt every failing check,
> measure the property you are claiming, and check the set as well as the item.
