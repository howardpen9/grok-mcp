# Grok-MCP Improvement & Discoverability Plan

> Goal: Make `grok-mcp` (currently published as `grok-build-mcp`) significantly easier to discover by humans, AI agents, MCP hosts (Claude Code, Cursor, Cline, etc.), and especially the official MCP Registry and directories. Align naming, strengthen unique positioning, and get the package listed in the places that matter in 2026.

This document is written so another agent (or human) can execute the changes with minimal ambiguity. After changes, the original author (or a reviewer agent) should run the **Verification Checklist** at the bottom.

**Current state (as of analysis):**
- GitHub: `howardpen9/grok-mcp`
- npm: `grok-build-mcp` (binary also `grok-build-mcp`)
- Internal MCP server name: `"grok-mcp"` (good)
- Strong unique value: Grok as **peer reviewer / adversary / consultant** for other agents via the official Grok CLI.
- Good bilingual docs + solid code (timeout handling, stderr logging, clean zod tools).
- Weaknesses: Naming fragmentation, almost zero presence on official registry / smithery / glama / mcp.so, soft positioning in READMEs, no CI, no `smithery.yaml`.

---

## 1. Critical Priority: Unify Naming (Do This First)

**Recommended canonical names going forward:**
- GitHub repo (keep): `howardpen9/grok-mcp`
- npm package: `grok-mcp`
- Binary / command name: `grok-mcp`
- In all docs and examples: use `grok-mcp` for the package
- MCP host server key (user-facing, e.g. in `mcpServers`): keep recommending `"grok"` (short and nice)
- Internal protocol name (already correct): `"grok-mcp"`

**Why:** "grok-mcp" is the natural search term. "grok-build-mcp" is confusing (tied to old "Grok Build CLI" branding) and hurts discovery.

### 1.1 Update package.json

Replace the entire `package.json` with the version below (or apply the diffs precisely).

```json
{
  "name": "grok-mcp",
  "version": "0.1.3",
  "description": "MCP server that wraps the xAI Grok CLI. Exposes grok_chat, grok_review, grok_consult, and grok_challenge so Claude Code, Cursor, Cline, and other MCP hosts can use Grok as a peer reviewer, adversary, and second-opinion consultant.",
  "type": "module",
  "bin": {
    "grok-mcp": "dist/index.js"
  },
  "main": "dist/index.js",
  "files": [
    "dist",
    "README.md",
    "README.zh-TW.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "grok",
    "xai",
    "ai",
    "claude-code",
    "cursor",
    "cline",
    "code-review",
    "adversarial-testing",
    "second-opinion"
  ],
  "author": "Howard Peng <howard.peng.tw@gmail.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/howardpen9/grok-mcp.git"
  },
  "bugs": {
    "url": "https://github.com/howardpen9/grok-mcp/issues"
  },
  "homepage": "https://github.com/howardpen9/grok-mcp#readme",
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "strip-ansi": "^7.1.0",
    "zod": "^3.23.8",
    "zod-to-json-schema": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

**Key changes:**
- `"name"`: `"grok-mcp"`
- `"version"`: bump to `0.1.3` (or keep 0.1.2 and bump after publish)
- `"bin"`: change key to `"grok-mcp"`
- Improve `description` (search-friendly + value prop)
- Add keywords: `code-review`, `adversarial-testing`, `second-opinion`
- (Optional but recommended) Add later: `"mcpName": "io.github.howardpen9/grok-mcp"` — see Registry section.

After editing, run `npm install` (to update lockfile if needed) and `npm test`.

### 1.2 Update README.md (English)

**Global replacements (careful with order):**
- `grok-build-mcp` → `grok-mcp` (in all install commands, `npx`, `claude mcp add`, JSON examples, etc.)
- Title `# grok-build-mcp` → `# grok-mcp`
- First sentence in the intro block should become much stronger.

**Recommended new top of README.md (replace from the title through the intro paragraph):**

