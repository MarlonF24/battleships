/** Transient pointer and keyboard state for legacy clone-based fleet dragging. */

import { makeAutoObservable } from "mobx";
import type { Orientation, ShipPlacement } from "@battleship/game-domain";
import { PlacementDraftStore, type DraftShip } from "./placement-draft-store";

/** Input mechanism currently owning the provisional placement session. */
export type DragStatus = "idle" | "pointer" | "keyboard";

type DragCloneRectangle = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

/**
 * Hold provisional drag state separately from the editable fleet.
 *
 * Rotation, movement, and cancellation therefore cannot mutate a ship until a
 * legal drop is committed through `PlacementDraftStore`.
 */
export class PlacementDragSession {
  public activeShipId: string | null = null;
  public pointerId: number | null = null;
  public pointerType: string | null = null;
  public originalOrientation: Orientation | null = null;
  public activeOrientation: Orientation = "horizontal";
  public rotationDegrees = 0;
  public grabbedSegment = 0;
  public clientX = 0;
  public clientY = 0;
  public cellSize = 30;
  public suggestion: ShipPlacement | null = null;
  public suggestionLegal = false;
  public overGarage = false;
  public targetRow: number | null = null;
  public targetColumn: number | null = null;
  public targetCellPosition: Readonly<{ x: number; y: number }> | null = null;
  public status: DragStatus = "idle";
  public announcement = "";

  public constructor(private readonly draft: PlacementDraftStore) {
    makeAutoObservable<this, "draft">(
      this,
      { draft: false },
      { autoBind: true },
    );
  }

  public get active(): boolean {
    return this.status !== "idle";
  }

  public get activeShip(): DraftShip | null {
    return this.draft.ships.find(({ id }) => id === this.activeShipId) ?? null;
  }

  /** Keep the rotating clone's untransformed box and centre in one place. */
  public get cloneRectangle(): DragCloneRectangle | null {
    const ship = this.activeShip;
    if (!ship || this.originalOrientation === null) return null;
    const horizontal = this.originalOrientation === "horizontal";
    const width = this.cellSize * (horizontal ? ship.length : 1);
    const height = this.cellSize * (horizontal ? 1 : ship.length);
    return {
      left:
        this.clientX -
        (horizontal
          ? (this.grabbedSegment + 0.5) * this.cellSize
          : this.cellSize / 2),
      top:
        this.clientY -
        (horizontal
          ? this.cellSize / 2
          : (this.grabbedSegment + 0.5) * this.cellSize),
      width,
      height,
    };
  }

  public get cloneCentre(): Readonly<{ x: number; y: number }> | null {
    const rectangle = this.cloneRectangle;
    return rectangle
      ? {
          x: rectangle.left + rectangle.width / 2,
          y: rectangle.top + rectangle.height / 2,
        }
      : null;
  }

  /** Begin one primary-pointer drag while retaining the original ship state. */
  public beginPointer(
    shipId: string,
    grabbedSegment: number,
    event: PointerEvent,
    cellSize: number,
  ): boolean {
    if (this.active || this.draft.locked || event.button !== 0) return false;
    const ship = this.draft.ships.find(({ id }) => id === shipId);
    if (!ship) return false;
    this.begin(ship, grabbedSegment, cellSize, "pointer");
    this.pointerId = event.pointerId;
    this.pointerType = event.pointerType;
    this.updatePointer(event);
    this.announcement = `Picked up the length-${ship.length} ship.`;
    return true;
  }

  /** Begin keyboard placement at the ship's head or the first board cell. */
  public beginKeyboard(shipId: string, cellSize: number): boolean {
    if (this.active || this.draft.locked) return false;
    const ship = this.draft.ships.find(({ id }) => id === shipId);
    if (!ship) return false;
    this.begin(ship, 0, cellSize, "keyboard");
    const row = ship.placement?.headRow ?? 0;
    const column = ship.placement?.headColumn ?? 0;
    this.suggestAt(row, column);
    this.announcement = `Picked up the length-${ship.length} ship.`;
    return true;
  }

  public updatePointer(event: PointerEvent): void {
    if (this.status !== "pointer" || event.pointerId !== this.pointerId) return;
    this.clientX = event.clientX;
    this.clientY = event.clientY;
  }

