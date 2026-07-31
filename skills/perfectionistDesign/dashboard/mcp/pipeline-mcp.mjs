/* Exposes the perfectionistDesign pipeline to the agent as MCP tools.
 *
 * WHY THIS EXISTS
 * If the agent just ran `run-imagegen.ps1` through Bash, the dashboard would see
 * one opaque tool call and a wall of text thirty minutes later. Going through
 * MCP means the DASHBOARD owns the job: it streams real per-asset progress into
 * the chat as a live card while the agent waits, then hands the agent a short
 * summary instead of a log dump.
 *
 * It is a thin client. It holds no credentials and does no work itself — it
 * POSTs to the dashboard on localhost and polls that job to completion.
 *
 * Spawned by the dashboard via --mcp-config; not meant to be run by hand.
 */
const BASE = process.env.PD_DASHBOARD_URL || "http://127.0.0.1:4180";
const PROJECT = process.env.PD_PROJECT || "";

const TOOLS = [
  /* PHASE 1. First tool in the list because it is the first thing that happens.
     The dashboard shipped without it, so every build went brief -> code with no
     mockup at all, and the skill's own "Phase 1 is never skippable" could not be
     obeyed. A missing tool is a silently skipped phase. */
  { name: "generate_mockup",
    description: "PHASE 1, ALWAYS FIRST on any new page or redesign. Write the full-page mockup prompt to scratch/prompts/_mockup.txt, then call this. It renders one tall image of the WHOLE page — every section, in order — using the user's ChatGPT login. When it finishes, READ images/_masters/_mockup.png with the Read tool and extract the design system from it: palette, type scale, section order, composition. Do not write markup or image prompts before you have looked at it.",
    inputSchema: { type: "object", properties: {} }, kind: "mockup" },
  { name: "generate_images",
    description: "Generate every image whose prompt file exists in scratch/prompts, using the user's ChatGPT login via Codex. Shows live per-asset progress in the chat. Pass `only` to regenerate specific slugs. Write the prompt .txt files FIRST.",
    inputSchema: { type: "object", properties: {
      only: { type: "array", items: { type: "string" }, description: "optional slugs to limit the run to" } } },
    kind: "generate" },
  { name: "process_assets",
    description: "Turn generated masters into shipped variants, reconcile every srcset from what is actually on disk, then audit references both directions. Run after generate_images, and after ANY regeneration.",
    inputSchema: { type: "object", properties: {} }, kind: "process" },
  { name: "run_gates",
    description: "Run the mechanical failure gates: references resolve, tag tree balanced, no duplicate style attributes or dead custom properties, no unused assets. Returns the numbers.",
    inputSchema: { type: "object", properties: {} }, kind: "gates" },
  { name: "stage_build",
    description: "Assemble a clean deploy folder derived from the document's own references, and assert referenced === copied.",
    inputSchema: { type: "object", properties: {} }, kind: "stage" },
  { name: "deploy",
    description: "Deploy to Breeze and then HEAD-check every asset on the live host. Requires the user to have set their own Breeze API key in Settings. Ask before using this — it publishes.",
    inputSchema: { type: "object", properties: {
      app: { type: "string", description: "app name; becomes the subdomain" } } },
    kind: "deploy" },
];

const send = (o) => process.stdout.write(JSON.stringify(o) + "\n");

async function runJob(kind, args) {
  const body = { project: PROJECT, kind, ...args };
  const start = await (await fetch(`${BASE}/api/run`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body) })).json();
  if (start.error) return `could not start: ${start.error}`;

  const id = start.job.id;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500));
    const j = await (await fetch(`${BASE}/api/job/${id}`)).json();
    if (j.error) return `job vanished: ${j.error}`;
    if (j.job.status !== "running") {
      const steps = (j.steps || []).map((s) => `${s.state === "ok" ? "PASS" : s.state === "fail" ? "FAIL" : s.state} ${s.name}${s.detail ? " — " + s.detail : ""}`);
      const tail = (j.log || []).slice(-14).map((l) => l.text);
      return [`status: ${j.job.status}  (${j.job.done}/${j.job.total})`,
        ...steps, "", "output tail:", ...tail].join("\n");
    }
  }
}

let buf = "";
process.stdin.on("data", async (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }

    if (m.method === "initialize") {
      send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "perfectionist-pipeline", version: "1.0.0" } } });
    } else if (m.method === "tools/list") {
      send({ jsonrpc: "2.0", id: m.id, result: {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
    } else if (m.method === "tools/call") {
      const def = TOOLS.find((t) => t.name === m.params?.name);
      if (!def) {
        send({ jsonrpc: "2.0", id: m.id, result: { isError: true,
          content: [{ type: "text", text: `unknown tool ${m.params?.name}` }] } });
        continue;
      }
      let text;
      try { text = await runJob(def.kind, m.params.arguments || {}); }
      catch (e) { text = `error: ${e.message}`; }
      send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text }] } });
    } else if (m.id !== undefined) {
      send({ jsonrpc: "2.0", id: m.id, result: {} });
    }
  }
});
