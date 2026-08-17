/** Eden Treaty lifecycle client; WebSockets use the shared message contracts. */

import { treaty } from "@elysiajs/eden/treaty2";
import type { App } from "@battleship/server/app";
import type {
  CreateMatchRequest,
  CreateMatchResponse,
  JoinMatchRequest,
  JoinMatchResponse,
  PlayerCommand,
  ServerMessage,
} from "@battleship/contracts";

function apiClient() {
  return treaty<App>(window.location.origin);
}

/** Route-derived seat token identifying either a player seat or spectator. */
export type LiveMatchIdentity =
  | Readonly<{ role: "player"; matchId: string; seatToken: string }>
  | Readonly<{ role: "spectator"; matchId: string }>;

export type LiveMatchConnection = Readonly<{
  socket: WebSocket;
  send: ((command: PlayerCommand) => void) | null;
  close: (code?: number, reason?: string) => void;
}>;

type LiveMatchHandlers = Readonly<{
  open: () => void;
  message: (message: ServerMessage) => void;
  close: (event: CloseEvent) => void;
  error: () => void;
}>;

function apiMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "value" in error &&
    typeof error.value === "object" &&
    error.value !== null &&
    "message" in error.value &&
    typeof error.value.message === "string"
  ) {
    return error.value.message;
  }
  return "The server could not complete this request.";
}

/** Create a standalone match and return its trusted role links. */
export async function createMatch(
  request: CreateMatchRequest,
): Promise<CreateMatchResponse> {
  const { data, error } = await apiClient().api.v1.matches.post(request);
  if (error) throw new Error(apiMessage(error));
  return data;
}

/** Atomically claim seat two and return the joining player's trusted link. */
export async function joinMatch(
  matchId: string,
  request: JoinMatchRequest,
): Promise<JoinMatchResponse> {
  const { data, error } = await apiClient()
    .api.v1.matches({ matchId })
    .join.post(request);
  if (error) throw new Error(apiMessage(error));
  return data;
}

/**
 * Open an Eden-inferred live socket without duplicating route or JSON handling.
 *
 * @param identity - Player seat token or public spectator match identity.
 * @param handlers - Store callbacks for the native socket lifecycle.
 * @returns A small role-safe connection facade; spectators have no `send`.
 */
export function connectLiveMatch(
  identity: LiveMatchIdentity,
  handlers: LiveMatchHandlers,
): LiveMatchConnection {
  let socket: WebSocket;
  let send: LiveMatchConnection["send"] = null;

  if (identity.role === "player") {
    const connection = apiClient()
      .api.v1.ws.player({ matchId: identity.matchId })
      .subscribe({ query: { seatToken: identity.seatToken } });
    connection.subscribe(({ data }) => handlers.message(data));
    socket = connection.ws;
    send = (command) => {
      connection.send(command);
    };
  } else {
    const connection = apiClient()
      .api.v1.ws.spectator({ matchId: identity.matchId })
      .subscribe();
    connection.subscribe(({ data }) => handlers.message(data));
    socket = connection.ws;
  }

  socket.addEventListener("open", handlers.open);
  socket.addEventListener("close", handlers.close);
  socket.addEventListener("error", handlers.error);
  return {
    socket,
    send,
    close: (code, reason) => socket.close(code, reason),
  };
}

/** Keep one anonymous player identity per browser for standalone play. */
export function standalonePlayerId(): string {
  const storageKey = "battleship.standalone-player-id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

/** Navigate to an absolute server link without coupling routes to its origin. */
export function localPath(link: string): string {
  const url = new URL(link, window.location.origin);
  return `${url.pathname}${url.search}${url.hash}`;
}
