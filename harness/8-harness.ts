// Part 8, the harness: owns the whole run. It starts SlotBook, opens the browser, resets the app
// before each run, plugs the parts each version uses into the loop, records everything, and closes.
// One JSONL trace per run: a "start" line, one line per step and per API response (written as they
// happen), then a "result" line. Runs whose trace is already complete are skipped, so a batch can
// be resumed later.
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import '../api/server.ts'; // starts SlotBook on :4300
import { MODEL } from './2-model.ts';
import { runAgent } from './5-loop.ts';
import { checkOutcome, reallyBooked } from './6-verify.ts';

// Deliberate fault injection, on by default for every version (see app/FRICTION.md).
process.env['FAULT_FIRST_BOOK'] ??= '503';

/** What each version of the harness adds. Prompt, task and model never change. */
export const VERSIONS: Record<string, { maxSteps: number; checkOutcome?: boolean }> = {
  v0: { maxSteps: 30 }, // naive loop, safety cap only
  v1: { maxSteps: 20 }, // step limit + JSONL traces
  v2: { maxSteps: 20, checkOutcome: true }, // "done" is only accepted if the booking really exists
};

const APP = 'http://localhost:4300';
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export interface RunResult { run: number; saidDone: boolean; reallyBooked: boolean; summary: string; refusals: number; steps: number; tokens: number }

/** Runs one version `runs` times, one trace file per run in `dir`. */
export async function runHarness(version: string, runs: number, dir: string, onResult: (result: RunResult) => void): Promise<void> {
  const config = VERSIONS[version];
  if (!config) throw new Error(`Unknown version "${version}". Known: ${Object.keys(VERSIONS).join(', ')}`);

  const system = await readFile('prompts/system.md', 'utf8');
  const taskFile = await readFile('tasks/book.md', 'utf8');

  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch();

  for (let i = 1; i <= runs; i++) {
    const file = `${dir}/run-${String(i).padStart(2, '0')}.jsonl`;
    if (existsSync(file) && readFileSync(file, 'utf8').includes('"type":"result"')) continue;
    rmSync(file, { force: true }); // an interrupted run starts over
    const log = (line: object) => appendFileSync(file, JSON.stringify(line) + '\n');

    await fetch(`${APP}/__reset`, { method: 'POST' });
    const page = await browser.newPage();
    // Observation only: every API response goes to the trace, never to the agent.
    // https://playwright.dev/docs/api/class-page#page-event-response
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (!path.startsWith('/api/')) return;
      log({ type: 'http', method: response.request().method(), path, status: response.status(), at: new Date().toISOString() });
    });
    await page.goto(APP);
    log({
      type: 'start', version, run: i, model: MODEL, at: new Date().toISOString(),
      maxSteps: config.maxSteps, faultFirstBook: process.env['FAULT_FIRST_BOOK'],
      promptSha256: sha256(system), taskSha256: sha256(taskFile),
    });

    const outcome = await runAgent(page, system, taskFile.trim(), {
      maxSteps: config.maxSteps,
      onStep: (step) => log({ type: 'step', ...step }),
      ...(config.checkOutcome && { checkOutcome: () => checkOutcome(APP) }),
    });
    const result = {
      type: 'result', saidDone: outcome.saidDone, reallyBooked: await reallyBooked(APP), summary: outcome.summary,
      refusals: outcome.refusals,
      steps: outcome.steps.length, tokens: outcome.steps.reduce((sum, s) => sum + s.tokens, 0),
    };
    log(result);
    await page.close();
    onResult({ run: i, ...result });
  }

  await browser.close();
}
