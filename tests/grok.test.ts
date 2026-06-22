import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// Import after the mock is registered.
const { runGrok, GrokCliError, GrokTimeoutError, GrokApiError, checkGrokAvailable } = await import(
  "../src/grok.ts"
);

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function makeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

beforeEach(() => {
  spawnMock.mockReset();
  // Pin the CLI backend so these tests exercise the spawn path regardless of
  // whether XAI_API_KEY happens to be set in the surrounding environment.
  vi.stubEnv("GROK_MCP_BACKEND", "cli");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("runGrok (cli backend)", () => {
  it("resolves with trimmed stdout on success", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = runGrok("hello");
    child.stdout.write("hi there\n");
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0);
    const result = await promise;
    expect(result.stdout).toBe("hi there");
    expect(result.exitCode).toBe(0);
    expect(spawnMock).toHaveBeenCalledWith(
      "grok",
      ["-p", "hello"],
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
    );
  });

  it("strips ANSI escapes from output", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = runGrok("hi");
    child.stdout.write("[31mred[0m text");
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0);
    const result = await promise;
    expect(result.stdout).toBe("red text");
  });

  it("passes --model when provided", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = runGrok("ping", { model: "grok-4" });
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0);
    await promise;
    expect(spawnMock).toHaveBeenCalledWith(
      "grok",
      ["-p", "ping", "--model", "grok-4"],
      expect.anything(),
    );
  });

  it("rejects with GrokCliError on non-zero exit", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = runGrok("boom");
    child.stdout.end();
    child.stderr.write("auth failed\n");
    child.stderr.end();
    child.emit("close", 1);
    await expect(promise).rejects.toBeInstanceOf(GrokCliError);
    await expect(promise).rejects.toMatchObject({ exitCode: 1 });
  });

  it("rejects with GrokCliError when grok binary missing", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = runGrok("hi");
    const err = Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
    child.emit("error", err);
    await expect(promise).rejects.toBeInstanceOf(GrokCliError);
    await expect(promise).rejects.toMatchObject({ exitCode: 127 });
  });

  it("rejects with GrokTimeoutError when timeout fires", async () => {
    vi.useFakeTimers();
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = runGrok("slow", { timeoutMs: 100 });
    vi.advanceTimersByTime(101);
    // Simulate the kill -> process close.
    child.emit("close", null);
    await expect(promise).rejects.toBeInstanceOf(GrokTimeoutError);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("includes partial output and remediation hint in the timeout error", async () => {
    vi.useFakeTimers();
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = runGrok("slow", { timeoutMs: 100 });
    child.stdout.write("half an answer");
    vi.advanceTimersByTime(101);
    child.emit("close", null);
    await expect(promise).rejects.toMatchObject({ partialStdout: "half an answer" });
    await expect(promise).rejects.toThrow(/timed out after 0s/);
    await expect(promise).rejects.toThrow(/half an answer/);
    await expect(promise).rejects.toThrow(/timeout/i);
  });
});

describe("runGrok (api backend)", () => {
  function useApiBackend() {
    vi.stubEnv("GROK_MCP_BACKEND", "api");
    vi.stubEnv("XAI_API_KEY", "test-key");
  }

  it("posts to the chat-completions endpoint and returns the message content", async () => {
    useApiBackend();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ choices: [{ message: { content: "  hello from grok  " } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runGrok("hi", { model: "grok-4" });
    expect(result.stdout).toBe("hello from grok");
    expect(result.exitCode).toBe(0);
    expect(spawnMock).not.toHaveBeenCalled();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.model).toBe("grok-4");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect((init as { headers: Record<string, string> }).headers.authorization).toBe(
      "Bearer test-key",
    );
  });

  it("honours GROK_MCP_BASE_URL and GROK_MCP_MODEL", async () => {
    useApiBackend();
    vi.stubEnv("GROK_MCP_BASE_URL", "https://proxy.local/v1/");
    vi.stubEnv("GROK_MCP_MODEL", "grok-3");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await runGrok("hi");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://proxy.local/v1/chat/completions");
    expect(JSON.parse((init as { body: string }).body).model).toBe("grok-3");
  });

  it("throws GrokApiError on a non-ok HTTP response", async () => {
    useApiBackend();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "invalid api key",
      })),
    );
    await expect(runGrok("hi")).rejects.toBeInstanceOf(GrokApiError);
    await expect(runGrok("hi")).rejects.toMatchObject({ status: 401 });
  });

  it("throws GrokApiError when api backend is forced without a key", async () => {
    vi.stubEnv("GROK_MCP_BACKEND", "api");
    vi.stubEnv("XAI_API_KEY", "");
    await expect(runGrok("hi")).rejects.toBeInstanceOf(GrokApiError);
  });
});

describe("checkGrokAvailable", () => {
  it("returns ok when grok --version exits 0", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = checkGrokAvailable();
    child.stdout.write("grok 1.2.3\n");
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0);
    const result = await promise;
    expect(result).toEqual({ ok: true, version: "grok 1.2.3" });
  });

  it("returns reason when binary missing", async () => {
    const child = makeChild();
    spawnMock.mockReturnValue(child);
    const promise = checkGrokAvailable();
    child.emit("error", Object.assign(new Error("nope"), { code: "ENOENT" }));
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not found in PATH/);
  });
});
