/* Perfectionist — one chat, everything the agent does rendered inline.
   No framework, no build step, matching the skill's own architecture. */
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
const api = async (p, o) => (await fetch(p, { headers: { "content-type": "application/json" }, ...o })).json();

let S = {};
let project = localStorage.getItem("pd:project") || null;
let bubble = null;              // the assistant paragraph currently streaming
let body = null;                // the assistant turn's body, where cards land
const cards = new Map();        // jobId -> card element
let busy = false;

const thread = $("#thread"), inner = $("#inner");
const atBottom = () => thread.scrollTop + thread.clientHeight >= thread.scrollHeight - 120;
const toBottom = () => (thread.scrollTop = thread.scrollHeight);

/* ------------------------------------------------------------------ theme */
document.documentElement.dataset.theme = localStorage.getItem("pd:theme") || "dark";
$("#btnTheme").onclick = () => {
  const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = n;
  localStorage.setItem("pd:theme", n);
};

/* ------------------------------------------------------------------ turns */
function turn(who) {
  const t = el("div", `turn ${who}`);
  t.appendChild(el("div", "av", who === "me" ? "U" : "P"));
  const b = el("div", "body");
  t.appendChild(b);
  inner.appendChild(t);
  return b;
}

/* very small markdown: **bold**, `code`, and paragraph breaks. Deliberately not a
   full parser — the agent is told to write plainly, and a heavy renderer here
   would fight the streaming. */
function render(node, text) {
  node.innerHTML = "";
  for (const para of text.split(/\n{2,}/)) {
    const p = el("p");
    let html = para
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    p.innerHTML = html;
    node.appendChild(p);
  }
}

/* the trace should read like a person wrote it, not like a tool registry */
const TOOL_NAMES = { Read: "read", Write: "wrote", Edit: "edited", MultiEdit: "edited",
  Bash: "ran", Glob: "searched", Grep: "searched", WebFetch: "fetched", Skill: "loaded skill",
  TodoWrite: "planned", NotebookEdit: "edited" };
const prettyTool = (t) => TOOL_NAMES[t] || t.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ");
/* absolute paths dominate the line and say nothing — keep the last two segments */
const shortPath = (d) => String(d).replace(/[A-Za-z]:[\\/][^\s"']*[\\/]([^\\/\s"']+[\\/][^\\/\s"']+)/g, "…/$1");

function setBusy(on) {
  busy = on;
  $("#mark").classList.toggle("busy", on);
  $("#btnSend").disabled = on;
  $("#btnStop").style.display = on ? "" : "none";
  $("#sub").textContent = on ? "working…" : "design pipeline";
}

/* ------------------------------------------------------------ activity card */
const LABEL = { generate: "Generating images", process: "Processing assets",
  gates: "Running the gates", stage: "Staging the build", deploy: "Deploying" };

function card(job) {
  const c = el("div", "act");
  c.dataset.s = "running";
  const h = el("div", "act-h");
  h.append(el("span", "ico"), el("b", null, LABEL[job.kind] || job.kind));
  const sp = el("span", "sp"), cnt = el("span", "cnt");
  const tog = el("button", "act-toggle", "details");
  h.append(sp, cnt, tog);
  const bar = el("div", "act-bar"); bar.appendChild(el("i"));
  const items = el("div", "act-items");
  c.append(h, bar, items);
  tog.onclick = () => { c.classList.toggle("open"); tog.textContent = c.classList.contains("open") ? "hide" : "details"; };
  c._cnt = cnt; c._bar = bar.firstChild; c._items = items;
  return c;
}

function paint(c, job, steps) {
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  c._bar.style.width = pct + "%";
  c._cnt.textContent = `${job.done}/${job.total}`;
  c._items.innerHTML = "";
  for (const s of steps || []) {
    const row = el("div", "it");
    row.dataset.s = s.state;
    row.append(el("span", "d"), el("span", "nm", s.name), el("span", "dt", s.detail || ""));
    c._items.appendChild(row);
  }
  /* auto-open while something is running, so progress is visible without a click */
  const running = (steps || []).some((s) => s.state === "running");
  if (running && !c.classList.contains("open")) {
    c.classList.add("open");
    c.querySelector(".act-toggle").textContent = "hide";
  }
  const cur = c._items.querySelector('[data-s="running"]');
  if (cur) cur.scrollIntoView({ block: "nearest" });
}

