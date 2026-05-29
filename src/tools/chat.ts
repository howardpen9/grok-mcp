import { z } from "zod";
import { runGrok } from "../grok.js";
import { defineTool, timeoutField, timeoutOpts } from "./types.js";

const inputSchema = z.object({
  prompt: z.string().min(1).describe("The prompt to send to Grok."),
  model: z.string().optional().describe("Override default Grok model (e.g. 'grok-4')."),
  timeout: timeoutField,
});

export const grokChat = defineTool({
  name: "grok_chat",
  description:
    "Send a one-shot prompt to xAI Grok and return its reply. Stateless — for multi-turn use grok_consult.",
  inputSchema,
  async handler({ prompt, model, timeout }) {
    const { stdout } = await runGrok(prompt, { model, ...timeoutOpts(timeout) });
    return stdout;
  },
});
