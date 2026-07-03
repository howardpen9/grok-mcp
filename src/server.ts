import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { grokChat } from "./tools/chat.js";
import { grokReview } from "./tools/review.js";
import { grokConsult } from "./tools/consult.js";
import { grokChallenge } from "./tools/challenge.js";
import type { ErasedTool } from "./tools/types.js";

export const TOOLS: ErasedTool[] = [grokChat, grokReview, grokConsult, grokChallenge];

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(here, "..", "package.json"), "utf8"),
) as { version: string };

export const VERSION = pkg.version;

/**
 * Build a configured MCP Server with all four Grok tools registered.
 * Shared by the stdio entry point (src/index.ts) and the Streamable HTTP
 * entry point (src/http.ts). Does not attach a transport — the caller does.
 *
 * Stateless-HTTP note: SDK 1.29+ stateless transports are single-request-use,
 * so the HTTP entry point calls this once per incoming request.
 */
export function createGrokMcpServer(): Server {
  const server = new Server(
    {
      name: "grok-mcp",
      version: VERSION,
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
      inputSchema: zodToJsonSchema(t.inputSchema, { target: "jsonSchema7", $refStrategy: "none" }) as Record<
        string,
        unknown
      >,
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

  return server;
}
