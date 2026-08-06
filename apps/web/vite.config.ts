/** Development ports, proxy, and production frontend build configuration. */

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** Parse one optional TCP port and fail early on malformed configuration. */
function port(
  environment: Readonly<Record<string, string>>,
  name: "SERVER_PORT" | "VITE_PORT",
  fallback: number,
): number {
  const value = environment[name];
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return parsed;
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, "../..", "");
  const serverPort = port(environment, "SERVER_PORT", 8000);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: port(environment, "VITE_PORT", 5173),
      // Development alone has two processes. Vite keeps browser URLs relative
      // while forwarding API and WebSocket traffic to the configured Bun port.
      proxy: {
        "/api": {
          target: `http://localhost:${serverPort}`,
          ws: true,
        },
      },
    },
    build: {
      sourcemap: true,
    },
  };
});
