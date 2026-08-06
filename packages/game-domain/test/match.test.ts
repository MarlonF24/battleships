/** Aggregate phase and turn-policy tests. */

import { describe, expect, test } from "bun:test";
import {
  Match,
  generateRandomFleet,
  type GameMode,
  type SeatDescriptor,
} from "../src";
import { seededRandom } from "./helpers";

const descriptors: readonly [SeatDescriptor, SeatDescriptor] = [
  { kind: "human" },
  { kind: "human" },
];

function battle(mode: GameMode): Match {
  const firstFleet = generateRandomFleet(seededRandom(1));
  const secondFleet = generateRandomFleet(seededRandom(2));
  if (!firstFleet.ok || !secondFleet.ok) {
    throw new Error("Test fleets must be generated.");
  }

  const match = new Match(crypto.randomUUID(), mode, descriptors);
  expect(match.readyPlayer(1, firstFleet.value.placements).ok).toBe(true);
  expect(match.readyPlayer(2, secondFleet.value.placements).ok).toBe(true);
  expect(match.startBattle().ok).toBe(true);
  return match;
}

describe("match aggregate", () => {
  test("seat one starts and single-shot swaps after one action", () => {
    const match = battle("singleShot");
    expect(match.getState()).toMatchObject({ phase: "battle", turnSeat: 1 });

    const result = match.takeAutomaticShot(1, seededRandom(3));
    expect(result.ok).toBe(true);
    expect(match.getState()).toMatchObject({ phase: "battle", turnSeat: 2 });
  });

  test("salvo retains the turn for two shots and swaps after the third", () => {
    const match = battle("salvo");
    expect(match.takeAutomaticShot(1, seededRandom(4)).ok).toBe(true);
    expect(match.getState()).toMatchObject({ turnSeat: 1, shotsRemaining: 2 });
    expect(match.takeAutomaticShot(1, seededRandom(5)).ok).toBe(true);
    expect(match.getState()).toMatchObject({ turnSeat: 1, shotsRemaining: 1 });
    expect(match.takeAutomaticShot(1, seededRandom(6)).ok).toBe(true);
    expect(match.getState()).toMatchObject({ turnSeat: 2, shotsRemaining: 3 });
  });

  test("rejects an out-of-turn action without changing state", () => {
    const match = battle("singleShot");
    const before = match.getState();
    expect(match.shoot(2, { row: 0, column: 0 })).toMatchObject({
      ok: false,
      error: { code: "not_your_turn" },
    });
    expect(match.getState()).toBe(before);
  });

  test("readiness is irreversible", () => {
    const fleet = generateRandomFleet(seededRandom(10));
    if (!fleet.ok) throw new Error("Test fleet must be generated.");
    const match = new Match(crypto.randomUUID(), "singleShot", descriptors);
    expect(match.readyPlayer(1, fleet.value.placements).ok).toBe(true);
    expect(match.readyPlayer(1, fleet.value.placements)).toMatchObject({
      ok: false,
      error: { code: "already_ready" },
    });
  });
});
