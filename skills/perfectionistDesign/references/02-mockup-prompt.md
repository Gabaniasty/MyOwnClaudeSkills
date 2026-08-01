# Phases 1 & 2 — Deriving and generating the mockup

## §0. DERIVE THE SECTIONS. NEVER REACH FOR A TEMPLATE.

This is the one genuinely creative step in the pipeline and the one most likely to be
skipped. Before writing a single line of the mockup prompt, answer four questions about the
**subject**, not about websites:

1. **Who arrives, and what are they trying to find out?**
2. **What must this thing PROVE before that person will act?**
3. **What is the single action that counts as success?**
4. **What would a sceptic of this specific thing want to see?**

The section list falls out of the answers. Different subjects prove different things, so
they get different sections. Worked examples:

| Subject | Must prove | Sections that follow |
|---|---|---|
| Gym | real coaches, real results, it's for people like me | founders, programmes, **transformations**, member quotes, trial CTA |
| Dental clinic | clinical credibility, calm, discretion | lead clinician, treatments, **smile gallery**, practice interior, consultation CTA |
| Hotel | the place is beautiful and the room is the product | location film, **rooms**, dining, spa, availability CTA |
| **Community forum** | **it is ALIVE, organised, and worth joining** | **live recent-thread feed, member/post counts, category grid, best-of discussion, rules/moderation, join CTA** |
| SaaS product | it works, it's safe, it's worth switching to | product UI shot, integrations, security, pricing, trial CTA |
| Restaurant | the food, the room, can I get a table tonight | dishes, interior, chef, hours, booking CTA |

Note how little overlap there is. A forum has no "testimonials" section and no "features"
grid; it has **activity**, because a dead forum is a worthless forum and proving liveness is
the entire job. A gym has no "categories"; it has transformations, because proof of results
is the entire job.

**The test for a derived section list:** could you swap this list onto a different business
in a different industry? If yes, it is a template and you have not derived anything.

### For a forum specifically, the proof is liveness
Sections must show, not claim: recent threads with real titles, timestamps and reply counts;
who is online now; how many posts this week. A forum landing page that says "join our
vibrant community" and shows nothing is the exact failure this section exists to prevent.

---

## §0.5. The loop repeats per page

The steps below produce **one** page. For a multi-page project, run the whole loop again for
each screen, and pass the first approved mockup as `-i` to every later generation so palette,
type and component family stay locked (`image-to-code` §34).

Order matters: build the page that establishes the brand world first, then derive the others
against it.

---

## The interactive route (ChatGPT) vs the automated route (Codex)

> **This is the interactive route.** For the automated route — Codex CLI's `imagegen` skill
> generating the mockup and every asset with no copy-pasting — see `03-image-generation.md`
> §3.1. Default to Codex when the user asks to automate. Use this file when they want to
> art-direct each image conversationally and iterate on the mockup by talking to it.
>
> The prompt *bodies* below are equally good as Codex task files. Only the delivery differs.

These prompts run in **ChatGPT** (image model + reasoning), not here. Hand them to the
user as copy-paste blocks in a fenced code block, filled in with their answers from Phase 0.

**Why this detour is worth it.** An image model asked for a full-page mockup will make a
hundred composition decisions — section order, image proportions, where the eye lands,
how much negative space the headline gets — that neither you nor the user would think to
specify. Reacting to a concrete composition beats inventing one from a text brief. This is
the single highest-leverage step in the pipeline.

---

## §0.7 ANTI-DEFAULT DISCIPLINE MUST NOT CANNIBALISE FUNCTION

**A shop mockup came back with no product photographs.** Five coffees rendered as a
five-row text index — name, notes, price — and nothing else. Someone landing on it could
not see what they would be buying.

The image model was not at fault. The prompt had asked for exactly that:

> *"a five-row editorial index, one row per coffee, styled like a printed catalogue…
> rows separated by hairline rules only"* — and, earlier, *"must look nothing like a
> '3 equal cards' grid."*

The anti-default rules had been applied so hard that they removed the thing the page
exists to do. "Avoid three equal cards" is good advice about **form**. It is not
permission to delete the product.

**The check, before you send any mockup prompt:**

> Name the ONE job this page must do. Then find the section that does it, and confirm
> the prompt makes that section the largest and most concrete thing on the page.

