/** Drizzle schema for durable match metadata, results, and webhook delivery. */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  HubCreateMatchRequest,
  WebhookEvent,
} from "@battleship/contracts";

/** Database enums mirror stable persisted lifecycle values, not wire schemas. */
export const matchSourceEnum = pgEnum("match_source", ["standalone", "hub"]);
export const playerIdentitySourceEnum = pgEnum("player_identity_source", [
  "standalone",
  "hub",
]);
export const matchModeEnum = pgEnum("match_mode", [
  "singleShot",
  "salvo",
  "streak",
]);
export const matchPhaseEnum = pgEnum("match_phase", [
  "placement",
  "battle",
  "completed",
]);
export const seatKindEnum = pgEnum("seat_kind", ["human", "bot"]);
export const outcomeEnum = pgEnum("match_outcome", [
  "win",
  "loss",
  "premature",
]);
export const completionReasonEnum = pgEnum("completion_reason", [
  "fleet_destroyed",
  "no_players_connected",
  "server_restart",
  "placement_expired",
  "battle_expired",
]);

/** Durable, namespaced identities used only for match-history attribution. */
export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey(),
    identitySource: playerIdentitySourceEnum("identity_source").notNull(),
    externalId: uuid("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("players_identity_unique").on(
      table.identitySource,
      table.externalId,
    ),
  ],
);

/** Match metadata and terminal result; active board state stays in memory. */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey(),
    hubMatchId: uuid("hub_match_id"),
    hubRequest: jsonb("hub_request").$type<HubCreateMatchRequest>(),
    source: matchSourceEnum("source").notNull(),
    mode: matchModeEnum("mode").notNull(),
    phase: matchPhaseEnum("phase").notNull().default("placement"),
    winnerSeat: integer("winner_seat"),
    terminalReason: completionReasonEnum("terminal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("matches_hub_match_id_unique").on(table.hubMatchId),
    index("matches_nonterminal_activity_idx").on(table.phase, table.updatedAt),
    check(
      "matches_winner_seat_check",
      sql`${table.winnerSeat} is null or ${table.winnerSeat} in (1, 2)`,
    ),
  ],
);

/** Ordered participants and their unguessable human-seat tokens. */
export const matchSeats = pgTable(
  "match_seats",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    seat: integer("seat").notNull(),
    kind: seatKindEnum("kind").notNull(),
    playerId: uuid("player_id").references(() => players.id),
    seatToken: uuid("seat_token"),
    outcome: outcomeEnum("outcome"),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.seat] }),
    uniqueIndex("match_seats_human_unique").on(table.matchId, table.playerId),
    uniqueIndex("match_seats_seat_token_unique").on(table.seatToken),
    check("match_seats_number_check", sql`${table.seat} in (1, 2)`),
    check(
      "match_seats_kind_access_check",
      sql`(${table.kind} = 'human' and ${table.playerId} is not null and ${table.seatToken} is not null) or (${table.kind} = 'bot' and ${table.playerId} is null and ${table.seatToken} is null)`,
    ),
  ],
);

/** Transactional queue that makes hub result delivery restart-safe. */
export const resultOutbox = pgTable(
  "result_outbox",
  {
    eventId: uuid("event_id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<WebhookEvent>().notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (table) => [
    index("result_outbox_due_idx").on(table.deliveredAt, table.nextAttemptAt),
  ],
);
