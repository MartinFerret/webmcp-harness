// Part 2, the model: the only file that talks to it. Groq through the OpenAI Node SDK.
// Groq's OpenAI-compatible endpoint: https://console.groq.com/docs/openai
// Model ids (openai/gpt-oss-20b):     https://console.groq.com/docs/models
// Tool calling:                       https://console.groq.com/docs/tool-use
import OpenAI from 'openai';
import type { Tool } from './1-tools.ts';

try {
  process.loadEnvFile(); // reads .env (gitignored)
} catch {
  // No .env file: rely on the real environment.
}

export const MODEL = process.env['GROQ_MODEL'] ?? 'openai/gpt-oss-20b';

export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export interface ToolCall { name: string; args: Record<string, unknown> }
export interface Reply { call: ToolCall | null; text: string; tokens: number }

const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env['GROQ_API_KEY'],
  maxRetries: 8, // the SDK waits for Groq's retry-after on 429 (free tier rate limits)
});

/** One model turn: returns the first tool call the model made, if any. */
export async function ask(messages: Message[], tools: Tool[]): Promise<Reply> {
  const res = await client.chat.completions.create({ model: MODEL, messages, tools });
  const message = res.choices[0]?.message;
  const first = message?.tool_calls?.find((c) => c.type === 'function');
  return {
    call: first ? { name: first.function.name, args: parseArgs(first.function.arguments) } : null,
    text: message?.content ?? '',
    tokens: res.usage?.total_tokens ?? 0,
  };
}

function parseArgs(json: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(json || '{}');
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
