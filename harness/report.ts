// Rebuilds docs/results.md from the committed traces. No number is typed by hand.
// Usage: npm run report
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

interface Step { type?: 'step'; step: number; action: string; target: string; result: string; tokens: number }
interface Http { type: 'http'; method: string; path: string; status: number }
/** `events` is the trace in file order: steps and, from v1 on, API responses. */
interface Result { file: string; saidDone: boolean; reallyBooked: boolean; steps: Step[]; events: (Step | Http)[] }

const HEADER = [
  '| Version | Runs | Said done | Really booked | False successes | Median steps | Median tokens |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
const falseSuccess = (r: Result) => r.saidDone && !r.reallyBooked;

/** Reads every run of a version: a .json file (v0) or the lines of a .jsonl file (v1 and later). */
async function load(dir: string): Promise<Result[]> {
  const results: Result[] = [];
  for (const file of (await readdir(`traces/${dir}`)).sort()) {
    const text = await readFile(`traces/${dir}/${file}`, 'utf8');
    if (file.endsWith('.json')) {
      const run = JSON.parse(text) as Result;
      results.push({ ...run, file, events: run.steps });
    } else {
      const lines = text.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
      const result = lines.find((line) => line['type'] === 'result');
      if (!result) continue; // interrupted run
      const events = lines.filter((line) => line['type'] === 'step' || line['type'] === 'http') as unknown as (Step | Http)[];
      const steps = events.filter((e): e is Step => e.type === 'step');
      results.push({ file, saidDone: result['saidDone'] === true, reallyBooked: result['reallyBooked'] === true, steps, events });
    }
  }
  return results;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Medians are over all the runs of the version: steps taken, and tokens used by all its model calls. */
function row(label: string, results: Result[]): string {
  const count = (test: (r: Result) => boolean) => results.filter(test).length;
  const steps = median(results.map((r) => r.steps.length));
  const tokens = median(results.map((r) => r.steps.reduce((sum, s) => sum + s.tokens, 0)));
  return `| ${label} | ${results.length} | ${count((r) => r.saidDone)} | ${count((r) => r.reallyBooked)} | ${count(falseSuccess)} | ${steps} | ${tokens} |`;
}

/** For each run that did not end with an accepted "done": every login and booking answer, every "Book" click and every "done". */
function quoteUnfinished(dir: string, results: Result[]): string[] {
  return results.filter((r) => !r.saidDone).map((r) => {
    const quoted = r.events.flatMap((e) => {
      if (e.type === 'http') return e.method === 'POST' ? [`${e.method} ${e.path} ${e.status}`] : [];
      if (e.action === 'done') return [`${e.step}. done -> ${e.result}`];
      return e.target.includes('button "Book"') ? [`${e.step}. ${e.action} ${e.target.replace(/^- /, '')}`] : [];
    });
    return `- \`traces/${dir}/${r.file}\` (${r.steps.length} steps): \`${quoted.join('` → `')}\``;
  });
}

/** For each false success: what the agent did from its first click on "Book" until it said done. */
function quoteFalseSuccesses(dir: string, results: Result[]): string[] {
  return results.filter(falseSuccess).map((r) => {
    const firstBook = r.steps.findIndex((s) => s.target.includes('button "Book"'));
    const tail = r.steps.slice(firstBook).map((s) => `${s.step}. ${s.action} ${s.target.replace(/^- /, '')}`.trim());
    return `- \`traces/${dir}/${r.file}\`: \`${tail.join('` → `')}\``;
  });
}

const versions = (await readdir('traces')).filter((dir) => /^v\d$/.test(dir)).sort();
const byVersion = new Map<string, Result[]>();
for (const v of versions) byVersion.set(v, await load(v));
const v0 = byVersion.get('v0') ?? [];
const v2 = byVersion.get('v2') ?? [];

const table = [
  '# Results',
  '',
  'Task: "Book the Tuesday 14:00 slot for Alice." Generated from `traces/` by `npm run report`.',
  '',
  'Every run has deliberate fault injection on: the first `POST /api/book` answers 503',
  '(see [app/FRICTION.md](../app/FRICTION.md)).',
  '',
  ...HEADER,
  ...versions.map((v) => row(v, byVersion.get(v) ?? [])),
  '',
  `Notes: in the ${v0.filter(falseSuccess).length} false successes of v0, the last thing the agent did before declaring done was to reopen`,
  'the still-free Tuesday 14:00 slot (twice also retyping the name), with no successful booking behind it.',
  'Runs 05 and 08 clicked "Book" once (the injected 503). Run 06 clicked it twice (the 503, then an empty',
  'name). Run 07 never logged in and clicked it three times (the 503, then two refusals for not being',
  'logged in). Trace lines from the first click on "Book" to the end:',
  '',
  ...quoteFalseSuccesses('v0', v0),
  '',
  'The rejection reasons given for runs 06 and 07 are inferred from the API code (`api/server.ts`):',
  'v0 traces did not record HTTP statuses. From v1 on, every API response is recorded in the trace.',
  '',
  `Notes on v2: the ${v2.filter((r) => !r.saidDone).length} runs that did not end with "done" (02 and 09) hit the step limit because the agent never`,
  'logged in. After the injected 503, every booking was answered 401, while the app still showed its',
  '"Booked!" message (the optimistic toast, see [app/FRICTION.md](../app/FRICTION.md)), and the agent',
  'retried the same action until the limit. (Traces do not record what the page showed: the message is',
  'known from the app code, and the traces show the agent clicking its "Dismiss" button.)',
  'Run 02 never sent a login request and never said done.',
  'Run 09 sent one login request with an empty password (401) and said done once: the refusal said what',
  'was missing, not why, and the agent went on as before. Trace lines (every `POST` answer, every click',
  'on "Book" and every "done"; an API answer is written just before the step that caused it):',
  '',
  ...quoteUnfinished('v2', v2),
  '',
  '## v0 without fault injection',
  '',
  'The first measurement, before the fault was added (full ARIA snapshot, traces in `traces/v0-no-fault/`).',
  'The agent logged in first and the booking simply worked.',
  '',
  ...HEADER,
  row('v0', await load('v0-no-fault')),
  '',
].join('\n');

await mkdir('docs', { recursive: true });
await writeFile('docs/results.md', table);
console.log(table);
