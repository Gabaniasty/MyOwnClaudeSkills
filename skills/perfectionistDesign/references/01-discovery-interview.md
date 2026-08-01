# Phase 0 — Discovery Interview

The goal is to leave this phase able to write a one-line **Design Read** and knowing
exactly which later phases to skip. Two rounds maximum, four questions maximum per round,
via AskUserQuestion. Skip anything the brief already answers.

---

## Round 1 — always ask these four

### Q1. What are we building? (header: `Project`)
Options should be concrete, drawn from what they said. Include their own words as option 1.

**This question also selects the TRACK.** The first four are marketing; the fifth is the
application track (`08-application-track.md`). Offer whichever four fit what they said.

- Landing page for a local business (gym, clinic, studio, restaurant)
- Brand / product marketing site (SaaS, consumer product, launch)
- Portfolio or agency site (creative, dev, studio)
- Editorial / concept piece (fan concept, campaign, showcase)
- **An application people use** (forum, dashboard, admin panel, booking system, docs, community)

*Why it matters:* local-business sites need trust signals, faces, and a booking CTA above
the fold. Portfolio sites need restraint and typography. Concept pieces can be loud. The
category picks the aesthetic far more than personal taste does.

*Track test:* does it have a logged-in state, a list of user-created records, or a form that
changes stored data? If yes it is an application, and building it as a long scrolling page
will produce a brochure about the product instead of the product.

**If application track, add these to Round 2:**
- Does it need accounts and a logged-in state?
- Is the content seeded sample data, or genuinely user-generated?
- Real backend, or a static front-end demo? *(this becomes an honesty disclosure either way)*
- Is moderation / admin in scope, or the member-facing surface only?

### Q2. Do you have a reference to work from? (header: `Reference`)
- No — generate a mockup first *(Recommended — go to Phase 1)*
- Yes, I have a screenshot or image to match
- Yes, a live URL to match or redesign
- I have a written brief but no visual

*Why it matters:* this decides whether Phases 1 and 2 run at all. Generating a mockup in
ChatGPT first produces a dramatically better result than building from a text brief,
because you get to react to a *composition* instead of inventing one.

### Q3. Where do the images come from? (header: `Imagery`)
- Generate them (ChatGPT / image model) *(Recommended for fictional brands)*
- I'll supply my own photography
- Free stock (Unsplash / Pexels)
- No photography — illustration, SVG, and type only

*Why it matters:* generated imagery needs a **character bible** so the same fictional
people recur across sections (Phase 3). Supplied photography needs a crop-safety pass.
Stock needs a hard honesty check before it is captioned as anything real.

### Q4. Where does it end up? (header: `Delivery`)
Multi-select.
- One self-contained HTML file *(Recommended default)*
- Deployed to a live URL
- Pushed to a git repo
- Local only, I'll handle the rest

---

## The question that is skipped most often, and costs the most

### Q4b. Name 2-3 sites whose look you admire (header: `References`)

**Ask this on every project.** The user's own taste is the single highest-signal input
into the design and the one thing that cannot be inferred from anything else. One named
site relocates a project faster than a paragraph of adjectives.

If they have none, do **not** fall back to "modern and clean" — and do **not** hand them a
menu of named genres to pick from either. This file used to say *"offer named classes and
let them choose: developer-tool minimal, Swiss editorial, motion showcase, premium
consumer, technical credibility."* **That instruction was wrong and has been removed.**

A genre menu guarantees a competent, familiar, forgettable page, because every option on
it is a style the visitor has already seen a hundred times. The user's standing brief is
the opposite: **every build should surprise the person who lands on it.** Naming a known
genre and executing it faithfully is a failure, not a shortcut. See `11-taste.md` §1.5 and
Gate 38.

When they have no references, ask what makes the *subject* unlike its category instead:

- *"What does this place/product do that the others in its category genuinely don't?"*
- *"What should someone remember 10 seconds after closing the tab?"*
- *"What do all your competitors' sites look like?"* — then treat that answer as the
  thing to move away from, and say so out loud.

Those three answers produce a direction nobody else in the category can reuse. A genre
name produces one anybody could.

Pair it with the negative, which people hold more strongly and state more precisely:
*"Anything it must never look like?"* Capture verbatim.

> Skipping this is how a project ends up competent and forgettable. The output lands on
> the average of everything the model has seen, because nothing pulled it anywhere else.

---

## Round 2 — only what is still genuinely open

Ask at most four. Drop any the brief settled.

### Q5. Aesthetic direction (header: `Direction`)
Offer 3-4 directions. Every one must be **invented for this subject** and must carry a
signature device that would look absurd on a competitor's site. Never offer a genre name.

Bad, because they are generic adjectives: "modern / clean / bold".

**Also bad, and this is the trap this skill kept falling into** — recognisable genres
wearing a colour palette. These are the ones to stop reaching for:
- "Warm white, editorial serif, generous whitespace" (this is *Swiss editorial*, and it
  is the single most over-produced look in AI design work)
- "Ivory paper, Bodoni, handwritten annotations" (*fashion editorial*)
- "Dark champagne-gold, high-contrast serif/sans" (*luxury hospitality*)
Each describes a category, not a client. Swap the logo and it fits any of a thousand
businesses, which is exactly why it will not be remembered.

Good — each names a device that comes out of the subject itself:
- A boxing gym whose entire page is laid out on the timing of a 3-minute round, with the
  round clock as the scroll indicator
- A coffee roastery where the page's colour temperature shifts from green to dark brown
  as you scroll, tracking the roast
- A structural engineer whose section dividers are real load diagrams from their projects
- A sleep clinic that starts at full brightness and dims as you read, ending near-black

Ask the user to react to these, not to rank genres. A strong negative reaction is still a
useful answer; a shrug means all three were too safe and you should go again.

### Q6. Is this brand real or fictional? (header: `Brand`)
- Fictional / portfolio piece
- Real business with real customers

*Why it matters:* this is the single most important honesty question. A real business
means testimonials, results figures, and before/after claims carry legal weight
(misleading-conduct rules; consumer law). It changes what you are allowed to ship.
**If real: no invented testimonials, no invented numbers, no unlicensed third-party assets.**

### Q7. Anything that must NOT appear? (header: `Constraints`)
Free-text-friendly. Users often have a strong negative: "don't make it look editorial",
"nothing like the last one", "don't use that animation style". Negatives are more useful
than positives — capture them verbatim and honour them.

### Q8. Sections needed (header: `Sections`)
Only ask if there is no reference and no brief. Otherwise derive from the mockup.

---

## Output of this phase

Before moving on, state, in this shape:

> **Design Read:** \<page kind> for \<audience>, \<vibe> language, leaning \<system/aesthetic>.
> **Running phases:** 1, 3, 4, 5, 6, 7. **Skipping:** 2 (full brief supplied).
> **Hard constraints:** \<their negatives, verbatim>.

Then proceed. Do not seek approval for the read — state it and move.

---

## Interview anti-patterns

- **Do not** ask questions whose answer you can infer. If they said "gym in Sydney with
  founders on the hero", you know the category, the audience, and the hero composition.
- **Do not** ask about tech stack unless the deliverable is genuinely ambiguous. The
  default is one HTML file (SKILL.md §4.1).
- **Do not** ask permission to begin. Ask what you need, then begin.
- **Do** ask the real/fictional question every time. It is cheap and it is the one that
  prevents shipping something misleading.