  /** Recompute a board suggestion around a keyboard anchor or clone centre. */
  public suggestAt(
    row: number,
    column: number,
    inCellPosition?: Readonly<{ x: number; y: number }>,
  ): void {
    if (!this.activeShipId) return;
    const clampedRow = Math.min(Math.max(0, row), this.draft.rules.rows - 1);
    const clampedColumn = Math.min(
      Math.max(0, column),
      this.draft.rules.columns - 1,
    );
    const candidate = inCellPosition
      ? this.draft.centredCandidate(
          this.activeShipId,
          clampedRow,
          clampedColumn,
          inCellPosition,
          this.activeOrientation,
        )
      : this.draft.candidate(
          this.activeShipId,
          clampedRow,
          clampedColumn,
          this.grabbedSegment,
          this.activeOrientation,
        );
    this.overGarage = false;
    this.targetRow = clampedRow;
    this.targetColumn = clampedColumn;
    this.targetCellPosition = inCellPosition ?? null;
    this.suggestion = candidate;
    this.suggestionLegal =
      candidate !== null &&
      this.draft.isLegalPlacement(this.activeShipId, candidate);
    const coordinate = `${String.fromCharCode(65 + clampedColumn)}${clampedRow + 1}`;
    this.announcement = `${coordinate}: ${this.suggestionLegal ? "legal" : "illegal"} placement.`;
  }

  /** Mark the garage as a legal drop that removes the board placement. */
  public suggestGarage(): void {
    this.overGarage = true;
    this.targetRow = null;
    this.targetColumn = null;
    this.targetCellPosition = null;
    this.suggestion = null;
    this.suggestionLegal = this.activeShip !== null;
    this.announcement = "Return ship to the garage.";
  }

  /** Clear a stale board/garage suggestion when the pointer leaves both. */
  public clearTarget(): void {
    this.overGarage = false;
    this.targetRow = null;
    this.targetColumn = null;
    this.targetCellPosition = null;
    this.suggestion = null;
    this.suggestionLegal = false;
  }

  /** Rotate only the clone and suggestion; the source ship stays unchanged. */
  public rotate(
    direction: "clockwise" | "counterclockwise" = "clockwise",
  ): void {
    if (!this.active) return;
    this.activeOrientation =
      this.activeOrientation === "horizontal" ? "vertical" : "horizontal";
    this.rotationDegrees += direction === "clockwise" ? 90 : -90;
    if (this.targetRow !== null && this.targetColumn !== null) {
      this.suggestAt(
        this.targetRow,
        this.targetColumn,
        this.targetCellPosition ?? undefined,
      );
    }
    this.announcement = `Rotated ship ${this.activeOrientation}.`;
  }

  /** Move a keyboard suggestion by one clamped board cell. */
  public moveKeyboard(rowDelta: number, columnDelta: number): void {
    if (this.status !== "keyboard") return;
    const row = (this.targetRow ?? 0) + rowDelta;
    const column = (this.targetColumn ?? 0) + columnDelta;
    this.suggestAt(row, column);
  }

  /** Commit exactly one legal board or garage drop, then clear transient state. */
  public commit(): boolean {
    if (!this.activeShipId || !this.suggestionLegal) {
      this.cancel("Placement cancelled.");
      return false;
    }
    const committed = this.overGarage
      ? this.draft.returnToGarage(this.activeShipId)
      : this.suggestion !== null &&
        this.draft.commitPlacement(this.activeShipId, this.suggestion);
    this.announcement = committed ? "Ship placed." : "Placement cancelled.";
    this.reset();
    return committed;
  }

  /** Restore the exact source state by discarding all provisional data. */
  public cancel(message = "Placement cancelled."): void {
    if (this.active) this.announcement = message;
    this.reset();
  }

  private begin(
    ship: DraftShip,
    grabbedSegment: number,
    cellSize: number,
    status: Exclude<DragStatus, "idle">,
  ): void {
    // Copy only source geometry into transient state; the draft remains exactly
    // unchanged until `commit` validates and applies the final candidate.
    this.activeShipId = ship.id;
    this.originalOrientation = ship.orientation;
    this.activeOrientation = ship.orientation;
    this.grabbedSegment = grabbedSegment;
    this.cellSize = cellSize;
    this.status = status;
  }

  private reset(): void {
    // One reset path makes pointer-up, Escape, cancellation, and invalid drops
    // clean the same transient fields without partial lifecycle states.
    this.activeShipId = null;
    this.pointerId = null;
    this.pointerType = null;
    this.originalOrientation = null;
    this.activeOrientation = "horizontal";
    this.rotationDegrees = 0;
    this.grabbedSegment = 0;
    this.suggestion = null;
    this.suggestionLegal = false;
    this.overGarage = false;
    this.targetRow = null;
    this.targetColumn = null;
    this.targetCellPosition = null;
    this.status = "idle";
  }
}
