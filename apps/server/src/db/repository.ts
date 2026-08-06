/** PostgreSQL implementation of identities, match metadata, and result delivery. */

import { and, asc, eq, inArray, isNull, lte, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  createWebhookEvent,
  terminalOutcomes,
  type CreateStoredSeatInput,
  type CompleteStoredMatchInput,
  type DueOutboxEvent,
  type MatchRepository,
  type PlayerIdentity,
  RepositoryError,
  type StoredMatch,
  type StoredPlayer,
  type StoredSeat,
} from "../repository";
import { matches, matchSeats, players, resultOutbox } from "./schema";

type Database = ReturnType<typeof drizzle>;
type ReadDatabase = Pick<Database, "select">;
type IdentityDatabase = Pick<Database, "insert" | "select">;
type PersistenceDatabase = Pick<Database, "insert" | "select" | "update">;
type MatchRow = typeof matches.$inferSelect;
type PlayerRow = typeof players.$inferSelect;
type SeatRow = typeof matchSeats.$inferSelect;

function storedPlayer(row: PlayerRow): StoredPlayer {
  return {
    id: row.id,
    identity: { source: row.identitySource, externalId: row.externalId },
  };
}

function storedSeat(
  row: SeatRow,
  playersById: ReadonlyMap<string, PlayerRow>,
): StoredSeat {
  if (row.seat !== 1 && row.seat !== 2) {
    throw new Error("Persisted match seats must be 1 or 2.");
  }
  if (row.kind === "bot") {
    return { seat: row.seat, kind: "bot", outcome: row.outcome };
  }
  const player = row.playerId ? playersById.get(row.playerId) : undefined;
  if (!player || !row.capability) {
    throw new Error(
      "A persisted human seat must have a player and seat capability.",
    );
  }
  return {
    seat: row.seat,
    kind: "human",
    player: storedPlayer(player),
    capability: row.capability,
    outcome: row.outcome,
  };
}

function combineMatch(
  row: MatchRow,
  seatRows: readonly SeatRow[],
  playerRows: readonly PlayerRow[],
): StoredMatch {
  const playersById = new Map(playerRows.map((player) => [player.id, player]));
  const ordered = [...seatRows].sort((left, right) => left.seat - right.seat);
  const first = ordered[0];
  const second = ordered[1];
  if (first?.seat !== 1) {
    throw new Error("Every persisted match must contain seat one.");
  }
  if (second && second.seat !== 2) {
    throw new Error("A persisted second match seat must be seat two.");
  }

  return {
    id: row.id,
    hubMatchId: row.hubMatchId,
    hubRequest: row.hubRequest,
    source: row.source,
    mode: row.mode,
    phase: row.phase,
    seats: [
      storedSeat(first, playersById),
      second ? storedSeat(second, playersById) : null,
    ],
    winnerSeat:
      row.winnerSeat === 1 || row.winnerSeat === 2 ? row.winnerSeat : null,
    terminalReason: row.terminalReason,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

async function loadMatch(
  database: ReadDatabase,
  predicate: ReturnType<typeof eq>,
): Promise<StoredMatch | null> {
  const [row] = await database.select().from(matches).where(predicate).limit(1);
  if (!row) return null;

  const seatRows = await database
    .select()
    .from(matchSeats)
    .where(eq(matchSeats.matchId, row.id));
  const playerIds = seatRows.flatMap(({ playerId }) =>
    playerId ? [playerId] : [],
  );
  const playerRows =
    playerIds.length > 0
      ? await database
          .select()
          .from(players)
          .where(inArray(players.id, playerIds))
      : [];
  return combineMatch(row, seatRows, playerRows);
}

async function upsertPlayer(
  database: IdentityDatabase,
  identity: PlayerIdentity,
): Promise<string> {
  const [inserted] = await database
    .insert(players)
    .values({
      id: crypto.randomUUID(),
      identitySource: identity.source,
      externalId: identity.externalId,
    })
    .onConflictDoNothing({
      target: [players.identitySource, players.externalId],
    })
    .returning({ id: players.id });
  if (inserted) return inserted.id;

  const [existing] = await database
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.identitySource, identity.source),
        eq(players.externalId, identity.externalId),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new Error("A player identity could not be resolved after upsert.");
  }
  return existing.id;
}

