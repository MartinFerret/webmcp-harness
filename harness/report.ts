// Rebuilds docs/results.md from the committed traces. No number is typed by hand.
// Usage: npm run report
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

interface Result { saidDone: boolean; reallyBooked: boolean }

const HEADER = ['| Version | Runs | Said done | Really booked | False successes |', '| --- | --- | --- | --- | --- |'];

async function row(dir: string, label: string): Promise<string> {
  const results: Result[] = [];
  for (const file of (await readdir(`traces/${dir}`)).sort()) {
    results.push(JSON.parse(await readFile(`traces/${dir}/${file}`, 'utf8')) as Result);
  }
  const count = (test: (r: Result) => boolean) => results.filter(test).length;
  return `| ${label} | ${results.length} | ${count((r) => r.saidDone)} | ${count((r) => r.reallyBooked)} | ${count((r) => r.saidDone && !r.reallyBooked)} |`;
}

const versions = (await readdir('traces')).filter((dir) => /^v\d$/.test(dir)).sort();

const table = [
  '# Results',
  '',
  'Task: "Book the Tuesday 14:00 slot for Alice." Generated from `traces/` by `npm run report`.',
  '',
  'Every run has deliberate fault injection on: the first `POST /api/book` answers 503',
  '(see [app/FRICTION.md](../app/FRICTION.md)).',
  '',
  ...HEADER,
  ...(await Promise.all(versions.map((v) => row(v, v)))),
  '',
  '## v0 without fault injection',
  '',
  'The first measurement, before the fault was added (full ARIA snapshot, traces in `traces/v0-no-fault/`).',
  'The agent logged in first and the booking simply worked.',
  '',
  ...HEADER,
  await row('v0-no-fault', 'v0'),
  '',
].join('\n');

await mkdir('docs', { recursive: true });
await writeFile('docs/results.md', table);
console.log(table);
