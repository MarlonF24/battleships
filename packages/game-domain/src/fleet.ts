/** Fleet geometry, semantic validation, random generation, and rotation. */

import { CLASSIC_RULESET, type GameRules } from "./rules";
import { shuffled, systemRandom, type RandomSource } from "./random";
import {
  coordinateKey,
  type Coordinate,
  type DomainError,
  type DomainResult,
  type Orientation,
  type ShipPlacement,
} from "./types";

function domainError(
  code: DomainError["code"],
  message: string,
): DomainResult<never> {
  return { ok: false, error: { code, message } };
}

/**
 * Return every coordinate occupied by one placement in head-to-tail order.
 *
 * @param placement - Straight ship placement to expand.
 * @returns Exactly `placement.length` board coordinates.
 */
export function placementCoordinates(
  placement: ShipPlacement,
): readonly Coordinate[] {
  return Array.from({ length: placement.length }, (_, offset) => ({
    row:
      placement.headRow + (placement.orientation === "vertical" ? offset : 0),
    column:
      placement.headColumn +
      (placement.orientation === "horizontal" ? offset : 0),
  }));
}

/** Return all in-bounds cells touching a placement, including diagonals. */
export function surroundingCoordinates(
  placement: ShipPlacement,
  rules: GameRules = CLASSIC_RULESET,
): readonly Coordinate[] {
  const occupied = new Set(placementCoordinates(placement).map(coordinateKey));
  const coordinates = placementCoordinates(placement);
  const rows = coordinates.map(({ row }) => row);
  const columns = coordinates.map(({ column }) => column);
  const minimumRow = Math.min(...rows) - 1;
  const maximumRow = Math.max(...rows) + 1;
  const minimumColumn = Math.min(...columns) - 1;
  const maximumColumn = Math.max(...columns) + 1;
  const surrounding: Coordinate[] = [];

  // Inspect the bounding rectangle once; ships are straight and contiguous.
  for (let row = minimumRow; row <= maximumRow; row += 1) {
    for (let column = minimumColumn; column <= maximumColumn; column += 1) {
      const coordinate = { row, column };
      if (
        row >= 0 &&
        row < rules.rows &&
        column >= 0 &&
        column < rules.columns &&
        !occupied.has(coordinateKey(coordinate))
      ) {
        surrounding.push(coordinate);
      }
    }
  }

  return surrounding;
}

function validatePlacementShape(
  placement: ShipPlacement,
  rules: GameRules,
): DomainResult<ShipPlacement> {
  if (
    !Number.isInteger(placement.length) ||
    !Number.isInteger(placement.headRow) ||
    !Number.isInteger(placement.headColumn) ||
    !rules.orientations.includes(placement.orientation)
  ) {
    return domainError(
      "invalid_placement",
      "Ship placements require integer coordinates, a positive length, and a recognised orientation.",
    );
  }

  const coordinates = placementCoordinates(placement);
  const inBounds = coordinates.every(
    ({ row, column }) =>
      row >= 0 && row < rules.rows && column >= 0 && column < rules.columns,
  );

  return inBounds
    ? { ok: true, value: placement }
    : domainError("fleet_bounds", "A ship extends outside the battle grid.");
}

function fleetLengthCounts(lengths: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const length of lengths) {
    counts.set(length, (counts.get(length) ?? 0) + 1);
  }
  return counts;
}

/**
 * Validate a complete fleet and retain its immutable placement data.
 *
 * Instances can only be created after all composition and spatial invariants
 * pass, so battle boards never need to defend against malformed fleets.
 */
export class ValidatedFleet {
  private constructor(public readonly placements: readonly ShipPlacement[]) {}

  /** Validate and construct the fleet accepted by a match. */
  public static create(
    placements: readonly ShipPlacement[],
    rules: GameRules = CLASSIC_RULESET,
  ): DomainResult<ValidatedFleet> {
    const partialResult = validatePartialFleet(placements, rules);
    if (!partialResult.ok) {
      return partialResult;
    }

    const expected = [...rules.fleetLengths].sort(
      (left, right) => left - right,
    );
    const actual = placements
      .map(({ length }) => length)
      .sort((left, right) => left - right);

    if (
      expected.length !== actual.length ||
      expected.some((length, index) => length !== actual[index])
    ) {
      return domainError(
        "fleet_composition",
        "The submitted fleet does not contain the required ships.",
      );
    }

    return {
      ok: true,
      value: new ValidatedFleet(
        Object.freeze(
          placements.map((placement) => Object.freeze({ ...placement })),
        ),
      ),
    };
  }
}

/**
 * Validate composition limits, bounds, overlap, and eight-way separation.
 *
 * Unlike {@link ValidatedFleet.create}, this permits missing ships so the same
 * rule boundary can validate browser placement previews.
 *
 * @param placements - Complete or incomplete placement collection.
 * @param rules - Board and fleet definition against which to validate.
 * @returns The original placements on success or the first semantic error.
 */
