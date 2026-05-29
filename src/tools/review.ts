import { spawn } from "node:child_process";
import { z } from "zod";
import { runGrok } from "../grok.js";
import { defineTool, timeoutField, timeoutOpts } from "./types.js";

const inputSchema = z.object({
  diff: z.string().optional().describe("Unified diff to review. If omitted, runs `git diff <base_ref>`."),
  base_ref: z
    .string()
    .optional()
    .describe("Git ref to diff against when diff is not provided. Defaults to 'main'."),
  focus: z
    .string()
    .optional()
    .describe("Optional focus area (e.g. 'security', 'performance', 'API design')."),
  model: z.string().optional(),
  cwd: z.string().optional().describe("Working directory for git diff. Defaults to process cwd."),
  timeout: timeoutField,
});

function gitDiff(baseRef: string, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["diff", `${baseRef}...HEAD`], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (c: Buffer) => (out += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (err += c.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`git diff failed: ${err.trim()}`));
      else resolve(out);
    });
  });
}

const REVIEW_TEMPLATE = (diff: string, focus?: string) => `Review the unified diff below as a senior staff engineer. Reason only from the diff text — do not attempt to read files, run commands, or browse the web.

${focus ? `Focus area: ${focus}\n\n` : ""}Score each dimension 1-10:
1. Correctness
2. Readability
3. Architecture
4. Security
5. Performance

Respond in markdown with:
- One-line verdict (LGTM / Approve with comments / Request changes / Block)
- Per-dimension score with a one-line justification
- A short list of the most important concerns visible in the diff

--- DIFF START ---
${diff}
--- DIFF END ---`;

export const grokReview = defineTool({
  name: "grok_review",
  description:
    "Have Grok review a git diff. If no diff is provided, runs `git diff <base_ref>...HEAD` (default base: main). Returns a structured review with per-dimension scores.",
  inputSchema,
  async handler({ diff, base_ref, focus, model, cwd, timeout }) {
    const actualDiff = diff ?? (await gitDiff(base_ref ?? "main", cwd));
    if (!actualDiff.trim()) {
      return "No diff to review (empty result from git diff).";
    }
    const { stdout } = await runGrok(REVIEW_TEMPLATE(actualDiff, focus), {
      model,
      ...timeoutOpts(timeout),
    });
    return stdout;
  },
});
