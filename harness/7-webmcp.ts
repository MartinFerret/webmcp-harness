// Part 7, WebMCP (v3): the harness side. Lists the tools the page exposes and calls them.
// API (document.modelContext.getTools / executeTool):
// https://developer.chrome.com/docs/ai/webmcp/imperative-api
// In Playwright's Chromium the API comes from the polyfill loaded by the app:
// https://github.com/w3c-oss/webmcp-polyfill
import type { Page } from 'playwright';
import type { Tool } from './1-tools.ts';

interface PageTool { name: string; description: string; inputSchema?: unknown }
interface ModelContext {
  getTools(): Promise<PageTool[]>;
  executeTool(tool: PageTool, input: unknown): Promise<unknown>;
}
type WebMcpDocument = Document & { modelContext?: ModelContext };

/** The page's tools, in the format the model expects. */
export async function listPageTools(page: Page): Promise<Tool[]> {
  const tools = await page.evaluate(async () => {
    const all = (await (document as WebMcpDocument).modelContext?.getTools()) ?? [];
    return all.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  });
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: (typeof t.inputSchema === 'string' ? JSON.parse(t.inputSchema) : t.inputSchema) ?? { type: 'object' },
    },
  }));
}

/** Calls one page tool and returns what it answered, as text. */
export async function callPageTool(page: Page, name: string, args: Record<string, unknown>): Promise<string> {
  try {
    const result = await page.evaluate(async ({ name, args }) => {
      const context = (document as WebMcpDocument).modelContext;
      const tool = (await context?.getTools())?.find((t) => t.name === name);
      if (!context || !tool) throw new Error(`No page tool named ${name}`);
      return context.executeTool(tool, args);
    }, { name, args });
    await page.waitForTimeout(400); // let the page settle
    return unquote(typeof result === 'string' ? result : JSON.stringify(result));
  } catch (error) {
    return `error: ${String(error).split('\n')[0]}`;
  }
}

/** executeTool answers with JSON: a tool that returned plain text comes back as a quoted string. */
function unquote(json: string): string {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === 'string' ? value : json;
  } catch {
    return json;
  }
}
