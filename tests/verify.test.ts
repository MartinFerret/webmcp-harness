// Unit tests for the outcome check (harness/6-verify.ts), against a stand-in for the API's /__state.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { checkOutcome, reallyBooked } from '../harness/6-verify.ts';

interface Booking { day: string; time: string; name: string }
let bookings: Booking[] = [];

const server = createServer((req, res) => {
  if (req.url !== '/__state') return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ bookings }));
});
await new Promise<void>((resolve) => server.listen(0, resolve));
const app = `http://localhost:${(server.address() as AddressInfo).port}`;
after(() => server.close());

test('booked: Alice has Tuesday 14:00', async () => {
  bookings = [{ day: 'Monday', time: '09:00', name: 'Bob' }, { day: 'Tuesday', time: '14:00', name: 'Alice' }];
  assert.equal(await reallyBooked(app), true);
  assert.equal(await checkOutcome(app), null);
});

test('not booked: no booking at all', async () => {
  bookings = [];
  assert.equal(await reallyBooked(app), false);
  assert.equal(await checkOutcome(app), 'No booking found for Alice on Tuesday 14:00');
});

test('wrong slot: a booking for Alice at another time or on another day does not count', async () => {
  bookings = [{ day: 'Tuesday', time: '15:00', name: 'Alice' }, { day: 'Wednesday', time: '14:00', name: 'Alice' }];
  assert.equal(await reallyBooked(app), false);
  assert.equal(await checkOutcome(app), 'No booking found for Alice on Tuesday 14:00');
});

test('wrong person: Tuesday 14:00 booked by someone else does not count', async () => {
  bookings = [{ day: 'Tuesday', time: '14:00', name: 'Bob' }];
  assert.equal(await reallyBooked(app), false);
});
