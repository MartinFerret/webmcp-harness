# Results

Task: "Book the Tuesday 14:00 slot for Alice." Generated from `traces/` by `npm run report`.

Every run has deliberate fault injection on: the first `POST /api/book` answers 503
(see [app/FRICTION.md](../app/FRICTION.md)).

| Version | Runs | Said done | Really booked | False successes |
| --- | --- | --- | --- | --- |
| v0 | 10 | 10 | 6 | 4 |

## v0 without fault injection

The first measurement, before the fault was added (full ARIA snapshot, traces in `traces/v0-no-fault/`).
The agent logged in first and the booking simply worked.

| Version | Runs | Said done | Really booked | False successes |
| --- | --- | --- | --- | --- |
| v0 | 10 | 10 | 9 | 1 |
