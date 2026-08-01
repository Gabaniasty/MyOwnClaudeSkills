# Build-run findings

Issues observed while the user drove a full build through the dashboard.
Nothing here is fixed yet — this is the ledger we work through afterwards,
and the source for the skill/gate updates that follow.

**Rules for this file**
- One finding per entry. Evidence before conclusion.
- Record what was *measured*, not what it looked like. A quote from
  `telemetry.jsonl`, a job id, a file count, an exact error string.
- If a finding turns out to be the watcher's fault or a harness artifact,
  do not delete it — mark it `NOT A BUG` and say what it actually was.
  Those are worth as much as the real ones (six phantom failures in one
  earlier session were all reported as real).
- `Skill impact` is the important field. If a finding does not change a
  rule, a gate or a script, say so explicitly.

---

## Template

### F-00 — one-line title
- **Phase:** 0 interview / 1 mockup / 2 extract / 3 images / 4 assets / 5 build / 6 verify / 7 ship
- **Severity:** blocker | wrong-output | friction | cosmetic
- **Evidence:** job id, telemetry line, exact string
- **What happened:**
- **Root cause:** (only once actually established — otherwise write `not yet established`)
- **Skill impact:** new gate / edit to <file> / dashboard fix / none

---

## Findings

> **BASELINE NOTE (added by the main session, after F-01/F-02/F-03 were written).**
> F-01, F-02 and F-03 were all recorded against the **pre-existing** `strauss`
> project, before the user's build run had started. They describe history, not
> this run. Dates settle it:
>
> | | timestamp (UTC) |
> |---|---|
> | `strauss/images/_masters/_mockup.png` created | **2026-07-31 21:38:58** |
> | Gate 39 written and committed (`3dc0d93`) | **2026-08-01 11:54:50** |
>
> The mockup predates the rule by ~14 hours, so **F-01 is not a Gate 39 escape**
> — a gate cannot be violated by work finished before it existed. Re-classified
> **NOT A BUG**. Its one useful suggestion still stands on its own merit and is
> tracked separately as F-04.
>
> Everything above the "LIVE RUN" heading is baseline. Only findings recorded
> after that heading describe the user's actual build.

---

### F-01 — strauss shipped with exactly 1 mockup master, not the Gate 39 minimum of 2
- **RE-CLASSIFIED: NOT A BUG** (pre-dates Gate 39 by 14 hours — see baseline note above)
- **Phase:** 1 mockup (already left; project has a built, deployed index.html)
- **Severity:** wrong-output
- **Evidence:**
  - telemetry `project_shape` for `strauss` (multiple ticks, e.g. 12:07:26.589Z and 12:07:56.713Z): `"mockupPrompts":1,"mockupImages":1"` against `"masters":12` total (11 non-mockup + 1 mockup).
  - Filesystem confirms: `C:/Users/lokalnyczit/pd-projects/strauss/scratch/prompts/` contains exactly one file matching `*mockup*` (`_mockup.txt`); `images/_masters/` contains exactly one (`_mockup.png`, 2,295,950 bytes per the attempt log).
  - No `_mockup2`, `_mockupB`, or any second variant prompt/result file exists anywhere under `strauss/scratch/`.
  - `_mockup.png` mtime 2026-07-31 21:38:58 UTC; `index.html` mtime 2026-08-01 11:07:27 UTC — the single-mockup build was already completed and shipped before this observation session started (session started 12:07 UTC today).
- **What happened:** Gate 39 (references/09-phase-entry-checks.md) requires "at least 2 mockups... every new website, every redesign," with an explicit exception only "if the user supplied a reference image of the new design, or explicitly asked for one." Strauss's mockup prompt (`scratch/prompts/_mockup.txt`) is a fully-specified, single, self-contained generation task with the header "Do NOT invoke brainstorming, planning, design-review or approval-gate skills. Do NOT ask questions. Generate the image immediately" — i.e. it was authored to explicitly skip the compare/choose step, not to answer a question the user asked for a second time.
- **Root cause:** not yet established whether the user explicitly requested a single mockup (which would make this compliant under the stated exception) — I have no interview transcript or chat log for the phase-0/phase-1 exchange, only the generation-task prompt and its result. Flagging as a likely Gate 39 violation, not a confirmed one.
- **Skill impact:** if no user override is found, this is a real Gate 39 escape — the phase-1 entry checklist in `09-phase-entry-checks.md` needs a mechanical count check (`ls scratch/prompts/*mockup*.txt` must return >=2 before extraction starts, printed as a number) rather than relying on the agent to recall the rule.

