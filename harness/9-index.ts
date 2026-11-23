// Part 9, the command line: picks a version, runs it N times, prints one line per run.
// Usage: npm run agent -- <version> <runs> [--out <dir>]
//   npm run agent -- v1 10                  traces go to a fresh folder under runs/ (gitignored)
//   npm run agent -- v1 10 --out traces/v1  a measured batch: complete runs in that folder are
//                                           skipped, so the same command resumes it
// Build the results table from traces/ with: npm run report
import { runHarness } from './8-harness.ts';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt === -1 ? undefined : args.splice(outAt, 2)[1];
if (outAt !== -1 && !out) throw new Error('--out needs a folder, e.g. --out traces/v1');

const version = args[0] ?? 'v0';
const runs = Number(args[1] ?? 1);
// Without --out, a run can never skip or overwrite the committed traces.
const dir = out ?? `runs/${new Date().toISOString().replace(/[:.]/g, '-')}-${version}`;

console.log(`Traces: ${dir}`);
await runHarness(version, runs, dir, (r) => {
  console.log(`${version} run ${r.run}: steps=${r.steps} saidDone=${r.saidDone} reallyBooked=${r.reallyBooked} refusals=${r.refusals} "${r.summary}"`);
});
process.exit(0);
