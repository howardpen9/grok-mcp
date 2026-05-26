import { spawn } from "node:child_process";
import { z } from "zod";
import { runGrok } from "../grok.js";
import { defineTool } from "./types.js";

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

const REVIEW_TEMPLATE = (diff: string, focus?: string) => `You are a senior staff engineer doing a rigorous code review.

${focus ? `Focus area: ${focus}\n` : ""}Review the diff below across these dimensions, rating each 1-10:
1. Correctness — does it do what it claims, edge cases handled?
2. Readability — naming, structure, comments
3. Architecture — boundaries, coupling, abstractions
4. Security — input validation, secrets, injection surfaces
5. Performance — algorithmic complexity, IO, allocations

Output format (markdown):
- One-line verdict (LGTM / Approve with comments / Request changes / Block)
- Per-dimension score and one-line reason
- Numbered list of concrete issues with file:line references
- Suggested fixes for any score <= 6

--- DIFF START ---
${diff}
--- DIFF END ---`;

export const grokReview = defineTool({
  name: "grok_review",
  description:
    "Have Grok review a git diff. If no diff is provided, runs `git diff <base_ref>...HEAD` (default base: main). Returns a structured review with per-dimension scores.",
  inputSchema,
  async handler({ diff, base_ref, focus, model, cwd }) {
    const actualDiff = diff ?? (await gitDiff(base_ref ?? "main", cwd));
    if (!actualDiff.trim()) {
      return "No diff to review (empty result from git diff).";
    }
    const { stdout } = await runGrok(REVIEW_TEMPLATE(actualDiff, focus), { model });
    return stdout;
  },
});
