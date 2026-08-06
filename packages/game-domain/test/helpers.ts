/** Deterministic test data and random-source helpers for domain tests. */

import type { RandomSource } from "../src";

/** Create a deterministic pseudo-random source for reproducible tests. */
export function seededRandom(initialSeed: number): RandomSource {
  let seed = initialSeed >>> 0;
  return {
    next: () => {
      // Mulberry32 is compact and has sufficient distribution for game tests.
      seed += 0x6d2b79f5;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}
