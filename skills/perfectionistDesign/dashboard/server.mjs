/* perfectionistDesign — local control panel.
 *
 * Runs the pipeline scripts and streams their progress to a browser. It does not
 * replace Claude: the interview, the mockup analysis and the page itself stay
 * with the model. This is the cockpit for everything mechanical — generating
 * images, processing assets, running the gates, deploying.
 *
 * SECURITY POSTURE
 *   - binds 127.0.0.1 only, never 0.0.0.0
 *   - the Breeze API key lives in dashboard/.local/settings.json (gitignored),
 *     is never sent to the browser, never logged, and never appears in a job's
 *     streamed output — see redact()
 *   - no credential is bundled: every user supplies their own
 *   - image generation uses the user's own `codex login`, no API key at all
 *
 * Zero dependencies, matching the skill's own single-file ethos.
 *   node dashboard/server.mjs [--port=4180] [--workspace=<dir>]
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, readdir, stat, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, "..");
const SCRIPTS = join(SKILL, "scripts");
const LOCAL = join(HERE, ".local");
const SETTINGS = join(LOCAL, "settings.json");

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const PORT = +arg("port", 4180);
let WORKSPACE = resolve(arg("workspace", process.env.PD_WORKSPACE || join(SKILL, "..", "..", "..", "pd-projects")));

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mjs": "text/javascript; charset=utf-8" };

/* ------------------------------------------------------------------ settings */
async function loadSettings() {
  try { return JSON.parse(await readFile(SETTINGS, "utf8")); } catch { return {}; }
}
async function saveSettings(next) {
  await mkdir(LOCAL, { recursive: true });
  await writeFile(SETTINGS, JSON.stringify(next, null, 2), "utf8");
}
const mask = (k) => (k ? `${k.slice(0, 5)}…${k.slice(-3)} (${k.length} chars)` : null);

/* Any secret must be scrubbed from streamed output. A child process can echo its
   own environment on error, and this stream goes straight to a browser. */
function redact(text, secrets) {
  let s = text;
  for (const v of secrets) if (v && v.length > 6) s = s.split(v).join("«redacted»");
  return s;
}

/* ------------------------------------------------------------------ jobs */
const clients = new Set();
const jobs = new Map();          // id -> {id, kind, project, status, steps, log}
let nextId = 1;

function emit(evt) {
  const line = `data: ${JSON.stringify(evt)}\n\n`;
  for (const c of clients) { try { c.write(line); } catch {} }
}

function newJob(kind, project, steps) {
  const job = { id: String(nextId++), kind, project, status: "running",
    startedAt: Date.now(), steps, done: 0, total: steps.length, current: null, log: [], result: null };
  jobs.set(job.id, job);
  emit({ type: "job:start", job: publicJob(job) });
  return job;
}
const publicJob = (j) => ({ id: j.id, kind: j.kind, project: j.project, status: j.status,
  done: j.done, total: j.total, current: j.current, startedAt: j.startedAt,
  elapsed: Date.now() - j.startedAt, result: j.result });

function jobLog(job, text, level = "log") {
  const line = { t: Date.now(), level, text };
  job.log.push(line);
  if (job.log.length > 4000) job.log.shift();
  emit({ type: "job:log", id: job.id, line });
}
function jobStep(job, name, state, detail) {
  const s = job.steps.find((x) => x.name === name);
  if (s) { s.state = state; if (detail !== undefined) s.detail = detail; }
  if (state === "ok" || state === "fail") job.done = job.steps.filter((x) => x.state === "ok" || x.state === "fail").length;
  job.current = state === "running" ? name : job.current;
  emit({ type: "job:step", id: job.id, steps: job.steps, job: publicJob(job) });
}
function jobEnd(job, status, result) {
  job.status = status; job.result = result ?? null;
  emit({ type: "job:end", job: publicJob(job), steps: job.steps });
}

/* WINDOWS: shell only for bare command NAMES.
 *
 * `npx`, `powershell` and `claude` are .cmd shims on Windows and need a shell.
 * An absolute path does NOT — and must not get one, because with shell:true the
 * command is concatenated unquoted, so `C:\Program Files\nodejs\node.exe` becomes
 * "'C:\Program' is not recognized". Every gate failed for this reason on the
 * first run of this dashboard.
 */
const needsShell = (cmd) => process.platform === "win32" && !/[\\/]/.test(cmd);