/* ------------------------------------------------------------------ send */
async function send(text) {
  if (!text.trim() || busy) return;
  if (!project) { await ensureProject(); if (!project) return; }
  $(".welcome")?.remove();

  const me = turn("me");
  render(me, text);

  body = turn("pf");
  const think = el("div", "think");
  think.append(el("span", "d"), el("span", "d"), el("span", "d"), el("span", null, "thinking"));
  body.appendChild(think);
  body._think = think;
  bubble = null;
  toBottom();
  setBusy(true);

  const r = await api("/api/chat", { method: "POST", body: JSON.stringify({
    project, prompt: text, permissionMode: $("#mode").value }) });
  if (r.error) { think.remove(); render(body, `**Could not start.** ${r.error}`); setBusy(false); }
}

const input = $("#input");
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 190) + "px";
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const v = input.value; input.value = ""; input.style.height = "auto"; send(v); }
});
$("#btnSend").onclick = () => { const v = input.value; input.value = ""; input.style.height = "auto"; send(v); };
$("#btnStop").onclick = async () => { await api("/api/stop", { method: "POST", body: JSON.stringify({ project }) }); };

/* ------------------------------------------------------------------ stream */
function connect() {
  const es = new EventSource("/api/events");
  es.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const stick = atBottom();

    if (m.type === "chat:delta" && body) {
      body._think?.remove(); body._think = null;
      /* Keep prose and activity cards in SEPARATE containers. Re-rendering the
         accumulated text on every delta is what makes mid-stream markdown close
         correctly, but doing it over the whole turn would wipe the cards that
         have already landed under it. */
      if (!body._prose) { body._prose = el("div"); body.appendChild(body._prose); }
      body._acc = (body._acc || "") + m.text;
      render(body._prose, body._acc);
      body._prose.lastElementChild?.appendChild(el("span", "caret"));
      /* cards always sit below the prose */
      for (const c of body._cards || []) body.appendChild(c);
    }

    if (m.type === "chat:tool") {
      body?._think?.remove(); if (body) body._think = null;
      /* A pipeline call already gets a full activity card a moment later, so the
         raw mcp__pipeline__run_gates trace line would just be noise above it. */
      if (/^mcp__pipeline__/.test(m.tool)) return;
      const t = el("div", "tool");
      t.append(el("b", null, prettyTool(m.tool)), el("span", null, shortPath(m.detail || "")));
      body?.appendChild(t);
      (body._cards ||= []).push(t);
    }

    if (m.type === "job:start" && m.job.kind !== "chat") {
      const c = card(m.job);
      cards.set(m.job.id, c);
      (body || turn("pf")).appendChild(c);
      (body._cards ||= []).push(c);
    }
    if (m.type === "job:step") {
      const c = cards.get(m.id); if (c) paint(c, m.job, m.steps);
    }
    if (m.type === "job:end") {
      const c = cards.get(m.job.id);
      if (c) {
        c.dataset.s = m.job.status === "ok" ? "ok" : "fail";
        paint(c, m.job, m.steps);
        c._cnt.textContent = `${m.job.done}/${m.job.total} · ${Math.round(m.job.elapsed / 1000)}s`;
        if (m.job.status === "ok") { c.classList.remove("open"); c.querySelector(".act-toggle").textContent = "details"; }
      }
      if (m.job.kind === "deploy" && m.job.result?.url) {
        const live = el("div", "live");
        live.append(el("span", null, m.job.result.broken ? "Deployed, but assets are missing:" : "Live:"));
        const a = el("a", null, m.job.result.url); a.href = m.job.result.url; a.target = "_blank";
        live.append(a, el("span", "cnt", `${m.job.result.assets} assets · ${m.job.result.broken} broken`));
        (body || turn("pf")).appendChild(live);
      }
      refresh();
    }
    if (m.type === "chat:done") {
      body?._think?.remove();
      body?._prose?.querySelector(".caret")?.remove();
      setBusy(false);
      bubble = null;
      refresh();
    }
    if (stick) toBottom();
  };
  es.onerror = () => { $("#sub").textContent = "reconnecting…"; };
  es.onopen = () => { if (!busy) $("#sub").textContent = "design pipeline"; };
}

