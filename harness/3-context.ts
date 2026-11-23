// Part 3, context: what the model sees on each turn. The harness keeps no conversation:
// every turn is rebuilt from the task, the actions taken so far and a trimmed snapshot of the page.
// Snapshot docs: https://playwright.dev/docs/aria-snapshots
import type { Page } from 'playwright';
import type { Message } from './2-model.ts';

/** One action the agent took, and what came of it. */
export interface Step { step: number; action: string; args: Record<string, unknown>; target: string; result: string; tokens: number }

/** The current page as an ARIA tree, where actionable elements carry a reference such as [ref=e12]. */
export async function snapshot(page: Page): Promise<string> {
  return trim(await page.ariaSnapshot({ mode: 'ai' }));
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

/** The two messages of one turn: the frozen system prompt, then task + history + page. */
export function buildMessages(system: string, task: string, steps: Step[], snapshot: string): Message[] {
  const history = steps.map((s) => `${s.step}. ${s.action} ${JSON.stringify(s.args)} -> ${s.result}`).join('\n');
  const user = `Task: ${task}\n\nActions so far:\n${history || '(none)'}\n\nCurrent page:\n${snapshot}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** The snapshot line the model pointed at, kept only to make traces readable. */
export function targetLine(snapshot: string, ref: unknown): string {
  return snapshot.split('\n').find((line) => line.includes(`[ref=${String(ref)}]`))?.trim() ?? '';
}