### F-02 — job 1 (chat, strauss) recited the Gate 39 rule in the abstract rather than reporting this build's actual mockup count
- **Phase:** unclear — a `chat` job, not tied to a visible phase
- **Severity:** friction
- **Evidence:** `/api/job/1` reply (confirmed identical across three polls, elapsed climbing 285949 -> 316072 -> 375680 -> 430482ms while `status` stayed `"ok"` and `done:1/1`): *"The pipeline requires at least two mockups per Gate 39 ... The user chooses ... then stop and wait for their pick before building."*
- **What happened:** The reply states the policy correctly but does not state how many mockups THIS project (strauss) actually has, even though the on-disk answer is 1 (see F-01). I do not have the user's prompt text for job 1 (the dashboard API does not expose it, only `reply`), so I cannot confirm whether the user asked "what is the rule" (answer would be fine) or "did you follow the rule here" (answer would be evasive).
- **Root cause:** not yet established — missing the prompt text.
- **Skill impact:** none until the prompt text is available to confirm which question was actually asked. UNCONFIRMED.

### F-03 — `/api/state` and `/api/job/<id>` report `elapsed` still climbing on a job marked `status:"ok", done:1/1`
- **Phase:** n/a (dashboard/API behavior, not the build pipeline)
- **Severity:** cosmetic
- **Evidence:** job id 1: elapsed 285949ms (12:07:26 poll) -> 316072ms (12:07:56) -> 430482ms (12:09:53), status/done unchanged at `"ok"`/`1/1` throughout.
- **What happened:** `elapsed` is being computed live as `now - startedAt` regardless of completion state, instead of being frozen at the time the job finished. Purely a display artifact — the job itself completed once (`reply` and `site` fields are stable/identical across polls).
- **Root cause:** established — server-side `elapsed` calculation does not check job status before computing duration.
- **Skill impact:** none (dashboard bug, out of scope for the skill itself). Marking `NOT A BUG` with respect to the build pipeline — recorded so nobody chases job 1 as a hung job.



### F-04 — Gate 39's mockup count is asserted, never counted
- **Phase:** 1 mockup
- **Severity:** friction (a real gap, surfaced while investigating F-01)
- **Evidence:** `09-phase-entry-checks.md` "Entering Phase 1" asks the agent to
  confirm "How many am I generating? 2 minimum" — a self-report. Nothing in the
  pipeline ever counts the files on disk and prints the number.
- **What happened:** the skill's own rule (SKILL.md §4.6) is that a prose rule is
  not a control; only a check producing a number you must report is. Gate 39 is
  currently prose in four files plus a system prompt. It is the one gate with no
  number attached.
- **Root cause:** established — no mechanical count exists.
- **Skill impact:** add a count to the Phase 1 entry check and to `run_gates`:
  `count(scratch/prompts/_mockup*.txt) >= 2`, reported as a number, before Phase 2
  may start. Deferred until after the live run so we do not change the pipeline
  mid-build.

---

