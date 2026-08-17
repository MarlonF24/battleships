/** Durable completion-webhook delivery driven by the result outbox. */

import type { Logger } from "pino";
import type { HubConfig } from "./config";
import type { MatchRepository } from "./repository";
import {
  systemClock,
  systemScheduler,
  type Clock,
  type ScheduledHandle,
  type Scheduler,
} from "./session/runtime";

/** Shared retry schedule; an absent next entry means delivery is exhausted. */
export const WEBHOOK_RETRY_DELAYS_MS = [0, 5_000, 30_000, 5 * 60_000] as const;
const OUTBOX_POLL_INTERVAL_MS = 1_000;
const EXHAUSTED_RETRY_DATE = new Date("9999-12-31T23:59:59.999Z");

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type ResultWebhookWorkerOptions = Readonly<{
  repository: MatchRepository;
  logger: Logger;
  hub: HubConfig;
  fetcher?: Fetcher;
  clock?: Clock;
  scheduler?: Scheduler;
}>;

/**
 * Deliver persisted hub completion events without blocking match completion.
 *
 * The database is the queue. Stable event IDs and attempt state survive a
 * process restart, while this worker remains deliberately single-process.
 */
export class ResultWebhookWorker {
  private readonly repository: MatchRepository;
  private readonly logger: Logger;
  private readonly hub: HubConfig;
  private readonly fetcher: Fetcher;
  private readonly clock: Clock;
  private readonly scheduler: Scheduler;
  private handle: ScheduledHandle | null = null;
  private running = false;
  private stopped = true;

  public constructor(options: ResultWebhookWorkerOptions) {
    this.repository = options.repository;
    this.logger = options.logger;
    this.hub = options.hub;
    this.fetcher = options.fetcher ?? fetch;
    this.clock = options.clock ?? systemClock;
    this.scheduler = options.scheduler ?? systemScheduler;
  }

  /** Process recovered outbox work and continue polling for new completions. */
  public start(): void {
    if (!this.hub.enabled) return;
    this.stopped = false;
    this.wake();
  }

  /** Promptly process a completion created since the previous poll. */
  public wake(): void {
    if (this.stopped || this.running || this.handle) return;
    this.handle = this.scheduler.schedule(0, () => {
      this.handle = null;
      void this.processDue();
    });
  }

  /** Stop future attempts; an already running HTTP request may finish. */
  public stop(): void {
    this.stopped = true;
    if (this.handle) {
      this.scheduler.cancel(this.handle);
      this.handle = null;
    }
  }

  /** Deliver every event currently due. Exposed for deterministic integration tests. */
  public async processDue(): Promise<void> {
    if (this.running || this.stopped || !this.hub.enabled) {
      return;
    }
    this.running = true;
    try {
      const now = new Date(this.clock.now());
      const events = await this.repository.dueOutboxEvents(now);
      for (const event of events) {
        await this.deliver(event);
      }
    } catch (cause) {
      this.logger.error({ err: cause }, "Result outbox processing failed");
    } finally {
      this.running = false;
      if (this.shouldContinue()) {
        this.handle = this.scheduler.schedule(OUTBOX_POLL_INTERVAL_MS, () => {
          this.handle = null;
          void this.processDue();
        });
      }
    }
  }

  private shouldContinue(): boolean {
    return !this.stopped;
  }

  private async deliver(
    event: Awaited<ReturnType<MatchRepository["dueOutboxEvents"]>>[number],
  ): Promise<void> {
    if (!this.hub.enabled) return;
    try {
      const response = await this.fetcher(this.hub.resultWebhookUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.hub.sharedToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(event.payload),
      });
      if (!response.ok) {
        throw new Error(`Hub returned HTTP ${response.status}.`);
      }
      await this.repository.markOutboxDelivered(
        event.eventId,
        new Date(this.clock.now()),
      );
      this.logger.info({ eventId: event.eventId }, "Result webhook delivered");
    } catch (cause) {
      // Persist the next attempt before returning so a restart resumes from the
      // same durable schedule and never creates a second event identity.
      const attemptCount = event.attemptCount + 1;
      const retryDelay = WEBHOOK_RETRY_DELAYS_MS[attemptCount];
      const nextAttemptAt =
        retryDelay === undefined
          ? EXHAUSTED_RETRY_DATE
          : new Date(this.clock.now() + retryDelay);
      const message =
        cause instanceof Error ? cause.message : "Unknown webhook error";
      await this.repository.markOutboxFailed(
        event.eventId,
        attemptCount,
        nextAttemptAt,
        message,
      );
      this.logger.warn(
        { eventId: event.eventId, attemptCount, err: cause },
        retryDelay === undefined
          ? "Result webhook retries exhausted"
          : "Result webhook attempt failed",
      );
    }
  }
}
