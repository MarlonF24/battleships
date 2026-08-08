/** Classic ruleset constants and declarative turn-mode policies. */

import {
  GAME_MODES,
  ORIENTATIONS,
  type GameMode,
  type Orientation,
} from "./types";

export type GameRules = Readonly<{
  rows: number;
  columns: number;
  fleetLengths: readonly number[];
  modes: readonly GameMode[];
  orientations: readonly Orientation[];
  salvoShots: number;
  placementTimeoutMs: number;
  shotTimeoutMs: number;
  reconnectTimeoutMs: number;
  battleStartDelayMs: number;
  botActionDelayMs: number;
}>;

/**
 * The single ruleset supported by the application.
 *
 * Keeping the board, fleet, and pacing together prevents clients, bots, and
 * servers from silently drifting onto different variants of the game.
 */
export const CLASSIC_RULESET: GameRules = Object.freeze({
  rows: 10,
  columns: 10,
  fleetLengths: Object.freeze([5, 4, 4, 3, 3, 3, 2, 2, 2, 2]),
  modes: GAME_MODES,
  orientations: ORIENTATIONS,
  salvoShots: 3,
  placementTimeoutMs: 40_000,
  shotTimeoutMs: 10_000,
  reconnectTimeoutMs: 8_000,
  battleStartDelayMs: 1_500,
  botActionDelayMs: 500,
});

/** Return the number of shots initially available in a turn. */
export function shotsPerTurn(mode: GameMode): number {
  return mode === "salvo" ? CLASSIC_RULESET.salvoShots : 1;
}

/** Decide whether the current shooter retains the turn after a shot. */
export function retainsTurn(
  mode: GameMode,
  hit: boolean,
  shotsRemaining: number,
): boolean {
  if (mode === "streak") {
    return hit;
  }

  return mode === "salvo" && shotsRemaining > 0;
}