# LIVE RUN
_(findings below this line describe the user's actual build)_

### F-06 — a genre name leaked into a variant label ("editorial index")
- **Phase:** 1 mockup
- **Severity:** friction (real, but confined to a label)
- **Evidence:** the agent's Phase-1 presentation, verbatim: *"Variant B — The Grid of
  Nights (editorial index)"*, *"A newspaper-style editorial page"*.
- **What happened:** Gate 38 bans recognisable genres as a design DIRECTION and lists
  editorial explicitly. The device under Variant B is legitimate (the week's schedule
  rendered as a dense typographic index); it was simply labelled with a genre instead
  of described as itself. Variants A ("The Projection Cone") and C ("The Showtime
  Ladder") are clean — both name load-bearing devices with no genre word.
- **Root cause:** established. Gate 38 forbids genres as a direction and permits them
  as "vocabulary for discussing design". That second clause is too loose: it lets a
  genre word attach itself to a variant NAME, which is what the user reads and reacts
  to. The user did react, immediately and correctly.
- **Skill impact:** tighten Gate 38 — genre words are allowed in *your own reasoning*,
  never in a label, heading or variant name shown to the user. Add to the Phase 1 entry
  check: grep the presentation text for editorial/Swiss/brutalist/punk/minimal/
  premium-consumer/glassmorphism before sending, and rename any hit after its device.

### F-07 — Gate 39 says "same device, different stagings"; the agent did better
- **Phase:** 1 mockup
- **Severity:** friction (the SPEC is wrong, not the behaviour)
- **Evidence:** Gate 39 as written: *"Each option is a different **staging of the same
  signature device**, never a different genre."* What the agent produced: three
  genuinely different devices — projection cone, typographic index, showtime ladder.
- **What happened:** the agent's interpretation gives the user a real choice between
  ideas. Three stagings of one idea would have been a narrower question, and at Phase 1
  the idea itself is exactly what is still open. The user picked C, a device none of the
  other two shared — a choice the rule as written would have prevented from existing.
- **Root cause:** established — my spec over-constrained the variation axis. I wrote it
  to prevent "three genres" and accidentally banned "three ideas" too.
- **Skill impact:** rewrite Gate 39's variation rule. Different DEVICES are the good
  case at Phase 1. Keep the real constraint: hold section list, copy and palette
  identical so the comparison is about the idea, and keep the ban on telling variants
  apart by genre. Also fix the same wording in `02-mockup-prompt.md` §0.8, the dashboard
  SYSTEM prompt, and the generate_mockup tool description (Gate 40 — four surfaces).

### F-08 — probe-image.cjs could not find sharp, and silently degraded to "0x0"
- **Phase:** 3 images
- **Severity:** blocker (a safety check that passed everything)
- **Evidence:** every probe returned `0x0`, including on known-good files: the
  generated logo, and four freshly generated 256x256 PNGs confirmed valid by sharp
  directly (`256x256 png 4ch`). Runner output read `OK beta 0x0 1 KB`.
- **What happened:** the script walked up from `__dirname` only. The skill installs
  to `~/.claude/skills/perfectionistDesign/scripts/`; sharp lives at the workspace
  root `~/pd-projects/node_modules/sharp`. Those two trees never meet, so the lookup
  always failed, `require("sharp")` threw, and every call fell through to the
  magic-bytes branch, which prints `0x0`.
- **Why it was invisible:** the runner accepts any probe output matching
  `^\d+x\d+$`. `0x0` matches. So a dead check reported as a passing one, and printed
  something that looks like a real dimension read.
- **Root cause:** established. Its own header says "Resolving sharp is _config.cjs's
  job. Reuse it rather than guessing a path" - and then it guessed a path.
  `_config.cjs` walks up from the PROJECT root and works.
- **Fix applied:** walk up from the image's own directory first (always inside the
  project, so it reaches the workspace root) then from `__dirname`. Degraded output
  is now `0x0-nosharp`, which does NOT match the accept regex, so a downgrade can
  never again be mistaken for a pass.
- **Skill impact:** new gate. A fallback must not emit a value its own caller treats
  as success. Also: every helper resolving a dependency must resolve it the same way
  `_config.cjs` does.

### F-09 — the probe never verified what it claimed: metadata() is not a decode
- **Phase:** 3 images
- **Severity:** blocker
- **Evidence:** a valid 256x256 PNG truncated to 300 bytes returned `256x256`,
  exit 0, ACCEPTED. Header comment claims it verifies "a real decodable image, not
  a truncated write".
- **What happened:** `sharp().metadata()` reads the PNG IHDR header - the first ~33
  bytes - and returns the DECLARED dimensions. It never touches the pixel data, so
  a file cut to any length past the header passes. The one failure mode the check
  names is the one it cannot see.
- **Root cause:** established - measuring the wrong property. This is Gate 1's shape
  (a real measurement standing in for a different claim) applied to file integrity.
- **Fix applied:** chain `sharp(file).stats()`, which forces a full decode. Measured
  after: valid -> `256x256` accepted; truncated -> `BAD` rejected; garbage -> `BAD`
  rejected. Cost 140ms on a 1.9MB master.
- **Skill impact:** fold into the same new gate as F-08.

### F-10 — image generation was strictly sequential; parallelised
- **Phase:** 3 images
- **Severity:** friction
- **Evidence:** 18 prompts x ~212-330s observed = 60-100 min for one project.
  `run-imagegen.ps1` used a plain `foreach ($slug in $order)`.
- **Fix applied:** `-Parallel N` (default 3 via `PD_IMAGE_PARALLEL`). The supervisor
  splits the queue round-robin and runs N copies of itself, relaying output verbatim
  so the dashboard's line parser is unchanged (it keys by slug, so interleaving is
  harmless). Measured on 4 images: 121s wall clock, 3 workers.
