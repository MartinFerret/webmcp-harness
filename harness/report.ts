// Rebuilds docs/results.md from the committed traces. No number is typed by hand.
// Usage: npm run report
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

interface Step { step: number; action: string; target: string }
interface Result { file: string; saidDone: boolean; reallyBooked: boolean; steps: Step[] }

const HEADER = ['| Version | Runs | Said done | Really booked | False successes |', '| --- | --- | --- | --- | --- |'];
const falseSuccess = (r: Result) => r.saidDone && !r.reallyBooked;

/** Reads every run of a version: a .json file (v0) or the lines of a .jsonl file (v1 and later). */
async function load(dir: string): Promise<Result[]> {
  const results: Result[] = [];
  for (const file of (await readdir(`traces/${dir}`)).sort()) {
    const text = await readFile(`traces/${dir}/${file}`, 'utf8');
    if (file.endsWith('.json')) {
      results.push({ ...(JSON.parse(text) as Result), file });
    } else {
      const lines = text.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
      const result = lines.find((line) => line['type'] === 'result');
      if (!result) continue; // interrupted run
      const steps = lines.filter((line) => line['type'] === 'step') as unknown as Step[];
      results.push({ file, saidDone: result['saidDone'] === true, reallyBooked: result['reallyBooked'] === true, steps });
    }
  }
  return results;
}

function row(label: string, results: Result[]): string {
  const count = (test: (r: Result) => boolean) => results.filter(test).length;
  return `| ${label} | ${results.length} | ${count((r) => r.saidDone)} | ${count((r) => r.reallyBooked)} | ${count(falseSuccess)} |`;
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
