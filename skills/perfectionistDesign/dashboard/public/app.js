/* perfectionistDesign dashboard — client.
   No framework, no build step, matching the skill's own architecture. */
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
const api = async (p, opts) => (await fetch(p, { headers: { "content-type": "application/json" }, ...opts })).json();

let S = {};                 // server state
let project = localStorage.getItem("pd:project") || null;
let activeJob = null;

/* ------------------------------------------------------------------ theme */
const theme = localStorage.getItem("pd:theme") || "dark";
document.documentElement.dataset.theme = theme;
$("#btnTheme").onclick = () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("pd:theme", next);
};

/* ------------------------------------------------------------------ log */
const logBox = $("#log");
function log(text, level = "log") {
  const atBottom = logBox.scrollTop + logBox.clientHeight >= logBox.scrollHeight - 40;
  const d = el("div", level, text);
  logBox.appendChild(d);
  while (logBox.children.length > 900) logBox.firstChild.remove();
  if (atBottom) logBox.scrollTop = logBox.scrollHeight;
}
$("#btnClear").onclick = () => (logBox.innerHTML = "");

/* ------------------------------------------------------------------ state */
async function refresh() {
  S = await api("/api/state");
  $("#ws").textContent = S.workspace;
  if (!project || !S.projects.some((p) => p.name === project)) project = S.projects[0]?.name || null;
  localStorage.setItem("pd:project", project || "");
  renderProjects();
  renderStages();
}

function renderProjects() {
  const box = $("#projects");
  box.innerHTML = "";
  if (!S.projects.length) {
    const e = el("div", "empty");
    e.appendChild(el("b", null, "No projects yet"));
    e.appendChild(el("span", null, "Create one to start. The dashboard scaffolds the folders; Claude writes the page."));
    box.appendChild(e);
    $("#projPill").textContent = "no project";
    return;
  }
  for (const p of S.projects) {
    const b = el("button", "proj" + (p.name === project ? " on" : ""));
    b.appendChild(el("b", null, p.name));
    b.appendChild(el("small", null, `${p.prompts} prompts · ${p.masters} masters · ${p.variants} variants`));
    b.onclick = () => { project = p.name; localStorage.setItem("pd:project", project); renderProjects(); renderStages(); };
    box.appendChild(b);
  }
  const cur = S.projects.find((p) => p.name === project);
  $("#projPill").textContent = cur ? `${project} · ${(cur.htmlBytes / 1024).toFixed(0)} KB` : "no project";
}

/* ------------------------------------------------------------------ stages */
const STAGES = [
  { n: 1, id: "chat", title: "Brief & build", desc: "Talk to Claude in this project's folder. It reads and writes the real files." },
  { n: 2, id: "generate", title: "Generate images", desc: "Runs Codex on every prompt in scratch/prompts. Uses your ChatGPT login — no API cost.", run: "generate" },
  { n: 3, id: "process", title: "Process assets", desc: "Masters to variants, srcsets reconciled from disk, references audited.", run: "process" },
  { n: 4, id: "gates", title: "Run the gates", desc: "References, tag tree, markup faults, unused assets.", run: "gates" },
  { n: 5, id: "preview", title: "Preview & audit", desc: "Open the page and run the browser audit at every breakpoint." },
  { n: 6, id: "deploy", title: "Deploy", desc: "Stages a derived folder, uploads to Breeze, then HEAD-checks every asset live." },
];

function renderStages() {
  const box = $("#stages");
  box.innerHTML = "";
  if (!project) return;

  for (const st of STAGES) {
    const card = el("div", "stage");
    card.dataset.stage = st.id;
    const h = el("div", "stage-h");
    h.appendChild(el("span", "n", String(st.n)));
    h.appendChild(el("b", null, st.title));
    const pill = el("span", "pill"); pill.id = `pill-${st.id}`; pill.textContent = "idle";
    h.appendChild(el("span", null, "")).style.flex = "1";
    h.appendChild(pill);
    card.appendChild(h);
    card.appendChild(el("p", null, st.desc));

    if (st.id === "chat") card.appendChild(buildChat());
    else if (st.id === "preview") card.appendChild(buildPreview());
    else if (st.id === "deploy") card.appendChild(buildDeploy());
    else card.appendChild(buildRunner(st));

    box.appendChild(card);
  }
}

