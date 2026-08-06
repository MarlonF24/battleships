/** Battle-board mutation and privacy-safe view derivation. */

import { CLASSIC_RULESET, type GameRules } from "./rules";
import { chooseRandom, type RandomSource } from "./random";
import {
  placementCoordinates,
  surroundingCoordinates,
  type ValidatedFleet,
} from "./fleet";
import {
  coordinateKey,
  type Coordinate,
  type DomainResult,
  type ShipPlacement,
} from "./types";

/** Cell states that are safe to serialize in a role-filtered board view. */
export const CELL_STATES = ["unknown", "miss", "hit", "impossible"] as const;
export type CellState = (typeof CELL_STATES)[number];

/** Placement plus resolved hit state for a ship visible to the recipient. */
export type ShipView = ShipPlacement &
  Readonly<{
    id: string;
    hits: readonly boolean[];
    sunk: boolean;
  }>;

/** Immutable rendering view containing only audience-permitted ships. */
export type BoardView = Readonly<{
  cells: readonly (readonly CellState[])[];
  ships: readonly ShipView[];
  remainingShipLengths: readonly number[];
}>;

/** Domain result of resolving one new legal target. */
export type ShotOutcome = Readonly<{
  coordinate: Coordinate;
  hit: boolean;
  sunkShip: ShipView | null;
}>;

/** Public evidence available to a human or probability-density agent. */
export type OpponentKnowledge = Readonly<{
  rows: number;
  columns: number;
  cells: readonly (readonly CellState[])[];
  sunkShips: readonly ShipView[];
  remainingShipLengths: readonly number[];
}>;

type ShipState = {
  readonly id: string;
  readonly placement: ShipPlacement;
  readonly hits: boolean[];
};

type OccupiedSegment = Readonly<{
  shipIndex: number;
  segmentIndex: number;
}>;

function createShipView(ship: ShipState): ShipView {
  const sunk = ship.hits.every(Boolean);
  return {
    id: ship.id,
    ...ship.placement,
    hits: [...ship.hits],
    sunk,
  };
}

/**
 * Mutable board for one accepted fleet.
 *
 * Occupancy is indexed once at construction. Shots can therefore update one
 * segment without repeatedly scanning fleet placements.
 */
export class BattleBoard {
  private readonly ships: ShipState[];
  private readonly occupancy = new Map<string, OccupiedSegment>();
  private readonly shots = new Map<string, "hit" | "miss">();

  public constructor(
    fleet: ValidatedFleet,
    private readonly rules: GameRules = CLASSIC_RULESET,
    idPrefix = "ship",
  ) {
    this.ships = fleet.placements.map((placement, shipIndex) => ({
      id: `${idPrefix}-${shipIndex + 1}`,
      placement,
      hits: Array.from({ length: placement.length }, () => false),
    }));

    // Store both ship and segment indices because hit state is segment-based.
    this.ships.forEach((ship, shipIndex) => {
      placementCoordinates(ship.placement).forEach(
        (coordinate, segmentIndex) => {
          this.occupancy.set(coordinateKey(coordinate), {
            shipIndex,
            segmentIndex,
          });
        },
      );
    });
  }

  /** Whether every accepted ship has been completely hit. */
  public get allShipsSunk(): boolean {
    return this.ships.every(({ hits }) => hits.every(Boolean));
  }

  /**
   * Resolve one shot and update the board atomically.
   *
   * @param coordinate - Zero-based target cell.
   * @returns Hit information, or an expected error without mutation.
   */
  public shoot(coordinate: Coordinate): DomainResult<ShotOutcome> {
    if (!this.isInBounds(coordinate)) {
      return {
        ok: false,
        error: {
          code: "invalid_coordinate",
          message: "The target coordinate is outside the battle grid.",
        },
      };
    }

    const key = coordinateKey(coordinate);
    if (this.shots.has(key) || this.isImpossible(coordinate)) {
      return {
        ok: false,
        error: {
          code: "already_shot",
          message:
            "That coordinate is already resolved and cannot be targeted.",
        },
      };
    }

    const occupied = this.occupancy.get(key);
    if (!occupied) {
      this.shots.set(key, "miss");
      return {
        ok: true,
        value: { coordinate, hit: false, sunkShip: null },
      };
    }

    const ship = this.ships[occupied.shipIndex];
    if (!ship) {
      throw new Error("Board occupancy must refer to an existing ship.");
    }

    ship.hits[occupied.segmentIndex] = true;
    this.shots.set(key, "hit");
    const shipView = createShipView(ship);
    return {
      ok: true,
      value: {
        coordinate,
        hit: true,
        sunkShip: shipView.sunk ? shipView : null,
      },
    };
  }

