/** Production process startup, recovery, SPA serving, and graceful shutdown. */

import { resolve } from "node:path";
import { staticPlugin } from "@elysiajs/static";
import { createApp } from "./app";
import { getConfig, type ServerConfig } from "./config";
import { createPostgresRepository } from "./db/repository";
import { createLogger } from "./logger";
import type { StoredMatch } from "./repository";
import { MatchSessionRegistry } from "./session/registry";
import { WebhookWorker } from "./webhook";

const SHUTDOWN_DRAIN_MS = 5_000;

const bootstrapLogger = createLogger("info");
let config: ServerConfig;
try {
  config = getConfig();
} catch (error) {
  bootstrapLogger.fatal({ err: error }, "Server configuration is invalid");
  process.exit(1);
}
const logger = createLogger(config.logLevel);
const repository = createPostgresRepository(config.databaseUrl);

logger.info(
  {
    environment: config.nodeEnv,
    port: config.serverPort,
    databaseHost: config.dbHost,
    databasePort: config.dbPort,
    databaseName: config.dbName,
    databaseSsl: config.dbSsl,
    corsOriginCount: config.corsOrigins.length,
    hubEnabled: config.hub.enabled,
  },
  "Server configuration loaded",
);

// Any live rows predate this process and cannot have recoverable board state.
let aborted: readonly StoredMatch[];
try {
  aborted = await repository.abortNonterminalMatches();
  logger.info("Database connection and startup recovery succeeded");
} catch (error) {
  logger.fatal(
    {
      err: error,
      databaseHost: config.dbHost,
      databasePort: config.dbPort,
      databaseName: config.dbName,
      databaseSsl: config.dbSsl,
    },
    "Database startup failed",
  );
  await repository.close().catch(() => undefined);
  process.exit(1);
}
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
logger.info(
  { hostname: "0.0.0.0", port: config.serverPort },
  "Battleship server listening",
);

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