/* run a child process, streaming stdout/stderr into the job log */
function run(job, cmd, args, opts = {}) {
  return new Promise((resolveRun) => {
    const secrets = opts.secrets || [];
    const child = spawn(cmd, args, {
      cwd: opts.cwd || WORKSPACE,
      env: { ...process.env, ...(opts.env || {}) },
      shell: needsShell(cmd),
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (opts.stdin) { child.stdin.write(opts.stdin); child.stdin.end(); }
    let out = "";
    const feed = (buf, level) => {
      const text = redact(buf.toString(), secrets);
      out += text;
      for (const l of text.split(/\r?\n/)) {
        if (!l.trim()) continue;
        jobLog(job, l, level);
        opts.onLine?.(l);
      }
    };
    if (job) job.child = child;
    child.stdout.on("data", (b) => feed(b, "log"));
    child.stderr.on("data", (b) => feed(b, "warn"));
    child.on("error", (e) => { jobLog(job, `spawn error: ${e.message}`, "error"); resolveRun({ code: -1, out }); });
    child.on("close", (code) => resolveRun({ code, out }));
  });
}

const node = process.execPath;
const script = (n) => join(SCRIPTS, n);

/* ------------------------------------------------------------------ pipelines */

async function jobGenerate(projectPath, only) {
  const promptsDir = join(projectPath, "scratch", "prompts");
  let slugs = [];
  try {
    slugs = (await readdir(promptsDir)).filter((f) => f.endsWith(".txt")).map((f) => f.replace(/\.txt$/, ""));
  } catch {}
  if (only?.length) slugs = slugs.filter((s) => only.includes(s));
  /* Mockups are a DESIGN INPUT, not a shipped asset. They must never be swept up by
     a plain "generate everything" run, or they land in images/ and the reference
     audit reports them as unused.
     Prefix match, not equality: Gate 39 means there are now _mockup_a, _mockup_b and
     sometimes _mockup_c. Matching only the exact string "_mockup" would have let
     every variant through into the shipped image set. */
  else slugs = slugs.filter((s) => !s.startsWith("_mockup"));
  if (!slugs.length) throw new Error("no prompt files in scratch/prompts");

  const job = newJob("generate", basename(projectPath), slugs.map((s) => ({ name: s, state: "pending" })));
  (async () => {
    const ps = process.platform === "win32" ? "powershell" : "pwsh";
    /* -Strict is now UNCONDITIONAL. It disables run-imagegen's "newest png
       anywhere under CODEX_HOME wins" recovery fallback, which is only sound
       with exactly one generation in flight. Passing it just for partial runs
       was already fragile; with -Parallel it would silently mis-assign images
       between slugs - right filename, wrong picture, no error (Gate 27).
       PD_IMAGE_PARALLEL lets this be tuned or switched off (=1) without an
       edit; 3 is a deliberate floor because the ChatGPT subscription's
       concurrency ceiling is not documented and 429s cost more than they save. */
    const parallel = Math.max(1, parseInt(process.env.PD_IMAGE_PARALLEL || "3", 10) || 1);
    const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script("run-imagegen.ps1"),
      "-Root", projectPath, "-Strict", "-Parallel", String(parallel)];
    /* ALWAYS pass the computed list. This used to send -Slugs only for partial
       runs, so a full run left the script to re-glob the prompts directory and it
       came back with a DIFFERENT work set - 21 slugs including the mockups, while
       this job tracked 18. Two ideas of the work in one job. It did no damage only
       because the mockups already existed and were skipped; on a regenerate they
       would have been re-rendered into the shipped image set at ~5 min each. */
    args.push("-Slugs", slugs.join(","));
    const r = await run(job, ps, args, {
      cwd: projectPath,
      onLine(l) {
        /* the runner's own vocabulary — keep this in sync with run-imagegen.ps1 */
        let m = l.match(/^===\s+(\S+)\s+attempt\s+(\d+)\/(\d+)/);
        if (m) return jobStep(job, m[1], "running", `attempt ${m[2]}/${m[3]}`);
        m = l.match(/^OK\s+(\S+)\s+(\S+)\s+(\d+)\s*KB/);
        if (m) return jobStep(job, m[1], "ok", `${m[2]} · ${m[3]} KB`);
        m = l.match(/^SKIP\s+(\S+)/);
        if (m) return jobStep(job, m[1], "ok", "already exists");
        m = l.match(/^FAIL\s+(\S+)\s+(.*)$/);
        if (m) return jobStep(job, m[1], "fail", m[2]);
      },
    });
    jobEnd(job, r.code === 0 ? "ok" : "fail");
  })();
  return job;
}

async function jobPipeline(projectPath, kind) {
  const defs = {
    process: [
      ["process assets", node, [script("process-assets.cjs"), `--root=${projectPath}`]],
      ["reconcile srcset", node, [script("reconcile-srcset.cjs"), `--root=${projectPath}`]],
      ["audit references", node, [script("audit-refs.cjs"), `--root=${projectPath}`]],
    ],
    gates: [
      /* Gate 39 was the only gate with no number. It asked the agent to CONFIRM
         it had generated two mockups instead of counting the files. */
      ["mockups", node, [script("check-mockups.cjs"), `--root=${projectPath}`]],
      ["references", node, [script("audit-refs.cjs"), `--root=${projectPath}`]],
      ["tag tree", node, [script("check-nesting.cjs"), `--root=${projectPath}`]],
      ["markup faults", node, [script("check-markup.cjs"), `--root=${projectPath}`]],
      /* added after a build passed 4/4 and still shipped 38 contrast failures.
         Static only — it cannot see text over a photograph — but it catches the
         white-on-accent button defect, which is the most common real one. */
      ["contrast (static)", node, [script("check-contrast.cjs"), `--root=${projectPath}`]],
      ["unused assets", node, [script("prune-images.cjs"), `--root=${projectPath}`]],
    ],
    stage: [
      ["build deploy folder", node, [script("build-deploy.cjs"), `--root=${projectPath}`,
        `--out=${join(WORKSPACE, ".deploy", basename(projectPath))}`]],
    ],
  }[kind];
  if (!defs) throw new Error(`unknown pipeline ${kind}`);

  const job = newJob(kind, basename(projectPath), defs.map(([n]) => ({ name: n, state: "pending" })));
  (async () => {
    let failed = false;
    for (const [name, cmd, args] of defs) {
      jobStep(job, name, "running");
      const r = await run(job, cmd, args, { cwd: projectPath });
      const ok = r.code === 0;
      /* GATE 42. A page shipped with 48 rendered contrast failures while this
         reported "gates ok 5/5". Three things had to line up and all three did:
         the static contrast script exits 0 (so the step said ok), it printed
         "unsafe pairs : 2" which this regex did not match and therefore dropped,
         and it printed its own caveat - "do not report contrast OK on the
         strength of this file alone" - which nothing surfaced.
         So: widen the counts, treat any non-zero count as NOT a pass regardless
         of exit code, and carry the tool's stated limits through to the user. */
      const countRe = /(MISSING|CORRUPT|UNUSED|FAILING|unsafe pairs|total faults|unused|broken|overflow)\s*:?\s*(\d+)/gi;
      const nums = r.out.match(countRe) || [];
      const nonZero = nums.filter((s) => !/[:\s](0)\s*$/.test(s));
      const notCovered = /NOT COVERED HERE|cannot see|does not cover/i.test(r.out);
      let detail = nums.slice(0, 4).join("  ");
      if (notCovered) detail += (detail ? "  " : "") + "· partial check";
      if (!detail) detail = ok ? "passed (no counts reported)" : "failed";
      /* A count above zero is a finding even when the script exits 0. */
      const clean = ok && nonZero.length === 0;
      jobStep(job, name, clean ? "ok" : ok ? "warn" : "fail", detail);
      if (!clean && ok) jobLog(job, `${name}: ${nonZero.join(", ")}${notCovered ? " (tool reports its own coverage limits)" : ""}`, "warn");
      if (!ok) { failed = true; if (kind !== "gates") break; }   // gates run to completion
    }
    jobEnd(job, failed ? "fail" : "ok");
  })();
  return job;
}

/* deploy: drives the Breeze MCP server over stdio, exactly as documented in
   references/06-ship-deploy-git.md. The key comes from local settings and is
   redacted out of everything streamed. */
async function jobDeploy(projectPath, { project, app, port = 8080, mode = "autoscale" }) {
  const s = await loadSettings();
  if (!s.breezeKey) throw new Error("no Breeze API key set — add one in Settings first");
  const outDir = join(WORKSPACE, ".deploy", basename(projectPath));

  const job = newJob("deploy", basename(projectPath), [
    { name: "stage folder", state: "pending" },
    { name: "connect", state: "pending" },
    { name: "authenticate", state: "pending" },
    { name: "upload + build", state: "pending" },
    { name: "verify live", state: "pending" },
  ]);

  (async () => {
    jobStep(job, "stage folder", "running");
    const st = await run(job, node, [script("build-deploy.cjs"), `--root=${projectPath}`, `--out=${outDir}`], { cwd: projectPath });
    if (st.code !== 0) { jobStep(job, "stage folder", "fail"); return jobEnd(job, "fail"); }
    jobStep(job, "stage folder", "ok", (st.out.match(/deploy folder\s*:\s*([\d.]+ MB)/) || [])[1] || "staged");

    jobStep(job, "connect", "running");
    const child = spawn("npx", ["-y", "breezedeploy-mcp"], {
      env: { ...process.env, CONTROL_PLANE_URL: s.breezeUrl || "https://panel.breezedeploy.dev",
             CONTROL_PLANE_API_KEY: s.breezeKey },
      shell: needsShell("npx"), stdio: ["pipe", "pipe", "pipe"],
    });
    const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");
    let buf = "", url = null;
    const secrets = [s.breezeKey];

    child.stderr.on("data", (b) => jobLog(job, redact(b.toString().trim(), secrets), "warn"));
    child.on("error", (e) => { jobLog(job, `spawn: ${e.message}`, "error"); jobEnd(job, "fail"); });

    child.stdout.on("data", async (b) => {
      buf += redact(b.toString(), secrets);
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }

        if (m.id === 1) {
          jobStep(job, "connect", "ok", m.result?.serverInfo ? `${m.result.serverInfo.name} v${m.result.serverInfo.version}` : "connected");
          jobStep(job, "authenticate", "running");
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "whoami", arguments: {} } });
        }
        if (m.id === 2) {
          const t = m.result?.content?.[0]?.text || "";
          if (/error|invalid/i.test(t)) {
            jobStep(job, "authenticate", "fail", "key rejected by the control plane");
            jobLog(job, "The key in Settings was rejected. Re-copy it from the Breeze panel.", "error");
            child.kill(); return jobEnd(job, "fail");
          }
          let tid = ""; try { tid = JSON.parse(t).tenantId || ""; } catch {}
          jobStep(job, "authenticate", "ok", tid ? `tenant ${tid}` : "ok");
          jobStep(job, "upload + build", "running", "this takes a few minutes");
          send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "deploy_source",
            arguments: { project, app, dir: outDir, port, mode } } });
        }
        if (m.id === 3) {
          const t = m.result?.content?.[0]?.text || "";
          let r = null; try { r = JSON.parse(t); } catch {}
          if (!r?.url) {
            jobStep(job, "upload + build", "fail", (t || "no url returned").slice(0, 160));
            child.kill(); return jobEnd(job, "fail");
          }
          url = r.url;
          jobStep(job, "upload + build", "ok", `${r.status} · ${r.mode} · ${r.size}`);
          child.kill();

          /* A deploy tool's success message is not evidence the page renders.
             HEAD every asset on the live host before calling this done. */
          jobStep(job, "verify live", "running");
          try {
            /* GATE 36, implemented rather than documented. The host returns
               "running" the moment the upload lands and builds asynchronously, so
               verifying immediately measures a container that does not exist yet.
               This step reported `fail` three times in a row on a deploy that was
               fine - twice with "fetch failed", once with a real 404 - 14 seconds
               after upload. The URL served 200 on a later manual retry.
               So: poll until the host actually answers, and treat "no answer yet"
               as "not ready", never as "broken". */
            const WARM_MS = 150000, STEP_MS = 5000;
            const t0 = Date.now();
            let res = null, attempts = 0;
            while (Date.now() - t0 < WARM_MS) {
              attempts++;
              try {
                res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
                if (res.ok) break;
              } catch { res = null; }              // still booting; not a verdict
              jobStep(job, "verify live", "running",
                `waiting for the build · ${attempts} check${attempts === 1 ? "" : "s"} · ${Math.round((Date.now() - t0) / 1000)}s`);
              await new Promise((r) => setTimeout(r, STEP_MS));
            }
            if (!res || !res.ok) {
              jobStep(job, "verify live", "fail",
                `no 200 after ${Math.round((Date.now() - t0) / 1000)}s and ${attempts} attempts` +
                (res ? ` · last HTTP ${res.status}` : " · host never answered"));
              return jobEnd(job, "fail", { url, assets: 0, broken: 0 });
            }
            const html = await res.text();
            const refs = [...new Set(html.match(/(?:images|logo)\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|svg|ico)/g) || [])];
            let bad = 0;
            const missing = [];
            for (const a of refs) {
              let h = null;
              try { h = await fetch(`${url}/${a}`, { method: "HEAD", signal: AbortSignal.timeout(20000) }); } catch { h = null; }
              /* Retry once before believing it. A cold edge drops the first few
                 asset requests too, and reporting those as missing sends someone
                 off to rebuild assets that are perfectly fine. */
              if (!h || !h.ok) {
                await new Promise((r) => setTimeout(r, 1500));
                try { h = await fetch(`${url}/${a}`, { method: "HEAD", signal: AbortSignal.timeout(20000) }); } catch { h = null; }
              }
              if (!h || !h.ok) { bad++; missing.push(a); }
            }
            /* Prove the NEW build is live, not just that something is. On a
               redeploy a 200 is frequently the previous version. */
            let bytesMatch = null;
            try {
              const localHtml = await readFile(join(outDir, "index.html"), "utf8");
              bytesMatch = Buffer.byteLength(localHtml) === Buffer.byteLength(html);
            } catch {}
            const ok = bad === 0 && bytesMatch !== false;
            if (missing.length) jobLog(job, `missing on host: ${missing.slice(0, 10).join(", ")}`, "warn");
            if (bytesMatch === false) jobLog(job, "served document differs from the staged build - the host may still be serving the previous version", "warn");
            jobStep(job, "verify live", ok ? "ok" : "fail",
              `HTTP ${res.status} · ${refs.length} assets · ${bad} broken` +
              (bytesMatch === null ? "" : bytesMatch ? " · bytes match" : " · BYTES DIFFER"));
            jobEnd(job, ok ? "ok" : "fail", { url, assets: refs.length, broken: bad, bytesMatch });
          } catch (e) {
            jobStep(job, "verify live", "fail", e.message);
            jobEnd(job, "fail", { url });
          }
        }
      }
    });

    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05",
      capabilities: {}, clientInfo: { name: "pd-dashboard", version: "1.0.0" } } });
    setTimeout(() => { if (job.status === "running") { jobLog(job, "timed out after 15 minutes", "error"); child.kill(); jobEnd(job, "fail"); } }, 900000);
  })();
  return job;
}

