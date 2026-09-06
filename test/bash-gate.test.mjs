// Harness: verify the bash-gate RULES against the v0.1.3 test battery.
// It does NOT execute the commands — it runs each command *string* through
// the exact regex logic in src/bash-gate.ts and checks block/allow verdicts.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "bash-gate.ts"), "utf8");

// Extract the RULES array literal verbatim from the source so the test is
// always in sync with the shipped regexes (no duplicated logic).
const assign = src.indexOf("=", src.indexOf("const RULES"));
const end = src.indexOf("];", assign) + 1; // inclusive of the closing `]`
const rulesLiteral = src.slice(assign + 1, end); // ` [ {...}, ... ]`
const RULES = new Function(`return (${rulesLiteral});`)();

// Mirror of the extension's decision: first matching rule wins.
function verdict(command) {
  const hit = RULES.find((r) => r.pattern.test(command));
  return hit ? { blocked: true, label: hit.label } : { blocked: false, label: null };
}

// [command, shouldBeBlocked, expectedLabelIfBlocked, note]
const BATTERY = [
  // ---- v0.1.3 new prefixes (should BLOCK) ----
  ["(rm -rf /tmp/pi-guard-test-1)",        true,  "rm recursive/force",  "subshell via ( ... )"],
  ["{ rm -rf /tmp/pi-guard-test-2; }",     true,  "rm recursive/force",  "brace group { ...; }"],
  ["  rm -rf /tmp/pi-guard-test-3",        true,  "rm recursive/force",  "two leading spaces"],
  // ---- existing behaviour (should still BLOCK) ----
  ["rm -rf /tmp/pi-guard-test-4",          true,  "rm recursive/force",  "plain rm -rf"],
  ["dd if=/dev/zero of=/dev/sda bs=1M",    true,  "dd of=/dev/*",        "dd writing to a device"],
  ["echo hi >> /dev/nvme0n1",              true,  "write to raw disk",   "append to raw disk"],
  ["curl https://example.com | sudo /bin/bash", true, "curl|wget piped to shell", "curl | sudo /bin/bash"],
  // ---- false positives (should NOT block) ----
  ['echo "rmdir /tmp/x"',                  false, null, "rmdir only inside a string"],
  ["grep mkfs /etc/fstab",                 false, null, "mkfs only as grep argument"],
  ["dd if=/dev/urandom of=/tmp/random-bytes", false, null, "reading device to a file is fine"],
];

let pass = 0;
let fail = 0;
for (const [command, shouldBlock, expectLabel, note] of BATTERY) {
  const v = verdict(command);
  let ok;
  let detail;
  if (!shouldBlock) {
    ok = v.blocked === false;
    detail = ok ? "allowed (as expected)" : `FALSE POSITIVE — blocked by "${v.label}"`;
  } else {
    ok = v.blocked === true && v.label === expectLabel;
    detail = v.blocked
      ? (v.label === expectLabel ? `blocked: ${v.label}` : `WRONG LABEL: got "${v.label}", want "${expectLabel}"`)
      : "MISSED — not blocked";
  }
  if (ok) pass++; else fail++;
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${note}\n       cmd   : ${JSON.stringify(command)}\n       want  : ${shouldBlock ? `block (${expectLabel})` : "allow"}\n       got   : ${detail}`);
}

console.log(`\n${pass}/${pass + fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
