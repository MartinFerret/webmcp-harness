// SlotBook API: a tiny in-memory booking API that also serves the built app.
// Run: npm run api   (http://localhost:4300)
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export const TIMES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] as const;
const DEMO_USER = { email: 'demo@slotbook.test', password: 'demo' };

interface Booking { day: string; time: string; name: string }

const sessions = new Set<string>();
let bookings: Booking[] = [];

const STATIC_DIR = join(import.meta.dirname, '../app/dist/app/browser');
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon',
};

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isLoggedIn(req: IncomingMessage): boolean {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  return token !== undefined && sessions.has(token);
}

async function serveStatic(path: string, res: ServerResponse): Promise<void> {
  // Any unknown path falls back to index.html so the Angular router can handle it.
  const file = extname(path) ? normalize(path).replace(/^(\.\.[/\\])+/, '') : 'index.html';
  try {
    const data = await readFile(join(STATIC_DIR, file));
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    send(res, 404, { error: 'Not found. Did you run "npm run build:app"?' });
  }
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const route = `${req.method} ${path}`;

  if (route === 'POST /api/login') {
    const body = await readJson(req);
    if (body['email'] !== DEMO_USER.email || body['password'] !== DEMO_USER.password) {
      return send(res, 401, { error: 'Wrong email or password' });
    }
    const token = randomUUID();
    sessions.add(token);
    return send(res, 200, { token });
  }

  if (route === 'GET /api/slots') {
    const slots = DAYS.flatMap((day) =>
      TIMES.map((time) => ({
        day,
        time,
        bookedBy: bookings.find((b) => b.day === day && b.time === time)?.name ?? null,
      })),
    );
    return send(res, 200, slots);
  }

  if (route === 'POST /api/book') {
    if (!isLoggedIn(req)) return send(res, 401, { error: 'Not logged in' });
    const body = await readJson(req);
    const day = String(body['day'] ?? '');
    const time = String(body['time'] ?? '');
    const name = String(body['name'] ?? '').trim();
    if (!name) return send(res, 400, { error: 'Name is required' });
    if (!DAYS.includes(day as never) || !TIMES.includes(time as never)) {
      return send(res, 400, { error: 'Unknown slot' });
    }
    if (bookings.some((b) => b.day === day && b.time === time)) {
      return send(res, 409, { error: 'Slot already booked' });
    }
    bookings.push({ day, time, name });
    return send(res, 201, { day, time, name });
  }

  // Harness only: never linked from the app, never shown to the agent.
  if (route === 'GET /__state') return send(res, 200, { bookings });
  if (route === 'POST /__reset') {
    bookings = [];
    sessions.clear();
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET') return serveStatic(path, res);
  send(res, 404, { error: 'Not found' });
});

const port = Number(process.env['PORT'] ?? 4300);
server.listen(port, () => console.log(`SlotBook on http://localhost:${port}`));
