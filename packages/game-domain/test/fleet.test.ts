/** Fleet validation and randomized generation tests. */

import { describe, expect, test } from "bun:test";
import {
  CLASSIC_RULESET,
  ValidatedFleet,
  generateRandomFleet,
  placementCoordinates,
  surroundingCoordinates,
  validatePartialFleet,
  type ShipPlacement,
} from "../src";
import { seededRandom } from "./helpers";

const validFleet: readonly ShipPlacement[] = [
  { length: 5, orientation: "horizontal", headRow: 0, headColumn: 0 },
  { length: 2, orientation: "horizontal", headRow: 0, headColumn: 7 },
  { length: 4, orientation: "horizontal", headRow: 2, headColumn: 0 },
  { length: 4, orientation: "horizontal", headRow: 2, headColumn: 6 },
  { length: 3, orientation: "horizontal", headRow: 4, headColumn: 0 },
  { length: 3, orientation: "horizontal", headRow: 4, headColumn: 4 },
  { length: 2, orientation: "horizontal", headRow: 4, headColumn: 8 },
  { length: 3, orientation: "horizontal", headRow: 6, headColumn: 0 },
  { length: 2, orientation: "horizontal", headRow: 6, headColumn: 4 },
  { length: 2, orientation: "horizontal", headRow: 6, headColumn: 8 },
];

describe("fleet validation", () => {
  test("accepts the exact classic fleet when every ship is separated", () => {
    expect(ValidatedFleet.create(validFleet).ok).toBe(true);
  });

  test("rejects overlap, diagonal contact, bounds, and composition errors", () => {
    const overlap = [validFleet[1], validFleet[1]].filter(
      (placement): placement is ShipPlacement => placement !== undefined,
    );
    expect(validatePartialFleet(overlap)).toMatchObject({
      ok: false,
      error: { code: "fleet_overlap" },
    });

    expect(
      validatePartialFleet([
        { length: 2, orientation: "horizontal", headRow: 0, headColumn: 0 },
        { length: 2, orientation: "vertical", headRow: 1, headColumn: 2 },
      ]),
    ).toMatchObject({ ok: false, error: { code: "fleet_adjacency" } });

    expect(
      validatePartialFleet([
        { length: 5, orientation: "horizontal", headRow: 9, headColumn: 8 },
      ]),
    ).toMatchObject({ ok: false, error: { code: "fleet_bounds" } });

    expect(ValidatedFleet.create(validFleet.slice(1))).toMatchObject({
      ok: false,
      error: { code: "fleet_composition" },
    });
  });

  test("random generation preserves a valid partial fleet", () => {
    const partial = validFleet.slice(0, 2);
    const result = generateRandomFleet(seededRandom(42), partial);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.placements.slice(0, 2)).toEqual(partial);
    expect(ValidatedFleet.create(result.value.placements).ok).toBe(true);
  });

  test("random generation produces valid fleets across fixed seeds", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const result = generateRandomFleet(seededRandom(seed));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.placements).toHaveLength(
          CLASSIC_RULESET.fleetLengths.length,
        );
      }
    }
  });

  test("coordinate helpers separate occupied and surrounding cells", () => {
    const placement: ShipPlacement = {
      length: 3,
      orientation: "horizontal",
      headRow: 1,
      headColumn: 1,
    };
    expect(placementCoordinates(placement)).toEqual([
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 1, column: 3 },
    ]);
    expect(surroundingCoordinates(placement)).toHaveLength(12);
  });
});
