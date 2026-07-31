/* GATE 17 — tag tree balance.
 *
 * A layout defect is often a nesting defect: one unclosed div and a section is
 * suddenly inside its neighbour. Cheap to check, and it catches damage from any
 * script that rewrites markup with a regex.
 *
 * usage: node check-nesting.cjs [--root=<path>]
 */
const { cfg, html } = require("./_config.cjs");

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr", "use", "path", "circle",
  "rect", "line", "polyline", "polygon", "ellipse", "stop"]);

let doc = html()
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "");

const stack = [];
const problems = [];
const re = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)([^>]*?)(\/?)>/g;
let m, line = 1, last = 0;

while ((m = re.exec(doc))) {
  line += (doc.slice(last, m.index).match(/\n/g) || []).length;
  last = m.index;
  const [, closing, rawTag, attrs, selfClose] = m;
  const tag = rawTag.toLowerCase();
  if (tag === "!doctype" || VOID.has(tag) || selfClose === "/" || /\/$/.test(attrs.trim())) continue;

  if (!closing) stack.push({ tag, line });
  else {
    if (!stack.length) { problems.push(`line ${line}: </${tag}> with nothing open`); continue; }
    const top = stack[stack.length - 1];
    if (top.tag === tag) stack.pop();
    else {
      const at = stack.map((s) => s.tag).lastIndexOf(tag);
      if (at < 0) problems.push(`line ${line}: stray </${tag}>`);
      else {
        problems.push(`line ${line}: </${tag}> closes early — ${stack.slice(at + 1).map((s) => `<${s.tag}> (line ${s.line})`).join(", ")} left open`);
        stack.length = at;
      }
    }
  }
}
stack.forEach((s) => problems.push(`line ${s.line}: <${s.tag}> never closed`));

if (problems.length) {
  console.log(`${cfg.html}: ${problems.length} nesting problem(s)`);
  problems.slice(0, 25).forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("tag tree balanced");
