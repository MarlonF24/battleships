/** Property tests for generated-fleet and arbitrary-shot invariants. */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  BattleBoard,
  ValidatedFleet,
  chooseProbabilityTarget,
  generateRandomFleet,
} from "../src";
import { seededRandom } from "./helpers";

describe("domain properties", () => {
  test("every seeded generated fleet passes the readiness validator", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffff_ffff }), (seed) => {
        const generated = generateRandomFleet(seededRandom(seed));
        return (
          generated.ok && ValidatedFleet.create(generated.value.placements).ok
        );
      }),
      { numRuns: 250 },
    );
  });

  test("the PDF agent never repeats or selects an impossible target", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), (seed) => {
        const fleet = generateRandomFleet(seededRandom(seed));
        if (!fleet.ok) return false;
        const board = new BattleBoard(fleet.value);
        const random = seededRandom(seed + 1);
        const touched = new Set<string>();
        while (!board.allShipsSunk) {
          const coordinate = chooseProbabilityTarget(
            board.opponentKnowledge(),
            random,
          );
          const key = `${coordinate.row}:${coordinate.column}`;
          if (touched.has(key)) return false;
          touched.add(key);
          if (!board.shoot(coordinate).ok) return false;
        }
        return true;
      }),
      { numRuns: 40 },
    );
  });

  test("target selection remains comfortably below the 100ms budget", () => {
    const fleet = generateRandomFleet(seededRandom(42));
    if (!fleet.ok) throw new Error(fleet.error.message);
    const board = new BattleBoard(fleet.value);
    const durations: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const started = performance.now();
      chooseProbabilityTarget(board.opponentKnowledge(), seededRandom(index));
      durations.push(performance.now() - started);
    }
    durations.sort((left, right) => left - right);
    const percentile95 = durations[Math.floor(durations.length * 0.95)];
    expect(percentile95).toBeDefined();
    expect(percentile95).toBeLessThan(100);
  });

  test("the PDF agent wins at least 70 percent of a seeded paired sample", () => {
    const gameCount = 50;
    let pdfWins = 0;
    for (let game = 0; game < gameCount; game += 1) {
      const fleet = generateRandomFleet(seededRandom(game));
      if (!fleet.ok) throw new Error(fleet.error.message);
      const pdfBoard = new BattleBoard(fleet.value);
      const randomBoard = new BattleBoard(fleet.value);
      const pdfRandom = seededRandom(game + gameCount);
      const uniformRandom = seededRandom(game + gameCount * 2);
      let pdfShots = 0;
      let randomShots = 0;

      while (!pdfBoard.allShipsSunk) {
        const target = chooseProbabilityTarget(
          pdfBoard.opponentKnowledge(),
          pdfRandom,
        );
        const shot = pdfBoard.shoot(target);
        if (!shot.ok) throw new Error(shot.error.message);
        pdfShots += 1;
      }
      while (!randomBoard.allShipsSunk) {
        const target = randomBoard.randomLegalTarget(uniformRandom);
        if (!target.ok) throw new Error(target.error.message);
        const shot = randomBoard.shoot(target.value);
        if (!shot.ok) throw new Error(shot.error.message);
        randomShots += 1;
      }

      // Alternating the first seat makes exact shot-count ties fair.
      const pdfStarts = game % 2 === 0;
      if (pdfShots < randomShots || (pdfStarts && pdfShots === randomShots)) {
        pdfWins += 1;
      }
    }
    expect(pdfWins / gameCount).toBeGreaterThanOrEqual(0.7);
  }, 15_000);
});