```markdown
# grok-mcp

> Use Grok (via the official xAI Grok CLI) as a **peer code reviewer, adversary, and consultant** inside Claude Code, Cursor, Cline, OpenClaw, and any other MCP host.

`grok-mcp` is a Model Context Protocol server that wraps the `grok` CLI. It gives your primary agent (Claude, Cursor, etc.) four powerful tools so it can delegate to Grok for second opinions without leaving the session:

- `grok_review` — structured diff review with per-dimension scores
- `grok_challenge` — adversarial bug/race/security hunting
- `grok_consult` — multi-turn consultation (caller owns history)
- `grok_chat` — one-shot questions

English | [繁體中文版](./README.zh-TW.md)
```

Then continue with the rest of the file, applying the `grok-build-mcp` → `grok-mcp` replacements everywhere (install blocks, JSON configs, "grok-build-mcp" mentions in prose).

Update the **Roadmap** section to reference this plan:

```markdown
## Roadmap

- v0.1: Core four tools + stdio (current)
- **Discoverability push (this cycle)**: Naming unification, official MCP Registry, Smithery, glama.ai, improved positioning
- v0.2: Server-side session persistence for `grok_consult`
- v0.3: Streaming via MCP progress notifications
```

Add a short "Why grok-mcp?" section after the tools table (suggested content can be derived from the value prop above).

Update the **Install** and all **Wire it into your MCP host** sections with the new command `npx -y grok-mcp`.

### 1.3 Update README.zh-TW.md (Chinese) — same spirit

Apply identical replacements:
- Title `# grok-build-mcp` → `# grok-mcp`
- All `grok-build-mcp` in commands and JSON → `grok-mcp`
- Strengthen the opening paragraph similarly.

Example new top:

```markdown
# grok-mcp

> 讓 Claude Code、Cursor、Cline 等 MCP host 透過官方 xAI Grok CLI，把 **Grok 當成 code reviewer、adversary 與第二意見顧問** 使用。

`grok-mcp` 是 Model Context Protocol server，將 `grok` CLI 包裝成工具，讓你的主要 agent 可以隨時叫 Grok 幫忙 review、挑戰、諮詢，而不用切換 session。

English: [README.md](./README.md)
```

Update the rest consistently (認證、安裝、串接範例、Roadmap 等)。

### 1.4 Update references in source (minimal)

In `src/index.ts` the server name is already `"grok-mcp"` — **leave it**.

No other hard-coded "grok-build-mcp" should exist in src/ or tests/ (verify with grep).

### 1.5 After rename — local verification

```bash
npm run build
npm test
npm pack --dry-run   # check the tarball name will be grok-mcp-*.tgz
```

---

## 2. Publish to the Official MCP Registry (Highest Leverage for "Grok finding it")

The official registry (https://registry.modelcontextprotocol.io/) is the primary machine-readable catalog that MCP clients and agents query.

Follow the official quickstart (https://modelcontextprotocol.io/registry/quickstart) with these project-specific values.

### 2.1 Prerequisites
- npm account (you must be able to `npm publish` the package)
- GitHub account (for `mcp-publisher login github`)

### 2.2 Add `mcpName` to package.json (for ownership verification)

Add this field (use your GitHub username):

```json
"mcpName": "io.github.howardpen9/grok-mcp"
```

It must match the `name` you will use in `server.json`.

**Note:** You may keep the unscoped npm name `grok-mcp` while using the `io.github.howardpen9/...` registry name. This is supported.

### 2.3 Publish the npm package first

```bash
npm run build
npm publish --access public
```

Verify at https://www.npmjs.com/package/grok-mcp

### 2.4 Install mcp-publisher and generate server.json

```bash
# macOS/Linux one-liner (or use brew install mcp-publisher)
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/

mcp-publisher init
```

### 2.5 Edit the generated `server.json`

Make it look like this (adjust version to match what you just published):

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.howardpen9/grok-mcp",
  "description": "MCP server wrapping the xAI Grok CLI. Provides grok_review, grok_challenge, grok_consult, and grok_chat so other agents can use Grok for code review, adversarial testing, and consultation.",
  "repository": {
    "url": "https://github.com/howardpen9/grok-mcp",
    "source": "github"
  },
  "version": "0.1.3",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "grok-mcp",
      "version": "0.1.3",
      "transport": {
        "type": "stdio"
      }
    }
  ]
}
```

**Important:** Remove any environmentVariables section unless you want to declare `XAI_API_KEY` explicitly (optional — the current server falls back gracefully).

The `name` here **must** exactly match the `mcpName` in package.json.

### 2.6 Authenticate and publish

```bash
mcp-publisher login github
mcp-publisher publish
```

Verify with:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.howardpen9/grok-mcp"
```

