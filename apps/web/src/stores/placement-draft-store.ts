/** Local-only editable fleet state before the server accepts readiness. */

import { makeAutoObservable } from "mobx";
import {
  CLASSIC_RULESET,
  generateRandomFleet,
  validatePartialFleet,
  type GameRules,
  type Orientation,
  type ShipPlacement,
} from "@battleship/game-domain";

/** Stable local ship identity plus its unsubmitted placement state. */
export type DraftShip = Readonly<{
  id: string;
  length: number;
  orientation: Orientation;
  placement: ShipPlacement | null;
}>;

/**
 * Own an unsubmitted fleet without duplicating accepted match state.
 *
 * Every placement uses the same domain validator as the server. The
 * server still validates the complete fleet when readiness is submitted.
 */
export class PlacementDraftStore {
  public ships: DraftShip[];
  public locked = false;

  public constructor(public readonly rules: GameRules = CLASSIC_RULESET) {
    this.ships = rules.fleetLengths.map((length, index) => ({
      id: `ship-${index + 1}`,
      length,
      orientation: "horizontal",
      placement: null,
    }));
    makeAutoObservable(this, { rules: false }, { autoBind: true });
  }

  public get allPlaced(): boolean {
    return this.ships.every(({ placement }) => placement !== null);
  }

  public get placements(): readonly ShipPlacement[] {
    return this.ships.flatMap(({ placement }) =>
      placement ? [placement] : [],
    );
  }

  /** Keep the vertical garage stable regardless of prior board movement. */
  public get garageShips(): readonly DraftShip[] {
    return this.ships
      .filter(({ placement }) => placement === null)
      .toSorted((first, second) =>
        second.length === first.length
          ? first.id.localeCompare(second.id)
          : second.length - first.length,
      );
  }

  /**
   * Build a bounded candidate while retaining the segment grabbed by the user.
   *
   * @returns A placement for a known ship, or `null` for an unknown ID.
   */
  public candidate(
    shipId: string,
    row: number,
    column: number,
    grabbedSegment = 0,
    orientation?: Orientation,
  ): ShipPlacement | null {
    const ship = this.ships.find(({ id }) => id === shipId);
    if (!ship) return null;
    const candidateOrientation = orientation ?? ship.orientation;
    const rowOffset = candidateOrientation === "vertical" ? grabbedSegment : 0;
    const columnOffset =
      candidateOrientation === "horizontal" ? grabbedSegment : 0;
    const maximumRow =
      this.rules.rows - (candidateOrientation === "vertical" ? ship.length : 1);
    const maximumColumn =
      this.rules.columns -
      (candidateOrientation === "horizontal" ? ship.length : 1);
    return {
      length: ship.length,
      orientation: candidateOrientation,
      headRow: Math.min(Math.max(0, row - rowOffset), maximumRow),
      headColumn: Math.min(Math.max(0, column - columnOffset), maximumColumn),
    };
  }

  /** Centre a ship on the visual clone position used by pointer dragging. */
  public centredCandidate(
    shipId: string,
    row: number,
    column: number,
    inCellPosition: Readonly<{ x: number; y: number }>,
    orientation: Orientation,
  ): ShipPlacement | null {
    const ship = this.ships.find(({ id }) => id === shipId);
    if (!ship) return null;

    // Even ships straddle a cell boundary, so the half-cell selects the nearer centre segment.
    const axisFraction =
      orientation === "horizontal" ? inCellPosition.x : inCellPosition.y;
    const centreSegment =
      Math.floor(ship.length / 2) -
      (ship.length % 2 === 0 && axisFraction >= 0.5 ? 1 : 0);
    return this.candidate(shipId, row, column, centreSegment, orientation);
  }

  /** Validate a drag candidate without changing the editable fleet. */
  public isLegalPlacement(shipId: string, placement: ShipPlacement): boolean {
    const others = this.ships.flatMap((ship) =>
      ship.id !== shipId && ship.placement ? [ship.placement] : [],
    );
    return validatePartialFleet([...others, placement], this.rules).ok;
  }

  /** Commit one already-shaped candidate through the shared semantic validator. */
  public commitPlacement(shipId: string, placement: ShipPlacement): boolean {
    if (this.locked || !this.isLegalPlacement(shipId, placement)) return false;
    this.ships = this.ships.map((ship) =>
      ship.id === shipId
        ? { ...ship, orientation: placement.orientation, placement }
        : ship,
    );
    return true;
  }

  /** Return a ship to its canonical horizontal position in the sorted garage. */
  public returnToGarage(shipId: string): boolean {
    if (this.locked) return false;
    if (!this.ships.some(({ id }) => id === shipId)) return false;
    this.ships = this.ships.map((candidate) =>
      candidate.id === shipId
        ? { ...candidate, orientation: "horizontal", placement: null }
        : candidate,
    );
    return true;
  }

  /** Replace every placement with a newly generated legal fleet. */
  public randomiseAll(): void {
    if (this.locked) return;
    const result = generateRandomFleet(undefined, [], this.rules);
    if (!result.ok) return;
    this.assignGeneratedPlacements(result.value.placements);
  }

  /** Fill only unplaced ships around the positions the player chose manually. */
  public randomiseRemaining(): void {
    if (this.locked) return;
    const placed = this.placements;
    const result = generateRandomFleet(undefined, placed, this.rules);
    if (!result.ok) return;

    const generated = [...result.value.placements.slice(placed.length)];
    this.ships = this.ships.map((ship) => {
      if (ship.placement) return ship;
      const index = generated.findIndex(({ length }) => length === ship.length);
      const placement = index >= 0 ? generated.splice(index, 1)[0] : undefined;
      return placement
        ? { ...ship, orientation: placement.orientation, placement }
        : ship;
    });
  }

  /** Return every ship to the tray. */
  public reset(): void {
    if (this.locked) return;
    this.ships = this.ships.map((ship) => ({
      ...ship,
      orientation: "horizontal",
      placement: null,
    }));
  }

  /** Freeze the draft after its complete fleet is sent to the server. */
  public lock(): void {
    if (!this.allPlaced) {
      throw new Error("An incomplete fleet cannot be locked.");
    }
    this.locked = true;
  }

  private assignGeneratedPlacements(
    placements: readonly ShipPlacement[],
  ): void {
    // Match repeated lengths by consuming each generated placement once; ship
    // IDs remain stable so React focus and drag state do not jump after a roll.
    const available = [...placements];
    this.ships = this.ships.map((ship) => {
      const index = available.findIndex(({ length }) => length === ship.length);
      const placement = index >= 0 ? available.splice(index, 1)[0] : undefined;
      if (!placement)
        throw new Error("Generated fleet does not match the ruleset.");
      return { ...ship, orientation: placement.orientation, placement };
    });
  }
}
