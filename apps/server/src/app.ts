/** Elysia HTTP and WebSocket boundary for standalone and hub clients. */

import { timingSafeEqual } from "node:crypto";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { Type } from "@sinclair/typebox";
import type { Logger } from "pino";
import {
  ApiErrorSchema,
  CreateMatchRequestSchema,
  CreateMatchResponseSchema,
  HubCreateMatchRequestSchema,
  HubCreateMatchResponseSchema,
  HubMatchStatusSchema,
  JoinMatchRequestSchema,
  JoinMatchResponseSchema,
  PlayerCommandSchema,
  ServerMessageSchema,
  UuidSchema,
  type HubCreateMatchRequest,
  type HubCreateMatchResponse,
  type HubMatchStatus,
  type CreateMatchResponse,
  type JoinMatchResponse,
} from "@battleship/contracts";
import type { AppConfig } from "./config";
import { MatchService } from "./match-service";
import {
  hubDescriptor,
  RepositoryError,
  type MatchRepository,
  type StoredMatch,
  type StoredSeat,
} from "./repository";
import type { MatchSessionRegistry } from "./session/registry";

const strict = { additionalProperties: false } as const;
const MatchParamsSchema = Type.Object({ matchId: UuidSchema }, strict);
const HubMatchParamsSchema = Type.Object({ hubMatchId: UuidSchema }, strict);
const PlayerQuerySchema = Type.Object({ seatToken: UuidSchema }, strict);
const HealthSchema = Type.Object({ status: Type.Literal("ok") }, strict);

type AppDependencies = Readonly<{
  config: AppConfig;
  repository: MatchRepository;
  registry: MatchSessionRegistry;
  logger: Logger;
}>;

function playerPath(matchId: string, capability: string): string {
  return `/matches/${matchId}/player/${capability}`;
}

function spectatorPath(matchId: string): string {
  return `/spectate/${matchId}`;
}

/** Convert a stored standalone match into its strict opponent-specific union. */
function createResponse(match: StoredMatch): CreateMatchResponse {
  if (match.seats[0].kind !== "human") {
    throw new Error("A standalone match must have a human first seat.");
  }
  const common = {
    matchId: match.id,
    playerUrl: playerPath(match.id, match.seats[0].capability),
    spectatorUrl: spectatorPath(match.id),
  };
  return match.seats[1]
    ? { ...common, kind: "botMatch" }
    : {
        ...common,
        kind: "humanMatch",
        joinUrl: `/join/${match.id}`,
      };
}

/** Return seat two's capability URL after the atomic join succeeds. */
function joinResponse(match: StoredMatch): JoinMatchResponse {
  const second = match.seats[1];
  if (second?.kind !== "human") {
    throw new Error("A joined match must contain a human seat two.");
  }
  return {
    matchId: match.id,
    playerUrl: playerPath(match.id, second.capability),
    spectatorUrl: spectatorPath(match.id),
  };
}

/** Build hub links while keeping capabilities out of participant metadata. */
function hubResponse(match: StoredMatch): HubCreateMatchResponse {
  if (!match.hubMatchId || !match.seats[1]) {
    throw new Error("A hub match must have an external ID and two seats.");
  }

  const seatLink = (
    storedSeat: StoredSeat,
  ): HubCreateMatchResponse["seats"][number] =>
    storedSeat.kind === "human"
      ? {
          seat: storedSeat.seat,
          kind: "human",
          playerId: storedSeat.player.identity.externalId,
          playerUrl: playerPath(match.id, storedSeat.capability),
        }
      : { seat: storedSeat.seat, kind: "bot" };

  return {
    matchId: match.id,
    hubMatchId: match.hubMatchId,
    seats: [seatLink(match.seats[0]), seatLink(match.seats[1])],
    spectatorUrl: spectatorPath(match.id),
    resultUrl: `/api/v1/hub/matches/${match.hubMatchId}`,
  };
}

/** Project durable match metadata for hub polling without any live board data. */
function hubStatus(match: StoredMatch): HubMatchStatus {
  if (!match.hubMatchId || !match.seats[1]) {
    throw new Error("A hub status requires a complete hub match record.");
  }
  const seatStatus = (
    storedSeat: StoredSeat,
  ): HubMatchStatus["seats"][number] => ({
    seat: storedSeat.seat,
    descriptor: hubDescriptor(storedSeat),
    outcome: storedSeat.outcome,
  });
  return {
    matchId: match.id,
    hubMatchId: match.hubMatchId,
    mode: match.mode,
    phase: match.phase,
    seats: [seatStatus(match.seats[0]), seatStatus(match.seats[1])],
    winnerSeat: match.winnerSeat,
    terminalReason: match.terminalReason,
    createdAt: match.createdAt.toISOString(),
    startedAt: match.startedAt?.toISOString() ?? null,
    completedAt: match.completedAt?.toISOString() ?? null,
  };
}