export function validatePartialFleet(
  placements: readonly ShipPlacement[],
  rules: GameRules = CLASSIC_RULESET,
): DomainResult<readonly ShipPlacement[]> {
  const allowedCounts = fleetLengthCounts(rules.fleetLengths);
  const submittedCounts = new Map<number, number>();
  const occupied = new Set<string>();
  const blocked = new Set<string>();

  for (const placement of placements) {
    const shapeResult = validatePlacementShape(placement, rules);
    if (!shapeResult.ok) {
      return shapeResult;
    }

    const count = (submittedCounts.get(placement.length) ?? 0) + 1;
    submittedCounts.set(placement.length, count);
    if (count > (allowedCounts.get(placement.length) ?? 0)) {
      return domainError(
        "fleet_composition",
        `Too many length-${placement.length} ships were submitted.`,
      );
    }

    const coordinates = placementCoordinates(placement);
    if (
      coordinates.some((coordinate) => occupied.has(coordinateKey(coordinate)))
    ) {
      return domainError("fleet_overlap", "Ships may not overlap.");
    }

    if (
      coordinates.some((coordinate) => blocked.has(coordinateKey(coordinate)))
    ) {
      return domainError(
        "fleet_adjacency",
        "Ships must have at least one empty cell between them.",
      );
    }

    // Block the occupied cells and their complete perimeter for later ships.
    for (const coordinate of coordinates) {
      occupied.add(coordinateKey(coordinate));
      blocked.add(coordinateKey(coordinate));
    }
    for (const coordinate of surroundingCoordinates(placement, rules)) {
      blocked.add(coordinateKey(coordinate));
    }
  }

  return { ok: true, value: placements };
}

function enumeratePlacements(
  length: number,
  rules: GameRules,
): readonly ShipPlacement[] {
  const placements: ShipPlacement[] = [];

  for (const orientation of rules.orientations) {
    for (let headRow = 0; headRow < rules.rows; headRow += 1) {
      for (let headColumn = 0; headColumn < rules.columns; headColumn += 1) {
        const placement = { length, orientation, headRow, headColumn };
        if (validatePlacementShape(placement, rules).ok) {
          placements.push(placement);
        }
      }
    }
  }

  return placements;
}

/**
 * Generate a legal fleet with randomized backtracking.
 *
 * Existing partial placements are preserved, which supports both the browser's
 * "randomise remaining" action and server-side placement expiry.
 */
export function generateRandomFleet(
  random: RandomSource = systemRandom,
  partialPlacements: readonly ShipPlacement[] = [],
  rules: GameRules = CLASSIC_RULESET,
): DomainResult<ValidatedFleet> {
  const partialResult = validatePartialFleet(partialPlacements, rules);
  if (!partialResult.ok) {
    return partialResult;
  }

  const remainingCounts = fleetLengthCounts(rules.fleetLengths);
  for (const { length } of partialPlacements) {
    remainingCounts.set(length, (remainingCounts.get(length) ?? 0) - 1);
  }

  const remainingLengths = [...remainingCounts.entries()]
    .flatMap(([length, count]) => Array.from({ length: count }, () => length))
    .sort((left, right) => right - left);
  const candidatesByLength = new Map(
    [...new Set(remainingLengths)].map((length) => [
      length,
      enumeratePlacements(length, rules),
    ]),
  );

  // Place longest ships first to prune impossible layouts early. Each level
  // shuffles candidates through the injected source, making tests repeatable.
  const search = (
    placed: readonly ShipPlacement[],
    index: number,
  ): readonly ShipPlacement[] | undefined => {
    if (index === remainingLengths.length) {
      return placed;
    }

    const length = remainingLengths[index];
    if (length === undefined) {
      return undefined;
    }

    const candidates = candidatesByLength.get(length) ?? [];
    for (const candidate of shuffled(candidates, random)) {
      const next = [...placed, candidate];
      if (validatePartialFleet(next, rules).ok) {
        const solution = search(next, index + 1);
        if (solution) {
          return solution;
        }
      }
    }

    return undefined;
  };

  const solution = search([...partialPlacements], 0);
  return solution
    ? ValidatedFleet.create(solution, rules)
    : domainError(
        "invalid_placement",
        "No legal fleet can be completed from the supplied placements.",
      );
}

/**
 * Return a placement with the opposite orientation and unchanged head cell.
 *
 * Interactive rotation around a grabbed segment is handled by the drag store;
 * this domain helper intentionally performs only the basic operation.
 */
export function rotatePlacement(placement: ShipPlacement): ShipPlacement {
  const orientation: Orientation =
    placement.orientation === "horizontal" ? "vertical" : "horizontal";
  return { ...placement, orientation };
}
