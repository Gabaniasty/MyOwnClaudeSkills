# Phase 0.5 - Deciding the Design Language

> Runs after the interview, BEFORE any mockup prompt.
>
> Gates 15 and 16 prove a redesign is *different* and *complete*. Neither proves it is
> *good*. This is the file for good.
>
> **Nothing here is a menu.** There is no list of components to use. There is a procedure
> for deciding, and the procedure starts by asking the user questions you cannot answer
> yourself.

---

## §0. THE TWO FAILURES THIS PREVENTS

| Failure | Cause |
|---|---|
| Competent and forgettable | no reference was consulted, so the output lands on the average of everything the model has seen |
| Effects bolted on | aurora, sparkles, spotlight, magnetic buttons on a page that needed none. Chosen because they exist |

Both come from the same root: **deciding the design language alone, from memory.**

---

## §1. ROUTE FIRST. THE JOB DECIDES THE WORKFLOW.

Do not run a single fixed pipeline. Establish which job this is, then follow that
branch. The three jobs need different questions, in a different order.

| | **A. New site** | **B. Redesign** | **C. New page in an existing system** |
|---|---|---|---|
| The hard problem | there is no anchor, so anything is possible | anchoring on the old design | matching without copy-pasting |
| Ask about | class, audience, references they like, hard negatives | what is working, what they hate, what must survive | the existing tokens and components |
| Reference board | 3-5 external sites | 3-5 external sites **plus** the current site as an explicit anti-reference | the product's own existing pages |
| Mockup | required | required, never skipped (SKILL.md §4.7) | usually not; extend the system instead |
| Gates | 16 not applicable | 15 **and** 16 both mandatory | consistency audit against the system |

---

## §2. ASK. DO NOT ASSUME.

The single highest-signal input is **the user's own taste**, and it is the one thing that
cannot be derived. Ask for it explicitly, with AskUserQuestion, before designing.

### Ask on every job
1. **"Name 2-3 sites whose look you admire."** Their answer relocates the whole project
   faster than any amount of inference. If they have none, offer named classes (§3) and
   let them pick, rather than adjectives.
2. **"Anything it must never look like?"** Negatives are more actionable than positives
   and are usually held more strongly. Capture verbatim.
3. **"How much motion is right for your audience?"** Some audiences are impressed by
   scroll choreography; procurement committees are irritated by it.

### Ask additionally on a redesign
4. **"What is working on the current site that must survive?"** This becomes the
   preservation list, and it must be read narrowly (SKILL.md §4.7).
5. **"What specifically do you dislike about it now?"** The answer is the brief.
6. **"Is the brand itself changing, or only its expression?"** Changes whether brand
   tokens are input or output.

### Ask additionally on an application
7. **"Which screens carry the product's reputation?"** Design those first; the rest
   inherit.

> If the user's brief already answers one of these, do not ask it. Asking what has just
> been told to you reads as not listening.

---

## §3. NAME THE CLASS, NOT AN ADJECTIVE

"Modern and clean" is not a design direction. A class is, because it carries concrete
decisions about type, colour, density and motion. Establish the class with the user, from
their references or by offering options.

**A class is a starting vocabulary, and it is NEVER the finished direction.** The list
below exists so you and the user can say *"warmer than that, denser than that"* in one
word. Shipping a faithful execution of any of them is a failure — they are all famous
looks, and a visitor who has seen the genre before cannot be surprised by it.

The standing brief on every project here is that the page should make someone stop.
So: name the nearest class if it helps you talk, then state **what you are doing that the
class would not**, and build that. If you cannot name the departure, you are building a
template with a new logo on it. Gate 38 checks exactly this, and `11-taste.md` §1.5 gives
the three questions that generate the departure.

Examples of the shape a class takes (vocabulary, not a menu):
- **Developer-tool minimal** - extreme type hierarchy, one accent, restrained motion,
  product UI as the hero image.
- **Swiss editorial** - enormous type, hairline rules, asymmetric grid, near-zero
  decoration, photography as counterweight.
- **Motion showcase** - scroll hijack, pinned sequences, cursor devices. Impressive,
  expensive, and hostile to conversion when the audience did not come to be impressed.
- **Premium consumer** - full-bleed photography, huge negative space, one idea per
  screen, motion only on entrance.
- **Technical credibility** - dense but ordered, monospace accents, real diagrams,
  restraint as the signal.

**Pick from the audience, never from taste.** A rescue service for founders who have
already been burned needs credibility and calm. A festival needs the opposite.

**Then break it, on purpose, in one place.** Credibility and calm still leaves room for a
device nobody else in that category has — the calm is the ground, not the whole idea.
Every page this skill ships should have one thing a visitor could describe to someone
else afterwards. If the only honest description is the genre name, there is nothing there.

---

## §4. RESEARCH THE REFERENCES. DO NOT RECALL THEM.

Recalled references are stale and often wrong. Go and look, per project.

