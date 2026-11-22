// Rebuilds docs/results.md from the committed traces. No number is typed by hand.
// Usage: npm run report
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

interface Result { saidDone: boolean; reallyBooked: boolean }

const rows: string[] = [];
for (const version of (await readdir('traces')).sort()) {
  const results: Result[] = [];
  for (const file of (await readdir(`traces/${version}`)).sort()) {
    results.push(JSON.parse(await readFile(`traces/${version}/${file}`, 'utf8')) as Result);
  }
  const count = (test: (r: Result) => boolean) => results.filter(test).length;
  rows.push(
    `| ${version} | ${results.length} | ${count((r) => r.saidDone)} | ${count((r) => r.reallyBooked)} | ${count((r) => r.saidDone && !r.reallyBooked)} |`,
  );
}

const table = [
  '# Results',
  '',
  'Task: "Book the Tuesday 14:00 slot for Alice." Generated from `traces/` by `npm run report`.',
  '',
  '| Version | Runs | Said done | Really booked | False successes |',
  '| --- | --- | --- | --- | --- |',
  ...rows,
  '',
].join('\n');

await mkdir('docs', { recursive: true });
await writeFile('docs/results.md', table);
console.log(table);
