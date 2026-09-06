// Defense-in-depth blocklist, not a security boundary. A determined agent
// or user can bypass any regex. Use OS-level permissions for real isolation.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?rm\b[^|;&]*(-[a-zA-Z]*[rRfF]|--recursive|--force|--no-preserve-root)/, label: "rm recursive/force" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?rmdir\b/, label: "rmdir" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?unlink\b/, label: "unlink" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?shred\b/, label: "shred" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?find\b[^|;&]*(-delete\b|-exec\s+rm\b)/, label: "find -delete / find -exec rm" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?dd\b[^|;&]*\bof=\/dev\//, label: "dd of=/dev/*" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?git\s+push\b[^|;&]*(--force\b|--force-with-lease\b|(?<!\S)-f(?!\S)|(?<=\s)\+[\w\/.-]+)/, label: "git push --force / +refspec" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?(curl|wget)\b[^|]*\|\s*(sudo\s+)?(\S*\/)?(sh|bash|zsh|dash|ksh)\b/, label: "curl|wget piped to shell" },
  { pattern: />>?\s*\/dev\/(sd[a-z]|nvme\d+n\d+|vd[a-z]|mmcblk\d+|hd[a-z]|xvd[a-z])/, label: "write to raw disk" },
  { pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?mkfs(\.[a-z0-9]+)?\b/, label: "mkfs" },
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
