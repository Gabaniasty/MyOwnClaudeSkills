---
name: perfectionistDesign
description: End-to-end pipeline for building any premium, real-feeling web project from nothing - marketing sites and landing pages, and also applications such as forums, dashboards, admin panels, booking systems, community sites and documentation portals. Covers discovery interview, mockup generation via Codex imagegen, spec extraction, photorealistic image generation, build, measurement-based verification with failure gates, deploy and git. Use when the user says they want to build a website, landing page, portfolio, brand site, forum, dashboard, web app or product UI, when they paste a design brief or reference screenshot, or when they invoke perfectionistDesign directly. Also use for redesigns.
---

# perfectionistDesign

> A production pipeline, not a style guide. It takes a vague idea ("I want a gym site")
> all the way to a verified, deployed, version-controlled page.
>
> It exists because five landing pages were shipped this way and every expensive mistake
> along the route is now encoded here as a rule. **The rules in `references/` are the
> actual value of this skill.** Do not skip them because the task feels simple.

---

## 0. THE ONE THING THAT MAKES THIS SKILL DIFFERENT

Most design work fails silently. A page looks fine in a screenshot and is broken in ways
nobody sees until a user hits it: text at 1.06:1 contrast over a photo, ten images clipped
invisible by a reveal animation, a WebP `<source>` 404ing with no fallback, a founder's head
cropped off at 1920px.

**Every visual claim this skill makes is backed by a measurement.** Not by looking. See
`references/05-verification-protocol.md`. If you cannot measure it, you do not claim it.

---

## 0.5 THE LOOP â€” this is the whole skill

Everything below is detail. **This is the shape:**

```
   describe the thing
        â†“
   DERIVE what this specific thing must prove      <- the only creative step
        â†“
   write the mockup prompt from that derivation
        â†“
   generate the mockup image (Codex imagegen)
        â†“
   measure it, extract the design system
        â†“
   build it
        â†“
   verify by measurement + failure gates
        â†“
   ship
```

**The loop runs once per page or screen.** A one-page site runs it once. A five-page site
runs it five times. A forum with a landing page, a category index and a thread view runs it
three times, passing the first mockup as `-i` to the others so the brand world holds.

**Nothing about the section list is fixed.** There is no template. Sections are derived at
step 2 from what the *subject* needs to prove, then confirmed by the mockup. That is why a
gym got transformations, a clinic got a smile gallery, a hotel got rooms â€” none of those
words appear anywhere in this skill.

> If you find yourself reaching for "hero, features, testimonials, CTA" without having
> derived it from the subject, you have skipped step 2 and are about to build a template.
> See `references/02-mockup-prompt.md` Â§0.

## 0.6 RUN THE PHASE ENTRY CHECKS

**`references/09-phase-entry-checks.md` is the most important file here.** Open the relevant
block when you *enter* a phase, before doing the work.

`07-failure-gates.md` is forensic — it explains defects once they exist. That is why, in the
session that produced it, **four of its own rules were broken again by the agent that wrote
them**: a gate you read at Phase 6 cannot prevent a mistake you make at Phase 3.

The five checks that catch the most, in one line each:

0. **The interview** — never offer a menu of famous genres. The bar is that a visitor is
   *surprised*; name a signature device that would look absurd on a competitor's site.
1. **Analysing a mockup** — inventory every *element* (backgrounds, icons, dividers, badges),
   not just sections. Crop at full resolution.
2. **Generating assets** — every small square asset is its own 1:1 image. Never a sheet.
3. **Any "is it done?" check** — doubt the check before the artefact. Absence and failure
   were misreported six times in one session; the artefact was fine every time.
4. **Verifying** — measure the property you are claiming, and check the **set**, not just
   each item.

## 1. TRIGGER AND FIRST MOVE

Fires on: "build me a X website", "landing page for X", "redesign this", a pasted brief,
a pasted reference screenshot, or `/perfectionistDesign`.

