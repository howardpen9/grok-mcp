# grok-mcp

> 把 xAI 的 [Grok Build CLI](https://x.ai/news/grok-build-cli) 包成 MCP server，讓 Claude Code、Cursor、Cline、OpenClaw 等 MCP host 都能直接調用 Grok 來做 code review、對抗測試、第二意見諮詢。

English: [README.md](./README.md)

## 提供什麼

四個 tool，全部 stateless：

| Tool | 用途 |
|------|------|
| `grok_chat` | 一次性問答 |
| `grok_review` | 給 diff（或自動 `git diff main...HEAD`），回結構化 code review |
| `grok_consult` | 多輪對話，caller 自己重送 history |
| `grok_challenge` | 對抗模式：請 Grok 找 bug、race condition、security hole |

## 前置需求

- Node.js ≥ 18
- 已安裝並登入 Grok CLI：
  ```bash
  curl -fsSL https://x.ai/cli/install.sh | bash
  grok  # 第一次跑會處理登入
  ```

## 安裝

```bash
npm install -g grok-mcp
# 或直接 npx 不裝
npx grok-mcp
```

## 串到 MCP host

### Claude Code

```bash
claude mcp add grok npx -- grok-mcp
```

或直接編輯 `~/.claude.json`：

```json
{
  "mcpServers": {
    "grok": {
      "command": "npx",
      "args": ["-y", "grok-mcp"]
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
      "args": ["-y", "grok-mcp"]
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
    "args": ["-y", "grok-mcp"]
  }
}
```

### 其他 MCP host

`grok-mcp` 跑標準 stdio MCP。任何 client 指向 `npx -y grok-mcp` 即可。

## Tool 用法

### `grok_chat`

```json
{ "prompt": "兩句話解釋 consistent hashing。" }
```

可選 `model` 覆寫預設 Grok model。

### `grok_review`

```json
{ "base_ref": "main", "focus": "security" }
```

沒給 `diff` 就跑 `git diff <base_ref>...HEAD`。回傳 markdown 評審，含整體判決、五維度評分（correctness / readability / architecture / security / performance）、具體修正建議。

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
| `GROK_MCP_BIN` | `grok` | grok binary 路徑 |
| `GROK_MCP_TIMEOUT` | `120000` | 單次 call timeout（毫秒） |

認證與預設 model 在 Grok CLI 自己的 `~/.grok/config.toml`。

## Roadmap

- v0.1（本版）：四個 stateless tool、stdio transport
- v0.2：server 端 session 持久化，`grok_consult` 可帶 `conversation_id`
- v0.3：透過 MCP `progress` notification 做 streaming

## 開發

```bash
git clone https://github.com/howardpen9/grok-mcp.git
cd grok-mcp
npm install
npm test
npm run build
```

## License

MIT
