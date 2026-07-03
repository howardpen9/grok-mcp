<p align="center">
  <img src="./assets/social-preview.png" alt="grok-mcp — 讓 Claude 把 Grok 當 reviewer 與嚴謹第二意見顧問使用" width="720" />
</p>

# grok-mcp

[![npm version](https://img.shields.io/npm/v/grok-cli-mcp.svg)](https://www.npmjs.com/package/grok-cli-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-published-success)](https://registry.modelcontextprotocol.io/)

> 讓 Claude Code、Cursor、Cline、OpenClaw 等 MCP host 把 **Grok 當成 code reviewer 與嚴謹第二意見顧問** 使用 — 可直連 xAI API（只要一把 `XAI_API_KEY`，免安裝），也可透過官方 [Grok CLI](https://x.ai/news/grok-build-cli)。

`grok-mcp`（npm 套件名 [`grok-cli-mcp`](https://www.npmjs.com/package/grok-cli-mcp)）是 [Model Context Protocol](https://modelcontextprotocol.io) server，給你的主要 agent（Claude、Cursor…）四個 tool，讓它能把工作委派給 Grok 取得高品質第二意見與嚴謹驗證，而不用離開 session。從 **v0.3.0** 起它直接打 xAI API — 不需要 `grok` binary — 並保留 CLI 路徑給 OAuth 使用者：

- `grok_review` — 結構化 diff review，附五維度評分
- `grok_challenge` — 徹底分析 bug、race、edge case 與 security 問題
- `grok_consult` — 多輪諮詢（caller 自己重送 history）
- `grok_chat` — 一次性問答

English: [README.md](./README.md)

## 為什麼用 grok-mcp？

市面上其他 "Grok MCP" 套件大多讓 Claude 可以「使用」Grok 的 chat / search / image 能力。`grok-mcp` 讓你的主要 coding agent（Claude / Cursor）**請 Grok 提供嚴謹的第二意見**。換一個 model 進行徹底審查，通常能抓到單模型 loop 容易忽略的問題。

## 提供什麼

四個 tool，全部 stateless、全部只讀 stdout：

| Tool | 用途 |
|------|------|
| `grok_chat` | 一次性問答 |
| `grok_review` | 給 diff（或自動 `git diff main...HEAD`），回結構化 code review |
| `grok_consult` | 多輪對話，caller 自己重送 history |
| `grok_challenge` | 嚴謹分析：請 Grok 找出 bug、race condition、edge case 與 security 問題 |

## 前置需求

- Node.js ≥ 18
- 一個後端（server 會自動挑選 — 見 [後端 Backends](#後端-backends)）：
  - **API 模式（推薦，零安裝）：** 到 [console.x.ai](https://console.x.ai) 拿一把 `XAI_API_KEY`。Server 直接打 xAI HTTP API，不需要額外 binary。
  - **CLI 模式：** 安裝 Grok CLI，在沒設 `XAI_API_KEY` 時使用：
    ```bash
    curl -fsSL https://x.ai/cli/install.sh | bash
    ```
    然後用瀏覽器 OAuth 認證（互動跑一次 `grok`）。詳見下方 [認證](#認證)。

## 安裝

```bash
npm install -g grok-cli-mcp
# 或直接 npx 不裝
npx grok-cli-mcp
```

> **為什麼 npm 套件名是 `grok-cli-mcp`？** 因為 `grok-mcp` 這個短名在 npm 上已被另一個無關專案佔走（一個 Grok HTTP API integration）。品牌、GitHub repo、MCP server 內部識別仍是 `grok-mcp`；只有 npm 安裝識別字改用 `grok-cli-mcp` — 反正這個套件就是 wrap 官方 **Grok CLI**，名字也算直白。

## 認證

有兩種認證方式，各自對應一種 [後端](#後端-backends)：

| 方式 | 後端 | 適合場景 | Rate limit |
|------|------|---------|-----------|
| **API key**（`XAI_API_KEY` 環境變數）| API 模式 — 不需要 `grok` binary | MCP / CI / 自動化 | 按次計費，無訂閱配額上限 |
| **瀏覽器 OAuth**（互動跑 `grok` 登入）| CLI 模式 | 本機互動使用 | 依你的 grok.com 訂閱方案 |

設定 `XAI_API_KEY` 會把 server 切到 [API 模式](#後端-backends)，所以你可以保留瀏覽器登入給互動式 `grok` 用，**只在這個 MCP server 的 env block 加 `XAI_API_KEY`**：

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

注意 API key 等同密鑰 — 會寫進 MCP host 的設定檔（例如 `~/.claude.json`），磁碟上是明文 JSON。

## 串到 MCP host

### Claude Code

推薦用 `add-json`，env block 才會正確 parse：

```bash
claude mcp add-json -s user grok '{
  "command": "npx",
  "args": ["-y", "grok-cli-mcp"],
  "env": { "XAI_API_KEY": "xai-...", "GROK_MCP_TIMEOUT": "600000" }
}'
```

> **為什麼不用 `claude mcp add -e ...`？** `-e KEY=val` 是 variadic flag，傳超過一個 `-e` 時，server 名字會被當成下一個 env value 吃掉。`add-json` 一次到位避開這個坑。

或直接編輯 `~/.claude.json`，最簡寫法（fallback 到 OAuth）：

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

`.cursor/mcp.json`（專案）或 `~/.cursor/mcp.json`（全域）：

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

Settings → Cline → MCP Servers：

```json
{
  "grok": {
    "command": "npx",
    "args": ["-y", "grok-cli-mcp"]
  }
}
```

### Claude Desktop（本地，不用架伺服器）

Claude Desktop 仍支援本地 stdio server：**Settings → Developer → Edit Config**（`claude_desktop_config.json`），貼上面 Claude Code 那段 JSON 即可。

### Claude Web / Claude Desktop connector（遠端，v0.4+）

Claude 的 **Settings → Connectors → Add custom connector** 對話框要的是 HTTPS 網址、不是指令 — 所以把內建的 Streamable HTTP server 部署起來，貼它的網址：

```bash
# 1. 產生路徑密鑰（防止陌生人燒你的 xAI credits）
openssl rand -base64 32 | tr '+/' '-_'

# 2. 部署到任何能跑 Node 的地方（Railway / Fly / Render / VPS）。
#    repo 內附 multi-stage Dockerfile:
docker build -t grok-mcp . && docker run \
  -e XAI_API_KEY=xai-... \
  -e GROK_MCP_PATH_SECRET=<步驟1的密鑰> \
  -p 3000:3000 grok-mcp

# ...不用 Docker 也行:
XAI_API_KEY=xai-... GROK_MCP_PATH_SECRET=<密鑰> npx -y -p grok-cli-mcp grok-mcp-http
```

然後在 Claude 加入 connector，網址填：

```
https://your-host.example.com/mcp/<步驟1的密鑰>
```

不需要 OAuth — Client ID/Secret 欄位留白即可。只有伺服器主動要求時 Claude 才會走 OAuth 流程。

遠端模式注意事項：

- **把網址當成密碼看待。** 路徑密鑰是網路世界和你的 xAI 帳單之間唯一的門。換掉環境變數即可輪替。
- **HTTP 模式下 `grok_review` 必須明確傳 `diff`** — 伺服器看不到你本地的 repo，遠端模式停用了自動 `git diff`。
- **`GROK_MCP_TIMEOUT` 要設得比平台的 request timeout 低**（並關掉 scale-to-zero）— grok-4 推理可能跑好幾分鐘。
- `GET /health` 可給平台做健康檢查；全部設定項見 [`.env.example`](./.env.example)（`GROK_MCP_ALLOWED_HOSTS`、`GROK_MCP_CORS_ORIGINS`…）。

### 其他 MCP host

`grok-mcp` 跑標準 stdio MCP。任何 client 指向 `npx -y grok-cli-mcp` 即可。HTTP host 則可以改指向上面的遠端 endpoint。

## Tool 用法

### `grok_chat`

```json
{ "prompt": "兩句話解釋 consistent hashing。" }
```

可選 `model` 覆寫預設 Grok model；`timeout`（秒）拉長單次 call 的時限，給 grok-4 長推理用。四個 tool 都接受 `timeout`。

### `grok_review`

```json
{ "base_ref": "main", "focus": "security" }
```

沒給 `diff` 就在 `cwd`（預設是你 host 的工作目錄）跑 `git diff <base_ref>...HEAD`。預設回傳 markdown 評審，含整體判決、五維度評分（correctness / readability / architecture / security / performance）、具體修正建議。

傳 `"format": "json"` 可以拿到機器可讀的 JSON 輸出，適合 CI gate — 詳見下方 [當 PR gate 用](#當-pr-gate-用ci)。

### `grok_consult`

```json
{
  "messages": [
    { "role": "system", "content": "你是資深後端工程師。" },
    { "role": "user", "content": "這個 query 怎麼 cache？" },
    { "role": "assistant", "content": "兩個方案..." },
    { "role": "user", "content": "方案 2 的 failure mode 是什麼？" }
  ]
}
```

Server 不存 state，caller 每次帶完整 history。一般 MCP host 會自動處理。

### `grok_challenge`

```json
{
  "code": "function transfer(from, to, amount) { from.balance -= amount; to.balance += amount; }",
  "context": "Node.js，HTTP handler 並發呼叫"
}
```

回傳 severity 分級的問題（Critical / High / Medium / Low），含重現步驟與修補建議。

## 設定

| 環境變數 | 預設值 | 用途 |
|---------|--------|------|
| `XAI_API_KEY` | *（未設，fallback 到 OAuth）* | 到 [console.x.ai](https://console.x.ai) 拿。設定後 server 走 [API 模式](#後端-backends)（直連 HTTP），按次計費、無訂閱配額上限。詳見 [認證](#認證)。 |
| `GROK_MCP_BACKEND` | `auto` | 要用哪個後端：`api`（直連 HTTP）、`cli`（呼叫 `grok`）、或 `auto`（有 `XAI_API_KEY` 走 API，否則走 CLI）。見 [後端 Backends](#後端-backends)。 |
| `GROK_MCP_MODEL` | `grok-4` | API 模式使用的 model。（CLI 模式讀 `~/.grok/config.toml`。） |
| `GROK_MCP_BASE_URL` | `https://api.x.ai/v1` | API base URL — API 模式下可指向 proxy 或相容 gateway。 |
| `GROK_MCP_BIN` | `grok` | grok binary 路徑（僅 CLI 模式） |
| `GROK_MCP_TIMEOUT` | `300000` | 預設單次 call timeout（毫秒） |

### 後端 Backends

Server 有兩種方式接觸 Grok，啟動時會自動挑一種（並把選到的後端印到 stderr）：

- **API 模式** — 用 Node 內建 `fetch` 直接打 xAI 的 OpenAI 相容端點 `/chat/completions`。不需要 `grok` binary、錯誤更乾淨、按次計費。設了 `XAI_API_KEY` 就會選它，或用 `GROK_MCP_BACKEND=api` 強制。
- **CLI 模式** — 呼叫已安裝的 `grok` binary（支援瀏覽器 OAuth）。沒設 `XAI_API_KEY` 時選它，或用 `GROK_MCP_BACKEND=cli` 強制。

用 `GROK_MCP_BACKEND` 強制指定模式。API 模式下用 `GROK_MCP_MODEL` 設 model；CLI 模式的預設 model 設定在 `~/.grok/config.toml`。

### Timeout

grok-4 是 reasoning model，長 prompt 動輒超過兩分鐘。Server 預設單次時限為 **300 秒（5 分鐘）**，有三種調整方式：

- **單次 call** — 對任一 tool 傳 `timeout`（秒）：`{ "prompt": "...", "timeout": 600 }`。
- **整個 server** — 在 MCP server 的環境變數設 `GROK_MCP_TIMEOUT`（毫秒）。
- **Host 端** — MCP host 自己也有 request timeout，可能比 server 更早觸發。若上面兩項都調高仍超時，請一併拉高 host 的時限。在 Claude Code 是 `MCP_TIMEOUT`（server 啟動）與 `MCP_TOOL_TIMEOUT`（單次 tool call），單位皆為毫秒。

超時時，錯誤訊息會附上 Grok 在截止前已產生的 partial 輸出，避免快完成的答案整個丟失。

## 當 PR gate 用（CI）

`grok-mcp` 內附 `grok-review-ci` bin 跟 composite GitHub Action，讓 Grok 在每個 PR 評審並在 `block` 時擋下 check。

複製進你 repo 的 `.github/workflows/grok-review.yml`：

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
          gate-on: block      # 也可以 block,request_changes
          # focus: security   # 可選
          # min-score: 6      # 可選 — 任一維度低於此值就 fail
```

Action 會在 PR 留 sticky comment（含 verdict、各維度分數、具體 blockers），並在 verdict 命中 `gate-on` 時讓 check 失敗。完整範例：[`examples/workflows/grok-review.yml`](./examples/workflows/grok-review.yml)。

想直接從 tool 拿 JSON？對 `grok_review` 傳 `format: "json"`，回傳 schema 跟 bin 輸出一致，可塞進任何 pipeline：

```json
{
  "verdict": "block",
  "summary": "src/db.ts 有未參數化的 SQL query。",
  "scores": { "correctness": 4, "readability": 7, "architecture": 5, "security": 2, "performance": 8 },
  "blockers": [
    { "severity": "critical", "title": "SQL injection", "file": "src/db.ts", "line": 42,
      "reason": "使用者輸入直接串接進 query。",
      "fix": "改用參數化 query：`db.query(sql, [userId])`。" }
  ],
  "notes": []
}
```

## Roadmap

- **v0.1** — 四個 stateless tool、stdio transport
- **Discoverability push（v0.1.3，已上）** — 統一命名、MCP Registry submission、Smithery、glama.ai 上架、加強定位。完整計畫見 [`docs/improvement-plan.md`](./docs/improvement-plan.md)，實際改了什麼見 [`CHANGELOG.md`](./CHANGELOG.md)。
- **v0.2（已上）** — `grok_review` JSON mode + `grok-review-ci` bin + GitHub Action 做 PR gate。
- **v0.3（已上）** — 直連 xAI API backend（不需要 `grok` CLI）；`GROK_MCP_BACKEND` api/cli/auto。
- **v0.4（這版）** — 遠端 MCP 模式：`grok-mcp-http` Streamable HTTP server，可加入 Claude Web / Claude Desktop 自訂 connector；含路徑密鑰驗證、Dockerfile、`.env.example`。
- **v0.5** — server 端 session 持久化，`grok_consult` 可帶 `conversation_id`
- **v0.6** — 透過 MCP `progress` notification 做 streaming；共用主機的 OAuth + per-user key store

## 開發

```bash
git clone https://github.com/howardpen9/grok-mcp.git
cd grok-mcp
npm install
npm test
npm run build
```

## 聯絡方式

Bug 回報、需求許願 → [GitHub issues](https://github.com/howardpen9/grok-mcp/issues)。
也歡迎在 X 上 DM 我：[@0xHoward_Peng](https://x.com/0xHoward_Peng)。

## License

MIT
