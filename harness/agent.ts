// The agent loop: ARIA snapshot of the page -> the model picks one action -> repeat until "done".
// v0: the naive loop, with a safety cap of 30 steps.
// v1: a real step limit, and every step is handed to onStep so it can be traced as it happens.
// v2: when the agent says done, the harness checks the outcome first and may refuse.
// Snapshot docs: https://playwright.dev/docs/aria-snapshots
import type { Page } from 'playwright';
import { ask, type Tool } from './model.ts';

export interface Step { step: number; action: string; args: Record<string, unknown>; target: string; result: string; tokens: number }
export interface Outcome { saidDone: boolean; summary: string; steps: Step[]; refusals: number }
export interface Harness {
  maxSteps: number;
  onStep?: (step: Step) => void;
  /** Returns null when the task is really done, or a short factual message when it is not. */
  checkOutcome?: () => Promise<string | null>;
}

const MAX_REFUSALS = 3;

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

const TOOLS: Tool[] = [
  tool('click', 'Click an element of the page.', { ref: 'Element reference, e.g. e12' }),
  tool('type', 'Replace the content of a text field.', { ref: 'Element reference, e.g. e12', text: 'Text to type' }),
  tool('done', 'Declare the task finished.', { summary: 'One sentence about what was done' }),
];

export async function runAgent(page: Page, system: string, task: string, harness: Harness): Promise<Outcome> {
  const steps: Step[] = [];
  let refusals = 0;

  for (let n = 1; n <= harness.maxSteps; n++) {
    const snapshot = trim(await page.ariaSnapshot({ mode: 'ai' }));
    const history = steps.map((s) => `${s.step}. ${s.action} ${JSON.stringify(s.args)} -> ${s.result}`).join('\n');
    const user = `Task: ${task}\n\nActions so far:\n${history || '(none)'}\n\nCurrent page:\n${snapshot}`;

    const reply = await ask([{ role: 'system', content: system }, { role: 'user', content: user }], TOOLS);
    const { name, args } = reply.call ?? { name: 'none', args: {} };
    // The snapshot line the model pointed at, kept only to make traces readable.
    const target = snapshot.split('\n').find((line) => line.includes(`[ref=${String(args['ref'])}]`))?.trim() ?? '';
    const record = (result: string) => {
      const step: Step = { step: n, action: name, args, target, result, tokens: reply.tokens };
      steps.push(step);
      harness.onStep?.(step);
    };

    if (name === 'done') {
      const problem = (await harness.checkOutcome?.()) ?? null;
      if (problem === null) {
        record('stopped');
        return { saidDone: true, summary: String(args['summary'] ?? ''), steps, refusals };
      }
      if (refusals === MAX_REFUSALS) {
        record(`refused: ${problem}. Run ended: too many refusals.`);
        break;
      }
      refusals++;
      record(`refused: ${problem}`);
      continue;
    }
    record(await act(page, name, args));
  }
  return { saidDone: false, summary: '', steps, refusals };
}

/** Fewer tokens per step: keeps roles, names and states, drops link URLs, cursor hints and refs nobody can act on. */
export function trim(snapshot: string): string {
  return snapshot
    .split('\n')
    .filter((line) => !line.trim().startsWith('- /url:'))
    .map((line) => line.replace(' [cursor=pointer]', ''))
    .map((line) => (/- (button|link|textbox) /.test(line) ? line : line.replace(/ \[ref=e\d+\]/, '')))
    .join('\n');
}

/** Executes one browser action and reports what happened in a few words. */
async function act(page: Page, name: string, args: Record<string, unknown>): Promise<string> {
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