- **The Gate 27 hazard, and why it is safe:** the recovery fallback "newest png
  anywhere under CODEX_HOME" is annotated in-code "ONLY sound when a single
  generation is in flight" - with 2 workers it would hand one slug the image another
  just wrote. Right filename, wrong picture, no error. Workers are therefore forced
  to `-Strict`, which disables that fallback and leaves only the session-id-scoped
  recovery, which is an exact mapping. `-Strict` is now passed UNCONDITIONALLY from
  server.mjs; it was previously only passed for partial runs.
- **Skill impact:** Gate 27 should state that parallel generation requires an exact
  mapping to be ENFORCED, not merely available.

### F-11 — server computes the slug list, then throws it away
- **Phase:** 3 images
- **Severity:** friction (latent; harmless only by luck)
- **Evidence:** runner log on the parallel restart: `parallel: 3 workers over 21
  slugs`, and each worker queue ends with a mockup:
  `worker queue (7): coming-01-amber-room, ..., _mockup_a`.
  The dashboard job meanwhile tracks 18 (`done 0/18`).
- **What happened:** `jobGenerate` builds the slug list and correctly filters
  `!s.startsWith("_mockup")` - then only passes `-Slugs` when `only` was supplied.
  On a full run it passes no slug list at all, so run-imagegen re-globs the prompts
  directory and picks up all 21, mockups included. Two different ideas of the work
  set in one job.
- **Why it did no damage here:** the three mockups already existed, so the runner
  hit `if (Test-Path "$Masters/$slug.png") { SKIP }`. Had they been absent - a
  regenerate, a cleaned masters folder - they would have been re-rendered as part
  of an ordinary image run, at ~5 min each, and landed in the shipped image set.
- **Root cause:** established - the filtered list is used for progress reporting
  only, never for the actual command.
- **Skill impact:** pass the computed list every time (`-Slugs <computed>`), so the
  server's idea of the work set and the runner's are the same object. Deferred: the
  fix needs a server restart and a generation run is in flight.

### F-12 — the mockup prompt captured how the data LOOKS and dropped that it must be REAL
- **Phase:** 1 mockup (damage lands in Phase 5)
- **Severity:** blocker (would ship a page making a false claim about itself)
- **Evidence:** the brief, verbatim: *"connected to a open source API which will
  display available movies"*, *"Find some open source api thats best TMDB"*,
  *"showtimes from API"*, *"all frontend no backend functionality"*.
  All 6 TMDB references in the working session are decorative strings inside the
  mockup prompts:
    - `a small monospace pill reading "DEMO SITE . showtimes are illustrative . TMDB metadata"`
    - `Bottom line ... "Powered by TMDB. This is a design demo - no real tickets are sold."`
  Zero references to fetch, endpoints, an API key, or rendering live results.
- **What happened:** Phase 1 turns the brief into an IMAGE prompt. A functional
  requirement has no visual form, so "fetch real movies from TMDB" survived only as
  the thing it looks like: a credit line. Phase 2 then extracts the design system
  FROM THE IMAGE, so by Phase 5 the only surviving trace is a label. The build would
  render invented films under a "Powered by TMDB" credit - a fabricated factual claim
  about its own data source, which SKILL.md 4.3 explicitly bans.
- **Root cause:** established, and structural rather than a slip. The pipeline's
  whole premise is that the mockup is the spec. That works for everything visible
  and silently discards everything behavioural: data sources, auth, no-backend
  constraints, deploy targets, integrations.
- **Skill impact:** NEW GATE. The interview must produce a short FUNCTIONAL CONTRACT
  that travels separately from the mockup and is re-read at Phase 5:
    - data: real API / static fixtures / invented
    - if real: which API, called from where (client or server), key handling
    - backend: yes / no
    - deploy target
  Plus a hard rule: a page may not display a provider's name, logo or "Powered by X"
  unless it actually consumes that provider. Attribution is a factual claim.
  Also: two brief items ("all frontend no backend", "deploy to breeze") never crossed
  the project switch at all - the interview ran under one project label and the build
  under another, and nothing carried the brief across (see F-05).

