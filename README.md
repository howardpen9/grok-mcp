<p align="center">
  <img src="./assets/social-preview.png" alt="grok-mcp — MCP server that lets Claude use Grok as a peer reviewer, adversary, and consultant" width="720" />
</p>

# grok-mcp

[![npm version](https://img.shields.io/npm/v/grok-cli-mcp.svg)](https://www.npmjs.com/package/grok-cli-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-published-success)](https://registry.modelcontextprotocol.io/)

> Use Grok as a **peer code reviewer, adversary, and consultant** inside Claude Code, Cursor, Cline, OpenClaw, and any other MCP host — talking to xAI's API directly (just an `XAI_API_KEY`, no install) or via the official [Grok CLI](https://x.ai/news/grok-build-cli).

`grok-mcp` (npm: [`grok-cli-mcp`](https://www.npmjs.com/package/grok-cli-mcp)) is a [Model Context Protocol](https://modelcontextprotocol.io) server for Grok. It gives your primary agent (Claude, Cursor, etc.) four tools so it can delegate to Grok for second opinions without leaving the session. As of **v0.3.0** it talks to xAI's API directly — no `grok` binary required — and still supports the CLI for OAuth users:

- `grok_review` — structured diff review with per-dimension scores
- `grok_challenge` — adversarial bug/race/security hunting
- `grok_consult` — multi-turn consultation (caller owns history)
- `grok_chat` — one-shot questions

English | [繁體中文](./README.zh-TW.md)

## Why grok-mcp?

Most "Grok MCP" packages expose Grok's chat/search/image capabilities so Claude can *use* Grok. `grok-mcp` does the opposite: it lets your main coding agent (Claude/Cursor/…) **ask Grok to review and attack its own work**. A different model challenging your primary catches bugs single-model loops miss.

## What you get

Four tools, all stateless, all stdout-only:

| Tool | Use it for |
|------|------------|
| `grok_chat` | One-shot prompt → Grok's reply |
| `grok_review` | Pass a unified diff (or auto-grab `git diff main...HEAD`) and get a per-dimension code review |
| `grok_consult` | Replay a message history for multi-turn — caller owns the thread |
| `grok_challenge` | Adversarial: ask Grok to find every bug, race, edge case, and security hole |

## Prerequisites

- Node.js ≥ 18
- A backend (the server picks one automatically — see [Backends](#backends)):
  - **API mode (recommended, zero install):** an `XAI_API_KEY` from [console.x.ai](https://console.x.ai). The server calls xAI's HTTP API directly — no extra binary needed.
  - **CLI mode:** the Grok CLI installed, used when no `XAI_API_KEY` is set:
    ```bash
    curl -fsSL https://x.ai/cli/install.sh | bash
    ```
    Then authenticate with browser OAuth (run `grok` once interactively). See [Authentication](#authentication) below.

## Install

```bash
npm install -g grok-cli-mcp
# or use npx — no install needed
npx grok-cli-mcp
```

> **Why the npm name is `grok-cli-mcp` instead of `grok-mcp`?** The bare `grok-mcp` name on npm was already taken by an unrelated project (a Grok HTTP-API integration). The brand, GitHub repo, and MCP server identity stay `grok-mcp`; only the npm install identifier is `grok-cli-mcp` — chosen to highlight that this server wraps the official **Grok CLI**.

## Authentication

There are two auth methods, each tied to a [backend](#backends):

| Method | Backend | Best for | Rate limits |
|--------|---------|----------|-------------|
| **API key** (`XAI_API_KEY` env var) | API mode — no `grok` binary needed | MCP / CI / automation | Pay-per-call, no subscription cap |
| **Browser OAuth** (`grok` interactive login) | CLI mode | Local interactive use | Subject to your grok.com plan tier |

Setting `XAI_API_KEY` switches the server to [API mode](#backends), so you can keep your browser login for interactive `grok` use and use a key *just for this MCP server* via its env block:

```json
{
  "mcpServers": {
    "grok": {
      "command": "npx",
      "args": ["-y", "grok-cli-mcp"],
      "env": {
        "XAI_API_KEY": "xai-...",
        "GROK_MCP_TIMEOUT": "600000"
      }
    }
  }
}
```

Treat the key file as a secret — it ends up in your MCP host's config (e.g. `~/.claude.json`), which is plain JSON on disk.

## Wire it into your MCP host

### Claude Code

Recommended — use `add-json` so the env block parses cleanly:

```bash
claude mcp add-json -s user grok '{
  "command": "npx",
  "args": ["-y", "grok-cli-mcp"],
  "env": { "XAI_API_KEY": "xai-...", "GROK_MCP_TIMEOUT": "600000" }
}'
```

> **Why `add-json` not `claude mcp add -e ...`?** The `-e KEY=val` flag is variadic and will greedily consume the server name as another env value if you pass more than one. `add-json` sidesteps that footgun entirely.

Or edit `~/.claude.json` directly. Minimal (OAuth fallback):

```json
{
  "mcpServers": {
    "grok": {
      "command": "npx",
      "args": ["-y", "grok-cli-mcp"]
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "grok": {
      "command": "npx",
      "args": ["-y", "grok-cli-mcp"]
    }
  }
}
```

### Cline (VS Code)

Settings → Cline → MCP Servers:

```json
{
  "grok": {
    "command": "npx",
    "args": ["-y", "grok-cli-mcp"]
  }
}
```

### Any other MCP host

`grok-mcp` speaks plain stdio MCP. Point any client at `npx -y grok-cli-mcp` and it works.

## Tool reference

### `grok_chat`

```json
{ "prompt": "Explain consistent hashing in two sentences." }
```

Optional: `model` to override the default Grok model; `timeout` (seconds) to extend the per-call limit for long grok-4 reasoning. All four tools accept `timeout`.

### `grok_review`

```json
{ "base_ref": "main", "focus": "security" }
```

If `diff` is omitted, runs `git diff <base_ref>...HEAD` in `cwd` (defaults to your host's working directory). Returns a markdown review by default with verdict, per-dimension scores (correctness / readability / architecture / security / performance), and concrete fix-it items.

Pass `"format": "json"` to get machine-parseable output suitable for CI gating — see [Use as a PR gate](#use-as-a-pr-gate-ci).

### `grok_consult`

```json
{
  "messages": [
    { "role": "system", "content": "You are a senior backend engineer." },
    { "role": "user", "content": "How would you cache this query?" },
    { "role": "assistant", "content": "Two options..." },
    { "role": "user", "content": "What's the failure mode of option 2?" }
  ]
}
```

The server is stateless — the caller passes the full thread each time. Most MCP hosts handle this naturally.

### `grok_challenge`

```json
{
  "code": "function transfer(from, to, amount) { from.balance -= amount; to.balance += amount; }",
  "context": "Node.js, called concurrently from HTTP handlers"
}
```

Returns severity-ranked issues (Critical / High / Medium / Low) with concrete reproductions and patches.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `XAI_API_KEY` | *(unset — falls back to OAuth)* | API key from [console.x.ai](https://console.x.ai). When set, the server uses [API mode](#backends) (direct HTTP) and bills pay-per-call with no subscription rate cap. See [Authentication](#authentication). |
| `GROK_MCP_BACKEND` | `auto` | Which backend to use: `api` (direct HTTP), `cli` (shell out to `grok`), or `auto` (API when `XAI_API_KEY` is set, else CLI). See [Backends](#backends). |
| `GROK_MCP_MODEL` | `grok-4` | Model used in API mode. (CLI mode reads `~/.grok/config.toml`.) |
| `GROK_MCP_BASE_URL` | `https://api.x.ai/v1` | API base URL — point at a proxy or compatible gateway in API mode. |
| `GROK_MCP_BIN` | `grok` | Path to the `grok` binary (CLI mode only) |
| `GROK_MCP_TIMEOUT` | `300000` | Default per-call timeout in milliseconds |

### Backends

The server can reach Grok two ways and chooses one at startup (it logs which to stderr):

- **API mode** — calls xAI's OpenAI-compatible `/chat/completions` endpoint directly using Node's built-in `fetch`. No `grok` binary required, cleaner errors, pay-per-call. Selected when `XAI_API_KEY` is set, or forced with `GROK_MCP_BACKEND=api`.
- **CLI mode** — shells out to the installed `grok` binary (supports browser OAuth). Selected when no `XAI_API_KEY` is set, or forced with `GROK_MCP_BACKEND=cli`.

Force a mode with `GROK_MCP_BACKEND`. In API mode, set the model with `GROK_MCP_MODEL`; in CLI mode, model defaults live in `~/.grok/config.toml`.

### Timeouts

grok-4 is a reasoning model and long prompts routinely take longer than two minutes. The server's default per-call limit is **300s (5 min)**. You can change it three ways:

- **Per call** — pass `timeout` (seconds) to any tool: `{ "prompt": "...", "timeout": 600 }`.
- **Per server** — set `GROK_MCP_TIMEOUT` (milliseconds) in the MCP server's env.
- **Host side** — the MCP host has its *own* request timeout that can fire before the server's. If calls still time out after raising the above, raise the host limit too. In Claude Code that's `MCP_TIMEOUT` (server startup) and `MCP_TOOL_TIMEOUT` (per tool call), both in milliseconds.

On timeout the error includes any partial output Grok produced before the deadline, so you don't lose a near-complete answer.

## Use as a PR gate (CI)

`grok-mcp` ships a `grok-review-ci` bin **and** a composite GitHub Action so Grok can review every PR and fail the check on `block`.

Drop this into `.github/workflows/grok-review.yml` in your repo:

```yaml
name: Grok review
on: { pull_request: { branches: [main] } }
permissions: { contents: read, pull-requests: write }
jobs:
  grok:
    runs-on: ubuntu-latest
    if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: howardpen9/grok-mcp/.github/actions/grok-review@main
        with:
          xai-api-key: ${{ secrets.XAI_API_KEY }}
          gate-on: block      # also accepts: block,request_changes
          # focus: security   # optional
          # min-score: 6      # optional — fail any dimension below this
```

The action posts a sticky PR comment with verdict + per-dimension scores + concrete blockers, and exits non-zero (failing the check) when the verdict matches `gate-on`. Full example with comments: [`examples/workflows/grok-review.yml`](./examples/workflows/grok-review.yml).

Want JSON straight from the tool instead? Pass `format: "json"` to `grok_review` — same schema as the bin emits, suitable for any pipeline:

```json
{
  "verdict": "block",
  "summary": "Unparameterised SQL query in src/db.ts.",
  "scores": { "correctness": 4, "readability": 7, "architecture": 5, "security": 2, "performance": 8 },
  "blockers": [
    { "severity": "critical", "title": "SQL injection", "file": "src/db.ts", "line": 42,
      "reason": "User input concatenated directly into the query.",
      "fix": "Use the parameterised form `db.query(sql, [userId])`." }
  ],
  "notes": []
}
```

## Roadmap

- **v0.1** — four stateless tools, stdio transport
- **Discoverability push (v0.1.3, shipped)** — naming unification, MCP Registry, Smithery, glama.ai, stronger positioning. See [`docs/improvement-plan.md`](./docs/improvement-plan.md) and [`CHANGELOG.md`](./CHANGELOG.md).
- **v0.2 (shipped)** — `grok_review` JSON mode + `grok-review-ci` bin + GitHub Action for PR gating.
- **v0.3 (current)** — direct xAI API backend (no `grok` CLI required); `GROK_MCP_BACKEND` api/cli/auto.
- **v0.4** — server-side session persistence so `grok_consult` can take a `conversation_id`
- **v0.5** — streaming responses through MCP `progress` notifications

## Development

```bash
git clone https://github.com/howardpen9/grok-mcp.git
cd grok-mcp
npm install
npm test
npm run build
```

## Contact

Bug reports & feature requests → [GitHub issues](https://github.com/howardpen9/grok-mcp/issues).
DMs welcome on X: [@0xHoward_Peng](https://x.com/0xHoward_Peng).

## License

MIT
