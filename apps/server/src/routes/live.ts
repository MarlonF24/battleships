/** Player and spectator WebSocket routes for authoritative live sessions. */

import { Type } from "@sinclair/typebox";
import { Elysia } from "elysia";
import {
  PlayerCommandSchema,
  ServerMessageSchema,
} from "@battleship/contracts";
import type { RouteDependencies } from "./shared";
import { MatchParamsSchema, PlayerQuerySchema } from "./shared";

/** Build role-specific WebSocket routes over the shared match registry. */
export function createLiveRoutes({
  registry,
  logger,
}: Pick<RouteDependencies, "registry" | "logger">) {
  return new Elysia({ name: "live-routes", prefix: "/api/v1/ws" })
    .ws("/player/:matchId", {
      params: MatchParamsSchema,
      query: PlayerQuerySchema,
      body: PlayerCommandSchema,
      response: ServerMessageSchema,
      idleTimeout: 30,
      open(ws) {
        const session = registry.get(ws.data.params.matchId);
        if (!session) {
          logger.warn(
            { matchId: ws.data.params.matchId, peerId: ws.id },
            "Player socket requested an unavailable match",
          );
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
    .ws("/spectator/:matchId", {
      params: MatchParamsSchema,
      body: Type.Unknown(),
      response: ServerMessageSchema,
      idleTimeout: 30,
      open(ws) {
        const session = registry.get(ws.data.params.matchId);
        if (!session) {
          logger.debug(
            { matchId: ws.data.params.matchId, peerId: ws.id },
            "Spectator requested an unavailable match",
          );
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
        logger.warn(
          { matchId: ws.data.params.matchId, peerId: ws.id },
          "Spectator socket sent a prohibited message",
        );
        ws.close(1008, "Spectator sockets are read-only.");
      },
      close(ws) {
        registry.get(ws.data.params.matchId)?.disconnectSpectator(ws.id);
      },
      detail: { tags: ["Live session"] },
    });
}
