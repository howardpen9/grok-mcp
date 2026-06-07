<p align="center">
  <img src="./assets/social-preview.png" alt="grok-mcp — MCP server that lets Claude use Grok as a peer reviewer, adversary, and consultant" width="720" />
</p>

# grok-mcp

[![npm version](https://img.shields.io/npm/v/grok-cli-mcp.svg)](https://www.npmjs.com/package/grok-cli-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-published-success)](https://registry.modelcontextprotocol.io/)

> Use Grok (via the official xAI [Grok CLI](https://x.ai/news/grok-build-cli)) as a **peer code reviewer, adversary, and consultant** inside Claude Code, Cursor, Cline, OpenClaw, and any other MCP host.

`grok-mcp` (npm: [`grok-cli-mcp`](https://www.npmjs.com/package/grok-cli-mcp)) is a [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the `grok` CLI. It gives your primary agent (Claude, Cursor, etc.) four tools so it can delegate to Grok for second opinions without leaving the session:

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
- The Grok CLI installed:
  ```bash
  curl -fsSL https://x.ai/cli/install.sh | bash
  ```
- An auth method — either browser OAuth (`grok` once interactively) **or** an `XAI_API_KEY` from [console.x.ai](https://console.x.ai). See [Authentication](#authentication) below.

## Install

```bash
npm install -g grok-cli-mcp
# or use npx — no install needed
npx grok-cli-mcp
```

> **Why the npm name is `grok-cli-mcp` instead of `grok-mcp`?** The bare `grok-mcp` name on npm was already taken by an unrelated project (a Grok HTTP-API integration). The brand, GitHub repo, and MCP server identity stay `grok-mcp`; only the npm install identifier is `grok-cli-mcp` — chosen to highlight that this server wraps the official **Grok CLI**.

## Authentication

The wrapped Grok CLI supports two auth methods; `grok-mcp` inherits whichever is active.

| Method | Best for | Rate limits |
|--------|----------|-------------|
| **API key** (`XAI_API_KEY` env var) | MCP / CI / automation | Pay-per-call, no subscription cap |
| **Browser OAuth** (`grok` interactive login) | Local interactive use | Subject to your grok.com plan tier |

Per [xAI's auth precedence](https://docs.x.ai/docs/api-reference#authentication), `XAI_API_KEY` always wins over `~/.grok/auth.json`. So you can keep your browser login for interactive `grok` use and override it *just for this MCP server* by setting `XAI_API_KEY` in the server's env block:

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

If `diff` is omitted, runs `git diff <base_ref>...HEAD` in `cwd` (defaults to your host's working directory). Returns a markdown review with verdict, per-dimension scores (correctness / readability / architecture / security / performance), and concrete fix-it items.

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
| `XAI_API_KEY` | *(unset — falls back to OAuth)* | API key from [console.x.ai](https://console.x.ai). When set, overrides `~/.grok/auth.json` and switches the server to pay-per-call billing with no subscription rate cap. See [Authentication](#authentication). |
| `GROK_MCP_BIN` | `grok` | Path to the `grok` binary |
| `GROK_MCP_TIMEOUT` | `300000` | Default per-call timeout in milliseconds |

Model defaults live in the Grok CLI itself (`~/.grok/config.toml`).

### Timeouts

grok-4 is a reasoning model and long prompts routinely take longer than two minutes. The server's default per-call limit is **300s (5 min)**. You can change it three ways:

- **Per call** — pass `timeout` (seconds) to any tool: `{ "prompt": "...", "timeout": 600 }`.
- **Per server** — set `GROK_MCP_TIMEOUT` (milliseconds) in the MCP server's env.
- **Host side** — the MCP host has its *own* request timeout that can fire before the server's. If calls still time out after raising the above, raise the host limit too. In Claude Code that's `MCP_TIMEOUT` (server startup) and `MCP_TOOL_TIMEOUT` (per tool call), both in milliseconds.

On timeout the error includes any partial output Grok produced before the deadline, so you don't lose a near-complete answer.

## Roadmap

- **v0.1** — four stateless tools, stdio transport (current)
- **Discoverability push (v0.1.3, shipped)** — naming unification, MCP Registry submission, Smithery, glama.ai, stronger positioning. See [`docs/improvement-plan.md`](./docs/improvement-plan.md) for the full plan and [`CHANGELOG.md`](./CHANGELOG.md) for what landed.
- **v0.2** — server-side session persistence so `grok_consult` can take a `conversation_id`
- **v0.3** — streaming responses through MCP `progress` notifications

## Development

```bash
git clone https://github.com/howardpen9/grok-mcp.git
cd grok-mcp
npm install
npm test
npm run build
```

## License

MIT
