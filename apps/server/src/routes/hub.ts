/** Authenticated game-hub lifecycle routes and role-safe responses. */

import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import {
  ApiErrorSchema,
  HubCreateMatchRequestSchema,
  HubCreateMatchResponseSchema,
  HubMatchStatusSchema,
  type HubCreateMatchRequest,
  type HubCreateMatchResponse,
  type HubMatchStatus,
} from "@battleship/contracts";
import {
  hubDescriptor,
  type StoredMatch,
  type StoredSeat,
} from "../repository";
import type { RouteDependencies } from "./shared";
import { HubMatchParamsSchema, playerPath, spectatorPath } from "./shared";

/** Build player and spectator links without exposing seat tokens as metadata. */
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
          playerUrl: playerPath(match.id, storedSeat.seatToken),
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

/** Project durable status without live boards or seat credentials. */
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

/** Compare idempotency inputs semantically rather than by JSON formatting. */
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

/** Compare the complete authorization header without content-dependent timing. */
function hasValidHubToken(sharedToken: string, authorization: string | null) {
  const expected = Buffer.from(`Bearer ${sharedToken}`);
  const actual = Buffer.from(authorization ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Build the authenticated hub controller with one shared access gate. */
export function createHubRoutes({
  config,
  repository,
  matchService,
  logger,
}: Pick<
  RouteDependencies,
  "config" | "repository" | "matchService" | "logger"
>) {
  return new Elysia({
    name: "hub-routes",
    prefix: "/api/v1/hub",
    detail: { tags: ["Game hub"], security: [{ hubBearer: [] }] },
  }).guard(
    {
      beforeHandle({ request, status }) {
        if (!config.hub.enabled) {
          logger.warn("Hub request received while integration is disabled");
          return status(503, {
            code: "hub_unavailable",
            message:
              "Hub authentication and result delivery are not configured.",
          });
        }
        if (
          !hasValidHubToken(
            config.hub.sharedToken,
            request.headers.get("authorization"),
          )
        ) {
          logger.warn("Unauthorized hub API request");
          return status(401, {
            code: "unauthorized",
            message: "A valid hub bearer token is required.",
          });
        }
        return undefined;
      },
    },
    (app) =>
      app
        .post(
          "/matches",
          async ({ body, status }) => {
            if (body.seats.every(({ kind }) => kind === "bot")) {
              return status(422, {
                code: "human_required",
                message: "A hub match must contain at least one human seat.",
              });
            }

            const existing = await repository.findHubMatch(body.hubMatchId);
            if (existing) {
              logger.debug(
                { hubMatchId: body.hubMatchId, matchId: existing.id },
                "Hub match creation replayed",
              );
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
              // A concurrent request may win the unique hub-match insert.
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
            logger.info(
              {
                hubMatchId: body.hubMatchId,
                matchId: match.id,
                mode: match.mode,
              },
              "Hub match created",
            );
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
          },
        )
        .get(
          "/matches/:hubMatchId",
          async ({ params, status }) => {
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
          },
        ),
  );
}
