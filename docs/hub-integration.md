# Provisional game-hub integration

The hub API creates live sessions and reports outcomes. The hub owns player accounts, Elo, ranking policy, and whether bot games affect ratings.

A **Hub Player** is the durable UUID supplied by the hub. Reusing that UUID attributes later matches to the same namespaced database identity. A **Seat Token** is a separate match-specific secret embedded in a returned player URL; possessing that URL grants control of its seat. Opening a hub player URL neither reads nor changes the browser's standalone identity.

Set `HUB_ENABLED=true`, a non-empty `HUB_SHARED_TOKEN`, and an absolute `HUB_RESULT_WEBHOOK_URL`. All hub HTTP requests require:

```text
Authorization: Bearer <HUB_SHARED_TOKEN>
```

Disabled hub configuration returns `503 hub_unavailable`; standalone play remains available.

The same token authenticates completion requests sent from Battleship to the configured hub webhook. It identifies the integration service, not an individual player, and must never be exposed to browsers.

## OpenAPI

Interactive API documentation is available at `/openapi`, and generators can consume the OpenAPI document at `/openapi/json`. Hub operations declare the `hubBearer` security scheme, so a generated client can accept the shared bearer token. This schema describes the hub's calls into Battleship; if the hub later publishes an OpenAPI schema for receiving results, only the final webhook sender needs to adopt that client.

## Create a match

`POST /api/v1/hub/matches`

```json
{
  "hubMatchId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "mode": "streak",
  "seats": [
    {
      "kind": "human",
      "playerId": "11111111-1111-4111-8111-111111111111"
    },
    {
      "kind": "bot"
    }
  ]
}
```

At least one seat must be human. Human UUIDs are stored in the `hub` identity namespace and are result metadata, not gameplay credentials.

```json
{
  "matchId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "hubMatchId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "seats": [
    {
      "seat": 1,
      "kind": "human",
      "playerId": "11111111-1111-4111-8111-111111111111",
      "playerUrl": "/matches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/player/cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    },
    {
      "seat": 2,
      "kind": "bot"
    }
  ],
  "spectatorUrl": "/spectate/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "resultUrl": "/api/v1/hub/matches/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
}
```

Player URLs contain private **Seat Tokens**. Spectator URLs contain only the shareable internal match ID. All returned URLs are root-relative to the Battleship origin used for the API request.

`hubMatchId` is the idempotency key. Repeating the identical payload returns the stored links, including the same **Seat Tokens**. Reusing it with different mode or seats returns `409 hub_match_conflict`.

## Query status and recover a result

`GET /api/v1/hub/matches/{hubMatchId}` returns source-safe participant descriptors, phase, terminal outcome/reason, and timestamps. It never returns a fleet, board, **Seat Token**, standalone identity, or connection detail.

This endpoint is the authoritative recovery path when webhook retries are exhausted.

## Completion webhook

The server posts only to the configured `HUB_RESULT_WEBHOOK_URL` and sends the same bearer authorization header. Request bodies have a stable event UUID:

```json
{
  "eventId": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "type": "battleship.match.completed",
  "hubMatchId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "matchId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "mode": "streak",
  "completedAt": "2026-08-06T18:00:00.000Z",
  "terminalReason": "fleet_destroyed",
  "seats": [
    {
      "seat": 1,
      "descriptor": {
        "kind": "human",
        "playerId": "11111111-1111-4111-8111-111111111111"
      },
      "outcome": "win"
    },
    {
      "seat": 2,
      "descriptor": {
        "kind": "bot"
      },
      "outcome": "loss"
    }
  ]
}
```

Terminal reasons are `fleet_destroyed`, `no_players_connected`, `server_restart`, `placement_expired`, or `battle_expired`. Outcomes are `win`, `loss`, or `premature`.

The result and outbox event commit in the same transaction before clients are notified. Delivery is asynchronous and retries immediately, after 5 seconds, after 30 seconds, and after 5 minutes. Attempt count, last error, next attempt, and delivery time are durable. Due events resume at startup. Webhook payloads contain hub player UUIDs only—never anonymous IDs or **Seat Tokens**.
