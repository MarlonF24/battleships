/** Delayed single-board selection for narrow player and spectator layouts. */

import { makeAutoObservable } from "mobx";
import type { LastShot } from "@battleship/contracts";
import type { Seat } from "@battleship/game-domain";

/** Time the board receiving a shot remains visible in single-board layouts. */
export const BOARD_SWITCH_DELAY_MS = 2000;

/**
 * Keep every newly shot board visible before returning to the current target.
 *
 * A shot identity comes from authoritative server state. Timer and connection
 * projections therefore cannot restart the delay, while a quick bot response
 * immediately reveals the player's newly hit board for the full hold period.
 */
export class ResponsiveBattleStore {
  public displayedSeat: Seat | null = null;
  private lastShotKey: string | null = null;
  private switchHandle: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    makeAutoObservable<this, "switchHandle">(
      this,
      { switchHandle: false },
      { autoBind: true },
    );
  }

  /**
   * Observe authoritative turn/shot state and schedule at most one board switch.
   *
   * Repeated projection revisions do nothing because shot identity, rather than
   * revision, drives the transition.
   */
  public observeBattle(targetedSeat: Seat, lastShot: LastShot | null): void {
    if (this.displayedSeat === null) {
      this.displayedSeat = targetedSeat;
      this.lastShotKey = lastShot ? this.shotKey(lastShot) : null;
      return;
    }
    if (!lastShot) return;
    const shotKey = this.shotKey(lastShot);
    if (this.lastShotKey === shotKey) return;
    this.lastShotKey = shotKey;
    this.clearPendingSwitch();

    const shotBoard = lastShot.shooter === 1 ? 2 : 1;
    this.displayedSeat = shotBoard;
    if (shotBoard === targetedSeat) return;
    this.switchHandle = globalThis.setTimeout(() => {
      this.displayedSeat = targetedSeat;
      this.switchHandle = null;
    }, BOARD_SWITCH_DELAY_MS);
  }

  /** Freeze the action-relevant board until the user requests final review. */
  public observeCompletion(fallbackSeat: Seat): void {
    this.clearPendingSwitch();
    this.displayedSeat ??= fallbackSeat;
  }

  /** Select either terminal board once live turn guidance no longer applies. */
  public selectFinalBoard(seat: Seat): void {
    this.clearPendingSwitch();
    this.displayedSeat = seat;
  }

  /** Cancel a pending visual transition when its route unmounts. */
  public dispose(): void {
    this.clearPendingSwitch();
  }

  private clearPendingSwitch(): void {
    if (this.switchHandle !== null) {
      globalThis.clearTimeout(this.switchHandle);
      this.switchHandle = null;
    }
  }

  private shotKey({ shooter, row, column }: LastShot): string {
    return `${shooter}:${row}:${column}`;
  }
}