function progressBlock(id) {
  const wrap = el("div");
  const bar = el("div", "bar"); bar.id = `bar-${id}`;
  bar.appendChild(el("i"));
  const meta = el("div", "meta"); meta.id = `meta-${id}`;
  meta.appendChild(el("span", null, "")); meta.appendChild(el("span", null, ""));
  const steps = el("div", "steps"); steps.id = `steps-${id}`;
  wrap.append(bar, meta, steps);
  wrap.style.display = "grid"; wrap.style.gap = "7px";
  return wrap;
}

function buildRunner(st) {
  const wrap = el("div"); wrap.style.display = "grid"; wrap.style.gap = "9px";
  const row = el("div", "row");
  const btn = el("button", "primary", st.id === "generate" ? "Generate all" : "Run");
  btn.onclick = () => startJob(st.run, {}, st.id);
  row.appendChild(btn);
  if (st.id === "generate") {
    const only = el("input");
    only.placeholder = "optional: only these slugs, comma separated";
    only.style.flex = "1"; only.style.minWidth = "180px"; only.id = "genOnly";
    row.appendChild(only);
    btn.onclick = () => startJob("generate", { only: only.value.split(",").map((s) => s.trim()).filter(Boolean) }, st.id);
  }
  wrap.append(row, progressBlock(st.id));
  return wrap;
}

function buildPreview() {
  const wrap = el("div", "row");
  const open = el("button", null, "Open page");
  open.onclick = () => window.open(`/preview/${project}/index.html`, "_blank");
  const audit = el("button", null, "Copy browser audit");
  audit.onclick = async () => {
    const src = await (await fetch("/audit.browser.js")).text();
    await navigator.clipboard.writeText(src + "\n// then: await pdAudit()");
    audit.textContent = "Copied — paste into devtools";
    setTimeout(() => (audit.textContent = "Copy browser audit"), 2400);
  };
  const assets = el("button", null, "Show assets");
  assets.onclick = showAssets;
  wrap.append(open, audit, assets);
  const grid = el("div", "grid-assets"); grid.id = "assetGrid"; grid.style.marginTop = "4px";
  const outer = el("div"); outer.style.display = "grid"; outer.style.gap = "9px";
  outer.append(wrap, grid);
  return outer;
}

async function showAssets() {
  const grid = $("#assetGrid");
  grid.innerHTML = "";
  const { slugs } = await api(`/api/assets?project=${encodeURIComponent(project)}`);
  if (!slugs.length) { grid.appendChild(el("div", "empty", "No processed images yet.")); return; }
  for (const s of slugs) {
    const v = s.variants[s.variants.length - 1];
    const a = el("div", "asset");
    const img = el("img");
    img.loading = "lazy"; img.alt = s.slug;
    img.src = `/preview/${project}/images/${v.file}`;
    a.append(img, el("span", null, `${s.slug} · ${s.variants.length}`));
    grid.appendChild(a);
  }
}

function buildDeploy() {
  const wrap = el("div"); wrap.style.display = "grid"; wrap.style.gap = "9px";
  const row = el("div", "row");
  const btn = el("button", "primary", "Deploy to Breeze");
  btn.onclick = () => {
    if (!S.breezeKeySet) { log("No Breeze API key set — open Settings and add your own.", "error"); $("#dlgSettings").showModal(); return; }
    $("#inDProject").value = project; $("#inDApp").value = project;
    $("#dlgDeploy").showModal();
  };
  const stage = el("button", null, "Stage only");
  stage.onclick = () => startJob("stage", {}, "deploy");
  const link = el("a", null, ""); link.id = "liveLink"; link.target = "_blank"; link.style.fontSize = "12.5px";
  row.append(btn, stage, link);
  wrap.append(row, progressBlock("deploy"));
  return wrap;
}

/* ------------------------------------------------------------------ chat */
function buildChat() {
  const wrap = el("div"); wrap.style.display = "grid"; wrap.style.gap = "8px";
  const thread = el("div"); thread.id = "thread";
  thread.style.cssText = "display:grid;gap:10px;max-height:340px;overflow:auto;padding:2px";
  const ta = el("textarea");
  ta.id = "chatIn"; ta.rows = 3;
  ta.placeholder = "e.g. Build the hero and the problem section from the mockup in scratch/, or: the work grid collides at 1280 — fix it";
  ta.style.minHeight = "72px";
  const row = el("div", "row");
  const send = el("button", "primary", "Send");
  const fresh = el("button", null, "New thread");
  const mode = el("select"); mode.id = "permMode"; mode.style.width = "auto";
  for (const [v, t] of [["auto", "build freely"], ["plan", "plan only, no writes"]]) {
    const o = el("option", null, t); o.value = v; mode.appendChild(o);
  }
  mode.value = S.permissionMode || "auto";
  const note = el("span", "pill", S.claudeAuth === "apiKey" ? "API key" : "subscription");
  row.append(send, fresh, mode, note);

  send.onclick = () => sendChat(ta, false);
  fresh.onclick = () => { thread.innerHTML = ""; sendChat(ta, true); };
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendChat(ta, false); } };

  wrap.append(thread, ta, row);
  return wrap;
}

