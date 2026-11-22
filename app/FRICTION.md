# Friction: what is deliberately wrong with SlotBook

SlotBook is a demo target for a browser agent. Two things in it are wrong on
purpose. Neither is hidden from a human who looks closely, and neither is
mentioned to the agent.

## 1. The optimistic toast (a UI bug)

Clicking "Book" shows a "Booked!" toast immediately, before the API answers.
The toast stays even when the API rejects the booking. The calendar itself
tells the truth: a slot that was not booked is still shown as free.

Code: `app/src/app/booking.ts`.

## 2. Fault injection (a simulated backend failure)

With `FAULT_FIRST_BOOK=503`, the first `POST /api/book` after each reset
answers `503 Service unavailable`. Every later call works normally.

- It is deterministic: no randomness, the same fault in every run.
- It is on by default for agent runs (`npm run agent`, set in `harness/run.ts`)
  and applies to every harness version, v0 to v3, without exception.
- It is off by default when you start the app by hand (`npm run api`).
  Turn it on with `FAULT_FIRST_BOOK=503 npm run api`, or off for a run with
  `FAULT_FIRST_BOOK=0 npm run agent -- v0 1`.
- Each trace records the setting in `faultFirstBook`.

Code: `api/server.ts`.

## Why

Without the fault, the small model logs in and books correctly almost every
time, so the lying toast never matters (see "v0 without fault injection" in
`docs/results.md`). A transient backend error hidden by an optimistic UI is a
common real-world failure, and it gives each harness layer something real to
catch.