**First move is always the discovery interview.** Do not write code, do not pick colours,
do not open an editor. Run `references/01-discovery-interview.md`.

The interview uses AskUserQuestion in **at most two rounds** of up to 4 questions. It is
not a form. If the user's brief already answers something, do not ask it.

---

## 1.5 PICK THE TRACK BEFORE THE PHASES

Nothing in this skill hardcodes a section list. Sections are always derived from the mockup,
which is why a gym got transformations, a clinic got a smile gallery and a hotel got rooms.
**But there are two different kinds of thing to build, and they need different pipelines.**

| | **A page that is read** | **A screen that is used** |
|---|---|---|
| Examples | landing page, portfolio, brand site, forum *home* | forum *thread list*, dashboard, admin panel, inbox |
| Derive | sections that prove what the subject must prove | routes + components + **states** |
| Design source | one tall full-page mockup | one mockup per screen |
| Build | one self-contained HTML file | a real design system (`design-taste-frontend` 2.A) |
| Reference | phases below | **`references/08-application-track.md`** |

**Test:** does it have a logged-in state, a list of user-created records, or a form that
changes stored data? If yes, application track.

Mixed is normal and expected - a forum has a marketing home page *and* the forum. Run both
tracks and say which surface you are on. Phases 0, 3, 4, 6 and 7 are shared and identical.

> Do not run the marketing track on an application. It produces a brochure about the
> product instead of the product, and the failure is invisible until the user tries to use
> the thing.

## 2. PHASE MAP

Work through these in order. Announce which phase you are entering. Some are skippable
and the interview tells you which.

| # | Phase | Reference | Skippable when |
|---|---|---|---|
| 0 | Discovery interview | `01-discovery-interview.md` | never |
| 0.5 | Reference board + component choice | `10-reference-and-components.md` | never |
| 0.6 | Taste floor: design read, dials, anti-default check | `11-taste.md` | **never** |
| 1 | Mockup generation | `02-mockup-prompt.md` | **NEVER on a redesign.** Only when the user supplies a mockup *of the new design* |
| 2 | Spec extraction | `02-mockup-prompt.md` | user pasted a full written spec |

> **Phase 1 is not skippable on a redesign, and an existing site is not a reference.**
> The old site is the thing being replaced. Treating it as the "reference image" that
> satisfies Phase 1 is what produces a recoloured clone. See §4.7 and Gate 15.
| 3 | Imagery | `03-image-generation.md` | user supplies their own photography |
| 4 | Asset pipeline | `03-image-generation.md` | no local images |
| 5 | Build | `04-build-standards.md` | never |
| 6 | Verification | `05-verification-protocol.md` | never |
| 7 | Ship: deploy + git | `06-ship-deploy-git.md` | user said local only |

**Phases 1-3 have two routes. Ask which, or read it from the request.**

- **Automated (default when the user says "automate" or "use codex").** Codex CLI's
  `imagegen` system skill generates the mockup and every section image via `codex exec`.
  No API key â€” the user's ChatGPT auth covers it. See `03-image-generation.md` Â§3.1.
- **Interactive.** Hand the user prompts to paste into ChatGPT's web UI. Slower, but they
  art-direct each image conversationally. See `02-mockup-prompt.md`.

Either way the *principle* holds: a mockup drawn by an image model is a far better brief
than anything either of you writes from scratch, because it makes a hundred composition
decisions neither of you would think to specify. Do not skip the mockup and build from a
text brief.

> `codex plugin list` does **not** show `imagegen` â€” it is a system skill at
> `$CODEX_HOME/skills/.system/imagegen`, not a marketplace plugin. Checking only the plugin
> list once produced a confident, wrong "Codex cannot generate images". Verify by listing
> that path.

### 2.1 Route the job before you route the phases

The phase list above is the same list every time. **Which phases are load-bearing is not.**
Read the request, name the job out loud in one line, then run the matching column. If the
request is ambiguous between two of these, that is a Phase 0 question, not a guess.

