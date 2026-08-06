/** Durable webhook delivery and retry-schedule tests. */

import { expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { WebhookEventSchema, type WebhookEvent } from "@battleship/contracts";
import { WebhookWorker } from "../src/webhook";
import { MemoryMatchRepository } from "../src/testing/memory-repository";
import { ManualRuntime, silentLogger } from "./helpers";

test("webhook delivery keeps a stable event ID and retries on the shared schedule", async () => {
  const repository = new MemoryMatchRepository();
  const hubMatchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const match = await repository.createMatch({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    hubMatchId,
    hubRequest: {
      hubMatchId,
      mode: "singleShot",
      seats: [
        {
          kind: "human",
          playerId: "11111111-1111-4111-8111-111111111111",
        },
        { kind: "bot" },
      ],
    },
    source: "hub",
    mode: "singleShot",
    seats: [
      {
        seat: 1,
        kind: "human",
        identity: {
          source: "hub",
          externalId: "11111111-1111-4111-8111-111111111111",
        },
        capability: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
      { seat: 2, kind: "bot" },
    ],
  });
  await repository.completeMatch({
    matchId: match.id,
    winnerSeat: 1,
    reason: "fleet_destroyed",
  });

  const runtime = new ManualRuntime(Date.now() + 1_000);
  const requests: { headers: HeadersInit | undefined; body: string }[] = [];
  let calls = 0;
  const worker = new WebhookWorker({
    repository,
    logger: silentLogger,
    hub: {
      enabled: true,
      sharedToken: "test-token",
      resultWebhookUrl: "https://hub.example/results",
    },
    clock: runtime,
    scheduler: runtime,
    fetcher: (_input, init) => {
      if (typeof init?.body !== "string") {
        throw new Error("Webhook tests expect a JSON string body.");
      }
      requests.push({ headers: init.headers, body: init.body });
      calls += 1;
      return Promise.resolve(
        new Response(null, { status: calls === 1 ? 500 : 204 }),
      );
    },
  });
  worker.start();
  await worker.processDue();
  expect(calls).toBe(1);
  expect(requests[0]?.headers).toEqual(
    expect.objectContaining({ authorization: "Bearer test-token" }),
  );
  expect(
    await repository.dueOutboxEvents(new Date(runtime.now())),
  ).toHaveLength(0);
  worker.stop();
  runtime.advanceBy(5_000);
  const retryWorker = new WebhookWorker({
    repository,
    logger: silentLogger,
    hub: {
      enabled: true,
      sharedToken: "test-token",
      resultWebhookUrl: "https://hub.example/results",
    },
    clock: runtime,
    scheduler: runtime,
    fetcher: (_input, init) => {
      if (typeof init?.body !== "string") {
        throw new Error("Webhook tests expect a JSON string body.");
      }
      requests.push({ headers: init.headers, body: init.body });
      calls += 1;
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  retryWorker.start();
  await retryWorker.processDue();
  expect(calls).toBe(2);
  const payloads = requests.map(({ body }): WebhookEvent => {
    const parsed: unknown = JSON.parse(body);
    if (!Value.Check(WebhookEventSchema, parsed)) {
      throw new Error("Expected a valid webhook event payload.");
    }
    return parsed;
  });
  const [firstPayload, secondPayload] = payloads;
  if (!firstPayload || !secondPayload) {
    throw new Error("Expected two webhook delivery attempts.");
  }
  expect(firstPayload.eventId).toBe(secondPayload.eventId);
  expect(
    await repository.dueOutboxEvents(new Date(runtime.now())),
  ).toHaveLength(0);
  retryWorker.stop();
});