/* ------------------------------------------------------------------ chat
 *
 * Talks to Claude through the Claude Code CLI, in the project directory, so it
 * can actually read and write the files it is discussing.
 *
 * AUTH — subscription by default, and that is the point.
 *   subscription : spawn `claude` with NO ANTHROPIC_API_KEY in the environment.
 *                  It uses the login the CLI already has, so there is no API
 *                  spend at all. Same story for images: `codex` uses the user's
 *                  ChatGPT login.
 *   apiKey       : only if the user explicitly chooses it, we pass their key in
 *                  the environment for this one child process.
 *
 * Deleting an inherited ANTHROPIC_API_KEY in subscription mode is deliberate:
 * if one is exported globally the CLI would silently bill it, which is exactly
 * what the user asked to avoid.
 */
/* project -> last claude session id.
 *
 * PERSISTED. This was an in-memory Map, which meant any server restart silently
 * orphaned every running conversation: the transcript stayed on disk under
 * ~/.claude/projects/<encoded-path>/<session>.jsonl, but the pointer to it was
 * gone, so the next message started a fresh session with no memory of the brief,
 * the interview, or a decision the user had already made. It cost a real one:
 * a restart to enable parallel image generation dropped a cinema build's entire
 * brief (TMDB, frontend-only, chosen mockup) mid-run.
 *
 * A restart must never be able to lose a conversation. If the map is empty on
 * boot we also recover from Claude Code's own session directory, so even a
 * settings file deleted by hand does not orphan the work. */
