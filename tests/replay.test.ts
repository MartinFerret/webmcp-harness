// Replays each harness version against the real app in a real browser, with a scripted model.
// The hash of everything the harness sends to the model is compared with a recorded value:
// if the prompt, the task, the tool definitions, the snapshot trim or the message format change,
// these tests fail. They also fail if the app's markup or Playwright's snapshot format changes;
// that is the point: the measurements in traces/ are only comparable while these stay fixed.
// Needs the built app (npm run build:app). Spends no tokens.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DONE, requestsSha256, script, toolsSha256, type Call } from './fake-model.ts';

process.env['FAULT_FIRST_BOOK'] = '503';
const { runHarness } = await import('../harness/8-harness.ts');
type RunResult = import('../harness/8-harness.ts').RunResult;

const LOG_IN: Call = { name: 'click', args: { ref: 'e7' } }; // the "Log in" link of the home page
const NO_SUCH_FIELD: Call = { name: 'type', args: { ref: 'e999', text: 'x' } };
const TOOLS = 'b4a4eab37d9b93665c66273b1a73f0baf7fb2ac4bc60bba3e1fccf5a5eb68571'; // click, type, done

interface Replay { calls: Call[]; requests: string; tools: string; steps: number; saidDone: boolean; refusals: number; traced?: string[] }
const REPLAYS: Record<string, Replay> = {
  // Says done without having booked: v0 and v1 believe it.
  v0: { calls: [LOG_IN, NO_SUCH_FIELD, DONE], requests: '03f65863f5b23448284db3d509a453302c2a0a3f93483555f6797d39ad72d0a8', tools: TOOLS, steps: 3, saidDone: true, refusals: 0 },
  v1: { calls: [LOG_IN, NO_SUCH_FIELD, DONE], requests: '03f65863f5b23448284db3d509a453302c2a0a3f93483555f6797d39ad72d0a8', tools: TOOLS, steps: 3, saidDone: true, refusals: 0 },
  // Keeps saying done: v2 refuses three times, and the fourth false done ends the run as not done.
  v2: { calls: [LOG_IN], requests: 'd8d266b8d443346637519e81d02d6dc235cebf8939a3b028b04e8048f4c6e1d9', tools: TOOLS, steps: 5, saidDone: false, refusals: 3 },
  // Calls the page's bookSlot tool, which hits the injected 503 and says so, then keeps saying done.
  v3: {
    calls: [LOG_IN, { name: 'bookSlot', args: { person: 'Alice', day: 'Tuesday', time: '14:00' } }],
    requests: '865d099e1a8f99ea9101227a21ba6b0c3921923e9e477e3ef35102fc401adc62',
    tools: '630960d85402f4a446bed6cb49209b309d0338b1d4b2102e4d6e246d54c3eab1', // click, type, done + bookSlot
    steps: 6, saidDone: false, refusals: 3,
    // The trace keeps the tool's arguments, its exact answer, and the API response behind it.
    traced: [
      '{"type":"http","method":"POST","path":"/api/book","status":503,',
      '"action":"bookSlot","args":{"person":"Alice","day":"Tuesday","time":"14:00"},"target":"","result":"Not booked: Service unavailable.",',
    ],
  },
};

for (const [version, replay] of Object.entries(REPLAYS)) {
  test(`${version}: the scripted run sends the recorded requests`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `replay-${version}-`));
    const results: RunResult[] = [];
    script(replay.calls);
    await runHarness(version, 1, dir, (result) => results.push(result));

    assert.equal(toolsSha256(), replay.tools, 'tool definitions sent to the model');
    assert.equal(requestsSha256(), replay.requests, 'all requests sent to the model');
    const [result] = results;
    assert.ok(result);
    assert.equal(result.steps, replay.steps);
    assert.equal(result.saidDone, replay.saidDone);
    assert.equal(result.refusals, replay.refusals);
    assert.equal(result.reallyBooked, false); // no scripted run ever books

    const trace = readFileSync(join(dir, 'run-01.jsonl'), 'utf8');
    for (const part of replay.traced ?? []) assert.ok(trace.includes(part), `trace should contain ${part}`);
    const start = JSON.parse(trace.split('\n')[0] ?? '{}') as Record<string, unknown>;
    assert.equal(start['promptSha256'], '73b1b18809357579fc2a7e639f4bbd625d5feecba7a5fe9c2409d2c48f9bf29b');
    assert.equal(start['taskSha256'], '2960b56da66ee504a11f153f4a020223fc0bb2504c0328e312b7d63dce5bf9da');
    assert.equal(start['faultFirstBook'], '503');
  });
}
