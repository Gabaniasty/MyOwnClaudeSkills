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
/* Avatars are Lucide glyphs (ISC), same family and stroke-width as the toolbar
   icons in index.html. They were the letters "U" and "P", which read as initials
   of nothing and gave the agent no identity in the transcript. Inlined rather
   than <img> so they inherit currentColor and follow the theme swap for free. */
const AVATAR = {
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  pf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
};

function turn(who) {
  const t = el("div", `turn ${who}`);
  const av = el("div", "av");
  av.innerHTML = AVATAR[who] || AVATAR.pf;
  av.setAttribute("aria-hidden", "true");
  t.appendChild(av);
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

/* ------------------------------------------------------- visual presentation
 * An image pipeline that reports its work as a list of filenames is asking the
 * user to take its word for it. Every generated master is served by the preview
 * route, so it can simply be SHOWN. Two places:
 *   - a thumbnail against each finished step, inside the activity card
 *   - a full comparison strip when a run produced mockups, because Gate 39 says
 *     the variants must be presented side by side at the same size and the user
 *     picks. A paragraph describing three mockups is not a choice.
 * `?v=` busts the cache: a regenerated slug keeps its filename, and without it
 * the browser would keep showing the old render.
 */
const masterURL = (slug, v) => `/preview/${project}/images/_masters/${encodeURIComponent(slug)}.png?v=${v || 1}`;

function lightbox(src, caption) {
  const wrap = el("div", "lightbox");
  const img = document.createElement("img");
  img.src = src; img.alt = caption || "";
  const cap = el("div", "lb-cap", caption || "");
  wrap.append(img, cap);
  wrap.onclick = () => wrap.remove();
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { wrap.remove(); document.removeEventListener("keydown", esc); }
  });
  document.body.appendChild(wrap);
}

/* Mockups get their own card: large, equal width, labelled, click to enlarge. */
function mockupStrip(slugs) {
  const wrap = el("div", "shots");
  const head = el("div", "shots-h");
  head.append(el("b", null, slugs.length > 1 ? `${slugs.length} mockups — pick one` : "Mockup"));
  head.append(el("span", "cnt", slugs.length > 1 ? "click to enlarge" : ""));
  const grid = el("div", "shots-grid");
  grid.style.gridTemplateColumns = `repeat(${Math.min(slugs.length, 3)}, minmax(0, 1fr))`;
  slugs.forEach((slug) => {
    const fig = el("figure", "shot");
    const img = document.createElement("img");
    img.src = masterURL(slug, Date.now());
    img.alt = slug;
    /* NOT lazy. The strip is the thing the user has to look at to answer "which
       one?" - deferring it means the card appears with three empty frames and
       the question is unanswerable. Lazy stays on the small step thumbnails,
       which are incidental. */
    img.loading = "eager";
    img.decoding = "async";
    /* A mockup that failed to render must look broken, not absent — an empty
       gap reads as "there were only two" and hides a failure. */
    img.onerror = () => { fig.classList.add("missing"); fig.dataset.err = "did not render"; };
    img.onclick = () => lightbox(img.src, slug);
    const cap = el("figcaption", null, slug.replace(/^_mockup_?/, "").toUpperCase() || slug);
    fig.append(img, cap);
    grid.appendChild(fig);
  });
  wrap.append(head, grid);
  return wrap;
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
    /* Thumbnail as soon as the asset exists, so a wrong image is caught while
       the run is still going rather than at the end. */
    if (s.state === "ok" && /^(generate|mockup)$/.test(job.kind)) {
      const th = document.createElement("img");
      th.className = "thumb";
      th.src = masterURL(s.name, job.startedAt || 1);
      th.alt = s.name;
      th.loading = "lazy";
      th.onerror = () => th.remove();
      th.onclick = () => lightbox(th.src, s.name);
      row.appendChild(th);
    }
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
      /* Show what was actually produced. Mockups get the full comparison strip
         (Gate 39: side by side, same size, the user picks); an ordinary image
         run gets a contact sheet so a bad asset is visible immediately instead
         of surviving to the build. */
      if (/^(generate|mockup)$/.test(m.job.kind) && m.job.status === "ok") {
        const done = (m.steps || []).filter((s) => s.state === "ok").map((s) => s.name);
        const mockups = done.filter((s) => /^_mockup/i.test(s)).sort();
        const shown = mockups.length ? mockups : done;
        if (shown.length) (body || turn("pf")).appendChild(mockupStrip(shown));
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
      /* Say when the site is done and hand over the link. The user should never
         have to ask "is it finished, and where is it?" — the server already knows
         both, so answering is not the model's job to remember. */
      if (m.site && body) {
        const card = el("div", "live");
        card.style.animation = "rise .3s var(--ease) both";
        card.append(el("span", null, m.site.changed ? "Site updated" : "Site"));
        const a = el("a", null, "open it →");
        a.href = m.site.url; a.target = "_blank";
        card.append(a, el("span", "cnt",
          `${Math.round(m.site.bytes / 1024)} KB · ${m.site.images} images`));
        body.appendChild(card);
        (body._cards ||= []).push(card);
      }
      setBusy(false);
      bubble = null;
      refresh();
    }
    if (stick) toBottom();
  };
  es.onerror = () => { $("#sub").textContent = "reconnecting…"; };
  es.onopen = () => { if (!busy) $("#sub").textContent = "design pipeline"; reconcileBusy(); };
}