| | **From nothing** | **Redesign** | **Re-skin / change request** |
|---|---|---|---|
| Sounds like | "a landing page for a business-class airline" | "redesign example-client.com" | "make the branding orange", "fix the work section" |
| Phase 0 | full interview | full interview **plus** what to keep: logo, name, real customers, real projects | one question at most; do not re-interview |
| Phase 0.5 | reference board from award-winning work in that class | same, and it must diverge from the ORIGINAL | skip |
| Phase 1 mockup | **yes** | **yes — never treat the old site as the mockup** | no |
| Phase 3 imagery | generate everything | generate everything | **regenerate only what the change invalidates** |
| Gates that bind | 4, 5, 13, 19 | 15, 16, 19 | **18** above all, then re-run the full set |

**The third column is the one this skill kept getting wrong.** A change request feels small,
so it invites skipping the pipeline — and that is exactly when a stale asset survives. A
palette change invalidates *every generated image*, which means 34 regenerations, a full
variant purge, a srcset reconcile and the entire gate set re-run. See Gate 18.

**A change request never re-opens settled decisions.** If the user asks for orange, change
the palette; do not also re-cut the layout, re-pick the type, or re-litigate a section they
approved three turns ago. Fix what was asked, verify the whole page, report both.

**Derive the sections from the subject, every time.** A business-class airline needs cabin,
route map, fare classes, lounge, loyalty. A rescue consultancy needs the failure state, the
diagnosis, the work, the process. Neither section list appears anywhere in this skill,
and neither should be reachable by reflex — they come out of Phase 0 and the mockup.

---

## 3. COMPOSE WITH THE INSTALLED SKILLS

This skill orchestrates; it does not duplicate. Pull these in at the right moment:

- **`design-taste-frontend`** - at Phase 5 start. Anti-slop taste, the "Design Read" line,
  anti-default discipline. This is the aesthetic backbone.
- **`ui-ux-pro-max`** - at Phase 5. Conversion hierarchy, spacing rhythm, button states,
  contrast, responsive behaviour.
- **`emil-design-eng`** - at Phase 5 polish and Phase 6. Micro-interaction craft, the
  invisible details. *Skip if the brief explicitly rejects that style* (one gym brief did).
- **`high-end-visual-design`** - when the brief reads luxury, editorial, or premium.
- **`imagegen-frontend-web`** - Phase 3, for prompt construction.
- **`image-to-code`** - Phase 2, when a reference image must become layout.
- **`redesign-existing-projects`** - at Phase 0, to **audit** the existing site. It supplies
  the audit and the preservation list. It does **not** supply the new composition and it
  never replaces Phases 1-2. Reading it as a replacement is exactly how a redesign turns
  into a reskin. See §4.7.
- **`minimalist-ui`** / **`industrial-brutalist-ui`** / **`gpt-taste`** - only when the
  design read genuinely lands there.

- **`full-output-enforcement`** - at Phase 5, on any build large enough to tempt a
  truncation. It bans placeholder patterns and `// ...rest unchanged`. A half-written page
  that *looks* finished is the single most expensive kind of output.

### Loading is not applying. Prove it.

Naming a skill in a sentence and then building on autopilot is the failure this section
keeps having. Before you write markup, put **six lines** in your reply:

```
Design read      : <page kind> for <audience>, <vibe> language
Signature device : <the one thing that would look absurd on a competitor's site>
Category default : <what every other site in this category does> -> <what I did instead>
Dials            : VARIANCE n / MOTION n / DENSITY n
Skills           : <the ones you loaded, and the one-line reason for each>
Rejected         : <the default you deliberately did NOT reach for, and what you did instead>
```

