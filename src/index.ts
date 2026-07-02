#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkBackend } from "./grok.js";
import { createGrokMcpServer } from "./server.js";

async function main() {
  const server = createGrokMcpServer();

  // Startup check: log the active backend (to stderr, never stdout).
  const probe = await checkBackend();
  if (!probe.ok) {
    process.stderr.write(`[grok-mcp] WARN (${probe.backend}): ${probe.detail}\n`);
  } else {
    process.stderr.write(`[grok-mcp] backend=${probe.backend}: ${probe.detail}\n`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[grok-mcp] ready (stdio)\n");
}

main().catch((err) => {
  process.stderr.write(`[grok-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
