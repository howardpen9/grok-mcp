# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-06-06

### Changed
- Renamed npm package from `grok-build-mcp` to `grok-mcp` for clearer discoverability.
- Binary command renamed: `grok-build-mcp` → `grok-mcp`.
- Strengthened README value proposition (peer reviewer / adversary / second-opinion).
- Server version now read dynamically from `package.json` instead of hardcoded.

### Added
- `mcpName` field for MCP Registry ownership verification.
- `smithery.yaml` for Smithery one-click install.
- `.github/workflows/ci.yml` — GitHub Actions CI (build + test on push/PR to main).
- README badges (npm + MCP Registry) and "Why grok-mcp?" positioning section.
- `docs/improvement-plan.md` capturing the discoverability roadmap.

### Deprecated
- `grok-build-mcp` npm package — use `grok-mcp` instead.

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
