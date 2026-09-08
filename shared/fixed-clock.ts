/** The runner supplies elapsed time; this module never reads a clock. */
export interface FixedClock { accumulatorMs: number }
export interface ClockAdvance {
  clock: FixedClock;
  steps: number;
  droppedMs: number;
  alpha: number;
}
export const STEP_MS = 1000 / 60;
export const MAX_FRAME_MS = 250;
export const MAX_CATCH_UP_STEPS = 8;
export const createClock = (): FixedClock => ({ accumulatorMs: 0 });

/** Cap frame delta and work, drop whole overdue ticks, retain only a fraction. */
export function advanceClock(clock: FixedClock, elapsedMs: number, step: () => void): ClockAdvance {
  if (!Number.isFinite(elapsedMs)) throw new Error('Frame delta must be finite');
  const elapsed = Math.max(0, elapsedMs);
  let droppedMs = Math.max(0, elapsed - MAX_FRAME_MS);
  let accumulatorMs = clock.accumulatorMs + Math.min(MAX_FRAME_MS, elapsed);
  let steps = 0;
  while (accumulatorMs + 0.000001 >= STEP_MS && steps < MAX_CATCH_UP_STEPS) {
    step();
    accumulatorMs = Math.max(0, accumulatorMs - STEP_MS);
    steps++;
  }
  if (accumulatorMs + 0.000001 >= STEP_MS) {
    const droppedSteps = Math.floor((accumulatorMs + 0.000001) / STEP_MS);
    const discarded = droppedSteps * STEP_MS;
    accumulatorMs = Math.max(0, accumulatorMs - discarded);
    droppedMs += discarded;
  }
  return { clock: { accumulatorMs }, steps, droppedMs, alpha: accumulatorMs / STEP_MS };
}
