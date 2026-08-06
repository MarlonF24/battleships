/** Persistence contracts for durable identities, match metadata, and results. */

import type {
  HubCreateMatchRequest,
  HubSeatDescriptor,
  WebhookEvent,
} from "@battleship/contracts";
import type {
  CompletionReason,
  GameMode,
  Seat,
  SeatDescriptor,
} from "@battleship/game-domain";

export type MatchSource = "standalone" | "hub";
export type MatchPhase = "placement" | "battle" | "completed";
export type MatchOutcome = "win" | "loss" | "premature";
export type PlayerIdentitySource = "standalone" | "hub";

/** Durable identity used for match-history attribution, never seat access. */
export type PlayerIdentity = Readonly<{
  source: PlayerIdentitySource;
  externalId: string;
}>;

export type StoredPlayer = Readonly<{
  id: string;
  identity: PlayerIdentity;
}>;

export type StoredHumanSeat = Readonly<{
  seat: Seat;
  kind: "human";
  player: StoredPlayer;
  capability: string;
  outcome: MatchOutcome | null;
}>;

export type StoredBotSeat = Readonly<{
  seat: Seat;
  kind: "bot";
  outcome: MatchOutcome | null;
}>;

export type StoredSeat = StoredHumanSeat | StoredBotSeat;

/** Expected persistence conflict surfaced through the lifecycle HTTP API. */
export class RepositoryError extends Error {
  public constructor(
    public readonly code:
      | "already_participating"
      | "match_not_found"
      | "match_closed"
      | "match_full",
    message: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

/** Complete durable metadata needed to create an in-memory session. */
export type StoredMatch = Readonly<{
  id: string;
  hubMatchId: string | null;
  hubRequest: HubCreateMatchRequest | null;
  source: MatchSource;
  mode: GameMode;
  phase: MatchPhase;
  seats: readonly [StoredSeat, StoredSeat | null];
  winnerSeat: Seat | null;
  terminalReason: CompletionReason | null;
  createdAt: Date;
  startedAt: Date | null;
  updatedAt: Date;
  completedAt: Date | null;
}>;

export type CreateStoredSeatInput =
  | Readonly<{
      seat: Seat;
      kind: "human";
      identity: PlayerIdentity;
      capability: string;
    }>
  | Readonly<{ seat: Seat; kind: "bot" }>;

export type CreateStoredMatchInput = Readonly<{
  id: string;
  hubMatchId: string | null;
  hubRequest: HubCreateMatchRequest | null;
  source: MatchSource;
  mode: GameMode;
  seats: readonly [CreateStoredSeatInput, CreateStoredSeatInput | null];
}>;

export type CompleteStoredMatchInput = Readonly<{
  matchId: string;
  winnerSeat: Seat | null;
  reason: CompletionReason;
}>;

export type DueOutboxEvent = Readonly<{
  eventId: string;
  payload: WebhookEvent;
  attemptCount: number;
}>;

/** Convert persistence metadata into the framework-free participant shape. */
export function domainDescriptor(seat: StoredSeat): SeatDescriptor {
  return { kind: seat.kind };
}

/** Return the external descriptor required by hub status and result payloads. */
export function hubDescriptor(seat: StoredSeat): HubSeatDescriptor {
  if (seat.kind === "bot") return { kind: "bot" };
  if (seat.player.identity.source !== "hub") {
    throw new Error("Hub matches must reference hub-scoped human identities.");
  }
  return { kind: "human", playerId: seat.player.identity.externalId };
}

/** Durable operations required by session and lifecycle orchestration. */
export type MatchRepository = Readonly<{
  checkReady: () => Promise<void>;
  createMatch: (input: CreateStoredMatchInput) => Promise<StoredMatch>;
  findMatch: (matchId: string) => Promise<StoredMatch | null>;
  findHubMatch: (hubMatchId: string) => Promise<StoredMatch | null>;
  joinMatch: (
    matchId: string,
    identity: PlayerIdentity,
    capability: string,
  ) => Promise<StoredMatch>;
  markBattleStarted: (matchId: string) => Promise<void>;
  touchMatch: (matchId: string) => Promise<void>;
  completeMatch: (input: CompleteStoredMatchInput) => Promise<StoredMatch>;
  abortNonterminalMatches: () => Promise<readonly StoredMatch[]>;
  dueOutboxEvents: (now: Date) => Promise<readonly DueOutboxEvent[]>;
  markOutboxDelivered: (eventId: string, deliveredAt: Date) => Promise<void>;
  markOutboxFailed: (
    eventId: string,
    attemptCount: number,
    nextAttemptAt: Date,
    error: string,
  ) => Promise<void>;
  close: () => Promise<void>;
}>;

/** Derive ordered per-seat outcomes from the terminal winner. */
export function terminalOutcomes(
  winnerSeat: Seat | null,
): readonly [MatchOutcome, MatchOutcome] {
  if (winnerSeat === null) return ["premature", "premature"];
  return winnerSeat === 1 ? ["win", "loss"] : ["loss", "win"];
}

/**
 * Create the stable outbox payload for a completed hub match.
 *
 * @returns `null` for standalone/incomplete metadata because only the hub owns
 * external ratings and therefore receives completion callbacks.
 */
export function createWebhookEvent(
  match: StoredMatch,
  reason: CompletionReason,
  winnerSeat: Seat | null,
  completedAt: Date,
): WebhookEvent | null {
  if (!match.hubMatchId || !match.seats[1]) return null;

  const outcomes = terminalOutcomes(winnerSeat);
  return {
    eventId: crypto.randomUUID(),
    type: "battleship.match.completed",
    hubMatchId: match.hubMatchId,
    matchId: match.id,
    mode: match.mode,
    completedAt: completedAt.toISOString(),
    terminalReason: reason,
    seats: [
      {
        seat: 1,
        descriptor: hubDescriptor(match.seats[0]),
        outcome: outcomes[0],
      },
      {
        seat: 2,
        descriptor: hubDescriptor(match.seats[1]),
        outcome: outcomes[1],
      },
    ],
  };
}
