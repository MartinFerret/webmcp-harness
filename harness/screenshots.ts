// README screenshots, taken from the real app with the same fault injection as the agent runs.
// Usage: npm run screenshots   (writes docs/screenshots/*.png). Not a harness part, no model call.
// https://playwright.dev/docs/screenshots
import { chromium } from 'playwright';

process.env['FAULT_FIRST_BOOK'] ??= '503';
await import('../api/server.ts'); // starts SlotBook on :4300

const APP = 'http://localhost:4300';
const OUT = 'docs/screenshots';

await fetch(`${APP}/__reset`, { method: 'POST' });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 });

// Log in with the demo account the login page itself displays.
await page.goto(`${APP}/login`);
await page.getByLabel('Email').fill('demo@slotbook.test');
await page.getByLabel('Password').fill('demo');
await page.getByRole('button', { name: 'Log in' }).click();

await page.getByRole('heading', { name: 'Pick a slot' }).waitFor();
await page.screenshot({ path: `${OUT}/1-calendar.png` });

await page.getByRole('region', { name: 'Tuesday' }).getByRole('button', { name: '14:00' }).click();
await page.getByLabel('Name').fill('Alice');
await page.screenshot({ path: `${OUT}/2-booking-form.png` });

// First booking after a reset: the API answers 503, the app says "Booked!" anyway.
const answer = page.waitForResponse((r) => r.url().endsWith('/api/book'));
await page.getByRole('button', { name: 'Book', exact: true }).click();
console.log(`POST /api/book -> ${(await answer).status()}`);
await page.getByRole('heading', { name: 'Pick a slot' }).waitFor();
await page.getByRole('status').waitFor();
await page.screenshot({ path: `${OUT}/3-false-booked-toast.png` });

const state = (await (await fetch(`${APP}/__state`)).json()) as { bookings: unknown[] };
console.log(`Bookings in the API: ${state.bookings.length}`);
await browser.close();
process.exit(0);
