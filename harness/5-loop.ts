// Part 5, the loop: snapshot of the page -> the model picks one action -> repeat until "done".
// The loop itself is the same in every version. What changes is what the harness plugs into it:
// a step limit (4-guardrails.ts), a trace of every step (onStep), an outcome check (6-verify.ts)
// and the tools the page itself exposes (7-webmcp.ts).
import type { Page } from 'playwright';
import { TOOLS, act } from './1-tools.ts';
import { ask } from './2-model.ts';
import { buildMessages, snapshot, targetLine, type Step } from './3-context.ts';
import { tooManyRefusals, withinStepLimit, type Guardrails } from './4-guardrails.ts';
import { callPageTool, listPageTools } from './7-webmcp.ts';

export interface Outcome { saidDone: boolean; summary: string; steps: Step[]; refusals: number }
export interface Harness extends Guardrails {
  onStep?: (step: Step) => void;
  /** Returns null when the task is really done, or a short factual message when it is not. */
  checkOutcome?: () => Promise<string | null>;
  /** Offer the page's WebMCP tools to the model, next to click, type and done. */
  pageTools?: boolean;
}

export async function runAgent(page: Page, system: string, task: string, harness: Harness): Promise<Outcome> {
  const steps: Step[] = [];
  let refusals = 0;

  for (let n = 1; withinStepLimit(n, harness); n++) {
    const current = await snapshot(page);
    const pageTools = harness.pageTools ? await listPageTools(page) : [];
    const reply = await ask(buildMessages(system, task, steps, current), [...TOOLS, ...pageTools]);
    const { name, args } = reply.call ?? { name: 'none', args: {} };
    const target = targetLine(current, args['ref']);
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
      if (tooManyRefusals(refusals)) {
        record(`refused: ${problem}. Run ended: too many refusals.`);
        break;
      }
      refusals++;
      record(`refused: ${problem}`);
      continue;
    }
    const isPageTool = pageTools.some((t) => t.function.name === name);
    record(isPageTool ? await callPageTool(page, name, args) : await act(page, name, args));
  }
  return { saidDone: false, summary: '', steps, refusals };
}
