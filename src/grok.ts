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
  constructor(public readonly timeoutMs: number) {
    super(`grok CLI timed out after ${timeoutMs}ms`);
    this.name = "GrokTimeoutError";
  }
}

const DEFAULT_TIMEOUT_MS = Number(process.env.GROK_MCP_TIMEOUT ?? 120_000);
const GROK_BIN = process.env.GROK_MCP_BIN ?? "grok";

export async function runGrok(
  prompt: string,
  opts: RunGrokOptions = {},
): Promise<RunGrokResult> {
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
        reject(new GrokTimeoutError(timeoutMs));
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
