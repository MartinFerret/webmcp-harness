// Part 1, tools: what the model is allowed to do, and how each action is carried out in the browser.
// The three definitions below are sent to the model unchanged in every version.
// Element references (aria-ref=e12): https://playwright.dev/docs/aria-snapshots
import type OpenAI from 'openai';
import type { Page } from 'playwright';

export type Tool = OpenAI.Chat.Completions.ChatCompletionFunctionTool;

const tool = (name: string, description: string, props: Record<string, string>): Tool => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(Object.entries(props).map(([k, d]) => [k, { type: 'string', description: d }])),
      required: Object.keys(props),
    },
  },
});

export const TOOLS: Tool[] = [
  tool('click', 'Click an element of the page.', { ref: 'Element reference, e.g. e12' }),
  tool('type', 'Replace the content of a text field.', { ref: 'Element reference, e.g. e12', text: 'Text to type' }),
  tool('done', 'Declare the task finished.', { summary: 'One sentence about what was done' }),
];

/** Executes one browser action and reports what happened in a few words. */
export async function act(page: Page, name: string, args: Record<string, unknown>): Promise<string> {
  const target = page.locator(`aria-ref=${String(args['ref'])}`);
  try {
    if (name === 'click') await target.click({ timeout: 2000 });
    else if (name === 'type') await target.fill(String(args['text'] ?? ''), { timeout: 2000 });
    else return 'error: no valid tool call';
    await page.waitForTimeout(400); // let the page settle
    return 'ok';
  } catch (error) {
    return `error: ${String(error).split('\n')[0]}`;
  }
}
