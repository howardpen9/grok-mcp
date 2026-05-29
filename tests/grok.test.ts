import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

// Import after the mock is registered.
const { runGrok, GrokCliError, GrokTimeoutError, checkGrokAvailable } = await import(
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runGrok", () => {
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
