/** Critical session orchestration, timer, and projection privacy tests. */

import { describe, expect, test } from "bun:test";
import { MatchSession } from "../src/session/match-session";
import { MemoryMatchRepository } from "../src/testing/memory-repository";
import {
  CapturingPeer,
  ManualRuntime,
  latestProjection,
  settle,
  silentLogger,
  validFleet,
} from "./helpers";

const firstPlayer = "11111111-1111-4111-8111-111111111111";
const secondPlayer = "22222222-2222-4222-8222-222222222222";
const firstCapability = "33333333-3333-4333-8333-333333333333";
const secondCapability = "44444444-4444-4444-8444-444444444444";
const matchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function createHumanSession(runtime: ManualRuntime) {
  const repository = new MemoryMatchRepository();
  const stored = await repository.createMatch({
    id: matchId,
    hubMatchId: null,
    hubRequest: null,
    source: "standalone",
    mode: "singleShot",
    seats: [
      {
        seat: 1,
        kind: "human",
        identity: { source: "standalone", externalId: firstPlayer },
        capability: firstCapability,
      },
      {
        seat: 2,
        kind: "human",
        identity: { source: "standalone", externalId: secondPlayer },
        capability: secondCapability,
      },
    ],
  });
  return {
    repository,
    session: new MatchSession(stored, {
      repository,
      logger: silentLogger,
      clock: runtime,
      scheduler: runtime,
      random: { next: () => 0.25 },
    }),
  };
}

describe("match session", () => {
  test("publishes complete role-safe projections and rejects wrong-turn shots", async () => {
    const runtime = new ManualRuntime();
    const { session } = await createHumanSession(runtime);
    const first = new CapturingPeer("first");
    const second = new CapturingPeer("second");
    const spectator = new CapturingPeer("spectator");
    const otherSpectator = new CapturingPeer("other-spectator");
    session.connectPlayer(firstCapability, first);
    session.connectPlayer(secondCapability, second);
    session.connectSpectator(spectator);
    session.connectSpectator(otherSpectator);
    await settle();

    session.dispatch(firstCapability, {
      type: "ready",
      requestId: crypto.randomUUID(),
      fleet: [...validFleet],
    });
    session.dispatch(secondCapability, {
      type: "ready",
      requestId: crypto.randomUUID(),
      fleet: [...validFleet],
    });
    await settle();
    runtime.advanceBy(1_500);
    await settle();

    const firstProjection = latestProjection(first);
    const spectatorProjection = latestProjection(spectator);
    expect(firstProjection.phase).toBe("battle");
    expect(spectatorProjection.phase).toBe("battle");
    if (
      firstProjection.phase !== "battle" ||
      firstProjection.view.kind !== "player"
    ) {
      throw new Error("Expected a player battle view.");
    }
    if (
      spectatorProjection.phase !== "battle" ||
      spectatorProjection.view.kind !== "spectator"
    ) {
      throw new Error("Expected a spectator battle view.");
    }
    expect(firstProjection.view.ownBoard.ships).toHaveLength(10);
    expect(firstProjection.view.opponentBoard.ships).toHaveLength(0);
    expect(spectatorProjection.view.boards[0].ships).toHaveLength(0);
    expect(spectatorProjection.view.boards[1].ships).toHaveLength(0);
    expect(latestProjection(otherSpectator).phase).toBe("battle");
    expect(JSON.stringify(spectator.messages)).not.toContain(firstCapability);
    expect(JSON.stringify(first.messages)).not.toContain(firstCapability);

    const revision = firstProjection.revision;
    const requestId = crypto.randomUUID();
    session.dispatch(secondCapability, {
      type: "shoot",
      requestId,
      row: 0,
      column: 0,
    });
    await settle();
    expect(latestProjection(first).revision).toBe(revision);
    expect(second.messages).toContainEqual(
      expect.objectContaining({
        type: "commandRejected",
        requestId,
        code: "not_your_turn",
      }),
    );
  });

  test("randomly places an absent human fleet when the ready timer expires", async () => {
    const runtime = new ManualRuntime();
    const { session } = await createHumanSession(runtime);
    const first = new CapturingPeer("first");
    session.connectPlayer(firstCapability, first);
    await settle();
    session.dispatch(firstCapability, {
      type: "ready",
      requestId: crypto.randomUUID(),
      fleet: [...validFleet],
    });
    await settle();

    runtime.advanceBy(40_000);
    await settle();
    expect(session.phase).toBe("placement");
    runtime.advanceBy(1_500);
    await settle();
    expect(session.phase).toBe("battle");
    expect(latestProjection(first).phase).toBe("battle");
  });

  test("a replacement connection closes the old socket and retains the new one", async () => {
    const runtime = new ManualRuntime();
    const { session } = await createHumanSession(runtime);
    const oldPeer = new CapturingPeer("old");
    const newPeer = new CapturingPeer("new");
    session.connectPlayer(firstCapability, oldPeer);
    session.connectPlayer(firstCapability, newPeer);
    await settle();
    expect(oldPeer.closures).toContainEqual(
      expect.objectContaining({ code: 1008 }),
    );
    session.disconnectPlayer(firstCapability, oldPeer.id);
    await settle();
    expect(latestProjection(newPeer).participants[0].connected).toBe(true);
  });

  test("an unknown capability cannot attach to a player seat", async () => {
    const runtime = new ManualRuntime();
    const { session } = await createHumanSession(runtime);
    const peer = new CapturingPeer("unknown-capability");

    expect(
      session.connectPlayer("99999999-9999-4999-8999-999999999999", peer),
    ).toBe(false);
    expect(peer.messages).toEqual([]);
    expect(peer.closures).toContainEqual(
      expect.objectContaining({ code: 1008 }),
    );
  });
});