After success, add a badge or link in the READMEs:

```markdown
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-published-blue)](https://registry.modelcontextprotocol.io/)
```

Also update the GitHub repo description and topics if needed.

### 2.7 Automate later (nice-to-have)

See the registry docs for GitHub Actions publishing examples.

---

## 3. Smithery, Glama, and Other Directories

### 3.1 Add smithery.yaml (for Smithery.ai one-click installs)

Create `smithery.yaml` in the project root:

```yaml
# Smithery configuration for grok-mcp
# https://smithery.ai

name: grok-mcp
displayName: Grok MCP (CLI)
description: |
  Wraps the official xAI Grok CLI to give Claude Code, Cursor, Cline and other
  MCP hosts powerful review, adversarial challenge, consultation, and chat tools
  powered by Grok. Unique strength: use Grok as a second-opinion peer reviewer
  while your main agent is Claude or another model.
icon: https://raw.githubusercontent.com/howardpen9/grok-mcp/main/assets/icon.png  # optional — add a simple icon later
repository: https://github.com/howardpen9/grok-mcp

startCommand:
  type: stdio
  configSchema:
    # We support XAI_API_KEY (preferred for automation) or fall back to the
    # user's existing grok CLI OAuth login.
    type: object
    properties:
      XAI_API_KEY:
        type: string
        description: "xAI API key (optional). When set, overrides grok CLI OAuth and uses pay-per-call billing."
        format: password
      GROK_MCP_TIMEOUT:
        type: number
        description: "Default timeout in ms (default 300000 = 5min). Raise for grok-4 reasoning."
        default: 300000
  commandFunction: |-
    (config) => ({
      command: "npx",
      args: ["-y", "grok-mcp"],
      env: {
        ...(config.XAI_API_KEY ? { XAI_API_KEY: config.XAI_API_KEY } : {}),
        ...(config.GROK_MCP_TIMEOUT ? { GROK_MCP_TIMEOUT: String(config.GROK_MCP_TIMEOUT) } : {})
      }
    })
```

After adding the file:
- Go to https://smithery.ai, sign in with GitHub, connect the repo, and deploy/test.
- Claim the entry and improve the listing.

### 3.2 Claim / submit to other directories

- **glama.ai**: Search for existing entries for "grok-build-mcp" or "howardpen9", claim them, and update to the new name + rich description.
- **mcp.so**, **mcpservers.org**, **mcpserver.cloud**, etc.: Submit or claim using the GitHub link + npm package.
- Update any personal/project sites or Threads/Twitter posts with the clean `npx -y grok-mcp` command.

---

## 4. Positioning, SEO & README Polish (High Impact)

### 4.1 Stronger value proposition (use in both READMEs + package description + registry)

Key message to hammer:
> "The only Grok MCP server focused on **code review + adversarial testing + second opinion** for agents that are *not* Grok (Claude, Cursor, etc.)."

### 4.2 Add badges to top of READMEs (after the new title)

```markdown
[![npm version](https://img.shields.io/npm/v/grok-mcp.svg)](https://www.npmjs.com/package/grok-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-published-success)](https://registry.modelcontextprotocol.io/)
```

(Once published.)

### 4.3 Add a short "Compared to other Grok MCP servers" note (optional but powerful)

In the README, after the tool table, add a small section:

> Most other "Grok MCP" packages expose Grok's chat/search/image capabilities so Claude can *use* Grok.  
> `grok-mcp` does the opposite: it lets your main coding agent (Claude/Cursor/...) **ask Grok to review and attack its own work**.

### 4.4 Minor content cleanups

- Make sure the Authentication section explains `XAI_API_KEY` clearly (already good).
- Keep the excellent timeout + partial-output documentation.
- In the Chinese README, keep the friendly tone but align the commands exactly.

