# Phases 3 & 4 — Imagery and the Asset Pipeline

---

## 3.1 Codex CLI generates the images — this phase is automated

**Codex CLI ships an `imagegen` system skill.** It lives at
`$CODEX_HOME/skills/.system/imagegen` (default `~/.codex`), *not* in the plugin
marketplace. `codex plugin list` will not show it — do not conclude from that list that
image generation is unavailable. That mistake was made once and stated confidently.

Two modes, per its own SKILL.md:

| Mode | Model | Needs `OPENAI_API_KEY` | When |
|---|---|---|---|
| Built-in `image_gen` tool | `gpt-image-2` | **No** — ChatGPT auth covers it | default, always prefer |
| CLI fallback `scripts/image_gen.py` | `gpt-image-2` / `gpt-image-1.5` | **Yes** | only if the user explicitly asks, or for true native transparency |

Never silently downgrade built-in → CLI, or `gpt-image-2` → `gpt-image-1.5`. Ask first.

### Verify before promising

```bash
codex --version
codex login status                                  # "Logged in using ChatGPT" is enough
ls "$CODEX_HOME/skills/.system/imagegen/SKILL.md"    # ~/.codex on default installs
```

If absent: `npm install -g @openai/codex`, then `codex login`.

### Driving it

```bash
codex exec --skip-git-repo-check -C "<project>" -s workspace-write \
  -o "<scratch>/result.txt" "<prompt>"
```

- `-C` sets the working directory; `-s workspace-write` is required or it cannot save files.
- `-o` captures the final message — read it for the saved path.
- `-i <FILE>` passes reference images, which is how you enforce character consistency
  across a set (see §3.2).
- Long runs: launch in the background and do other work while it generates.

**Save-path trap — this recurred three times after being written down.** In built-in mode
Codex writes to `$CODEX_HOME/generated_images/<session>/exec-<uuid>.png` and only copies
into the project **at the very end of the run**. Mid-run that is indistinguishable from a
hang, and a user watching an asset count will report it as stuck.

The prompt must name an explicit in-project destination, **and** the moment anyone asks why
files are missing you run the lookup in `07-failure-gates.md` Gate 8 *before* answering.
Do not report "still generating" based on the process existing — see Gate 7.

### Codex also earns its place as an adversarial reviewer
A second agent with no memory of your reasoning catches the bugs you rationalised:

```bash
codex exec -C "<project>" -s read-only "Review index.html as a senior frontend engineer.
Find: contrast failures, layout breakage under 400px, images that can be clipped invisible
by reveal animations, focus traps that do not restore, and any <source> in a <picture>
whose file is missing. List concrete defects with line numbers."
```

### Where ChatGPT web still wins
The `02-chatgpt-prompt-pack.md` route stays valid when the user prefers to art-direct
interactively and iterate on a mockup conversationally. Codex automates; the web UI gives
tighter human control. Offer both; default to Codex when the user asks for automation.

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

> **Never hand-write a variant width into HTML.** `withoutEnlargement` silently skips any
> width above the master, so a requested 1200w against a 1086px master produces no file —
> and when that width is your `src` fallback, you ship a broken image. This happened twice
> in one project (`hero-dentist-1200`, then `cta-band-2000`), the second time after the rule
> was already written down. Derive the list from `metadata()`, and always emit the master's
> own width as the widest honest variant. See `07-failure-gates.md` Gate 3.

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
