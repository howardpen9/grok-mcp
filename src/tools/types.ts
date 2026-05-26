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