| Page | The job | Therefore the mockup MUST show |
|---|---|---|
| shop | sell a specific item | every product, photographed, with a price and a buy control |
| portfolio | prove the work is good | the work, large, not a description of the work |
| booking | get a date chosen | the availability UI, not a paragraph about availability |
| SaaS landing | show what the product does | the product's actual interface |
| gym | show the room and the coaching | the room, the equipment, the coaches |

Write it into the prompt as a non-negotiable, in its own paragraph near the top —
*"THE MOST IMPORTANT REQUIREMENT: the products must be SHOWN, not listed. A row of text
with prices is not acceptable."* — and give the exact per-item content: photograph,
name, price, control. Vague adjectives lose to concrete instructions every time.

**Anti-defaults belong in the prompt too, but underneath the job, never above it.**
Order the prompt: what the page must prove → what each section contains → what to avoid.
Put the avoidance list first and it becomes the brief.

---

## §0.8 ALWAYS GIVE THE USER AT LEAST TWO MOCKUPS TO CHOOSE FROM

**This is a standing instruction from the user, not a judgement call.**

> Every new website and every redesign produces **at least 2 visibly different mockups**,
> presented to the user, and **the user picks.**

One mockup is a guess with a 1-in-1 hit rate. It also quietly removes the user from the
only decision that is genuinely theirs. Two costs about four minutes.

> This section used to read *"generate more than one mockup WHEN THE JOB IS HARD"*, listed
> five conditions, and then said *"put them side by side and **pick** with a written
> reason."* Both halves were wrong: the plurality was conditional when the user had asked
> for it always, and **the agent was choosing.** Showing someone your pick after the fact
> is not a choice.

### How many

| Situation | Mockups |
|---|---|
| **New website** | **2 minimum** |
| **Redesign** | **2 minimum** (and see Gate 15 — they must diverge from the original, not just each other) |
| High stakes: the layout carries money, 8+ sections, no reference and only a feeling, or you are unsure | **3** |
| The user supplied a reference image *of the new design*, or explicitly asked for one | 1 |

Being unsure is itself the signal to go to 3, never down to 1.

### What varies between them

Each option is a **different expression of the same signature device** (Gate 38), never a
different genre. The device is the idea; the mockups are ways of staging it.

Wrong — this is the genre menu Gate 38 bans, wearing new clothes:

| ~~Axis~~ | ~~A~~ | ~~B~~ | ~~C~~ |
|---|---|---|---|
| ~~type~~ | ~~serif display~~ | ~~grotesque~~ | ~~mono-accented~~ |

Right — a roastery whose device is "the page tracks the roast":

- **A** — colour temperature shifts down the page, green to dark brown, photography-led
- **B** — the roast curve itself is the spine of the layout, sections hang off it
- **C** — each coffee is a full screen, the shift happens between them, not within

All three are the same idea. A visitor could describe any of them afterwards. Vary **one
axis at a time** so the comparison means something, and keep the section list, the copy and
the palette identical across all of them — otherwise you are comparing two things at once
and learning nothing.

### Presenting them

Show them **side by side, at the same size**, and for each one write a single line on what
it does well and what it costs. Then give your recommendation with a reason, and make it
plainly a recommendation:

> *"A and B attached. B is my pick — the product grid reads as a shop at a glance where A
> buries it below the fold. A has the better nav. Which do you want to build?"*

Then **stop and wait.** Do not start Phase 2 on your own pick. If the user is not available
and the work must continue, say explicitly which one you proceeded with and why, so the
choice stays visible and reversible.

Once they choose, steal the best single idea from the ones they did not pick — a nav
treatment, a footer, one section's composition — and say what you took.

**Never average them.** Blending mockups produces exactly the mush that having a mockup was
supposed to prevent. Pick one, graft deliberately.

---

## §0.9 ANALYSING A MOCKUP: the inventory is the whole job

Reading a mockup is not "look at it and start coding". Produce this table BEFORE any
markup, and say it out loud:

```
PALETTE      every colour with a hex, and what it is FOR
             (ground, ink, muted ink, accent, rules, and each surface tone)
TYPE         which family is display vs body vs mono; the size relationships
SECTIONS     in order, top to bottom, with a one-line purpose each
ASSETS       every visual element, with a DECISION beside it:
               generate | library | CSS
             photographs, MAPS, diagrams, charts, illustrations, textures,
             background washes, icons, logos, badges, dividers
EDGES        for every image: does it bleed, and to which edge?
COMPOSITION  what is asymmetric, what is aligned to what, where the eye goes
```

