import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

const GUARDED = new Set(["write", "edit"]);

function realpathOfExistingAncestor(target: string): string {
  let current = target;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return realpathSync(parent);
    current = parent;
  }
  return realpathSync(current);
}

function isInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  const p = parent.endsWith(sep) ? parent : parent + sep;
  return child.startsWith(p);
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!GUARDED.has(event.toolName)) return undefined;

    const rawPath = (event.input as { path?: unknown }).path;
    if (typeof rawPath !== "string" || rawPath.length === 0) return undefined;

    const absolute = isAbsolute(rawPath) ? rawPath : resolve(ctx.cwd, rawPath);
    const resolvedAncestor = realpathOfExistingAncestor(absolute);
    const jail = realpathSync(ctx.cwd);

    const escapes = !isInside(resolvedAncestor, jail) && !isInside(absolute, jail);
    if (!escapes) return undefined;

    const reason = `pi-injection-guard path-jail blocked write outside cwd: ${absolute} (resolved: ${resolvedAncestor})`;
    if (ctx.hasUI) ctx.ui.notify(reason, "warning");
    return { block: true, reason };
  });
}
