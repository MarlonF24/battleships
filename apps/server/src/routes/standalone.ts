/** Standalone match creation and seat-claim HTTP routes. */

import { Elysia } from "elysia";
import {
  ApiErrorSchema,
  CreateMatchRequestSchema,
  CreateMatchResponseSchema,
  JoinMatchRequestSchema,
  JoinMatchResponseSchema,
  type CreateMatchResponse,
  type JoinMatchResponse,
} from "@battleship/contracts";
import { RepositoryError, type StoredMatch } from "../repository";
import type { RouteDependencies } from "./shared";
import { MatchParamsSchema, playerPath, spectatorPath } from "./shared";

/** Convert stored metadata into the opponent-specific creation response. */
function createResponse(match: StoredMatch): CreateMatchResponse {
  if (match.seats[0].kind !== "human") {
    throw new Error("A standalone match must have a human first seat.");
  }
  const common = {
    matchId: match.id,
    playerUrl: playerPath(match.id, match.seats[0].seatToken),
    spectatorUrl: spectatorPath(match.id),
  };
  return match.seats[1]
    ? { ...common, kind: "botMatch" }
    : { ...common, kind: "humanMatch", joinUrl: `/join/${match.id}` };
}

/** Return seat two's private player link after an atomic claim. */
function joinResponse(match: StoredMatch): JoinMatchResponse {
  const second = match.seats[1];
  if (second?.kind !== "human") {
    throw new Error("A joined match must contain a human seat two.");
  }
  return {
    matchId: match.id,
    playerUrl: playerPath(match.id, second.seatToken),
    spectatorUrl: spectatorPath(match.id),
  };
}

/** Build the public standalone lifecycle controller. */
export function createStandaloneRoutes({
  matchService,
  logger,
}: Pick<RouteDependencies, "matchService" | "logger">) {
  return new Elysia({ name: "standalone-routes", prefix: "/api/v1" })
    .post(
      "/matches",
      async ({ body, status }) => {
        const match = await matchService.createStandalone(body);
        logger.info(
          { matchId: match.id, mode: match.mode, opponent: body.opponent },
          "Standalone match created",
        );
        return status(201, createResponse(match));
      },
      {
        body: CreateMatchRequestSchema,
        response: { 201: CreateMatchResponseSchema },
        detail: { tags: ["Standalone"] },
      },
    )
    .post(
      "/matches/:matchId/join",
      async ({ params, body, status }) => {
        try {
          const match = await matchService.joinStandalone(params.matchId, body);
          logger.info({ matchId: match.id, seat: 2 }, "Match seat claimed");
          return joinResponse(match);
        } catch (cause) {
          if (cause instanceof RepositoryError) {
            logger.warn(
              { matchId: params.matchId, conflict: cause.code },
              "Match join rejected",
            );
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
    );
}
