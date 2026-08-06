/** Production process startup, recovery, SPA serving, and graceful shutdown. */

import { resolve } from "node:path";
import { staticPlugin } from "@elysiajs/static";
import { createApp } from "./app";
import { getConfig } from "./config";
import { createPostgresRepository } from "./db/repository";
import { createLogger } from "./logger";
import { MatchSessionRegistry } from "./session/registry";
import { WebhookWorker } from "./webhook";

const SHUTDOWN_DRAIN_MS = 5_000;

const config = getConfig();
const logger = createLogger(config.logLevel);
const repository = createPostgresRepository(config.databaseUrl);

// Any live rows predate this process and cannot have recoverable board state.
const aborted = await repository.abortNonterminalMatches();
if (aborted.length > 0) {
  logger.warn(
    { count: aborted.length },
    "Marked nonterminal matches premature after server restart",
  );
}

const webhookWorker = new WebhookWorker({
  repository,
  logger,
  hub: config.hub,
});
const registry = new MatchSessionRegistry({
  repository,
  logger,
  onMatchCompleted: () => webhookWorker.wake(),
});
const baseApp = createApp({ config, repository, registry, logger });

// The runtime image contains the Vite output; development uses Vite directly.
const app =
  config.nodeEnv === "production"
    ? baseApp
        .use(
          await staticPlugin({
            assets: resolve(import.meta.dir, "../../web/dist"),
            prefix: "/",
            alwaysStatic: true,
            indexHTML: true,
            silent: true,
          }),
        )
        .get("/*", ({ request, status }) => {
          const pathname = new URL(request.url).pathname;
          if (
            pathname.startsWith("/api/") ||
            pathname.startsWith("/health/") ||
            pathname.startsWith("/openapi")
          ) {
            return status(404, {
              code: "not_found",
              message: "No endpoint exists at this path.",
            });
          }
          return Bun.file(
            resolve(import.meta.dir, "../../web/dist/index.html"),
          );
        })
    : baseApp;

app.listen({ hostname: "0.0.0.0", port: config.serverPort });
registry.startCleanup();
webhookWorker.start();
logger.info({ port: config.serverPort }, "Battleship server listening");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");
  await app.stop(false);
  registry.shutdown();
  webhookWorker.stop();

  // Bound the drain so orchestration does not hang on an external callback.
  await Promise.race([
    repository.close(),
    new Promise<void>((resolveDrain) => {
      setTimeout(resolveDrain, SHUTDOWN_DRAIN_MS);
    }),
  ]);
  logger.info("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