let streamBubble = null;
async function sendChat(ta, freshThread) {
  const prompt = ta.value.trim();
  if (!prompt) return;
  if (!S.cli?.claude?.installed) {
    log("The Claude CLI is not on PATH. Install it, then run `claude` once to sign in.", "error");
    return;
  }
  const thread = $("#thread");
  const me = el("div"); me.style.cssText = "justify-self:end;max-width:86%;background:var(--panel-2);border:1px solid var(--line);padding:8px 11px;border-radius:12px;font-size:13px";
  me.textContent = prompt;
  thread.appendChild(me);

  streamBubble = el("div");
  streamBubble.style.cssText = "max-width:92%;font-size:13px;line-height:1.6;white-space:pre-wrap;color:var(--ink-2)";
  streamBubble.textContent = "…";
  thread.appendChild(streamBubble);
  thread.scrollTop = thread.scrollHeight;

  ta.value = "";
  setPill("chat", "running", "thinking");
  const r = await api("/api/chat", { method: "POST", body: JSON.stringify({
    project, prompt, fresh: freshThread, permissionMode: $("#permMode")?.value }) });
  if (r.error) { streamBubble.textContent = r.error; setPill("chat", "fail", "error"); }
  else activeJob = r.job.id;
}

/* ------------------------------------------------------------------ jobs */
async function startJob(kind, extra, stageId) {
  if (!project) return;
  setPill(stageId, "running", "starting");
  resetSteps(stageId);
  const r = await api("/api/run", { method: "POST", body: JSON.stringify({ project, kind, ...extra }) });
  if (r.error) { log(r.error, "error"); setPill(stageId, "fail", r.error); return; }
  activeJob = r.job.id;
  jobStage.set(r.job.id, stageId);
}
const jobStage = new Map();

function setPill(stageId, state, text) {
  const p = document.getElementById(`pill-${stageId}`);
  if (!p) return;
  p.className = "pill" + (state === "ok" ? " ok" : state === "fail" ? " bad" : state === "running" ? " run" : "");
  p.textContent = text || state;
}
function resetSteps(stageId) {
  const s = document.getElementById(`steps-${stageId}`); if (s) s.innerHTML = "";
  const b = document.getElementById(`bar-${stageId}`);
  if (b) { b.className = "bar"; b.firstChild.style.width = "0%"; }
}
function paintSteps(stageId, steps, job) {
  const box = document.getElementById(`steps-${stageId}`); if (!box) return;
  box.innerHTML = "";
  for (const s of steps) {
    const row = el("div", "step"); row.dataset.s = s.state;
    row.append(el("span", "ic"), el("span", "nm", s.name), el("span", "dt", s.detail || ""));
    box.appendChild(row);
  }
  const running = box.querySelector('[data-s="running"]');
  if (running) running.scrollIntoView({ block: "nearest" });
  const bar = document.getElementById(`bar-${stageId}`);
  if (bar && job) {
    const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
    bar.firstChild.style.width = pct + "%";
    const meta = document.getElementById(`meta-${stageId}`);
    if (meta) {
      meta.children[0].textContent = `${job.done}/${job.total}`;
      meta.children[1].textContent = `${Math.round(job.elapsed / 1000)}s`;
    }
  }
}

