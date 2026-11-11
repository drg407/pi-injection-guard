// Block messages must say what to do next (run: node --experimental-strip-types test/messages.test.ts).
import assert from "node:assert";
import { bashGateReason } from "../src/bash-gate.ts";
import { pathJailReason } from "../src/path-jail.ts";

let fail = 0;
function t(name: string, fn: () => void) {
  try { fn(); console.log(`ok    ${name}`); } catch (e) { fail++; console.log(`FAIL  ${name}: ${(e as Error).message}`); }
}

for (const label of ["rm recursive/force", "rmdir", "unlink", "find -delete / find -exec rm"]) {
  t(`delete-class "${label}" points at trash`, () => {
    const r = bashGateReason(label);
    assert.match(r, /blocked pattern: /);
    assert.match(r, /trash <path>/);
  });
}
t("non-delete rule keeps the label and asks for user approval instead", () => {
  const r = bashGateReason("git push --force / +refspec");
  assert.match(r, /git push --force/);
  assert.doesNotMatch(r, /trash/);
  assert.match(r, /ask the user/);
});
t("path-jail reason names the path and the python recipe", () => {
  const r = pathJailReason("/Users/x/.pi/agent/AGENTS.md", "/Users/x/.pi/agent");
  assert.match(r, /\/Users\/x\/\.pi\/agent\/AGENTS\.md/);
  assert.match(r, /python3/);
  assert.match(r, /count\(anchor\) == 1/);
});

console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
