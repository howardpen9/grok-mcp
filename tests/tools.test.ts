import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/grok.ts", () => ({
  runGrok: vi.fn(async (prompt: string) => ({ stdout: `ECHO:${prompt}`, stderr: "", exitCode: 0 })),
  checkGrokAvailable: vi.fn(async () => ({ ok: true, version: "test" })),
  GrokCliError: class extends Error {},
  GrokTimeoutError: class extends Error {},
}));

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

const { grokChat } = await import("../src/tools/chat.ts");
const { grokConsult } = await import("../src/tools/consult.ts");
const { grokChallenge } = await import("../src/tools/challenge.ts");
const { grokReview } = await import("../src/tools/review.ts");
const grokMod = await import("../src/grok.ts");
const runGrokMock = vi.mocked(grokMod.runGrok);

beforeEach(() => {
  runGrokMock.mockClear();
  spawnMock.mockReset();
});

describe("grok_chat", () => {
  it("validates required prompt", () => {
    expect(grokChat.inputSchema.safeParse({}).success).toBe(false);
    expect(grokChat.inputSchema.safeParse({ prompt: "hi" }).success).toBe(true);
  });

  it("passes prompt through to runGrok unchanged", async () => {
    await grokChat.handler({ prompt: "hello world" });
    expect(runGrokMock).toHaveBeenCalledWith("hello world", { model: undefined });
  });

  it("converts the timeout (seconds) into timeoutMs for runGrok", async () => {
    await grokChat.handler({ prompt: "slow one", timeout: 600 });
    expect(runGrokMock).toHaveBeenCalledWith("slow one", {
      model: undefined,
      timeoutMs: 600_000,
    });
  });

  it("omits timeoutMs when timeout is not provided", async () => {
    await grokChat.handler({ prompt: "default" });
    expect(runGrokMock.mock.calls[0]?.[1]).not.toHaveProperty("timeoutMs");
  });
});

describe("grok_consult", () => {
  it("flattens messages with role markers", async () => {
    await grokConsult.handler({
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "what is 2+2" },
        { role: "assistant", content: "4" },
        { role: "user", content: "why" },
      ],
    });
    const prompt = runGrokMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("[SYSTEM]\nbe terse");
    expect(prompt).toContain("[USER]\nwhat is 2+2");
    expect(prompt).toContain("[ASSISTANT]\n4");
    expect(prompt).toContain("[USER]\nwhy");
    expect(prompt.trimEnd().endsWith("[ASSISTANT]")).toBe(true);
  });

  it("rejects empty message list", () => {
    expect(grokConsult.inputSchema.safeParse({ messages: [] }).success).toBe(false);
  });
});

describe("grok_challenge", () => {
  it("wraps code in adversarial template", async () => {
    await grokChallenge.handler({ code: "function add(a,b){return a-b}", context: "TS arithmetic" });
    const prompt = runGrokMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("hostile senior engineer");
    expect(prompt).toContain("Context: TS arithmetic");
    expect(prompt).toContain("--- CODE START ---");
    expect(prompt).toContain("function add(a,b){return a-b}");
    expect(prompt).toContain("--- CODE END ---");
  });
});

describe("grok_review", () => {
  it("uses provided diff verbatim and skips git", async () => {
    const diff = "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n";
    await grokReview.handler({ diff, focus: "security" });
    expect(spawnMock).not.toHaveBeenCalled();
    const prompt = runGrokMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("Focus area: security");
    expect(prompt).toContain(diff);
  });

  it("falls back to git diff when no diff provided", async () => {
    const { EventEmitter } = await import("node:events");
    const { PassThrough } = await import("node:stream");
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawnMock.mockReturnValueOnce(child);
    const promise = grokReview.handler({ base_ref: "develop" });
    child.stdout.write("DIFF_CONTENT");
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0);
    await promise;
    expect(spawnMock).toHaveBeenCalledWith(
      "git",
      ["diff", "develop...HEAD"],
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
    );
    const prompt = runGrokMock.mock.calls[0]?.[0] as string;
    expect(prompt).toContain("DIFF_CONTENT");
  });

  it("returns friendly message on empty diff", async () => {
    const result = await grokReview.handler({ diff: "" });
    expect(result).toMatch(/No diff to review/);
    expect(runGrokMock).not.toHaveBeenCalled();
  });
});