**`Signature device` and `Category default` are Gate 38, and they are the two that matter
most.** The bar on every project here is that a visitor is *surprised* — competent and
familiar is the failure, not the safe choice. A recognisable genre executed faithfully
(editorial, Swiss, brutalist, punk, glassmorphism, minimal, premium-consumer) is never an
acceptable answer to `Design read`; genres are vocabulary for discussing design, not the
design. If the device is decoration rather than something load-bearing that comes out of
what the subject actually *does*, go back to `references/11-taste.md` §1.5.

The **Rejected** line is the one that does the work. "I did not use a centred hero over a
dark gradient; the brief is a strength gym, so the hero is a full-bleed photograph with the
copy pinned left" is evidence of a decision. Silence there means the defaults won.

### If none of them are installed

They may not be — someone can download this skill on its own, and the dashboard agent runs
in a session with no personal config. **`references/11-taste.md` is the built-in floor and
it is never skippable.** It carries the anti-default catalogue, the dials, the locks and
the self-check. The standalone skills go further; the floor is what guarantees a baseline.

---

## 4. THE NON-NEGOTIABLES

These are load-bearing. They came from real failures. Full detail in the references.

### 4.1 Deliverable shape
**Marketing track:** default to **one self-contained HTML file** â€” hand-written CSS, vanilla
JS, inlined SVG, zero build step, zero CDN `<script>`. Briefs pasted from ChatGPT almost
always specify React + Vite + Tailwind + Framer Motion â€” **that is the image model's
boilerplate, not the user's requirement.** The real instruction is usually a single line at
the end of the brief ("End result a self contained HTML file"). Read the tail of the brief
before believing the stack.

**Application track:** the single-file default does **not** apply. State, routing and
repeated components make one file unmaintainable by the second route. Use a real design
system per `design-taste-frontend` 2.A. See `08-application-track.md` Â§4.

### 4.2 Content must never depend on animation
Reveal animations opt IN via a `.js` class set by an inline `<head>` script, and an
unconditional sweep runs alongside the IntersectionObserver. A scroll observer that
half-works must never be able to strand content invisible. `04-build-standards.md` Â§3.

### 4.3 Never fabricate a factual claim
Placeholder imagery is fine and expected. These are not:
- before/after pairs assembled from two different people
- testimonials attributed to stock portraits as if real
- photographer or licensing attribution that was invented
- third-party assets presented as licensed when they are not

Ship the requested layout, put the caveat in `credits.json` **and** on the page, and say so
plainly in your summary. Never bury it. `04-build-standards.md` Â§8.

### 4.4 Measure the right thing, and say which thing you measured
`05-verification-protocol.md` and `07-failure-gates.md` are both mandatory before you call
anything done. The recurring failure is not skipping measurement â€” it is measuring a
container and reporting it as proof about its contents. Always state what was measured.

### 4.5 Honesty about your own errors
If you broke it, say "I broke it" and name the cause. A wrong claim about the user's files
("your images vanished") is worse than the bug. Re-check your own shell cwd before
asserting anything about the filesystem.

Do not reconstruct this session's history from memory when a transcript exists â€” grep it.
Self-recollection has been wrong about counts and about which skills were loaded.

### 4.7 A redesign that resembles the original is a FAILED redesign

**This rule exists because a real redesign shipped as a reskin.** Same section order, same
type pairing, same hero composition, same palette. Every individual choice was defensible as
"brand fidelity". The result was the old site with more padding, and the user's first
reaction was *"it looks almost identical."*

The mechanism was structural, not a lapse in taste:

> With no mockup of the NEW design, the only composition in front of you is the OLD one.
> You will anchor on it. There is no amount of care that prevents this. The fix is not
> trying harder, it is refusing to build until a new composition exists.

**So on every redesign:**

1. **Phase 1 runs. Always.** Generate a full-page mockup of the *new* design before writing
   any markup. The existing site is input to the audit, never the reference for the build.
2. **Feed the old site into the mockup prompt as a NEGATIVE**, not a positive. "Must not
   resemble this" beats "modernise this" every time. `02-mockup-prompt.md` PROMPT 1-R.
