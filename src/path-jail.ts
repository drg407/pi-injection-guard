import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const GUARDED = new Set(["write", "edit"]);

function isInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  const p = parent.endsWith(sep) ? parent : parent + sep;
  return child.startsWith(p);
}

/** Where a write to `absolute` really lands: the realpath of its deepest existing ancestor
 *  (symlinks resolved, including an existing file symlink) + the not-yet-existing suffix. */
export function canonicalTarget(absolute: string): string {
  let current = absolute;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(realpathSync(current), relative(current, absolute));
}

/** True when a write to rawPath (relative to cwd) lands outside cwd. Judged ONLY on the
 *  canonical target: a lexically-inside path that resolves outside through a symlink
 *  (dir or file) escapes. Fix 2026-11-11 — the old check let lexical containment win. */
export function jailEscapes(rawPath: string, cwd: string): boolean {
  const absolute = isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath);
  return !isInside(canonicalTarget(absolute), realpathSync(cwd));
}

/** Block reason with the sanctioned way to edit a file outside cwd. */
export function pathJailReason(absolute: string, resolvedAncestor: string): string {
  return `pi-injection-guard path-jail blocked write outside cwd: ${absolute} (resolved: ${resolvedAncestor}). edit/write only work inside the session cwd. If this edit is intended, use bash + python3: read the file, assert text.count(anchor) == 1, replace, write it back, then grep/parse the result — do not retry edit/write on this path.`;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!GUARDED.has(event.toolName)) return undefined;

    const rawPath = (event.input as { path?: unknown }).path;
    if (typeof rawPath !== "string" || rawPath.length === 0) return undefined;

    if (!jailEscapes(rawPath, ctx.cwd)) return undefined;
    const absolute = isAbsolute(rawPath) ? rawPath : resolve(ctx.cwd, rawPath);
    const resolvedAncestor = canonicalTarget(absolute);

    const reason = pathJailReason(absolute, resolvedAncestor);
    if (ctx.hasUI) ctx.ui.notify(reason, "warning");
    return { block: true, reason };
  });
}