const chatSessions = new Map();

const SESSIONS_FILE = () => join(LOCAL, "sessions.json");

async function loadChatSessions() {
  try {
    const raw = await readFile(SESSIONS_FILE(), "utf8");
    for (const [k, v] of Object.entries(JSON.parse(raw.replace(/^﻿/, "")))) {
      if (typeof v === "string" && v) chatSessions.set(k, v);
    }
  } catch {}
}

async function saveChatSessions() {
  try {
    await mkdir(LOCAL, { recursive: true });
    await writeFile(SESSIONS_FILE(), JSON.stringify(Object.fromEntries(chatSessions), null, 2), "utf8");
  } catch {}
}

/* Last resort: ask Claude Code where it keeps this project's transcripts and take
   the newest. The directory name is the absolute project path with the separators
   and colon flattened to dashes. */
async function recoverSessionFromDisk(projectPath) {
  try {
    /* One dash PER separator, so no `+`. Claude Code maps each character
       independently: "C:\Users\..." becomes "C--Users-...", because the colon
       and the backslash each contribute a dash. A greedy `+` collapsed them to
       "C-Users-...", which matches no directory that exists, and the endpoint
       silently returned an empty history instead of failing. */
    const enc = resolve(projectPath).replace(/[\\/:]/g, "-").replace(/^-+/, "");
    const dir = join(process.env.USERPROFILE || process.env.HOME || "", ".claude", "projects", enc);
    if (!existsSync(dir)) return null;
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    if (!files.length) return null;
    const withTime = await Promise.all(files.map(async (f) => ({
      id: f.replace(/\.jsonl$/, ""), t: (await stat(join(dir, f))).mtimeMs,
    })));
    withTime.sort((a, b) => b.t - a.t);
    return withTime[0].id;
  } catch { return null; }
}

