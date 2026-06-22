#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { checkBackend } from "./grok.js";
import { grokChat } from "./tools/chat.js";
import { grokReview } from "./tools/review.js";
import { grokConsult } from "./tools/consult.js";
import { grokChallenge } from "./tools/challenge.js";
import type { ErasedTool } from "./tools/types.js";

const TOOLS: ErasedTool[] = [grokChat, grokReview, grokConsult, grokChallenge];

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string };

async function main() {
  const server = new Server(
    {
      name: "grok-mcp",
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema, { target: "openApi3" }) as Record<string, unknown>,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
      };
    }
    const parsed = tool.inputSchema.safeParse(req.params.arguments ?? {});
    if (!parsed.success) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Invalid arguments for ${tool.name}:\n${JSON.stringify(parsed.error.format(), null, 2)}`,
          },
        ],
      };
    }
    try {
      const result = await tool.handler(parsed.data);
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text", text: msg }],
      };
    }
  });

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
