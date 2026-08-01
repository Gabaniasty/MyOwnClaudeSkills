# Taste — the anti-slop floor

**This file exists because the skill could not rely on the taste skills being there.**

`design-taste-frontend`, `emil-design-eng` and the rest are excellent and this skill
composes with them when they are installed (SKILL.md §3). But two things are true:

1. Anyone who downloads perfectionistDesign on its own has none of them.
2. The dashboard agent runs in a fresh CLI session with no personal `CLAUDE.md`
   telling it to load them.

So the rules that stop output looking generated are written down **here**, as part of
this skill. When the standalone skills are present, load them — they go further. When
they are not, this file is the floor and it is not optional.

> The gates prove a page is *correct*. Nothing in `07-failure-gates.md` proves it is
> any *good*. That is this file's job, and `10-reference-and-components.md` is its
> companion for choosing components with intent.

---

## 1. Read the room before you pick anything

Before code, before colour, state one line:

> *"Reading this as: \<page kind> for \<audience>, with a \<vibe> language, leaning
> toward \<aesthetic family>."*

If you cannot write that sentence, you have not done Phase 0 properly. Go back.

Then set three dials and say what you set them to:

| | 1 ←→ 10 | Typical |
|---|---|---|
| **VARIANCE** | perfect symmetry ←→ artsy chaos | landing 7, agency 9, public-sector 3 |
| **MOTION** | static ←→ cinematic | landing 6, editorial 4, trust-first 2 |
| **DENSITY** | art gallery ←→ cockpit | marketing 4, dashboard 7 |

A redesign that must *diverge* (Gate 15) gets +2 on VARIANCE and MOTION over whatever
the original scored.

---

## 1.5 THE BAR IS MEMORABLE, NOT COMPETENT

**The standing instruction on every project built with this skill: someone landing on the
page should be surprised.** Not "this is clean". Not "this is professional". Surprised —
the way an award-shortlisted site surprises you in the first three seconds, because it did
something you have not seen a hundred times already.

That makes one whole category of answer forbidden: **a well-known genre, executed
faithfully.** Editorial. Swiss. Brutalist. Punk. Glassmorphism. Neo-brutalist. Dark-tech.
Premium-consumer beige. Every one of them is famous, which is precisely the problem — the
visitor has seen it, so it cannot surprise them. A genre is a *vocabulary for discussing*
the design (`10-reference-and-components.md` §3). It is never the design.

> This skill used to instruct the opposite. `01-discovery-interview.md` said, in as many
> words, *"offer named classes and let them choose"* and listed five genres. That produced
> competent, familiar, forgettable pages, which is the one outcome the user has said
> repeatedly they do not want. It is removed.

### The three questions that produce a real direction

Ask these of the *subject*, never of the style shelf:

1. **What does this subject actually do that its competitors do not?**
   The design idea is usually hiding in the operational truth. A roastery that roasts on
   Monday and ships Wednesday has a *week* in it. A clinic with a 20-minute appointment has
   a *clock* in it.
2. **What is the one thing a visitor should be able to describe to someone else afterwards?**
   If the only honest answer is "it was clean", there is no design yet.
3. **What does every other site in this category look like?**
   Name it explicitly, then move away from it and say what you did instead.

### The signature device

Every page ships **one device that would look absurd on a competitor's site.** Not
decoration — something load-bearing that comes out of question 1. The scroll indicator is
the round clock. The page dims as the article goes on. The dividers are real load diagrams.
The palette tracks the roast.

One is enough. Two is usually one too many, and it starts fighting the content.

### The test

> Could this page be re-labelled for a different business in the same category, with only
> the logo and copy swapped, and still look right?

If yes, it is a template and it fails. This is mechanical and it is **Gate 38**.

### What this does NOT license

Distinctive is not the same as unusable, and "award-winning" is not an excuse to break
things. Every hard rule in this file still binds: contrast, reduced motion, all states,
keyboard access, and the reveal contract (content never depends on animation). A device
that strands content, fails AA, or hides the primary action is not bold, it is broken.
Surprise the visitor with the *idea*, never by making the page harder to use.

---

## 2. The defaults that mark output as generated

Every one of these is what a model reaches for when it has not thought. Reaching for
them is the tell.

**Banned as a default — not banned outright, banned as the thing you reach for first:**

- **AI violet.** Purple/indigo gradients, glowing violet buttons, `#5b4bde`-family
  accents. If the brand asks for violet, use it with intent. Otherwise do not.
- **Centred hero over a dark mesh gradient.** Especially with a pill badge above the
  headline saying "Introducing".
- **Three equal feature cards.** If three things genuinely deserve equal weight, fine —
  but derive that, do not default to it.
- **Inter + slate-900.** Inter is fine when a brief asks for neutral or accessible;
  it is not a decision.
