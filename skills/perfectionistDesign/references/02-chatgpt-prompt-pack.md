# Phases 1 & 2 — The ChatGPT Prompt Pack

These two prompts run in **ChatGPT** (image model + reasoning), not here. Hand them to the
user as copy-paste blocks in a fenced code block, filled in with their answers from Phase 0.

**Why this detour is worth it.** An image model asked for a full-page mockup will make a
hundred composition decisions — section order, image proportions, where the eye lands,
how much negative space the headline gets — that neither you nor the user would think to
specify. Reacting to a concrete composition beats inventing one from a text brief. This is
the single highest-leverage step in the pipeline.

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
