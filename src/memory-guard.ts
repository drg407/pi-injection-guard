// Write-side interception for pi-memory (jayzeng/pi-memory) tools.
// Scans memory_write.content and scratchpad add-text for prompt-injection markers
// before pi-memory persists them. Memory content becomes trusted context on the
// next session; a payload that lands here bypasses the tool_result wrap entirely.
//
// Defense-in-depth, not a boundary. Patterns are best-effort — a determined
// author can rephrase around any regex. See README for the amplification path
// this guard addresses.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|above|prior|earlier|the|that|this|any)\s+(system\s+)?(instructions?|prompts?|rules?|context|messages?|guidance)/i, label: "ignore-previous" },
  { pattern: /(disregard|do\s+not\s+follow|don't\s+follow|stop\s+following|cease\s+following)\s+(your|the|all|any)?\s*(system\s+)?(instructions?|prompts?|rules?|guidance)/i, label: "disregard-instructions" },
  { pattern: /forget\s+(everything|all|previous|(?:your|the)\s+(instructions?|prompt|rules?|guidelines?|constraints?))/i, label: "forget-everything" },
  { pattern: /you\s+are\s+now\s+(?:a|an|the)\s+[a-z]/i, label: "role-reassignment" },
  { pattern: /(new|updated|revised|modified|latest)\s+(system\s+)?(instructions?|prompt|rules?)\s*[:\-]/i, label: "new-instructions" },
  { pattern: /<\|?\s*(im_start|start_of_turn)\s*\|?>\s*system/i, label: "role-marker-forgery" },
  { pattern: /<\|?\s*system\s*\|?>/i, label: "system-tag" },
  { pattern: /\[\s*system\s*\]/i, label: "system-bracket" },
  { pattern: /\[\s*INST\s*\]/i, label: "llama-inst-marker" },
  { pattern: /<\/?EXTERNAL_DATA_[a-f0-9]+>/i, label: "external-data-tag-forgery" },
  { pattern: /(print|reveal|show|output|repeat)\s+(your|the|full)\s+(system\s+)?(prompt|instructions?)/i, label: "prompt-exfiltration" },
  { pattern: /you\s+are\s+(no\s+longer|not)\s+(bound|restricted|limited|constrained|required|obligated)/i, label: "role-liberation" },
  { pattern: /you\s+are\s+(?:now\s+)?(?:a|an|the)?\s*(DAN|unrestricted|uncensored|jailbroken|unfiltered)/i, label: "named-jailbreak" },
];

const STRICT = process.env.PI_INJECTION_GUARD_MEMORY_STRICT === "1";

function truncate(s: string, max = 60): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

async function decide(
  ctx: { hasUI: boolean; ui: { select: (msg: string, options: string[]) => Promise<string>; notify: (msg: string, level: "info" | "warning" | "error") => void } },
  toolName: string,
  label: string,
  match: string,
): Promise<{ block: true; reason: string } | undefined> {
  const preview = truncate(match);
  const reason = `pi-injection-guard memory-guard blocked ${toolName}: pattern "${label}" matched (${preview})`;

  if (STRICT || !ctx.hasUI) {
    if (ctx.hasUI) ctx.ui.notify(reason, "warning");
    return { block: true, reason };
  }

  const choice = await ctx.ui.select(
    `pi-injection-guard: suspicious pattern in ${toolName}\n\nPattern: ${label}\nMatch: ${preview}\n\nMemory content becomes trusted context in future sessions. Allow anyway?`,
    ["Deny (recommended)", "Allow"],
  );

  if (choice === "Allow") return undefined;
  ctx.ui.notify(reason, "warning");
  return { block: true, reason };
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    let text: string | undefined;

    if (event.toolName === "memory_write") {
      const raw = (event.input as { content?: unknown }).content;
      if (typeof raw === "string") text = raw;
    } else if (event.toolName === "scratchpad") {
      const action = (event.input as { action?: unknown }).action;
      const raw = (event.input as { text?: unknown }).text;
      if (action === "add" && typeof raw === "string") text = raw;
    } else {
      return undefined;
    }

    if (!text) return undefined;

    for (const rule of PATTERNS) {
      const m = rule.pattern.exec(text);
      if (m) return decide(ctx, event.toolName, rule.label, m[0]);
    }

    return undefined;
  });
}