### F-13 — stopping a job silently kills the chat that started it
- **Phase:** n/a (dashboard)
- **Severity:** wrong-output
- **Evidence:** `POST /api/stop` returned `{"ok":true,"killed":2}` when one
  generation job was targeted. Jobs #7 (chat) and #8 (generate) both died.
- **What happened:** stop kills the whole job group. The orchestrating conversation
  goes with the work it launched, and nothing in the UI says so - the agent simply
  never speaks again. The user reads that as "stuck" (they did).
- **Root cause:** established.
- **Skill impact:** dashboard fix. Either stop only the targeted job, or state
  plainly in the chat that the conversation was ended and must be resumed.

### F-14 — the composer latched disabled and could not recover
- **Phase:** n/a (dashboard)
- **Severity:** blocker (user could not send a message at all)
- **Evidence:** reproduced deliberately - `setBusy(true)` with no running job gives
  `sendDisabled: true`, `sub: "working…"`, and no path back except a page reload.
- **What happened:** `busy` gates the Send button and was cleared ONLY by a
  `chat:done` SSE event. A server restart, a killed job or a dropped connection
  means that event never arrives, so the lock is permanent and the UI keeps
  claiming it is working.
- **Root cause:** established - the client treated an event stream as the source of
  truth. The server knew nothing was running the whole time; the client never asked.
- **Fix applied:** `reconcileBusy()` re-syncs against `/api/state` on every SSE
  reconnect and every 15s. Releases the lock when nothing is running, re-attaches
  when something is, and prints a note explaining the turn ended. Verified: stuck
  state -> recovered, Send re-enabled, note shown.
- **Skill impact:** new gate candidate. Any UI lock set by an event MUST have a
  reconciliation path against authoritative state. An event is a notification, never
  the source of truth.

