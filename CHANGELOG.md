# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-22

### Added
- **Direct xAI API backend.** The server can now call xAI's OpenAI-compatible `/chat/completions` endpoint directly via Node's built-in `fetch` — no `grok` CLI install required and no new dependencies. Cleaner errors and a smaller setup.
- **`GROK_MCP_BACKEND`** (`api` / `cli` / `auto`). `auto` (default) uses the API when `XAI_API_KEY` is set, otherwise falls back to the `grok` CLI. The active backend is logged to stderr at startup.
- **`GROK_MCP_MODEL`** (default `grok-4`) and **`GROK_MCP_BASE_URL`** (default `https://api.x.ai/v1`) to configure the API backend.
- `GrokApiError` for HTTP / transport failures (caught by `grok-review-ci`); timeouts in API mode surface as the existing `GrokTimeoutError`.

### Changed
- Startup probe is now backend-aware (`checkBackend`) — it no longer warns about a missing `grok` binary when running in API mode.
- README prerequisites, configuration, and authentication sections document the two backends.

### Why this matters
Shelling out to the `grok` CLI was the biggest install hurdle: every user had to `curl | bash` a binary before the MCP server worked. With an `XAI_API_KEY`, the server now talks to xAI directly out of the box — faster to set up, fewer moving parts, and the CLI path stays available for OAuth users who prefer it.

## [0.2.0] - 2026-06-10

### Added
- **JSON output mode for `grok_review`.** Pass `format: "json"` to get a structured verdict (`approve` / `approve_with_comments` / `request_changes` / `block`) with per-dimension scores (0–10) and a typed `blockers[]` list (severity, file, line, reason, fix). Default stays `markdown` for back-compat.
- **`grok-review-ci` bin.** New CLI that runs the review in JSON mode against a git diff, writes a markdown summary to `$GITHUB_STEP_SUMMARY`, and exits non-zero on gated verdicts. Supports `--gate-on`, `--min-score`, `--focus`, `--diff-file`, `--summary-out`, `--json-out`. Available as `npx -y -p grok-cli-mcp grok-review-ci`.
- **Composite GitHub Action `howardpen9/grok-mcp/.github/actions/grok-review@main`.** Installs grok CLI, runs the review, posts a sticky PR comment, fails the check on `block`. See [`examples/workflows/grok-review.yml`](./examples/workflows/grok-review.yml).
- Dogfood workflow `.github/workflows/grok-review.yml` running the local build on this repo's own PRs.

### Changed
- `grok_review` tool description now mentions the JSON / CI gating use case.
- `package.json` keywords add `pr-gate`, `ci`, `github-action`.

### Why this matters
Before v0.2 the review was a markdown blob — useful as a second opinion, but a *suggestion*. v0.2 turns it into a *gate*: structured verdict + concrete blockers + exit code → an opinion that can actually block a merge. This is the inversion the project needed to graduate from "optional consultant" to "CI infrastructure."

## [0.1.3] - 2026-06-06

### Changed
- Renamed npm package from `grok-build-mcp` to `grok-cli-mcp` (the `grok-mcp` name was already taken on npm by an unrelated project — a Grok HTTP API integration, not a CLI wrapper).
- Binary command renamed: `grok-build-mcp` → `grok-cli-mcp`.
- Strengthened README value proposition (peer reviewer / adversary / second-opinion).
- Server version now read dynamically from `package.json` instead of hardcoded.

### Added
- `mcpName: io.github.howardpen9/grok-mcp` field for MCP Registry ownership verification (registry identity stays `grok-mcp` even though the npm install identifier is `grok-cli-mcp`).
- `smithery.yaml` for Smithery one-click install.
- `.github/workflows/ci.yml` — GitHub Actions CI (build + test on push/PR to main).
- README badges (npm + MCP Registry) and "Why grok-mcp?" positioning section.
- `docs/improvement-plan.md` capturing the discoverability roadmap.

### Deprecated
- `grok-build-mcp` npm package — use `grok-cli-mcp` instead.

### Naming notes
- Brand / GitHub repo / MCP server identity: **`grok-mcp`** (unchanged).
- npm install identifier: **`grok-cli-mcp`** (new).
- MCP Registry name: **`io.github.howardpen9/grok-mcp`**.

## [0.1.2] - 2026-06-02

### Fixed
- Raised default per-call timeout to 300s (5 min) and added per-call `timeout` parameter to avoid grok-4 reasoning cutoffs.

### Added
- Documented `XAI_API_KEY` auth flow and `claude mcp add-json` wiring.
- `CONTRIBUTING.md` and GitHub issue / PR templates.

## [0.1.1] - 2026-06-02

### Changed
- Softened `grok_review` prompt to avoid spurious agentic tool triggers.
- Renamed npm package to `grok-build-mcp` (later reverted in v0.1.3).

## [0.1.0] - 2026-06-02

### Added
- Initial release with four stateless tools over stdio MCP: `grok_chat`, `grok_review`, `grok_consult`, `grok_challenge`.
- Timeout handling with partial-output recovery.
- Bilingual READMEs (English + 繁體中文).
