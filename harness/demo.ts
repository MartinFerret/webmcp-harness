// Live demo: one run in a visible, slowed-down browser, with every step printed as it happens.
// Usage: npm run demo -- v0     (or v1, v2, v3)
// Same harness, same prompt, same task, same fault injection as the measured runs. The trace goes
// to a fresh folder under runs/ (gitignored), never to traces/. Not a harness part.
// Launch options (headless, slowMo): https://playwright.dev/docs/api/class-browsertype#browser-type-launch
import { readFileSync } from 'node:fs';
import { runHarness } from './8-harness.ts';

const version = process.argv[2] ?? 'v0';
const dir = `runs/${new Date().toISOString().replace(/[:.]/g, '-')}-demo-${version}`;

/** One trace line, as one line of terminal output. */
function print(line: Record<string, unknown>): void {
  if (line['type'] === 'start') {
    console.log(`\n${version} · ${String(line['model'])} · step limit ${String(line['maxSteps'])} · first booking answers ${String(line['faultFirstBook'])}`);
    console.log(`Task: ${readFileSync('tasks/book.md', 'utf8').trim()}\n`);
  } else if (line['type'] === 'http' && line['method'] === 'POST') {
    console.log(`        API  ${String(line['method'])} ${String(line['path'])} -> ${String(line['status'])}`);
  } else if (line['type'] === 'step') {
    const args = line['args'] as Record<string, unknown>;
    const target = String(line['target']).replace(/^- /, '').replace(/ \[ref=e\d+\].*$/, '');
    const what = args['text'] !== undefined ? `${target} "${String(args['text'])}"` : target || JSON.stringify(args);
    console.log(`${String(line['step']).padStart(4)}.  ${String(line['action']).padEnd(8)} ${what}  ->  ${String(line['result'])}`);
  }
}

await runHarness(version, 1, dir, (r) => {
  console.log(`\nAgent says done:  ${r.saidDone ? `yes, "${r.summary}"` : 'no'}`);
  console.log(`Really booked:    ${r.reallyBooked ? 'yes' : 'NO'}`);
  if (r.refusals) console.log(`"Done" refused:   ${r.refusals}x`);
  console.log(`${r.steps} steps, ${r.tokens} tokens. Trace: ${dir}/run-01.jsonl\n`);
}, { launch: { headless: false, slowMo: 400 }, onLine: print, lingerMs: 4000 });
process.exit(0);
