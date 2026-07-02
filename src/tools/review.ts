import { spawn } from "node:child_process";
import { z } from "zod";
import { runGrok } from "../grok.js";
import { defineTool, timeoutField, timeoutOpts } from "./types.js";

export const verdictSchema = z.enum([
  "approve",
  "approve_with_comments",
  "request_changes",
  "block",
]);

const severitySchema = z.enum(["critical", "high", "medium", "low"]);

export const reviewJsonSchema = z.object({
  verdict: verdictSchema,
  summary: z.string(),
  scores: z.object({
    correctness: z.number().min(0).max(10),
    readability: z.number().min(0).max(10),
    architecture: z.number().min(0).max(10),
    security: z.number().min(0).max(10),
    performance: z.number().min(0).max(10),
  }),
  blockers: z.array(
    z.object({
      severity: severitySchema,
      title: z.string(),
      file: z.string().optional(),
      line: z.number().int().nonnegative().optional(),
      reason: z.string(),
      fix: z.string().optional(),
    }),
  ),
  notes: z.array(z.string()).default([]),
});

export type ReviewJson = z.infer<typeof reviewJsonSchema>;

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
  format: z
    .enum(["markdown", "json"])
    .optional()
    .describe(
      "Output format. 'markdown' (default) returns a human-readable review. 'json' returns a machine-parseable verdict suitable for CI gating.",
    ),
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

const MARKDOWN_TEMPLATE = (diff: string, focus?: string) => `Review the unified diff below as a senior staff engineer. Reason only from the diff text — do not attempt to read files, run commands, or browse the web.

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

const JSON_TEMPLATE = (diff: string, focus?: string) => `Review the unified diff below as a senior staff engineer. Reason only from the diff text — do not attempt to read files, run commands, or browse the web.

${focus ? `Focus area: ${focus}\n\n` : ""}Respond with ONLY a single JSON object matching exactly this schema. No prose before or after, no markdown fences, no commentary:

{
  "verdict": "approve" | "approve_with_comments" | "request_changes" | "block",
  "summary": "one-or-two sentence overall verdict",
  "scores": {
    "correctness": 0-10,
    "readability": 0-10,
    "architecture": 0-10,
    "security": 0-10,
    "performance": 0-10
  },
  "blockers": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "title": "short label",
      "file": "path/from/diff (optional)",
      "line": 123,
      "reason": "what's wrong and why it matters",
      "fix": "concrete suggested change (optional)"
    }
  ],
  "notes": ["lower-priority observations as short strings"]
}

Verdict rules:
- "block" — at least one critical or high blocker that must be fixed before merge.
- "request_changes" — medium blockers or multiple lows that should be addressed.
- "approve_with_comments" — only minor / stylistic notes.
- "approve" — no concerns.

Be conservative with "block" — only use it for real, concrete issues visible in the diff.

--- DIFF START ---
${diff}
--- DIFF END ---`;

/**
 * Extract the first balanced top-level JSON object from a string.
 * Handles fenced ```json blocks, leading prose, and trailing prose.
 * Returns the JSON substring or null if none found.
 */
function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fenced && fenced[1]?.trim().startsWith("{")) {
    return fenced[1].trim();
  }
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export class ReviewParseError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string,
  ) {
    super(message);
    this.name = "ReviewParseError";
  }
}

export function parseReviewJson(raw: string): ReviewJson {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    throw new ReviewParseError(
      "grok_review JSON mode: no JSON object found in Grok's output.",
      raw,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new ReviewParseError(
      `grok_review JSON mode: JSON.parse failed (${err instanceof Error ? err.message : String(err)}).`,
      raw,
    );
  }
  const result = reviewJsonSchema.safeParse(parsed);
  if (!result.success) {
    throw new ReviewParseError(
      `grok_review JSON mode: schema validation failed:\n${JSON.stringify(result.error.format(), null, 2)}`,
      raw,
    );
  }
  return result.data;
}

/**
 * Shared runner usable from both the MCP tool handler and the grok-review-ci bin.
 * Returns the markdown string or the validated JSON object depending on `format`.
 */
export async function runReview(opts: {
  diff?: string;
  base_ref?: string;
  focus?: string;
  format?: "markdown" | "json";
  model?: string;
  cwd?: string;
  timeout?: number;
}): Promise<{ format: "markdown"; markdown: string } | { format: "json"; json: ReviewJson; raw: string } | { format: "empty" }> {
  if (!opts.diff && process.env.GROK_MCP_REMOTE === "1") {
    throw new Error(
      "grok_review on a remote server requires the `diff` parameter — the server has no access to your local repo, so auto `git diff` is disabled. Pass the diff text explicitly.",
    );
  }
  const actualDiff = opts.diff ?? (await gitDiff(opts.base_ref ?? "main", opts.cwd));
  if (!actualDiff.trim()) return { format: "empty" };

  const format = opts.format ?? "markdown";
  const prompt =
    format === "json"
      ? JSON_TEMPLATE(actualDiff, opts.focus)
      : MARKDOWN_TEMPLATE(actualDiff, opts.focus);

  const { stdout } = await runGrok(prompt, {
    model: opts.model,
    ...timeoutOpts(opts.timeout),
  });

  if (format === "json") {
    return { format: "json", json: parseReviewJson(stdout), raw: stdout };
  }
  return { format: "markdown", markdown: stdout };
}

export const grokReview = defineTool({
  name: "grok_review",
  description:
    "Have Grok review a git diff. If no diff is provided, runs `git diff <base_ref>...HEAD` (default base: main). Returns a per-dimension review. Use format='json' for CI gating (verdict + scores + blockers).",
  inputSchema,
  async handler(input) {
    const result = await runReview(input);
    if (result.format === "empty") return "No diff to review (empty result from git diff).";
    if (result.format === "json") return JSON.stringify(result.json, null, 2);
    return result.markdown;
  },
});
