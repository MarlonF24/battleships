/** Replaceable clock and scheduler capabilities used by match sessions. */

export type ScheduledHandle = Readonly<{
  cancel: () => void;
}>;

export type Clock = Readonly<{
  now: () => number;
}>;

export type Scheduler = Readonly<{
  schedule: (delayMs: number, callback: () => void) => ScheduledHandle;
  cancel: (handle: ScheduledHandle) => void;
}>;

/** Production wall clock; deterministic tests inject their own implementation. */
export const systemClock: Clock = Object.freeze({ now: Date.now });
/** Production one-shot scheduler with a uniform cancellable handle. */
export const systemScheduler: Scheduler = Object.freeze({
  schedule: (delayMs, callback) => {
    const nativeHandle = setTimeout(callback, delayMs);
    return { cancel: () => clearTimeout(nativeHandle) };
  },
  cancel: (handle) => handle.cancel(),
});
