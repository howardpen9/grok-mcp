# grok-build-mcp

> Bring xAI's [Grok Build CLI](https://x.ai/news/grok-build-cli) into any MCP host as a peer reviewer, adversary, and consultant — alongside whatever main model you're already running.

`grok-build-mcp` is a small [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the `grok` CLI. Your existing agent (Claude Code, Cursor, Cline, OpenClaw, …) can call into Grok for second-opinion code review, adversarial testing, or extended chat — without leaving its session.

繁體中文版：[README.zh-TW.md](./README.zh-TW.md)

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
- The Grok CLI installed and authenticated:
  ```bash
  curl -fsSL https://x.ai/cli/install.sh | bash
  grok  # first run handles auth
  ```

## Install

```bash
npm install -g grok-build-mcp
# or use npx — no install needed
npx grok-build-mcp
```

## Wire it into your MCP host

### Claude Code

```bash
claude mcp add grok npx -- grok-build-mcp
```

Or edit `~/.claude.json` directly:

```json
{
  "mcpServers": {
    "grok": {
      "command": "npx",
      "args": ["-y", "grok-build-mcp"]
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
      "args": ["-y", "grok-build-mcp"]
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
    "args": ["-y", "grok-build-mcp"]
  }
}
```

### Any other MCP host

`grok-build-mcp` speaks plain stdio MCP. Point any client at `npx -y grok-build-mcp` and it works.

## Tool reference

### `grok_chat`

```json
{ "prompt": "Explain consistent hashing in two sentences." }
```

Optional: `model` to override the default Grok model.

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
| `GROK_MCP_BIN` | `grok` | Path to the `grok` binary |
| `GROK_MCP_TIMEOUT` | `120000` | Per-call timeout in milliseconds |

Authentication and model defaults live in the Grok CLI itself (`~/.grok/config.toml`).

## Roadmap

- v0.1 (this release): four stateless tools, stdio transport
- v0.2: server-side session persistence so `grok_consult` can take a `conversation_id`
- v0.3: streaming responses through MCP `progress` notifications

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