3. **Separate what is preserved from what is redesigned, in writing, before Phase 1.**
   Preserved is normally a short list: logo, company name, brand hue, copy, legal text,
   URL structure and section ids. **Everything else is in scope.** Layout, section order,
   type pairing, grid, imagery, motion and page structure are NOT brand.
4. **Run Gate 15 before reporting the redesign complete.**

**The trap in the word "preserve".** A client saying "keep the logo and company name" is
naming two assets. It is not asking you to keep the section order, the type scale, or the
hero composition. Read the preservation list literally and narrowly. Anything not named is
yours to change, and on a redesign the default is to change it.

**The test:** put the old and new side by side at 25% zoom, where you read silhouette and
rhythm rather than detail. If a stranger would call them the same site, it failed.

### 4.6 A prose rule is not a control
Three rules in this skill were written down and then violated in a later phase of the same
session. If a lesson matters, it belongs in `07-failure-gates.md` as a command with a pass
condition, tied to a named phase â€” not as a paragraph of advice.

---

## 5. WORKING RHYTHM

- Announce the phase, do the work, report with evidence, move on.
- Independent tool calls go in one message.
- Prefer writing a script file over `node -e` with nested quotes. Windows paths plus two
  layers of shell quoting will mangle regexes and backslashes every single time.
- On Windows, PowerShell 5.1 has no `&&`, no ternary, and writes UTF-8 **with a BOM** that
  `JSON.parse` rejects. Use `;`+`if ($?)`, and strip the BOM when reading JSON back.
- `$ErrorActionPreference = "Stop"` turns native git/gh stderr into fatal errors. Use
  `Continue` for scripts that shell out.

---

## 6. DEFINITION OF DONE

**Run `references/07-failure-gates.md` before reporting anything complete.** Every gate
produces a number. Report the numbers, not the word "verified."

- [ ] **Gate 1** children overflowing unclipped parents: **0** (this caused 5 of 9 escaped defects)
- [ ] **Gate 2** environment discriminator run before any "it's broken" conclusion
- [ ] **Gate 3** every referenced variant width confirmed to exist
- [ ] **Gate 4** standalone renders == sections identified
- [ ] **Gate 5** the reference mockup's own contrast measured, deviations recorded
- [ ] **Gate 6** audit covers `srcset`; at least one placed asset opened and eyeballed
- [ ] **Gate 18** regenerated slugs: old variants deleted first; `unused: 0` AND `MISSING: 0`
- [ ] **Gate 19** every `cover` image renders at scale **≤ 1.0** at the widest breakpoint
- [ ] **Gate 20** contrast measured on **glyph extents**; the binding element named; scrim actually painted reported
- [ ] **Gate 21** breakouts: **0 collisions, 0 side spills**, at every breakpoint, at the animation's worst frame
- [ ] **Gate 22** rendered-size spread across any repeated set reported as a number
- [ ] **Gate 23** 0 duplicate `style` attributes; every declared animation proven to receive its driver
- [ ] **Gate 24** any failing check re-run in isolation before it is reported as a defect
- [ ] **Gate 25** credentials addressed by exact key, proven with a live call, printed masked
- [ ] **Gate 26** deploy folder derived from the document; `referenced == copied`
- [ ] **Gate 28** nearMissEdges: 0, subpixelElements: 0
- [ ] **Gate 29** media starvedOfHeight: 0 (dead space from <picture> not inheriting size)
- [ ] **Gate 30** hand-drawn SVG paths over 80 chars: 0 — artwork is a generated asset
- [ ] **Gate 31** scrollWidth - clientWidth: 0 at every breakpoint, on a FRESH LOAD
- [ ] **Gate 32** every JS-stamped CSS variable re-read after reload, not after a resize
- [ ] **Gate 33** parseColor proven against `oklab()` / `color()` / `color-mix()` before any contrast number is reported
- [ ] **Gate 34** tab fronted, or CSS-half and driver-half tested separately, before any "it doesn't work"
- [ ] **Gate 35** every duplicated control exercised from EACH instance; state asserted on all of them
- [ ] **Gate 36** live host warmed before the sweep; every non-200 retried; served bytes == built bytes
- [ ] **Gate 37** push was a fast-forward; `ls-remote` == local HEAD; no `--force` anywhere
- [ ] **Gate 38** signature device named and load-bearing; swap-the-logo test on the MOCKUP returns "now looks wrong"
- [ ] **Gate 39** >= 2 mockups generated and shown side by side; the USER chose, not you
- [ ] **Gate 40** after any rule change, the RUNNING system was asked what the rule is, and agreed
- [ ] **Gate 41** FUNCTIONAL CONTRACT written at Phase 0; interactionsSpecified == interactionsProven at Phase 6
- [ ] **Gate 42** every gate reported as <numbers produced> + <what it states it cannot see>; exit 0 is not a verdict
- [ ] **Gate 43** deploy folder has a runtime (start script + its file), not just assets; live verify warmed and retried
- [ ] **Gate 44** no UI/agent lock without a reconcile path against authoritative state
- [ ] 0 broken images, 0 console errors, 0 stranded reveals
- [ ] 0 horizontal overflow at 375 / 768 / 1024 / 1440 / 1920
- [ ] Text contrast >= 4.5:1 against **rendered pixels**, at every breakpoint, on **every ground it lands on**
- [ ] Focal subject survives its crop at every breakpoint
- [ ] Keyboard: focus rules present, dialogs trap and restore focus, Escape closes
- [ ] Every primary CTA leads somewhere real â€” a form, not a scroll to another button
- [ ] `credits.json` records provenance and outstanding caveats
- [ ] Deployed URL fetched and re-audited live, and **every asset HEAD-checked on that host**

