// RED-check: prove the harness discriminates. Revert the v0.1.3 widened
// command-position prefix back to the pre-v0.1.3 form and confirm the
// subshell / brace / leading-whitespace cases then FAIL to block.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/bash-gate.ts", import.meta.url), "utf8");
const widened = "(?:^\\s*|[;&|(]\\s*|\\{\\s+)"; // v0.1.3 prefix
const oldPrefix = "(?:^|[;&|]\\s*)";           // pre-v0.1.3 prefix
const reverted = src.split(widened).join(oldPrefix);
if (reverted === src) { console.error("could not revert prefix — pattern drifted"); process.exit(2); }

const assign = reverted.indexOf("=", reverted.indexOf("const RULES"));
const end = reverted.indexOf("];", assign) + 1;
const RULES = new Function(`return (${reverted.slice(assign + 1, end)});`)();

// Dangerous strings built from parts so this file is harmless on disk; the
// guard only scans bash *command* strings, never file contents.
const rm = "r" + "m";
const flag = "-r" + "f";
const path = "/tmp/x";
const cases = [
  ["(" + rm + " " + flag + " " + path + ")",      true, "subshell ( ... )   — v0.1.3 only"],
  ["{ " + rm + " " + flag + " " + path + "; }",    true, "brace group { ...; } — v0.1.3 only"],
  ["  " + rm + " " + flag + " " + path,            true, "leading spaces      — v0.1.3 only"],
  [rm + " " + flag + " " + path,                   true, "plain rm            — pre-existing"],
];
let red = 0;
for (const [c, want, note] of cases) {
  const hit = RULES.find((r) => r.pattern.test(c));
  const blocked = !!hit;
  const isRed = blocked !== want; // a "red" result = the OLD prefix fails to block
  if (isRed) red++;
  console.log(`OLD-PREFIX ${blocked ? "blocked" : "missed "}  (want ${want ? "block" : "allow"})  ${note}`);
}
console.log(`\n${red}/4 cases fail under the OLD prefix (expected red for the 3 new-prefix cases)`);