**The ASSETS row is the one that gets skipped and it is the one that costs most.** A
build once read a mockup's photographs correctly and missed its world map, so the map got
hand-drawn as SVG path data (Gate 30). If the mockup shows it, it is in the table. If you
cannot name which of generate/library/CSS it is, the inventory is not finished.

**Then re-read the mockup while building, not only before.** The analysis is a summary;
the image has more in it than any summary you wrote. Open it again at Phase 5.

---

## PROMPT 1 — Mockup generation

Fill the `<>` placeholders from the interview. Tell the user to send this to ChatGPT with
image generation, and to ask for a **full-page screenshot-style mockup**.

```text
I need a really well-done mockup image of a <CATEGORY> landing page. This is not supposed
to be editorial. This is supposed to feel like a real brand with a real person behind it.

On the hero image, we need to see <HERO SUBJECT — e.g. "a gym with the founders standing
smiling">, so make sure the mockup covers that.

The screenshot has to be done as a full-page capture so that it covers every single
section from header to footer, as one tall image.

Send me a full mockup image of what the <CATEGORY> website would look like, and make sure
it does not look like a generic template. I don't have references, but do quick research
and check existing <CATEGORY> websites that are performing and converting really well,
then design something in that class.

Constraints:
- Must not look like: a magazine spread, an editorial fashion project, a generic SaaS
  page, a template, a luxury spa, or an AI-generated concept.
- Must feel: practical, energetic, trustworthy, conversion-focused.
- <ANY VERBATIM NEGATIVES FROM THE INTERVIEW>
```

### Notes for you (not for the user)
- If the first mockup looks templated, tell the user to ask for a second pass with
  *"make it look nothing like the previous one"*. It works and costs one message.
- A tall single-image mockup is what you want. Multiple crops lose the vertical rhythm,
  which is most of the value.

---

## THE BEST REDESIGN MOCKUP ROUTE: the user's own screenshot

**Try this before generating anything.** It beat three rounds of prompt-engineered
generation on a real project, and it is one message of the user's time:

1. The user captures a **full-page screenshot of the live site** (any full-page capture
   browser extension).
2. They attach it to ChatGPT and say, roughly:
   *"Recreate a redesign of this exact website in \<colour / direction>."*
3. They hand you the resulting image.

**Why it wins over a text-prompted generation.** The model is looking at the real page, so
every section, every nav item and every content block is already accounted for. Gate 16
(completeness) comes out close to satisfied for free, because the model is redesigning
something concrete rather than inventing from a description. Generated-from-text mockups
kept dropping sections; this route did not.

### What it still gets wrong, every time
Treat the returned image as a **composition**, never as a source of fact. Verify against the
DOM inventory and expect to correct:

- **Invented product names.** A real studio's eight tools came back as four real names and
  four fabrications. Use the real ones.
- **An invented logo.** The mark is usually redrawn from scratch. Use the client's real
  asset, recoloured if the direction changed.
- **Invented nav items** pointing at sections that do not exist (a "Pricing" link with no
  pricing section, on a business with no published prices).
- **Invented prices, testimonials and metrics.** Never ship these for a real business.
- **Changed contact details.** A `.dev` domain replacing the real `.net.pl` one.
- **Dead affordances**, such as "View case" links with no case studies behind them.

Ask the user which wins on each conflict. Do not silently pick. `10-reference-and-components.md` §2.

### What it gets right and you should follow closely
Layout, spacing rhythm, component choice, type hierarchy, section order, and which blocks
deserve a UI preview versus plain type. That is the whole value. Take it.

---

## RECORD THE COMPOSITION, NOT ONLY THE CONTENT

**This is where recreating a supplied mockup goes wrong, and it is a different failure from
anything in Gate 16.** Gate 16 counts things: sections, nav items, cards, form fields. A
build can pass it completely and still look nothing like the mockup, because counting says
*what* is on the page and never says *how big it is or where its edges are*.

Real example: a hero photograph that runs the full height of the section and bleeds off the
right edge of the viewport was rebuilt as a rounded card inside a grid column. Every count
matched. Every asset resolved. It looked like a thumbnail. The user's reaction was *"the
hero is not identical, you put the hero image as a small in a box rounded, it's meant to
cover entire hero section."*

### For every element in the mockup, record its EDGE BEHAVIOUR