/** Compare idempotent hub inputs semantically rather than by JSON formatting. */
function sameHubRequest(
  left: HubCreateMatchRequest | null,
  right: HubCreateMatchRequest,
): boolean {
  if (left?.hubMatchId !== right.hubMatchId || left.mode !== right.mode) {
    return false;
  }
  return left.seats.every((seat, index) => {
    const other = right.seats[index];
    return (
      other?.kind === seat.kind &&
      (seat.kind === "bot" ||
        (other.kind === "human" && other.playerId === seat.playerId))
    );
  });
}

/** Validate the configured bearer token without content-dependent comparison. */
function hubAuthorization(
  config: AppConfig,
  authorization: string | null,
): "unavailable" | "unauthorized" | null {
  if (!config.hub.enabled) return "unavailable";
  const expected = Buffer.from(`Bearer ${config.hub.sharedToken}`);
  const actual = Buffer.from(authorization ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? null
    : "unauthorized";
}

/**
 * Compose the validated HTTP and WebSocket boundary without opening a port.
 *
 * Keeping construction separate from process startup lets integration tests
 * exercise the exact production routes with injected persistence and sessions.
 *
 * @param dependencies - Validated configuration and application services.
 * @returns An Elysia application ready to be mounted, tested, or listened on.
 */
export function createApp({
  config,
  repository,
  registry,
  logger,
}: AppDependencies) {
  const matchService = new MatchService(repository, registry);
  return new Elysia({
    websocket: {
      idleTimeout: 30,
      maxPayloadLength: 64 * 1_024,
    },
  })
    .use(
      cors({
        origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
      }),
    )
    .use(
      openapi({
        path: "/openapi",
        documentation: {
          info: {
            title: "Battleship API",
            version: "1.0.0",
            description:
              "Standalone match lifecycle, provisional hub integration, and live WebSocket contracts.",
          },
        },
      }),
    )
    .onError(({ code, error, status }) => {
      if (code === "VALIDATION") {
        return status(400, {
          code: "invalid_request",
          message: "The request does not match the documented schema.",
        });
      }
      logger.error({ code, cause: error }, "Unhandled request error");
      return status(500, {
        code: "internal_error",
        message: "The server could not complete this request.",
      });
    })
    .get("/health/live", () => ({ status: "ok" as const }), {
      response: HealthSchema,
      detail: { tags: ["Operations"] },
    })
    .get(
      "/health/ready",
      async ({ status }) => {
        try {
          await repository.checkReady();
          return { status: "ok" as const };
        } catch (cause) {
          logger.warn({ cause }, "Readiness check failed");
          return status(503, {
            code: "not_ready",
            message: "Database access or the required schema is unavailable.",
          });
        }
      },
      {
        response: { 200: HealthSchema, 503: ApiErrorSchema },
        detail: { tags: ["Operations"] },
      },
    )
    .post(
      "/api/v1/matches",
      async ({ body, status }) => {
        const match = await matchService.createStandalone(body);
        return status(201, createResponse(match));
      },
      {
        body: CreateMatchRequestSchema,
        response: { 201: CreateMatchResponseSchema },
        detail: { tags: ["Standalone"] },
      },
    )
    .post(
      "/api/v1/matches/:matchId/join",
      async ({ params, body, status }) => {
        try {
          const match = await matchService.joinStandalone(params.matchId, body);
          return joinResponse(match);
        } catch (cause) {
          if (cause instanceof RepositoryError) {
            return status(cause.code === "match_not_found" ? 404 : 409, {
              code: cause.code,
              message: cause.message,
            });
          }
          throw cause;
        }
      },
      {
        params: MatchParamsSchema,
        body: JoinMatchRequestSchema,
        response: {
          200: JoinMatchResponseSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
        },
        detail: { tags: ["Standalone"] },
      },
    )
    .post(
      "/api/v1/hub/matches",
      async ({ body, request, status }) => {
        const access = hubAuthorization(
          config,
          request.headers.get("authorization"),
        );

        if (access === "unavailable") {
          return status(503, {
            code: "hub_unavailable",
            message:
              "Hub authentication and result delivery are not configured.",
          });
        }

        if (access === "unauthorized") {
          return status(401, {
            code: "unauthorized",
            message: "A valid hub bearer token is required.",
          });
        }

        if (body.seats.every(({ kind }) => kind === "bot")) {
          return status(422, {
            code: "human_required",
            message: "A hub match must contain at least one human seat.",
          });
        }

        const existing = await repository.findHubMatch(body.hubMatchId);

        if (existing) {
          return sameHubRequest(existing.hubRequest, body)
            ? hubResponse(existing)
            : status(409, {
                code: "hub_match_conflict",
                message:
                  "This hub match ID was already used with different input.",
              });
        }

        let match: StoredMatch;
        try {
          match = await matchService.createHub(body);
        } catch (cause) {
          // A concurrent idempotent request may win the unique hub-ID insert.
          const racedMatch = await repository.findHubMatch(body.hubMatchId);
          if (!racedMatch) throw cause;
          return sameHubRequest(racedMatch.hubRequest, body)
            ? hubResponse(racedMatch)
            : status(409, {
                code: "hub_match_conflict",
                message:
                  "This hub match ID was already used with different input.",
              });
        }
        return status(201, hubResponse(match));
      },
      {
        body: HubCreateMatchRequestSchema,
        response: {
          200: HubCreateMatchResponseSchema,
          201: HubCreateMatchResponseSchema,
          401: ApiErrorSchema,
          409: ApiErrorSchema,
          422: ApiErrorSchema,
          503: ApiErrorSchema,
        },
        detail: { tags: ["Game hub"] },
      },
    )
    .get(
      "/api/v1/hub/matches/:hubMatchId",
      async ({ params, request, status }) => {
        const access = hubAuthorization(
          config,
          request.headers.get("authorization"),
        );

        if (access === "unavailable") {
          return status(503, {
            code: "hub_unavailable",
            message:
              "Hub authentication and result delivery are not configured.",
          });
        }

        if (access === "unauthorized") {
          return status(401, {
            code: "unauthorized",
            message: "A valid hub bearer token is required.",
          });
        }

        const match = await repository.findHubMatch(params.hubMatchId);

        return match
          ? hubStatus(match)
          : status(404, {
              code: "match_not_found",
              message: "Match not found.",
            });
      },
      {
        params: HubMatchParamsSchema,
        response: {
          200: HubMatchStatusSchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          503: ApiErrorSchema,
        },
        detail: { tags: ["Game hub"] },
      },
    )
    .ws("/api/v1/ws/player/:matchId", {
      params: MatchParamsSchema,
      query: PlayerQuerySchema,
      body: PlayerCommandSchema,
      response: ServerMessageSchema,
      idleTimeout: 30,
      open(ws) {
        const session = registry.get(ws.data.params.matchId);
        if (!session) {
          ws.close(1008, "Match is not live.");
          return;
        }
        session.connectPlayer(ws.data.query.seatToken, {
          id: ws.id,
          send(message) {
            ws.send(message);
          },
          close(code, reason) {
            ws.close(code, reason);
          },
        });
      },
      message(ws, command) {
        registry
          .get(ws.data.params.matchId)
          ?.dispatch(ws.data.query.seatToken, command);
      },
      close(ws) {
        registry
          .get(ws.data.params.matchId)
          ?.disconnectPlayer(ws.data.query.seatToken, ws.id);
      },
      detail: { tags: ["Live session"] },
    })
    .ws("/api/v1/ws/spectator/:matchId", {
      params: MatchParamsSchema,
      body: Type.Unknown(),
      response: ServerMessageSchema,
      idleTimeout: 30,
      open(ws) {
        const session = registry.get(ws.data.params.matchId);
        if (!session) {
          ws.close(1008, "Match is not live.");
          return;
        }
        session.connectSpectator({
          id: ws.id,
          send(message) {
            ws.send(message);
          },
          close(code, reason) {
            ws.close(code, reason);
          },
        });
      },
      message(ws) {
        ws.close(1008, "Spectator sockets are read-only.");
      },
      close(ws) {
        registry.get(ws.data.params.matchId)?.disconnectSpectator(ws.id);
      },
      detail: { tags: ["Live session"] },
    });
}

export type App = ReturnType<typeof createApp>;