function seatRow(
  matchId: string,
  seat: CreateStoredSeatInput,
  playerId: string | null,
): typeof matchSeats.$inferInsert {
  return seat.kind === "human"
    ? {
        matchId,
        seat: seat.seat,
        kind: seat.kind,
        playerId,
        capability: seat.capability,
      }
    : { matchId, seat: seat.seat, kind: seat.kind };
}

/** Complete one locked match and create its optional hub event atomically. */
async function completeStoredMatch(
  database: PersistenceDatabase,
  input: CompleteStoredMatchInput,
): Promise<void> {
  const existing = await loadMatch(database, eq(matches.id, input.matchId));
  if (!existing) {
    throw new RepositoryError("match_not_found", "Match not found.");
  }
  if (existing.phase === "completed") return;

  const completedAt = new Date();
  const outcomes = terminalOutcomes(input.winnerSeat);
  await database
    .update(matches)
    .set({
      phase: "completed",
      winnerSeat: input.winnerSeat,
      terminalReason: input.reason,
      updatedAt: completedAt,
      completedAt,
    })
    .where(eq(matches.id, input.matchId));
  await Promise.all(
    ([1, 2] as const).map((seat) =>
      database
        .update(matchSeats)
        .set({ outcome: outcomes[seat - 1] })
        .where(
          and(eq(matchSeats.matchId, input.matchId), eq(matchSeats.seat, seat)),
        ),
    ),
  );

  // Persist the integration event in the same transaction as terminal state.
  const event = createWebhookEvent(
    existing,
    input.reason,
    input.winnerSeat,
    completedAt,
  );
  if (event) {
    await database.insert(resultOutbox).values({
      eventId: event.eventId,
      matchId: input.matchId,
      payload: event,
    });
  }
}

