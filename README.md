# pi-injection-guard

Lean safety guards for pi: prompt-injection wrap, bash blocklist, path jail, memory write guard.

## What it does

### injection-guard

Wraps tool output from untrusted sources (web search, web fetch, file reads) in nonce-tagged delimiters with an explicit notice to the model that the content is data, not instructions. This reduces the risk that a prompt-injection payload embedded in fetched or read content will be treated as a legitimate instruction by the agent.

### bash-gate

Blocks common destructive shell patterns (recursive deletes, raw disk writes, force-pushes, curl-piped-to-shell, filesystem creation) before they reach the shell. This is a convenience layer that catches obvious accidents and low-effort injection attempts, not a substitute for OS-level permissions.

Currently blocked patterns:
- `rm` with recursive or force (short, long, or separated flags), optionally via `sudo`
- `rmdir`, `unlink`, `shred`, `mkfs` (only when they appear as the command, not inside a string or argument)
- `find` with `-delete` or `-exec rm`
- `dd` writing to a device (`of=/dev/*`); reading a device to a file is allowed
- `git push --force`, `-f`, `--force-with-lease`, or a `+refspec` argument
- `curl` or `wget` piped to `sh`/`bash`/`zsh`/`dash`/`ksh`, including via `sudo` or absolute paths
- Redirection or append (`>`, `>>`) to raw disk devices: `/dev/sd*`, `/dev/nvme*`, `/dev/vd*`, `/dev/mmcblk*`, `/dev/hd*`, `/dev/xvd*`

### path-jail

Prevents `write` and `edit` tool calls from targeting paths outside the current working directory. Resolves symlinks via `realpath` to prevent escape through link chains. Catches both absolute paths and relative paths that resolve outside the jail.

### memory-guard

Intercepts writes to `pi-memory` (jayzeng/pi-memory) tools — `memory_write` and `scratchpad` add — before content is persisted. Scans for prompt-injection markers (`ignore previous instructions`, role-tag forgery, external-data-tag forgery, prompt-exfiltration patterns, etc.). When a pattern matches:

- Interactive session: prompts the user to allow or deny, denying by default.
- Non-interactive (no UI): blocks by default.
- Set `PI_INJECTION_GUARD_MEMORY_STRICT=1` to always block without prompting.

**Why this exists:** `injection-guard` wraps tool_result output in nonce-delimited untrusted tags, but the wrap does not survive when the model summarizes the wrapped content into a `memory_write` call. The summary lands in `MEMORY.md` as trusted first-class context loaded into every future session. `memory-guard` catches that amplification path at the write.

Like the other guards, this is defense-in-depth — a determined author can rephrase around any regex.

## Install

```
pi install git:github.com/drg407/pi-injection-guard
```

## Configuration

- `PI_INJECTION_GUARD_TOOLS=tool1,tool2` — override the default list of tools whose output gets wrapped by injection-guard.
- `PI_INJECTION_GUARD_MEMORY_STRICT=1` — make memory-guard always block on a pattern match without prompting.
- pi settings can filter individual extensions, allowing you to enable or disable any of the four guards independently.

By default, injection-guard wraps output from tools named: `web_search`, `web_fetch`, `webSearch`, `webFetch`, `fetch`, `fetch_page`, `read`. Override with the `PI_INJECTION_GUARD_TOOLS` env var (comma-separated).

## Security disclaimer

These guards are defense-in-depth, not a security boundary. bash-gate blocks common destructive patterns but a determined agent can bypass any regex. path-jail resolves symlinks but cannot prevent every escape (e.g. hardlinks, race conditions). injection-guard reduces prompt-injection risk from untrusted tool output but is not a complete defense. Do not rely on these as your only protection — use OS-level sandboxing (containers, unprivileged users) for real isolation.

## Known limitations

`bash-gate` is a regex tier and cannot see through these constructs. They are documented, not defects:

- **Commands inside string arguments**: `bash -c 'rm -rf /'` — the dangerous command lives inside a quoted argument, not at command position.
- **`sudo` with options**: `sudo -E rm -rf /` — only `sudo <command>` (no intervening flags) is anchored.
- **Interpreter indirection via `env`**: `curl X | /usr/bin/env bash` — the shell name is not immediately after the pipe.
- **`find -execdir rm`**: only `-exec rm` is matched.

If any of these matter for your threat model, run pi under OS-level sandboxing (containers, unprivileged users, seccomp).

## License

MIT