/* ------------------------------------------------------------------ state */
async function refresh() {
  S = await api("/api/state");
  const sel = $("#projSel");
  sel.innerHTML = "";
  for (const p of S.projects) {
    const o = el("option", null, p.name); o.value = p.name; sel.appendChild(o);
  }
  if (!project || !S.projects.some((p) => p.name === project)) project = S.projects[0]?.name || null;
  if (project) sel.value = project;
  localStorage.setItem("pd:project", project || "");
  $("#authPill").textContent = S.claudeAuth === "apiKey" ? "API key" : "subscription";
  $("#authPill").className = "pill" + (S.cli?.claude?.installed ? "" : " bad");
  if (!S.cli?.claude?.installed) $("#authPill").textContent = "claude CLI missing";
  $("#mode").value = S.permissionMode || "auto";
  if (!inner.children.length) welcome();
}
$("#projSel").onchange = (e) => { project = e.target.value; localStorage.setItem("pd:project", project); inner.innerHTML = ""; welcome(); };

async function ensureProject() {
  if (S.projects?.length) { project = S.projects[0].name; return; }
  $("#dlgNew").showModal();
}

function welcome() {
  inner.innerHTML = "";
  const w = el("div", "welcome");
  w.appendChild(el("h1", null, "What are we building?"));
  w.appendChild(el("p", null, project
    ? `Working in ${project}. Describe the site and I'll interview you, design it, generate the imagery, verify it against the gates, and deploy when you say so.`
    : "Create a project to begin."));
  const chips = el("div", "chips");
  for (const t of [
    "A landing page for a business-class airline. Premium, restrained, lots of whitespace.",
    "Redesign example-client.com — keep the logo and the real customer names, everything else is open.",
    "The work grid collides with the card above it at 1280. Measure it and fix it.",
  ]) {
    const c = el("button", "chip", t);
    c.onclick = () => { input.value = t; input.focus(); input.dispatchEvent(new Event("input")); };
    chips.appendChild(c);
  }
  w.appendChild(chips);
  inner.appendChild(w);
}

/* ------------------------------------------------------------------ dialogs */
$("#btnNew").onclick = () => { $("#inName").value = ""; $("#dlgNew").showModal(); };
$("#btnCreate").onclick = async () => {
  const n = $("#inName").value.trim(); if (!n) return;
  const r = await api("/api/project", { method: "POST", body: JSON.stringify({ name: n }) });
  if (!r.error) { project = n.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase(); inner.innerHTML = ""; }
  await refresh();
};
$("#btnDeploy").onclick = async () => {
  if (!S.breezeKeySet) { $("#dlgSettings").showModal(); return; }
  $(".welcome")?.remove();
  if (!body || !busy) body = turn("pf");
  await api("/api/run", { method: "POST", body: JSON.stringify({
    project, kind: "deploy", deployProject: project, app: project }) });
};
$("#btnSettings").onclick = async () => {
  await refresh();
  $("#inWs").value = S.workspace;
  $("#inKey").value = ""; $("#inKey").placeholder = S.breezeKeySet ? `saved — ${S.breezeKeyMasked}` : "hk_… your own key";
  $("#inAnthropic").value = ""; $("#inAnthropic").placeholder = S.anthropicKeySet ? `saved — ${S.anthropicKeyMasked}` : "sk-ant-…";
  $("#selClaudeAuth").value = S.claudeAuth; $("#selImageAuth").value = S.imageAuth;
  $("#inModel").value = S.model || "";
  const c = $("#cliState"); c.innerHTML = "";
  for (const [name, info] of [["claude", S.cli?.claude], ["codex", S.cli?.codex]])
    c.appendChild(el("span", "pill " + (info?.installed ? "ok" : "bad"),
      `${name}: ${info?.installed ? info.detail || "ready" : "not found"}`));
  $("#dlgSettings").showModal();
};
$("#btnSaveSettings").onclick = async () => {
  const b = { workspace: $("#inWs").value, claudeAuth: $("#selClaudeAuth").value,
    imageAuth: $("#selImageAuth").value, model: $("#inModel").value };
  if ($("#inKey").value) b.breezeKey = $("#inKey").value;
  if ($("#inAnthropic").value) b.anthropicKey = $("#inAnthropic").value;
  await api("/api/settings", { method: "POST", body: JSON.stringify(b) });
  await refresh();
};
$("#btnTestKey").onclick = async (e) => {
  e.preventDefault();
  const st = $("#keyState"); st.className = "pill run"; st.textContent = "testing…";
  if ($("#inKey").value) await api("/api/settings", { method: "POST", body: JSON.stringify({ breezeKey: $("#inKey").value }) });
  const r = await api("/api/settings/test", { method: "POST", body: "{}" });
  st.className = "pill " + (r.ok ? "ok" : "bad");
  st.textContent = r.ok ? `valid — ${r.tenant?.id} (${r.tenant?.plan})` : `rejected — ${r.status || ""} ${r.detail || ""}`.trim();
};

refresh().then(connect);