---

## 5. Project Hygiene & Distribution

### 5.1 Add basic CI (GitHub Actions)

Create directory `.github/workflows/` and add `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

This ensures every change is buildable and tested.

### 5.2 GitHub repo settings (manual, after code changes)

- Update the **About** / description to the strong one-liner from the new README.
- Topics (already decent): keep/add `mcp-server`, `code-review`, `agent-tools`.
- Create a release for v0.1.3 (or the version you publish) with clear notes mentioning the rename + registry.

### 5.3 Optional: Add a simple icon / social image later

For Smithery/Glama listings, a 512x512 or 256x256 icon helps a lot.

---

## 6. Lower-Priority / Nice-to-Have Code Improvements

These can be done in a follow-up PR:

- In `src/tools/review.ts`: Before sending a huge diff to Grok, consider truncating or warning (large diffs can waste tokens / time).
- Consider exposing one more tool: `grok_version` or a metadata tool that returns the wrapped grok CLI version + this package version (useful for debugging in agents).
- Add a `Dockerfile` + example for people who want a containerized version.
- Improve `grok_consult` flattening (current `[SYSTEM]/[USER]/[ASSISTANT]` format is functional but basic).
- Add more test coverage around timeout and CLI-not-found paths.

Do **not** block the discoverability work on these.

---

## 7. Post-Change Communication (Recommended)

Once the rename + registry + Smithery are live:

- Update any previous install instructions you posted on Threads, Twitter/X, LinkedIn, dev.to, Reddit r/mcp, etc.
- Post a short announcement: "grok-mcp is now on the official MCP Registry + Smithery. Clean `npx -y grok-mcp` install, and Grok is now easier for agents to discover as a reviewer."
- Consider a small blog post or GitHub discussion.

---

## Verification Checklist (for author or review agent)

Run through this after the implementing agent finishes:

**Naming**
- [ ] `npm view grok-mcp` (or local pack) shows the new package name
- [ ] `npx grok-mcp` works (after publish or via npx -y)
- [ ] All examples in both READMEs use `grok-mcp` (no leftover `grok-build-mcp`)
- [ ] `package.json` has `"bin": { "grok-mcp": "dist/index.js" }` and updated description/keywords

**Registry & Distribution**
- [ ] `mcpName` present in package.json and matches server.json
- [ ] Package published to npm under `grok-mcp`
- [ ] Successfully published to https://registry.modelcontextprotocol.io/ and appears in search
- [ ] `smithery.yaml` committed and project connected on smithery.ai
- [ ] At least one directory (glama or Smithery) has an updated, claimed listing

**Docs & Positioning**
- [ ] Both READMEs have a strong opening value proposition
- [ ] Badges added (npm + registry)
- [ ] Roadmap section mentions the discoverability work
- [ ] "grok-mcp" is the prominent name everywhere

**Project**
- [ ] `.github/workflows/ci.yml` exists and passes on a push
- [ ] `npm test && npm run build` succeeds cleanly
- [ ] Version bumped appropriately
- [ ] GitHub repo About / description updated (manual)

**Bonus**
- [ ] No references to the old "grok-build-mcp" name remain in the repo (use `grep -r grok-build-mcp . --exclude-dir=node_modules`)
- [ ] A new release or tag created

---

## Execution Notes for the Implementing Agent

- Work in small, reviewable commits if possible (e.g., "rename package + update READMEs", then "add server.json + publish", then "add smithery + CI").
- After any rename, you **must** publish a new version to npm before the registry can reference it.
- Be careful with global search-replace on "grok-build-mcp" — it appears in prose explanations too.
- The Chinese README must stay in sync on every command example.
- Ask clarifying questions only if a step is genuinely ambiguous (most steps above are explicit).

Once this plan is executed and the checklist passes, the project should be dramatically more discoverable by both humans and agents (including Grok itself via search + registries).

---

**Document version:** 2026-06 (initial)
**Owner:** howardpen9 / grok-mcp contributors

Good luck — this is very actionable. After implementation, ping for verification against the checklist.
