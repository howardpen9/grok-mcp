#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { checkGrokAvailable } from "./grok.js";
import { grokChat } from "./tools/chat.js";
import { grokReview } from "./tools/review.js";
import { grokConsult } from "./tools/consult.js";
import { grokChallenge } from "./tools/challenge.js";
import type { ErasedTool } from "./tools/types.js";

const TOOLS: ErasedTool[] = [grokChat, grokReview, grokConsult, grokChallenge];

async function main() {
  const server = new Server(
    {
      name: "grok-mcp",
      version: "0.1.2",
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

  // Startup check: warn (to stderr, never stdout) if grok CLI missing.
  const probe = await checkGrokAvailable();
  if (!probe.ok) {
    process.stderr.write(`[grok-mcp] WARN: ${probe.reason}\n`);
  } else {
    process.stderr.write(`[grok-mcp] grok CLI detected: ${probe.version}\n`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[grok-mcp] ready (stdio)\n");
}

main().catch((err) => {
  process.stderr.write(`[grok-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
