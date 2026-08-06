/** Injectable randomness utilities shared by placement, timeouts, and agents. */

/** Minimal random source that permits deterministic domain tests. */
export type RandomSource = Readonly<{
  /** Return a floating-point value in the half-open interval [0, 1). */
  next: () => number;
}>;

/** Production random source backed by the JavaScript runtime. */
export const systemRandom: RandomSource = Object.freeze({
  next: Math.random,
});

/** Return a shuffled copy without mutating the supplied values. */
export function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];

  // Fisher-Yates gives each permutation equal probability for a fair search.
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    const value = result[index];
    const swapValue = result[swapIndex];

    if (value === undefined || swapValue === undefined) {
      throw new Error("Shuffle indices must resolve to existing values.");
    }

    result[index] = swapValue;
    result[swapIndex] = value;
  }

  return result;
}

/** Choose one value uniformly, returning undefined for an empty collection. */
export function chooseRandom<T>(
  values: readonly T[],
  random: RandomSource,
): T | undefined {
  return values[Math.floor(random.next() * values.length)];
}
