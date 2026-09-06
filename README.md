# pi-injection-guard

Lean safety guards for pi: prompt-injection wrap, bash blocklist, path jail.

## What it does

### injection-guard

Wraps tool output from untrusted sources (web search, web fetch, file reads) in nonce-tagged delimiters with an explicit notice to the model that the content is data, not instructions. This reduces the risk that a prompt-injection payload embedded in fetched or read content will be treated as a legitimate instruction by the agent.

### bash-gate

Blocks common destructive shell patterns (recursive deletes, raw disk writes, force-pushes, curl-piped-to-shell, filesystem creation) before they reach the shell. This is a convenience layer that catches obvious accidents and low-effort injection attempts, not a substitute for OS-level permissions.

Currently blocked patterns:
- `rm` with recursive or force (short, long, or separated flags)
- `rmdir`, `unlink`, `shred`
- `find` with `-delete` or `-exec rm`
- `dd` with `of=`
- `git push --force` / `-f` / `--force-with-lease`
- `curl` or `wget` piped to a shell
- Redirection to `/dev/sd*`
- `mkfs`

### path-jail

Prevents `write` and `edit` tool calls from targeting paths outside the current working directory. Resolves symlinks via `realpath` to prevent escape through link chains. Catches both absolute paths and relative paths that resolve outside the jail.

## Install

```
pi install git:github.com/drg407/pi-injection-guard
```

## Configuration

- `PI_INJECTION_GUARD_TOOLS=tool1,tool2` — override the default list of tools whose output gets wrapped by injection-guard.
- pi settings can filter individual extensions, allowing you to enable or disable any of the three guards independently.

## Security disclaimer

These guards are defense-in-depth, not a security boundary. bash-gate blocks common destructive patterns but a determined agent can bypass any regex. path-jail resolves symlinks but cannot prevent every escape (e.g. hardlinks, race conditions). injection-guard reduces prompt-injection risk from untrusted tool output but is not a complete defense. Do not rely on these as your only protection — use OS-level sandboxing (containers, unprivileged users) for real isolation.

## License

MIT
