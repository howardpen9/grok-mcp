import { z } from "zod";
import { runGrok } from "../grok.js";
import { defineTool } from "./types.js";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const inputSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1)
    .describe("Conversation history. Caller maintains state across turns."),
  model: z.string().optional(),
});

function flattenMessages(messages: Array<z.infer<typeof messageSchema>>): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      parts.push(`[SYSTEM]\n${m.content}\n`);
    } else if (m.role === "user") {
      parts.push(`[USER]\n${m.content}\n`);
    } else {
      parts.push(`[ASSISTANT]\n${m.content}\n`);
    }
  }
  parts.push("[ASSISTANT]\n");
  return parts.join("\n");
}

export const grokConsult = defineTool({
  name: "grok_consult",
  description:
    "Continue a conversation with Grok by replaying the full message history each call. Stateless on the server side — the caller owns the thread.",
  inputSchema,
  async handler({ messages, model }) {
    const prompt = flattenMessages(messages);
    const { stdout } = await runGrok(prompt, { model });
    return stdout;
  },
});