/* ------------------------------------------------------------- history
 * Replay the conversation on load. It used to live only in this page's DOM, so
 * every refresh discarded it - and refreshing was the only way out of a latched
 * composer, which made the workaround for one bug destroy the user's history.
 * The server reads Claude Code's own JSONL, so this survives page reloads,
 * server restarts and machine reboots alike.
 */
let historyLoaded = null;   // project whose history is already on screen

async function loadHistory(force) {
  if (!project) return;
  if (historyLoaded === project && !force) return;
  historyLoaded = project;
  let data;
  try { data = await api(`/api/history?project=${encodeURIComponent(project)}`); }
  catch { return; }
  if (!data || !data.turns || !data.turns.length) return;
  if (project !== historyLoaded) return;    // project changed while we fetched

  $(".welcome")?.remove();
  inner.innerHTML = "";
  for (const t of data.turns) {
    const b = turn(t.role);
    render(b, t.text);
  }
  const sep = el("div", "tool");
  sep.append(el("b", null, "history"),
    el("span", null, `${data.turns.length} earlier messages restored. Anything below is new.`));
  inner.appendChild(sep);
  body = null;
  toBottom();
}

/* --------------------------------------------------------------- self-heal
 * `busy` disables the Send button and was cleared ONLY by a chat:done event.
 * Anything that stops those events arriving - a server restart, a killed job, a
 * dropped SSE connection - left the composer permanently disabled with no way
 * back except a page reload, and no on-screen explanation. The user could not
 * send a message and the UI looked like it was still thinking.
 *
 * Events are a notification channel, never the source of truth. The server knows
 * what is actually running, so ask it. */
async function reconcileBusy() {
  try {
    const st = await api("/api/state");
    const running = (st.jobs || []).some((j) => j.status === "running");
    if (!running && busy) {
      setBusy(false);
      body?._think?.remove();
      body?._prose?.querySelector(".caret")?.remove();
      const n = el("div", "tool");
      n.append(el("b", null, "note"),
        el("span", null, "the previous turn ended without finishing (server restart or stopped job). Send a message to continue."));
      (body || turn("pf")).appendChild(n);
      body = null;
    } else if (running && !busy) {
      setBusy(true);          // reattach to work that started elsewhere
    }
  } catch {}
}

/* Belt and braces: SSE can stay open while the server behind it has gone away,
   in which case onopen never fires again. A slow poll costs nothing and is the
   difference between a stuck UI and one that recovers by itself. */
setInterval(reconcileBusy, 15000);

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
$("#projSel").onchange = (e) => {
  project = e.target.value; localStorage.setItem("pd:project", project);
  inner.innerHTML = ""; historyLoaded = null; body = null;
  welcome();
  loadHistory();   // replaced by the real conversation if this project has one
};

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
    "Redesign example-client.com, keep the logo and the real customer names, everything else is open.",
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
  $("#inKey").value = ""; $("#inKey").placeholder = S.breezeKeySet ? `saved: ${S.breezeKeyMasked}` : "hk_… your own key";
  $("#inAnthropic").value = ""; $("#inAnthropic").placeholder = S.anthropicKeySet ? `saved: ${S.anthropicKeyMasked}` : "sk-ant-…";
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
  st.textContent = r.ok ? `valid: ${r.tenant?.id} (${r.tenant?.plan})` : `rejected: ${r.status || ""} ${r.detail || ""}`.trim();
};

refresh().then(async () => { await loadHistory(); connect(); });