async function jobChat(projectPath, prompt, opts = {}) {
  const s = await loadSettings();
  const proj = basename(projectPath);
  /* honour the project's own config rather than assuming index.html */
  let cfgHtml = "index.html";
  try { cfgHtml = JSON.parse((await readFile(join(projectPath, "project.config.json"), "utf8")).replace(/^﻿/, "")).html || cfgHtml; } catch {}
  const job = newJob("chat", proj, [{ name: "thinking", state: "running" }]);
  job.chat = { prompt, reply: "" };

  const env = { ...process.env };
  const secrets = [];
  if (s.claudeAuth === "apiKey" && s.anthropicKey) {
    env.ANTHROPIC_API_KEY = s.anthropicKey;
    secrets.push(s.anthropicKey);
  } else {
    /* subscription mode: make sure no inherited key can turn this into spend */
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
  }
  /* Do NOT inherit the parent agent's own session context.
     If this dashboard was itself started from inside a Claude Code session, the
     child claude inherits CLAUDE_CODE_* / CLAUDECODE and runs under the PARENT's
     permission policy — every Edit came back "blocked pending your approval" even
     with --permission-mode auto, while the identical command worked from a plain
     shell. The child must get a clean slate. */
  for (const k of Object.keys(env)) {
    /* CLAUDE_CONFIG_DIR is deliberately NOT stripped — it is where the user's
       skills live, and removing it left the agent unable to find
       perfectionistDesign at all. Only the parent session's own runtime context
       goes. */
    if (/^(CLAUDE_CODE|CLAUDECODE)/.test(k)) delete env[k];
  }

  /* --add-dir is required, not optional. Spawned non-interactively into a folder
     the CLI has not seen before, tool calls come back "blocked pending your
     approval for this path" — and in --print mode there is nobody to approve, so
     the model just reports that it could not read anything. Naming the project
     folder explicitly is what makes the session able to work in it. */
  /* Perfectionist's identity and standing orders. Kept short on purpose: the
     detail lives in the skill, and repeating it here would let the two drift. */
  const SYSTEM = [
    "You are Perfectionist, the agent behind the perfectionistDesign pipeline.",
    "You are talking to the user inside a dashboard, not a terminal. Narrate what you are",
    "doing in short plain sentences as you go, so they can follow along. No preamble, no",
    "recaps of what they just said.",
    "",
    "Follow the perfectionistDesign skill for how to work — invoke it with the Skill tool at",
    "the start of any build or redesign. Its failure gates are not optional, and every claim",
    "you make about the page must be backed by a measurement you actually ran.",
    "",
    "READ references/11-taste.md BEFORE you choose a single colour, typeface or layout.",
    "The gates prove a page is correct; nothing in them proves it is good. That file is the",
    "anti-slop floor and it is never skippable.",
    "",
    "Then LOAD the taste skills if they are installed, with the Skill tool — do not just",
    "mention them. design-taste-frontend for the design read and anti-default discipline,",
    "emil-design-eng for polish and alignment, ui-ux-pro-max for hierarchy, spacing rhythm",
    "and states, full-output-enforcement on a large build so nothing ships truncated. Add",
    "high-end-visual-design, minimalist-ui, industrial-brutalist-ui or gpt-taste only when",
    "the design read genuinely lands there.",
    "",
    "Before you write any markup, post exactly four lines:",
    "  Design read      : <page kind> for <audience>, <vibe>",
    "  Signature device : <the one thing that would look absurd on a competitor's site>",
    "  Category default : <what every other site in this category does> -> <what I did>",
    "  Dials            : VARIANCE n / MOTION n / DENSITY n",
    "  Skills           : <loaded, with a reason each>",
    "  Rejected         : <the default you did NOT reach for, and what you did instead>",
    "Signature device and Category default are Gate 38 and they matter most. The bar is that",
    "a visitor is SURPRISED. A recognisable genre executed faithfully (editorial, Swiss,",
    "brutalist, punk, glassmorphism, minimal, premium-consumer) is NEVER an acceptable",
    "direction - genres are vocabulary for discussing design, not the design. Never offer",
    "the user a menu of genres to pick from. The device must be load-bearing and come from",
    "what the subject actually DOES, not decoration.",
    "The Rejected line is the one that matters. Silence there means the defaults won.",
    "",
    "\"The gates\" always means that skill's mechanical checks, run through your run_gates",
    "tool. It never means npm test or a CI pipeline — do not go looking for one.",
    "",
    "THE ORDER IS NOT NEGOTIABLE. Mockup, then analysis, then images, then build:",
    "  1. Interview. Wait for answers.",
    "  2. PHASE 1 — AT LEAST TWO MOCKUPS, AND THE USER PICKS (Gate 39). Write",
    "     scratch/prompts/_mockup_a.txt AND _mockup_b.txt (add _mockup_c for a",
    "     high-stakes page: the layout carries money, 8+ sections, only a feeling and no",
    "     reference, or you are unsure - unsure means go UP, never down to one). Each",
    "     describes the WHOLE page top to bottom, every section in order. Then call",
    "     mcp__pipeline__generate_mockup once, with the list of slugs.",
    "     The variants offer genuinely DIFFERENT DEVICES - different ideas, not three",
    "     dressings of one, and never different genres. At Phase 1 the idea is what is",
    "     still open. Hold the section list, copy and palette identical so the choice is",
    "     about the idea. If you can only tell them apart with genre words you built a",
    "     menu instead of options - regenerate. And never let a genre word (editorial,",
    "     Swiss, brutalist, punk, minimal, premium-consumer) reach a label the user reads.",
    "     Then SHOW the user every mockup, one line each on what it does well and what it",
    "     costs, give a recommendation clearly labelled as a recommendation, ASK WHICH TO",
    "     BUILD, AND STOP. Do not continue on your own pick. Generate ONE mockup only when",
    "     the user supplied a reference image OF THE NEW DESIGN or explicitly asked for one.",
    "  3. PHASE 2 — after the user chooses, READ that mockup with the Read tool. Extract the design",
    "     system FROM THE IMAGE: palette with hex values, type scale, section order and",
    "     composition. Say what you found. An image model makes a hundred composition",
    "     decisions neither of you would think to specify — that is the point of it.",
    "  4. PHASE 3 — write one prompt per section image, derived from the mockup, then",
    "     call generate_images.",
    "  5. PHASE 5 — build the page to match what you extracted.",
    "  6. PHASE 6 — run_gates, and say what the gates cannot see.",
    "NEVER write markup or section image prompts before you have looked at the mockup.",
    "Skipping straight to code is how a build becomes a template.",
    "",
    "You have pipeline tools, namespaced under mcp__pipeline__:",
    "  mcp__pipeline__generate_mockup    PHASE 1, always first, 2+ variants in ONE call",
    "  mcp__pipeline__generate_images   every prompt in scratch/prompts, live progress",
    "  mcp__pipeline__process_assets    masters to variants, srcsets, reference audit",
    "  mcp__pipeline__run_gates         the skill's mechanical checks",
    "  mcp__pipeline__stage_build       assemble a clean deploy folder",
    "  mcp__pipeline__deploy            publish to Breeze, then verify every asset live",
    "USE THESE rather than shelling out to the scripts yourself — they are what shows the",
    "user live progress. Write the prompt .txt files into scratch/prompts first, then call",
    "generate_images. Never call deploy without asking first: it publishes.",
    "",
    "INTERVIEW FIRST. ALWAYS. This is not negotiable and it is not a formality.",
    "When someone says \"I want a site for X\", you do NOT start building and you do NOT",
    "pick a direction for them. Ask, in ONE message, the questions whose answers would",
    "change what you make:",
    "  - what the site has to achieve, and who it is for",
    "  - the visual direction: reference sites they admire, or brands whose look they want",
    "  - colour: an existing brand palette, or genuinely open?",
    "  - real content you must keep: logo, name, customers, projects, prices",
    "  - anything that must NOT appear",
    "  - where it ends up",
    "Then WAIT for the answers. Do not guess a palette, a typeface, a mood or a section",
    "list and call it a proposal. Guessing is how a build becomes a template.",
    "",
    "Only skip the interview when the user has already answered it — a detailed brief, or",
    "a follow-up inside a build that is already underway.",
    "",
    "NEVER START A LONG-LIVED PROCESS. Do not run `node serve.mjs`, `npm start`, a dev",
    "server or any watcher to preview your own work — they never exit, and the turn hangs",
    "behind them. The dashboard already serves every project at /preview/<project>/index.html",
    "and the user has it open. If you want to check the page renders, ask them to look.",
    "",
    "NEVER HARDCODE. No default section list, no default palette, no house style. Sections",
    "are derived from what THIS subject must prove; colour comes from the brand or from the",
    "answers. If you catch yourself reaching for hero / features / testimonials / CTA, you",
    "have skipped the derivation.",
    "",
    "CONTRAST: run_gates includes a STATIC contrast check only. It cannot see text over a",
    "photograph, a gradient, or any translucent ground. Never report \"contrast OK\" on the",
    "strength of the gates alone — say plainly which parts remain unmeasured, and offer the",
    "rendered-pixel pass (scripts/audit.browser.js, then await pdAudit()) which the user runs",
    "in their own browser.",
  ].join("\n");

  /* --mcp-config takes a FILE path, not an inline JSON string.
     A JSON string is full of quotes, and on Windows the CLI is a .cmd shim
     spawned through a shell, which mangles them — the config silently did not
     apply and the agent went looking for the pipeline with Bash and Grep instead
     of calling its tools. Same trap as the prompt argument (Gate 12): anything
     with quotes or spaces goes through a file or stdin, never argv. */
  await mkdir(LOCAL, { recursive: true });
  const mcpPath = join(LOCAL, `mcp-${proj}.json`);
  const sysPath = join(LOCAL, `system-${proj}.txt`);
  await writeFile(sysPath, SYSTEM, "utf8");
  await writeFile(mcpPath, JSON.stringify({ mcpServers: { pipeline: {
    command: process.execPath,
    args: [join(HERE, "mcp", "pipeline-mcp.mjs")],
    env: { PD_DASHBOARD_URL: `http://127.0.0.1:${PORT}`, PD_PROJECT: proj },
  } } }, null, 2), "utf8");

  const args = ["--print", "--output-format", "stream-json", "--include-partial-messages",
    "--verbose", "--add-dir", projectPath,
    "--append-system-prompt-file", sysPath,
    "--mcp-config", mcpPath,
    /* the skill lives outside the project, so the session has to be told where */
    "--add-dir", SKILL,
    "--permission-mode", opts.permissionMode || s.permissionMode || "auto"];
  if (s.model) args.push("--model", s.model);
  let prev = chatSessions.get(proj);
  /* Nothing in memory is not the same as no conversation. Before starting a fresh
     session - which throws away the brief - check whether Claude Code already has
     a transcript for this project on disk. */
  if (!prev && !opts.fresh) {
    prev = await recoverSessionFromDisk(projectPath);
    if (prev) {
      chatSessions.set(proj, prev);
      await saveChatSessions();
      jobLog(job, `resumed conversation ${prev} recovered from disk`);
    }
  }
  if (prev && !opts.fresh) args.push("--resume", prev);
  /* THE PROMPT GOES DOWN STDIN, never as an argv element.
     On Windows `claude` is a .cmd shim, so it must be spawned through a shell,
     and a shell concatenates argv unquoted. "In one short sentence, ..." reached
     the CLI as just "In" — it replied asking why the message was cut off. The
     same rule is already written down for codex in run-imagegen.ps1; it applies
     to every shell-spawned CLI that takes free text. */

  (async () => {
    let buf = "";
    const child = spawn("claude", args, { cwd: projectPath, env,
      shell: needsShell("claude"), stdio: ["pipe", "pipe", "pipe"] });
    job.child = child;
    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.on("data", (b) => {
      buf += redact(b.toString(), secrets);
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { jobLog(job, line); continue; }

        if (m.session_id && chatSessions.get(proj) !== m.session_id) {
          chatSessions.set(proj, m.session_id);
          saveChatSessions();   // write through, so a crash cannot orphan it
        }

        /* partial assistant text — this is what makes it feel live */
        if (m.type === "stream_event" && m.event?.type === "content_block_delta" &&
            m.event.delta?.type === "text_delta") {
          job.chat.reply += m.event.delta.text;
          emit({ type: "chat:delta", id: job.id, text: m.event.delta.text });
        }
        /* a tool the model decided to use — surface it, it is the interesting part */
        if (m.type === "assistant" && Array.isArray(m.message?.content)) {
          for (const c of m.message.content) {
            if (c.type === "tool_use") {
              const label = c.name === "Bash" ? (c.input?.command || "").slice(0, 90)
                : c.input?.file_path || c.input?.pattern || c.input?.description || "";
              jobLog(job, `→ ${c.name}  ${label}`, "warn");
              emit({ type: "chat:tool", id: job.id, tool: c.name, detail: String(label).slice(0, 120) });
            }
          }
        }
        if (m.type === "result") {
          job.chat.reply = m.result || job.chat.reply;
          /* END ON `result`, NOT ON `close`.
             `close` fires when the process TREE releases stdout. If the agent
             started a long-lived process — `node serve.mjs` to preview its own
             work — that grandchild holds the pipe open forever and the turn shows
             "running" long after the reply arrived. Observed: a build that had
             finished, passed its gates twice and written 61 KB of HTML still sat
             at "running 1437s". `result` is the model's own end-of-turn signal
             and it is the correct one. */
          finish(true);
          /* The CLI reports total_cost_usd whatever the auth mode. On a
             subscription it is a NOTIONAL equivalent, not a charge, and printing
             it as "cost" next to a plan the user already pays for reads as a bill
             they are not getting. Only show money in API-key mode. */
          if (s.claudeAuth === "apiKey" && m.total_cost_usd) {
            jobLog(job, `billed: $${m.total_cost_usd.toFixed(4)}`, "warn");
          } else if (m.usage) {
            const u = m.usage;
            jobLog(job, `tokens: ${u.input_tokens ?? "?"} in / ${u.output_tokens ?? "?"} out · subscription, not billed per request`, "warn");
          }
          if (m.is_error) jobLog(job, "the model returned an error result", "error");
        }
      }
    });
    child.stderr.on("data", (b) => {
      const t = redact(b.toString().trim(), secrets);
      if (t) jobLog(job, t, "warn");
    });
    child.on("error", (e) => {
      jobLog(job, `could not start the Claude CLI: ${e.message}`, "error");
      jobLog(job, "Install it, then run `claude` once to sign in with your subscription.", "error");
      jobStep(job, "thinking", "fail");
      jobEnd(job, "fail");
    });
    /* idempotent: whichever signal lands first wins, the other is a no-op */
    let finished = false;
    async function finish(ok) {
      if (finished || job.status !== "running") return;
      finished = true;
      jobStep(job, "thinking", ok ? "ok" : "fail");

      /* Did this turn actually leave a site behind? Say so, and hand over a link.
         The user should never have to ask "is it done, and where is it?" — the
         answer is on disk and the dashboard already serves it. A scaffolded
         placeholder is ~330 bytes, so anything substantially larger is a build. */
      let site = null;
      try {
        const idx = join(projectPath, cfgHtml);
        const st = await stat(idx);
        if (st.size > 2000) {
          let imgs = 0;
          try { imgs = (await readdir(join(projectPath, "images"))).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).length; } catch {}
          site = { url: `/preview/${proj}/${cfgHtml}`, bytes: st.size, images: imgs,
                   changed: st.mtimeMs >= job.startedAt };
        }
      } catch {}

      emit({ type: "chat:done", id: job.id, reply: job.chat.reply, ok, site });
      jobEnd(job, ok ? "ok" : "fail", { reply: job.chat.reply, site });
      /* the model is done; anything it left running is not our turn to wait on */
      setTimeout(() => { try { child.kill(); } catch {} }, 1500);
    }
    child.on("close", (code) => finish(code === 0));
  })();

  return job;
}

