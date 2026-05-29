import { z } from "zod";

export interface ToolDefinition<S extends z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: S;
  handler: (input: z.infer<S>) => Promise<string>;
}

export interface ErasedTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<string>;
}

export function defineTool<S extends z.ZodTypeAny>(def: ToolDefinition<S>): ErasedTool {
  return def as unknown as ErasedTool;
}

/** Shared per-call timeout field (seconds). All tools expose this. */
export const timeoutField = z
  .number()
  .positive()
  .optional()
  .describe("Per-call timeout in seconds. Defaults to 300. Raise for long grok-4 reasoning.");

/** Convert an optional seconds value into the { timeoutMs } shape runGrok expects. */
export function timeoutOpts(timeout?: number): { timeoutMs?: number } {
  return timeout === undefined ? {} : { timeoutMs: Math.round(timeout * 1000) };
}
