// path-jail containment (run: node --experimental-strip-types test/path-jail.test.ts).
import assert from "node:assert";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jailEscapes } from "../src/path-jail.ts";

let fail = 0;
function t(name: string, fn: () => void) {
  try { fn(); console.log(`ok    ${name}`); } catch (e) { fail++; console.log(`FAIL  ${name}: ${(e as Error).message}`); }
}

const root = realpathSync(mkdtempSync(join(tmpdir(), "pj-")));
const proj = join(root, "proj");
const outside = join(root, "outside");
mkdirSync(join(proj, "src"), { recursive: true });
mkdirSync(outside);
writeFileSync(join(outside, "secret.txt"), "x");
symlinkSync(outside, join(proj, "link"));                         // dir symlink → outside
symlinkSync(join(outside, "secret.txt"), join(proj, "alias.txt")); // file symlink → outside

t("plain file inside cwd is allowed", () => assert.equal(jailEscapes("src/a.ts", proj), false));
t("new nested file inside cwd is allowed", () => assert.equal(jailEscapes("src/new/deep/b.ts", proj), false));
t("absolute path outside is blocked", () => assert.equal(jailEscapes(join(outside, "x.txt"), proj), true));
t("../ traversal outside is blocked", () => assert.equal(jailEscapes("../outside/x.txt", proj), true));
t("write THROUGH a dir symlink pointing outside is blocked", () => assert.equal(jailEscapes("link/new.txt", proj), true));
t("write to an existing FILE symlink pointing outside is blocked", () => assert.equal(jailEscapes("alias.txt", proj), true));
t("cwd reached via a symlinked path is still inside", () => {
  symlinkSync(proj, join(root, "projlink"));
  assert.equal(jailEscapes("src/a.ts", join(root, "projlink")), false);
});

console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