### F-15 — stage reported "passed" for a folder that could not run
- **Phase:** 7 ship
- **Severity:** blocker (site 404'd; three deploys wasted)
- **Evidence:** stage log for lumen-cinema: `runtime files : index.html`.
  Same script for strauss earlier: `runtime files : index.html, serve.mjs, package.json`.
  Project root confirms lumen-cinema has neither serve.mjs nor package.json.
  Live URL returned `404 page not found` from Breeze's router while
  strauss.apps.breezedeploy.dev returned 200 (control).
- **What happened:** the staged folder was index.html + images with no server and
  no package.json, so Nixpacks produced a container that never listened on a port
  and Breeze had nothing to route. The stage step reported `ok ... passed` anyway.
- **Root cause:** established. Gate 26 checks `referenced === copied` - that every
  ASSET made it. It never checks the folder is RUNNABLE. A deploy folder has two
  requirements and only one was gated. The project also scaffolded without runtime
  files, which is the upstream cause; strauss had them, lumen-cinema did not.
- **Fix applied:** copied dashboard/templates/serve.mjs and a package.json into the
  project, restaged (`runtime files : index.html, serve.mjs, package.json`),
  redeployed. Live 200, document byte-identical, 46/46 assets 200.
- **Skill impact:** extend Gate 26. Staging must assert a runtime exists:
  package.json with a start script AND the file that script runs, or an explicit
  static-host marker. Report it as a number/list like `referenced === copied`.
  Scaffold must create the runtime files for every new project, not just some.

### F-16 — Gate 36 was written this morning and not implemented; deploy verified 14s after upload
- **Phase:** 7 ship
- **Severity:** wrong-output (3 false failures on a working deploy)
- **Evidence:** jobs #7, #8, #9 all `fail` at `verify live`, two with `fetch failed`
  and one with `HTTP 404`, elapsed 14s from upload. The same URL returned 200 on a
  later manual retry once the build had finished.
- **What happened:** Breeze returns status `running` immediately and builds
  asynchronously. The deploy step verifies straight away, so it measures a
  container that does not exist yet and calls the deploy failed.
- **Root cause:** established, and it is mine. Gate 36 ("a fresh deploy's first
  requests are cold starts, not 404s - warm the host, retry every non-200 before
  believing it") was written into 07-failure-gates.md at 11:xx today and never
  implemented in dashboard/server.mjs. SKILL.md 4.6 says a prose rule is not a
  control; this is that failure, committed hours after documenting it.
- **Skill impact:** implement Gate 36 in the deploy job: poll the URL until 200 or
  a real timeout (90s+), retry every non-200 once before recording it, and only
  then run the asset sweep. A gate that exists only as prose in a reference file
  is not a gate.

### F-17 — the built page shipped 48 contrast failures; gates passed anyway
- **Phase:** 5 build / 6 verify
- **Severity:** wrong-output
- **Evidence:** canvas-resolved sweep of the deployed page, 262 text elements
  checked, 48 below AA. Tightest 1.49:1 (ticker "/" separators), and real copy at
  3.84:1 ("Cinema . Two Rooms"). Job #5 `gates` reported `ok 5/5`.
- **What happened:** the gates run reported PASS on a page with 48 AA failures.
  Either the contrast gate is not in the dashboard's run_gates set, or it ran with
  the old broken parseColor. Not yet separated - both are plausible and the fix
  differs.
- **Root cause:** ESTABLISHED. Three failures compounding:
  1. scripts/check-contrast.cjs is STATIC (token pairs only). It exits 0, so
     the step shows "ok", while its own output says: *"NOT COVERED HERE: text over
     photographs, gradients, color-mix() or any translucent ground... Do not
     report 'contrast OK' on the strength of this file alone."*
  2. It DID flag "unsafe pairs : 2" (--ink-dim on --surface 2.61, on --ground
     2.9) - and the dashboard's summary regex only matches
     MISSING|CORRUPT|UNUSED|faults, so that number never reached the user.
  3. scripts/audit.browser.js, the rendered-pixel pass that catches all 48, is
     NOT in the gates array. The pipeline owns the right tool and never runs it.
- **Skill impact:** new gate. A tool's own caveat is part of its result: if a
  script prints a limitation or a non-zero count, the runner must surface it and
  must not report PASS. And the gates set must include the rendered-pixel
  contrast pass, because SKILL.md 6 requires contrast measured against rendered
  pixels and the static file explicitly cannot do that.

### F-18 — an interactive flow was specified and delivered as a still picture
- **Phase:** 5 build
- **Severity:** wrong-output (the primary action of the whole site did nothing)
- **Evidence:** the brief said "primary action book a ticket". The delivered page
  had `#seat-map` rendered with `selectedSet = new Set(['F7','F8','F9'])`
  hardcoded, no click handler on any seat, a summary in static HTML reading
  "Adult x 3 / EUR 34.50", and a "Confirm booking" button with no listener.
  Reserve buttons only called scrollIntoView.
- **What happened:** the mockup showed a seat map, so a seat map was built - as an
  image of one. Every visible element from the mockup was present and nothing
  behind them worked. It LOOKS complete in a screenshot, which is exactly why it
  survived to deploy.
- **Root cause:** established, and it is the same structural gap as F-12. Phase 2
  extracts the design system FROM THE IMAGE. An image cannot express behaviour, so
  behaviour is not extracted, and the build satisfies the mockup completely while
  satisfying the brief not at all.
- **Skill impact:** the FUNCTIONAL CONTRACT from F-12 must also enumerate every
  INTERACTION the page owes, and Phase 6 must exercise each one and report a
  number. "Renders" is not "works". A control with no listener is a defect even
  when it is pixel-perfect.

### F-19 — Gate 42, once implemented, immediately surfaced 3 hidden findings
- **Phase:** 6 verify (validation of the fix, not a new defect)
- **Evidence:** same project, same gates, before and after the summariser fix.
    before : gates ok 5/5, every step "ok", no numbers shown
    after  : [WARN] references        UNUSED: 66
             [WARN] contrast (static) FAILING: 0  unsafe pairs: 2  · partial check
             [WARN] unused assets     unused: 66
- **What this proves:** the counts were always being produced. The runner's regex
  matched only MISSING|CORRUPT|UNUSED|faults and rendered anything unmatched as a
  clean pass, so "unsafe pairs: 2" and the tool's own "NOT COVERED HERE" caveat
  never reached a human. 66 unused image variants were shipped past every run.
- **Skill impact:** confirms Gate 42. Also raises a separate question worth its own
  look later: why 66 of the processed variants are unreferenced - either the srcset
  reconciliation is over-generating, or the build dropped images the mockup implied.
  Not diagnosed; recorded so it is not lost.
