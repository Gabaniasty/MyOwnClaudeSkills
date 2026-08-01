/* GATE 39 — at least two mockups, and the user chose between them.
 *
 * This was the only gate in the skill with no number attached. It lived as prose
 * in four reference files plus a system prompt, and asked the agent to CONFIRM it
 * was generating two variants rather than COUNTING the files on disk. SKILL.md
 * §4.6 is explicit that a prose rule is not a control; this closes that.
 *
 * It counts prompts and rendered masters, and reports both. It cannot know
 * whether the user was actually shown the options and asked - no script can - so
 * it does not pretend to. It checks the part that is checkable and says plainly
 * which part is not.
 *
 * A single mockup is legitimate when the user supplied a reference image of the
 * NEW design or explicitly asked for one. That is recorded by dropping a
 * `scratch/.one-mockup` file with the reason, so the exception is visible in the
 * project rather than remembered in a chat.
 *
 * usage: node check-mockups.cjs [--root=<path>]
 */
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./_config.cjs");

const promptsDir = path.join(ROOT, "scratch", "prompts");
const mastersDir = path.join(ROOT, "images", "_masters");

const list = (dir, re) => {
  try { return fs.readdirSync(dir).filter((f) => re.test(f)).sort(); }
  catch { return []; }
};

const prompts = list(promptsDir, /^_mockup.*\.txt$/i);
const masters = list(mastersDir, /^_mockup.*\.png$/i);

/* A prompt with no render is a variant the user was never offered. That is the
   failure this gate is really guarding: "three mockups" in the transcript and two
   files on disk means the choice was made from an incomplete set. */
const unrendered = prompts
  .map((f) => f.replace(/\.txt$/i, ""))
  .filter((slug) => !masters.some((m) => m.replace(/\.png$/i, "") === slug));

const exemptFile = path.join(ROOT, "scratch", ".one-mockup");
let exempt = null;
if (fs.existsSync(exemptFile)) {
  try { exempt = fs.readFileSync(exemptFile, "utf8").trim() || "(no reason given)"; }
  catch { exempt = "(unreadable)"; }
}

console.log(`mockup prompts   : ${prompts.length}${prompts.length ? "  " + prompts.join(", ") : ""}`);
console.log(`mockup masters   : ${masters.length}${masters.length ? "  " + masters.join(", ") : ""}`);
if (unrendered.length) console.log(`unrendered       : ${unrendered.length}  ${unrendered.join(", ")}`);
if (exempt) console.log(`single-mockup exemption : ${exempt}`);

console.log("");
console.log("NOT COVERED HERE: whether the variants were actually SHOWN to the user");
console.log("and whether the USER chose. No script can see that. Gate 39 also");
console.log("requires them presented side by side at the same size, one line each on");
console.log("what each does well and what it costs, and the reply ending by asking");
console.log("which to build. Confirm that separately.");

let failed = false;
if (unrendered.length) {
  console.log(`\nFAILING: ${unrendered.length} mockup prompt(s) never rendered — the choice would be made from an incomplete set`);
  failed = true;
}
if (masters.length < 2 && !exempt) {
  console.log(`\nFAILING: ${masters.length} mockup(s); Gate 39 wants at least 2 for a new build or a redesign.`);
  console.log("If the user supplied a reference image of the new design or asked for a");
  console.log("single mockup, record it:  echo \"reason\" > scratch/.one-mockup");
  failed = true;
}
if (!failed) {
  console.log(`\nmockups: ${masters.length} rendered, 0 unrendered${exempt ? " (single-mockup exemption on file)" : ""}`);
}
process.exit(failed ? 1 : 0);