  /** Return every unresolved coordinate that a player may legally target. */
  public legalTargets(): readonly Coordinate[] {
    const targets: Coordinate[] = [];
    for (let row = 0; row < this.rules.rows; row += 1) {
      for (let column = 0; column < this.rules.columns; column += 1) {
        const coordinate = { row, column };
        if (
          !this.shots.has(coordinateKey(coordinate)) &&
          !this.isImpossible(coordinate)
        ) {
          targets.push(coordinate);
        }
      }
    }
    return targets;
  }

  /** Select a uniformly random legal target for human timeout substitution. */
  public randomLegalTarget(random: RandomSource): DomainResult<Coordinate> {
    const coordinate = chooseRandom(this.legalTargets(), random);
    return coordinate
      ? { ok: true, value: coordinate }
      : {
          ok: false,
          error: {
            code: "no_legal_target",
            message: "No unresolved target remains on this board.",
          },
        };
  }

  /** Build the fleet owner's complete board view. */
  public ownView(): BoardView {
    return {
      cells: this.cellGrid(),
      ships: this.ships.map(createShipView),
      remainingShipLengths: this.remainingShipLengths(),
    };
  }

  /** Build a view containing only information legitimately known by an opponent. */
  public publicView(): BoardView {
    return {
      cells: this.cellGrid(),
      ships: this.ships.map(createShipView).filter(({ sunk }) => sunk),
      remainingShipLengths: this.remainingShipLengths(),
    };
  }

  /** Build the final view used only after a match has ended. */
  public finalView(): BoardView {
    return this.ownView();
  }

  /** Build the restricted evidence supplied to an automated opponent. */
  public opponentKnowledge(): OpponentKnowledge {
    const sunkShips = this.ships.map(createShipView).filter(({ sunk }) => sunk);
    const sunkIds = new Set(sunkShips.map(({ id }) => id));
    return {
      rows: this.rules.rows,
      columns: this.rules.columns,
      cells: this.cellGrid(),
      sunkShips,
      remainingShipLengths: this.ships
        .filter(({ id }) => !sunkIds.has(id))
        .map(({ placement }) => placement.length),
    };
  }

  private isInBounds({ row, column }: Coordinate): boolean {
    return (
      Number.isInteger(row) &&
      Number.isInteger(column) &&
      row >= 0 &&
      row < this.rules.rows &&
      column >= 0 &&
      column < this.rules.columns
    );
  }

  private remainingShipLengths(): readonly number[] {
    return this.ships
      .filter(({ hits }) => !hits.every(Boolean))
      .map(({ placement }) => placement.length);
  }

  private isImpossible(coordinate: Coordinate): boolean {
    return this.ships.some((ship) => {
      if (!ship.hits.every(Boolean)) {
        return false;
      }
      return surroundingCoordinates(ship.placement, this.rules).some(
        (surrounding) =>
          coordinateKey(surrounding) === coordinateKey(coordinate),
      );
    });
  }

  private cellGrid(): readonly (readonly CellState[])[] {
    return Array.from({ length: this.rules.rows }, (_, row) =>
      Array.from({ length: this.rules.columns }, (_, column) => {
        const coordinate = { row, column };
        return (
          this.shots.get(coordinateKey(coordinate)) ??
          (this.isImpossible(coordinate) ? "impossible" : "unknown")
        );
      }),
    );
  }
}