Content inventory answers "what". This answers "how big, and where does it stop":

```
element            containment          size relative to           corners
-----------------------------------------------------------------------------
hero photo         FULL-BLEED right     100% of section height     square (runs off)
services image     CONTAINED            16:9 inside the card       rounded, clipped
cta phone          BLEEDS top+bottom    overflows the panel        transparent cutout
aura background    FULL-BLEED both      larger than the section    none, fades out
```

Four values cover almost everything:

- **CONTAINED** - sits inside the content column, usually rounded and clipped.
- **BLEEDS \<edge>** - touches one or more viewport edges, square on those edges.
- **FULL-BLEED** - spans the entire section, edge to edge.
- **OVERFLOWS** - deliberately breaks out past its own container.

**A rounded corner is the tell.** If an element in the mockup has square corners on one
side, it is bleeding to that edge. If it is rounded on all four, it is contained. Read the
corners before writing any CSS.

### Then check the three things that are always wrong afterwards

1. **Does it actually reach the edge?** Measure `getBoundingClientRect().right` against
   `document.documentElement.clientWidth`. A full-bleed element nested inside a
   `position:relative` content wrapper resolves `right:0` to the *wrapper's* edge and stops
   short, which looks almost right and is wrong. Move it out to a direct child of the
   section.
2. **Does it run under the header?** A dark full-bleed panel starting at `top:0` puts the
   nav links on top of a photograph. Measure the nav text against the rendered pixels
   (Gate 5), or start the panel below the header as the mockup usually does.
3. **What does it collide with?** A bleeding panel will overlap whatever is beside it in the
   content column. Measure, and either narrow the panel or constrain the neighbour.

---

## PROMPT 1-R — Mockup generation FOR A REDESIGN

**Use this instead of PROMPT 1 whenever an existing site is being replaced.** Phase 1 is
never skipped on a redesign, and the existing site is never the reference. See SKILL.md
§4.7 and Gate 15.

The critical difference: the old design goes in as a **negative**. Passing it as a positive
reference (`-i old-site.png` with "modernise this") produces a recoloured clone every time,
because that is literally what was asked for.

Derive the *presentation* from `§0` against the subject. But **inventory the existing site
from the DOM first** (Gate 16) and carry every section, nav item, form field and portfolio
item into the prompt as an explicit numbered list with counts.

Two failure modes, and you must clear both:
- **Too similar** (Gate 15): you kept the old composition. A reskin.
- **Too little** (Gate 16): you dropped sections chasing novelty. A deletion.

The old site's section *order* is a decision someone else made and is fair game to change.
The old site's section *inventory* is the client's content and is not. An image model told
"a work section" invents three cards; told "eight named projects, listed here" it renders
eight. Always give it the counts.

```text
I need a really well-done mockup image of a <CATEGORY> landing page, as a full-page
screenshot-style capture covering every section from header to footer, as one tall image.

This is a REDESIGN. The existing site is attached ONLY so you know what to avoid. Do not
modernise it, do not refine it, do not use it as a starting point. I want a fundamentally
different page that solves the same job better.

Carry over ONLY these, exactly:
- the logo and company name
- the brand colour <HEX>
- the copy and the claims it makes

Change everything else, deliberately:
- a different section order, derived from <WHAT THE SUBJECT MUST PROVE>
- a different hero composition from the attached one
- a different type pairing and a much stronger type hierarchy
- a different grid and a different page rhythm
- a different imagery strategy

The page must prove: <THE 3-4 THINGS FROM §0 Q2>.
The single success action is: <THE ONE CTA>.

Constraints:
- Must NOT resemble the attached site in silhouette, section order or hero layout.
- Must not look like a generic template, a generic SaaS page, or an AI-generated concept.
- <ANY VERBATIM NEGATIVES FROM THE INTERVIEW>

Research <CATEGORY> sites that convert well and design something in that class.
```

