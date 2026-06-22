import { spawn } from "node:child_process";
import stripAnsi from "strip-ansi";

export interface RunGrokOptions {
  model?: string;
  timeoutMs?: number;
  cwd?: string;
  extraArgs?: string[];
}

export interface RunGrokResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GrokCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "GrokCliError";
  }
}

export class GrokTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly partialStdout = "",
  ) {
    const seconds = Math.round(timeoutMs / 1000);
    const hint =
      `Grok timed out after ${seconds}s. grok-4 reasoning on long prompts can exceed this. ` +
      `Raise it per-call with the "timeout" parameter (seconds), or globally via the GROK_MCP_TIMEOUT env var (ms). ` +
      `If the MCP host itself times out first, raise its limit too (e.g. Claude Code: MCP_TIMEOUT / MCP_TOOL_TIMEOUT).`;
    const partial = partialStdout.trim()
      ? `\n\n--- Partial output received before timeout ---\n${partialStdout.trim()}`
      : "";
    super(`${hint}${partial}`);
    this.name = "GrokTimeoutError";
  }
}

export class GrokApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = "GrokApiError";
  }
}

const DEFAULT_TIMEOUT_MS = Number(process.env.GROK_MCP_TIMEOUT ?? 300_000);
const GROK_BIN = process.env.GROK_MCP_BIN ?? "grok";
const DEFAULT_MODEL = "grok-4";

export type GrokBackend = "api" | "cli";

/**
 * Resolve which backend to use, reading env at call time so it can be toggled
 * per-process and overridden in tests.
 *   GROK_MCP_BACKEND=api   → always call the xAI HTTP API
 *   GROK_MCP_BACKEND=cli   → always shell out to the grok CLI
 *   (unset / "auto")       → API when XAI_API_KEY is set, else the CLI
 */
export function resolveBackend(): GrokBackend {
  const explicit = process.env.GROK_MCP_BACKEND?.trim().toLowerCase();
  if (explicit === "api") return "api";
  if (explicit === "cli") return "cli";
  return process.env.XAI_API_KEY ? "api" : "cli";
}

export async function runGrok(
  prompt: string,
  opts: RunGrokOptions = {},
): Promise<RunGrokResult> {
  if (resolveBackend() === "api") return runGrokApi(prompt, opts);
  return runGrokCli(prompt, opts);
}

/**
 * Direct call to xAI's OpenAI-compatible chat-completions endpoint.
 * Uses the built-in global fetch — no extra dependency and no grok CLI install.
 */
async function runGrokApi(
  prompt: string,
  opts: RunGrokOptions = {},
): Promise<RunGrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new GrokApiError(
      "GROK_MCP_BACKEND=api but XAI_API_KEY is not set. Get a key at https://console.x.ai and set XAI_API_KEY.",
      0,
      "",
    );
  }

  const baseUrl = (process.env.GROK_MCP_BASE_URL ?? "https://api.x.ai/v1").replace(/\/+$/, "");
  const model = opts.model ?? process.env.GROK_MCP_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).trim();
      const tail = body ? `: ${body.slice(-2000)}` : "";
      throw new GrokApiError(
        `xAI API error ${res.status} ${res.statusText}${tail}`,
        res.status,
        body,
      );
    }

    const raw = await res.text();
    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new GrokApiError(
        `xAI API returned a non-JSON ${res.status} body: ${raw.slice(0, 2000)}`,
        res.status,
        raw,
      );
    }
    const content = data.choices?.[0]?.message?.content ?? "";
    return { stdout: content.trim(), stderr: "", exitCode: 0 };
  } catch (err) {
    if (err instanceof GrokApiError) throw err;
    if (controller.signal.aborted) throw new GrokTimeoutError(timeoutMs);
    throw new GrokApiError(
      `xAI API request failed: ${err instanceof Error ? err.message : String(err)}`,
      0,
      "",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function runGrokCli(
  prompt: string,
  opts: RunGrokOptions = {},
): Promise<RunGrokResult> {
  // Disable agentic behaviour by default: this is a text-completion wrapper,
  // not an interactive coding session. Permission prompts would hang the
  // headless subprocess (stdin is closed).
  const args = ["-p", prompt];
  if (opts.model) args.push("--model", opts.model);
  if (opts.extraArgs) args.push(...opts.extraArgs);

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(GROK_BIN, args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(
          new GrokCliError(
            `grok CLI not found in PATH (looked for "${GROK_BIN}"). Install with: curl -fsSL https://x.ai/cli/install.sh | bash`,
            127,
            "",
          ),
        );
        return;
      }
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const cleanStdout = stripAnsi(stdout).trim();
      const cleanStderr = stripAnsi(stderr).trim();

      if (timedOut) {
        reject(new GrokTimeoutError(timeoutMs, cleanStdout));
        return;
      }

      if (code !== 0) {
        const tail = cleanStderr.slice(-2000);
        reject(
          new GrokCliError(
            `grok CLI exited with code ${code}${tail ? `: ${tail}` : ""}`,
            code ?? -1,
            cleanStderr,
          ),
        );
        return;
      }

      resolve({
        stdout: cleanStdout,
        stderr: cleanStderr,
        exitCode: code ?? 0,
      });
    });
  });
}

export async function checkGrokAvailable(): Promise<{ ok: true; version: string } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    const child = spawn(GROK_BIN, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (c: Buffer) => (out += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (out += c.toString("utf8")));
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve({
          ok: false,
          reason: `grok CLI not found in PATH (looked for "${GROK_BIN}"). Install with: curl -fsSL https://x.ai/cli/install.sh | bash`,
        });
      } else {
        resolve({ ok: false, reason: err.message });
      }
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, version: stripAnsi(out).trim() });
      } else {
        resolve({ ok: false, reason: `grok --version exited with code ${code}` });
      }
    });
  });
}

/** Backend-aware startup probe used by the MCP server to log which path is active. */
export async function checkBackend(): Promise<{ ok: boolean; backend: GrokBackend; detail: string }> {
  const backend = resolveBackend();
  if (backend === "api") {
    if (!process.env.XAI_API_KEY) {
      return {
        ok: false,
        backend,
        detail:
          "GROK_MCP_BACKEND=api but XAI_API_KEY is not set. Get a key at https://console.x.ai.",
      };
    }
    const baseUrl = (process.env.GROK_MCP_BASE_URL ?? "https://api.x.ai/v1").replace(/\/+$/, "");
    const model = process.env.GROK_MCP_MODEL ?? DEFAULT_MODEL;
    return { ok: true, backend, detail: `xAI API — model ${model}, base ${baseUrl}` };
  }
  const probe = await checkGrokAvailable();
  return probe.ok
    ? { ok: true, backend, detail: `grok CLI ${probe.version}` }
    : { ok: false, backend, detail: probe.reason };
}
