/** Production static assets and history fallback for the React application. */

import { resolve } from "node:path";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";

/** Serve the built SPA without masking unknown API or operational routes. */
export async function createSpaRoutes(assetsPath: string) {
  return new Elysia({ name: "spa-routes" })
    .use(
      await staticPlugin({
        assets: assetsPath,
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
      return Bun.file(resolve(assetsPath, "index.html"));
    });
}