> **Prefer describing the old design in words over attaching it.** Image models imitate what
> you attach far more reliably than they avoid it, so `-i old-site.png` plus "do not
> resemble this" often returns a tidier version of the attachment. Naming the specific
> things to avoid in prose ("do not put the headline left with a visual right, do not open
> on a dark hero") is more effective than any negative reference image. Attach the old
> design only when the user needs to see it accounted for.

### Checking the mockup before you build from it
Put the mockup and a screenshot of the old site side by side at 25% zoom, where only
silhouette and rhythm survive. If they read as the same page, regenerate with
*"this is still too close to the original, make it structurally different"*. Do not proceed
and hope the build diverges on its own. It will not.

Then fill in the Gate 15 table **from the mockup**, before writing any markup. If the mockup
cannot score 5 of 8 with axes 1 and 2 changed, the mockup is the problem and no amount of
careful building will fix it.

---

## PROMPT 2 — Spec extraction

Once the mockup exists, the user sends **this** in the same ChatGPT thread, with the
mockup attached. This is the prompt that converts a picture into a buildable brief.

```text
Extract this into a full prompt to recreate this design as real, readable code for a
complete landing page, including the full design system. Also give me prompts to generate
images for each of the sections in the design.

The extracted prompt must specify, concretely and with real values:
- exact section order, top to bottom
- page max width, content max width, and padding at desktop / tablet / mobile
- a full colour system as CSS custom properties (background layers, surfaces, accent,
  accent-muted, accent-border, text primary/secondary/muted, borders)
- typography: display family, body family, and a real type scale using clamp()
- border radii, border colours, shadow values
- per-section layout: grid columns at each breakpoint, gaps, image aspect ratios,
  card padding, button dimensions in px
- every piece of copy, verbatim
- hover, focus and entrance interaction behaviour with timings
- responsive behaviour per breakpoint
- accessibility requirements

All content must be readable, selectable HTML text. Do not bake text into images.
```

### Analysing the mockup: full resolution, one render per section

Two hard rules, both learned by shipping a section wrong:

1. **Crop at full resolution when identifying what a section contains.** A CTA band was
   built as a flat colour because it was read from a 760px-wide slice of an 1824px mockup;
   at that scale a photographed plaster wall with a vase and bowl looks like flat sand.
2. **Generate one standalone render per section, and count them.** Four renders were made
   for eight sections, and the three analysed from crops are exactly where the errors were.
   `07-failure-gates.md` Gate 4 has the assertion.

Measure the reference's own contrast too. Twice a supplied mockup failed AA on its own text
(1.06:1 and 3.12:1); copying it faithfully ships an inaccessible page. Gate 5.

### The critical follow-up
The user should then paste ChatGPT's extracted brief back to **you**. When they do:

> **Read the tail of that brief before you believe its stack.**
> ChatGPT will almost always specify React + TypeScript + Tailwind + Vite + Framer Motion
> and a `src/components/` tree. That is its boilerplate, not a requirement. The user's
> actual instruction is usually one line at the very end — *"End result a self contained
> HTML file fully responsive, interactive"*. That line wins. See SKILL.md §4.1.

Take from the extracted brief: the **design system values, section order, copy, and
proportions**. Discard: the framework, the file tree, the dependency list.

---

## PROMPT 3 — Image prompt pack (optional but recommended)

If the user wants generated photography, this is the third ChatGPT message. It produces a
reusable `.md` file of per-section prompts.

```text
Create a downloadable markdown file containing the complete image prompt pack for this
design.

It must open with a Character Bible: 2-4 original fictional people (founders, coaches,
members) with fixed, specific attributes — age, height, build, skin tone and texture,
face shape and asymmetry, hair, eyes, clothing, personality. Every later prompt references
these people by name so the same faces recur across the whole site.

Then one fully self-contained prompt per image slot. Each prompt must include: exact pixel
size and aspect ratio, where the subject sits in the frame, which region must stay as dark
negative space for text, camera body/lens/aperture, lighting setup, background activity,
colour grading, and explicit negative constraints.

End every prompt with the same global realism paragraph covering natural facial asymmetry,
visible pores, realistic teeth, individual hair strands, believable hands and anatomically
correct fingers, real fabric folds — and forbidding text, logos, watermarks, duplicated
people, malformed limbs, distorted equipment and impossible anatomy.

I should be able to paste any single prompt straight into an image model with nothing
added before or after it.
```

**Save the resulting file into the project** as `<project>/image-prompt-pack.md`. It is
the regeneration recipe — when the user later wants one image reshot, the character
consistency is already written down.

---

## Handing these over

Present all three in one message, in fenced blocks, numbered, with a one-line note on what
each returns and in what order. Then wait. Do not start building against an imagined
mockup — the whole point is to react to a real one.

While waiting, you can usefully do: folder scaffolding, the design-system CSS skeleton
from any values already known, and the local dev server.
