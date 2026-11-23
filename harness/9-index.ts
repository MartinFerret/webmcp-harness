// Part 9, the command line: picks a version, runs it N times, prints one line per run.
// Usage: npm run agent -- v1 10
// Traces go to traces/<version>/. Build the results table from them with: npm run report
import { runHarness } from './8-harness.ts';

const version = process.argv[2] ?? 'v0';
const runs = Number(process.argv[3] ?? 1);

await runHarness(version, runs, `traces/${version}`, (r) => {
  console.log(`${version} run ${r.run}: steps=${r.steps} saidDone=${r.saidDone} reallyBooked=${r.reallyBooked} refusals=${r.refusals} "${r.summary}"`);
});
process.exit(0);
