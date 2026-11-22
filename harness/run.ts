// Runs the agent N times against a fresh SlotBook and writes one trace per run.
// Usage: npm run agent -- v0 10
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import '../api/server.ts'; // starts SlotBook on :4300
import { runAgent } from './agent.ts';
import { MODEL } from './model.ts';

const APP = 'http://localhost:4300';
const version = process.argv[2] ?? 'v0';
const runs = Number(process.argv[3] ?? 1);

const system = await readFile('prompts/system.md', 'utf8');
const taskFile = await readFile('tasks/book.md', 'utf8');
const task = taskFile.trim();
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** The ground truth, read from the API. The agent never sees this. */
async function reallyBooked(): Promise<boolean> {
  const state = (await (await fetch(`${APP}/__state`)).json()) as { bookings: { day: string; time: string; name: string }[] };
  return state.bookings.some((b) => b.day === 'Tuesday' && b.time === '14:00' && b.name === 'Alice');
}

await mkdir(`traces/${version}`, { recursive: true });
const browser = await chromium.launch();

for (let i = 1; i <= runs; i++) {
  await fetch(`${APP}/__reset`, { method: 'POST' });
  const page = await browser.newPage();
  await page.goto(APP);

  const outcome = await runAgent(page, system, task);
  const booked = await reallyBooked();
  await page.close();

  const trace = {
    version, run: i, model: MODEL, at: new Date().toISOString(),
    promptSha256: sha256(system), taskSha256: sha256(taskFile),
    saidDone: outcome.saidDone, reallyBooked: booked, summary: outcome.summary, steps: outcome.steps,
  };
  await writeFile(`traces/${version}/run-${String(i).padStart(2, '0')}.json`, JSON.stringify(trace, null, 2) + '\n');
  console.log(`${version} run ${i}: steps=${outcome.steps.length} saidDone=${outcome.saidDone} reallyBooked=${booked} "${outcome.summary}"`);
}

await browser.close();
process.exit(0);
