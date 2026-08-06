/** Deterministic server-test fixtures for clocks, sockets, and legal fleets. */

import pino from "pino";
import type { ServerMessage } from "@battleship/contracts";
import type { ShipPlacement } from "@battleship/game-domain";
import type { SocketPeer } from "../src/session/match-session";
import type { Clock, ScheduledHandle, Scheduler } from "../src/session/runtime";

export const silentLogger = pino({ enabled: false });

export const validFleet: readonly ShipPlacement[] = [
  { length: 5, orientation: "horizontal", headRow: 0, headColumn: 0 },
  { length: 4, orientation: "horizontal", headRow: 2, headColumn: 0 },
  { length: 4, orientation: "horizontal", headRow: 4, headColumn: 0 },
  { length: 3, orientation: "horizontal", headRow: 6, headColumn: 0 },
  { length: 3, orientation: "horizontal", headRow: 8, headColumn: 0 },
  { length: 3, orientation: "vertical", headRow: 0, headColumn: 6 },
  { length: 2, orientation: "vertical", headRow: 0, headColumn: 8 },
  { length: 2, orientation: "vertical", headRow: 3, headColumn: 8 },
  { length: 2, orientation: "vertical", headRow: 6, headColumn: 6 },
  { length: 2, orientation: "vertical", headRow: 8, headColumn: 8 },
];

type ScheduledTask = {
  handle: ScheduledHandle;
  at: number;
  callback: () => void;
  cancelled: boolean;
};

/** Manual clock/scheduler pair that advances deadlines without wall time. */
export class ManualRuntime implements Clock, Scheduler {
  private currentMs: number;
  private readonly tasks: ScheduledTask[] = [];

  public constructor(initialMs = 0) {
    this.currentMs = initialMs;
  }

  public now(): number {
    return this.currentMs;
  }

  public schedule(delayMs: number, callback: () => void): ScheduledHandle {
    const handle = {
      cancel: () => {
        const current = this.tasks.find(
          ({ handle: candidate }) => candidate === handle,
        );
        if (current) current.cancelled = true;
      },
    };
    this.tasks.push({
      handle,
      at: this.currentMs + delayMs,
      callback,
      cancelled: false,
    });
    return handle;
  }

  public cancel(handle: ScheduledHandle): void {
    handle.cancel();
  }

  public advanceBy(milliseconds: number): void {
    const target = this.currentMs + milliseconds;
    const due = this.tasks
      .filter(({ at, cancelled }) => !cancelled && at <= target)
      .sort((left, right) => left.at - right.at);
    for (const task of due) {
      if (task.cancelled) continue;
      task.cancelled = true;
      this.currentMs = task.at;
      task.callback();
    }
    this.currentMs = target;
  }
}

/** Capturing peer used to assert role-specific session output and close codes. */
export class CapturingPeer implements SocketPeer {
  public readonly messages: ServerMessage[] = [];
  public readonly closures: Readonly<{ code: number; reason: string }>[] = [];

  public constructor(public readonly id: string) {}

  public send(message: ServerMessage): void {
    this.messages.push(message);
  }

  public close(code: number, reason: string): void {
    this.closures.push({ code, reason });
  }
}

/** Return the newest projected state captured by a test socket. */
export function latestProjection(peer: CapturingPeer) {
  const message = [...peer.messages]
    .reverse()
    .find((candidate) => candidate.type === "projection");
  if (!message) {
    throw new Error("Expected the peer to receive a projection.");
  }
  return message.projection;
}

/** Allow chained async repository work to settle after a scheduled callback. */
export async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
