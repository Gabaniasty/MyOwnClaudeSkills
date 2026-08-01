# Phase Entry Checks

`07-failure-gates.md` is **forensic** — it explains defects after they exist. That is why it
kept failing to prevent them: in one session four rules from that file were each broken
*again* by the same agent that wrote them, because the file only gets opened once something
has already gone visibly wrong.

This file is **preventive**. It is short on purpose. Run the relevant block when you *enter*
a phase, before doing the work.

---

## Entering Phase 0 — the interview (Gate 38)

**The standing brief is that a visitor should be SURPRISED.** Competent and familiar is the
failure mode here, not the safe option. This block exists because the interview file itself
used to instruct the opposite — it told you to offer a menu of five famous genres and let
the user pick one, which is a guaranteed forgettable page.

Before you ask anything:

- [ ] You are **not** about to offer a genre menu. Editorial, Swiss, brutalist, punk,
      glassmorphism, dark-tech, minimal, premium-consumer are **vocabulary for discussing**
      design, never answers to "what should this look like".
- [ ] If the user has no reference sites, you ask about the **subject** instead:
      what it does that its competitors don't; what a visitor should still be able to
      describe afterwards; what every other site in the category looks like.
- [ ] Any direction you offer carries a **device that would look absurd on a competitor's
      site**, and that device comes out of how the subject actually operates.

Leaving Phase 0 you must be able to fill both lines. Empty means go back:

```
Signature device : <load-bearing, specific to this subject>
Category default : <what everyone else does> -> <what I did instead>
```

> A colour palette is not a device. "Warm and premium" is not a device. "The scroll
> indicator is the 3-minute round clock, because that is how the gym is organised" is.

**And the limit:** distinctive never overrides contrast, reduced motion, all states,
keyboard access, or the reveal contract. Surprise lives in the idea, not in a page that is
harder to use.

---

## Entering Phase 1 — generating mockups (Gate 39)

**Standing instruction: at least 2 mockups, and the USER picks.** Not "when the job is
hard", not "when unsure" — every new website, every redesign.

- [ ] How many am I generating? **2 minimum.** 3 if the layout carries money, there are
      8+ sections, the brief is a feeling with no reference, or I am unsure. 1 **only** if
      the user supplied a reference image *of the new design* or explicitly asked for one.
- [ ] Do they differ as **stagings of the same signature device** (Gate 38), rather than as
      different genres? If I can only tell them apart with genre words, I built the banned
      menu again. Regenerate.
- [ ] Is exactly **one axis** varying, with section list, copy and palette identical? Two
      axes at once means the comparison teaches nothing.

Leaving Phase 1, before any extraction work:

- [ ] All of them shown to the user, **same size, side by side**
- [ ] One line each on what it does well and what it costs
- [ ] A recommendation given, clearly labelled as a recommendation
- [ ] The reply **ends by asking which one to build**, and then stops

> The old rule let the agent generate one, or generate several and then *pick* on the
> user's behalf. Showing someone your choice after the fact is not offering a choice.
> If the user genuinely cannot answer and work must continue, name the one you went with
> and why, in the open, so it stays reversible.

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

### Derive each plate's ASPECT from the box it will live in (Gate 19)

Do this before writing the prompt — it cannot be fixed later in CSS.

- [ ] For every `object-fit: cover` slot, compute `widestViewport / bandHeightThere`.
      Ask for **that** ratio and **at least** the widest viewport in pixels.
- [ ] A 1.43:1 plate in a 2.66:1 band is a **1.77× upscale** at 1920. That is the
      "it gets more zoomed in on bigger screens" complaint, decided at prompt time.
- [ ] If text will sit on the plate, say so in the prompt: name the half that must stay
      **bright, empty and evenly lit**. Doing this took one hero's scrim requirement from
      86% to zero.

### If you are REGENERATING (a palette change, a re-shoot) (Gate 18)

- [ ] Retire the old masters somewhere recoverable — do not delete until every replacement
      is confirmed.
- [ ] Delete **all derived variants** of each regenerated slug before reprocessing, or the
      srcset will mix generations and serve the old image at some viewport widths.
- [ ] The processing manifest and the srcset reconciler must both be **derived from what the
      document references**, and must cover every slug, not a prefix.
- [ ] Running workers in parallel? See Gate 27 — disarm the "newest file wins" fallback first.

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
| "4 hero contrast failures" | the audit had flipped `data-theme` and back, then read colours before repaint |
| "10 broken images" | all 10 were `loading="lazy"` and offscreen — not yet requested |
| "the chroma key failed, I can see green" | 0% opaque green; the viewer was painting alpha-0 pixels' leftover RGB |
| "your API key is rejected" | **my own repair script had overwritten it** with another project's stale key |

So, in order:
1. Check **every plausible location**, not the one you expect.
2. A **non-zero exit is not evidence of a missing artefact** — go look for the artefact.
3. A **404 or a blank screenshot may be a timing window** — poll again before concluding.
4. **Re-run the failing check in isolation.** If it passes alone, your harness is the bug —
   ordering, a mutated global, or a stale read. Say so plainly and fix the harness.
5. **Judge a transparent asset by measuring alpha, never by looking at it.** Viewers differ
   on how they paint alpha-0 pixels. `transparent %` and `opaque-green %` are the evidence.
6. Only after all five: conclude the thing is actually broken.

**And before you tell the user their input is at fault, prove it is not yours.** The single
most expensive error in this skill's history was reporting "your API key is invalid" when a
script of mine had silently replaced it (Gate 25). Re-read what you actually wrote, masked,
and compare it to what they actually gave you.

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

**Measure what RENDERS, not the box.** Under `object-fit: contain`, a shared box equalises
nothing: width binds on landscape assets, height binds on portrait ones, and a laptop
rendered 190px tall beside a 277px phone while every asset passed its own check (Gate 22).

**And re-derive the check when the assets change kind.** A set-consistency check inherited
from an earlier project measured the "paper" behind each subject — correct for opaque
renders, meaningless for chroma-keyed cutouts, where it would score perfect forever.

**3. Order the passes.** Pixel-sampling passes run FIRST; anything that mutates global state
(theme toggles, injected stylesheets, forced classes) runs LAST. A theme flip before a hero
pixel pass invented 4 failures that did not exist (Gate 24).

**4. Test animated things at their worst frame,** not at whatever phase a screenshot caught.
Pin the animation to its extreme, then measure (Gate 21).

---

## Entering Phase 7 — ship

- [ ] Staged copy audited, not the source folder
- [ ] Deploy folder **derived from the document's own references**, not hand-listed copy
      rules; assert `referenced === copied` and `missing = 0` (Gate 26)
- [ ] Masters, mockups, scratch and task files excluded — one working folder was 87.7 MB
      against an 18.1 MB site
- [ ] Any credential written to config: addressed by **exact key**, proven with a live
      authenticated call, printed **masked only** (Gate 25)
- [ ] Config written by a CLI: **read the file back** and confirm the key matches what the
      consumer reads (`B:\path` vs `B:/path` has already burned a session)
- [ ] After deploy: **poll** for readiness before auditing (restart window)
- [ ] Live audit covers `srcset`, and magic numbers prove real bytes
- [ ] Every referenced asset **HEAD-checked on the live host** — a deploy tool's success
      message is not evidence the page renders
- [ ] At least one placed asset downloaded from the live host and **opened**

---

## The one-line version

> Inventory every element, cut every plate to the box it will live in, generate every small
> asset alone, doubt every failing check before doubting the artefact, measure the property
> you are claiming on the pixels that actually render, and check the set as well as the item.
