// Part 5, the loop: snapshot of the page -> the model picks one action -> repeat until "done".
// The loop itself is the same in every version. What changes is what the harness plugs into it:
// a step limit (4-guardrails.ts), a trace of every step (onStep) and an outcome check (6-verify.ts).
import type { Page } from 'playwright';
import { TOOLS, act } from './1-tools.ts';
import { ask } from './2-model.ts';
import { buildMessages, snapshot, targetLine, type Step } from './3-context.ts';
import { tooManyRefusals, withinStepLimit, type Guardrails } from './4-guardrails.ts';

export interface Outcome { saidDone: boolean; summary: string; steps: Step[]; refusals: number }
export interface Harness extends Guardrails {
  onStep?: (step: Step) => void;
  /** Returns null when the task is really done, or a short factual message when it is not. */
  checkOutcome?: () => Promise<string | null>;
}

export async function runAgent(page: Page, system: string, task: string, harness: Harness): Promise<Outcome> {
  const steps: Step[] = [];
  let refusals = 0;

  for (let n = 1; withinStepLimit(n, harness); n++) {
    const current = await snapshot(page);
    const reply = await ask(buildMessages(system, task, steps, current), TOOLS);
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
    record(await act(page, name, args));
  }
  return { saidDone: false, summary: '', steps, refusals };
}
