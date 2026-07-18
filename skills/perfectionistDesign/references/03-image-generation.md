# Phases 3 & 4 — Imagery and the Asset Pipeline

---

## 3.1 What generates images — read this before promising anything

**Codex CLI does not generate images.** Verified against v0.144.6: its subcommands are
`exec`, `review`, `login`, `mcp`, `plugin`, `sandbox`, `apply`, `resume`, `cloud`; its
bundled plugins are `documents`, `pdf`, `spreadsheets`, `presentations`,
`template-creator`, `browser`, `visualize`. None of them produce images. Do not tell the
user otherwise.

Image generation happens in **ChatGPT** (web UI, image model), driven by the prompt pack
from `02-chatgpt-prompt-pack.md`. That is what actually worked.

### Where Codex CLI genuinely earns its place
It is a second, independent coding agent authenticated to the user's ChatGPT account. Use
it for **adversarial review** — a fresh pair of eyes with no memory of your reasoning, which
is exactly what catches the bugs you rationalised:

```bash
# Independent review of the built page
codex exec "Review <path>/index.html as a senior frontend engineer. Find: contrast
failures, layout breakage under 400px, images that can be clipped invisible by reveal
animations, focus traps that do not restore, and any <source> in a <picture> whose file
is missing. List concrete defects with line numbers. Do not restate what the code does."
```

Check availability first; never assume it is installed:

```bash
codex --version          # confirm present
codex login status       # confirm authenticated
```

If absent: `npm install -g @openai/codex`, then `codex login`.

### If image generation must be automated
Add an image-capable MCP server to Codex (`codex mcp`) or use the local
`imagegen-frontend-web` skill for prompt construction. Do not invent a capability.

---

## 3.2 The Character Bible (non-optional for generated people)

Any site showing the same brand's people across multiple sections needs fixed characters,
written once, referenced by name in every prompt. Without it every section shows different
strangers and the brand reads as fake instantly.

Store at `<project>/image-prompt-pack.md`. Shape:

```markdown
## Founder 1 — <Name>
A fictional <age>-year-old <role>.
- Height: approximately <n> cm
- Build: <specific, with realistic body fat>
- Skin: <tone> with <freckles / visible pores / texture detail>
- Face: <shape>, <a specific asymmetry — a crooked nose, uneven smile>
- Hair: <colour, cut, texture, how it moves>
- Eyes: <colour>
- Clothing: <exact garments, colours>
- Personality: <how it should read in body language>
```

The specific asymmetry matters more than anything else in the entry. "Slightly crooked
nose" and "mild facial asymmetry" are what stop the image model producing a waxy,
hyper-symmetrical AI face.

### The global realism paragraph
Append to every people prompt, verbatim:

> All people must be original fictional characters with no resemblance to celebrities,
> influencers or identifiable real individuals. Render them as ultra-photorealistic,
> believable everyday human beings with natural facial asymmetry, visible pores, fine
> facial hair, realistic teeth, subtle under-eye texture, natural wrinkles, individual
> hair strands, slight skin variation, believable hands, anatomically correct fingers and
> authentic body proportions. Avoid model-perfect faces, identical facial structures,
> plastic skin, exaggerated muscles, unnaturally narrow waists, oversized shoulders, fake
> smiles or glossy commercial retouching. Clothing must show real folds, seams, compression
> and natural fabric behavior. Photograph using realistic full-frame camera optics, natural
> depth of field, restrained sharpening, soft highlight roll-off, realistic shadows and
> neutral cinematic color grading. No text, logos, watermarks, duplicated people, malformed
> limbs, distorted equipment, floating weights or impossible exercise form.

### Never ask an image model to render website text
It produces garbled glyphs. All copy is real HTML. Logos are inlined SVG.

---

## 3.3 Hero composition rule

Specify the **safe area** in the prompt, not afterwards:

> Preserve the left 42% of the image as deep, softly detailed negative space suitable for
> large white website typography and buttons. Subjects occupy the right 60-82% of the frame.

Then, before building, **measure where the subjects actually landed** — the model
approximates. Crop the source to the region you believe holds the faces, write it to a
scratch file, and look at it. Record the result in `credits.json`:

```json
"faceBand": "Both faces occupy x 58-87%, y 7-32% of the source. Measured off the file,
             not estimated. Any future crop must keep that rectangle whole."
```

That band is then a hard constraint for every breakpoint. `05-verification-protocol.md` §4
has the check.

---

## 3.4 Asset pipeline (Phase 4)

`sharp` is the tool. Install at the workspace root, not per project.

```js
// scripts/optimise.cjs  — write a file; do not fight node -e quoting
const sharp = require("sharp");
const path = require("path");

const SRC = "images/_masters";
const OUT = "images";

const jobs = [
  { file: "hero.png",    slug: "hero-founders", widths: [800, 1200, 1672] },
  { file: "program1.png", slug: "prog-strength", widths: [520, 800] },
];

(async () => {
  for (const j of jobs) {
    const input = path.join(SRC, j.file);
    const meta = await sharp(input).metadata();
    for (const w of j.widths) {
      if (w > meta.width) continue;
      const base = sharp(input).resize({ width: w, withoutEnlargement: true });
      await base.clone().jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toFile(path.join(OUT, `${j.slug}-${w}.jpg`));
      await base.clone().webp({ quality: 80 })
        .toFile(path.join(OUT, `${j.slug}-${w}.webp`));
    }
    console.log(`${j.slug}: ${meta.width}x${meta.height} -> ${j.widths.join(",")}`);
  }
})();
```

**Settings:** WebP q78-80, progressive JPEG q82 with mozjpeg. Typical saving is 20x or
better — a 1,971 KB PNG hero became 81 KB.

**Widths:** derive from the *rendered* CSS size, not from guesswork. A card that renders
at 579px needs a 620w and a 900w; a lightbox that renders at 1177px needs a 1400w.

### Markup
```html
<picture>
  <source type="image/webp"
          srcset="images/x-620.webp 620w, images/x-900.webp 900w, images/x-1400.webp 1400w"
          sizes="(min-width:1024px) 46vw, (min-width:640px) 46vw, 92vw" />
  <img src="images/x-900.jpg"
       srcset="images/x-620.jpg 620w, images/x-900.jpg 900w, images/x-1400.jpg 1400w"
       sizes="(min-width:1024px) 46vw, (min-width:640px) 46vw, 92vw"
       width="1604" height="980" alt="<meaningful>" loading="lazy" decoding="async" />
</picture>
```

Always set `width`/`height` (reserves layout), `loading="lazy"` except the hero,
`fetchpriority="high"` on the hero.

### Naming trap
**Name optimised files after the person or slot they actually depict, and verify by opening
one.** Two transformation sets were once optimised into files named for the wrong people —
`tr-michael-*` held a woman — so both cards carried the wrong name and the filenames stayed
a trap for whoever touched it next. Renaming only the labels would have hidden it. Check
the bytes.

### Folder layout
```
<project>/
├── index.html
├── images/
│   ├── <slug>-<width>.{jpg,webp}     # optimised, referenced
│   ├── credits.json                   # the ledger
│   ├── _masters/                      # source PNGs — NOT deployed
│   └── _superseded/                   # retired placeholders — NOT deployed
└── image-prompt-pack.md
```

`_masters/` is routinely 20-30 MB. It belongs in git, never in a deploy.