### The failure this list exists to prevent
Nine times across six projects, a user reported breakage that the immediately preceding turn
had explicitly verified as passing. In every case a real measurement was taken of the wrong
thing and allowed to stand for a broader claim. **Measuring one true thing is not evidence
for a different claim.**

---

## 7. REFERENCES

Read the one for the phase you are in. Do not preload them all.

- `references/01-discovery-interview.md` â€” the question tree
- `references/02-mockup-prompt.md` â€” mockup + extraction prompts, ready to paste
- `references/03-image-generation.md` â€” character bible, image prompts, sharp pipeline, Codex
- `references/04-build-standards.md` â€” design system, single-file architecture, JS patterns, traps
- `references/05-verification-protocol.md` â€” the measurement scripts
- `references/06-ship-deploy-git.md` â€” staging, deploy, live audit, git
- `references/07-failure-gates.md` â€” **44 mechanical gates, every one from a defect that
  reached a user. Read this at Phase 6 minimum; Gates 2, 7 and 8 apply from Phase 1;
  Gate 19 must be read at Phase 3, before a single image prompt is written, because a plate
  cut to the wrong aspect cannot be repaired in CSS afterwards.**
- `references/08-application-track.md` â€” **forums, dashboards, admin panels and any other
  thing people *use* rather than read. Replaces Phases 1-2 and the build half of Phase 5.**
- `references/09-phase-entry-checks.md` - **PREVENTIVE. Run the relevant block when
  ENTERING a phase. Read this one before you need it, not after.**
- `references/11-taste.md` - **THE ANTI-SLOP FLOOR, built in.** The gates prove a page is
  correct; nothing in them proves it is good. Self-contained, so it works for someone who
  downloaded this skill alone and for the dashboard agent, neither of whom has the
  standalone taste skills. Read it BEFORE choosing a colour, a typeface or a layout.
- `references/10-reference-and-components.md` - **Phase 0.5. Naming the class of site,
  building a reference board from real award-winning work, and choosing UI components by
  intent with a written justification for each. Gates 15 and 16 prove a redesign is
  different and complete; neither proves it is good. This is the file for good.**
- `templates/credits.json` â€” asset ledger template