/** Create the Drizzle repository and its underlying postgres.js connection. */
export function createPostgresRepository(databaseUrl: string): MatchRepository {
  const client = postgres(databaseUrl, { max: 10 });
  const database = drizzle(client);

  const repository: MatchRepository = {
    async checkReady() {
      // Query an application table so readiness also proves the schema exists.
      await database.select({ id: matches.id }).from(matches).limit(1);
    },

    async createMatch(input) {
      await database.transaction(async (transaction) => {
        // Resolve durable identities before inserting seats in the same transaction.
        const resolved = new Map<number, string>();
        for (const seat of input.seats) {
          if (seat?.kind === "human") {
            resolved.set(
              seat.seat,
              await upsertPlayer(transaction, seat.identity),
            );
          }
        }

        await transaction.insert(matches).values({
          id: input.id,
          hubMatchId: input.hubMatchId,
          hubRequest: input.hubRequest,
          source: input.source,
          mode: input.mode,
        });
        await transaction
          .insert(matchSeats)
          .values(
            input.seats.flatMap((seat) =>
              seat
                ? [seatRow(input.id, seat, resolved.get(seat.seat) ?? null)]
                : [],
            ),
          );
      });

      const created = await repository.findMatch(input.id);
      if (!created)
        throw new Error("A committed match could not be read back.");
      return created;
    },

    findMatch(matchId) {
      return loadMatch(database, eq(matches.id, matchId));
    },

    findHubMatch(hubMatchId) {
      return loadMatch(database, eq(matches.hubMatchId, hubMatchId));
    },

    async joinMatch(matchId, identity, capability) {
      await database.transaction(async (transaction) => {
        // Lock admission so concurrent joiners cannot both observe an open seat.
        const [match] = await transaction
          .select()
          .from(matches)
          .where(eq(matches.id, matchId))
          .for("update");
        if (!match) {
          throw new RepositoryError("match_not_found", "Match not found.");
        }
        if (match.phase !== "placement") {
          throw new RepositoryError(
            "match_closed",
            "This match can no longer be joined.",
          );
        }

        const seatRows = await transaction
          .select()
          .from(matchSeats)
          .where(eq(matchSeats.matchId, matchId));
        const playerRows = await transaction
          .select()
          .from(players)
          .where(
            and(
              eq(players.identitySource, identity.source),
              eq(players.externalId, identity.externalId),
            ),
          );
        const player = playerRows[0];
        const existingSeat = player
          ? seatRows.find(({ playerId }) => playerId === player.id)
          : undefined;
        if (existingSeat?.seat === 2) return;
        if (existingSeat?.seat === 1) {
          throw new RepositoryError(
            "already_participating",
            "You already control seat one in this match.",
          );
        }
        if (seatRows.some(({ seat }) => seat === 2)) {
          throw new RepositoryError(
            "match_full",
            "This match already has two seats.",
          );
        }

        const playerId =
          player?.id ?? (await upsertPlayer(transaction, identity));
        await transaction.insert(matchSeats).values({
          matchId,
          seat: 2,
          kind: "human",
          playerId,
          capability,
        });
      });

      const joined = await repository.findMatch(matchId);
      if (!joined) throw new Error("A joined match could not be read back.");
      return joined;
    },

    async markBattleStarted(matchId) {
      const now = new Date();
      await database
        .update(matches)
        .set({ phase: "battle", startedAt: now, updatedAt: now })
        .where(and(eq(matches.id, matchId), eq(matches.phase, "placement")));
    },

    async touchMatch(matchId) {
      await database
        .update(matches)
        .set({ updatedAt: new Date() })
        .where(eq(matches.id, matchId));
    },

    async completeMatch(input) {
      await database.transaction((transaction) =>
        completeStoredMatch(transaction, input),
      );

      const completed = await repository.findMatch(input.matchId);
      if (!completed)
        throw new Error("A completed match could not be read back.");
      return completed;
    },

    async abortNonterminalMatches() {
      const ids = await database.transaction(async (transaction) => {
        // One lock and transaction make startup recovery an all-or-nothing cut.
        const rows = await transaction
          .select({ id: matches.id })
          .from(matches)
          .where(ne(matches.phase, "completed"))
          .for("update");
        for (const { id } of rows) {
          await completeStoredMatch(transaction, {
            matchId: id,
            winnerSeat: null,
            reason: "server_restart",
          });
        }
        return rows.map(({ id }) => id);
      });
      return Promise.all(
        ids.map(async (id) => {
          const match = await repository.findMatch(id);
          if (!match)
            throw new Error("A recovered match could not be read back.");
          return match;
        }),
      );
    },

    async dueOutboxEvents(now) {
      const rows = await database
        .select()
        .from(resultOutbox)
        .where(
          and(
            isNull(resultOutbox.deliveredAt),
            lte(resultOutbox.nextAttemptAt, now),
          ),
        )
        .orderBy(asc(resultOutbox.nextAttemptAt));
      return rows.map(({ eventId, payload, attemptCount }): DueOutboxEvent => ({
        eventId,
        payload,
        attemptCount,
      }));
    },

    async markOutboxDelivered(eventId, deliveredAt) {
      await database
        .update(resultOutbox)
        .set({ deliveredAt, lastError: null })
        .where(eq(resultOutbox.eventId, eventId));
    },

    async markOutboxFailed(eventId, attemptCount, nextAttemptAt, error) {
      await database
        .update(resultOutbox)
        .set({ attemptCount, nextAttemptAt, lastError: error })
        .where(eq(resultOutbox.eventId, eventId));
    },

    async close() {
      await client.end();
    },
  };

  return repository;
}