/* ------------------------------------------------------------------ SSE */
function connect() {
  const es = new EventSource("/api/events");
  es.onopen = () => $("#dot").classList.add("live");
  es.onerror = () => { $("#dot").classList.remove("live"); };
  es.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const stageId = jobStage.get(m.id || m.job?.id) || (m.job?.kind === "chat" ? "chat" : null);

    if (m.type === "job:start" && m.job.kind === "chat") jobStage.set(m.job.id, "chat");
    if (m.type === "job:log") log(m.line.text, m.line.level);
    if (m.type === "job:step" && stageId) paintSteps(stageId, m.steps, m.job);
    if (m.type === "job:end") {
      const sid = jobStage.get(m.job.id) || (m.job.kind === "chat" ? "chat" : null);
      if (sid) {
        paintSteps(sid, m.steps || [], m.job);
        setPill(sid, m.job.status === "ok" ? "ok" : "fail",
          m.job.status === "ok" ? `done in ${Math.round(m.job.elapsed / 1000)}s` : "failed");
        const bar = document.getElementById(`bar-${sid}`);
        if (bar) bar.className = "bar " + (m.job.status === "ok" ? "ok" : "bad");
      }
      if (m.job.kind === "deploy" && m.job.result?.url) {
        const a = $("#liveLink");
        if (a) { a.href = m.job.result.url; a.textContent = m.job.result.url; }
        log(`live: ${m.job.result.url} — ${m.job.result.assets} assets, ${m.job.result.broken} broken`,
          m.job.result.broken ? "error" : "ok");
      }
      refresh();
    }
    if (m.type === "chat:delta" && streamBubble) {
      if (streamBubble.textContent === "…") streamBubble.textContent = "";
      streamBubble.textContent += m.text;
      const t = $("#thread"); if (t) t.scrollTop = t.scrollHeight;
    }
    if (m.type === "chat:tool" && streamBubble) {
      const tag = el("div", null, `${m.tool}  ${m.detail}`);
      tag.style.cssText = "font:11px/1.5 var(--mono);color:var(--ink-3);margin:2px 0";
      streamBubble.parentNode.insertBefore(tag, streamBubble);
    }
    if (m.type === "chat:done") {
      setPill("chat", m.ok ? "ok" : "fail", m.ok ? "replied" : "failed");
      streamBubble = null;
      refresh();
    }
  };
}

/* ------------------------------------------------------------------ dialogs */
$("#btnSettings").onclick = async () => {
  await refresh();
  $("#inWs").value = S.workspace;
  $("#inKey").value = "";
  $("#inKey").placeholder = S.breezeKeySet ? `saved — ${S.breezeKeyMasked}` : "hk_… your own key";
  $("#inAnthropic").value = "";
  $("#inAnthropic").placeholder = S.anthropicKeySet ? `saved — ${S.anthropicKeyMasked}` : "sk-ant-… (only if not using your subscription)";
  $("#selClaudeAuth").value = S.claudeAuth;
  $("#selImageAuth").value = S.imageAuth;
  $("#inModel").value = S.model || "";
  paintCli();
  $("#dlgSettings").showModal();
};
function paintCli() {
  const c = $("#cliState"); if (!c) return;
  c.innerHTML = "";
  for (const [name, info, hint] of [
    ["claude", S.cli?.claude, "run `claude` once to sign in with your subscription"],
    ["codex", S.cli?.codex, "run `codex login --device-auth` to sign in with ChatGPT"]]) {
    const p = el("span", "pill " + (info?.installed ? "ok" : "bad"),
      `${name}: ${info?.installed ? info.detail || "ready" : "not found"}`);
    p.title = info?.installed ? "" : hint;
    c.appendChild(p);
  }
}
$("#btnSaveSettings").onclick = async (e) => {
  const body = { workspace: $("#inWs").value, claudeAuth: $("#selClaudeAuth").value,
    imageAuth: $("#selImageAuth").value, model: $("#inModel").value };
  if ($("#inKey").value) body.breezeKey = $("#inKey").value;
  if ($("#inAnthropic").value) body.anthropicKey = $("#inAnthropic").value;
  await api("/api/settings", { method: "POST", body: JSON.stringify(body) });
  await refresh();
};
$("#btnTestKey").onclick = async (e) => {
  e.preventDefault();
  const st = $("#keyState");
  st.className = "pill run"; st.textContent = "testing…";
  if ($("#inKey").value) await api("/api/settings", { method: "POST", body: JSON.stringify({ breezeKey: $("#inKey").value }) });
  const r = await api("/api/settings/test", { method: "POST", body: "{}" });
  st.className = "pill " + (r.ok ? "ok" : "bad");
  st.textContent = r.ok ? `valid — tenant ${r.tenant?.id || "?"} (${r.tenant?.plan || "?"})`
                        : `rejected — ${r.status || ""} ${r.detail || ""}`.trim();
};
$("#btnNew").onclick = () => { $("#inName").value = ""; $("#dlgNew").showModal(); };
$("#btnCreate").onclick = async () => {
  const name = $("#inName").value.trim(); if (!name) return;
  const r = await api("/api/project", { method: "POST", body: JSON.stringify({ name }) });
  if (r.error) log(r.error, "error"); else { project = name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase(); }
  await refresh();
};
$("#btnDoDeploy").onclick = async () => {
  await startJob("deploy", { deployProject: $("#inDProject").value, app: $("#inDApp").value }, "deploy");
};

refresh().then(connect);
