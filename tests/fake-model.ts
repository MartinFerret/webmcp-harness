// A scripted stand-in for the model, so the harness can be replayed without spending a token.
// It replaces global fetch: calls to Groq are answered from a queue of tool calls and their
// request bodies (model, messages, tools) are kept; every other call goes through untouched.
import { createHash } from 'node:crypto';

export interface Call { name: string; args: Record<string, unknown> }
export const DONE: Call = { name: 'done', args: { summary: 'Booked.' } };

// Set before the harness is imported: the replay must not depend on a local .env.
process.env['GROQ_MODEL'] = 'openai/gpt-oss-20b';
process.env['GROQ_API_KEY'] ??= 'not-used-by-the-fake-model';

let queue: Call[] = [];
let requests: unknown[] = [];

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.startsWith('https://api.groq.com/')) return realFetch(input, init);
  requests.push(JSON.parse(input instanceof Request ? await input.text() : String(init?.body)));
  const call = queue.shift() ?? DONE; // once the script is over, the fake model keeps saying done
  const message = {
    role: 'assistant', content: null,
    tool_calls: [{ id: 'call_1', type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } }],
  };
  const body = {
    id: 'fake', object: 'chat.completion', created: 0, model: 'fake',
    choices: [{ index: 0, finish_reason: 'tool_calls', message }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
};

/** Starts a new scripted run. */
export function script(calls: Call[]): void {
  queue = [...calls];
  requests = [];
}

/** SHA-256 of every request sent to the model since script(), in order. */
export function requestsSha256(): string {
  return createHash('sha256').update(JSON.stringify(requests)).digest('hex');
}

/** SHA-256 of the tool definitions sent with the first request. */
export function toolsSha256(): string {
  const first = requests[0] as { tools?: unknown } | undefined;
  return createHash('sha256').update(JSON.stringify(first?.tools)).digest('hex');
}
