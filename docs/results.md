# Results

Task: "Book the Tuesday 14:00 slot for Alice." Generated from `traces/` by `npm run report`.

Every run has deliberate fault injection on: the first `POST /api/book` answers 503
(see [app/FRICTION.md](../app/FRICTION.md)).

| Version | Runs | Said done | Really booked | False successes | Median steps | Median tokens |
| --- | --- | --- | --- | --- | --- | --- |
| v0 | 10 | 10 | 6 | 4 | 13 | 10582.5 |
| v1 | 10 | 10 | 7 | 3 | 13 | 10749.5 |
| v2 | 10 | 8 | 8 | 0 | 14.5 | 12302 |
| v3 | 10 | 7 | 7 | 0 | 14 | 13613 |

Notes: in the 4 false successes of v0, the last thing the agent did before declaring done was to reopen
the still-free Tuesday 14:00 slot (twice also retyping the name), with no successful booking behind it.
Runs 05 and 08 clicked "Book" once (the injected 503). Run 06 clicked it twice (the 503, then an empty
name). Run 07 never logged in and clicked it three times (the 503, then two refusals for not being
logged in). Trace lines from the first click on "Book" to the end:

- `traces/v0/run-05.json`: `8. click button "Book" [ref=e113]` → `9. click button "14:00" [ref=e131]` → `10. type textbox "Name" [ref=e164]` → `11. done`
- `traces/v0/run-06.json`: `10. click button "Book" [ref=e113]` → `11. click button "14:00" [ref=e131]` → `12. click button "Book" [ref=e166]` → `13. click button "14:00" [ref=e184]` → `14. type textbox "Name" [ref=e215]` → `15. done`
- `traces/v0/run-07.json`: `3. click button "Book" [ref=e58]` → `4. click button "14:00" [ref=e76]` → `5. click button "Dismiss" [ref=e104]: ×` → `6. click button "Book" [ref=e111]` → `7. click button "14:00" [ref=e129]` → `8. click button "Dismiss" [ref=e157]: ×` → `9. type textbox "Name" [ref=e162]` → `10. click button "Book" [ref=e164]` → `11. click button "14:00" [ref=e182]` → `12. done`
- `traces/v0/run-08.json`: `8. click button "Book" [ref=e113]` → `9. click button "14:00" [ref=e131]` → `10. done`

The rejection reasons given for runs 06 and 07 are inferred from the API code (`api/server.ts`):
v0 traces did not record HTTP statuses. From v1 on, every API response is recorded in the trace.

Notes on v2: the 2 runs that did not end with "done" (02 and 09) hit the step limit because the agent never
logged in. After the injected 503, every booking was answered 401, while the app still showed its
"Booked!" message (the optimistic toast, see [app/FRICTION.md](../app/FRICTION.md)), and the agent
retried the same action until the limit. (Traces do not record what the page showed: the message is
known from the app code, and the traces show the agent clicking its "Dismiss" button.)
Run 02 never sent a login request and never said done.
Run 09 sent one login request with an empty password (401) and said done once: the refusal said what
was missing, not why, and the agent went on as before. Trace lines (every `POST` answer, every click
on "Book" and every "done"; an API answer is written just before the step that caused it):

- `traces/v2/run-02.jsonl` (20 steps): `POST /api/book 503` → `7. click button "Book" [ref=e110]` → `POST /api/book 401` → `11. click button "Book" [ref=e163]` → `POST /api/book 401` → `15. click button "Book" [ref=e216]` → `POST /api/book 401` → `19. click button "Book" [ref=e269]`
- `traces/v2/run-09.jsonl` (20 steps): `POST /api/login 401` → `POST /api/book 503` → `8. click button "Book" [ref=e111]` → `POST /api/book 401` → `12. click button "Book" [ref=e164]` → `14. done -> refused: No booking found for Alice on Tuesday 14:00` → `POST /api/book 401` → `16. click button "Book" [ref=e217]` → `POST /api/book 401` → `20. click button "Book" [ref=e268]`

Notes on v3: the page's `bookSlot` tool was called 8 times, in 8 of 10 runs, never more than
1 time per run, and as the very first action in 5 runs. What it answered:

- `Not booked: Service unavailable.` (7×)
- `Not booked: Not logged in.` (1×)

Of the 7 bookings that exist, 0 were made through the tool and 7 by clicking "Book".
The first booking request of a run always gets the injected 503, whether it comes from the tool or from
the button. The runs that did not end with "done" (same quoting as for v2):

- `traces/v3/run-01.jsonl` (20 steps): `POST /api/book 503` → `7. click button "Book" [ref=e110]` → `POST /api/book 401` → `9. click button "Book" [ref=e163]` → `POST /api/book 401` → `12. click button "Book" [ref=e214]` → `POST /api/book 401` → `15. click button "Book" [ref=e267]` → `POST /api/book 401` → `17. click button "Book" [ref=e318]`
- `traces/v3/run-03.jsonl` (20 steps): `POST /api/book 503` → `1. bookSlot -> Not booked: Service unavailable.` → `POST /api/book 401` → `4. click button "Book" [ref=e98]` → `6. done -> refused: No booking found for Alice on Tuesday 14:00` → `POST /api/book 401` → `7. click button "Book" [ref=e151]` → `POST /api/book 401` → `12. click button "Book" [ref=e202]` → `POST /api/book 401` → `16. click button "Book" [ref=e255]` → `18. done -> refused: No booking found for Alice on Tuesday 14:00` → `POST /api/book 401` → `20. click button "Book" [ref=e308]`
- `traces/v3/run-06.jsonl` (20 steps): `POST /api/book 503` → `3. click button "Book" [ref=e58]` → `POST /api/book 401` → `6. click button "Book" [ref=e111]` → `POST /api/book 401` → `9. click button "Book" [ref=e162]` → `11. done -> refused: No booking found for Alice on Tuesday 14:00` → `POST /api/book 401` → `13. click button "Book" [ref=e213]` → `POST /api/book 401` → `17. bookSlot -> Not booked: Not logged in.` → `POST /api/login 200`

## v0 without fault injection

The first measurement, before the fault was added (full ARIA snapshot, traces in `traces/v0-no-fault/`).
The agent logged in first and the booking simply worked.

| Version | Runs | Said done | Really booked | False successes | Median steps | Median tokens |
| --- | --- | --- | --- | --- | --- | --- |
| v0 | 10 | 10 | 9 | 1 | 9 | 8703.5 |
