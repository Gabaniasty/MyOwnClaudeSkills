# dashboard

A local control panel for the perfectionistDesign pipeline. Prompt Claude, generate
images, run every gate, and deploy — from one page, with live progress.

```bash
node dashboard/server.mjs
# http://localhost:4180
```

Zero dependencies. Binds `127.0.0.1` only.

---

## You do not need an API key

This is the default, and it is the point. Both CLIs work off the subscriptions you
already pay for:

| | Sign in once | Cost per request |
|---|---|---|
| Claude (chat, building) | `claude` | none — your Claude plan |
| Images (Codex) | `codex login --device-auth` | none — your ChatGPT plan |

The dashboard checks both at startup and shows their status in Settings. In
subscription mode it **deletes any inherited `ANTHROPIC_API_KEY`** from the child
process environment — if one is exported globally it would silently bill you, which
is exactly what subscription mode is for.

API keys are available for anyone who wants them (Settings → *how to authenticate*),
but nothing here requires one except **Breeze, for deploying**.

---

## What each stage does

| Stage | What happens |
|---|---|
| **1. Brief & build** | Talks to Claude **in the project folder**, so it reads and writes the real files. Streams the reply token by token and shows every tool call. Threads continue across messages; *New thread* starts fresh. |
| **2. Generate images** | Runs `run-imagegen.ps1` over `scratch/prompts/*.txt`. Per-asset progress, live. Leave the box empty for everything, or list slugs to regenerate a few. |
| **3. Process assets** | Masters → variants, srcsets reconciled from disk, references audited both directions. |
| **4. Run the gates** | References, tag tree, markup faults, unused assets. Each reports its numbers. |
| **5. Preview & audit** | Opens the page from the project folder. *Copy browser audit* puts `audit.browser.js` on your clipboard — paste it into devtools and run `await pdAudit()` at each breakpoint. |
| **6. Deploy** | Stages a folder derived from the document, uploads to Breeze, then **HEAD-checks every asset on the live host**. A deploy tool's success message is not evidence the page renders. |

**Permission mode** on the chat controls what Claude may do without asking:
`auto-accept edits` (default), `plan only` (reads and proposes, writes nothing), or
`ask each time`.

---

## Where your keys live

`dashboard/.local/settings.json` — gitignored, never committed.

- Keys are **never sent back to the browser**. The UI only ever sees a masked form
  (`hk_Rt…GQQ (35 chars)`).
- Every job's output is **redacted** before it is streamed: a child process that
  echoes its own environment on error cannot leak a key into the page.
- *Test key* proves the Breeze key end-to-end against the control plane before you
  try to deploy, and reports the tenant it authenticated as.

Masking is not decoration. It is what caught a real bug where a repair script had
silently replaced one project's key with another's — the mask showed `hk_Mj…` where
the user had typed `hk_Rtj…`. See Gate 25.

---

## What it does not do

It does not replace Claude. The discovery interview, reading the mockup, deciding
the sections and writing the page all stay with the model — that is judgement, and
encoding it in a form would make it worse. This panel is the cockpit for everything
mechanical around that.

---

## Troubleshooting

**"The Claude CLI is not on PATH"** — install Claude Code, then run `claude` once to
sign in.

**Images fail immediately** — run `codex login --device-auth`. Check Settings; the
CLI status pills go red when a binary is missing.

**Deploy says the key was rejected** — open Settings and press *Test key*. A `401`
there means the control plane rejected it; re-copy it from the Breeze panel's
*Get my key*.

**A gate fails but the page looks fine** — read the Output panel. Then re-run that
one gate on its own. If it passes alone, the harness was wrong, not the page.
