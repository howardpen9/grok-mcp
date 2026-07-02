#!/usr/bin/env node
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { checkBackend } from "./grok.js";
import { createGrokMcpServer, VERSION } from "./server.js";

// Remote mode: grok_review must receive the diff explicitly — the server has
// no access to the caller's repo, and letting public callers spawn `git`
// against arbitrary cwd would be a hole.
process.env.GROK_MCP_REMOTE = "1";

const JSONRPC_METHOD_NOT_ALLOWED = {
  jsonrpc: "2.0",
  error: { code: -32000, message: "Method not allowed. Stateless server: POST only." },
  id: null,
} as const;

function validateHost(req: Request, res: Response, next: NextFunction) {
  const allowed = process.env.GROK_MCP_ALLOWED_HOSTS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (allowed?.length && !allowed.includes(req.headers.host ?? "")) {
    res.status(403).json({ error: "Forbidden: host not allowed" });
    return;
  }
  next();
}

export function createHttpApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    cors({
      origin: process.env.GROK_MCP_CORS_ORIGINS?.split(",").map((o) => o.trim()) ?? true,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "content-type",
        "accept",
        "authorization",
        "mcp-session-id",
        "mcp-protocol-version",
        "last-event-id",
      ],
      exposedHeaders: ["mcp-session-id", "mcp-protocol-version"],
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, name: "grok-mcp", version: VERSION });
  });

  const secret = process.env.GROK_MCP_PATH_SECRET?.trim();
  const mcpPath = secret ? `/mcp/${secret}` : "/mcp";

  app.post(
    mcpPath,
    validateHost,
    express.json({ limit: process.env.GROK_MCP_BODY_LIMIT ?? "2mb" }),
    async (req, res) => {
      // Stateless: SDK transports are single-request-use, so build a fresh
      // server + transport pair per request (SDK 1.29+ rejects reuse).
      const server = createGrokMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        process.stderr.write(
          `[grok-mcp] http error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
        );
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    },
  );

  // Stateless mode has no server-initiated streams and no sessions to delete.
  app.get(mcpPath, validateHost, (_req, res) => {
    res.status(405).json(JSONRPC_METHOD_NOT_ALLOWED);
  });
  app.delete(mcpPath, validateHost, (_req, res) => {
    res.status(405).json(JSONRPC_METHOD_NOT_ALLOWED);
  });

  return app;
}

async function main() {
  const probe = await checkBackend();
  if (!probe.ok) {
    process.stderr.write(`[grok-mcp] WARN (${probe.backend}): ${probe.detail}\n`);
  } else {
    process.stderr.write(`[grok-mcp] backend=${probe.backend}: ${probe.detail}\n`);
  }
  if (probe.backend === "cli") {
    process.stderr.write(
      "[grok-mcp] WARN: CLI backend on a remote server is fragile — set XAI_API_KEY (or GROK_MCP_BACKEND=api) for hosted deployments.\n",
    );
  }

  const secret = process.env.GROK_MCP_PATH_SECRET?.trim();
  if (!secret) {
    process.stderr.write(
      "[grok-mcp] WARN: GROK_MCP_PATH_SECRET is not set — /mcp is open to anyone who finds the URL, and every request spends YOUR xAI credits. Generate one: openssl rand -base64 32 | tr '+/' '-_'\n",
    );
  }

  const app = createHttpApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  app.listen(port, host, () => {
    const path = secret ? `/mcp/${secret.slice(0, 4)}…` : "/mcp";
    process.stderr.write(`[grok-mcp] ready (http) — listening on ${host}:${port}, endpoint ${path}\n`);
  });
}

// Only start listening when run as a bin, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(
      `[grok-mcp] fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
