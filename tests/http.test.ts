import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server as NodeHttpServer } from "node:http";
import type { AddressInfo } from "node:net";

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-client", version: "0.0.0" },
  },
};

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};

/** Fresh import so each test picks up its own env (path secret is read at app build). */
async function buildApp() {
  const mod = await import("../src/http.js");
  return mod.createHttpApp();
}

async function listen(app: import("express").Express): Promise<{ server: NodeHttpServer; base: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

describe("http transport", () => {
  let server: NodeHttpServer | undefined;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ["GROK_MCP_PATH_SECRET", "GROK_MCP_ALLOWED_HOSTS", "GROK_MCP_REMOTE"]) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(async () => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    if (server) await new Promise((r) => server!.close(r));
    server = undefined;
  });

  it("GET /health returns ok + version", async () => {
    const { server: s, base } = await listen(await buildApp());
    server = s;
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; name: string; version: string };
    expect(body.ok).toBe(true);
    expect(body.name).toBe("grok-mcp");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("POST /mcp initialize handshake succeeds statelessly", async () => {
    const { server: s, base } = await listen(await buildApp());
    server = s;
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // Streamable HTTP answers over SSE; the initialize result carries serverInfo.
    expect(text).toContain('"serverInfo"');
    expect(text).toContain('"grok-mcp"');
  });

  it("GET /mcp returns 405 in stateless mode", async () => {
    const { server: s, base } = await listen(await buildApp());
    server = s;
    const res = await fetch(`${base}/mcp`, { headers: MCP_HEADERS });
    expect(res.status).toBe(405);
  });

  it("path secret moves the endpoint and hides /mcp", async () => {
    process.env.GROK_MCP_PATH_SECRET = "s3cret-token";
    const { server: s, base } = await listen(await buildApp());
    server = s;

    const missed = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    expect(missed.status).toBe(404);

    const hit = await fetch(`${base}/mcp/s3cret-token`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    expect(hit.status).toBe(200);
  });

  it("rejects disallowed Host headers when GROK_MCP_ALLOWED_HOSTS is set", async () => {
    process.env.GROK_MCP_ALLOWED_HOSTS = "grok.example.com";
    const { server: s, base } = await listen(await buildApp());
    server = s;
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    expect(res.status).toBe(403);
  });

  it("tools/list over HTTP exposes all four grok tools", async () => {
    const { server: s, base } = await listen(await buildApp());
    server = s;
    // Stateless: initialize and tools/list can go in one batch-free flow —
    // each POST is independent, no session id required.
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    for (const tool of ["grok_chat", "grok_review", "grok_consult", "grok_challenge"]) {
      expect(text).toContain(tool);
    }
  });
});
