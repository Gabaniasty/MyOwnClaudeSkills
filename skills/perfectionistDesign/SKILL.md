---
name: perfectionistDesign
description: End-to-end pipeline for building a premium, real-feeling marketing website or landing page from nothing - discovery interview, ChatGPT mockup generation, spec extraction, photorealistic image generation, self-contained build, measurement-based verification, deploy and git. Use when the user says they want to build a website, landing page, portfolio site, or brand site, when they paste a design brief or reference screenshot, or when they invoke perfectionistDesign directly. Also use for redesigns of an existing page.
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

## 1. TRIGGER AND FIRST MOVE

Fires on: "build me a X website", "landing page for X", "redesign this", a pasted brief,
a pasted reference screenshot, or `/perfectionistDesign`.

**First move is always the discovery interview.** Do not write code, do not pick colours,
do not open an editor. Run `references/01-discovery-interview.md`.

The interview uses AskUserQuestion in **at most two rounds** of up to 4 questions. It is
not a form. If the user's brief already answers something, do not ask it.

---

## 2. PHASE MAP

Work through these in order. Announce which phase you are entering. Some are skippable
and the interview tells you which.

| # | Phase | Reference | Skippable when |
|---|---|---|---|
| 0 | Discovery interview | `01-discovery-interview.md` | never |
| 1 | Mockup generation (ChatGPT) | `02-chatgpt-prompt-pack.md` | user already has a reference image |
| 2 | Spec extraction (ChatGPT) | `02-chatgpt-prompt-pack.md` | user pasted a full written spec |
| 3 | Imagery | `03-image-generation.md` | user supplies their own photography |
| 4 | Asset pipeline | `03-image-generation.md` | no local images |
| 5 | Build | `04-build-standards.md` | never |
| 6 | Verification | `05-verification-protocol.md` | never |
| 7 | Ship: deploy + git | `06-ship-deploy-git.md` | user said local only |

**Phases 1 and 2 happen in ChatGPT, not here.** You hand the user prompts to paste. That
is deliberate: ChatGPT's image model produces the mockup, and a mockup drawn by an image
model is a far better brief than anything either of you writes from scratch. See
`02-chatgpt-prompt-pack.md` for why and for the exact prompt text.

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
- **`redesign-existing-projects`** - instead of Phase 1-2 when the job is a redesign.
- **`minimalist-ui`** / **`industrial-brutalist-ui`** / **`gpt-taste`** - only when the
  design read genuinely lands there.

State which ones you are pulling and why, in one line. Do not load all of them.

---

## 4. THE NON-NEGOTIABLES

These are load-bearing. They came from real failures. Full detail in the references.

### 4.1 Deliverable shape
Default to **one self-contained HTML file**: hand-written CSS, vanilla JS, inlined SVG,
zero build step, zero CDN `<script>`. Briefs pasted from ChatGPT almost always specify
React + Vite + Tailwind + Framer Motion — **that is the image model's boilerplate, not the
user's requirement.** The real instruction is usually a single line at the end of the brief
("End result a self contained HTML file"). Read the tail of the brief before believing the
stack. Confirm in the interview if genuinely ambiguous.

### 4.2 Content must never depend on animation
Reveal animations opt IN via a `.js` class set by an inline `<head>` script, and an
unconditional sweep runs alongside the IntersectionObserver. A scroll observer that
half-works must never be able to strand content invisible. `04-build-standards.md` §3.

### 4.3 Never fabricate a factual claim
Placeholder imagery is fine and expected. These are not:
- before/after pairs assembled from two different people
- testimonials attributed to stock portraits as if real
- photographer or licensing attribution that was invented
- third-party assets presented as licensed when they are not

Ship the requested layout, put the caveat in `credits.json` **and** on the page, and say so
plainly in your summary. Never bury it. `04-build-standards.md` §8.

### 4.4 Measure, never eyeball
`05-verification-protocol.md` is mandatory before you call anything done.

### 4.5 Honesty about your own errors
If you broke it, say "I broke it" and name the cause. A wrong claim about the user's files
("your images vanished") is worse than the bug. Re-check your own shell cwd before
asserting anything about the filesystem.

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

Do not report completion until every line is true and evidenced:

- [ ] 0 broken images, counting **`srcset` candidates**, not just `src`
- [ ] 0 console errors on a clean load
- [ ] 0 stranded reveal targets after a full-page scroll
- [ ] 0 horizontal overflow at 375 / 768 / 1024 / 1440 / 1920
- [ ] Text contrast >= 4.5:1 measured against **rendered pixels**, at every breakpoint
- [ ] Any face or focal subject survives its crop at every breakpoint
- [ ] Keyboard: focus visible, dialogs trap and restore focus, Escape closes
- [ ] `credits.json` records every asset, its provenance, and any outstanding caveat
- [ ] Deployed URL fetched and re-audited live, not assumed from a success message
- [ ] Pushed, with the correct project verified in the correct repo

---

## 7. REFERENCES

Read the one for the phase you are in. Do not preload them all.

- `references/01-discovery-interview.md` — the question tree
- `references/02-chatgpt-prompt-pack.md` — mockup + extraction prompts, ready to paste
- `references/03-image-generation.md` — character bible, image prompts, sharp pipeline, Codex
- `references/04-build-standards.md` — design system, single-file architecture, JS patterns, traps
- `references/05-verification-protocol.md` — the measurement scripts
- `references/06-ship-deploy-git.md` — staging, deploy, live audit, git
- `templates/credits.json` — asset ledger template
