import { z } from "zod";
import { runGrok } from "../grok.js";
import { defineTool } from "./types.js";

const inputSchema = z.object({
  code: z.string().min(1).describe("The code or design to attack."),
  context: z
    .string()
    .optional()
    .describe("Optional context: language, framework, intended behaviour, constraints."),
  model: z.string().optional(),
});

const CHALLENGE_TEMPLATE = (code: string, context?: string) => `You are a hostile senior engineer tasked with breaking this code. Be specific and ruthless — vague concerns are useless.

${context ? `Context: ${context}\n` : ""}For each issue you find, output:
- Severity (Critical / High / Medium / Low)
- Concrete reproduction (input, sequence of events, environment)
- Why the current code fails
- Smallest patch that would fix it

Cover at minimum:
- Edge cases (empty, null, very large, very small, unicode, malformed)
- Concurrency / race conditions / re-entrancy
- Error paths and partial failure
- Security: injection, auth bypass, information leak, resource exhaustion
- Backward / forward compatibility
- Adversarial inputs designed to break invariants

If you genuinely find nothing to break, say so explicitly and list the invariants you verified.

--- CODE START ---
${code}
--- CODE END ---`;

export const grokChallenge = defineTool({
  name: "grok_challenge",
  description:
    "Ask Grok to adversarially break a piece of code: edge cases, race conditions, security holes, adversarial inputs. Returns severity-ranked issues with reproductions.",
  inputSchema,
  async handler({ code, context, model }) {
    const { stdout } = await runGrok(CHALLENGE_TEMPLATE(code, context), { model });
    return stdout;
  },
});
