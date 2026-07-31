# dashboard

One chat window. You talk to **Perfectionist**, and you watch it work.

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
| Claude — the agent | `claude` | none, your plan |
| Images — Codex | `codex login --device-auth` | none, your plan |
| Breeze — deploying | key in Settings | — |

The dashboard checks both at startup and shows their status in Settings. In
subscription mode it **deletes any inherited `ANTHROPIC_API_KEY`** from the child
process environment — if one is exported globally it would silently bill you, which
is exactly what subscription mode exists to avoid.

API-key mode is there for anyone who wants it. **Breeze is the only key this needs
at all, and only to deploy.**

---

## How it works

Perfectionist runs the Claude Code CLI **inside the project folder**, so it reads and
writes the real files. Its reply streams in token by token. Everything it touches
shows up as it happens:

- **trace lines** — `read …/demo/index.html`, `edited …/images/hero.jpg`
- **activity cards** — a live progress bar with per-item state, so "generating image
  7 of 34" is visible rather than inferred

It drives the pipeline itself through MCP tools rather than shelling out:

| Tool | What the card shows |
|---|---|
| `generate_images` | one row per asset, live, with size and time |
| `process_assets` | masters → variants, srcsets, reference audit |
| `run_gates` | each gate and its numbers |
| `stage_build` | the derived deploy folder, with `referenced === copied` |
| `deploy` | stage → connect → authenticate → upload → verify live |

Going through MCP is what makes progress visible. If the agent just ran the scripts
through Bash, you would see one opaque tool call and a wall of text half an hour
later.

**Deploy** also sits in the header for when you just want to ship.

**Permission mode**, next to the composer: *build freely* (default) lets it write;
*plan only* lets it read and propose but never write.

---

## Where your keys live

`dashboard/.local/settings.json` — gitignored, never committed.

- Keys are **never sent back to the browser**. The UI only ever sees a masked form
  (`hk_Rt…GQQ (35 chars)`).
- Every streamed line is **redacted** first: a child process that echoes its own
  environment on error cannot leak a key into the chat.
- *Test key* proves the Breeze key against the control plane before you try to
  deploy, and reports which tenant it authenticated as.

Masking is not decoration — it is what caught a real bug where a repair script had
silently replaced one project's key with another's. The mask read `hk_Mj…` where the
user had typed `hk_Rtj…`. See Gate 25.

---

## What it does not do

It does not replace the skill. Perfectionist loads `perfectionistDesign` and follows
it — the interview, the mockup, the derived sections, the gates. The dashboard is the
window onto that, not a substitute for it.

---

## Troubleshooting

**"claude CLI missing"** in the composer — install Claude Code, then run `claude` once
to sign in.

**Images fail immediately** — run `codex login --device-auth`. Settings shows both CLIs
with a red pill when a binary is missing.

**Deploy says the key was rejected** — Settings → *Test key*. A `401` means the control
plane rejected it; re-copy it from the Breeze panel's *Get my key*.

**The agent says it cannot find the pipeline tools** — they are namespaced
`mcp__pipeline__*`. If they are genuinely absent, check `dashboard/.local/mcp-<project>.json`
exists and that `node dashboard/mcp/pipeline-mcp.mjs` answers a `tools/list` request.

**A gate fails but the page looks fine** — open the card's *details*, then re-run that
one gate alone. If it passes in isolation, the harness was wrong, not the page.