| Source | Best for |
|---|---|
| `awwwards.com` | the current ceiling for motion and art direction |
| `motionsites.ai` | motion-led sites, scroll choreography |
| `godly.website` | curated product and agency sites |
| `land-book.com` | landing pages by category, conversion structure |
| `refero.design` | real product UI flows |
| `mobbin` | mobile and app patterns |

Fetch them. Then write the board down:

```
REFERENCE BOARD - <project>
class: <the class, in the user's and your shared words>
1. <site>  TAKE: <one specific, stealable decision>   AVOID: <one thing>
2. <site>  TAKE: ...
3. <site>  TAKE: ...
anti-reference (redesigns): the current site. AVOID: <the specific things being replaced>
```

"TAKE: it looks nice" is not a decision. "TAKE: meta text at 11px against a 96px display,
nothing in between" is.

---

## §5. DERIVE COMPONENTS FROM INTENT

**Never open a component library and shop.** Work in this order:

```
what must this section DO
      -> what interaction expresses that
            -> what is that pattern called
                  -> does a library have it, or is it 20 lines of CSS
```

For each candidate, write the justification sentence:

> *"This \<effect> is here because the brand claims \<X>."*

If the sentence cannot be written, the effect is decoration. Delete it.

Worked example, real: a software-rescue studio's claim is *mess becomes order*. A
draggable compare slider between a tangled photograph and a resolved one is not
decoration; it is the offer made operable. The same slider on a law firm's site is slop.

### Record what you rejected
The rejected list is the evidence that effects were **selected** rather than accumulated.
State it alongside the chosen list. A page with five effects and no rejected list was not
designed, it was decorated.

### Component libraries are a lookup, not a canon
Libraries change constantly, so enumerate the current catalogue when you need it rather
than trusting memory:

```
WebFetch <library>/components  ->  "list every component and the effect it produces"
```

Useful catalogues to look up: Aceternity UI, Magic UI, React Bits, Motion Primitives,
shadcn/ui, Radix, Origin UI. Which exist and what they contain is a fact to check, not a
fact to recall.

### Constraints that hold regardless of library
- **One motion engine per project.** GSAP, Motion and Three.js fight over frames.
- **Effects need a keyboard and a reduced-motion path.** A hover-only reveal is broken
  for half your users; a compare slider needs a real range input or arrow keys.
- **In a single-file build** (SKILL.md §4.1) a React library is a *catalogue to choose
  from*, not a dependency. Most effects are achievable in plain CSS plus one rAF-latched
  scroll driver. Clip-path, `stroke-dashoffset` from `getTotalLength()`, sticky
  positioning, a translated wrapper, and pointer coords written to custom properties
  cover the large majority.

---

## §6. WHAT MAKES A PAGE READ AS EXPENSIVE

Technique-level and durable. None of it is a library, so none of it goes stale.

1. **Extreme type scale contrast.** Huge display against genuinely small meta, nothing in
   between. Medium-everything is the strongest amateur tell there is.
2. **Slow, eased motion.** 600-900ms, exponential ease-out. Fast, bouncy or linear reads
   cheap.
3. **One accent, rationed** to well under a tenth of the viewport. Restraint reads as
   confidence; a second accent reads as indecision.
4. **Depth from layering,** not drop shadows. Overlap, cross section boundaries.
5. **The grid broken exactly once per section.** Everywhere is noise; nowhere is inert.
6. **Real imagery.** Generated, photographed or genuine 3D. Never an icon standing in for
   a picture, never div-based fake UI.
7. **Optical alignment**, not mathematical. Hanging punctuation, glyphs optically centred
   in circles, hairlines that stay 1px at any DPR.
8. **Whitespace as the primary material.** If adding whitespace makes it worse, the
   problem is the content.

---

## §7. THE STEP ORDER, PER JOB

**A. New site**
`interview -> ask §2 -> class + reference board -> derive sections (02 §0) -> derive
components -> mockup -> analyse -> assets -> build -> verify -> ship`

**B. Redesign**
`interview -> ask §2 including the redesign questions -> DOM inventory (Gate 16) ->
preservation list, read narrowly -> class + reference board with the current site as
anti-reference -> derive components -> mockup of the NEW design (never skipped) ->
score Gates 15 and 16 against the mockup -> assets -> build -> verify -> ship`

**C. New page in an existing system**
`read the existing tokens and components -> ask §2 Q1-Q3 only -> extend, do not invent ->
consistency audit -> build -> verify`

---

## §8. OUTPUT OF THIS PHASE

> **Job:** \<A / B / C>
> **Class:** \<named, in concrete terms>
> **Reference board:** \<3-5 sites, what is taken from each, plus the anti-reference>
> **Signature device:** \<the one thing this page is remembered for + its justification
> sentence>
> **Components chosen:** \<intent -> pattern, each with its justification sentence>
> **Explicitly rejected:** \<what was considered and dropped, and why>

Then go to the mockup. Do not start building against an imagined composition.