/* Is each CLI installed, and is it signed in? A missing login is the single most
   likely reason nothing works, and it should be visible before the user tries. */
async function cliStatus() {
  const probe = (cmd, args) => new Promise((r) => {
    const c = spawn(cmd, args, { shell: needsShell(cmd), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    c.stdout.on("data", (b) => (out += b));
    c.stderr.on("data", (b) => (out += b));
    c.on("error", () => r({ installed: false, detail: "not found on PATH" }));
    c.on("close", (code) => r({ installed: code === 0, detail: out.trim().split("\n")[0]?.slice(0, 80) || "" }));
    setTimeout(() => { try { c.kill(); } catch {} r({ installed: false, detail: "timed out" }); }, 8000);
  });
  const [claude, codex] = await Promise.all([probe("claude", ["--version"]), probe("codex", ["--version"])]);
  return { claude, codex };
}

/* ------------------------------------------------------------------ projects */
/* A project name arrives from a query string, goes straight into join(), and
   the result is read off disk. Two things went wrong without this:
     - `?project=` omitted entirely made join(WORKSPACE, null, ...) THROW, which
       surfaced as a 500 "internal error" for what is plainly a bad request.
     - `..` segments would have escaped the workspace on a server the user is
       told to run locally but which binds a real port.
   One folder segment, no separators, no dots-only names. */
function safeProject(name) {
  if (typeof name !== "string") return null;
  const n = name.trim();
  if (!n || n.length > 64) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(n)) return null;
  if (/^\.+$/.test(n)) return null;
  return n;
}

const NON_PROJECT_DIRS = new Set([
  "node_modules", "dist", "build", "coverage", ".cache", "tmp", "temp",
]);

async function listProjects() {
  await mkdir(WORKSPACE, { recursive: true });
  const out = [];
  for (const e of await readdir(WORKSPACE, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    // Not every directory in the workspace is a project. `node_modules` gets
    // created the moment anything npm-installs here, and `<name>-deploy` is the
    // derived folder build-deploy.cjs writes (Gate 26) - offering either one in
    // the project picker invites the agent to build INTO a build artefact.
    if (NON_PROJECT_DIRS.has(e.name) || /-deploy$/.test(e.name)) continue;
    const p = join(WORKSPACE, e.name);
    const has = (f) => existsSync(join(p, f));
    let prompts = 0, masters = 0, variants = 0;
    try { prompts = (await readdir(join(p, "scratch", "prompts"))).filter((f) => f.endsWith(".txt")).length; } catch {}
    try { masters = (await readdir(join(p, "images", "_masters"))).filter((f) => f.endsWith(".png")).length; } catch {}
    try { variants = (await readdir(join(p, "images"))).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).length; } catch {}
    let size = 0;
    try { size = (await stat(join(p, "index.html"))).size; } catch {}
    out.push({ name: e.name, path: p, hasIndex: has("index.html"), htmlBytes: size, prompts, masters, variants });
  }
  return out;
}

async function scaffold(name) {
  const safe = name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const p = join(WORKSPACE, safe);
  if (existsSync(p)) throw new Error("a project with that name already exists");
  for (const d of ["images/_masters", "logo", "scratch/prompts", "scripts"]) await mkdir(join(p, d), { recursive: true });
  await writeFile(join(p, "project.config.json"), JSON.stringify({
    html: "index.html", images: "images", masters: "images/_masters", logo: "logo",
  }, null, 2), "utf8");
  await writeFile(join(p, "package.json"), JSON.stringify({
    name: safe, private: true, type: "module", scripts: { start: "node serve.mjs" },
    engines: { node: ">=18" },
  }, null, 2), "utf8");
  await writeFile(join(p, "serve.mjs"), await readFile(join(HERE, "templates", "serve.mjs"), "utf8"), "utf8");
  await writeFile(join(p, "index.html"),
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${safe}</title>\n</head>\n<body>\n<!-- Claude writes the page here. The dashboard runs the pipeline around it. -->\n<main><h1>${safe}</h1><p>Not built yet.</p></main>\n</body></html>\n`, "utf8");
  return p;
}

/* ------------------------------------------------------------------ http */
const json = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(s) });
  res.end(s);
};
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { r(JSON.parse(b || "{}")); } catch { r({}); } }); });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(url.pathname);

  try {
    /* ---- live event stream ---- */
    if (p === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(": connected\n\n");
      clients.add(res);
      const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 25000);
      req.on("close", () => { clearInterval(ping); clients.delete(res); });
      return;
    }

    if (p === "/api/state") {
      const s = await loadSettings();
      return json(res, 200, {
        workspace: WORKSPACE, skill: SKILL, port: PORT,
        breezeKeySet: !!s.breezeKey, breezeKeyMasked: mask(s.breezeKey),
        breezeUrl: s.breezeUrl || "https://panel.breezedeploy.dev",
        claudeAuth: s.claudeAuth || "subscription",
        anthropicKeySet: !!s.anthropicKey, anthropicKeyMasked: mask(s.anthropicKey),
        imageAuth: s.imageAuth || "subscription",
        openaiKeySet: !!s.openaiKey, openaiKeyMasked: mask(s.openaiKey),
        model: s.model || "", permissionMode: s.permissionMode || "auto",
        cli: await cliStatus(),
        projects: await listProjects(),
        jobs: [...jobs.values()].slice(-12).map(publicJob),
      });
    }

    /* Stop must actually kill the process tree. A spawned `claude` on Windows sits
       under a .cmd shim, so killing the shim alone leaves the real one running —
       which is exactly the situation where a user pressing Stop assumes it stopped. */
    if (p === "/api/stop" && req.method === "POST") {
      let killed = 0;
      for (const [, job] of jobs) {
        if (job.status !== "running" || !job.child) continue;
        try {
          if (process.platform === "win32") spawn("taskkill", ["/PID", String(job.child.pid), "/T", "/F"], { shell: false });
          else job.child.kill("SIGTERM");
          killed++;
          jobLog(job, "stopped by the user", "error");
          jobEnd(job, "fail");
        } catch {}
      }
      return json(res, 200, { ok: true, killed });
    }

    if (p === "/api/chat" && req.method === "POST") {
      const b = await readBody(req);
      const projectPath = join(WORKSPACE, b.project);
      if (!existsSync(projectPath)) return json(res, 400, { error: "unknown project" });
      if (!b.prompt?.trim()) return json(res, 400, { error: "empty prompt" });
      const job = await jobChat(projectPath, b.prompt, { fresh: b.fresh, permissionMode: b.permissionMode });
      return json(res, 200, { ok: true, job: publicJob(job) });
    }

    if (p === "/api/settings" && req.method === "POST") {
      const b = await readBody(req);
      const s = await loadSettings();
      /* "" clears a key, undefined leaves it alone — so the UI never has to send
         a secret back just to change an unrelated setting */
      for (const [field, prop] of [["breezeKey", "breezeKey"], ["anthropicKey", "anthropicKey"], ["openaiKey", "openaiKey"]]) {
        if (typeof b[field] === "string") {
          if (b[field] === "") delete s[prop];
          else s[prop] = b[field].trim();
        }
      }
      for (const f of ["breezeUrl", "claudeAuth", "imageAuth", "model", "permissionMode"]) {
        if (typeof b[f] === "string" && b[f]) s[f] = b[f].trim();
      }
      if (typeof b.workspace === "string" && b.workspace) { WORKSPACE = resolve(b.workspace); s.workspace = WORKSPACE; }
      await saveSettings(s);
      return json(res, 200, { ok: true, workspace: WORKSPACE,
        breezeKeySet: !!s.breezeKey, breezeKeyMasked: mask(s.breezeKey),
        anthropicKeySet: !!s.anthropicKey, anthropicKeyMasked: mask(s.anthropicKey),
        openaiKeySet: !!s.openaiKey, openaiKeyMasked: mask(s.openaiKey) });
    }

    /* verify the key without deploying — proves it end-to-end, masked only */
    if (p === "/api/settings/test" && req.method === "POST") {
      const s = await loadSettings();
      if (!s.breezeKey) return json(res, 200, { ok: false, detail: "no key set" });
      try {
        const r = await fetch((s.breezeUrl || "https://panel.breezedeploy.dev") + "/tenants",
          { headers: { "x-api-key": s.breezeKey } });
        const t = await r.text();
        if (!r.ok) return json(res, 200, { ok: false, status: r.status, detail: t.slice(0, 160) });
        let tenant = null; try { tenant = JSON.parse(t)[0]; } catch {}
        return json(res, 200, { ok: true, status: r.status, tenant: tenant ? { id: tenant.id, plan: tenant.plan } : null });
      } catch (e) { return json(res, 200, { ok: false, detail: e.message }); }
    }

    if (p === "/api/project" && req.method === "POST") {
      const b = await readBody(req);
      if (!b.name) return json(res, 400, { error: "name required" });
      const path = await scaffold(b.name);
      return json(res, 200, { ok: true, path });
    }

    /* ---- conversation history ----
       The transcript used to live only in the page's DOM, so every refresh threw
       the whole conversation away - and a refresh was the ONLY way to recover
       from a latched composer, so the fix for one bug triggered the other. The
       agent remembered (it resumes server-side); the user was left staring at an
       empty page.
       Claude Code already keeps an authoritative JSONL per session. Read it back
       rather than inventing a second store that could disagree with it. */
    if (p === "/api/history") {
      const proj = safeProject(url.searchParams.get("project"));
      if (!proj) return json(res, 400, { error: "missing or invalid ?project=" });
      const projectPath = join(WORKSPACE, proj);
      let sid = chatSessions.get(proj) || await recoverSessionFromDisk(projectPath);
      if (!sid) return json(res, 200, { turns: [], session: null });
      /* One dash PER separator, so no `+`. Claude Code maps each character
       independently: "C:\Users\..." becomes "C--Users-...", because the colon
       and the backslash each contribute a dash. A greedy `+` collapsed them to
       "C-Users-...", which matches no directory that exists, and the endpoint
       silently returned an empty history instead of failing. */
    const enc = resolve(projectPath).replace(/[\\/:]/g, "-").replace(/^-+/, "");
      const file = join(process.env.USERPROFILE || process.env.HOME || "",
        ".claude", "projects", enc, `${sid}.jsonl`);
      if (!existsSync(file)) return json(res, 200, { turns: [], session: sid });

      const turns = [];
      const raw = await readFile(file, "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        const role = o.type === "user" ? "me" : o.type === "assistant" ? "pf" : null;
        if (!role) continue;
        let c = o.message && o.message.content;
        if (Array.isArray(c)) c = c.filter((x) => x && x.type === "text").map((x) => x.text).join("\n");
        if (typeof c !== "string") continue;
        const text = c.trim();
        if (!text) continue;
        /* Skip the machinery the user never typed and should not have to read:
           tool plumbing, injected reminders, and the skill files the CLI pastes
           in wholesale when a skill loads. */
        if (/^\s*<(system-reminder|command-|local-command)/i.test(text)) continue;
        if (/Base directory for this skill:/.test(text)) continue;
        if (role === "me" && /tool_result/.test(text)) continue;
        turns.push({ role, text: text.slice(0, 20000) });
      }
      return json(res, 200, { turns, session: sid });
    }

    if (p === "/api/prompts") {
      const proj = safeProject(url.searchParams.get("project"));
      if (!proj) return json(res, 400, { error: "missing or invalid ?project=" });
      const dir = join(WORKSPACE, proj, "scratch", "prompts");
      let files = [];
      try { files = await readdir(dir); } catch {}
      const items = [];
      for (const f of files.filter((x) => x.endsWith(".txt"))) {
        const slug = f.replace(/\.txt$/, "");
        items.push({ slug, text: await readFile(join(dir, f), "utf8"),
          hasMaster: existsSync(join(WORKSPACE, proj, "images", "_masters", `${slug}.png`)) });
      }
      return json(res, 200, { items });
    }

    if (p === "/api/prompts" && req.method === "POST") {
      const b = await readBody(req);
      const dir = join(WORKSPACE, b.project, "scratch", "prompts");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${b.slug.replace(/[^a-z0-9-]/gi, "-")}.txt`), b.text || "", "utf8");
      return json(res, 200, { ok: true });
    }

    if (p === "/api/assets") {
      const proj = safeProject(url.searchParams.get("project"));
      if (!proj) return json(res, 400, { error: "missing or invalid ?project=" });
      const dir = join(WORKSPACE, proj, "images");
      let files = [];
      try { files = await readdir(dir); } catch {}
      const byslug = {};
      for (const f of files.filter((x) => /\.(png|jpe?g|webp)$/i.test(x))) {
        const m = f.match(/^(.*)-(\d+)\.(png|jpe?g|webp)$/i);
        const slug = m ? m[1] : f.replace(/\.\w+$/, "");
        (byslug[slug] ||= []).push({ file: f, width: m ? +m[2] : null });
      }
      return json(res, 200, { slugs: Object.entries(byslug).map(([slug, v]) => ({ slug, variants: v.sort((a, b) => (a.width || 0) - (b.width || 0)) })) });
    }

    if (p === "/api/run" && req.method === "POST") {
      const b = await readBody(req);
      const projectPath = join(WORKSPACE, b.project);
      if (!existsSync(projectPath)) return json(res, 400, { error: "unknown project" });
      let job;
      /* Gate 39: 2+ variants. Honour an explicit slug list, otherwise render every
         _mockup* prompt the agent wrote. Hardcoding ["_mockup"] here meant a call
         that had just written _mockup_a and _mockup_b rendered NEITHER. */
      if (b.kind === "mockup") {
        let slugs = Array.isArray(b.only) && b.only.length ? b.only : null;
        if (!slugs) {
          let files = [];
          try { files = await readdir(join(projectPath, "scratch", "prompts")); } catch {}
          slugs = files.filter((f) => /^_mockup.*\.txt$/i.test(f)).map((f) => f.replace(/\.txt$/i, "")).sort();
        }
        if (!slugs.length) return json(res, 400, {
          error: "no _mockup*.txt prompts found. Gate 39 wants at least two variants: write scratch/prompts/_mockup_a.txt and _mockup_b.txt first." });
        job = await jobGenerate(projectPath, slugs);
      }
      else if (b.kind === "generate") job = await jobGenerate(projectPath, b.only);
      else if (b.kind === "deploy") job = await jobDeploy(projectPath, {
        project: b.deployProject || b.project, app: b.app || b.project, port: b.port, mode: b.mode });
      else job = await jobPipeline(projectPath, b.kind);
      return json(res, 200, { ok: true, job: publicJob(job) });
    }

    if (p.startsWith("/api/job/")) {
      const job = jobs.get(p.split("/")[3]);
      if (!job) return json(res, 404, { error: "no such job" });
      return json(res, 200, { job: publicJob(job), steps: job.steps, log: job.log.slice(-500) });
    }

    /* ---- serve a project for live preview ---- */
    if (p.startsWith("/preview/")) {
      const [, , proj, ...rest] = p.split("/");
      let rel = rest.join("/") || "index.html";
      if (rel.endsWith("/")) rel += "index.html";
      const target = resolve(join(WORKSPACE, proj, rel));
      if (!target.startsWith(resolve(join(WORKSPACE, proj)))) { res.writeHead(403).end("Forbidden"); return; }
      if (!existsSync(target)) { res.writeHead(404).end("Not found"); return; }
      const body = await readFile(target);
      res.writeHead(200, { "content-type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store" });
      return res.end(body);
    }

    /* ---- static UI ---- */
    let rel = p === "/" ? "index.html" : p.replace(/^\//, "");
    const file = resolve(join(HERE, "public", rel));
    if (!file.startsWith(resolve(join(HERE, "public")))) { res.writeHead(403).end("Forbidden"); return; }
    if (!existsSync(file)) { res.writeHead(404, { "content-type": "text/plain" }).end("Not found"); return; }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store" });
    res.end(body);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

const settings = await loadSettings();
if (settings.workspace) WORKSPACE = settings.workspace;
await mkdir(WORKSPACE, { recursive: true });
await loadChatSessions();   // a restart must never orphan a conversation

/* 127.0.0.1, never 0.0.0.0 — this process can start jobs and holds a key */
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  perfectionistDesign dashboard`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  workspace: ${WORKSPACE}`);
  console.log(`  breeze key: ${settings.breezeKey ? mask(settings.breezeKey) : "not set — add one in Settings"}\n`);
});
