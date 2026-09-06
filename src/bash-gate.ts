// Defense-in-depth blocklist, not a security boundary. A determined agent
// or user can bypass any regex. Use OS-level permissions for real isolation.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\brm\s+[^|;&]*-[a-zA-Z]*[rRfF]/, label: "rm -r/-f" },
  { pattern: /\brmdir\b/, label: "rmdir" },
  { pattern: /\bunlink\b/, label: "unlink" },
  { pattern: /\bshred\b/, label: "shred" },
  { pattern: /\bdd\b[^|;&]*\bof=/, label: "dd of=" },
  { pattern: /\bgit\s+push\b[^|;&]*(--force|-f\b)/, label: "git push --force" },
  { pattern: /\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh)\b/, label: "curl|wget piped to shell" },
  { pattern: />\s*\/dev\/sd[a-z]/, label: "write to raw disk" },
  { pattern: /\bmkfs(\.[a-z0-9]+)?\b/, label: "mkfs" },
];

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;
    const command = String((event.input as { command?: unknown }).command ?? "");
    const hit = RULES.find((r) => r.pattern.test(command));
    if (!hit) return undefined;

    const reason = `pi-injection-guard bash-gate blocked pattern: ${hit.label}`;
    if (ctx.hasUI) ctx.ui.notify(reason, "warning");
    return { block: true, reason };
  });
}
