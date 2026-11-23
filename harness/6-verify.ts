// Part 6, verify: when the agent says "done", the harness looks at the outcome before believing it.
// The check reads the API's own state, not the page: the page is what lied in the first place.

/** The ground truth, read from the API. The agent never sees this. */
export async function reallyBooked(app: string): Promise<boolean> {
  const state = (await (await fetch(`${app}/__state`)).json()) as { bookings: { day: string; time: string; name: string }[] };
  return state.bookings.some((b) => b.day === 'Tuesday' && b.time === '14:00' && b.name === 'Alice');
}

/** Null when the booking exists, otherwise the short factual message the agent gets back instead of "stopped". */
export async function checkOutcome(app: string): Promise<string | null> {
  return (await reallyBooked(app)) ? null : 'No booking found for Alice on Tuesday 14:00';
}
