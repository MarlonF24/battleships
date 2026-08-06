/** Integration coverage for lifecycle routes, capabilities, and hub privacy. */

import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  CreateMatchResponseSchema,
  HubCreateMatchResponseSchema,
  JoinMatchResponseSchema,
  type CreateMatchResponse,
  type HubCreateMatchResponse,
  type JoinMatchResponse,
} from "@battleship/contracts";
import { createApp } from "../src/app";
import type { AppConfig } from "../src/config";
import { MatchSessionRegistry } from "../src/session/registry";
import { MemoryMatchRepository } from "../src/testing/memory-repository";
import { silentLogger } from "./helpers";

const config: AppConfig = Object.freeze({
  corsOrigins: [],
  hub: {
    enabled: true as const,
    sharedToken: "test-token",
    resultWebhookUrl: "https://hub.example/results",
  },
});

function testApp() {
  const repository = new MemoryMatchRepository();
  const registry = new MatchSessionRegistry({
    repository,
    logger: silentLogger,
  });
  return {
    repository,
    app: createApp({ config, repository, registry, logger: silentLogger }),
  };
}

async function createLinks(response: Response): Promise<CreateMatchResponse> {
  const body: unknown = await response.json();
  if (!Value.Check(CreateMatchResponseSchema, body)) {
    throw new Error("Expected a valid create-match response.");
  }
  return body;
}

async function joinLinks(response: Response): Promise<JoinMatchResponse> {
  const body: unknown = await response.json();
  if (!Value.Check(JoinMatchResponseSchema, body)) {
    throw new Error("Expected a valid join-match response.");
  }
  return body;
}

async function hubLinks(response: Response): Promise<HubCreateMatchResponse> {
  const body: unknown = await response.json();
  if (!Value.Check(HubCreateMatchResponseSchema, body)) {
    throw new Error("Expected a valid hub match response.");
  }
  return body;
}

describe("lifecycle HTTP API", () => {
  test("creates a standalone match and claims seat two idempotently", async () => {
    const { app, repository } = testApp();
    const firstPlayer = "11111111-1111-4111-8111-111111111111";
    const secondPlayer = "22222222-2222-4222-8222-222222222222";
    const created = await app.handle(
      new Request("http://localhost/api/v1/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          standalonePlayerId: firstPlayer,
          mode: "singleShot",
          opponent: "human",
        }),
      }),
    );
    expect(created.status).toBe(201);
    const links = await createLinks(created);
    expect(links.kind).toBe("humanMatch");
    if (links.kind !== "humanMatch") {
      throw new Error("Expected a human match.");
    }
    expect(links.joinUrl).toContain("/join/");
    expect(links.playerUrl).toContain("/player/");
    expect(links.spectatorUrl).toBe(`/spectate/${links.matchId}`);

    const joined = await app.handle(
      new Request(`http://localhost/api/v1/matches/${links.matchId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ standalonePlayerId: secondPlayer }),
      }),
    );
    expect(joined.status).toBe(200);
    const joinedAgain = await app.handle(
      new Request(`http://localhost/api/v1/matches/${links.matchId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ standalonePlayerId: secondPlayer }),
      }),
    );
    expect(joinedAgain.status).toBe(200);
    expect((await joinLinks(joinedAgain)).playerUrl).toBe(
      (await joinLinks(joined)).playerUrl,
    );

    // Reusing the browser UUID in another match resolves the same player row.
    const repeatedPlayer = await app.handle(
      new Request("http://localhost/api/v1/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          standalonePlayerId: firstPlayer,
          mode: "salvo",
          opponent: "bot",
        }),
      }),
    );
    expect(repeatedPlayer.status).toBe(201);
    expect(repository.playerCount).toBe(2);
  });

  test("prevents seat one from claiming its own open seat", async () => {
    const { app } = testApp();
    const player = "11111111-1111-4111-8111-111111111111";
    const created = await app.handle(
      new Request("http://localhost/api/v1/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          standalonePlayerId: player,
          mode: "singleShot",
          opponent: "human",
        }),
      }),
    );
    const links = await createLinks(created);
    const response = await app.handle(
      new Request(`http://localhost/api/v1/matches/${links.matchId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ standalonePlayerId: player }),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "already_participating" }),
    );
  });

  test("enforces hub authentication and request idempotency", async () => {
    const { app, repository } = testApp();
    const hubPlayer = "11111111-1111-4111-8111-111111111111";
    const request = {
      hubMatchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      mode: "streak",
      seats: [
        {
          kind: "human",
          playerId: hubPlayer,
        },
        { kind: "bot" },
      ],
    };
    const unauthorized = await app.handle(
      new Request("http://localhost/api/v1/hub/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      }),
    );
    expect(unauthorized.status).toBe(401);

    const send = () =>
      app.handle(
        new Request("http://localhost/api/v1/hub/matches", {
          method: "POST",
          headers: {
            authorization: "Bearer test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
        }),
      );
    const created = await send();
    const repeated = await send();
    expect(created.status).toBe(201);
    expect(repeated.status).toBe(200);
    const createdLinks = await hubLinks(created);
    const repeatedLinks = await hubLinks(repeated);
    expect(repeatedLinks.matchId).toBe(createdLinks.matchId);
    expect(repeatedLinks.seats).toEqual(createdLinks.seats);
    const statusResponse = await app.handle(
      new Request(`http://localhost${createdLinks.resultUrl}`, {
        headers: { authorization: "Bearer test-token" },
      }),
    );
    expect(statusResponse.status).toBe(200);
    expect(JSON.stringify(await statusResponse.json())).not.toContain(
      "/player/",
    );

    // Equal UUID text remains distinct across hub and standalone namespaces.
    const standalone = await app.handle(
      new Request("http://localhost/api/v1/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          standalonePlayerId: hubPlayer,
          mode: "singleShot",
          opponent: "bot",
        }),
      }),
    );
    expect(standalone.status).toBe(201);
    expect(repository.playerCount).toBe(2);
  });
});
