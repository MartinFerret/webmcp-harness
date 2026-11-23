// Part 4, guardrails: limits the model cannot talk its way past. They catch runs that go on
// forever. They do not catch a run that stops early with a wrong answer: that is 6-verify.ts.

export interface Guardrails {
  /** The run ends, as not done, once this many steps have been taken. */
  maxSteps: number;
}

/** How many times "done" may be refused (see 6-verify.ts) before one more refusal ends the run. */
export const MAX_REFUSALS = 3;

/** Checked before every turn of the loop. */
export const withinStepLimit = (step: number, guardrails: Guardrails): boolean => step <= guardrails.maxSteps;

/** Checked when "done" is about to be refused once more. */
export const tooManyRefusals = (refusals: number): boolean => refusals === MAX_REFUSALS;
