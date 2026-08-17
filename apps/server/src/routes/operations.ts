/** Process-health routes used by browsers and deployment orchestration. */

import { Elysia } from "elysia";
import { ApiErrorSchema } from "@battleship/contracts";
import type { RouteDependencies } from "./shared";
import { HealthSchema } from "./shared";

/** Expose liveness separately from database-backed readiness. */
export function createOperationsRoutes({
  repository,
  logger,
}: Pick<RouteDependencies, "repository" | "logger">) {
  return new Elysia({ name: "operations-routes" })
    .get("/health/live", () => ({ status: "ok" as const }), {
      response: HealthSchema,
      detail: { tags: ["Operations"] },
    })
    .get(
      "/health/ready",
      async ({ status }) => {
        try {
          await repository.checkReady();
          return { status: "ok" as const };
        } catch (cause) {
          logger.warn({ err: cause }, "Readiness check failed");
          return status(503, {
            code: "not_ready",
            message: "Database access or the required schema is unavailable.",
          });
        }
      },
      {
        response: { 200: HealthSchema, 503: ApiErrorSchema },
        detail: { tags: ["Operations"] },
      },
    );
}