- **Glassmorphism on everything.** A frosted panel is a material, not a theme.
- **Infinite looping micro-animations** on decorative elements.
- **Emoji as iconography.** Use a real icon set, one family, one stroke weight.
- **The premium-consumer beige.** Warm cream background + brass/clay accent + espresso
  text is *the* default for cookware, wellness, artisan and heritage briefs, and it
  makes every such brand look identical. Rotate away from it: cold silver/chrome,
  forest + bone + amber, black + tan, cobalt + cream, terracotta + slate, or
  monochrome + one saturated pop.

**Serif discipline.** "It feels creative/premium" is not a reason. Default to a sans
display face (Geist Display, PP Neue Montreal, Cabinet Grotesk, GT Walsheim). Use a
serif only when the brief names one, or the family is genuinely editorial / luxury /
heritage *and you can say why this serif fits this brand*. `Fraunces` and
`Instrument Serif` are banned as defaults — they are the two the model always picks.

**Emphasis inside a headline uses italic or bold of the SAME family.** Dropping a serif
word into a sans headline to add interest is amateur.

---

## 3. Locks — pick once, hold everywhere

Inconsistency reads as carelessness faster than any single bad choice.

- **Colour lock.** One accent for the whole page. A warm-grey site does not grow a blue
  CTA in section 7. Audit every component before shipping.
- **Shape lock.** One corner-radius system: all-sharp, all-soft, or all-pill — or a
  written rule ("buttons pill, cards 16, inputs 8") followed everywhere.
- **Icon lock.** One family, one stroke weight, one optical size. Never hand-draw an
  SVG icon; never mix two sets. And measure the SET, not each icon (Gate 22).
- **Type lock.** Two families maximum, three weights maximum.
- **Shadow lock.** Tint shadows to the background hue. No pure-black shadow on a light
  ground.

---

## 4. Layout

- **Anti-centre bias.** Above VARIANCE 4, stop centring everything. Split screen,
  left-aligned copy against a right-hand asset, asymmetric whitespace, scroll-pinned
  structure. Centred is right for a manifesto or a launch note — derive it, do not
  default to it.
- **Grid, not flex-maths.** `grid-template-columns: repeat(3, 1fr)` beats
  `width: calc(33% - 1rem)` every time.
- **`min-height: 100dvh`, never `100vh`** for full-height sections — `vh` jumps when
  the mobile address bar moves.
- **Cards only when elevation means something.** Otherwise group with a rule, a
  divider, or space. A page of cards is a page with no hierarchy.
- **Whitespace is the cheapest luxury signal there is.** When a brief says premium,
  calm, or uncluttered, the answer is usually more space, not more decoration.

---

## 5. Motion

Motion is either a signature or it is noise. Pick a small number of moments that mean
something and make those excellent:

- an entrance that reveals structure (a masked headline, a staggered list)
- one element that responds to the pointer with restraint
- state changes that are legible — a button that visibly commits, a card that lifts 5px

Everything else should be still. And:

- **Content must never depend on animation.** Reveals opt IN via a `.js` class, with an
  unconditional sweep alongside the observer (Gate 23, `04-build-standards.md` §3).
- **`prefers-reduced-motion` is honoured everywhere**, not on the hero only.
- **Durations**: 150–250ms for state, 400–900ms for entrances. Longer reads as slow,
  not as elegant.

---

## 6. States, because half-built UI is the loudest tell

Every interactive thing ships all of its states, not just the happy one:

- **hover / active** — `translateY(1px)` or `scale(.98)` on press, so it feels physical
- **focus-visible** — a real ring, on every focusable element
- **loading** — a skeleton shaped like the content, not a spinner
- **empty** — composed, and it says how to fill it
- **error** — inline and specific, next to the thing that failed
- **disabled** — visibly, not just unclickable

**Button contrast is a gate, not a preference.** White text on a light accent is the
single most common real defect this pipeline catches. Measure it (`05` §3).

---

## 7. The self-check before you call it designed

Answer these out loud. Any "no" is a rewrite, not a tweak.

1. Could I name the brand from a screenshot with the logo removed?
2. Is there one accent, one radius system, one icon family, one type pairing?
3. Did I derive the sections from the subject, or reach for hero/features/testimonials?
4. Is there a single moment someone would remember?
5. Does the layout do anything a centred column would not?
6. Have I measured the contrast of every CTA against what is actually behind it?
7. If I removed every animation, is the page still complete and legible?
8. Is anything here only because it is what these pages usually have?

---

## 8. When the standalone skills ARE installed

Load them and let them lead — they are deeper than this file:

- **`design-taste-frontend`** — the design read, the dials, the anti-default catalogue
- **`emil-design-eng`** — micro-interaction craft and the invisible details
- **`high-end-visual-design`** — when the brief is genuinely luxury or editorial
- **`minimalist-ui`** / **`industrial-brutalist-ui`** / **`gpt-taste`** — only when the
  design read genuinely lands there

State which you loaded and why, in one line. Do not load all of them.
