// Unit tests for the snapshot trim and the per-turn messages (harness/3-context.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMessages, targetLine, trim, type Step } from '../harness/3-context.ts';

const RAW = [
  '- banner [ref=e2]:',
  '  - link "SlotBook" [ref=e4] [cursor=pointer]:',
  '    - /url: /',
  '  - generic [ref=e5]: Not signed in',
  '- main [ref=e8]:',
  '  - heading "Tuesday" [level=2] [ref=e20]',
  '  - button "14:00" [ref=e80] [cursor=pointer]',
  '  - button "15:00 · Bob" [disabled] [ref=e81]',
  '  - textbox "Name" [ref=e111]',
].join('\n');

const TRIMMED = [
  '- banner:',
  '  - link "SlotBook" [ref=e4]:',
  '  - generic: Not signed in',
  '- main:',
  '  - heading "Tuesday" [level=2]',
  '  - button "14:00" [ref=e80]',
  '  - button "15:00 · Bob" [disabled] [ref=e81]',
  '  - textbox "Name" [ref=e111]',
].join('\n');

test('trim drops link URLs, cursor hints and the refs of elements nobody can act on', () => {
  assert.equal(trim(RAW), TRIMMED);
});

test('trim keeps roles, names, states and the refs of buttons, links and text fields', () => {
  const kept = trim(RAW);
  for (const part of ['link "SlotBook" [ref=e4]', 'button "14:00" [ref=e80]', '[disabled] [ref=e81]', 'textbox "Name" [ref=e111]', '[level=2]']) {
    assert.ok(kept.includes(part), part);
  }
});

test('trim leaves an already trimmed snapshot unchanged', () => {
  assert.equal(trim(TRIMMED), TRIMMED);
});

test('targetLine finds the line the model pointed at', () => {
  assert.equal(targetLine(TRIMMED, 'e80'), '- button "14:00" [ref=e80]');
  assert.equal(targetLine(TRIMMED, 'e999'), '');
  assert.equal(targetLine(TRIMMED, undefined), '');
});

test('buildMessages: system prompt, then task, actions so far and the page', () => {
  const step: Step = { step: 1, action: 'click', args: { ref: 'e7' }, target: '', result: 'ok', tokens: 0 };
  assert.deepEqual(buildMessages('SYSTEM', 'TASK', [], 'PAGE'), [
    { role: 'system', content: 'SYSTEM' },
    { role: 'user', content: 'Task: TASK\n\nActions so far:\n(none)\n\nCurrent page:\nPAGE' },
  ]);
  assert.deepEqual(buildMessages('SYSTEM', 'TASK', [step], 'PAGE')[1], {
    role: 'user', content: 'Task: TASK\n\nActions so far:\n1. click {"ref":"e7"} -> ok\n\nCurrent page:\nPAGE',
  });
});
