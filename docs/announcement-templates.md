# Announcement Templates

Drafts for the v0.1.3 discoverability launch. Adjust per platform; the core message is the same.

---

## Threads / X (短版，280 字內)

```
🚀 grok-mcp is now on the official MCP Registry + Smithery.

Use Grok as a peer reviewer, adversary, and second-opinion consultant inside Claude Code, Cursor, Cline — without leaving your session.

Install: npx -y grok-cli-mcp
Tools: grok_review, grok_challenge, grok_consult, grok_chat

→ github.com/howardpen9/grok-mcp
```

繁中版：

```
🚀 grok-mcp 上架官方 MCP Registry + Smithery。

在 Claude Code / Cursor / Cline 裡把 Grok 當 reviewer、adversary、第二意見顧問 — 不用切 session。

安裝：npx -y grok-cli-mcp
工具：grok_review / grok_challenge / grok_consult / grok_chat

→ github.com/howardpen9/grok-mcp
```

---

## LinkedIn / dev.to / Medium（中長版）

```
Shipping update: grok-mcp v0.1.3

I built grok-mcp to solve a workflow problem in my agent stack: when Claude (or Cursor, or Cline) writes code, I want a different model to attack it. Same-model self-review misses bugs that another model's training catches instantly.

grok-mcp wraps the official xAI Grok CLI as a Model Context Protocol server, exposing four tools to any MCP host:

• grok_review — structured diff review with per-dimension scores
• grok_challenge — adversarial bug / race / security hunting
• grok_consult — multi-turn consultation
• grok_chat — one-shot questions

The novel angle: most "Grok MCP" packages let Claude USE Grok. grok-mcp does the opposite — it lets your main coding agent ASK Grok to review and attack its own work.

v0.1.3 is now published to the official MCP Registry as `io.github.howardpen9/grok-mcp`, listed on Smithery, and installable as `npx -y grok-cli-mcp`.

Repo + setup: https://github.com/howardpen9/grok-mcp

(Previously published as `grok-build-mcp` — that's deprecated; please update your MCP host config to `grok-cli-mcp`.)
```

---

## Reddit r/mcp / r/ClaudeAI

```
Title: grok-mcp on the official MCP Registry — use Grok as a peer reviewer inside Claude / Cursor / Cline

Body:

I just published grok-mcp v0.1.3 to the official MCP Registry. It wraps the xAI Grok CLI so your primary agent can delegate to Grok for second opinions.

Four tools:
- grok_review (diff review with per-dimension scores)
- grok_challenge (adversarial bug hunting)
- grok_consult (multi-turn)
- grok_chat (one-shot)

Why this matters: same-model self-review has blind spots. Letting Claude ask Grok to attack its own code catches bugs single-model loops miss.

Install: `npx -y grok-cli-mcp` (the brand is grok-mcp but the npm name had to be grok-cli-mcp because grok-mcp was already taken by an unrelated package)

Repo: https://github.com/howardpen9/grok-mcp

Feedback welcome — especially on the grok_challenge prompt tuning.
```

---

## GitHub Discussions / Smithery listing description

```
grok-mcp turns the official xAI Grok CLI into a Model Context Protocol server so Claude Code, Cursor, Cline, and other MCP hosts can use Grok as a peer code reviewer, adversary, and consultant.

Unique angle: instead of letting Claude use Grok's chat/search capabilities, grok-mcp lets your main coding agent ask Grok to REVIEW AND ATTACK its own work. A different model challenging your primary catches bugs that single-model loops miss.

Tools:
• grok_review — unified-diff review with per-dimension scores (correctness, readability, architecture, security, performance)
• grok_challenge — adversarial bug / race / edge case / security hunting with severity ranking
• grok_consult — multi-turn consultation (caller owns history)
• grok_chat — one-shot questions

Auth: works with the Grok CLI's browser OAuth (interactive) or an XAI_API_KEY (recommended for MCP / CI).

Install: `npx -y grok-cli-mcp`
```

---

## Migration note for existing grok-build-mcp users

When announcing, include this somewhere:

```
If you're already on grok-build-mcp:

  "args": ["-y", "grok-build-mcp"]   →   "args": ["-y", "grok-cli-mcp"]

The old package is deprecated and will print a warning on install but still works.
```
